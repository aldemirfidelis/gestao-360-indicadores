import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { buildTransport, resolveSmtpConfig, smtpFrom } from '../../common/smtp';
import { NotificationsService } from '../notifications/notifications.service';
import { GeminiService } from '../ai/gemini.service';
import { AuthPayload } from '../auth/auth.types';
import { RecruitCareersService } from './recruit-careers.service';
import { evaluateScreening, fallbackTriage, weightedAverage } from './recruit-triage.logic';

const MODULE = 'recruitment';
const QUESTION_TYPES = ['TEXT', 'YES_NO', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'NUMBER'];
const RECOMMENDATIONS = ['STRONG_YES', 'YES', 'NEUTRAL', 'NO', 'STRONG_NO'];
const INTERVIEW_STATUSES = ['SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'DONE', 'NO_SHOW', 'CANCELLED'];
const ASSESSMENT_STATUSES = ['ASSIGNED', 'SUBMITTED', 'REVIEWED', 'CANCELLED'];
const PROMPT_VERSION = 'recruit-triage-v1-2026-07-15';

@Injectable()
export class RecruitEvaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly notifications: NotificationsService,
    private readonly gemini: GeminiService,
    private readonly careers: RecruitCareersService,
  ) {}

  // ------------------------------ public screening ------------------------------

  async publicQuestions(vacancySlug: string, host?: string, empresa?: string) {
    const company = await this.careers.resolveCompany(host, empresa);
    const posting = await this.prisma.recruitJobPosting.findFirst({
      where: { companyId: company.id, slug: vacancySlug, deletedAt: null },
      select: { id: true, status: true, visibility: true, closesAt: true },
    });
    if (!posting || posting.status !== 'PUBLISHED' || !['PUBLIC', 'BOTH'].includes(posting.visibility)) {
      throw new NotFoundException('Vaga não encontrada ou encerrada.');
    }
    const questions = await this.prisma.recruitScreeningQuestion.findMany({
      where: { companyId: company.id, postingId: posting.id, active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, order: true, type: true, question: true, required: true, options: true },
    });
    return { questions };
  }

  // ------------------------------ vaga: perguntas e scorecard ------------------------------

  async listScreeningQuestions(me: AuthPayload, postingId: string) {
    await this.postingOrFail(me.companyId, postingId);
    return this.prisma.recruitScreeningQuestion.findMany({
      where: { companyId: me.companyId, postingId, active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async saveScreeningQuestion(me: AuthPayload, postingId: string, body: any = {}) {
    await this.postingOrFail(me.companyId, postingId);
    const data = this.questionData(me.companyId, postingId, body);
    let saved;
    if (body?.id) {
      const existing = await this.prisma.recruitScreeningQuestion.findFirst({ where: { id: String(body.id), companyId: me.companyId, postingId } });
      if (!existing) throw new NotFoundException('Pergunta nao encontrada.');
      saved = await this.prisma.recruitScreeningQuestion.update({ where: { id: existing.id }, data });
    } else {
      saved = await this.prisma.recruitScreeningQuestion.create({ data });
    }
    await this.audit.record(me, { module: MODULE, entity: 'RecruitScreeningQuestion', entityId: saved.id, action: body?.id ? 'UPDATE' : 'CREATE', message: `Pergunta de triagem salva para a vaga` });
    return saved;
  }

  async deleteScreeningQuestion(me: AuthPayload, id: string) {
    const q = await this.prisma.recruitScreeningQuestion.findFirst({ where: { id, companyId: me.companyId } });
    if (!q) throw new NotFoundException('Pergunta não encontrada.');
    await this.prisma.recruitScreeningQuestion.update({ where: { id }, data: { active: false } });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitScreeningQuestion', entityId: id, action: 'DELETE', message: 'Pergunta de triagem desativada' });
    return { ok: true };
  }

  async listScorecard(me: AuthPayload, postingId: string) {
    await this.postingOrFail(me.companyId, postingId);
    return this.prisma.recruitScorecardCriterion.findMany({
      where: { companyId: me.companyId, postingId, active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async saveCriterion(me: AuthPayload, postingId: string, body: any = {}) {
    await this.postingOrFail(me.companyId, postingId);
    const data = this.criterionData(me.companyId, postingId, body);
    let saved;
    if (body?.id) {
      const existing = await this.prisma.recruitScorecardCriterion.findFirst({ where: { id: String(body.id), companyId: me.companyId, postingId } });
      if (!existing) throw new NotFoundException('Criterio nao encontrado.');
      saved = await this.prisma.recruitScorecardCriterion.update({ where: { id: existing.id }, data });
    } else {
      saved = await this.prisma.recruitScorecardCriterion.create({ data });
    }
    await this.audit.record(me, { module: MODULE, entity: 'RecruitScorecardCriterion', entityId: saved.id, action: body?.id ? 'UPDATE' : 'CREATE', message: `Critério de scorecard salvo para a vaga` });
    return saved;
  }

  async deleteCriterion(me: AuthPayload, id: string) {
    const c = await this.prisma.recruitScorecardCriterion.findFirst({ where: { id, companyId: me.companyId } });
    if (!c) throw new NotFoundException('Critério não encontrado.');
    await this.prisma.recruitScorecardCriterion.update({ where: { id }, data: { active: false } });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitScorecardCriterion', entityId: id, action: 'DELETE', message: 'Critério de scorecard desativado' });
    return { ok: true };
  }

  // ------------------------------ candidatura: avaliacoes ------------------------------

  async listEvaluations(me: AuthPayload, applicationId: string) {
    const app = await this.applicationOrFail(me.companyId, applicationId);
    const ownSubmitted = await this.prisma.recruitEvaluation.findFirst({
      where: { applicationId, evaluatorId: me.sub, status: 'SUBMITTED' },
      select: { id: true },
    });
    const hiddenSubmitted = ownSubmitted ? 0 : await this.prisma.recruitEvaluation.count({
      where: { companyId: me.companyId, applicationId, status: 'SUBMITTED', evaluatorId: { not: me.sub } },
    });
    const evaluations = await this.prisma.recruitEvaluation.findMany({
      where: { companyId: me.companyId, applicationId, ...(ownSubmitted ? { status: 'SUBMITTED' } : { evaluatorId: me.sub }) },
      orderBy: { createdAt: 'desc' },
      include: { ratings: { include: { criterion: true } } },
    });
    const aggregate = this.aggregateEvaluations(evaluations);
    return { locked: !ownSubmitted && hiddenSubmitted > 0, applicationId: app.id, aggregate, evaluations };
  }

  async submitEvaluation(me: AuthPayload, applicationId: string, body: any = {}) {
    const app = await this.applicationOrFail(me.companyId, applicationId);
    const criteria = await this.prisma.recruitScorecardCriterion.findMany({
      where: { companyId: me.companyId, postingId: app.postingId, active: true },
      orderBy: { order: 'asc' },
    });
    if (!criteria.length) throw new BadRequestException('Defina o scorecard da vaga antes de avaliar.');
    const ratings = Array.isArray(body?.ratings) ? body.ratings : [];
    const byCriterion = new Map(criteria.map((c) => [c.id, c]));
    const cleanRatings: Array<{ criterion: (typeof criteria)[number]; score: number; comment: string | null; evidence: string | null }> = ratings.map((r: any) => {
      const criterion = byCriterion.get(String(r?.criterionId));
      if (!criterion) throw new BadRequestException('Critério inválido para esta vaga.');
      const score = Math.round(Number(r?.score));
      if (!Number.isFinite(score) || score < criterion.scaleMin || score > criterion.scaleMax) {
        throw new BadRequestException(`Nota inválida para "${criterion.name}".`);
      }
      return { criterion, score, comment: text(r?.comment), evidence: text(r?.evidence) };
    });
    const missing = criteria.filter((c) => c.required && !cleanRatings.some((r) => r.criterion.id === c.id));
    if (missing.length) throw new BadRequestException(`Avalie os critérios obrigatórios: ${missing.map((m) => m.name).join(', ')}.`);
    const recommendation = body?.recommendation ? String(body.recommendation) : null;
    if (recommendation && !RECOMMENDATIONS.includes(recommendation)) throw new BadRequestException('Recomendação inválida.');

    const evaluation = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.recruitEvaluation.upsert({
        where: { applicationId_evaluatorId: { applicationId, evaluatorId: me.sub } },
        create: {
          companyId: me.companyId,
          applicationId,
          evaluatorId: me.sub,
          status: 'SUBMITTED',
          recommendation,
          summary: text(body?.summary),
          blindUntilSubmitted: body?.blindUntilSubmitted !== false,
          submittedAt: new Date(),
        },
        update: {
          status: 'SUBMITTED',
          recommendation,
          summary: text(body?.summary),
          blindUntilSubmitted: body?.blindUntilSubmitted !== false,
          submittedAt: new Date(),
        },
      });
      await tx.recruitEvaluationRating.deleteMany({ where: { evaluationId: saved.id } });
      await tx.recruitEvaluationRating.createMany({
        data: cleanRatings.map((r) => ({
          evaluationId: saved.id,
          criterionId: r.criterion.id,
          score: r.score,
          comment: r.comment,
          evidence: r.evidence,
        })),
      });
      await tx.recruitApplicationEvent.create({ data: { companyId: me.companyId, applicationId, type: 'EVALUATION_SUBMITTED', actorType: 'USER', actorId: me.sub } });
      return saved;
    });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitEvaluation', entityId: evaluation.id, action: 'SUBMIT', message: 'Avaliação de candidato enviada' });
    return this.listEvaluations(me, applicationId);
  }

  // ------------------------------ entrevistas e testes ------------------------------

  async listInterviews(me: AuthPayload, applicationId: string) {
    await this.applicationOrFail(me.companyId, applicationId);
    return this.prisma.recruitInterview.findMany({
      where: { companyId: me.companyId, applicationId },
      orderBy: { startsAt: 'asc' },
      include: { participants: true },
    });
  }

  async scheduleInterview(me: AuthPayload, applicationId: string, body: any = {}) {
    const app = await this.applicationOrFail(me.companyId, applicationId, true);
    const startsAt = parseDate(body?.startsAt, 'Data/hora inicial inválida.');
    const endsAt = body?.endsAt ? parseDate(body.endsAt, 'Data/hora final inválida.') : null;
    if (endsAt && endsAt <= startsAt) throw new BadRequestException('Fim deve ser posterior ao início.');
    const participants = await this.resolveParticipants(me.companyId, body?.participants);
    const interview = await this.prisma.recruitInterview.create({
      data: {
        companyId: me.companyId,
        applicationId,
        type: text(body?.type) ?? 'RH',
        startsAt,
        endsAt,
        location: text(body?.location),
        meetingUrl: text(body?.meetingUrl),
        instructions: text(body?.instructions),
        createdById: me.sub,
        organizerId: text(body?.organizerId) ?? me.sub,
        candidateName: app.candidate.name,
        candidateEmail: app.candidate.email,
        participants: { create: participants.map((p) => ({ userId: p.id, role: p.role, required: p.required })) },
      },
      include: { participants: true },
    });
    await this.prisma.recruitApplicationEvent.create({ data: { companyId: me.companyId, applicationId, type: 'INTERVIEW_SCHEDULED', note: interview.type, actorType: 'USER', actorId: me.sub } });
    await this.notifyInterviewParticipants(me.companyId, interview.id, app.posting.title, participants, startsAt);
    if (body?.notifyCandidate !== false) await this.emailCandidateInterview(app.candidate.email, app.candidate.name, app.posting.title, interview).catch(() => undefined);
    await this.audit.record(me, { module: MODULE, entity: 'RecruitInterview', entityId: interview.id, action: 'SCHEDULE', message: `Entrevista agendada para ${app.candidate.name}` });
    return interview;
  }

  async updateInterviewStatus(me: AuthPayload, id: string, status: string) {
    if (!INTERVIEW_STATUSES.includes(status)) throw new BadRequestException('Status inválido.');
    const interview = await this.prisma.recruitInterview.findFirst({ where: { id, companyId: me.companyId } });
    if (!interview) throw new NotFoundException('Entrevista não encontrada.');
    const saved = await this.prisma.recruitInterview.update({ where: { id }, data: { status } });
    await this.prisma.recruitApplicationEvent.create({ data: { companyId: me.companyId, applicationId: interview.applicationId, type: 'INTERVIEW_STATUS', note: status, actorType: 'USER', actorId: me.sub } });
    return saved;
  }

  async listAssessments(me: AuthPayload, applicationId: string) {
    await this.applicationOrFail(me.companyId, applicationId);
    return this.prisma.recruitAssessment.findMany({ where: { companyId: me.companyId, applicationId }, orderBy: { createdAt: 'desc' } });
  }

  async saveAssessment(me: AuthPayload, applicationId: string, body: any = {}) {
    await this.applicationOrFail(me.companyId, applicationId);
    const status = body?.status ? String(body.status) : undefined;
    if (status && !ASSESSMENT_STATUSES.includes(status)) throw new BadRequestException('Status de teste inválido.');
    const data = {
      companyId: me.companyId,
      applicationId,
      kind: text(body?.kind) ?? 'TECHNICAL_TEST',
      title: requiredText(body?.title, 'Título do teste é obrigatório.'),
      instructions: text(body?.instructions),
      dueAt: body?.dueAt ? parseDate(body.dueAt, 'Prazo inválido.') : null,
      status: status ?? 'ASSIGNED',
      score: body?.score == null || body.score === '' ? null : Math.round(Number(body.score)),
      resultNotes: text(body?.resultNotes),
      createdById: me.sub,
      reviewedById: status === 'REVIEWED' ? me.sub : null,
    };
    let saved;
    if (body?.id) {
      const existing = await this.prisma.recruitAssessment.findFirst({ where: { id: String(body.id), companyId: me.companyId, applicationId } });
      if (!existing) throw new NotFoundException('Teste nao encontrado.');
      saved = await this.prisma.recruitAssessment.update({ where: { id: existing.id }, data });
    } else {
      saved = await this.prisma.recruitAssessment.create({ data });
    }
    await this.prisma.recruitApplicationEvent.create({ data: { companyId: me.companyId, applicationId, type: 'ASSESSMENT', note: saved.title, actorType: 'USER', actorId: me.sub } });
    return saved;
  }

  // ------------------------------ AI explicavel ------------------------------

  async getAiSettings(me: AuthPayload) {
    return this.prisma.recruitAiSetting.upsert({
      where: { companyId: me.companyId },
      create: { companyId: me.companyId, enabled: false },
      update: {},
    });
  }

  async updateAiSettings(me: AuthPayload, body: any = {}) {
    const saved = await this.prisma.recruitAiSetting.upsert({
      where: { companyId: me.companyId },
      create: {
        companyId: me.companyId,
        enabled: Boolean(body?.enabled),
        sensitiveFiltering: body?.sensitiveFiltering !== false,
        modelPreference: text(body?.modelPreference),
        updatedById: me.sub,
      },
      update: {
        enabled: Boolean(body?.enabled),
        sensitiveFiltering: body?.sensitiveFiltering !== false,
        modelPreference: text(body?.modelPreference),
        updatedById: me.sub,
      },
    });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitAiSetting', entityId: saved.id, action: 'UPDATE', message: `IA de recrutamento ${saved.enabled ? 'ativada' : 'desativada'}` });
    return saved;
  }

  async runAiTriage(me: AuthPayload, applicationId: string) {
    const setting = await this.getAiSettings(me);
    if (!setting.enabled) throw new ConflictException('IA de recrutamento está desativada para esta empresa.');
    const app = await this.applicationOrFail(me.companyId, applicationId, true);
    const [criteria, questions, answers] = await Promise.all([
      this.prisma.recruitScorecardCriterion.findMany({ where: { companyId: me.companyId, postingId: app.postingId, active: true }, orderBy: { order: 'asc' } }),
      this.prisma.recruitScreeningQuestion.findMany({ where: { companyId: me.companyId, postingId: app.postingId, active: true }, orderBy: { order: 'asc' } }),
      this.prisma.recruitScreeningAnswer.findMany({ where: { companyId: me.companyId, applicationId } }),
    ]);
    const screening = evaluateScreening(questions, answers.map((a) => ({ questionId: a.questionId, answer: a.answer })));
    const candidateText = [
      app.candidate.headline,
      app.candidate.city,
      app.coverLetter,
      answers.map((a) => JSON.stringify(a.answer)).join(' '),
    ].filter(Boolean).join('\n');
    const fallback = fallbackTriage({
      vacancyTitle: app.posting.title,
      requirements: app.posting.publicRequirements ?? app.posting.publicDescription,
      candidateText,
      criteria: criteria.map((c) => ({ name: c.name, description: c.description })),
      screening,
    });
    const ai = await this.generateAiTriage(app, criteria, questions, answers, screening).catch(() => null);
    const result = ai ?? fallback;
    const analysis = await this.prisma.recruitAiAnalysis.create({
      data: {
        companyId: me.companyId,
        applicationId,
        provider: ai ? this.gemini.provider : 'rules',
        model: ai ? this.gemini.modelName : null,
        promptVersion: PROMPT_VERSION,
        criteria: json(result.criteria),
        evidence: json(result.evidence),
        missingRequirements: json(result.missingRequirements),
        risks: json(result.risks),
        summary: result.summary,
        confidence: result.confidence,
        humanReviewRequired: true,
        createdById: me.sub,
      },
    });
    await this.prisma.recruitApplicationEvent.create({ data: { companyId: me.companyId, applicationId, type: 'AI_TRIAGE', note: analysis.summary.slice(0, 240), actorType: 'USER', actorId: me.sub } });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitAiAnalysis', entityId: analysis.id, action: 'CREATE', message: 'Triagem assistida por IA gerada; revisão humana obrigatória' });
    return analysis;
  }

  // ------------------------------ helpers ------------------------------

  private questionData(companyId: string, postingId: string, body: any) {
    const type = String(body?.type ?? 'TEXT').toUpperCase();
    if (!QUESTION_TYPES.includes(type)) throw new BadRequestException('Tipo de pergunta inválido.');
    return {
      companyId,
      postingId,
      order: Math.max(0, Math.round(Number(body?.order ?? 0))),
      type,
      question: requiredText(body?.question, 'Pergunta é obrigatória.'),
      required: Boolean(body?.required),
      knockout: Boolean(body?.knockout),
      desiredAnswer: json(body?.desiredAnswer),
      options: json(Array.isArray(body?.options) ? body.options : body?.options ?? undefined),
      weight: Math.max(0, Math.round(Number(body?.weight ?? 0))),
      active: body?.active !== false,
    };
  }

  private criterionData(companyId: string, postingId: string, body: any) {
    const scaleMin = Math.round(Number(body?.scaleMin ?? 1));
    const scaleMax = Math.round(Number(body?.scaleMax ?? 5));
    if (!Number.isFinite(scaleMin) || !Number.isFinite(scaleMax) || scaleMax <= scaleMin) throw new BadRequestException('Escala inválida.');
    return {
      companyId,
      postingId,
      order: Math.max(0, Math.round(Number(body?.order ?? 0))),
      name: requiredText(body?.name, 'Nome do critério é obrigatório.'),
      description: text(body?.description),
      category: text(body?.category),
      weight: Math.max(1, Math.round(Number(body?.weight ?? 1))),
      scaleMin,
      scaleMax,
      required: body?.required !== false,
      active: body?.active !== false,
    };
  }

  private aggregateEvaluations(evaluations: Array<{ ratings: Array<{ score: number; criterion?: { weight: number } | null }> }>) {
    const all = evaluations.flatMap((e) => e.ratings.map((r) => ({ score: r.score, weight: r.criterion?.weight ?? 1 })));
    return { count: evaluations.length, score: weightedAverage(all) };
  }

  private async postingOrFail(companyId: string, postingId: string) {
    const posting = await this.prisma.recruitJobPosting.findFirst({ where: { id: postingId, companyId, deletedAt: null } });
    if (!posting) throw new NotFoundException('Vaga não encontrada.');
    return posting;
  }

  private async applicationOrFail(companyId: string, id: string, includeCandidate = false) {
    const app = await this.prisma.recruitApplication.findFirst({
      where: { id, companyId },
      include: includeCandidate
        ? { candidate: true, posting: { select: { id: true, title: true, publicDescription: true, publicRequirements: true } } }
        : undefined,
    });
    if (!app) throw new NotFoundException('Candidatura não encontrada.');
    return app as typeof app & { candidate: { name: string; email: string; headline: string | null; city: string | null }; posting: { id: string; title: string; publicDescription: string | null; publicRequirements: string | null } };
  }

  private async resolveParticipants(companyId: string, raw: unknown) {
    const input = Array.isArray(raw) ? raw : [];
    const ids = [...new Set(input.map((p: any) => String(p?.userId ?? '').trim()).filter(Boolean))];
    if (!ids.length) return [];
    const users = await this.prisma.user.findMany({ where: { companyId, id: { in: ids }, active: true, deletedAt: null }, select: { id: true } });
    const found = new Set(users.map((u) => u.id));
    return input
      .filter((p: any) => found.has(String(p?.userId)))
      .map((p: any) => ({ id: String(p.userId), role: text(p?.role) ?? 'INTERVIEWER', required: p?.required !== false }));
  }

  private async notifyInterviewParticipants(companyId: string, interviewId: string, title: string, participants: Array<{ id: string }>, startsAt: Date) {
    await Promise.all(participants.map((p) => this.notifications.create(
      companyId,
      p.id,
      NotificationKind.MEETING_UPCOMING,
      `Entrevista agendada: ${title}`,
      `Início em ${startsAt.toLocaleString('pt-BR')}`,
      `/recrutamento/vagas?interview=${interviewId}`,
    ).catch(() => undefined)));
  }

  private async emailCandidateInterview(email: string, name: string, title: string, interview: { startsAt: Date; endsAt: Date | null; location: string | null; meetingUrl: string | null; instructions: string | null }) {
    const cfg = await resolveSmtpConfig(this.prisma);
    if (!cfg?.host) return;
    const when = interview.startsAt.toLocaleString('pt-BR');
    await buildTransport(cfg).sendMail({
      from: smtpFrom(cfg),
      to: email,
      subject: `Entrevista agendada: ${title}`,
      text: `Olá, ${name}.\n\nSua entrevista para "${title}" foi agendada para ${when}.\n${interview.meetingUrl ? `Link: ${interview.meetingUrl}\n` : ''}${interview.location ? `Local: ${interview.location}\n` : ''}${interview.instructions ? `Instruções: ${interview.instructions}\n` : ''}\nCaso precise reagendar, responda este e-mail.`,
    });
  }

  private async generateAiTriage(app: any, criteria: Array<{ name: string; description: string | null }>, questions: any[], answers: any[], screening: any) {
    if (!this.gemini.isEnabled) return null;
    return this.gemini.generateJson<{
      summary: string;
      criteria: unknown[];
      evidence: unknown[];
      missingRequirements: unknown[];
      risks: unknown[];
      confidence: number;
    }>(`
Voce e um assistente de recrutamento. Analise somente requisitos objetivos da vaga e evidencias textuais fornecidas.
Nao use ou infira idade, raca, genero, religiao, saude, gravidez, orientacao sexual, foto ou qualquer atributo sensivel.
Nao aprove nem rejeite o candidato. A decisao humana e obrigatoria.

Vaga: ${app.posting.title}
Descricao/requisitos: ${(app.posting.publicRequirements ?? app.posting.publicDescription ?? '').slice(0, 3000)}
Scorecard: ${JSON.stringify(criteria.map((c) => ({ name: c.name, description: c.description }))).slice(0, 3000)}
Perguntas: ${JSON.stringify(questions.map((q) => ({ id: q.id, question: q.question, desiredAnswer: q.desiredAnswer }))).slice(0, 3000)}
Respostas: ${JSON.stringify(answers.map((a) => ({ questionId: a.questionId, answer: a.answer }))).slice(0, 3000)}
Texto do candidato: ${[app.candidate.headline, app.coverLetter].filter(Boolean).join('\n').slice(0, 3000)}
Resultado deterministico: ${JSON.stringify(screening)}

Retorne JSON com: summary, criteria (array), evidence (array), missingRequirements (array), risks (array), confidence (0 a 1).
`, { temperature: 0.2, maxOutputTokens: 1400 });
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
