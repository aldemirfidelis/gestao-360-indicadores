import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TrainingAttemptStatus, TrainingQuestionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { TrainingMatrixService } from './training-matrix.service';

const MODULE = 'Treinamento';

/** Embaralha sem alterar o array de origem. */
function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

/**
 * Avaliação de aprendizagem aplicada pelo portal.
 *
 * A prova pertence ao treinamento e a nota mínima continua vindo dele — não
 * existem dois lugares definindo aprovação. A correção é automática para
 * objetivas; discursivas ficam aguardando correção manual.
 *
 * O gabarito NUNCA é enviado ao colaborador enquanto a tentativa está aberta.
 */
@Injectable()
export class TrainingAssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matrix: TrainingMatrixService,
    private readonly audit: AuditWriterService,
  ) {}

  // ==========================================================================
  // Banco de questões (administração)
  // ==========================================================================

  async getAssessment(companyId: string, trainingId: string) {
    const assessment = await this.prisma.trainingAssessment.findFirst({
      where: { trainingId, companyId, deletedAt: null },
      include: {
        questions: {
          where: { active: true },
          orderBy: { position: 'asc' },
          include: { options: { orderBy: { position: 'asc' } } },
        },
        _count: { select: { attempts: true } },
      },
    });
    if (!assessment) return null;
    return {
      ...assessment,
      totalPoints: assessment.questions.reduce((sum, question) => sum + question.points, 0),
    };
  }

  async upsertAssessment(me: AuthPayload, trainingId: string, body: any) {
    const training = await this.prisma.training.findFirst({
      where: { id: trainingId, companyId: me.companyId, deletedAt: null },
      select: { id: true, name: true, requiresAssessment: true },
    });
    if (!training) throw new NotFoundException('Treinamento não encontrado.');

    const title = String(body?.title ?? `Avaliação — ${training.name}`).trim();
    const data = {
      title,
      instructions: body?.instructions?.trim() || null,
      timeLimitMinutes: this.toInt(body?.timeLimitMinutes),
      questionCount: this.toInt(body?.questionCount),
      randomizeQuestions: body?.randomizeQuestions !== false,
      randomizeOptions: body?.randomizeOptions !== false,
      showResult: body?.showResult !== false,
      active: body?.active !== false,
    };

    const saved = await this.prisma.trainingAssessment.upsert({
      where: { trainingId },
      create: { companyId: me.companyId, trainingId, createdById: me.sub, ...data },
      update: data,
      select: { id: true },
    });

    // Ter prova implica exigir avaliação no treinamento.
    if (!training.requiresAssessment) {
      await this.prisma.training.update({ where: { id: trainingId }, data: { requiresAssessment: true } });
    }
    await this.audit.record(me, { action: 'UPSERT', module: MODULE, entity: 'TrainingAssessment', entityId: saved.id, message: title });
    return this.getAssessment(me.companyId, trainingId);
  }

  async addQuestion(me: AuthPayload, assessmentId: string, body: any) {
    const assessment = await this.prisma.trainingAssessment.findFirst({
      where: { id: assessmentId, companyId: me.companyId, deletedAt: null },
      select: { id: true, trainingId: true },
    });
    if (!assessment) throw new NotFoundException('Avaliação não encontrada.');

    const statement = String(body?.statement ?? '').trim();
    if (!statement) throw new BadRequestException('Informe o enunciado da questão.');
    const type = Object.values(TrainingQuestionType).includes(body?.type) ? (body.type as TrainingQuestionType) : TrainingQuestionType.SINGLE;
    const options: Array<{ label: string; correct: boolean }> = Array.isArray(body?.options)
      ? body.options
          .map((option: any) => ({ label: String(option?.label ?? '').trim(), correct: Boolean(option?.correct) }))
          .filter((option: any) => option.label)
      : [];

    // Objetiva sem alternativa correta nunca poderia ser respondida certo.
    if (type !== TrainingQuestionType.TEXT) {
      if (options.length < 2) throw new BadRequestException('Informe ao menos duas alternativas.');
      if (!options.some((option) => option.correct)) throw new BadRequestException('Marque ao menos uma alternativa correta.');
      if (type === TrainingQuestionType.SINGLE && options.filter((option) => option.correct).length > 1) {
        throw new BadRequestException('Questão de resposta única não pode ter mais de uma alternativa correta.');
      }
    }

    const last = await this.prisma.trainingAssessmentQuestion.findFirst({
      where: { assessmentId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const created = await this.prisma.trainingAssessmentQuestion.create({
      data: {
        companyId: me.companyId,
        assessmentId,
        statement,
        type,
        points: this.toInt(body?.points) ?? 1,
        position: (last?.position ?? 0) + 1,
        explanation: body?.explanation?.trim() || null,
        options:
          type === TrainingQuestionType.TEXT
            ? undefined
            : {
                create: options.map((option, index) => ({
                  companyId: me.companyId,
                  label: option.label,
                  correct: option.correct,
                  position: index,
                })),
              },
      },
      select: { id: true },
    });
    await this.audit.record(me, { action: 'CREATE', module: MODULE, entity: 'TrainingAssessmentQuestion', entityId: created.id, message: statement.slice(0, 80) });
    return this.getAssessment(me.companyId, assessment.trainingId);
  }

  async removeQuestion(me: AuthPayload, questionId: string) {
    const question = await this.prisma.trainingAssessmentQuestion.findFirst({
      where: { id: questionId, companyId: me.companyId },
      include: { assessment: { select: { trainingId: true } }, _count: { select: { answers: true } } },
    });
    if (!question) throw new NotFoundException('Questão não encontrada.');

    // Questão já respondida é inativada: apagar destruiria o histórico da prova.
    if (question._count.answers > 0) {
      await this.prisma.trainingAssessmentQuestion.update({ where: { id: questionId }, data: { active: false } });
      await this.audit.record(me, { action: 'DEACTIVATE', module: MODULE, entity: 'TrainingAssessmentQuestion', entityId: questionId });
      return this.getAssessment(me.companyId, question.assessment.trainingId);
    }
    await this.prisma.trainingAssessmentQuestion.delete({ where: { id: questionId } });
    await this.audit.record(me, { action: 'DELETE', module: MODULE, entity: 'TrainingAssessmentQuestion', entityId: questionId });
    return this.getAssessment(me.companyId, question.assessment.trainingId);
  }

  // ==========================================================================
  // Aplicação da prova (colaborador)
  // ==========================================================================

  private async myEmployeeId(me: AuthPayload) {
    const profile = await this.prisma.personnelEmployeeProfile.findFirst({
      where: { companyId: me.companyId, userId: me.sub },
      select: { employeeId: true },
    });
    if (!profile) throw new ForbiddenException('Seu login não está vinculado a um cadastro de colaborador.');
    return profile.employeeId;
  }

  /**
   * Inicia (ou retoma) a tentativa. Sorteia as questões e devolve a prova SEM
   * o gabarito.
   */
  async startAttempt(me: AuthPayload, assignmentId: string) {
    const employeeId = await this.myEmployeeId(me);
    const assignment = await this.prisma.trainingAssignment.findFirst({
      where: { id: assignmentId, companyId: me.companyId, employeeId, deletedAt: null },
      include: {
        training: {
          select: { id: true, name: true, maxAttempts: true, minimumScore: true, requiresAssessment: true },
        },
      },
    });
    if (!assignment) throw new NotFoundException('Treinamento não encontrado para você.');
    if (!assignment.training.requiresAssessment) throw new BadRequestException('Este treinamento não possui avaliação.');

    const assessment = await this.prisma.trainingAssessment.findFirst({
      where: { trainingId: assignment.trainingId, companyId: me.companyId, active: true, deletedAt: null },
      include: { questions: { where: { active: true }, include: { options: true } } },
    });
    if (!assessment || assessment.questions.length === 0) {
      throw new BadRequestException('A avaliação deste treinamento ainda não possui questões cadastradas.');
    }

    // Retoma tentativa aberta em vez de criar outra.
    const open = await this.prisma.trainingAssessmentAttempt.findFirst({
      where: { assessmentId: assessment.id, employeeId, status: TrainingAttemptStatus.IN_PROGRESS },
    });
    if (open) {
      if (open.expiresAt && open.expiresAt.getTime() < Date.now()) {
        await this.expireAttempt(open.id);
      } else {
        return this.buildExamPayload(assessment, open);
      }
    }

    const used = await this.prisma.trainingAssessmentAttempt.count({
      where: { assessmentId: assessment.id, employeeId, status: { in: [TrainingAttemptStatus.SUBMITTED, TrainingAttemptStatus.GRADED, TrainingAttemptStatus.EXPIRED] } },
    });
    if (assignment.training.maxAttempts && used >= assignment.training.maxAttempts) {
      throw new ConflictException(`Você atingiu o limite de ${assignment.training.maxAttempts} tentativa(s). Procure o responsável pelo treinamento.`);
    }

    const pool = assessment.randomizeQuestions ? shuffled(assessment.questions) : [...assessment.questions].sort((a, b) => a.position - b.position);
    const selected = assessment.questionCount ? pool.slice(0, assessment.questionCount) : pool;
    const expiresAt = assessment.timeLimitMinutes
      ? new Date(Date.now() + assessment.timeLimitMinutes * 60_000)
      : null;

    const attempt = await this.prisma.trainingAssessmentAttempt.create({
      data: {
        companyId: me.companyId,
        assessmentId: assessment.id,
        assignmentId,
        employeeId,
        attemptNumber: used + 1,
        expiresAt,
        questionOrder: selected.map((question) => question.id) as unknown as Prisma.InputJsonValue,
        maxScore: selected.reduce((sum, question) => sum + question.points, 0),
      },
    });

    await this.prisma.trainingAssignment.update({
      where: { id: assignmentId },
      data: { status: 'IN_PROGRESS' },
    });

    return this.buildExamPayload(assessment, attempt);
  }

  /** Monta a prova na ordem sorteada, sem revelar quais alternativas acertam. */
  private buildExamPayload(assessment: any, attempt: any) {
    const order: string[] = Array.isArray(attempt.questionOrder) ? attempt.questionOrder : [];
    const byId = new Map(assessment.questions.map((question: any) => [question.id, question]));
    const questions = order
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((question: any) => ({
        id: question.id,
        statement: question.statement,
        type: question.type,
        points: question.points,
        options: (assessment.randomizeOptions ? shuffled(question.options) : [...question.options].sort((a: any, b: any) => a.position - b.position)).map(
          (option: any) => ({ id: option.id, label: option.label }),
        ),
      }));

    return {
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      title: assessment.title,
      instructions: assessment.instructions,
      expiresAt: attempt.expiresAt,
      timeLimitMinutes: assessment.timeLimitMinutes,
      totalPoints: attempt.maxScore,
      questions,
    };
  }

  /**
   * Envia e corrige. Objetivas são corrigidas na hora; se houver discursiva, a
   * tentativa fica aguardando correção manual e a matriz não é fechada ainda.
   */
  async submitAttempt(me: AuthPayload, attemptId: string, body: any) {
    const employeeId = await this.myEmployeeId(me);
    const attempt = await this.prisma.trainingAssessmentAttempt.findFirst({
      where: { id: attemptId, companyId: me.companyId, employeeId },
      include: {
        assessment: {
          include: { questions: { include: { options: true } }, training: { select: { id: true, minimumScore: true } } },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Tentativa não encontrada.');
    if (attempt.status !== TrainingAttemptStatus.IN_PROGRESS) throw new ConflictException('Esta tentativa já foi enviada.');

    const expired = Boolean(attempt.expiresAt && attempt.expiresAt.getTime() < Date.now());
    const answers: Array<{ questionId: string; optionIds?: string[]; text?: string }> = Array.isArray(body?.answers) ? body.answers : [];
    const order: string[] = Array.isArray(attempt.questionOrder) ? (attempt.questionOrder as string[]) : [];
    const byId = new Map(attempt.assessment.questions.map((question) => [question.id, question]));

    let earned = 0;
    let hasManual = false;
    const rows: Prisma.TrainingAssessmentAnswerCreateManyInput[] = [];

    for (const questionId of order) {
      const question = byId.get(questionId);
      if (!question) continue;
      const answer = answers.find((item) => item.questionId === questionId);
      const chosen = (answer?.optionIds ?? []).filter(Boolean);

      if (question.type === TrainingQuestionType.TEXT) {
        hasManual = true;
        rows.push({
          companyId: me.companyId,
          attemptId,
          questionId,
          text: answer?.text?.trim() || null,
          correct: null,
          points: 0,
        });
        continue;
      }

      const correctIds = question.options.filter((option) => option.correct).map((option) => option.id);
      // Acerto exige o conjunto exato: nem faltar nem sobrar alternativa.
      const isCorrect =
        chosen.length === correctIds.length && chosen.every((id) => correctIds.includes(id));
      if (isCorrect) earned += question.points;
      rows.push({
        companyId: me.companyId,
        attemptId,
        questionId,
        optionIds: chosen as unknown as Prisma.InputJsonValue,
        correct: isCorrect,
        points: isCorrect ? question.points : 0,
      });
    }

    await this.prisma.trainingAssessmentAnswer.createMany({ data: rows, skipDuplicates: true });

    const maxScore = attempt.maxScore ?? attempt.assessment.questions.reduce((sum, question) => sum + question.points, 0);
    const score = maxScore > 0 ? (earned / maxScore) * 100 : 0;
    const minimum = attempt.assessment.training.minimumScore ? Number(attempt.assessment.training.minimumScore) : null;
    const passed = hasManual ? null : minimum === null ? true : score >= minimum;
    const now = new Date();

    await this.prisma.trainingAssessmentAttempt.update({
      where: { id: attemptId },
      data: {
        status: hasManual ? TrainingAttemptStatus.SUBMITTED : TrainingAttemptStatus.GRADED,
        submittedAt: now,
        durationSeconds: Math.max(0, Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000)),
        score: new Prisma.Decimal(score.toFixed(2)),
        maxScore,
        passed,
      },
    });

    if (hasManual) {
      // Aguarda correção manual: a matriz não fecha agora.
      if (attempt.assignmentId) {
        await this.prisma.trainingAssignment.update({
          where: { id: attempt.assignmentId },
          data: { status: 'AWAITING_ASSESSMENT' },
        });
      }
      return { status: 'AWAITING_GRADING' as const, score: null, passed: null, showResult: attempt.assessment.showResult };
    }

    if (attempt.assignmentId) {
      await this.matrix.completeAssignment(attempt.assignmentId, {
        completedAt: now,
        score,
        approved: Boolean(passed),
        actorUserId: me.sub,
      });
    }

    return {
      status: 'GRADED' as const,
      score: attempt.assessment.showResult ? Number(score.toFixed(2)) : null,
      passed,
      minimumScore: minimum,
      expired,
      showResult: attempt.assessment.showResult,
    };
  }

  /** Tentativas aguardando correção manual (questões discursivas). */
  async pendingGrading(me: AuthPayload) {
    const rows = await this.prisma.trainingAssessmentAttempt.findMany({
      where: { companyId: me.companyId, status: TrainingAttemptStatus.SUBMITTED },
      orderBy: { submittedAt: 'asc' },
      include: {
        employee: { select: { id: true, name: true, registrationId: true } },
        assessment: { select: { title: true, training: { select: { id: true, code: true, name: true } } } },
        answers: { include: { question: { select: { statement: true, type: true, points: true } } } },
      },
      take: 200,
    });
    return rows.map((row) => ({
      id: row.id,
      employee: row.employee,
      training: row.assessment.training,
      submittedAt: row.submittedAt,
      objectiveScore: row.score ? Number(row.score) : null,
      answers: row.answers
        .filter((answer) => answer.question.type === 'TEXT')
        .map((answer) => ({ id: answer.id, statement: answer.question.statement, points: answer.question.points, text: answer.text })),
    }));
  }

  /** Correção manual das discursivas e fechamento da tentativa. */
  async gradeAttempt(me: AuthPayload, attemptId: string, body: any) {
    const attempt = await this.prisma.trainingAssessmentAttempt.findFirst({
      where: { id: attemptId, companyId: me.companyId, status: TrainingAttemptStatus.SUBMITTED },
      include: { assessment: { select: { training: { select: { minimumScore: true } } } }, answers: true },
    });
    if (!attempt) throw new NotFoundException('Tentativa não encontrada ou já corrigida.');

    const grades: Array<{ answerId: string; points: number }> = Array.isArray(body?.grades) ? body.grades : [];
    for (const grade of grades) {
      await this.prisma.trainingAssessmentAnswer.updateMany({
        where: { id: grade.answerId, attemptId },
        data: {
          points: Math.max(0, this.toInt(grade.points) ?? 0),
          correct: (this.toInt(grade.points) ?? 0) > 0,
          gradedById: me.sub,
          gradedAt: new Date(),
        },
      });
    }

    const answers = await this.prisma.trainingAssessmentAnswer.findMany({ where: { attemptId }, select: { points: true } });
    const earned = answers.reduce((sum, answer) => sum + answer.points, 0);
    const maxScore = attempt.maxScore ?? 0;
    const score = maxScore > 0 ? (earned / maxScore) * 100 : 0;
    const minimum = attempt.assessment.training.minimumScore ? Number(attempt.assessment.training.minimumScore) : null;
    const passed = minimum === null ? true : score >= minimum;

    await this.prisma.trainingAssessmentAttempt.update({
      where: { id: attemptId },
      data: { status: TrainingAttemptStatus.GRADED, score: new Prisma.Decimal(score.toFixed(2)), passed, gradedById: me.sub },
    });

    if (attempt.assignmentId) {
      await this.matrix.completeAssignment(attempt.assignmentId, {
        completedAt: attempt.submittedAt ?? new Date(),
        score,
        approved: passed,
        actorUserId: me.sub,
      });
    }
    await this.audit.record(me, {
      action: 'GRADE',
      module: MODULE,
      entity: 'TrainingAssessmentAttempt',
      entityId: attemptId,
      after: { score: Number(score.toFixed(2)), passed },
    });
    return { graded: true, score: Number(score.toFixed(2)), passed };
  }

  private async expireAttempt(attemptId: string) {
    await this.prisma.trainingAssessmentAttempt.update({
      where: { id: attemptId },
      data: { status: TrainingAttemptStatus.EXPIRED, submittedAt: new Date() },
    });
  }

  private toInt(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
}
