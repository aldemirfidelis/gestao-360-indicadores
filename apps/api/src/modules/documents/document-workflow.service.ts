import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DocumentApprovalDecision, DocumentContentFormat, DocumentFileKind, DocumentStatus, NotificationKind, Prisma } from '@prisma/client';
import { createHmac } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { docToPlainText, isDocNode } from '@g360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkItemEventBus } from '../my-day/work-item-event-bus';
import { DocumentAccessService } from './document-access.service';
import { DocumentContentService } from './document-content.service';
import { DocumentRenderService } from './document-render.service';
import { sha256 } from './document-storage.service';
import { assertDocumentUnchanged, lockDocument } from './document-lock';

type Tx = Prisma.TransactionClient;

export const REVIEW_ROLE = 'REVIEW';
export const APPROVAL_ROLE = 'APPROVAL';
const PENDING = 'PENDING';
const CANCELLED = 'CANCELLED';

export const EDITABLE_STATUSES = new Set<DocumentStatus>([
  DocumentStatus.DRAFT,
  DocumentStatus.IN_DEVELOPMENT,
  DocumentStatus.ADJUSTMENTS_REQUESTED,
  DocumentStatus.REJECTED,
]);
const REVIEW_PHASE = new Set<DocumentStatus>([DocumentStatus.WAITING_REVIEW, DocumentStatus.IN_REVIEW, DocumentStatus.REVIEW]);
const APPROVAL_PHASE = new Set<DocumentStatus>([DocumentStatus.WAITING_APPROVAL, DocumentStatus.IN_APPROVAL]);

export interface FlowConfig {
  workflowId: string | null;
  mode: 'SEQUENTIAL' | 'PARALLEL';
  reviewDays: number;
  approvalDays: number;
  reviewers: string[];
  approvers: string[];
}

export type DecisionInput = { decision: 'APPROVE' | 'REJECT' | 'ADJUST'; comment?: string | null; password?: string | null };

const MAX_FAILED_SIGNATURES = 5;
const SIGNATURE_LOCK_MS = 10 * 60 * 1000;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))];
}

function positive(value: unknown, fallback: number, max = 90) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.min(max, Math.round(n)) : fallback;
}

/** Quem elaborou a revisão: o responsável designado ou, na falta dele, quem criou. */
export function authorOf(doc: { ownerUserId?: string | null; createdById?: string | null }) {
  return doc.ownerUserId ?? doc.createdById ?? null;
}

/**
 * Fluxo de revisão e aprovação do GED.
 *
 * Cada documento tem revisores e aprovadores designados (sequencial ou
 * paralelo, com prazo por etapa). Ao enviar, o conteúdo da revisão é congelado
 * e cada etapa só pode ser decidida pela pessoa designada, que confirma a
 * decisão com a própria senha (assinatura eletrônica com código de
 * verificação). O elaborador nunca revisa nem aprova a própria revisão.
 */
@Injectable()
export class DocumentWorkflowService {
  private readonly logger = new Logger(DocumentWorkflowService.name);
  private readonly failures = new Map<string, { count: number; until: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: DocumentAccessService,
    private readonly notifications: NotificationsService,
    private readonly workItems: WorkItemEventBus,
    private readonly content: DocumentContentService,
    private readonly render: DocumentRenderService,
  ) {}

  // ------------------------------------------------------------------ config

  async config(companyId: string, doc: { id: string; typeConfigId?: string | null; approverUserId?: string | null }, client: Tx = this.prisma): Promise<FlowConfig> {
    const [workflow, typeConfig] = await Promise.all([
      client.documentWorkflow.findFirst({ where: { companyId, documentId: doc.id, active: true, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      doc.typeConfigId ? client.documentTypeConfig.findFirst({ where: { id: doc.typeConfigId, companyId }, select: { approvalFlow: true } }) : null,
    ]);
    const defaults = (typeConfig?.approvalFlow ?? {}) as Record<string, unknown>;
    const stored = (workflow?.steps ?? {}) as Record<string, unknown>;
    const approvers = ids(stored.approvers);
    return {
      workflowId: workflow?.id ?? null,
      mode: (workflow?.mode ?? defaults.mode) === 'PARALLEL' ? 'PARALLEL' : 'SEQUENTIAL',
      reviewDays: positive(stored.reviewDays ?? defaults.reviewDays, 5),
      approvalDays: positive(stored.approvalDays ?? defaults.approvalDays, 5),
      reviewers: ids(stored.reviewers),
      approvers: approvers.length ? approvers : doc.approverUserId ? [doc.approverUserId] : [],
    };
  }

  private async activeUsers(companyId: string, userIds: string[]) {
    if (!userIds.length) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, companyId, deletedAt: null, active: true, status: 'ACTIVE' },
      select: { id: true },
    });
    const found = new Set(users.map((user) => user.id));
    const missing = userIds.filter((id) => !found.has(id));
    if (missing.length) throw new BadRequestException('Há participantes inativos ou de outra empresa. Revise a lista.');
    return userIds;
  }

  /** Define revisores e aprovadores do documento (antes de enviar para o fluxo). */
  async setParticipants(me: AuthPayload, doc: any, body: any) {
    if (!EDITABLE_STATUSES.has(doc.status) && !PUBLISHED_OR_DONE.has(doc.status)) {
      throw new ConflictException('Os participantes não podem mudar com o documento em revisão ou aprovação. Cancele o envio para alterar.');
    }
    const reviewers = await this.activeUsers(me.companyId, ids(body?.reviewerIds));
    const approvers = await this.activeUsers(me.companyId, ids(body?.approverIds));
    const author = authorOf(doc);
    if (author && (reviewers.includes(author) || approvers.includes(author))) {
      throw new BadRequestException('Quem elabora o documento não pode revisá-lo nem aprová-lo. Escolha outras pessoas.');
    }
    const overlap = reviewers.filter((id) => approvers.includes(id));
    if (overlap.length) throw new BadRequestException('A mesma pessoa não pode ser revisora e aprovadora da mesma revisão.');
    const current = await this.config(me.companyId, doc);
    const mode = body?.mode === 'PARALLEL' ? 'PARALLEL' : body?.mode === 'SEQUENTIAL' ? 'SEQUENTIAL' : current.mode;
    const steps = {
      reviewers,
      approvers,
      reviewDays: positive(body?.reviewDays, current.reviewDays),
      approvalDays: positive(body?.approvalDays, current.approvalDays),
    };
    await this.prisma.$transaction(async (tx) => {
      await assertDocumentUnchanged(tx, me.companyId, doc);
      if (current.workflowId) {
        await tx.documentWorkflow.update({ where: { id: current.workflowId }, data: { mode, steps } });
      } else {
        await tx.documentWorkflow.create({
          data: { companyId: me.companyId, documentId: doc.id, typeConfigId: doc.typeConfigId ?? null, name: 'Fluxo do documento', mode, steps, createdById: me.sub },
        });
      }
      await tx.document.update({ where: { id: doc.id }, data: { approverUserId: approvers[0] ?? null } });
      await tx.documentAuditLog.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          userId: me.sub,
          action: 'WORKFLOW_PARTICIPANTS',
          beforeValue: { reviewers: current.reviewers, approvers: current.approvers, mode: current.mode } as Prisma.InputJsonValue,
          afterValue: { ...steps, mode } as Prisma.InputJsonValue,
          reason: 'Definição de revisores e aprovadores',
        },
      });
    });
    return this.config(me.companyId, { ...doc, approverUserId: approvers[0] ?? null });
  }

  // ------------------------------------------------------------------- state

  /** Situação do fluxo da revisão atual (para a página do documento). */
  async state(me: AuthPayload, doc: any) {
    const [config, version] = await Promise.all([
      this.config(me.companyId, doc),
      this.prisma.documentVersion.findFirst({ where: { documentId: doc.id, deletedAt: null }, orderBy: { revisionNumber: 'desc' } }),
    ]);
    const steps = version
      ? await this.prisma.documentWorkflowStep.findMany({ where: { documentId: doc.id, versionId: version.id }, orderBy: [{ role: 'desc' }, { stepOrder: 'asc' }, { createdAt: 'asc' }] })
      : [];
    const userIds = [...new Set([...config.reviewers, ...config.approvers, ...steps.map((step) => step.userId).filter(Boolean)])] as string[];
    const users = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
    const byId = new Map(users.map((user) => [user.id, user]));
    const active = this.activeStepIds(steps, config.mode, doc.status);
    const visibleSteps = steps.filter((step) => step.decision !== CANCELLED);
    const mine = visibleSteps.find((step) => step.userId === me.sub && active.has(step.id));
    return {
      mode: config.mode,
      reviewDays: config.reviewDays,
      approvalDays: config.approvalDays,
      reviewers: config.reviewers.map((id) => byId.get(id) ?? { id, name: 'Usuário', email: '' }),
      approvers: config.approvers.map((id) => byId.get(id) ?? { id, name: 'Usuário', email: '' }),
      author: authorOf(doc),
      versionId: version?.id ?? null,
      versionLabel: version?.versionLabel ?? null,
      changeSummary: version?.changeSummary ?? null,
      contentHash: version?.contentHash ?? null,
      steps: visibleSteps.map((step) => ({
        id: step.id,
        role: step.role,
        order: step.stepOrder,
        user: step.userId ? byId.get(step.userId) ?? { id: step.userId, name: 'Usuário', email: '' } : null,
        decision: step.decision,
        comment: step.comment,
        dueAt: step.dueAt,
        decidedAt: step.decidedAt,
        delegatedFromUserId: step.delegatedFromUserId,
        active: active.has(step.id),
        overdue: Boolean(step.decision === PENDING && step.dueAt && step.dueAt < new Date()),
      })),
      myStepId: mine?.id ?? null,
      myRole: mine?.role ?? null,
      canSubmit: EDITABLE_STATUSES.has(doc.status),
      inFlow: REVIEW_PHASE.has(doc.status) || APPROVAL_PHASE.has(doc.status) || doc.status === DocumentStatus.REVIEWED,
    };
  }

  /** Etapas que já podem ser decididas (sequencial: a menor ordem pendente da fase). */
  activeStepIds(steps: Array<{ id: string; role: string | null; stepOrder: number; decision: string }>, mode: string, status: DocumentStatus): Set<string> {
    const phase = REVIEW_PHASE.has(status) ? REVIEW_ROLE : APPROVAL_PHASE.has(status) ? APPROVAL_ROLE : null;
    if (!phase) return new Set();
    const pending = steps.filter((step) => step.role === phase && step.decision === PENDING);
    if (!pending.length) return new Set();
    if (mode === 'PARALLEL') return new Set(pending.map((step) => step.id));
    const first = Math.min(...pending.map((step) => step.stepOrder));
    return new Set(pending.filter((step) => step.stepOrder === first).map((step) => step.id));
  }

  // ------------------------------------------------------------------ submit

  /** Congela o conteúdo da revisão e abre as etapas de revisão (ou aprovação). */
  async submit(me: AuthPayload, doc: any, body: any = {}) {
    if (!EDITABLE_STATUSES.has(doc.status)) throw new ConflictException('Somente documentos em elaboração podem ser enviados para revisão.');
    const config = await this.config(me.companyId, doc);
    if (!config.approvers.length) throw new BadRequestException('Defina ao menos um aprovador antes de enviar o documento.');
    const author = authorOf(doc);
    if (author && [...config.reviewers, ...config.approvers].includes(author)) {
      throw new BadRequestException('Quem elabora o documento não pode revisá-lo nem aprová-lo. Ajuste os participantes.');
    }
    const version = await this.prisma.documentVersion.findFirst({ where: { documentId: doc.id, deletedAt: null }, orderBy: { revisionNumber: 'desc' } });
    if (!version) throw new NotFoundException('Revisão do documento não encontrada.');
    const changeSummary = String(body?.changeSummary ?? '').trim() || version.changeSummary || null;
    if (version.revisionNumber > 0 && !changeSummary) throw new BadRequestException('Descreva o que mudou nesta revisão antes de enviar.');

    const snapshot = await this.snapshot(doc, version);
    const now = new Date();
    const hasReviewers = config.reviewers.length > 0;
    const to = hasReviewers ? DocumentStatus.WAITING_REVIEW : DocumentStatus.WAITING_APPROVAL;
    const comment = String(body?.comment ?? '').trim() || null;
    await this.prisma.$transaction(async (tx) => {
      await assertDocumentUnchanged(tx, me.companyId, doc);
      await tx.documentWorkflowStep.updateMany({ where: { documentId: doc.id, versionId: version.id, decision: PENDING }, data: { decision: CANCELLED } });
      await this.createSteps(tx, me.companyId, doc.id, version.id, hasReviewers ? REVIEW_ROLE : APPROVAL_ROLE, hasReviewers ? config.reviewers : config.approvers, config, now);
      await tx.documentVersion.update({
        where: { id: version.id },
        data: { status: to, changeSummary, contentJson: snapshot.contentJson ?? Prisma.DbNull, bodyText: snapshot.bodyText, contentHash: snapshot.contentHash },
      });
      await tx.document.update({ where: { id: doc.id }, data: { status: to, changeNote: changeSummary ?? doc.changeNote } });
      await this.historyTx(tx, me, doc.id, version.id, doc.status, to, comment ?? 'Enviado para análise', { contentHash: snapshot.contentHash });
    });
    const notified = hasReviewers ? this.firstWave(config.reviewers, config.mode) : this.firstWave(config.approvers, config.mode);
    await this.notifyMany(me.companyId, notified, `${hasReviewers ? 'Revisar' : 'Aprovar'}: ${label(doc)}`, `${me.name} enviou "${doc.title}" (${version.versionLabel}) para ${hasReviewers ? 'revisão' : 'aprovação'}.`, doc.id);
    this.workItems.markDirty(me.companyId, [...config.reviewers, ...config.approvers, me.sub, author].filter(Boolean) as string[], 'document-submitted');
    return { status: to };
  }

  private firstWave(users: string[], mode: string) {
    return mode === 'PARALLEL' ? users : users.slice(0, 1);
  }

  private async createSteps(tx: Tx, companyId: string, documentId: string, versionId: string, role: string, users: string[], config: FlowConfig, now: Date) {
    const days = role === REVIEW_ROLE ? config.reviewDays : config.approvalDays;
    await tx.documentWorkflowStep.createMany({
      data: users.map((userId, index) => ({
        companyId,
        documentId,
        versionId,
        workflowId: config.workflowId,
        role,
        userId,
        stepOrder: config.mode === 'PARALLEL' ? 1 : index + 1,
        // Sequencial: o prazo de cada etapa corre a partir da anterior.
        dueAt: addDays(now, config.mode === 'PARALLEL' ? days : days * (index + 1)),
        decision: PENDING,
      })),
    });
  }

  /** Conteúdo congelado da revisão (o que será assinado e publicado). */
  private async snapshot(doc: any, version: any) {
    if (doc.contentFormat === DocumentContentFormat.STRUCTURED && isDocNode(doc.contentJson)) {
      const json = JSON.stringify(doc.contentJson);
      return { contentJson: doc.contentJson as Prisma.InputJsonValue, bodyText: docToPlainText(doc.contentJson), contentHash: sha256(json) };
    }
    if (doc.contentFormat === DocumentContentFormat.DOCX || doc.contentFormat === DocumentContentFormat.FILE) {
      const file = doc.contentFormat === DocumentContentFormat.DOCX
        ? await this.render.latestDocx(doc, version)
        : null;
      const bodyText = await this.content.currentBodyText(doc);
      // O hash assinado é o do próprio arquivo: o Word da revisão ou o PDF principal.
      const fileRow = doc.contentFormat === DocumentContentFormat.DOCX
        ? version.docxFileId ? await this.prisma.documentFile.findFirst({ where: { id: version.docxFileId }, select: { hashSha256: true } }) : null
        : await this.prisma.documentFile.findFirst({
            where: { documentId: doc.id, versionId: version.id, kind: DocumentFileKind.ATTACHMENT, mimeType: 'application/pdf', protected: true, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: { hashSha256: true },
          });
      return { contentJson: null, bodyText, contentHash: fileRow?.hashSha256 ?? (file ? sha256(file.buffer.toString('base64')) : sha256(bodyText)) };
    }
    const text = doc.content ?? '';
    return { contentJson: null, bodyText: text, contentHash: sha256(text) };
  }

  // ------------------------------------------------------------------ decide

  /** Decisão da etapa do usuário, assinada com a senha. */
  async decide(me: AuthPayload, doc: any, body: DecisionInput, context: { ip?: string; userAgent?: string } = {}) {
    const decision = body?.decision;
    if (!['APPROVE', 'REJECT', 'ADJUST'].includes(decision)) throw new BadRequestException('Decisão inválida.');
    const comment = String(body?.comment ?? '').trim() || null;
    if (decision !== 'APPROVE' && !comment) throw new BadRequestException('Explique o motivo para o elaborador.');

    const { phase, config, version, signatureHash, to, nextWave } = await this.prisma.$transaction(async (tx) => {
      // Leia as etapas somente depois do lock. Outra decisão pode ter sido concluída
      // entre a abertura da tela e a chegada desta requisição.
      doc = await lockDocument(tx, me.companyId, doc.id);
      const phase = REVIEW_PHASE.has(doc.status) ? REVIEW_ROLE : APPROVAL_PHASE.has(doc.status) ? APPROVAL_ROLE : null;
      if (!phase) throw new ConflictException('Este documento não está aguardando revisão nem aprovação.');
      if (decision === 'REJECT' && phase === REVIEW_ROLE) throw new BadRequestException('Na revisão, peça ajustes. A reprovação é decisão do aprovador.');
      if (authorOf(doc) === me.sub) throw new ForbiddenException('Quem elabora o documento não pode revisá-lo nem aprová-lo.');

      const config = await this.config(me.companyId, doc, tx);
      const version = await tx.documentVersion.findFirst({ where: { documentId: doc.id, deletedAt: null }, orderBy: { revisionNumber: 'desc' } });
      if (!version) throw new NotFoundException('Revisão do documento não encontrada.');
      const steps = await tx.documentWorkflowStep.findMany({ where: { documentId: doc.id, versionId: version.id } });
      const active = this.activeStepIds(steps, config.mode, doc.status);
      const step = steps.find((item) => item.userId === me.sub && item.role === phase && active.has(item.id));
      if (!step) {
        const waiting = steps.some((item) => item.userId === me.sub && item.role === phase && item.decision === PENDING);
        throw new ForbiddenException(waiting ? 'Sua etapa ainda não começou: aguarde a decisão anterior.' : 'Esta etapa não está atribuída a você.');
      }

      await this.verifySignature(me, body?.password, tx);
      const decidedAt = new Date();
      const stepDecision = decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'ADJUSTMENTS_REQUESTED';
      const approvalDecision =
        decision === 'APPROVE' ? DocumentApprovalDecision.APPROVED : decision === 'REJECT' ? DocumentApprovalDecision.REJECTED : DocumentApprovalDecision.ADJUSTMENTS_REQUESTED;
      const role = phase === REVIEW_ROLE ? 'REVIEWER' : 'APPROVER';
      const contentHash = version.contentHash ?? null;
      const signatureHash = this.signatureHash([doc.id, version.id, me.sub, role, stepDecision, contentHash ?? '', decidedAt.toISOString()]);

      let to: DocumentStatus = doc.status;
      let nextWave: string[] = [];
      await tx.documentWorkflowStep.update({ where: { id: step.id }, data: { decision: stepDecision, comment, decidedAt } });
      await tx.documentApproval.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          versionId: version.id,
          approverUserId: me.sub,
          approverRole: role,
          approvalOrder: step.stepOrder,
          decision: approvalDecision,
          statusFrom: doc.status,
          comment,
          decidedAt,
          ip: context.ip ?? null,
          userAgent: context.userAgent?.slice(0, 500) ?? null,
          stepId: step.id,
          signatureMethod: 'PASSWORD',
          signatureHash,
          contentHash,
          delegatedFromUserId: step.delegatedFromUserId,
        },
      });

      if (decision !== 'APPROVE') {
        await tx.documentWorkflowStep.updateMany({ where: { documentId: doc.id, versionId: version.id, decision: PENDING }, data: { decision: CANCELLED } });
        to = decision === 'REJECT' ? DocumentStatus.REJECTED : DocumentStatus.ADJUSTMENTS_REQUESTED;
        if (decision === 'ADJUST') {
          await tx.documentReviewRequest.create({
            data: { companyId: me.companyId, documentId: doc.id, versionId: version.id, reviewerUserId: me.sub, authorUserId: authorOf(doc), comment: comment! },
          });
        }
      } else {
        const remaining = steps.filter((item) => item.id !== step.id && item.role === phase && item.decision === PENDING);
        if (remaining.length) {
          to = phase === REVIEW_ROLE ? DocumentStatus.IN_REVIEW : DocumentStatus.IN_APPROVAL;
          if (config.mode === 'SEQUENTIAL') {
            const next = Math.min(...remaining.map((item) => item.stepOrder));
            if (next !== step.stepOrder) nextWave = remaining.filter((item) => item.stepOrder === next).map((item) => item.userId!).filter(Boolean);
          }
        } else if (phase === REVIEW_ROLE) {
          await this.historyTx(tx, me, doc.id, version.id, doc.status, DocumentStatus.REVIEWED, 'Revisão concluída');
          await this.createSteps(tx, me.companyId, doc.id, version.id, APPROVAL_ROLE, config.approvers, config, decidedAt);
          to = DocumentStatus.WAITING_APPROVAL;
          nextWave = this.firstWave(config.approvers, config.mode);
        } else {
          to = DocumentStatus.APPROVED;
        }
      }
      await tx.documentVersion.update({ where: { id: version.id }, data: { status: to } });
      await tx.document.update({
        where: { id: doc.id },
        data: { status: to, ...(to === DocumentStatus.APPROVED ? { approvedAt: decidedAt } : {}) },
      });
      await this.historyTx(tx, me, doc.id, version.id, phase === REVIEW_ROLE && to === DocumentStatus.WAITING_APPROVAL ? DocumentStatus.REVIEWED : doc.status, to, comment ?? (decision === 'APPROVE' ? 'Aprovado' : 'Decisão registrada'), { stepId: step.id, signature: signatureHash.slice(0, 12) });
      return { phase, config, version, signatureHash, to, nextWave };
    });

    const author = authorOf(doc);
    if (decision === 'ADJUST' && author) await this.notifyMany(me.companyId, [author], `Ajustes solicitados: ${label(doc)}`, `${me.name}: ${comment}`, doc.id);
    if (decision === 'REJECT' && author) await this.notifyMany(me.companyId, [author], `Documento reprovado: ${label(doc)}`, `${me.name}: ${comment}`, doc.id);
    if (nextWave.length) {
      const verb = to === DocumentStatus.WAITING_APPROVAL || phase === APPROVAL_ROLE ? 'Aprovar' : 'Revisar';
      await this.notifyMany(me.companyId, nextWave, `${verb}: ${label(doc)}`, `"${doc.title}" (${version.versionLabel}) aguarda sua decisão.`, doc.id);
    }
    if (to === DocumentStatus.APPROVED && author) {
      await this.notifyMany(me.companyId, [author], `Documento aprovado: ${label(doc)}`, `"${doc.title}" (${version.versionLabel}) foi aprovado e pode ser publicado.`, doc.id);
    }
    this.workItems.markDirty(me.companyId, [...config.reviewers, ...config.approvers, me.sub, author].filter(Boolean) as string[], 'document-decision');
    return { status: to, signature: signatureHash.slice(0, 12).toUpperCase(), approved: to === DocumentStatus.APPROVED };
  }

  /** Reautenticação da assinatura (senha do próprio usuário), com bloqueio por tentativas. */
  async verifySignature(me: AuthPayload, password: unknown, client: Tx = this.prisma) {
    const secret = String(password ?? '');
    if (!secret) throw new BadRequestException('Informe sua senha para assinar a decisão.');
    const state = this.failures.get(me.sub);
    if (state && state.until > Date.now()) throw new ForbiddenException('Muitas tentativas de assinatura. Aguarde alguns minutos.');
    const user = await client.user.findUnique({ where: { id: me.sub }, select: { passwordHash: true, active: true } });
    const ok = Boolean(user?.active && user.passwordHash && (await bcrypt.compare(secret, user.passwordHash)));
    if (!ok) {
      const count = (state && state.until <= Date.now() && state.count >= MAX_FAILED_SIGNATURES ? 0 : state?.count ?? 0) + 1;
      this.failures.set(me.sub, { count, until: count >= MAX_FAILED_SIGNATURES ? Date.now() + SIGNATURE_LOCK_MS : 0 });
      // 400 (e não 401) para o front não tentar renovar a sessão com a senha errada.
      throw new BadRequestException('Senha incorreta. A decisão não foi registrada.');
    }
    this.failures.delete(me.sub);
  }

  signatureHash(parts: string[]): string {
    const secret = process.env.DOCUMENT_SIGNATURE_SECRET || process.env.JWT_ACCESS_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'g360-dev-signature');
    if (!secret) throw new Error('Segredo de assinatura não configurado.');
    return createHmac('sha256', secret).update(parts.join('|')).digest('hex');
  }

  // -------------------------------------------------------- delegate/cancel

  async delegate(me: AuthPayload, doc: any, body: any) {
    const stepId = String(body?.stepId ?? '').trim();
    const toUserId = String(body?.toUserId ?? '').trim();
    const reason = String(body?.reason ?? '').trim();
    if (!stepId || !toUserId) throw new BadRequestException('Informe a etapa e a pessoa que vai assumir.');
    if (!reason) throw new BadRequestException('Informe o motivo da delegação.');
    const step = await this.prisma.documentWorkflowStep.findFirst({ where: { id: stepId, documentId: doc.id, decision: PENDING } });
    if (!step) throw new NotFoundException('Etapa pendente não encontrada.');
    const manager = await this.accessPolicy.isManager(me);
    if (step.userId !== me.sub && !manager) throw new ForbiddenException('Só quem está na etapa ou o gestor do GED pode delegá-la.');
    if (toUserId === authorOf(doc)) throw new BadRequestException('A etapa não pode ser delegada a quem elaborou o documento.');
    await this.activeUsers(me.companyId, [toUserId]);
    const busy = await this.prisma.documentWorkflowStep.findFirst({ where: { documentId: doc.id, versionId: step.versionId, userId: toUserId, decision: PENDING } });
    if (busy) throw new ConflictException('Essa pessoa já tem uma etapa pendente nesta revisão.');
    await this.prisma.$transaction(async (tx) => {
      await assertDocumentUnchanged(tx, me.companyId, doc);
      const currentStep = await tx.documentWorkflowStep.findFirst({ where: { id: step.id, documentId: doc.id, decision: PENDING, userId: step.userId } });
      if (!currentStep) throw new ConflictException('Esta etapa já foi decidida ou delegada. Atualize o fluxo.');
      await tx.documentWorkflowStep.update({ where: { id: step.id }, data: { userId: toUserId, delegatedFromUserId: step.userId, remindedAt: null } });
      await tx.document.update({ where: { id: doc.id }, data: { updatedAt: new Date() } });
      await tx.documentApproval.create({
        data: {
          companyId: me.companyId,
          documentId: doc.id,
          versionId: step.versionId,
          approverUserId: step.userId,
          approverRole: step.role === REVIEW_ROLE ? 'REVIEWER' : 'APPROVER',
          approvalOrder: step.stepOrder,
          decision: DocumentApprovalDecision.DELEGATED,
          comment: reason,
          decidedAt: new Date(),
          stepId: step.id,
          delegatedFromUserId: step.userId,
        },
      });
      await tx.documentAuditLog.create({
        data: { companyId: me.companyId, documentId: doc.id, userId: me.sub, action: 'WORKFLOW_DELEGATED', beforeValue: { userId: step.userId }, afterValue: { userId: toUserId }, reason },
      });
    });
    await this.notifyMany(me.companyId, [toUserId], `Etapa delegada a você: ${label(doc)}`, `${me.name} delegou a ${step.role === REVIEW_ROLE ? 'revisão' : 'aprovação'} de "${doc.title}". Motivo: ${reason}`, doc.id);
    this.workItems.markDirty(me.companyId, [toUserId, step.userId, me.sub].filter(Boolean) as string[], 'document-delegated');
    return { ok: true };
  }

  /** Retira o documento do fluxo (volta para elaboração). */
  async cancel(me: AuthPayload, doc: any, body: any) {
    if (!(REVIEW_PHASE.has(doc.status) || APPROVAL_PHASE.has(doc.status) || doc.status === DocumentStatus.REVIEWED || doc.status === DocumentStatus.APPROVED)) {
      throw new ConflictException('O documento não está em revisão ou aprovação.');
    }
    const reason = String(body?.reason ?? '').trim();
    if (!reason) throw new BadRequestException('Informe o motivo para retirar o documento do fluxo.');
    const version = await this.prisma.documentVersion.findFirst({ where: { documentId: doc.id, deletedAt: null }, orderBy: { revisionNumber: 'desc' } });
    const pending = version ? await this.prisma.documentWorkflowStep.findMany({ where: { documentId: doc.id, versionId: version.id, decision: PENDING }, select: { userId: true } }) : [];
    await this.prisma.$transaction(async (tx) => {
      await assertDocumentUnchanged(tx, me.companyId, doc);
      if (version) {
        await tx.documentWorkflowStep.updateMany({ where: { documentId: doc.id, versionId: version.id, decision: PENDING }, data: { decision: CANCELLED } });
        await tx.documentVersion.update({ where: { id: version.id }, data: { status: DocumentStatus.IN_DEVELOPMENT } });
      }
      await tx.document.update({ where: { id: doc.id }, data: { status: DocumentStatus.IN_DEVELOPMENT, approvedAt: null } });
      await this.historyTx(tx, me, doc.id, version?.id ?? null, doc.status, DocumentStatus.IN_DEVELOPMENT, reason);
    });
    const users = pending.map((item) => item.userId).filter(Boolean) as string[];
    await this.notifyMany(me.companyId, users, `Fluxo cancelado: ${label(doc)}`, `${me.name} retirou "${doc.title}" do fluxo. Motivo: ${reason}`, doc.id);
    this.workItems.markDirty(me.companyId, [...users, me.sub], 'document-flow-cancelled');
    return { status: DocumentStatus.IN_DEVELOPMENT };
  }

  // --------------------------------------------------------------- pendências

  /** Etapas que o usuário pode decidir agora (Meu Dia e caixa do GED). */
  async pendingFor(companyId: string, userId: string) {
    const steps = await this.prisma.documentWorkflowStep.findMany({
      where: { companyId, userId, decision: PENDING, document: { deletedAt: null } },
      include: { document: { select: { id: true, code: true, number: true, title: true, status: true, orgNodeId: true, typeConfigId: true, approverUserId: true, createdAt: true, updatedAt: true } } },
      take: 300,
    });
    const docIds = [...new Set(steps.map((step) => step.documentId))];
    const allSteps = docIds.length ? await this.prisma.documentWorkflowStep.findMany({ where: { documentId: { in: docIds }, decision: PENDING } }) : [];
    const workflows = docIds.length ? await this.prisma.documentWorkflow.findMany({ where: { documentId: { in: docIds }, active: true, deletedAt: null }, select: { documentId: true, mode: true } }) : [];
    const modeByDoc = new Map(workflows.map((item) => [item.documentId!, item.mode]));
    return steps.filter((step) => {
      const siblings = allSteps.filter((item) => item.documentId === step.documentId && item.versionId === step.versionId);
      return this.activeStepIds(siblings, modeByDoc.get(step.documentId) ?? 'SEQUENTIAL', step.document.status).has(step.id);
    });
  }

  /** Lembretes de prazo das etapas e escalonamento ao responsável (rotina diária). */
  async reminders(companyId: string) {
    const now = new Date();
    const soon = addDays(now, 1);
    const yesterday = addDays(now, -1);
    const steps = await this.prisma.documentWorkflowStep.findMany({
      where: { companyId, decision: PENDING, dueAt: { lte: soon }, OR: [{ remindedAt: null }, { remindedAt: { lt: yesterday } }], document: { deletedAt: null } },
      include: { document: { select: { id: true, code: true, number: true, title: true, status: true, ownerUserId: true, createdById: true } } },
      take: 300,
    });
    let sent = 0;
    for (const step of steps) {
      if (!step.userId || !(REVIEW_PHASE.has(step.document.status) || APPROVAL_PHASE.has(step.document.status))) continue;
      const overdue = Boolean(step.dueAt && step.dueAt < now);
      const verb = step.role === REVIEW_ROLE ? 'revisão' : 'aprovação';
      await this.notifyMany(companyId, [step.userId], `${overdue ? 'Prazo vencido' : 'Prazo amanhã'}: ${label(step.document)}`, `A ${verb} de "${step.document.title}" ${overdue ? 'está atrasada' : 'vence em até 24 horas'}.`, step.document.id);
      const owner = authorOf(step.document);
      if (overdue && owner && owner !== step.userId) {
        await this.notifyMany(companyId, [owner], `Etapa atrasada: ${label(step.document)}`, `A ${verb} de "${step.document.title}" passou do prazo.`, step.document.id);
      }
      await this.prisma.documentWorkflowStep.update({ where: { id: step.id }, data: { remindedAt: now } });
      sent++;
    }
    return sent;
  }

  // ----------------------------------------------------------------- helpers

  async historyTx(tx: Tx, me: AuthPayload, documentId: string, versionId: string | null, from: string | null, to: string, comment?: string | null, metadata?: Record<string, unknown>) {
    await tx.documentStatusHistory.create({
      data: {
        companyId: me.companyId,
        documentId,
        versionId,
        userId: me.sub,
        statusFrom: from,
        statusTo: to,
        comment: comment ?? null,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
    await tx.documentAuditLog.create({
      data: { companyId: me.companyId, documentId, versionId, userId: me.sub, action: 'STATUS_CHANGE', beforeValue: { status: from }, afterValue: { status: to }, reason: comment ?? null },
    });
  }

  async notifyMany(companyId: string, userIds: string[], title: string, body: string, documentId: string) {
    for (const userId of [...new Set(userIds.filter(Boolean))]) {
      try {
        await this.notifications.create(companyId, userId, NotificationKind.MESSAGE, title.slice(0, 180), body.slice(0, 900), `/documents/${documentId}`);
      } catch (error) {
        this.logger.warn(`Aviso do GED não enviado: ${(error as Error).message}`);
      }
    }
  }
}

const PUBLISHED_OR_DONE = new Set<DocumentStatus>([
  DocumentStatus.PUBLISHED,
  DocumentStatus.NEAR_EXPIRATION,
  DocumentStatus.EXPIRED,
  DocumentStatus.PERIODIC_REVIEW,
  DocumentStatus.APPROVED,
  DocumentStatus.SCHEDULED_PUBLICATION,
]);

export function label(doc: { code?: string | null; number?: number | null; title?: string | null }) {
  return `${doc.code ?? `#${doc.number ?? ''}`} ${doc.title ?? ''}`.trim();
}
