import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  TrainingAssignmentStatus,
  TrainingRequirementTarget,
  TrainingValidityKind,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Colaborador com os campos que decidem quais exigências o alcançam. */
export interface MatrixEmployee {
  id: string;
  jobId: string | null;
  orgNodeId: string | null;
  status: string;
}

export interface RecomputeResult {
  created: number;
  closed: number;
  refreshed: number;
}

/**
 * Motor da Matriz de Treinamento.
 *
 * Traduz as REGRAS (TrainingRequirement: por empresa, área, cargo ou pessoa)
 * nas CÉLULAS da matriz (TrainingAssignment: um por colaborador × treinamento),
 * e mantém as situações derivadas de data (válido → próximo do vencimento →
 * vencido) em dia.
 *
 * Duas garantias que o plano exige e que ficam concentradas aqui:
 *  - treinamento já válido e compatível NÃO vira pendência duplicada;
 *  - exigência que deixou de ser aplicável é ENCERRADA (NOT_APPLICABLE), nunca
 *    apagada — o histórico do colaborador é permanente.
 */
@Injectable()
export class TrainingMatrixService {
  private readonly logger = new Logger(TrainingMatrixService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================================================
  // Cálculo de datas
  // ==========================================================================

  /**
   * Vencimento a partir da conclusão. A regra da exigência vence a do
   * treinamento (uma norma pode exigir prazo menor que o padrão do curso).
   */
  computeValidUntil(
    completedAt: Date,
    training: { validityKind: TrainingValidityKind; validityValue: number | null },
    requirement?: { validityKind: TrainingValidityKind | null; validityValue: number | null } | null,
    documentValidUntil?: Date | null,
  ): Date | null {
    const kind = requirement?.validityKind ?? training.validityKind;
    const value = requirement?.validityKind ? requirement.validityValue : training.validityValue;

    if (kind === TrainingValidityKind.NONE) return null;
    if (kind === TrainingValidityKind.FROM_DOCUMENT) return documentValidUntil ?? null;
    if (!value || value <= 0) return null;

    const date = new Date(completedAt);
    if (kind === TrainingValidityKind.DAYS) date.setDate(date.getDate() + value);
    if (kind === TrainingValidityKind.MONTHS) date.setMonth(date.getMonth() + value);
    if (kind === TrainingValidityKind.YEARS) date.setFullYear(date.getFullYear() + value);
    return date;
  }

  /** Prazo para concluir, contado do evento que criou a exigência. */
  computeDueAt(from: Date, deadlineDays: number | null | undefined): Date | null {
    if (!deadlineDays || deadlineDays <= 0) return null;
    const date = new Date(from);
    date.setDate(date.getDate() + deadlineDays);
    return date;
  }

  /**
   * Situação derivada da validade. Só reclassifica quem já concluiu — pendência
   * não vira "vencida" por validade, e sim por prazo (dueAt).
   */
  statusFromValidity(validUntil: Date | null, dueSoonDays: number, now = new Date()): TrainingAssignmentStatus {
    if (!validUntil) return TrainingAssignmentStatus.VALID;
    if (validUntil.getTime() <= now.getTime()) return TrainingAssignmentStatus.EXPIRED;
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + Math.max(0, dueSoonDays));
    return validUntil.getTime() <= threshold.getTime()
      ? TrainingAssignmentStatus.DUE_SOON
      : TrainingAssignmentStatus.VALID;
  }

  /** Situações que representam "já resolvido" — não geram nova pendência. */
  static readonly SETTLED: TrainingAssignmentStatus[] = [
    TrainingAssignmentStatus.VALID,
    TrainingAssignmentStatus.DUE_SOON,
    TrainingAssignmentStatus.AWAITING_EFFECTIVENESS,
    TrainingAssignmentStatus.WAIVED,
  ];

  /** Situações abertas — aparecem em Pendências. */
  static readonly OPEN: TrainingAssignmentStatus[] = [
    TrainingAssignmentStatus.NOT_STARTED,
    TrainingAssignmentStatus.PENDING,
    TrainingAssignmentStatus.SCHEDULED,
    TrainingAssignmentStatus.CONFIRMED,
    TrainingAssignmentStatus.IN_PROGRESS,
    TrainingAssignmentStatus.AWAITING_ASSESSMENT,
    TrainingAssignmentStatus.AWAITING_VALIDATION,
    TrainingAssignmentStatus.EXPIRED,
    TrainingAssignmentStatus.FAILED,
    TrainingAssignmentStatus.ABSENT,
    TrainingAssignmentStatus.DUE_SOON,
  ];

  // ==========================================================================
  // Resolução das exigências que alcançam um colaborador
  // ==========================================================================

  /** Um nó da estrutura alcança também os descendentes. */
  private async orgNodeAncestry(companyId: string, orgNodeId: string | null): Promise<Set<string>> {
    const result = new Set<string>();
    if (!orgNodeId) return result;
    const nodes = await this.prisma.orgNode.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    const parentOf = new Map(nodes.map((node) => [node.id, node.parentId]));
    let current: string | null | undefined = orgNodeId;
    // Sobe até a raiz: o colaborador do setor herda a exigência da diretoria.
    while (current && !result.has(current)) {
      result.add(current);
      current = parentOf.get(current) ?? null;
    }
    return result;
  }

  /**
   * Exigências ativas que se aplicam ao colaborador, considerando cargo, área
   * (com herança), exigências da empresa inteira e atribuições nominais.
   */
  async requirementsFor(companyId: string, employee: MatrixEmployee) {
    const ancestry = await this.orgNodeAncestry(companyId, employee.orgNodeId);
    const targets: Prisma.TrainingRequirementWhereInput[] = [
      { target: TrainingRequirementTarget.ALL_COMPANY },
      { target: TrainingRequirementTarget.EMPLOYEE, targetId: employee.id },
    ];
    if (employee.jobId) targets.push({ target: TrainingRequirementTarget.JOB, targetId: employee.jobId });
    if (ancestry.size > 0) {
      targets.push({ target: TrainingRequirementTarget.ORG_NODE, targetId: { in: Array.from(ancestry) } });
    }

    return this.prisma.trainingRequirement.findMany({
      where: {
        companyId,
        active: true,
        deletedAt: null,
        training: { status: 'ACTIVE', deletedAt: null },
        OR: targets,
      },
      include: {
        training: {
          select: {
            id: true,
            validityKind: true,
            validityValue: true,
            dueSoonDays: true,
            deadlineDays: true,
            documentId: true,
            documentVersion: true,
          },
        },
      },
    });
  }

  // ==========================================================================
  // Recomputação
  // ==========================================================================

  /**
   * Recalcula a matriz de um colaborador.
   *
   * `reason` alimenta o histórico (admissão, movimentação, revisão de documento,
   * alteração da matriz) para que a origem de cada pendência seja rastreável.
   */
  async recomputeEmployee(
    companyId: string,
    employeeId: string,
    options: { reason: string; actorUserId?: string | null; deadlineFrom?: Date } = { reason: 'MATRIX_CHANGED' },
  ): Promise<RecomputeResult> {
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true, jobId: true, orgNodeId: true, status: true },
    });
    if (!employee) return { created: 0, closed: 0, refreshed: 0 };

    // Desligado sai das pendências ativas, mas mantém todo o histórico.
    if (employee.status !== 'ACTIVE') {
      const closed = await this.closeOpenAssignments(companyId, employeeId, 'Colaborador não está ativo');
      return { created: 0, closed, refreshed: 0 };
    }

    const [requirements, existing] = await Promise.all([
      this.requirementsFor(companyId, employee),
      this.prisma.trainingAssignment.findMany({
        where: { companyId, employeeId, deletedAt: null },
        select: {
          id: true,
          trainingId: true,
          requirementId: true,
          status: true,
          validUntil: true,
          mandatory: true,
        },
      }),
    ]);

    const now = options.deadlineFrom ?? new Date();
    const byRequirement = new Map(existing.filter((row) => row.requirementId).map((row) => [row.requirementId!, row]));
    // Treinamento já válido por outra origem não vira pendência duplicada.
    const settledTrainings = new Set(
      existing
        .filter((row) => TrainingMatrixService.SETTLED.includes(row.status))
        .map((row) => row.trainingId),
    );

    const toCreate: Prisma.TrainingAssignmentCreateManyInput[] = [];
    const historyRows: Prisma.TrainingHistoryEntryCreateManyInput[] = [];
    const activeRequirementIds = new Set<string>();

    for (const requirement of requirements) {
      activeRequirementIds.add(requirement.id);
      if (byRequirement.has(requirement.id)) continue;
      if (settledTrainings.has(requirement.trainingId)) continue;

      const deadlineDays =
        options.reason === 'ADMISSION'
          ? requirement.admissionDeadlineDays ?? requirement.training.deadlineDays
          : options.reason === 'JOB_CHANGED'
            ? requirement.movementDeadlineDays ?? requirement.training.deadlineDays
            : requirement.training.deadlineDays;

      toCreate.push({
        companyId,
        employeeId,
        trainingId: requirement.trainingId,
        requirementId: requirement.id,
        status: TrainingAssignmentStatus.PENDING,
        mandatory: requirement.mandatory,
        dueAt: this.computeDueAt(now, deadlineDays),
      });
      historyRows.push({
        companyId,
        employeeId,
        trainingId: requirement.trainingId,
        event: 'REQUIREMENT_CREATED',
        description: 'Exigência de treinamento gerada pela matriz',
        reason: options.reason,
        actorUserId: options.actorUserId ?? null,
        source: 'training-matrix',
      });
    }

    let created = 0;
    if (toCreate.length > 0) {
      const result = await this.prisma.trainingAssignment.createMany({ data: toCreate, skipDuplicates: true });
      created = result.count;
      if (historyRows.length > 0) {
        await this.prisma.trainingHistoryEntry.createMany({ data: historyRows });
      }
    }

    // Exigências que deixaram de alcançar o colaborador: encerra as ABERTAS.
    // O que já foi concluído permanece intacto no histórico.
    const orphans = existing.filter(
      (row) =>
        row.requirementId &&
        !activeRequirementIds.has(row.requirementId) &&
        TrainingMatrixService.OPEN.includes(row.status),
    );
    let closed = 0;
    if (orphans.length > 0) {
      const result = await this.prisma.trainingAssignment.updateMany({
        where: { id: { in: orphans.map((row) => row.id) } },
        data: { status: TrainingAssignmentStatus.NOT_APPLICABLE },
      });
      closed = result.count;
      await this.prisma.trainingHistoryEntry.createMany({
        data: orphans.map((row) => ({
          companyId,
          employeeId,
          assignmentId: row.id,
          trainingId: row.trainingId,
          event: 'MATRIX_CHANGED',
          description: 'Exigência deixou de ser aplicável ao colaborador',
          previousValue: row.status,
          newValue: TrainingAssignmentStatus.NOT_APPLICABLE,
          reason: options.reason,
          actorUserId: options.actorUserId ?? null,
          source: 'training-matrix',
        })),
      });
    }

    const refreshed = await this.refreshValidityStatuses(companyId, employeeId);
    return { created, closed, refreshed };
  }

  /** Recomputa a empresa inteira (usado após mudar exigência do cargo/área). */
  async recomputeCompany(companyId: string, reason = 'MATRIX_CHANGED'): Promise<RecomputeResult> {
    const employees = await this.prisma.orgEmployee.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: { id: true },
    });
    const total: RecomputeResult = { created: 0, closed: 0, refreshed: 0 };
    for (const employee of employees) {
      const result = await this.recomputeEmployee(companyId, employee.id, { reason });
      total.created += result.created;
      total.closed += result.closed;
      total.refreshed += result.refreshed;
    }
    return total;
  }

  /**
   * Reclassifica concluídos por data: válido → próximo do vencimento → vencido.
   * Roda no MaintenanceScheduler e após qualquer conclusão.
   */
  async refreshValidityStatuses(companyId: string, employeeId?: string): Promise<number> {
    const now = new Date();
    const rows = await this.prisma.trainingAssignment.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(employeeId ? { employeeId } : {}),
        validUntil: { not: null },
        status: {
          in: [
            TrainingAssignmentStatus.VALID,
            TrainingAssignmentStatus.DUE_SOON,
            TrainingAssignmentStatus.EXPIRED,
          ],
        },
      },
      select: {
        id: true,
        employeeId: true,
        trainingId: true,
        status: true,
        validUntil: true,
        training: { select: { dueSoonDays: true } },
      },
      take: 5000,
    });

    let changed = 0;
    for (const row of rows) {
      const next = this.statusFromValidity(row.validUntil, row.training?.dueSoonDays ?? 30, now);
      if (next === row.status) continue;
      await this.prisma.trainingAssignment.update({ where: { id: row.id }, data: { status: next } });
      await this.prisma.trainingHistoryEntry.create({
        data: {
          companyId,
          employeeId: row.employeeId,
          assignmentId: row.id,
          trainingId: row.trainingId,
          event: next === TrainingAssignmentStatus.EXPIRED ? 'EXPIRED' : 'MATRIX_CHANGED',
          description:
            next === TrainingAssignmentStatus.EXPIRED
              ? 'Treinamento venceu'
              : 'Treinamento entrou na faixa de vencimento próximo',
          previousValue: row.status,
          newValue: next,
          source: 'training-matrix',
        },
      });
      changed += 1;
    }
    return changed;
  }

  /** Fecha as pendências abertas de um colaborador (desligamento). */
  private async closeOpenAssignments(companyId: string, employeeId: string, reason: string): Promise<number> {
    const open = await this.prisma.trainingAssignment.findMany({
      where: { companyId, employeeId, deletedAt: null, status: { in: TrainingMatrixService.OPEN } },
      select: { id: true, trainingId: true, status: true },
    });
    if (open.length === 0) return 0;

    await this.prisma.trainingAssignment.updateMany({
      where: { id: { in: open.map((row) => row.id) } },
      data: { status: TrainingAssignmentStatus.NOT_APPLICABLE },
    });
    await this.prisma.trainingHistoryEntry.createMany({
      data: open.map((row) => ({
        companyId,
        employeeId,
        assignmentId: row.id,
        trainingId: row.trainingId,
        event: 'MATRIX_CHANGED',
        description: reason,
        previousValue: row.status,
        newValue: TrainingAssignmentStatus.NOT_APPLICABLE,
        source: 'training-matrix',
      })),
    });
    return open.length;
  }

  // ==========================================================================
  // Conclusão
  // ==========================================================================

  /**
   * Marca a célula como concluída: calcula validade, grava a revisão treinada e
   * agenda a avaliação de eficácia quando o treinamento exigir.
   */
  async completeAssignment(
    assignmentId: string,
    input: { completedAt: Date; score?: number | null; approved: boolean; classId?: string | null; actorUserId?: string | null },
  ) {
    const assignment = await this.prisma.trainingAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        training: {
          select: {
            id: true,
            validityKind: true,
            validityValue: true,
            dueSoonDays: true,
            documentId: true,
            documentVersion: true,
            requiresEffectiveness: true,
            effectivenessDays: true,
            requiresCertificate: true,
          },
        },
        requirement: { select: { validityKind: true, validityValue: true } },
      },
    });
    if (!assignment) return null;

    if (!input.approved) {
      await this.prisma.trainingAssignment.update({
        where: { id: assignmentId },
        data: {
          status: TrainingAssignmentStatus.FAILED,
          result: 'FAILED',
          score: input.score ?? null,
          attemptCount: { increment: 1 },
          classId: input.classId ?? assignment.classId,
        },
      });
      await this.log(assignment.companyId, assignment.employeeId, assignmentId, assignment.trainingId, 'FAILED', 'Reprovado no treinamento', input.actorUserId);
      return this.prisma.trainingAssignment.findUnique({ where: { id: assignmentId } });
    }

    let documentValidUntil: Date | null = null;
    if (assignment.training.validityKind === TrainingValidityKind.FROM_DOCUMENT && assignment.training.documentId) {
      const document = await this.prisma.document.findUnique({
        where: { id: assignment.training.documentId },
        select: { validUntil: true },
      });
      documentValidUntil = document?.validUntil ?? null;
    }

    const validUntil = this.computeValidUntil(
      input.completedAt,
      assignment.training,
      assignment.requirement,
      documentValidUntil,
    );
    const status = assignment.training.requiresEffectiveness
      ? TrainingAssignmentStatus.AWAITING_EFFECTIVENESS
      : this.statusFromValidity(validUntil, assignment.training.dueSoonDays);

    const updated = await this.prisma.trainingAssignment.update({
      where: { id: assignmentId },
      data: {
        status,
        result: 'APPROVED',
        score: input.score ?? null,
        completedAt: input.completedAt,
        validUntil,
        trainedDocumentVersion: assignment.training.documentVersion ?? null,
        attemptCount: { increment: 1 },
        classId: input.classId ?? assignment.classId,
      },
    });

    await this.log(
      assignment.companyId,
      assignment.employeeId,
      assignmentId,
      assignment.trainingId,
      'APPROVED',
      validUntil ? `Aprovado. Válido até ${validUntil.toLocaleDateString('pt-BR')}` : 'Aprovado. Sem vencimento',
      input.actorUserId,
    );

    if (assignment.training.requiresEffectiveness) {
      const dueAt = this.computeDueAt(input.completedAt, assignment.training.effectivenessDays ?? 60);
      await this.prisma.trainingEffectivenessReview.create({
        data: { companyId: assignment.companyId, assignmentId, dueAt },
      });
    }

    return updated;
  }

  private log(
    companyId: string,
    employeeId: string,
    assignmentId: string,
    trainingId: string,
    event: string,
    description: string,
    actorUserId?: string | null,
  ) {
    return this.prisma.trainingHistoryEntry.create({
      data: { companyId, employeeId, assignmentId, trainingId, event, description, actorUserId: actorUserId ?? null, source: 'training' },
    });
  }
}
