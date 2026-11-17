import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkItemEventBus } from '../my-day/work-item-event-bus';
import { DocumentAccessService } from './document-access.service';
import { authorOf, label } from './document-workflow.service';

const SOURCE_TYPES = new Set(['DEVIATION', 'ACTION', 'PROCESS', 'AUDIT', 'NONCONFORMITY', 'RISK', 'OTHER']);

/**
 * Solicitação de alteração de documento vigente.
 *
 * Qualquer pessoa que lê o documento pode pedir uma mudança (opcionalmente
 * citando a origem: desvio, plano de ação, auditoria...). O responsável aceita
 * (abrindo nova revisão) ou recusa com justificativa; quando a nova revisão é
 * publicada, a solicitação vira "implementada" e quem pediu é avisado.
 */
@Injectable()
export class DocumentChangeRequestService {
  private readonly logger = new Logger(DocumentChangeRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: DocumentAccessService,
    private readonly notifications: NotificationsService,
    private readonly workItems: WorkItemEventBus,
  ) {}

  async list(companyId: string, documentId: string) {
    const rows = await this.prisma.documentChangeRequest.findMany({ where: { companyId, documentId }, orderBy: { createdAt: 'desc' }, take: 200 });
    const userIds = [...new Set(rows.flatMap((row) => [row.requesterUserId, row.decidedById, row.ownerUserId]).filter(Boolean))] as string[];
    const users = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
    const byId = new Map(users.map((user) => [user.id, user]));
    return rows.map((row) => ({
      ...row,
      requester: byId.get(row.requesterUserId) ?? null,
      decidedBy: row.decidedById ? byId.get(row.decidedById) ?? null : null,
      owner: row.ownerUserId ? byId.get(row.ownerUserId) ?? null : null,
    }));
  }

  async create(me: AuthPayload, doc: any, body: any) {
    const reason = String(body?.reason ?? '').trim();
    if (reason.length < 5) throw new BadRequestException('Explique o que precisa mudar e por quê.');
    const sourceType = body?.sourceType ? String(body.sourceType).toUpperCase() : null;
    if (sourceType && !SOURCE_TYPES.has(sourceType)) throw new BadRequestException('Origem da solicitação inválida.');
    const owner = authorOf(doc);
    const version = await this.prisma.documentVersion.findFirst({ where: { documentId: doc.id, deletedAt: null }, orderBy: { revisionNumber: 'desc' } });
    const request = await this.prisma.documentChangeRequest.create({
      data: {
        companyId: me.companyId,
        documentId: doc.id,
        versionId: version?.id ?? null,
        requesterUserId: me.sub,
        ownerUserId: owner,
        reason: reason.slice(0, 4000),
        proposal: String(body?.proposal ?? '').trim().slice(0, 8000) || null,
        sourceType,
        sourceId: String(body?.sourceId ?? '').trim() || null,
        sourceLabel: String(body?.sourceLabel ?? '').trim().slice(0, 300) || null,
      },
    });
    await this.prisma.documentAuditLog.create({
      data: { companyId: me.companyId, documentId: doc.id, userId: me.sub, action: 'CHANGE_REQUESTED', afterValue: { requestId: request.id, sourceType } as Prisma.InputJsonValue, reason },
    });
    if (owner && owner !== me.sub) {
      await this.notify(me.companyId, owner, `Pedido de alteração: ${label(doc)}`, `${me.name}: ${reason.slice(0, 300)}`, doc.id);
    }
    this.workItems.markDirty(me.companyId, [owner, me.sub].filter(Boolean) as string[], 'document-change-requested');
    return request;
  }

  async load(companyId: string, requestId: string) {
    const request = await this.prisma.documentChangeRequest.findFirst({ where: { id: requestId, companyId }, include: { document: true } });
    if (!request || request.document.deletedAt) throw new NotFoundException('Solicitação de alteração não encontrada.');
    return request;
  }

  /** Aceita ou recusa. Aceitar com `openRevision` é tratado pelo serviço de documentos. */
  async decide(me: AuthPayload, requestId: string, body: any, canWrite: boolean) {
    const request = await this.load(me.companyId, requestId);
    if (request.status !== 'OPEN') throw new ConflictException('Esta solicitação já foi analisada.');
    const owner = request.ownerUserId ?? authorOf(request.document);
    if (owner !== me.sub && !canWrite && !(await this.accessPolicy.isManager(me))) {
      throw new ForbiddenException('Só o responsável pelo documento ou o gestor do GED analisa a solicitação.');
    }
    const decision = String(body?.decision ?? '').toUpperCase();
    if (!['ACCEPT', 'REJECT'].includes(decision)) throw new BadRequestException('Decisão inválida.');
    const note = String(body?.note ?? '').trim() || null;
    if (decision === 'REJECT' && !note) throw new BadRequestException('Explique por que a alteração não será feita.');
    const updated = await this.prisma.documentChangeRequest.update({
      where: { id: request.id },
      data: { status: decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED', decisionNote: note, decidedById: me.sub, decidedAt: new Date() },
    });
    await this.prisma.documentAuditLog.create({
      data: {
        companyId: me.companyId,
        documentId: request.documentId,
        userId: me.sub,
        action: decision === 'ACCEPT' ? 'CHANGE_REQUEST_ACCEPTED' : 'CHANGE_REQUEST_REJECTED',
        afterValue: { requestId: request.id } as Prisma.InputJsonValue,
        reason: note,
      },
    });
    if (request.requesterUserId !== me.sub) {
      await this.notify(
        me.companyId,
        request.requesterUserId,
        `${decision === 'ACCEPT' ? 'Alteração aceita' : 'Alteração recusada'}: ${label(request.document)}`,
        note ?? (decision === 'ACCEPT' ? 'O responsável vai preparar uma nova revisão.' : 'O responsável recusou a alteração.'),
        request.documentId,
      );
    }
    this.workItems.markDirty(me.companyId, [owner, request.requesterUserId, me.sub].filter(Boolean) as string[], 'document-change-decided');
    return { ...updated, document: request.document };
  }

  /** Ao publicar a nova revisão, as solicitações aceitas viram implementadas. */
  async markImplemented(companyId: string, documentId: string, versionId: string, title: string) {
    const accepted = await this.prisma.documentChangeRequest.findMany({ where: { companyId, documentId, status: 'ACCEPTED' } });
    if (!accepted.length) return 0;
    await this.prisma.documentChangeRequest.updateMany({ where: { id: { in: accepted.map((row) => row.id) } }, data: { status: 'IMPLEMENTED', implementedVersionId: versionId } });
    for (const row of accepted) {
      await this.notify(companyId, row.requesterUserId, `Alteração publicada: ${title}`.slice(0, 180), 'A revisão com a alteração que você pediu foi publicada.', documentId);
    }
    return accepted.length;
  }

  async pendingFor(companyId: string, userId: string) {
    return this.prisma.documentChangeRequest.findMany({
      where: { companyId, ownerUserId: userId, status: 'OPEN', document: { deletedAt: null } },
      include: { document: { select: { id: true, code: true, number: true, title: true, status: true, orgNodeId: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  private async notify(companyId: string, userId: string, title: string, body: string, documentId: string) {
    try {
      await this.notifications.create(companyId, userId, NotificationKind.MESSAGE, title.slice(0, 180), body.slice(0, 900), `/documents/${documentId}`);
    } catch (error) {
      this.logger.warn(`Aviso de solicitação não enviado: ${(error as Error).message}`);
    }
  }
}
