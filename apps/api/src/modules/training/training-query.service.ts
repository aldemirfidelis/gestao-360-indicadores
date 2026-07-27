import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TrainingAssignmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { AccessService } from '../access/access.service';
import { TrainingMatrixService } from './training-matrix.service';

const MODULE_KEY = 'training';

/**
 * Consultas do módulo: visão geral, matriz, pendências e histórico.
 *
 * Todas passam pelo mesmo filtro de área — o gestor enxerga apenas a estrutura
 * sob sua responsabilidade, salvo permissão adicional. Nenhum indicador é
 * calculado com dado inventado: tudo sai da matriz materializada.
 */
@Injectable()
export class TrainingQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** Áreas visíveis ao usuário (null = todas). */
  private async areaFilter(me: AuthPayload): Promise<string[] | null> {
    try {
      return await this.access.listAreaFilter(me.sub, MODULE_KEY, 'view');
    } catch {
      return null;
    }
  }

  private employeeScope(areas: string[] | null): Prisma.OrgEmployeeWhereInput {
    return areas ? { orgNodeId: { in: areas } } : {};
  }

  // ==========================================================================
  // Visão geral
  // ==========================================================================

  async overview(me: AuthPayload) {
    const areas = await this.areaFilter(me);
    const now = new Date();
    const base: Prisma.TrainingAssignmentWhereInput = {
      companyId: me.companyId,
      deletedAt: null,
      employee: { status: 'ACTIVE', ...this.employeeScope(areas) },
    };

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [byStatus, employeesTotal, employeesWithPending, completedThisMonth, workload, classesPlanned, certificatesPending] =
      await Promise.all([
        this.prisma.trainingAssignment.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
        this.prisma.orgEmployee.count({ where: { companyId: me.companyId, status: 'ACTIVE', ...this.employeeScope(areas) } }),
        this.prisma.trainingAssignment
          .findMany({
            where: { ...base, status: { in: TrainingMatrixService.OPEN } },
            select: { employeeId: true },
            distinct: ['employeeId'],
          })
          .then((rows) => rows.length),
        this.prisma.trainingAssignment.count({ where: { ...base, completedAt: { gte: monthStart } } }),
        this.prisma.trainingAssignment.findMany({
          where: { ...base, completedAt: { gte: monthStart } },
          select: { training: { select: { workloadMinutes: true } } },
          take: 5000,
        }),
        this.prisma.trainingClass.count({
          where: { companyId: me.companyId, deletedAt: null, status: { in: ['PLANNED', 'OPEN', 'IN_PROGRESS'] } },
        }),
        this.prisma.trainingCertificate.count({
          where: { companyId: me.companyId, deletedAt: null, status: 'PENDING_VALIDATION' },
        }),
      ]);

    const countOf = (status: TrainingAssignmentStatus) => byStatus.find((row) => row.status === status)?._count._all ?? 0;
    const total = byStatus.reduce((sum, row) => sum + row._count._all, 0);
    const settled = TrainingMatrixService.SETTLED.reduce((sum, status) => sum + countOf(status), 0);
    const expired = countOf(TrainingAssignmentStatus.EXPIRED);
    const dueSoon = countOf(TrainingAssignmentStatus.DUE_SOON);
    const open = TrainingMatrixService.OPEN.reduce((sum, status) => sum + countOf(status), 0);

    const approvedCount = await this.prisma.trainingAssignment.count({ where: { ...base, result: 'APPROVED' } });
    const decidedCount = await this.prisma.trainingAssignment.count({ where: { ...base, result: { in: ['APPROVED', 'FAILED'] } } });

    return {
      metrics: {
        // Conformidade = células resolvidas sobre o total exigido.
        complianceRate: total > 0 ? settled / total : null,
        employeesTotal,
        employeesWithPending,
        employeesCompliant: Math.max(0, employeesTotal - employeesWithPending),
        pending: open,
        expired,
        dueSoon,
        completedThisMonth,
        workloadHoursThisMonth: Math.round(workload.reduce((sum, row) => sum + (row.training?.workloadMinutes ?? 0), 0) / 60),
        classesPlanned,
        certificatesPending,
        approvalRate: decidedCount > 0 ? approvedCount / decidedCount : null,
      },
      byArea: await this.pendingByArea(me.companyId, areas),
      byTraining: await this.pendingByTraining(me.companyId, areas),
    };
  }

  private async pendingByArea(companyId: string, areas: string[] | null) {
    const rows = await this.prisma.trainingAssignment.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: TrainingMatrixService.OPEN },
        employee: { status: 'ACTIVE', ...(areas ? { orgNodeId: { in: areas } } : {}) },
      },
      select: { employee: { select: { orgNodeId: true, orgNode: { select: { name: true } } } } },
      take: 5000,
    });
    const map = new Map<string, { areaId: string | null; area: string; pending: number }>();
    for (const row of rows) {
      const key = row.employee.orgNodeId ?? 'sem-area';
      const current = map.get(key) ?? { areaId: row.employee.orgNodeId, area: row.employee.orgNode?.name ?? 'Sem área', pending: 0 };
      current.pending += 1;
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.pending - a.pending).slice(0, 15);
  }

  private async pendingByTraining(companyId: string, areas: string[] | null) {
    const rows = await this.prisma.trainingAssignment.groupBy({
      by: ['trainingId'],
      where: {
        companyId,
        deletedAt: null,
        status: { in: TrainingMatrixService.OPEN },
        employee: { status: 'ACTIVE', ...(areas ? { orgNodeId: { in: areas } } : {}) },
      },
      _count: { _all: true },
    });
    if (rows.length === 0) return [];
    const trainings = await this.prisma.training.findMany({
      where: { id: { in: rows.map((row) => row.trainingId) } },
      select: { id: true, code: true, name: true },
    });
    const byId = new Map(trainings.map((training) => [training.id, training]));
    return rows
      .map((row) => ({
        trainingId: row.trainingId,
        code: byId.get(row.trainingId)?.code ?? '',
        name: byId.get(row.trainingId)?.name ?? 'Treinamento',
        pending: row._count._all,
      }))
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 15);
  }

  // ==========================================================================
  // Matriz e pendências
  // ==========================================================================

  async assignments(
    me: AuthPayload,
    query: {
      search?: string;
      status?: string;
      trainingId?: string;
      orgNodeId?: string;
      jobId?: string;
      employeeId?: string;
      onlyOpen?: string;
      take?: string;
      skip?: string;
    },
  ) {
    const areas = await this.areaFilter(me);
    const where: Prisma.TrainingAssignmentWhereInput = {
      companyId: me.companyId,
      deletedAt: null,
      employee: {
        status: 'ACTIVE',
        ...this.employeeScope(areas),
        ...(query.orgNodeId ? { orgNodeId: query.orgNodeId } : {}),
        ...(query.jobId ? { jobId: query.jobId } : {}),
        ...(query.employeeId ? { id: query.employeeId } : {}),
        ...(query.search?.trim()
          ? {
              OR: [
                { name: { contains: query.search.trim(), mode: 'insensitive' } },
                { registrationId: { contains: query.search.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    };
    if (query.trainingId) where.trainingId = query.trainingId;
    if (query.status && Object.values(TrainingAssignmentStatus).includes(query.status as TrainingAssignmentStatus)) {
      where.status = query.status as TrainingAssignmentStatus;
    } else if (query.onlyOpen === '1') {
      where.status = { in: TrainingMatrixService.OPEN };
    }

    const take = Math.min(Math.max(Number(query.take ?? 100) || 100, 1), 500);
    const skip = Math.max(Number(query.skip ?? 0) || 0, 0);

    const [rows, total] = await Promise.all([
      this.prisma.trainingAssignment.findMany({
        where,
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
        take,
        skip,
        include: {
          employee: {
            select: {
              id: true, name: true, registrationId: true,
              job: { select: { id: true, name: true } },
              orgNode: { select: { id: true, name: true } },
            },
          },
          training: { select: { id: true, code: true, name: true, modality: true, workloadMinutes: true, documentVersion: true } },
          requirement: {
            select: {
              id: true, target: true, targetId: true, justification: true, activity: true, blocksOperation: true,
              originDocument: { select: { id: true, code: true, title: true, version: true } },
            },
          },
          class: { select: { id: true, startsAt: true, status: true } },
        },
      }),
      this.prisma.trainingAssignment.count({ where }),
    ]);

    return { total, items: rows.map((row) => this.toAssignment(row)) };
  }

  async assignmentDetail(me: AuthPayload, id: string) {
    const row = await this.prisma.trainingAssignment.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: {
        employee: {
          select: {
            id: true, name: true, registrationId: true,
            job: { select: { id: true, name: true } },
            orgNode: { select: { id: true, name: true } },
          },
        },
        training: {
          select: {
            id: true, code: true, name: true, modality: true, workloadMinutes: true, documentVersion: true,
            validityKind: true, validityValue: true, requiresCertificate: true,
            document: { select: { id: true, code: true, title: true, version: true } },
          },
        },
        requirement: {
          select: {
            id: true, target: true, targetId: true, justification: true, activity: true, blocksOperation: true,
            originDocument: { select: { id: true, code: true, title: true, version: true } },
          },
        },
        class: { select: { id: true, startsAt: true, status: true, instructor: { select: { name: true } } } },
        certificates: { orderBy: { createdAt: 'desc' } },
        effectiveness: { orderBy: { createdAt: 'desc' } },
        history: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!row) throw new NotFoundException('Registro da matriz não encontrado.');

    return {
      ...this.toAssignment(row),
      document: row.training.document,
      // Responde "qual revisão foi treinada" e "quem não está na versão atual".
      trainedDocumentVersion: row.trainedDocumentVersion,
      documentOutdated:
        Boolean(row.training.document && row.trainedDocumentVersion && row.training.document.version > row.trainedDocumentVersion),
      certificates: row.certificates,
      effectiveness: row.effectiveness,
      history: row.history,
    };
  }

  /** Linha do tempo completa do colaborador (histórico permanente). */
  async employeeHistory(me: AuthPayload, employeeId: string) {
    const areas = await this.areaFilter(me);
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { id: employeeId, companyId: me.companyId, ...this.employeeScope(areas) },
      select: {
        id: true, name: true, registrationId: true, status: true,
        job: { select: { name: true } },
        orgNode: { select: { name: true } },
      },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado ou fora da sua área.');

    const [assignments, history] = await Promise.all([
      this.prisma.trainingAssignment.findMany({
        where: { companyId: me.companyId, employeeId, deletedAt: null },
        orderBy: [{ status: 'asc' }, { validUntil: 'asc' }],
        include: {
          training: { select: { id: true, code: true, name: true, modality: true, workloadMinutes: true } },
          requirement: { select: { justification: true, activity: true, blocksOperation: true } },
        },
      }),
      this.prisma.trainingHistoryEntry.findMany({
        where: { companyId: me.companyId, employeeId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);

    const settled = assignments.filter((row) => TrainingMatrixService.SETTLED.includes(row.status)).length;
    return {
      employee,
      compliance: assignments.length > 0 ? settled / assignments.length : null,
      workloadHours: Math.round(
        assignments.filter((row) => row.completedAt).reduce((sum, row) => sum + row.training.workloadMinutes, 0) / 60,
      ),
      assignments: assignments.map((row) => this.toAssignment(row)),
      history,
    };
  }

  /**
   * Consulta rápida do plano: quem está autorizado a executar uma atividade.
   * Inapto = exigência que bloqueia operação sem estar válida.
   */
  async authorizedFor(me: AuthPayload, trainingId: string) {
    const areas = await this.areaFilter(me);
    const rows = await this.prisma.trainingAssignment.findMany({
      where: {
        companyId: me.companyId,
        trainingId,
        deletedAt: null,
        employee: { status: 'ACTIVE', ...this.employeeScope(areas) },
      },
      include: {
        employee: {
          select: {
            id: true, name: true, registrationId: true,
            job: { select: { name: true } },
            orgNode: { select: { name: true } },
          },
        },
      },
      take: 2000,
    });

    const authorized = rows.filter((row) => TrainingMatrixService.SETTLED.includes(row.status));
    const blocked = rows.filter((row) => !TrainingMatrixService.SETTLED.includes(row.status));
    const shape = (row: (typeof rows)[number]) => ({
      employeeId: row.employeeId,
      name: row.employee.name,
      registrationId: row.employee.registrationId,
      job: row.employee.job?.name ?? null,
      area: row.employee.orgNode?.name ?? null,
      status: row.status,
      validUntil: row.validUntil,
    });

    return { authorized: authorized.map(shape), blocked: blocked.map(shape) };
  }

  private toAssignment(row: any) {
    return {
      id: row.id,
      employeeId: row.employeeId,
      employee: row.employee,
      training: row.training,
      status: row.status,
      mandatory: row.mandatory,
      dueAt: row.dueAt,
      completedAt: row.completedAt,
      validUntil: row.validUntil,
      score: row.score ? Number(row.score) : null,
      result: row.result,
      attemptCount: row.attemptCount,
      class: row.class ?? null,
      // Origem da exigência: responde "por que este treinamento é obrigatório".
      origin: row.requirement
        ? {
            requirementId: row.requirement.id,
            target: row.requirement.target,
            justification: row.requirement.justification,
            activity: row.requirement.activity,
            blocksOperation: row.requirement.blocksOperation,
            document: row.requirement.originDocument ?? null,
          }
        : null,
      waivedAt: row.waivedAt,
      waiverReason: row.waiverReason,
    };
  }
}
