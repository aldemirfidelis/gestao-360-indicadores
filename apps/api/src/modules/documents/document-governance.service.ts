import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentConfidentiality, DocumentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { DocumentAccessService } from './document-access.service';
import { DocumentChangeRequestService } from './document-change-request.service';
import { DocumentDistributionService } from './document-distribution.service';
import { DATABASE_STORAGE_PREFIX, DocumentStorageService } from './document-storage.service';
import { assertDocumentUnchanged } from './document-lock';
import { DocumentWorkflowService } from './document-workflow.service';

const RELATION_KINDS = new Set(['REFERENCES', 'REPLACES', 'COMPLEMENTS']);
const DISPOSITIONS = new Set(['DESCARTAR', 'ARQUIVO_PERMANENTE', 'REAVALIAR']);
const ENDED = new Set<DocumentStatus>([DocumentStatus.OBSOLETE, DocumentStatus.ARCHIVED, DocumentStatus.REPLACED, DocumentStatus.CANCELLED]);

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))];
}

function text(value: unknown, max = 500): string | null {
  const clean = String(value ?? '').trim();
  return clean ? clean.slice(0, max) : null;
}

function date(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`${field} inválida.`);
  return parsed;
}

/**
 * Governança do GED: grupos e autorizações de acesso, relações entre
 * documentos, documentos externos, temporalidade/descarte, análise de
 * impacto e a caixa de pendências do usuário.
 */
@Injectable()
export class DocumentGovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: DocumentAccessService,
    private readonly storage: DocumentStorageService,
    private readonly workflow: DocumentWorkflowService,
    private readonly distribution: DocumentDistributionService,
    private readonly changeRequests: DocumentChangeRequestService,
  ) {}

  // ---------------------------------------------------------- grupos de acesso

  async listGroups(me: AuthPayload) {
    const groups = await this.prisma.documentAccessGroup.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: [{ active: 'desc' }, { name: 'asc' }] });
    const members = groups.length ? await this.prisma.documentAccessGroupUser.findMany({ where: { groupId: { in: groups.map((group) => group.id) } } }) : [];
    const userIds = [...new Set(members.map((member) => member.userId))];
    const users = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
    const byId = new Map(users.map((user) => [user.id, user]));
    return groups.map((group) => ({
      ...group,
      members: members.filter((member) => member.groupId === group.id).map((member) => byId.get(member.userId) ?? { id: member.userId, name: 'Usuário', email: '' }),
    }));
  }

  async saveGroup(me: AuthPayload, body: any, groupId?: string) {
    const name = text(body?.name, 120);
    if (!name) throw new BadRequestException('Informe o nome do grupo.');
    const memberIds = ids(body?.userIds);
    if (memberIds.length) {
      const count = await this.prisma.user.count({ where: { id: { in: memberIds }, companyId: me.companyId, deletedAt: null } });
      if (count !== memberIds.length) throw new BadRequestException('Há pessoas que não pertencem a esta empresa.');
    }
    try {
      const group = await this.prisma.$transaction(async (tx) => {
        const saved = groupId
          ? await tx.documentAccessGroup.update({ where: { id: (await this.loadGroup(me, groupId)).id }, data: { name, description: text(body?.description), active: body?.active ?? true } })
          : await tx.documentAccessGroup.create({ data: { companyId: me.companyId, name, description: text(body?.description) } });
        await tx.documentAccessGroupUser.deleteMany({ where: { groupId: saved.id } });
        if (memberIds.length) await tx.documentAccessGroupUser.createMany({ data: memberIds.map((userId) => ({ groupId: saved.id, userId })) });
        return saved;
      });
      this.accessPolicy.invalidate();
      return group;
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Já existe um grupo com este nome.');
      throw error;
    }
  }

  async removeGroup(me: AuthPayload, groupId: string) {
    const group = await this.loadGroup(me, groupId);
    await this.prisma.documentAccessGroup.update({ where: { id: group.id }, data: { deletedAt: new Date(), active: false } });
    this.accessPolicy.invalidate();
    return { ok: true };
  }

  private async loadGroup(me: AuthPayload, groupId: string) {
    const group = await this.prisma.documentAccessGroup.findFirst({ where: { id: groupId, companyId: me.companyId, deletedAt: null } });
    if (!group) throw new NotFoundException('Grupo de acesso não encontrado.');
    return group;
  }

  // ------------------------------------------------- autorizações por documento

  async access(me: AuthPayload, doc: any) {
    const rows = await this.prisma.documentPermission.findMany({ where: { companyId: me.companyId, documentId: doc.id, allowed: true } });
    const [users, nodes, groups] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: rows.map((row) => row.userId).filter(Boolean) as string[] } }, select: { id: true, name: true, email: true } }),
      this.prisma.orgNode.findMany({ where: { id: { in: rows.map((row) => row.orgNodeId).filter(Boolean) as string[] } }, select: { id: true, name: true } }),
      this.prisma.documentAccessGroup.findMany({ where: { id: { in: rows.map((row) => row.groupId).filter(Boolean) as string[] } }, select: { id: true, name: true } }),
    ]);
    return { confidentiality: doc.confidentiality, users, orgNodes: nodes, groups };
  }

  /** Classificação e lista de autorizados (restrito/confidencial). */
  async setAccess(me: AuthPayload, doc: any, body: any) {
    const level = String(body?.confidentiality ?? doc.confidentiality) as DocumentConfidentiality;
    if (!(Object.values(DocumentConfidentiality) as string[]).includes(level)) throw new BadRequestException('Classificação inválida.');
    const userIds = ids(body?.userIds);
    const orgNodeIds = ids(body?.orgNodeIds);
    const groupIds = ids(body?.groupIds);
    const [users, nodes, groups] = await Promise.all([
      userIds.length ? this.prisma.user.count({ where: { id: { in: userIds }, companyId: me.companyId, deletedAt: null } }) : 0,
      orgNodeIds.length ? this.prisma.orgNode.count({ where: { id: { in: orgNodeIds }, companyId: me.companyId, deletedAt: null } }) : 0,
      groupIds.length ? this.prisma.documentAccessGroup.count({ where: { id: { in: groupIds }, companyId: me.companyId, deletedAt: null } }) : 0,
    ]);
    if (users !== userIds.length || nodes !== orgNodeIds.length || groups !== groupIds.length) throw new BadRequestException('Há autorizações de fora desta empresa.');
    await this.prisma.$transaction(async (tx) => {
      await tx.documentPermission.deleteMany({ where: { companyId: me.companyId, documentId: doc.id, permission: 'VIEW' } });
      const rows: Prisma.DocumentPermissionCreateManyInput[] = [
        ...userIds.map((userId) => ({ companyId: me.companyId, documentId: doc.id, userId, permission: 'VIEW' })),
        ...orgNodeIds.map((orgNodeId) => ({ companyId: me.companyId, documentId: doc.id, orgNodeId, permission: 'VIEW' })),
        ...groupIds.map((groupId) => ({ companyId: me.companyId, documentId: doc.id, groupId, permission: 'VIEW' })),
      ];
      if (rows.length) await tx.documentPermission.createMany({ data: rows });
      await tx.document.update({ where: { id: doc.id }, data: { confidentiality: level } });
      await tx.documentAuditLog.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          userId: me.sub,
          action: 'ACCESS_UPDATED',
          beforeValue: { confidentiality: doc.confidentiality } as Prisma.InputJsonValue,
          afterValue: { confidentiality: level, userIds, orgNodeIds, groupIds } as Prisma.InputJsonValue,
          reason: 'Classificação e autorizações de acesso',
        },
      });
    });
    this.accessPolicy.invalidate();
    return this.access(me, { ...doc, confidentiality: level });
  }

  // ---------------------------------------------------------------- relações

  async relations(me: AuthPayload, doc: any) {
    const [outgoing, incoming] = await Promise.all([
      this.prisma.documentRelation.findMany({ where: { companyId: me.companyId, documentId: doc.id, relatedEntityType: 'DOCUMENT' } }),
      this.prisma.documentRelation.findMany({ where: { companyId: me.companyId, relatedEntityType: 'DOCUMENT', relatedEntityId: doc.id } }),
    ]);
    const docIds = [...new Set([...outgoing.map((row) => row.relatedEntityId), ...incoming.map((row) => row.documentId)])];
    const visibility = await this.accessPolicy.visibilityWhere(me);
    const docs = docIds.length
      ? await this.prisma.document.findMany({ where: { id: { in: docIds }, companyId: me.companyId, deletedAt: null, AND: [visibility] }, select: { id: true, code: true, number: true, title: true, status: true, version: true } })
      : [];
    const byId = new Map(docs.map((item) => [item.id, item]));
    return {
      outgoing: outgoing.filter((row) => byId.has(row.relatedEntityId)).map((row) => ({ id: row.id, kind: row.relationKind, document: byId.get(row.relatedEntityId) })),
      incoming: incoming.filter((row) => byId.has(row.documentId)).map((row) => ({ id: row.id, kind: row.relationKind, document: byId.get(row.documentId) })),
    };
  }

  async addRelation(me: AuthPayload, doc: any, body: any) {
    const targetId = text(body?.documentId, 64);
    const kind = String(body?.kind ?? 'REFERENCES').toUpperCase();
    if (!targetId) throw new BadRequestException('Escolha o documento relacionado.');
    if (!RELATION_KINDS.has(kind)) throw new BadRequestException('Tipo de relação inválido.');
    if (targetId === doc.id) throw new BadRequestException('Um documento não pode se relacionar com ele mesmo.');
    const target = await this.prisma.document.findFirst({ where: { id: targetId, companyId: me.companyId, deletedAt: null }, select: { id: true } });
    if (!target) throw new NotFoundException('Documento relacionado não encontrado.');
    try {
      return await this.prisma.documentRelation.create({
        data: { companyId: me.companyId, documentId: doc.id, relatedEntityType: 'DOCUMENT', relatedEntityId: targetId, relationKind: kind, createdById: me.sub },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Essa relação já existe.');
      throw error;
    }
  }

  async removeRelation(me: AuthPayload, doc: any, relationId: string) {
    const relation = await this.prisma.documentRelation.findFirst({ where: { id: relationId, companyId: me.companyId, documentId: doc.id } });
    if (!relation) throw new NotFoundException('Relação não encontrada.');
    await this.prisma.documentRelation.delete({ where: { id: relation.id } });
    return { ok: true };
  }

  // --------------------------------------------------------- documento externo

  async saveExternal(me: AuthPayload, doc: any, body: any) {
    const expirationDate = date(body?.expirationDate, 'Data de validade');
    const data = {
      issuer: text(body?.issuer, 200),
      responsibleAgency: text(body?.responsibleAgency, 200),
      externalNumber: text(body?.externalNumber, 120),
      issueDate: date(body?.issueDate, 'Data de emissão'),
      expirationDate,
      sourceLink: text(body?.sourceLink, 1000),
      internalOwnerUserId: text(body?.internalOwnerUserId, 64),
      requiresRenewal: Boolean(body?.requiresRenewal),
      alertDays: body?.alertDays ? Math.max(1, Math.min(365, Number(body.alertDays) || 30)) : null,
    };
    if (data.sourceLink && !/^https?:\/\//i.test(data.sourceLink)) throw new BadRequestException('O link da fonte deve começar com http:// ou https://.');
    const saved = await this.prisma.documentExternalMetadata.upsert({
      where: { documentId: doc.id },
      create: { companyId: me.companyId, documentId: doc.id, ...data },
      update: data,
    });
    // A validade do documento externo é a data em que a edição deve ser conferida.
    if (expirationDate) await this.prisma.document.update({ where: { id: doc.id }, data: { validUntil: expirationDate } });
    return saved;
  }

  // ----------------------------------------------------------- temporalidade

  async retention(me: AuthPayload) {
    const [rules, due] = await Promise.all([
      this.prisma.documentRetentionRule.findMany({ where: { companyId: me.companyId }, orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
      this.prisma.document.findMany({
        where: { companyId: me.companyId, deletedAt: null, disposedAt: null, retentionUntil: { lte: new Date() }, status: { in: [...ENDED] } },
        select: { id: true, code: true, number: true, title: true, status: true, retentionUntil: true },
        orderBy: { retentionUntil: 'asc' },
        take: 200,
      }),
    ]);
    return { rules, due };
  }

  async saveRetentionRule(me: AuthPayload, body: any, ruleId?: string) {
    const name = text(body?.name, 120);
    if (!name) throw new BadRequestException('Informe o nome da regra.');
    const retentionDays = Number(body?.retentionDays);
    if (!Number.isFinite(retentionDays) || retentionDays < 1 || retentionDays > 36_500) throw new BadRequestException('Prazo de guarda inválido (1 a 36.500 dias).');
    const disposition = String(body?.disposition ?? 'DESCARTAR').toUpperCase();
    if (!DISPOSITIONS.has(disposition)) throw new BadRequestException('Destinação inválida.');
    const typeConfigId = text(body?.typeConfigId, 64);
    if (typeConfigId) {
      const type = await this.prisma.documentTypeConfig.findFirst({ where: { id: typeConfigId, companyId: me.companyId, deletedAt: null } });
      if (!type) throw new NotFoundException('Tipo de documento não encontrado.');
    }
    const data = { name, retentionDays: Math.round(retentionDays), disposition, typeConfigId, active: body?.active ?? true };
    if (ruleId) {
      const rule = await this.prisma.documentRetentionRule.findFirst({ where: { id: ruleId, companyId: me.companyId } });
      if (!rule) throw new NotFoundException('Regra não encontrada.');
      return this.prisma.documentRetentionRule.update({ where: { id: rule.id }, data });
    }
    return this.prisma.documentRetentionRule.create({ data: { companyId: me.companyId, ...data } });
  }

  /** Data-limite de guarda ao encerrar o documento (obsoleto/arquivado). */
  async retentionUntil(companyId: string, typeConfigId: string | null | undefined, from = new Date()): Promise<Date | null> {
    const rule = await this.prisma.documentRetentionRule.findFirst({
      where: { companyId, active: true, OR: typeConfigId ? [{ typeConfigId }, { typeConfigId: null }] : [{ typeConfigId: null }] },
      orderBy: [{ typeConfigId: { sort: 'asc', nulls: 'last' } }],
    });
    if (!rule?.retentionDays || rule.disposition === 'ARQUIVO_PERMANENTE') return null;
    return new Date(from.getTime() + rule.retentionDays * 86_400_000);
  }

  /** Descarte após a temporalidade: remove os arquivos e mantém o registro do documento. */
  async dispose(me: AuthPayload, doc: any, body: any) {
    if (!(await this.accessPolicy.isManager(me))) throw new ForbiddenException('Só o gestor do GED faz o descarte.');
    if (!ENDED.has(doc.status)) throw new ConflictException('Só documentos obsoletos, substituídos ou arquivados podem ser descartados.');
    if (!doc.retentionUntil || doc.retentionUntil > new Date()) throw new ConflictException('O prazo de guarda deste documento ainda não terminou.');
    if (doc.disposedAt) throw new ConflictException('Este documento já foi descartado.');
    const reason = text(body?.reason, 1000);
    if (!reason) throw new BadRequestException('Registre a justificativa do descarte.');
    const now = new Date();
    const files = await this.prisma.$transaction(async (tx) => {
      await assertDocumentUnchanged(tx, me.companyId, doc);
      const files = await tx.documentFile.findMany({ where: { companyId: me.companyId, documentId: doc.id, deletedAt: null }, select: { id: true, storageKey: true } });
      const blobs = files.filter((file) => file.storageKey.startsWith(DATABASE_STORAGE_PREFIX)).map((file) => file.storageKey.slice(DATABASE_STORAGE_PREFIX.length));
      await tx.documentBlob.deleteMany({ where: { companyId: me.companyId, id: { in: blobs } } });
      await tx.documentFile.updateMany({ where: { id: { in: files.map((file) => file.id) } }, data: { deletedAt: now, contentText: null } });
      await tx.document.update({ where: { id: doc.id }, data: { disposedAt: now, contentJson: Prisma.DbNull, bodyText: null, content: null, searchText: null, status: DocumentStatus.ARCHIVED } });
      await tx.documentVersion.updateMany({ where: { documentId: doc.id }, data: { contentJson: Prisma.DbNull, bodyText: null } });
      await tx.documentAutosaveCheckpoint.updateMany({ where: { documentId: doc.id, companyId: me.companyId }, data: { content: null } });
      await tx.documentAuditLog.create({
        data: { companyId: me.companyId, documentId: doc.id, userId: me.sub, action: 'DISPOSED', afterValue: { files: files.length } as Prisma.InputJsonValue, reason },
      });
      return files;
    });
    // Arquivos legados em disco só são retirados após a confirmação no banco.
    for (const file of files) if (!file.storageKey.startsWith(DATABASE_STORAGE_PREFIX)) await this.storage.remove(file.storageKey);
    return { disposedAt: now, files: files.length };
  }

  // ------------------------------------------------------------------ impacto

  /** O que depende do documento (antes de torná-lo obsoleto ou substituí-lo). */
  async impact(me: AuthPayload, doc: any) {
    const [processLinks, standardizations, attachments, relations, pendingReads, openRequests] = await Promise.all([
      this.prisma.processIntegration.findMany({
        where: { documentId: doc.id, process: { companyId: me.companyId, deletedAt: null } },
        include: { process: { select: { id: true, code: true, name: true, ownerUserId: true } }, activity: { select: { id: true, name: true } } },
      }),
      this.prisma.monthlyMeetingStandardization.findMany({ where: { documentId: doc.id }, select: { id: true, description: true, status: true, meetingId: true } }),
      this.prisma.monthlyMeetingAttachment.findMany({ where: { documentId: doc.id }, select: { id: true, fileName: true, meetingId: true } }),
      this.relations(me, doc),
      this.prisma.documentReadConfirmation.count({ where: { companyId: me.companyId, documentId: doc.id, status: 'PENDING' } }),
      this.prisma.documentChangeRequest.count({ where: { companyId: me.companyId, documentId: doc.id, status: { in: ['OPEN', 'ACCEPTED'] } } }),
    ]);
    return {
      processes: processLinks.map((link) => ({ id: link.id, process: link.process, activity: link.activity, label: link.label, scope: link.activityId ? 'ACTIVITY' : 'PROCESS' })),
      monthlyMeetings: { standardizations, attachments },
      referencedBy: relations.incoming,
      references: relations.outgoing,
      pendingReads,
      openChangeRequests: openRequests,
      total: processLinks.length + standardizations.length + attachments.length + relations.incoming.length,
    };
  }

  // ------------------------------------------------------------ caixa do GED

  /** Tudo que o usuário precisa fazer no GED. */
  async inbox(me: AuthPayload) {
    const [steps, reads, requests, editRequests, adjustments, expiring] = await Promise.all([
      this.workflow.pendingFor(me.companyId, me.sub),
      this.distribution.pendingFor(me.companyId, me.sub),
      this.changeRequests.pendingFor(me.companyId, me.sub),
      this.prisma.documentEditRequest.findMany({
        where: { companyId: me.companyId, operatorUserId: me.sub, status: 'REQUESTED', document: { deletedAt: null } },
        include: { document: { select: { id: true, code: true, number: true, title: true, status: true } }, requester: { select: { id: true, name: true } } },
        take: 100,
      }),
      this.prisma.document.findMany({
        where: {
          companyId: me.companyId,
          deletedAt: null,
          status: { in: [DocumentStatus.ADJUSTMENTS_REQUESTED, DocumentStatus.REJECTED, DocumentStatus.APPROVED] },
          OR: [{ ownerUserId: me.sub }, { ownerUserId: null, createdById: me.sub }],
        },
        select: { id: true, code: true, number: true, title: true, status: true, updatedAt: true },
        take: 100,
      }),
      this.prisma.document.findMany({
        where: {
          companyId: me.companyId,
          deletedAt: null,
          status: { in: [DocumentStatus.PUBLISHED, DocumentStatus.NEAR_EXPIRATION, DocumentStatus.EXPIRED] },
          validUntil: { lte: new Date(Date.now() + 45 * 86_400_000) },
          OR: [{ ownerUserId: me.sub }, { ownerUserId: null, createdById: me.sub }],
        },
        select: { id: true, code: true, number: true, title: true, status: true, validUntil: true },
        orderBy: { validUntil: 'asc' },
        take: 100,
      }),
    ]);
    return {
      steps: steps.map((step) => ({ id: step.id, role: step.role, dueAt: step.dueAt, overdue: Boolean(step.dueAt && step.dueAt < new Date()), document: step.document })),
      reads: reads.map((read) => ({ id: read.id, dueAt: read.dueAt, overdue: Boolean(read.dueAt && read.dueAt < new Date()), document: read.document })),
      changeRequests: requests.map((request) => ({ id: request.id, reason: request.reason, sourceType: request.sourceType, createdAt: request.createdAt, document: request.document })),
      editRequests: editRequests.map((request) => ({ id: request.id, reason: request.reason, requester: request.requester, document: request.document })),
      adjustments,
      expiring,
    };
  }
}
