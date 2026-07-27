import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DevelopmentActionStatus,
  DevelopmentPlanOrigin,
  DevelopmentPlanStatus,
  Prisma,
  TrainingAssignmentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { TrainingMatrixService } from './training-matrix.service';

const MODULE = 'Treinamento';

/**
 * Avaliação de eficácia e Plano de Desenvolvimento Individual.
 *
 * Os dois compartilham o mesmo princípio: aproveitam o que já existe. A
 * eficácia se pendura na célula da matriz; o PDI aponta para treinamentos já
 * cadastrados em vez de criar um catálogo paralelo.
 */
@Injectable()
export class TrainingDevelopmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matrix: TrainingMatrixService,
    private readonly audit: AuditWriterService,
  ) {}

  // ==========================================================================
  // Avaliação de eficácia
  // ==========================================================================

  /** Eficácias pendentes — alimentam a tela de pendências do T&D. */
  async pendingEffectiveness(me: AuthPayload) {
    const rows = await this.prisma.trainingEffectivenessReview.findMany({
      where: { companyId: me.companyId, reviewedAt: null },
      orderBy: [{ dueAt: 'asc' }],
      include: {
        assignment: {
          include: {
            employee: {
              select: { id: true, name: true, registrationId: true, orgNode: { select: { name: true } }, job: { select: { name: true } } },
            },
            training: { select: { id: true, code: true, name: true } },
          },
        },
      },
      take: 300,
    });

    return rows.map((row) => ({
      id: row.id,
      dueAt: row.dueAt,
      overdue: Boolean(row.dueAt && row.dueAt.getTime() < Date.now()),
      assignmentId: row.assignmentId,
      employee: row.assignment.employee,
      training: row.assignment.training,
      completedAt: row.assignment.completedAt,
    }));
  }

  /**
   * Registra o resultado. Ineficaz devolve a célula para pendente — o
   * treinamento não cumpriu o objetivo, então a exigência volta a valer.
   */
  async reviewEffectiveness(me: AuthPayload, id: string, body: any) {
    const review = await this.prisma.trainingEffectivenessReview.findFirst({
      where: { id, companyId: me.companyId },
      include: { assignment: { select: { id: true, employeeId: true, trainingId: true, status: true } } },
    });
    if (!review) throw new NotFoundException('Avaliação de eficácia não encontrada.');
    if (review.reviewedAt) throw new BadRequestException('Esta avaliação já foi registrada.');

    const effective = body?.effective === true || body?.effective === 'true';
    const note = String(body?.note ?? '').trim();
    if (!effective && !note) throw new BadRequestException('Informe o que não foi eficaz e o encaminhamento.');

    const now = new Date();
    await this.prisma.trainingEffectivenessReview.update({
      where: { id },
      data: {
        effective,
        note: note || null,
        score: body?.score !== undefined && body?.score !== null && body?.score !== '' ? new Prisma.Decimal(Number(body.score)) : null,
        criteria: body?.criteria ?? undefined,
        reviewerUserId: me.sub,
        reviewedAt: now,
      },
    });

    // Eficaz: a célula segue o fluxo normal de validade.
    // Ineficaz: volta a pendente para programar reciclagem.
    const assignment = await this.prisma.trainingAssignment.findUnique({
      where: { id: review.assignmentId },
      select: { validUntil: true, training: { select: { dueSoonDays: true } } },
    });
    const nextStatus = effective
      ? this.matrix.statusFromValidity(assignment?.validUntil ?? null, assignment?.training.dueSoonDays ?? 30, now)
      : TrainingAssignmentStatus.PENDING;

    await this.prisma.trainingAssignment.update({
      where: { id: review.assignmentId },
      data: { status: nextStatus, ...(effective ? {} : { result: 'PENDING' }) },
    });

    await this.prisma.trainingHistoryEntry.create({
      data: {
        companyId: me.companyId,
        employeeId: review.assignment.employeeId,
        assignmentId: review.assignmentId,
        trainingId: review.assignment.trainingId,
        event: effective ? 'APPROVED' : 'RECYCLED',
        description: effective ? 'Treinamento avaliado como eficaz' : `Treinamento considerado ineficaz: ${note}`,
        previousValue: review.assignment.status,
        newValue: nextStatus,
        actorUserId: me.sub,
        source: 'training-effectiveness',
      },
    });
    await this.audit.record(me, {
      action: effective ? 'EFFECTIVE' : 'INEFFECTIVE',
      module: MODULE,
      entity: 'TrainingEffectivenessReview',
      entityId: id,
      message: note || 'Avaliação de eficácia',
    });

    return { reviewed: true, effective, nextStatus };
  }

  // ==========================================================================
  // Plano de Desenvolvimento Individual
  // ==========================================================================

  async listPlans(me: AuthPayload, query: { employeeId?: string; status?: string }) {
    const where: Prisma.DevelopmentPlanWhereInput = { companyId: me.companyId, deletedAt: null };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status && Object.values(DevelopmentPlanStatus).includes(query.status as DevelopmentPlanStatus)) {
      where.status = query.status as DevelopmentPlanStatus;
    }

    const rows = await this.prisma.developmentPlan.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      include: {
        employee: { select: { id: true, name: true, registrationId: true, job: { select: { name: true } }, orgNode: { select: { name: true } } } },
        actions: {
          orderBy: { createdAt: 'asc' },
          include: { training: { select: { id: true, code: true, name: true } } },
        },
      },
      take: 300,
    });
    return rows.map((row) => this.toPlan(row));
  }

  async createPlan(me: AuthPayload, body: any) {
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { id: String(body?.employeeId ?? ''), companyId: me.companyId },
      select: { id: true, name: true },
    });
    if (!employee) throw new BadRequestException('Colaborador não encontrado nesta empresa.');
    const title = String(body?.title ?? '').trim();
    if (!title) throw new BadRequestException('Informe o título do plano.');

    const origin = Object.values(DevelopmentPlanOrigin).includes(body?.origin)
      ? (body.origin as DevelopmentPlanOrigin)
      : DevelopmentPlanOrigin.MANAGER_REQUEST;

    const created = await this.prisma.developmentPlan.create({
      data: {
        companyId: me.companyId,
        employeeId: employee.id,
        title,
        origin,
        status: DevelopmentPlanStatus.ACTIVE,
        competency: body?.competency?.trim() || null,
        objective: body?.objective?.trim() || null,
        expectedResult: body?.expectedResult?.trim() || null,
        startsAt: this.toDate(body?.startsAt),
        dueAt: this.toDate(body?.dueAt),
        ownerUserId: body?.ownerUserId || me.sub,
        createdById: me.sub,
      },
      select: { id: true },
    });
    await this.audit.record(me, { action: 'CREATE', module: MODULE, entity: 'DevelopmentPlan', entityId: created.id, message: `${title} — ${employee.name}` });
    return this.getPlan(me, created.id);
  }

  async getPlan(me: AuthPayload, id: string) {
    const row = await this.prisma.developmentPlan.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: {
        employee: { select: { id: true, name: true, registrationId: true, job: { select: { name: true } }, orgNode: { select: { name: true } } } },
        actions: { orderBy: { createdAt: 'asc' }, include: { training: { select: { id: true, code: true, name: true } } } },
      },
    });
    if (!row) throw new NotFoundException('Plano de desenvolvimento não encontrado.');
    return this.toPlan(row);
  }

  async updatePlan(me: AuthPayload, id: string, body: any) {
    const current = await this.prisma.developmentPlan.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!current) throw new NotFoundException('Plano de desenvolvimento não encontrado.');

    const status = body?.status as DevelopmentPlanStatus | undefined;
    await this.prisma.developmentPlan.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
        ...(body.competency !== undefined ? { competency: body.competency?.trim() || null } : {}),
        ...(body.objective !== undefined ? { objective: body.objective?.trim() || null } : {}),
        ...(body.expectedResult !== undefined ? { expectedResult: body.expectedResult?.trim() || null } : {}),
        ...(body.dueAt !== undefined ? { dueAt: this.toDate(body.dueAt) } : {}),
        ...(body.managerReview !== undefined
          ? { managerReview: body.managerReview?.trim() || null, reviewedAt: new Date(), reviewedById: me.sub }
          : {}),
        ...(status && Object.values(DevelopmentPlanStatus).includes(status)
          ? { status, completedAt: status === DevelopmentPlanStatus.COMPLETED ? new Date() : null }
          : {}),
      },
    });
    await this.audit.record(me, { action: 'UPDATE', module: MODULE, entity: 'DevelopmentPlan', entityId: id, before: { status: current.status } });
    return this.getPlan(me, id);
  }

  /**
   * Ação do plano. Quando aponta para um treinamento, cria também a exigência
   * nominal do colaborador — o PDI vira pendência real na matriz.
   */
  async addAction(me: AuthPayload, planId: string, body: any) {
    const plan = await this.prisma.developmentPlan.findFirst({
      where: { id: planId, companyId: me.companyId, deletedAt: null },
      select: { id: true, employeeId: true },
    });
    if (!plan) throw new NotFoundException('Plano de desenvolvimento não encontrado.');
    const description = String(body?.description ?? '').trim();
    if (!description) throw new BadRequestException('Descreva a ação de desenvolvimento.');

    if (body?.trainingId) {
      const training = await this.prisma.training.findFirst({
        where: { id: body.trainingId, companyId: me.companyId, deletedAt: null },
        select: { id: true, deadlineDays: true },
      });
      if (!training) throw new BadRequestException('Treinamento inválido.');

      // Exigência nominal: o treinamento do PDI entra na matriz do colaborador.
      await this.prisma.trainingAssignment.upsert({
        where: {
          employeeId_trainingId_requirementId: {
            employeeId: plan.employeeId,
            trainingId: training.id,
            requirementId: null as unknown as string,
          },
        },
        create: {
          companyId: me.companyId,
          employeeId: plan.employeeId,
          trainingId: training.id,
          status: TrainingAssignmentStatus.PENDING,
          // PDI é desenvolvimento, não obrigação normativa.
          mandatory: false,
          dueAt: this.toDate(body?.dueAt) ?? this.matrix.computeDueAt(new Date(), training.deadlineDays),
        },
        update: {},
      }).catch(() => undefined);
    }

    const created = await this.prisma.developmentAction.create({
      data: {
        companyId: me.companyId,
        planId,
        description,
        trainingId: body?.trainingId || null,
        responsibleUserId: body?.responsibleUserId || null,
        dueAt: this.toDate(body?.dueAt),
        note: body?.note?.trim() || null,
      },
      select: { id: true },
    });
    await this.audit.record(me, { action: 'CREATE', module: MODULE, entity: 'DevelopmentAction', entityId: created.id, message: description });
    return this.getPlan(me, planId);
  }

  async updateAction(me: AuthPayload, actionId: string, body: any) {
    const action = await this.prisma.developmentAction.findFirst({
      where: { id: actionId, companyId: me.companyId },
      select: { id: true, planId: true, status: true },
    });
    if (!action) throw new NotFoundException('Ação não encontrada.');

    const status = body?.status as DevelopmentActionStatus | undefined;
    await this.prisma.developmentAction.update({
      where: { id: actionId },
      data: {
        ...(body.description !== undefined ? { description: String(body.description).trim() } : {}),
        ...(body.evidence !== undefined ? { evidence: body.evidence?.trim() || null } : {}),
        ...(body.note !== undefined ? { note: body.note?.trim() || null } : {}),
        ...(body.dueAt !== undefined ? { dueAt: this.toDate(body.dueAt) } : {}),
        ...(status && Object.values(DevelopmentActionStatus).includes(status)
          ? { status, completedAt: status === DevelopmentActionStatus.DONE ? new Date() : null }
          : {}),
      },
    });
    await this.audit.record(me, { action: 'UPDATE', module: MODULE, entity: 'DevelopmentAction', entityId: actionId, before: { status: action.status } });
    return this.getPlan(me, action.planId);
  }

  private toPlan(row: any) {
    const actions = row.actions ?? [];
    const done = actions.filter((action: any) => action.status === 'DONE').length;
    return {
      id: row.id,
      employee: row.employee,
      title: row.title,
      origin: row.origin,
      status: row.status,
      competency: row.competency,
      objective: row.objective,
      expectedResult: row.expectedResult,
      startsAt: row.startsAt,
      dueAt: row.dueAt,
      completedAt: row.completedAt,
      managerReview: row.managerReview,
      reviewedAt: row.reviewedAt,
      progress: actions.length > 0 ? done / actions.length : null,
      actions: actions.map((action: any) => ({
        id: action.id,
        description: action.description,
        status: action.status,
        training: action.training,
        dueAt: action.dueAt,
        completedAt: action.completedAt,
        evidence: action.evidence,
        note: action.note,
      })),
    };
  }

  private toDate(value: unknown): Date | null {
    if (!value) return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Data inválida.');
    return date;
  }
}
