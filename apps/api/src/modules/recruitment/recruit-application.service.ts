import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { DocumentStorageService } from '../documents/document-storage.service';
import { AuthPayload } from '../auth/auth.types';
import { CandidateContext } from './candidate.guard';
import { RecruitCareersService } from './recruit-careers.service';
import { RecruitCommunicationService, resolveCompanyDisplayName } from './recruit-communication.service';
import { isPubliclyVisible } from './recruit-posting.logic';
import { canRecruiterAct, canWithdraw, CONSENT_VERSION, normalizeEmail, safeFileName, validateUpload } from './recruit-candidate.logic';
import { evaluateScreening } from './recruit-triage.logic';
import { safeAsoInclude } from './recruit-occupational-health.service';

const MODULE = 'recruitment';

/**
 * Candidatura (F3): o candidato se candidata a uma vaga (com consentimento LGPD),
 * anexa currículo e acompanha o andamento; o recrutador vê os candidatos por vaga,
 * movimenta no pipeline e rejeita. Currículos: binário no storage, metadados no banco.
 */
@Injectable()
export class RecruitApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly storage: DocumentStorageService,
    private readonly careers: RecruitCareersService,
    private readonly communication: RecruitCommunicationService,
  ) {}

  // =============================== CANDIDATO ===============================

  /**
   * Candidata-se a uma vaga publicada. Exige consentimento explícito (LGPD).
   * A empresa vem da VAGA (resolvida por empresa/host), não do candidato — a conta
   * do candidato é global e pode se candidatar a vagas de qualquer empresa.
   */
  async apply(
    candidate: CandidateContext,
    vacancySlug: string,
    empresa: string | undefined,
    host: string | undefined,
    body: any = {},
    ctx: { ip?: string; userAgent?: string } = {},
  ) {
    if (body?.consent !== true) throw new BadRequestException('É necessário aceitar o tratamento de dados (LGPD) para se candidatar.');
    const company = await this.careers.resolveCompany(host, empresa);
    const companyId = company.id;
    const posting = await this.prisma.recruitJobPosting.findFirst({
      where: { companyId, slug: vacancySlug, deletedAt: null },
      include: { pipelineTemplate: { include: { stages: { orderBy: { order: 'asc' }, take: 1 } } } },
    });
    if (!posting || !isPubliclyVisible(posting)) throw new NotFoundException('Vaga não encontrada ou encerrada.');

    const dup = await this.prisma.recruitApplication.findFirst({ where: { postingId: posting.id, candidateId: candidate.id } });
    if (dup) throw new ConflictException('Você já se candidatou a esta vaga.');

    const screeningQuestions = await this.prisma.recruitScreeningQuestion.findMany({
      where: { companyId, postingId: posting.id, active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    const screeningAnswers = normalizeScreeningAnswers(body?.answers);
    const screening = evaluateScreening(screeningQuestions, screeningAnswers);
    if (screening.requiredMissing.length) {
      throw new BadRequestException('Responda todas as perguntas obrigatórias da vaga.');
    }

    // Indicação: candidato chegou por link ?ref=<userId> de um colaborador desta empresa.
    const referredByUserId = await this.resolveReferrer(companyId, text(body?.referredBy));

    const firstStageId = posting.pipelineTemplate?.stages[0]?.id ?? null;
    const application = await this.prisma.recruitApplication.create({
      data: {
        companyId,
        postingId: posting.id,
        candidateId: candidate.id,
        requisitionId: posting.requisitionId,
        source: referredByUserId ? 'INDICACAO' : 'CARREIRAS',
        referredByUserId,
        currentStageId: firstStageId,
        coverLetter: text(body?.coverLetter),
        answers: body?.answers && typeof body.answers === 'object' ? body.answers : undefined,
        score: screening.score,
        events: {
          create: [
            { companyId, type: 'CREATED', toStageId: firstStageId, actorType: 'CANDIDATE', actorId: candidate.id },
            ...(screening.knockoutFailed.length
              ? [{ companyId, type: 'SCREENING_FLAG', note: `Falha em ${screening.knockoutFailed.length} pergunta(s) eliminatória(s).`, actorType: 'SYSTEM', actorId: null }]
              : []),
          ],
        },
        screeningAnswers: {
          create: screeningAnswers
            .filter((a) => screeningQuestions.some((q) => q.id === a.questionId))
            .map((a) => ({
              companyId,
              questionId: a.questionId,
              answer: a.answer as Prisma.InputJsonValue,
              passed: screening.passedByQuestion[a.questionId],
            })),
        },
        consents: {
          create: {
            companyId,
            candidateId: candidate.id,
            purpose: 'RECRUITMENT',
            documentVersion: CONSENT_VERSION,
            granted: true,
            ip: ctx.ip ?? null,
            userAgent: ctx.userAgent ?? null,
          },
        },
      },
    });
    void this.communication.sendEvent(companyId, 'APPLICATION_RECEIVED', candidate.email, {
      candidato: candidate.name,
      vaga: posting.title,
      empresa: company.tradeName ?? company.name,
    });
    return { id: application.id, status: application.status };
  }

  // =============================== MOBILIDADE INTERNA ===============================

  /**
   * Colaborador interno (usuário logado, não candidato externo) se candidata a uma
   * vaga INTERNAL/BOTH. Reusa TODO o pipeline de recrutamento (kanban, triagem,
   * scorecard, entrevista, proposta, admissão) — o recrutador vê o candidato interno
   * exatamente como um externo, sem tela nova. A identidade do candidato é resolvida
   * por e-mail (RecruitCandidate é global): se o colaborador já tem conta (ex.: se
   * candidatou externamente antes de ser contratado), reusa; senão cria uma.
   */
  async applyInternal(me: AuthPayload, postingId: string, body: any = {}) {
    if (body?.consent !== true) throw new BadRequestException('É necessário aceitar o tratamento de dados (LGPD) para se candidatar.');
    const posting = await this.prisma.recruitJobPosting.findFirst({
      where: { id: postingId, companyId: me.companyId, deletedAt: null, status: 'PUBLISHED', visibility: { in: ['INTERNAL', 'BOTH'] } },
      include: { pipelineTemplate: { include: { stages: { orderBy: { order: 'asc' }, take: 1 } } } },
    });
    if (!posting) throw new NotFoundException('Vaga interna não encontrada ou encerrada.');

    const email = normalizeEmail(me.email);
    let candidate = await this.prisma.recruitCandidate.findFirst({ where: { emailNormalized: email, deletedAt: null } });
    if (!candidate) {
      candidate = await this.prisma.recruitCandidate.create({
        data: { email: me.email, emailNormalized: email, name: me.name, status: 'ACTIVE' },
      });
    }

    const dup = await this.prisma.recruitApplication.findFirst({ where: { postingId: posting.id, candidateId: candidate.id } });
    if (dup) throw new ConflictException('Você já se candidatou a esta vaga.');

    const firstStageId = posting.pipelineTemplate?.stages[0]?.id ?? null;
    const application = await this.prisma.recruitApplication.create({
      data: {
        companyId: me.companyId,
        postingId: posting.id,
        candidateId: candidate.id,
        requisitionId: posting.requisitionId,
        source: 'MOBILIDADE_INTERNA',
        currentStageId: firstStageId,
        coverLetter: text(body?.coverLetter),
        events: { create: { companyId: me.companyId, type: 'CREATED', toStageId: firstStageId, actorType: 'CANDIDATE', actorId: candidate.id, note: 'Candidatura interna' } },
        consents: {
          create: {
            companyId: me.companyId, candidateId: candidate.id, purpose: 'RECRUITMENT', documentVersion: CONSENT_VERSION, granted: true,
          },
        },
      },
    });
    const company = await this.prisma.company.findUnique({ where: { id: me.companyId }, select: { name: true, tradeName: true } });
    void this.communication.sendEvent(me.companyId, 'APPLICATION_RECEIVED', candidate.email, {
      candidato: candidate.name, vaga: posting.title, empresa: company?.tradeName ?? company?.name ?? 'nossa empresa',
    });
    return { id: application.id, status: application.status };
  }

  /** Candidaturas internas do próprio colaborador logado (por e-mail — mesma identidade global). */
  async listMyInternalApplications(me: AuthPayload) {
    const email = normalizeEmail(me.email);
    const candidate = await this.prisma.recruitCandidate.findFirst({ where: { emailNormalized: email, deletedAt: null } });
    if (!candidate) return [];
    const apps = await this.prisma.recruitApplication.findMany({
      where: { candidateId: candidate.id, companyId: me.companyId, source: 'MOBILIDADE_INTERNA' },
      orderBy: { appliedAt: 'desc' },
      include: { posting: { select: { title: true, slug: true } }, stage: { select: { name: true } } },
    });
    return apps.map((a) => ({ id: a.id, status: a.status, appliedAt: a.appliedAt, stage: a.stage?.name ?? null, posting: a.posting }));
  }

  /** Candidaturas do candidato autenticado. */
  async listMine(candidate: CandidateContext) {
    const apps = await this.prisma.recruitApplication.findMany({
      where: { candidateId: candidate.id },
      orderBy: { appliedAt: 'desc' },
      include: { posting: { select: { title: true, slug: true, city: true, workMode: true } }, stage: { select: { name: true } } },
    });
    return apps.map((a) => ({
      id: a.id, status: a.status, appliedAt: a.appliedAt, stage: a.stage?.name ?? null,
      posting: a.posting, rejectionReason: a.status === 'REJECTED' ? a.rejectionReason : null,
    }));
  }

  /** Desistência da candidatura pelo próprio candidato. */
  async withdraw(candidate: CandidateContext, id: string) {
    const app = await this.mineOrFail(candidate.id, id);
    if (!canWithdraw(app.status)) throw new ConflictException('Esta candidatura não pode mais ser cancelada.');
    await this.prisma.recruitApplication.update({ where: { id }, data: { status: 'WITHDRAWN', withdrawnAt: new Date() } });
    await this.prisma.recruitApplicationEvent.create({ data: { companyId: app.companyId, applicationId: id, type: 'WITHDRAWN', actorType: 'CANDIDATE', actorId: candidate.id } });
    return { ok: true };
  }

  // ------------------------------ documentos ------------------------------

  /** Upload de currículo/anexo (base64). Valida MIME/tamanho antes do storage. */
  async uploadDocument(candidate: CandidateContext, body: any = {}) {
    const check = validateUpload({ mimeType: body?.mimeType, sizeBytes: base64Size(body?.contentBase64) });
    if (!check.ok) throw new BadRequestException(check.error);
    // Documento tem a empresa da CANDIDATURA (se vinculado); currículo geral do perfil
    // não tem empresa (candidato é global no portal).
    let applicationId: string | null = null;
    let companyId: string | null = null;
    if (body?.applicationId) {
      const app = await this.mineOrFail(candidate.id, String(body.applicationId));
      applicationId = app.id;
      companyId = app.companyId;
    }
    const buffer = Buffer.from(String(body.contentBase64 ?? ''), 'base64');
    const fileName = safeFileName(body?.fileName ?? `curriculo.${check.ext}`);
    const stored = await this.storage.putBinary(companyId ?? 'portal-candidatos', `recrutamento/${candidate.id}`, fileName, buffer, String(body.mimeType));
    const kind = ['CV', 'COVER', 'CERTIFICATE', 'PORTFOLIO', 'OTHER'].includes(String(body?.kind)) ? String(body.kind) : 'CV';
    const doc = await this.prisma.recruitCandidateDocument.create({
      data: {
        companyId, candidateId: candidate.id, applicationId, kind,
        fileName: stored.fileName, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes, hashSha256: stored.hashSha256,
        storageProvider: stored.storageProvider, storageKey: stored.storageKey,
        scanStatus: 'SKIPPED', // sem antivírus configurado: marcado explicitamente (não "CLEAN")
      },
    });
    if (applicationId && companyId) {
      await this.prisma.recruitApplicationEvent.create({ data: { companyId, applicationId, type: 'DOC_ADDED', note: doc.fileName, actorType: 'CANDIDATE', actorId: candidate.id } });
    }
    return { id: doc.id, fileName: doc.fileName, kind: doc.kind, sizeBytes: doc.sizeBytes };
  }

  async listMyDocuments(candidate: CandidateContext) {
    const docs = await this.prisma.recruitCandidateDocument.findMany({
      where: { candidateId: candidate.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true, applicationId: true, createdAt: true },
    });
    return docs;
  }

  /** Conteúdo do documento para o próprio candidato (base64). */
  async readMyDocument(candidate: CandidateContext, docId: string) {
    const doc = await this.prisma.recruitCandidateDocument.findFirst({ where: { id: docId, candidateId: candidate.id, deletedAt: null } });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    return this.readStored(doc);
  }

  async deleteMyDocument(candidate: CandidateContext, docId: string) {
    const doc = await this.prisma.recruitCandidateDocument.findFirst({ where: { id: docId, candidateId: candidate.id, deletedAt: null } });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    await this.prisma.recruitCandidateDocument.update({ where: { id: docId }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  async listMyDataRequests(candidate: CandidateContext) {
    return this.prisma.recruitDataRequest.findMany({
      where: { candidateId: candidate.id },
      orderBy: { requestedAt: 'desc' },
      select: { id: true, type: true, status: true, details: true, requestedAt: true, resolvedAt: true },
    });
  }

  async createDataRequest(candidate: CandidateContext, body: any = {}) {
    const type = String(body?.type ?? '').toUpperCase();
    if (!['ACCESS', 'DELETION', 'RECTIFICATION', 'PORTABILITY'].includes(type)) {
      throw new BadRequestException('Tipo de solicitação inválido.');
    }
    // Conta global do candidato: a solicitação nasce sem empresa (o próprio candidato).
    return this.prisma.recruitDataRequest.create({
      data: {
        companyId: null,
        candidateId: candidate.id,
        type,
        details: text(body?.details),
      },
      select: { id: true, type: true, status: true, details: true, requestedAt: true },
    });
  }

  // =============================== RECRUTADOR ===============================

  /** Candidatos de uma vaga (visão interna do recrutador). */
  async listByPosting(me: AuthPayload, postingId: string) {
    await this.postingOrFail(me.companyId, postingId);
    const apps = await this.prisma.recruitApplication.findMany({
      where: { companyId: me.companyId, postingId },
      orderBy: [{ status: 'asc' }, { appliedAt: 'asc' }],
      include: {
        candidate: { select: { id: true, name: true, email: true, phone: true, city: true, headline: true } },
        stage: { select: { id: true, name: true, order: true } },
        _count: { select: { documents: true } },
      },
    });
    const referrerNameById = await this.referrerNames(apps.map((a) => a.referredByUserId));
    return apps.map((a) => ({ ...a, referrerName: a.referredByUserId ? referrerNameById.get(a.referredByUserId) ?? null : null }));
  }

  /** Detalhe de uma candidatura (recrutador): perfil, carta, timeline, documentos. */
  async getApplication(me: AuthPayload, id: string) {
    const app = await this.prisma.recruitApplication.findFirst({
      where: { id, companyId: me.companyId },
      include: {
        candidate: { select: { id: true, name: true, email: true, phone: true, city: true, headline: true, linkedinUrl: true, portfolioUrl: true, profileData: true, tags: true } },
        posting: { select: { id: true, title: true, slug: true, pipelineTemplateId: true, requisitionId: true } },
        stage: { select: { id: true, name: true, order: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 100 },
        screeningAnswers: { include: { question: true }, orderBy: { question: { order: 'asc' } } },
        evaluations: { orderBy: { createdAt: 'desc' }, include: { ratings: { include: { criterion: true } } } },
        interviews: { orderBy: { startsAt: 'asc' }, include: { participants: true } },
        assessments: { orderBy: { createdAt: 'desc' } },
        aiAnalyses: { orderBy: { createdAt: 'desc' }, take: 5 },
        offers: { orderBy: { createdAt: 'desc' }, include: { preAdmission: true } },
        preAdmissions: { orderBy: { createdAt: 'desc' }, include: { documents: { include: { candidateDocument: true }, orderBy: { createdAt: 'asc' } }, offer: true, occupationalExamRequests: { include: safeAsoInclude(), orderBy: { createdAt: 'desc' } } } },
        admission: { include: { probationReviews: { orderBy: { cycleDay: 'asc' } } } },
        documents: { where: { deletedAt: null }, select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true, scanStatus: true, createdAt: true } },
        consents: { orderBy: { grantedAt: 'desc' } },
      },
    });
    if (!app) throw new NotFoundException('Candidatura não encontrada.');
    const ownSubmitted = app.evaluations.some((evaluation) => evaluation.evaluatorId === me.sub && evaluation.status === 'SUBMITTED');
    const referrerName = app.referredByUserId ? (await this.referrerNames([app.referredByUserId])).get(app.referredByUserId) ?? null : null;

    // Salário de referência da vaga (vindo de Cargos e Salários → cargo+faixa, gravado
    // na requisição como salaryMin). Serve para pré-preencher a proposta do recrutador.
    let referenceSalaryCents: number | null = null;
    let referenceBand: string | null = null;
    if (app.posting?.requisitionId) {
      const req = await this.prisma.recruitRequisition.findFirst({
        where: { id: app.posting.requisitionId, companyId: me.companyId, deletedAt: null },
        select: { salaryMin: true, details: true },
      });
      if (req?.salaryMin != null) referenceSalaryCents = Math.round(Number(req.salaryMin) * 100);
      const details = (req?.details ?? null) as { band?: string } | null;
      referenceBand = details?.band ?? null;
    }

    return {
      ...app,
      referrerName,
      referenceSalaryCents,
      referenceBand,
      evaluations: ownSubmitted
        ? app.evaluations.filter((evaluation) => evaluation.status === 'SUBMITTED')
        : app.evaluations.filter((evaluation) => evaluation.evaluatorId === me.sub),
    };
  }

  /** Etapas do pipeline da vaga (para montar o board). */
  async postingStages(me: AuthPayload, postingId: string) {
    const posting = await this.postingOrFail(me.companyId, postingId);
    if (!posting.pipelineTemplateId) return [];
    return this.prisma.recruitPipelineStage.findMany({ where: { templateId: posting.pipelineTemplateId, companyId: me.companyId }, orderBy: { order: 'asc' } });
  }

  /** Move a candidatura para outra etapa do pipeline da vaga. */
  async moveStage(me: AuthPayload, id: string, toStageId: string) {
    const app = await this.getOwnedApp(me.companyId, id);
    if (!canRecruiterAct(app.status)) throw new ConflictException('Candidatura encerrada não pode ser movida.');
    const posting = await this.postingOrFail(me.companyId, app.postingId);
    if (!posting.pipelineTemplateId) throw new BadRequestException('Esta vaga não possui pipeline configurado.');
    const stage = await this.prisma.recruitPipelineStage.findFirst({ where: { id: toStageId, companyId: me.companyId, templateId: posting.pipelineTemplateId } });
    if (!stage) throw new BadRequestException('Etapa inválida para esta vaga.');
    const from = app.currentStageId;
    await this.prisma.recruitApplication.update({ where: { id }, data: { currentStageId: toStageId } });
    await this.prisma.recruitApplicationEvent.create({ data: { companyId: me.companyId, applicationId: id, type: 'STAGE_MOVED', fromStageId: from, toStageId, actorType: 'USER', actorId: me.sub } });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitApplication', entityId: id, action: 'STAGE_MOVED', message: `Candidatura movida para "${stage.name}"` });
    const companyName = await resolveCompanyDisplayName(this.prisma, me.companyId);
    void this.communication.sendEvent(me.companyId, 'STAGE_CHANGED', app.candidate.email, {
      candidato: app.candidate.name,
      vaga: posting.title,
      empresa: companyName,
      etapa: stage.name,
    });
    return { ok: true };
  }

  /** Rejeita a candidatura com motivo (registrado na timeline e auditoria). */
  async reject(me: AuthPayload, id: string, reason?: string) {
    const app = await this.getOwnedApp(me.companyId, id);
    if (!canRecruiterAct(app.status)) throw new ConflictException('Candidatura já encerrada.');
    await this.prisma.recruitApplication.update({ where: { id }, data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: text(reason) } });
    await this.prisma.recruitApplicationEvent.create({ data: { companyId: me.companyId, applicationId: id, type: 'REJECTED', note: text(reason), actorType: 'USER', actorId: me.sub } });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitApplication', entityId: id, action: 'REJECTED', message: `Candidatura rejeitada${reason ? `: ${reason}` : ''}` });
    const posting = await this.postingOrFail(me.companyId, app.postingId);
    const companyName = await resolveCompanyDisplayName(this.prisma, me.companyId);
    void this.communication.sendEvent(me.companyId, 'REJECTED', app.candidate.email, {
      candidato: app.candidate.name,
      vaga: posting.title,
      empresa: companyName,
      motivo: '',
    });
    return { ok: true };
  }

  /** Move várias candidaturas de uma vez (kanban: seleção múltipla). Reusa moveStage por item — mesma validação, mesmo e-mail ao candidato. */
  async bulkMoveStage(me: AuthPayload, ids: string[], toStageId: string) {
    return this.bulkRun(ids, (id) => this.moveStage(me, id, toStageId));
  }

  /** Rejeita várias candidaturas de uma vez (kanban: seleção múltipla). Reusa reject por item. */
  async bulkReject(me: AuthPayload, ids: string[], reason?: string) {
    return this.bulkRun(ids, (id) => this.reject(me, id, reason));
  }

  /** Roda uma ação item a item — uma falha (ex.: candidatura já encerrada) não impede as demais. */
  private async bulkRun(ids: string[], run: (id: string) => Promise<unknown>): Promise<{ ok: number; failed: Array<{ id: string; error: string }> }> {
    const unique = [...new Set(ids)].slice(0, 200);
    const failed: Array<{ id: string; error: string }> = [];
    let ok = 0;
    for (const id of unique) {
      try {
        await run(id);
        ok += 1;
      } catch (err) {
        failed.push({ id, error: (err as Error).message });
      }
    }
    return { ok, failed };
  }

  /** Nota interna do recrutador na timeline. */
  async addNote(me: AuthPayload, id: string, note: string) {
    await this.getOwnedApp(me.companyId, id);
    const n = text(note);
    if (!n) throw new BadRequestException('Nota vazia.');
    await this.prisma.recruitApplicationEvent.create({ data: { companyId: me.companyId, applicationId: id, type: 'NOTE', note: n, actorType: 'USER', actorId: me.sub } });
    return { ok: true };
  }

  /** Conteúdo de um documento para o recrutador (base64). */
  async readApplicationDocument(me: AuthPayload, docId: string) {
    const doc = await this.prisma.recruitCandidateDocument.findFirst({ where: { id: docId, companyId: me.companyId, deletedAt: null } });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    return this.readStored(doc);
  }

  // ------------------------------ helpers ------------------------------

  private async readStored(doc: { fileName: string; mimeType: string; storageKey: string }) {
    const buffer = await this.storage.readBinary(doc.storageKey);
    return { fileName: doc.fileName, mimeType: doc.mimeType, contentBase64: buffer.toString('base64') };
  }

  private async mineOrFail(candidateId: string, id: string) {
    const app = await this.prisma.recruitApplication.findFirst({ where: { id, candidateId } });
    if (!app) throw new NotFoundException('Candidatura não encontrada.');
    return app;
  }

  private async getOwnedApp(companyId: string, id: string) {
    const app = await this.prisma.recruitApplication.findFirst({
      where: { id, companyId },
      include: { candidate: { select: { name: true, email: true } } },
    });
    if (!app) throw new NotFoundException('Candidatura não encontrada.');
    return app;
  }

  private async postingOrFail(companyId: string, postingId: string) {
    const posting = await this.prisma.recruitJobPosting.findFirst({ where: { id: postingId, companyId, deletedAt: null } });
    if (!posting) throw new NotFoundException('Vaga não encontrada.');
    return posting;
  }

  /** Valida que o ?ref= do link de indicação é um usuário interno ATIVO desta empresa (nunca de outra). */
  private async resolveReferrer(companyId: string, userId: string | null): Promise<string | null> {
    if (!userId) return null;
    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId, active: true, deletedAt: null }, select: { id: true } });
    return user?.id ?? null;
  }

  /** Nome de exibição de indicadores (referredByUserId não tem relação Prisma formal — mesmo padrão de createdById/requesterId no schema). */
  private async referrerNames(userIds: Array<string | null>): Promise<Map<string, string>> {
    const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
    if (!ids.length) return new Map();
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    return new Map(users.map((u) => [u.id, u.name]));
  }
}

function text(v: unknown): string | null {
  const t = String(v ?? '').trim();
  return t || null;
}

/** Estima o tamanho em bytes de um conteúdo base64 sem materializar o buffer. */
function normalizeScreeningAnswers(raw: unknown): Array<{ questionId: string; answer: unknown }> {
  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => ({ questionId: String(item?.questionId ?? '').trim(), answer: item?.answer }))
      .filter((item) => item.questionId);
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .map(([questionId, answer]) => ({ questionId, answer }))
      .filter((item) => item.questionId);
  }
  return [];
}

function base64Size(b64: unknown): number {
  const s = String(b64 ?? '');
  if (!s) return 0;
  const padding = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  return Math.floor((s.length * 3) / 4) - padding;
}
