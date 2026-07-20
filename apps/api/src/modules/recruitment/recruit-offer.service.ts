import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import { CandidateContext } from './candidate.guard';
import { safeAsoInclude } from './recruit-occupational-health.service';
import { RecruitCommunicationService, resolveCompanyDisplayName } from './recruit-communication.service';
import {
  DEFAULT_PRE_ADMISSION_DOCUMENTS,
  canCandidateDecideOffer,
  canSendOffer,
  evaluateSalaryBand,
  preAdmissionIsReady,
} from './recruit-offer.logic';

const MODULE = 'recruitment';

@Injectable()
export class RecruitOfferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly communication: RecruitCommunicationService,
  ) {}

  // ------------------------------ ofertas internas ------------------------------

  async listOffers(me: AuthPayload, applicationId: string) {
    await this.applicationOrFail(me.companyId, applicationId);
    return this.prisma.recruitOffer.findMany({
      where: { companyId: me.companyId, applicationId },
      orderBy: { createdAt: 'desc' },
      include: { preAdmission: true },
    });
  }

  async saveOffer(me: AuthPayload, applicationId: string, body: any = {}) {
    const app = await this.applicationOrFail(me.companyId, applicationId, true);
    if (app.status !== 'ACTIVE') throw new ConflictException('Somente candidaturas ativas podem receber proposta.');
    const salaryAmountCents = moneyToCents(body, 'salaryAmount');
    const band = await this.salaryBandFor(app);
    const bandResult = evaluateSalaryBand({ salaryAmountCents, salaryMinCents: band.salaryMinCents, salaryMaxCents: band.salaryMaxCents });
    const justification = text(body?.justification);
    if (bandResult.approvalRequired && !justification) {
      throw new BadRequestException(`${bandResult.reason ?? 'Proposta fora da faixa.'} Informe justificativa para reaprovação.`);
    }
    const data: Prisma.RecruitOfferUncheckedCreateInput & Prisma.RecruitOfferUncheckedUpdateInput = {
      companyId: me.companyId,
      applicationId,
      status: bandResult.approvalRequired ? 'PENDING_APPROVAL' : 'DRAFT',
      salaryAmountCents,
      salaryPeriod: text(body?.salaryPeriod) ?? 'MONTHLY',
      currency: text(body?.currency) ?? 'BRL',
      salaryMinCents: band.salaryMinCents,
      salaryMaxCents: band.salaryMaxCents,
      withinSalaryBand: bandResult.within,
      approvalRequired: bandResult.approvalRequired,
      approvedById: null,
      approvedAt: null,
      startDate: body?.startDate ? parseDate(body.startDate, 'Data de inicio invalida.') : null,
      expiresAt: body?.expiresAt ? parseDate(body.expiresAt, 'Validade invalida.') : null,
      workMode: text(body?.workMode) ?? app.posting.workMode,
      contractType: text(body?.contractType) ?? app.posting.contractType,
      location: text(body?.location) ?? app.posting.location ?? app.posting.city,
      benefits: json(body?.benefits),
      clauses: json(body?.clauses),
      justification,
      createdById: me.sub,
    };
    let saved;
    if (body?.id) {
      const existing = await this.prisma.recruitOffer.findFirst({ where: { id: String(body.id), companyId: me.companyId, applicationId } });
      if (!existing) throw new NotFoundException('Proposta nao encontrada.');
      if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(existing.status)) throw new ConflictException('Esta proposta nao pode mais ser editada.');
      saved = await this.prisma.recruitOffer.update({ where: { id: existing.id }, data });
    } else {
      const blocked = await this.prisma.recruitOffer.findFirst({ where: { companyId: me.companyId, applicationId, status: { in: ['SENT', 'ACCEPTED'] } } });
      if (blocked) throw new ConflictException('Ja existe uma proposta enviada ou aceita para esta candidatura.');
      const revision = await this.prisma.recruitOffer.count({ where: { companyId: me.companyId, applicationId } });
      saved = await this.prisma.recruitOffer.create({ data: { ...data, revision: revision + 1 } });
    }
    await this.prisma.recruitApplicationEvent.create({
      data: { companyId: me.companyId, applicationId, type: 'OFFER_PREPARED', note: bandResult.reason, actorType: 'USER', actorId: me.sub },
    });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitOffer', entityId: saved.id, action: body?.id ? 'UPDATE' : 'CREATE', message: `Proposta ${saved.revision} preparada`, after: { status: saved.status, salaryAmountCents, approvalRequired: saved.approvalRequired } });
    return saved;
  }

  async approveOffer(me: AuthPayload, id: string, body: any = {}) {
    const offer = await this.offerOrFail(me.companyId, id);
    if (!['PENDING_APPROVAL', 'DRAFT', 'APPROVED'].includes(offer.status)) throw new ConflictException('Esta proposta nao pode ser aprovada.');
    const saved = await this.prisma.recruitOffer.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: me.sub, approvedAt: new Date(), justification: text(body?.comment) ?? offer.justification },
    });
    await this.prisma.recruitApplicationEvent.create({ data: { companyId: me.companyId, applicationId: offer.applicationId, type: 'OFFER_APPROVED', note: text(body?.comment), actorType: 'USER', actorId: me.sub } });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitOffer', entityId: id, action: 'APPROVE', message: 'Proposta aprovada para envio' });
    return saved;
  }

  async sendOffer(me: AuthPayload, id: string) {
    const offer = await this.offerOrFail(me.companyId, id, true);
    if (!canSendOffer(offer.status, offer.approvalRequired)) {
      throw new BadRequestException('Proposta fora da faixa precisa de aprovacao antes do envio.');
    }
    const expiresAt = offer.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const offerStageId = offer.application.posting.pipelineTemplateId
      ? await this.findStageByType(me.companyId, offer.application.posting.pipelineTemplateId, 'OFFER')
      : null;
    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.recruitOffer.update({ where: { id }, data: { status: 'SENT', sentById: me.sub, sentAt: new Date(), expiresAt } });
      await tx.recruitApplicationEvent.create({ data: { companyId: me.companyId, applicationId: offer.applicationId, type: 'OFFER_SENT', note: `Validade: ${expiresAt.toISOString().slice(0, 10)}`, actorType: 'USER', actorId: me.sub } });
      if (offerStageId) await tx.recruitApplication.update({ where: { id: offer.applicationId }, data: { currentStageId: offerStageId } });
      return updated;
    });
    await this.emailCandidateOffer(me.companyId, offer.application.candidate.email, offer.application.candidate.name, offer.application.posting.title, saved);
    await this.audit.record(me, { module: MODULE, entity: 'RecruitOffer', entityId: id, action: 'SEND', message: 'Proposta enviada ao candidato' });
    return saved;
  }

  async cancelOffer(me: AuthPayload, id: string, body: any = {}) {
    const offer = await this.offerOrFail(me.companyId, id);
    if (['ACCEPTED', 'DECLINED', 'CANCELLED'].includes(offer.status)) throw new ConflictException('Esta proposta nao pode ser cancelada.');
    const saved = await this.prisma.recruitOffer.update({ where: { id }, data: { status: 'CANCELLED', declineReason: text(body?.reason) } });
    await this.prisma.recruitApplicationEvent.create({ data: { companyId: me.companyId, applicationId: offer.applicationId, type: 'OFFER_CANCELLED', note: text(body?.reason), actorType: 'USER', actorId: me.sub } });
    return saved;
  }

  // ------------------------------ pre-admissao interna ------------------------------

  async listPreAdmissions(me: AuthPayload, applicationId: string) {
    await this.applicationOrFail(me.companyId, applicationId);
    return this.prisma.recruitPreAdmission.findMany({
      where: { companyId: me.companyId, applicationId },
      orderBy: { createdAt: 'desc' },
      include: { offer: true, documents: { include: { candidateDocument: true }, orderBy: { createdAt: 'asc' } }, occupationalExamRequests: { include: safeAsoInclude(), orderBy: { createdAt: 'desc' } } },
    });
  }

  async startPreAdmission(me: AuthPayload, applicationId: string, body: any = {}) {
    await this.applicationOrFail(me.companyId, applicationId);
    const offerId = text(body?.offerId);
    const offer = offerId ? await this.offerOrFail(me.companyId, offerId) : null;
    if (offer && offer.applicationId !== applicationId) throw new BadRequestException('Proposta nao pertence a esta candidatura.');
    const created = await this.prisma.$transaction((tx) => this.ensurePreAdmission(tx, {
      companyId: me.companyId,
      applicationId,
      offerId: offer?.id ?? null,
      admissionTargetDate: body?.admissionTargetDate ? parseDate(body.admissionTargetDate, 'Data alvo invalida.') : offer?.startDate ?? null,
      createdById: me.sub,
    }));
    await this.audit.record(me, { module: MODULE, entity: 'RecruitPreAdmission', entityId: created.id, action: 'CREATE', message: 'Pre-admissao iniciada' });
    return created;
  }

  async addDocumentRequirement(me: AuthPayload, preAdmissionId: string, body: any = {}) {
    const pre = await this.preAdmissionOrFail(me.companyId, preAdmissionId);
    const saved = await this.prisma.recruitPreAdmissionDocument.create({
      data: {
        companyId: me.companyId,
        preAdmissionId,
        kind: text(body?.kind) ?? 'OTHER',
        title: requiredText(body?.title, 'Titulo do documento e obrigatorio.'),
        instructions: text(body?.instructions),
        required: body?.required !== false,
        dueAt: body?.dueAt ? parseDate(body.dueAt, 'Prazo invalido.') : null,
      },
    });
    await this.prisma.recruitApplicationEvent.create({ data: { companyId: me.companyId, applicationId: pre.applicationId, type: 'PREHIRE_DOC_REQUIRED', note: saved.title, actorType: 'USER', actorId: me.sub } });
    return saved;
  }

  async reviewDocument(me: AuthPayload, id: string, body: any = {}) {
    const status = String(body?.status ?? '').toUpperCase();
    if (!['APPROVED', 'REJECTED', 'WAIVED'].includes(status)) throw new BadRequestException('Decisao documental invalida.');
    const doc = await this.prisma.recruitPreAdmissionDocument.findFirst({ where: { id, companyId: me.companyId }, include: { preAdmission: { include: { documents: true } } } });
    if (!doc) throw new NotFoundException('Documento de pre-admissao nao encontrado.');
    const saved = await this.prisma.recruitPreAdmissionDocument.update({
      where: { id },
      data: { status, reviewedById: me.sub, reviewedAt: new Date(), reviewNote: text(body?.note) },
    });
    const docs = doc.preAdmission.documents.map((item) => item.id === id ? { required: item.required, status } : item);
    if (preAdmissionIsReady(docs)) {
      await this.prisma.recruitPreAdmission.update({ where: { id: doc.preAdmissionId }, data: { status: 'READY_FOR_ASO' } });
    }
    await this.prisma.recruitApplicationEvent.create({ data: { companyId: me.companyId, applicationId: doc.preAdmission.applicationId, type: 'PREHIRE_DOC_REVIEWED', note: `${doc.title}: ${status}`, actorType: 'USER', actorId: me.sub } });
    return saved;
  }

  // ------------------------------ portal do candidato ------------------------------

  async listMyOffers(candidate: CandidateContext) {
    // Candidato global: o escopo é a candidatura (application.candidateId), não a empresa.
    return this.prisma.recruitOffer.findMany({
      where: { status: { in: ['SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED'] }, application: { candidateId: candidate.id } },
      orderBy: { createdAt: 'desc' },
      include: { application: { include: { posting: { select: { title: true, slug: true, city: true, workMode: true } } } }, preAdmission: true },
    });
  }

  async decideMyOffer(candidate: CandidateContext, id: string, body: any = {}) {
    const decision = String(body?.decision ?? '').toUpperCase();
    if (!['ACCEPT', 'DECLINE'].includes(decision)) throw new BadRequestException('Decisao invalida.');
    const offer = await this.prisma.recruitOffer.findFirst({
      where: { id, application: { candidateId: candidate.id } },
      include: { application: { include: { posting: true } } },
    });
    if (!offer) throw new NotFoundException('Proposta nao encontrada.');
    if (!canCandidateDecideOffer(offer.status, offer.expiresAt)) {
      if (offer.status === 'SENT' && offer.expiresAt && offer.expiresAt < new Date()) {
        await this.prisma.recruitOffer.update({ where: { id }, data: { status: 'EXPIRED' } });
      }
      throw new ConflictException('Esta proposta nao esta disponivel para decisao.');
    }
    if (decision === 'DECLINE') {
      const saved = await this.prisma.recruitOffer.update({ where: { id }, data: { status: 'DECLINED', declinedAt: new Date(), declineReason: text(body?.reason) } });
      await this.prisma.recruitApplicationEvent.create({ data: { companyId: offer.companyId, applicationId: offer.applicationId, type: 'OFFER_DECLINED', note: text(body?.reason), actorType: 'CANDIDATE', actorId: candidate.id } });
      return saved;
    }
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.recruitOffer.update({ where: { id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      await tx.recruitApplicationEvent.create({ data: { companyId: offer.companyId, applicationId: offer.applicationId, type: 'OFFER_ACCEPTED', actorType: 'CANDIDATE', actorId: candidate.id } });
      await this.ensurePreAdmission(tx, {
        companyId: offer.companyId,
        applicationId: offer.applicationId,
        offerId: offer.id,
        admissionTargetDate: offer.startDate,
        createdById: null,
      });
      return saved;
    });
  }

  async listMyPreAdmissions(candidate: CandidateContext) {
    return this.prisma.recruitPreAdmission.findMany({
      where: { application: { candidateId: candidate.id }, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
      include: {
        offer: true,
        application: { include: { posting: { select: { title: true, slug: true } } } },
        documents: { include: { candidateDocument: true }, orderBy: { createdAt: 'asc' } },
        occupationalExamRequests: { include: safeAsoInclude(), orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async submitMyPreAdmissionDocument(candidate: CandidateContext, id: string, body: any = {}) {
    const req = await this.prisma.recruitPreAdmissionDocument.findFirst({
      where: { id, preAdmission: { application: { candidateId: candidate.id } } },
      include: { preAdmission: true },
    });
    if (!req) throw new NotFoundException('Documento solicitado nao encontrado.');
    if (!['PENDING', 'REJECTED', 'SUBMITTED'].includes(req.status)) throw new ConflictException('Este documento nao pode ser reenviado.');
    const docId = requiredText(body?.candidateDocumentId, 'Documento enviado e obrigatorio.');
    const doc = await this.prisma.recruitCandidateDocument.findFirst({ where: { id: docId, candidateId: candidate.id, deletedAt: null } });
    if (!doc) throw new NotFoundException('Documento do candidato nao encontrado.');
    const saved = await this.prisma.recruitPreAdmissionDocument.update({
      where: { id },
      data: { candidateDocumentId: doc.id, status: 'SUBMITTED', submittedAt: new Date(), reviewedById: null, reviewedAt: null, reviewNote: null },
    });
    await this.prisma.recruitPreAdmission.update({ where: { id: req.preAdmissionId }, data: { status: 'IN_DOCUMENTS' } });
    await this.prisma.recruitApplicationEvent.create({ data: { companyId: req.companyId, applicationId: req.preAdmission.applicationId, type: 'PREHIRE_DOC_SUBMITTED', note: req.title, actorType: 'CANDIDATE', actorId: candidate.id } });
    return saved;
  }

  // ------------------------------ helpers ------------------------------

  private async ensurePreAdmission(tx: Prisma.TransactionClient, input: { companyId: string; applicationId: string; offerId: string | null; admissionTargetDate: Date | null; createdById: string | null }) {
    const existing = await tx.recruitPreAdmission.findFirst({
      where: { companyId: input.companyId, applicationId: input.applicationId, status: { not: 'CANCELLED' } },
      include: { documents: true },
    });
    if (existing) {
      if (input.offerId && !existing.offerId) {
        return tx.recruitPreAdmission.update({ where: { id: existing.id }, data: { offerId: input.offerId, admissionTargetDate: input.admissionTargetDate ?? existing.admissionTargetDate }, include: { documents: true } });
      }
      return existing;
    }
    const created = await tx.recruitPreAdmission.create({
      data: {
        companyId: input.companyId,
        applicationId: input.applicationId,
        offerId: input.offerId,
        status: 'IN_DOCUMENTS',
        admissionTargetDate: input.admissionTargetDate,
        createdById: input.createdById,
        documents: { create: DEFAULT_PRE_ADMISSION_DOCUMENTS.map((doc) => ({ companyId: input.companyId, ...doc })) },
      },
      include: { documents: true },
    });
    await tx.recruitApplicationEvent.create({ data: { companyId: input.companyId, applicationId: input.applicationId, type: 'PREHIRE_STARTED', actorType: input.createdById ? 'USER' : 'CANDIDATE', actorId: input.createdById } });
    return created;
  }

  private async salaryBandFor(app: { companyId: string; posting: { requisitionId: string } }) {
    const req = await this.prisma.recruitRequisition.findFirst({
      where: { id: app.posting.requisitionId, companyId: app.companyId, deletedAt: null },
      select: { salaryMin: true, salaryMax: true },
    });
    return {
      salaryMinCents: req?.salaryMin == null ? null : decimalToCents(req.salaryMin),
      salaryMaxCents: req?.salaryMax == null ? null : decimalToCents(req.salaryMax),
    };
  }

  private async applicationOrFail(companyId: string, id: string, includeCandidate = false) {
    const app = await this.prisma.recruitApplication.findFirst({
      where: { id, companyId },
      include: includeCandidate
        ? { candidate: true, posting: { select: { id: true, title: true, requisitionId: true, pipelineTemplateId: true, workMode: true, contractType: true, location: true, city: true } } }
        : undefined,
    });
    if (!app) throw new NotFoundException('Candidatura nao encontrada.');
    return app as typeof app & { candidate: { name: string; email: string }; posting: { id: string; title: string; requisitionId: string; pipelineTemplateId: string | null; workMode: string | null; contractType: string | null; location: string | null; city: string | null } };
  }

  private async offerOrFail(companyId: string, id: string, includeApplication = false) {
    const offer = await this.prisma.recruitOffer.findFirst({
      where: { id, companyId },
      include: includeApplication
        ? { application: { include: { candidate: true, posting: { select: { title: true, slug: true, pipelineTemplateId: true } } } } }
        : undefined,
    });
    if (!offer) throw new NotFoundException('Proposta nao encontrada.');
    return offer as typeof offer & { application: { candidate: { name: string; email: string }; posting: { title: string; slug: string; pipelineTemplateId: string | null } } };
  }

  private async preAdmissionOrFail(companyId: string, id: string) {
    const pre = await this.prisma.recruitPreAdmission.findFirst({ where: { id, companyId } });
    if (!pre) throw new NotFoundException('Pre-admissao nao encontrada.');
    return pre;
  }

  private async findStageByType(companyId: string, templateId: string, type: string) {
    const stage = await this.prisma.recruitPipelineStage.findFirst({ where: { companyId, templateId, type }, orderBy: { order: 'asc' }, select: { id: true } });
    return stage?.id ?? null;
  }

  private async emailCandidateOffer(companyId: string, email: string, name: string, title: string, offer: { salaryAmountCents: number; currency: string; expiresAt: Date | null }) {
    const companyName = await resolveCompanyDisplayName(this.prisma, companyId);
    void this.communication.sendEvent(companyId, 'OFFER_SENT', email, {
      candidato: name,
      vaga: title,
      empresa: companyName,
      validade: offer.expiresAt ? offer.expiresAt.toLocaleDateString('pt-BR') : 'sem data definida',
    });
  }
}

function text(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}

function requiredText(value: unknown, message: string): string {
  const t = text(value);
  if (!t) throw new BadRequestException(message);
  return t;
}

function parseDate(value: unknown, message: string): Date {
  const date = new Date(String(value ?? ''));
  if (!Number.isFinite(date.getTime())) throw new BadRequestException(message);
  return date;
}

function json(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

function moneyToCents(body: any, base: string): number {
  if (`${base}Cents` in body) {
    const cents = Math.round(Number(body[`${base}Cents`]));
    if (!Number.isFinite(cents) || cents <= 0) throw new BadRequestException('Valor da proposta invalido.');
    return cents;
  }
  const raw = String(body?.[base] ?? '').replace(/\./g, '').replace(',', '.');
  const cents = Math.round(Number(raw) * 100);
  if (!Number.isFinite(cents) || cents <= 0) throw new BadRequestException('Valor da proposta invalido.');
  return cents;
}

function decimalToCents(value: Prisma.Decimal): number {
  return Math.round(Number(value.toString()) * 100);
}
