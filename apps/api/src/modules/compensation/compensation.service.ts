import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationKind, Prisma, UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { buildDocx } from '../documents/docx.util';
import { DocumentsService } from '../documents/documents.service';
import { RecruitRequisitionService } from '../recruitment/recruit-requisition.service';
import { resolveResponsibleChain } from '../../common/org-hierarchy';

const MODULE_NAME = 'Cargos e Salários';

const JOB_STATUSES = ['ACTIVE', 'INACTIVE', 'DRAFT'] as const;
const DESCRIPTION_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'ADJUSTMENTS_REQUESTED',
  'IN_APPROVAL',
  'APPROVED',
  'PUBLISHED',
  'REPLACED',
  'INACTIVE',
] as const;
const MOVEMENT_FINAL_STATUSES = new Set(['APPLIED', 'REJECTED', 'CANCELLED']);
const POSITION_OPEN_STATUSES = new Set(['OPEN', 'VACANT', 'FUTURE_OPENING', 'IN_APPROVAL']);
const POSITION_OCCUPIED_STATUSES = new Set(['OCCUPIED', 'ACTIVE']);
const COMPENSATION_SETTINGS_KEY = 'compensation.settings';
const DEFAULT_COMPENSATION_SETTINGS = {
  meritGuidelinePercent: 0.05,
  requireBudgetForMovements: true,
  requireApprovalForSalaryTable: true,
  salaryVisibility: 'restricted',
  reviewCadenceMonths: 12,
};

const DESCRIPTION_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['IN_REVIEW', 'INACTIVE'],
  IN_REVIEW: ['ADJUSTMENTS_REQUESTED', 'IN_APPROVAL'],
  ADJUSTMENTS_REQUESTED: ['DRAFT', 'IN_REVIEW'],
  IN_APPROVAL: ['APPROVED', 'ADJUSTMENTS_REQUESTED'],
  APPROVED: ['PUBLISHED', 'INACTIVE'],
  PUBLISHED: ['REPLACED', 'INACTIVE'],
  REPLACED: ['INACTIVE'],
  INACTIVE: ['DRAFT'],
};

@Injectable()
export class CompensationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly documents: DocumentsService,
    private readonly auditWriter: AuditWriterService,
    private readonly recruitRequisitions: RecruitRequisitionService,
  ) {}

  // Notifica um usuario com tolerancia a falha (notificacao nunca quebra o fluxo principal).
  private async notifySafe(companyId: string, userId: string | null | undefined, title: string, body: string, link: string) {
    if (!userId) return;
    try {
      await this.notifications.create(companyId, userId, NotificationKind.MESSAGE, title, body, link);
    } catch {
      /* no-op: a notificacao e best-effort */
    }
  }

  // Usuarios da empresa aptos a aprovar (permissao direta ou via perfil de acesso, ou papel admin).
  private async findApproverUserIds(companyId: string, keys: string[]): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        active: true,
        deletedAt: null,
        OR: [
          { role: { in: [UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN] } },
          { permissions: { some: { permission: { key: { in: keys } } } } },
          { accessProfile: { permissions: { some: { permission: { key: { in: keys } } } } } },
        ],
      },
      select: { id: true },
      take: 50,
    });
    return users.map((user) => user.id);
  }

  async options(me: AuthPayload) {
    await this.ensureBaseline(me);
    const [jobs, orgNodes, users, salaryTables, positions] = await Promise.all([
      this.prisma.compensationJobCatalog.findMany({
        where: { companyId: me.companyId, deletedAt: null },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.orgNode.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, type: true, parentId: true },
        orderBy: [{ type: 'asc' }, { position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true, status: 'ACTIVE' },
        select: { id: true, name: true, email: true, role: true, jobTitle: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.compensationSalaryTable.findMany({
        where: { companyId: me.companyId, deletedAt: null },
        orderBy: [{ status: 'asc' }, { effectiveFrom: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.compensationPosition.findMany({
        where: { companyId: me.companyId, deletedAt: null },
        orderBy: [{ status: 'asc' }, { code: 'asc' }],
      }),
    ]);

    return {
      jobs,
      orgNodes,
      users,
      salaryTables,
      positions,
      jobTypes: [
        'operacional',
        'administrativo',
        'tecnico',
        'especialista',
        'lideranca',
        'gestao',
        'executivo',
        'aprendiz',
        'estagio',
        'temporario',
        'terceiro',
      ],
      positionStatuses: [
        'OCCUPIED',
        'VACANT',
        'BLOCKED',
        'FROZEN',
        'TEMPORARY',
        'OVER_BUDGET',
        'FUTURE_OPENING',
        'IN_APPROVAL',
        'INACTIVE',
      ],
      descriptionStatuses: DESCRIPTION_STATUSES,
    };
  }

  async overview(me: AuthPayload, query: Record<string, string | undefined>) {
    await this.ensureBaseline(me);
    const periodRef = query.periodRef || currentPeriodRef();
    const filters = this.positionWhere(me.companyId, query);
    const [positions, employees, movements, budgets, snapshots] = await Promise.all([
      this.prisma.compensationPosition.findMany({ where: filters }),
      this.prisma.orgEmployee.findMany({
        where: {
          companyId: me.companyId,
          ...(query.orgNodeId ? { orgNodeId: query.orgNodeId } : {}),
          ...(query.orgJobId ? { jobId: query.orgJobId } : {}),
        },
        include: { job: true, orgNode: true },
      }),
      this.prisma.compensationMovementRequest.findMany({
        where: {
          companyId: me.companyId,
          ...(query.status ? { status: query.status } : {}),
          createdAt: periodWindow(periodRef),
        },
      }),
      this.prisma.compensationBudget.findMany({
        where: {
          companyId: me.companyId,
          periodRef,
          deletedAt: null,
          ...(query.orgNodeId ? { orgNodeId: query.orgNodeId } : {}),
          ...(query.costCenter ? { costCenter: query.costCenter } : {}),
        },
      }),
      this.latestSalarySnapshots(me.companyId),
    ]);

    const canSeeMass = await this.hasAnyPermission(me, ['compensation:salary:mass', 'compensation:salary:individual']);
    const currentSnapshotByEmployee = latestByEmployee(snapshots);
    const allocatedEmployees = employees.filter((employee) => employee.status !== 'VACANT' && employee.status !== 'INACTIVE');
    const occupiedPositions = positions.filter((position) => POSITION_OCCUPIED_STATUSES.has(position.status));
    const openPositions = positions.filter((position) => POSITION_OPEN_STATUSES.has(position.status));
    const inBudget = positions.filter((position) => position.budgetStatus === 'IN_BUDGET' || position.budgetStatus === 'OK');
    const outBudget = positions.filter((position) => position.budgetStatus === 'OUT_OF_BUDGET' || position.status === 'OVER_BUDGET');
    const salarySituations = employees.map((employee) => this.classifyEmployeeSalary(employee, currentSnapshotByEmployee.get(employee.id)));
    const plannedBudget = budgets.reduce((sum, budget) => sum + toNumber(budget.plannedPayroll), 0);
    const realizedCost = Array.from(currentSnapshotByEmployee.values()).reduce((sum, snapshot) => sum + toNumber(snapshot.currentSalary), 0);

    const byArea = groupByArea(positions, employees);
    const movementsByType = Object.entries(countBy(movements, (movement) => movement.type)).map(([name, value]) => ({ name, value }));

    return {
      periodRef,
      salaryMasked: !canSeeMass,
      cards: {
        allocatedEmployees: allocatedEmployees.length,
        plannedPositions: positions.length,
        occupiedPositions: occupiedPositions.length,
        openPositions: openPositions.length,
        positionsInBudget: inBudget.length,
        positionsOutOfBudget: outBudget.length,
        employeesInRange: salarySituations.filter((item) => item.situation === 'DENTRO_DA_FAIXA').length,
        employeesBelowRange: salarySituations.filter((item) => item.situation === 'ABAIXO_DA_FAIXA').length,
        employeesAboveRange: salarySituations.filter((item) => item.situation === 'ACIMA_DA_FAIXA').length,
        pendingApprovals: movements.filter((movement) => !MOVEMENT_FINAL_STATUSES.has(movement.status)).length,
        plannedMovements: movements.filter((movement) => movement.status === 'APPROVED' || movement.status === 'SCHEDULED').length,
        completedMovements: movements.filter((movement) => movement.status === 'APPLIED').length,
        plannedBudget: canSeeMass ? roundMoney(plannedBudget) : null,
        realizedCost: canSeeMass ? roundMoney(realizedCost) : null,
        budgetVariation: canSeeMass ? roundMoney(plannedBudget - realizedCost) : null,
      },
      charts: {
        plannedVsRealizedByArea: byArea,
        vacanciesByArea: byArea.map((row) => ({ name: row.name, value: row.openPositions })),
        employeesByBand: Object.entries(countBy(employees, (employee) => employee.band || 'Sem faixa')).map(([name, value]) => ({ name, value })),
        salaryFit: Object.entries(countBy(salarySituations, (item) => item.situation)).map(([name, value]) => ({ name, value })),
        payrollEvolution: canSeeMass ? payrollEvolution(snapshots) : [],
        budgetPlannedVsRealized: canSeeMass ? [{ name: periodRef, planned: roundMoney(plannedBudget), realized: roundMoney(realizedCost) }] : [],
        movementsByType,
        averageApprovalTime: averageApprovalHours(movements),
        compaRatioAverage: canSeeMass ? average(salarySituations.map((item) => item.compaRatio).filter(isNumber)) : null,
        correctionPriorities: priorityAreas(salarySituations),
      },
    };
  }

  async structure(me: AuthPayload) {
    await this.ensureBaseline(me);
    const [jobs, employees, careerPaths, positions, requisitions] = await Promise.all([
      this.prisma.orgJob.findMany({ where: { companyId: me.companyId, active: true }, orderBy: { name: 'asc' } }),
      this.prisma.orgEmployee.findMany({
        where: { companyId: me.companyId },
        include: {
          job: true,
          jobPretended: true,
          orgNode: true,
          approvalRequests: {
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              approver: { select: { id: true, name: true, email: true } },
              requester: { select: { id: true, name: true, email: true } },
              currentJob: { select: { id: true, name: true } },
              targetJob: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.orgJobCareerPath.findMany({ where: { companyId: me.companyId }, include: { fromJob: true, toJob: true } }),
      this.prisma.compensationPosition.findMany({
        where: { companyId: me.companyId, deletedAt: null },
        include: { jobCatalog: true },
        orderBy: [{ orgNodeId: 'asc' }, { code: 'asc' }],
      }),
      // Requisições de vaga abertas (Recrutamento), para exibir o status/ação
      // de "Solicitar vaga" / "Enviar ao recrutamento" direto na árvore.
      this.prisma.recruitRequisition.findMany({
        where: {
          companyId: me.companyId,
          deletedAt: null,
          status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED', 'SENT_TO_RECRUITMENT', 'IN_RECRUITMENT'] },
        },
        select: {
          id: true,
          code: true,
          status: true,
          orgNodeId: true,
          orgJobId: true,
          openingsRequested: true,
          priority: true,
          approvals: { select: { order: true, role: true, decision: true }, orderBy: { order: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { jobs, employees, careerPaths, positions, requisitions };
  }

  /**
   * Abre uma solicitação de vaga a partir da Estrutura de Pessoas: cria (ou
   * reaproveita) o cargo, resolve gestor->superintendente da área subindo
   * OrgNode.parentId e cria a RecruitRequisition já enviada para aprovação
   * (RecruitRequisitionService, módulo de Recrutamento — sem duplicar o
   * fluxo de aprovação/travas de quadro, que continua lá).
   */
  async solicitarVaga(me: AuthPayload, body: any = {}) {
    const orgNodeId = cleanString(body?.orgNodeId);
    if (!orgNodeId) throw new BadRequestException('Área/setor é obrigatório.');

    let orgJobId = cleanString(body?.orgJobId);
    const newJobName = cleanString(body?.newJobName);
    if (!orgJobId && newJobName) {
      const job = await this.prisma.orgJob.create({
        data: { companyId: me.companyId, name: newJobName, description: cleanString(body?.newJobDescription) },
      });
      orgJobId = job.id;
    }
    if (!orgJobId) throw new BadRequestException('Informe um cargo existente ou o nome do novo cargo.');

    const nodes = await this.prisma.orgNode.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      select: { id: true, name: true, parentId: true, responsibleUserId: true },
    });
    const chain = resolveResponsibleChain(nodes, orgNodeId);
    const approvalSteps: Array<{ order: number; role: string; approverId: string }> = [];
    if (chain[0]) approvalSteps.push({ order: approvalSteps.length + 1, role: 'GESTOR', approverId: chain[0].userId });
    if (chain[1]) approvalSteps.push({ order: approvalSteps.length + 1, role: 'SUPERINTENDENTE', approverId: chain[1].userId });

    // Faixa (A–F) e salário vinculado ao cargo+faixa — segue para o recrutamento
    // como salário de referência da proposta.
    const band = cleanString(body?.band);
    const salaryInfo = await this.salaryForJobBand(me, orgJobId, band);

    const created = await this.recruitRequisitions.create(me, {
      orgNodeId,
      orgJobId,
      openingsRequested: body?.openingsRequested,
      vacancyType: body?.vacancyType,
      priority: body?.priority,
      reason: body?.reason,
      contractType: body?.contractType,
      salaryMin: salaryInfo.salary ?? undefined,
      salaryMax: salaryInfo.salary ?? undefined,
      details: band ? { band } : undefined,
      approvalSteps: approvalSteps.length ? approvalSteps : undefined,
    });
    const submitted = await this.recruitRequisitions.submit(me, created.id);

    const vacantEmployeeId = cleanString(body?.vacantEmployeeId);
    if (vacantEmployeeId) {
      await this.prisma.orgEmployee.deleteMany({
        where: { id: vacantEmployeeId, companyId: me.companyId, status: 'VACANT' },
      });
    }

    await this.audit(
      me,
      'CREATE',
      'RecruitRequisition',
      submitted.id,
      null,
      { orgNodeId, orgJobId, code: submitted.code },
      `Vaga solicitada via Estrutura de Pessoas (${submitted.code})`,
    );
    return submitted;
  }

  // ------------------------------ Hierarquia por cargo/pessoa ------------------------------

  /** Todos os colaboradores ativos com seu superior imediato — o frontend monta a árvore. */
  async hierarchy(me: AuthPayload) {
    const employees = await this.prisma.orgEmployee.findMany({
      where: { companyId: me.companyId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        registrationId: true,
        superiorEmployeeId: true,
        job: { select: { id: true, name: true } },
        orgNode: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
    return employees.map((e) => ({
      id: e.id,
      name: e.name,
      registrationId: e.registrationId,
      superiorEmployeeId: e.superiorEmployeeId,
      jobName: e.job?.name ?? null,
      areaName: e.orgNode?.name ?? null,
    }));
  }

  /** Define o superior imediato do colaborador, bloqueando auto-referência e ciclos. */
  async setSuperior(me: AuthPayload, employeeId: string, superiorEmployeeId: string | null) {
    const employee = await this.prisma.orgEmployee.findFirst({ where: { id: employeeId, companyId: me.companyId }, select: { id: true, name: true } });
    if (!employee) throw new NotFoundException('Colaborador não encontrado.');
    const superiorId = (superiorEmployeeId ?? '').trim() || null;

    if (superiorId) {
      if (superiorId === employeeId) throw new BadRequestException('Um colaborador não pode ser superior de si mesmo.');
      const superior = await this.prisma.orgEmployee.findFirst({ where: { id: superiorId, companyId: me.companyId }, select: { id: true } });
      if (!superior) throw new NotFoundException('Superior não encontrado.');
      // Impede ciclo: o superior escolhido não pode estar na cadeia de subordinados do colaborador.
      const all = await this.prisma.orgEmployee.findMany({ where: { companyId: me.companyId }, select: { id: true, superiorEmployeeId: true } });
      const byId = new Map(all.map((e) => [e.id, e.superiorEmployeeId]));
      let cursor: string | null = superiorId;
      const guard = new Set<string>();
      while (cursor) {
        if (cursor === employeeId) throw new BadRequestException('Esse superior geraria um ciclo na hierarquia.');
        if (guard.has(cursor)) break;
        guard.add(cursor);
        cursor = byId.get(cursor) ?? null;
      }
    }

    await this.prisma.orgEmployee.update({ where: { id: employeeId }, data: { superiorEmployeeId: superiorId } });
    await this.auditWriter.record(me, {
      module: MODULE_NAME,
      entity: 'OrgEmployee',
      entityId: employeeId,
      action: 'UPDATE',
      message: `Superior imediato de "${employee.name}" ${superiorId ? 'definido' : 'removido'}`,
    });
    return { ok: true };
  }

  async listJobs(me: AuthPayload, query: Record<string, string | undefined>) {
    await this.ensureBaseline(me);
    const jobs = await this.prisma.compensationJobCatalog.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.family ? { family: query.family } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
                { summary: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { positions: true, descriptions: true, salaryRanges: true, versions: true } },
        versions: { orderBy: { version: 'desc' }, take: 5 },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });

    const orgJobIds = jobs.map((job) => job.orgJobId).filter((id): id is string => !!id);
    const linkedEmployees = orgJobIds.length
      ? await this.prisma.orgEmployee.groupBy({
          by: ['jobId'],
          where: { companyId: me.companyId, jobId: { in: orgJobIds } },
          _count: { _all: true },
        })
      : [];
    const employeesByJob = new Map(linkedEmployees.map((row) => [row.jobId, row._count._all]));
    return jobs.map((job) => ({
      ...job,
      linkedEmployees: job.orgJobId ? employeesByJob.get(job.orgJobId) ?? 0 : 0,
    }));
  }

  async createJob(me: AuthPayload, body: Record<string, unknown>) {
    const name = requiredString(body.name, 'Nome do cargo e obrigatório');
    const duplicate = await this.prisma.compensationJobCatalog.findFirst({
      where: { companyId: me.companyId, name: { equals: name, mode: 'insensitive' }, deletedAt: null },
    });
    if (duplicate) throw new ConflictException('Já existe cargo com este nome');
    const code = cleanString(body.code) || (await this.nextJobCode(me.companyId));
    const data = this.jobDataFromBody(body, {});

    const created = await this.prisma.$transaction(async (tx) => {
      const orgJobId = cleanString(body.orgJobId) || (await this.createOrgJob(tx, me, name, cleanString(body.summary)));
      const job = await tx.compensationJobCatalog.create({
        data: { ...data, companyId: me.companyId, orgJobId, code, name, createdById: me.sub, updatedById: me.sub },
      });
      // CBO acompanha o cargo operacional (OrgJob): é de lá que o prontuário e o
      // eSocial (S-2200) leem — cadastrar no catálogo já propaga sozinho.
      if (body.cbo !== undefined) await this.syncOrgJobCbo(tx, orgJobId, data.cbo);
      await this.createJobVersion(tx, me, job, 'Criação do cargo');
      return job;
    });
    await this.audit(me, 'CREATE', 'CompensationJobCatalog', created.id, null, created, created.name);
    return created;
  }

  async updateJob(me: AuthPayload, id: string, body: Record<string, unknown>) {
    const before = await this.getJob(me, id);
    const requestedName = optionalString(body.name);
    if (requestedName && requestedName !== before.name) {
      const duplicate = await this.prisma.compensationJobCatalog.findFirst({
        where: { companyId: me.companyId, id: { not: id }, name: { equals: requestedName, mode: 'insensitive' }, deletedAt: null },
      });
      if (duplicate) throw new ConflictException('Já existe cargo com este nome');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const job = await tx.compensationJobCatalog.update({
        where: { id },
        data: { ...this.jobDataFromBody(body, {}), updatedById: me.sub },
      });
      if (before.orgJobId && (body.name || body.summary !== undefined)) {
        await tx.orgJob.update({
          where: { id: before.orgJobId },
          data: {
            name: requestedName,
            description: body.summary !== undefined ? cleanString(body.summary) : undefined,
          },
        });
      }
      // Propaga o CBO ao cargo operacional somente quando o campo veio no corpo
      // (uma edição sem o campo não pode apagar o CBO já registrado no OrgJob).
      if (before.orgJobId && body.cbo !== undefined) {
        await this.syncOrgJobCbo(tx, before.orgJobId, cleanString(body.cbo));
      }
      return job;
    });
    await this.audit(me, 'UPDATE', 'CompensationJobCatalog', id, before, updated, updated.name);
    return updated;
  }

  async duplicateJob(me: AuthPayload, id: string) {
    const source = await this.getJob(me, id);
    const copyName = `${source.name} (copia)`;
    const code = await this.nextJobCode(me.companyId);
    const created = await this.prisma.compensationJobCatalog.create({
      data: {
        companyId: me.companyId,
        code,
        name: copyName,
        summary: source.summary,
        family: source.family,
        careerTrack: source.careerTrack,
        hierarchyLevel: source.hierarchyLevel,
        grade: source.grade,
        salaryBand: source.salaryBand,
        cbo: source.cbo,
        jobType: source.jobType,
        defaultOrgNodeId: source.defaultOrgNodeId,
        defaultCostCenter: source.defaultCostCenter,
        managerUserId: source.managerUserId,
        unionCategory: source.unionCategory,
        workSchedule: source.workSchedule,
        shift: source.shift,
        modality: source.modality,
        criticality: source.criticality,
        status: 'DRAFT',
        effectiveFrom: source.effectiveFrom,
        createdById: me.sub,
        updatedById: me.sub,
      },
    });
    await this.prisma.compensationJobCatalogVersion.create({
      data: {
        companyId: me.companyId,
        jobCatalogId: created.id,
        version: 1,
        snapshot: this.jobSnapshot(created),
        changeReason: `Duplicado de ${source.code}`,
        changedById: me.sub,
      },
    });
    await this.audit(me, 'DUPLICATE', 'CompensationJobCatalog', created.id, source, created, created.name);
    return created;
  }

  async versionJob(me: AuthPayload, id: string, reason: string) {
    const before = await this.getJob(me, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const job = await tx.compensationJobCatalog.update({
        where: { id },
        data: { currentVersion: { increment: 1 }, updatedById: me.sub },
      });
      await this.createJobVersion(tx, me, job, reason || 'Nova versão');
      return job;
    });
    await this.audit(me, 'VERSION', 'CompensationJobCatalog', id, before, updated, updated.name, reason);
    return updated;
  }

  async inactivateJob(me: AuthPayload, id: string, reason: string) {
    if (!reason.trim()) throw new BadRequestException('Justificativa obrigatória para inativar cargo');
    const before = await this.getJob(me, id);
    const linked = await this.prisma.compensationPosition.count({ where: { companyId: me.companyId, jobCatalogId: id, deletedAt: null } });
    const updated = await this.prisma.compensationJobCatalog.update({
      where: { id },
      data: { status: 'INACTIVE', inactiveAt: new Date(), inactiveReason: reason, updatedById: me.sub },
    });
    if (linked > 0) {
      await this.audit(me, 'INACTIVATE_WITH_LINKS', 'CompensationJobCatalog', id, before, updated, updated.name, reason);
    } else {
      await this.audit(me, 'INACTIVATE', 'CompensationJobCatalog', id, before, updated, updated.name, reason);
    }
    return updated;
  }

  async reactivateJob(me: AuthPayload, id: string) {
    const before = await this.getJob(me, id);
    const updated = await this.prisma.compensationJobCatalog.update({
      where: { id },
      data: { status: 'ACTIVE', inactiveAt: null, inactiveReason: null, updatedById: me.sub },
    });
    await this.audit(me, 'REACTIVATE', 'CompensationJobCatalog', id, before, updated, updated.name);
    return updated;
  }

  async listDescriptions(me: AuthPayload, query: Record<string, string | undefined>) {
    await this.ensureBaseline(me);
    return this.prisma.compensationJobDescription.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(query.jobCatalogId ? { jobCatalogId: query.jobCatalogId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: { jobCatalog: true },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async createDescription(me: AuthPayload, body: Record<string, unknown>) {
    const jobCatalogId = requiredString(body.jobCatalogId, 'Cargo obrigatório');
    await this.getJob(me, jobCatalogId);
    const latest = await this.prisma.compensationJobDescription.findFirst({
      where: { companyId: me.companyId, jobCatalogId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const created = await this.prisma.compensationJobDescription.create({
      data: {
        ...this.descriptionDataFromBody(body),
        companyId: me.companyId,
        jobCatalogId,
        version: (latest?.version ?? 0) + 1,
        status: cleanString(body.status) || 'DRAFT',
        preparedById: cleanString(body.preparedById) || me.sub,
        createdById: me.sub,
        updatedById: me.sub,
      },
    });
    await this.audit(me, 'CREATE', 'CompensationJobDescription', created.id, null, created, `Descrição ${created.version}`);
    return created;
  }

  async updateDescription(me: AuthPayload, id: string, body: Record<string, unknown>) {
    const before = await this.getDescription(me, id);
    if (before.status === 'PUBLISHED') throw new ConflictException('Descrição publicada deve gerar nova versão');
    const updated = await this.prisma.compensationJobDescription.update({
      where: { id },
      data: { ...this.descriptionDataFromBody(body), updatedById: me.sub },
    });
    await this.audit(me, 'UPDATE', 'CompensationJobDescription', id, before, updated, `Descrição ${updated.version}`);
    return updated;
  }

  async changeDescriptionStatus(me: AuthPayload, id: string, status: string, reason: string) {
    const before = await this.getDescription(me, id);
    if (!DESCRIPTION_STATUSES.includes(status as any)) throw new BadRequestException('Status de descrição inválido');
    const allowed = DESCRIPTION_TRANSITIONS[before.status] ?? [];
    if (!allowed.includes(status) && before.status !== status) {
      throw new ConflictException(`Transição de ${before.status} para ${status} não permitida`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (status === 'PUBLISHED') {
        await tx.compensationJobDescription.updateMany({
          where: { companyId: me.companyId, jobCatalogId: before.jobCatalogId, id: { not: id }, status: 'PUBLISHED' },
          data: { status: 'REPLACED', replacedAt: new Date() },
        });
      }
      return tx.compensationJobDescription.update({
        where: { id },
        data: {
          status,
          publishedAt: status === 'PUBLISHED' ? new Date() : before.publishedAt,
          updatedById: me.sub,
        },
      });
    });
    await this.audit(me, 'STATUS_CHANGE', 'CompensationJobDescription', id, before, updated, `Descrição ${updated.version}`, reason);
    return updated;
  }

  async listSalaryTables(me: AuthPayload, query: Record<string, string | undefined>) {
    return this.prisma.compensationSalaryTable.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.code ? { code: query.code } : {}),
      },
      include: { ranges: { include: { jobCatalog: true }, orderBy: [{ band: 'asc' }, { step: 'asc' }] } },
      orderBy: [{ status: 'asc' }, { effectiveFrom: 'desc' }, { version: 'desc' }],
    });
  }

  async createSalaryTable(me: AuthPayload, body: Record<string, unknown>) {
    const code = cleanString(body.code) || (await this.nextSalaryTableCode(me.companyId));
    const name = requiredString(body.name, 'Nome da tabela salarial e obrigatório');
    const effectiveFrom = requiredDate(body.effectiveFrom, 'Vigência inicial obrigatória');
    const created = await this.prisma.$transaction(async (tx) => {
      const table = await tx.compensationSalaryTable.create({
        data: {
          companyId: me.companyId,
          code,
          name,
          unitId: cleanString(body.unitId),
          region: cleanString(body.region),
          unionCategory: cleanString(body.unionCategory),
          tableType: cleanString(body.tableType),
          currency: cleanString(body.currency) || 'BRL',
          effectiveFrom,
          effectiveTo: optionalDate(body.effectiveTo),
          version: intValue(body.version) ?? 1,
          status: cleanString(body.status) || 'DRAFT',
          responsibleId: cleanString(body.responsibleId),
          justification: cleanString(body.justification),
          attachments: jsonValue(body.attachments),
          createdById: me.sub,
          updatedById: me.sub,
        },
      });
      for (const range of arrayValue(body.ranges)) {
        await this.createRange(tx, me, table.id, range as Record<string, unknown>);
      }
      return table;
    });
    await this.audit(me, 'CREATE', 'CompensationSalaryTable', created.id, null, created, created.name);
    return this.getSalaryTable(me, created.id);
  }

  async updateSalaryTable(me: AuthPayload, id: string, body: Record<string, unknown>) {
    const before = await this.getSalaryTable(me, id);
    if (before.status === 'PUBLISHED' && Object.keys(body).some((key) => key !== 'status')) {
      throw new ConflictException('Tabela publicada não deve ser sobrescrita. Gere nova revisão.');
    }
    const updated = await this.prisma.compensationSalaryTable.update({
      where: { id },
      data: {
        name: optionalString(body.name),
        unitId: cleanString(body.unitId),
        region: cleanString(body.region),
        unionCategory: cleanString(body.unionCategory),
        tableType: cleanString(body.tableType),
        currency: optionalString(body.currency),
        effectiveFrom: optionalDate(body.effectiveFrom) ?? undefined,
        effectiveTo: body.effectiveTo === null ? null : optionalDate(body.effectiveTo),
        status: optionalString(body.status),
        responsibleId: cleanString(body.responsibleId),
        justification: cleanString(body.justification),
        attachments: body.attachments === undefined ? undefined : jsonValue(body.attachments),
        updatedById: me.sub,
      },
    });
    await this.audit(me, 'UPDATE', 'CompensationSalaryTable', id, before, updated, updated.name);
    return this.getSalaryTable(me, id);
  }

  async addSalaryRange(me: AuthPayload, id: string, body: Record<string, unknown>) {
    await this.getSalaryTable(me, id);
    // Liga a faixa ao cargo do quadro (OrgJob) para resolução direta do salário
    // por cargo+faixa em Solicitar Vaga / Recrutamento / Folha.
    const payload: Record<string, unknown> = { ...body };
    if (!cleanString(payload.orgJobId) && cleanString(payload.jobCatalogId)) {
      const catalog = await this.prisma.compensationJobCatalog.findFirst({
        where: { id: String(payload.jobCatalogId), companyId: me.companyId },
        select: { orgJobId: true },
      });
      if (catalog?.orgJobId) payload.orgJobId = catalog.orgJobId;
    }
    const created = await this.createRange(this.prisma, me, id, payload);
    await this.audit(me, 'CREATE', 'CompensationSalaryRange', created.id, null, created, created.band);
    return created;
  }

  async deleteSalaryTable(me: AuthPayload, id: string) {
    const before = await this.getSalaryTable(me, id);
    await this.prisma.compensationSalaryTable.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: me.sub },
    });
    await this.audit(me, 'DELETE', 'CompensationSalaryTable', id, before, null, before.name);
    return { ok: true };
  }

  /**
   * Resolve o salário vinculado a um cargo (OrgJob) + faixa (A–F). Prioriza tabela
   * PUBLICADA e vigência mais recente; cai para rascunho se não houver publicada.
   * Usado por Solicitar Vaga, pela proposta do recrutamento e pela folha.
   */
  async salaryForJobBand(me: AuthPayload, orgJobId?: string | null, band?: string | null) {
    const job = cleanString(orgJobId);
    const faixa = cleanString(band);
    if (!job || !faixa) return { salary: null as string | null, currency: 'BRL', rangeId: null as string | null };
    const range = await this.prisma.compensationSalaryRange.findFirst({
      where: {
        companyId: me.companyId,
        band: faixa,
        salaryTable: { deletedAt: null },
        OR: [{ orgJobId: job }, { jobCatalog: { orgJobId: job } }],
      },
      include: { salaryTable: { select: { status: true, currency: true, effectiveFrom: true } } },
      orderBy: [{ salaryTable: { effectiveFrom: 'desc' } }, { createdAt: 'desc' }],
    });
    if (!range) return { salary: null, currency: 'BRL', rangeId: null };
    return { salary: range.midpointSalary.toString(), currency: range.salaryTable.currency ?? 'BRL', rangeId: range.id };
  }

  async publishSalaryTable(me: AuthPayload, id: string) {
    const before = await this.getSalaryTable(me, id);
    if (before.ranges.length === 0) throw new ConflictException('Tabela salarial precisa de ao menos uma faixa');
    const updated = await this.prisma.compensationSalaryTable.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), updatedById: me.sub },
    });
    await this.audit(me, 'PUBLISH', 'CompensationSalaryTable', id, before, updated, updated.name);
    return this.getSalaryTable(me, id);
  }

  async createSalaryTableRevision(me: AuthPayload, id: string, justification: string) {
    const source = await this.getSalaryTable(me, id);
    const latest = await this.prisma.compensationSalaryTable.findFirst({
      where: { companyId: me.companyId, code: source.code },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const revision = await this.prisma.$transaction(async (tx) => {
      const table = await tx.compensationSalaryTable.create({
        data: {
          companyId: me.companyId,
          code: source.code,
          name: source.name,
          unitId: source.unitId,
          region: source.region,
          unionCategory: source.unionCategory,
          tableType: source.tableType,
          currency: source.currency,
          effectiveFrom: new Date(),
          version: (latest?.version ?? source.version) + 1,
          status: 'DRAFT',
          responsibleId: source.responsibleId,
          justification,
          attachments: source.attachments ?? Prisma.JsonNull,
          createdById: me.sub,
          updatedById: me.sub,
        },
      });
      for (const range of source.ranges) {
        await tx.compensationSalaryRange.create({
          data: {
            companyId: me.companyId,
            salaryTableId: table.id,
            jobCatalogId: range.jobCatalogId,
            orgJobId: range.orgJobId,
            family: range.family,
            grade: range.grade,
            level: range.level,
            band: range.band,
            step: range.step,
            minSalary: range.minSalary,
            midpointSalary: range.midpointSalary,
            maxSalary: range.maxSalary,
            amplitude: range.amplitude,
            levelPercent: range.levelPercent,
            benefits: range.benefits ?? Prisma.JsonNull,
            notes: range.notes,
          },
        });
      }
      return table;
    });
    await this.audit(me, 'REVISION', 'CompensationSalaryTable', revision.id, source, revision, revision.name, justification);
    return this.getSalaryTable(me, revision.id);
  }

  async salaryFit(me: AuthPayload, query: Record<string, string | undefined>) {
    await this.ensureBaseline(me);
    const canSeeIndividual = await this.hasAnyPermission(me, ['compensation:salary:individual']);
    const [employees, snapshots, positions, profiles] = await Promise.all([
      this.prisma.orgEmployee.findMany({
        where: {
          companyId: me.companyId,
          ...(query.orgNodeId ? { orgNodeId: query.orgNodeId } : {}),
          ...(query.orgJobId ? { jobId: query.orgJobId } : {}),
        },
        include: { job: true, orgNode: true },
        orderBy: { name: 'asc' },
      }),
      this.latestSalarySnapshots(me.companyId),
      this.prisma.compensationPosition.findMany({ where: { companyId: me.companyId, deletedAt: null } }),
      this.employeeProfiles(me.companyId),
    ]);
    const snapshotByEmployee = latestByEmployee(snapshots);
    const positionByEmployee = new Map(positions.flatMap((position) => (position.currentEmployeeId ? [[position.currentEmployeeId, position]] : [])));
    const rows = employees.map((employee) => {
      const snapshot = snapshotByEmployee.get(employee.id);
      const classified = this.classifyEmployeeSalary(employee, snapshot);
      const position = positionByEmployee.get(employee.id);
      const range = snapshot?.salaryRange;
      const profile = profiles.get(employee.id);
      return {
        employeeId: employee.id,
        registrationId: employee.registrationId,
        employeeName: employee.name,
        orgNode: employee.orgNode ? { id: employee.orgNode.id, name: employee.orgNode.name, type: employee.orgNode.type } : null,
        job: employee.job ? { id: employee.job.id, name: employee.job.name } : null,
        grade: range?.grade ?? position?.band ?? null,
        band: range?.band ?? employee.band,
        currentSalary: canSeeIndividual ? moneyOrNull(snapshot?.currentSalary) : null,
        minSalary: canSeeIndividual ? moneyOrNull(range?.minSalary) : null,
        midpointSalary: canSeeIndividual ? moneyOrNull(range?.midpointSalary) : null,
        maxSalary: canSeeIndividual ? moneyOrNull(range?.maxSalary) : null,
        compaRatio: canSeeIndividual ? classified.compaRatio : null,
        positioningPercent: canSeeIndividual ? classified.positioningPercent : null,
        situation: classified.situation,
        lastMovementAt: snapshot?.effectiveFrom ?? null,
        costCenter: position?.costCenter ?? null,
        budgetStatus: position?.budgetStatus ?? null,
        salaryMasked: !canSeeIndividual,
        gender: profile?.gender ?? null,
        raceEthnicity: profile?.raceEthnicity ?? null,
        admissionDate: profile?.admissionDate ?? null,
        tenureMonths: monthsSince(profile?.admissionDate ?? null),
        performanceRating: profile?.performanceRating ?? null,
        performanceCycleRef: profile?.performanceCycleRef ?? null,
      };
    });
    if (canSeeIndividual) {
      await this.audit(me, 'SENSITIVE_VIEW', 'CompensationSalaryFit', null, null, { count: rows.length }, 'Enquadramento salarial');
    }
    return query.situation ? rows.filter((row) => row.situation === query.situation) : rows;
  }

  // --------------------------- equidade e perfis ----------------------------
  // Dados demograficos/desempenho ficam em CompensationEmployeeProfile (1:1
  // com OrgEmployee). A leitura e tolerante a migracao pendente: sem a tabela,
  // os endpoints existentes seguem funcionando com perfis vazios.

  private async employeeProfiles(companyId: string) {
    try {
      const profiles = await this.prisma.compensationEmployeeProfile.findMany({ where: { companyId } });
      return new Map(profiles.map((profile) => [profile.employeeId, profile]));
    } catch {
      return new Map<string, never>();
    }
  }

  async saveEmployeeProfile(me: AuthPayload, employeeId: string, body: Record<string, unknown>) {
    const employee = await this.prisma.orgEmployee.findFirst({ where: { id: employeeId, companyId: me.companyId } });
    if (!employee) throw new NotFoundException('Colaborador nao encontrado');
    const data = {
      gender: normalizeGender(body.gender),
      raceEthnicity: cleanString(body.raceEthnicity),
      admissionDate: optionalDate(body.admissionDate),
      performanceRating: normalizeRating(body.performanceRating),
      performanceCycleRef: cleanString(body.performanceCycleRef),
      updatedById: me.sub,
    };
    const before = await this.prisma.compensationEmployeeProfile.findUnique({ where: { employeeId } });
    const profile = await this.prisma.compensationEmployeeProfile.upsert({
      where: { employeeId },
      create: { companyId: me.companyId, employeeId, ...data },
      update: data,
    });
    await this.audit(me, before ? 'UPDATE' : 'CREATE', 'CompensationEmployeeProfile', profile.id, before, data, employee.name);
    return profile;
  }

  /**
   * Import em lote de perfis (CSV/XLSX no cliente -> linhas JSON). Casa por
   * matricula (registrationId) ou por nome exato como fallback.
   */
  async importEmployeeProfiles(me: AuthPayload, body: Record<string, unknown>) {
    const rows = Array.isArray(body?.rows) ? (body.rows as Array<Record<string, unknown>>) : [];
    if (!rows.length) throw new BadRequestException('Informe linhas para importar.');
    if (rows.length > 2000) throw new BadRequestException('O limite por importação é de 2000 linhas.');
    const employees = await this.prisma.orgEmployee.findMany({
      where: { companyId: me.companyId },
      select: { id: true, registrationId: true, name: true },
    });
    const byRegistration = new Map(employees.flatMap((e) => (e.registrationId ? [[e.registrationId.trim().toLowerCase(), e.id]] : [])));
    const byName = new Map(employees.map((e) => [e.name.trim().toLowerCase(), e.id]));
    let updated = 0;
    const errors: Array<{ row: number; message: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const registration = cleanString(row.registrationId)?.toLowerCase();
        const name = cleanString(row.employeeName)?.toLowerCase();
        const employeeId = (registration && byRegistration.get(registration)) || (name && byName.get(name)) || null;
        if (!employeeId) throw new BadRequestException('Colaborador não encontrado (matrícula/nome).');
        const data = {
          gender: normalizeGender(row.gender),
          raceEthnicity: cleanString(row.raceEthnicity),
          admissionDate: optionalDate(row.admissionDate),
          performanceRating: normalizeRating(row.performanceRating),
          performanceCycleRef: cleanString(row.performanceCycleRef),
          updatedById: me.sub,
        };
        await this.prisma.compensationEmployeeProfile.upsert({
          where: { employeeId },
          create: { companyId: me.companyId, employeeId, ...data },
          update: data,
        });
        updated += 1;
      } catch (error: any) {
        errors.push({ row: i + 1, message: error?.message ?? 'Erro ao importar linha' });
      }
    }
    await this.audit(me, 'IMPORT', 'CompensationEmployeeProfile', null, null, { updated, errors: errors.length }, 'Import de perfis');
    return { updated, errors, total: rows.length };
  }

  /**
   * Analise de equidade salarial (base do Relatório de Transparência Salarial,
   * Lei 14.611/2023): gap de mediana/média mulher x homem, global e por grade,
   * família e área; representatividade em liderança; cobertura de dados.
   * Grupos com menos de 3 pessoas de qualquer gênero são suprimidos (LGPD).
   */
  async payEquity(me: AuthPayload, query: Record<string, string | undefined>) {
    await this.ensureBaseline(me);
    const canSeeValues = await this.hasAnyPermission(me, ['compensation:salary:mass', 'compensation:salary:individual']);
    const [employees, snapshots, catalogs, profiles] = await Promise.all([
      this.prisma.orgEmployee.findMany({
        where: { companyId: me.companyId, ...(query.orgNodeId ? { orgNodeId: query.orgNodeId } : {}) },
        include: { job: true, orgNode: true },
      }),
      this.latestSalarySnapshots(me.companyId),
      this.prisma.compensationJobCatalog.findMany({ where: { companyId: me.companyId, deletedAt: null } }),
      this.employeeProfiles(me.companyId),
    ]);
    const snapshotByEmployee = latestByEmployee(snapshots);
    const catalogByOrgJob = new Map(catalogs.flatMap((catalog) => (catalog.orgJobId ? [[catalog.orgJobId, catalog]] : [])));

    type EquityMember = { gender: string; salary: number | null; tenureMonths: number | null; leadership: boolean };
    const members: Array<EquityMember & { grade: string; family: string; area: string; rating: number | null }> = [];
    let withGender = 0;
    let withSalary = 0;
    let withRating = 0;
    for (const employee of employees) {
      const profile = profiles.get(employee.id);
      const snapshot = snapshotByEmployee.get(employee.id);
      const salary = moneyOrNull(snapshot?.currentSalary);
      const catalog = catalogByOrgJob.get(employee.jobId);
      const gender = profile?.gender ?? null;
      if (gender && gender !== 'NAO_INFORMADO') withGender += 1;
      if (salary !== null) withSalary += 1;
      if (profile?.performanceRating != null) withRating += 1;
      if (!gender || gender === 'NAO_INFORMADO') continue;
      members.push({
        gender,
        salary,
        tenureMonths: monthsSince(profile?.admissionDate ?? null),
        leadership: isLeadershipJob(catalog ?? null),
        grade: snapshot?.salaryRange?.grade ?? snapshot?.salaryRange?.band ?? employee.band ?? 'Sem grade',
        family: catalog?.family ?? 'Sem família',
        area: employee.orgNode?.name ?? 'Sem área',
        rating: profile?.performanceRating ?? null,
      });
    }

    const groupBy = (key: (m: (typeof members)[number]) => string) => {
      const groups = new Map<string, typeof members>();
      for (const member of members) {
        const groupKey = key(member);
        const list = groups.get(groupKey) ?? [];
        list.push(member);
        groups.set(groupKey, list);
      }
      return [...groups.entries()]
        .map(([label, list]) => equityGroupStats(label, list, canSeeValues))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    };

    const distribution = [0, 0, 0, 0];
    for (const profile of profiles.values()) {
      const rating = (profile as { performanceRating?: number | null }).performanceRating;
      if (rating != null && rating >= 1 && rating <= 4) distribution[rating - 1] += 1;
    }

    const leadership = members.filter((member) => member.leadership);
    if (canSeeValues) {
      await this.audit(me, 'SENSITIVE_VIEW', 'CompensationPayEquity', null, null, { employees: employees.length }, 'Equidade salarial');
    }
    return {
      generatedAt: new Date(),
      masked: !canSeeValues,
      privacyNote: 'Grupos com menos de 3 pessoas de qualquer gênero têm valores suprimidos (privacidade/LGPD).',
      coverage: {
        employees: employees.length,
        withGender,
        withSalary,
        withRating,
        genderPct: employees.length ? (withGender / employees.length) * 100 : 0,
        ratingPct: employees.length ? (withRating / employees.length) * 100 : 0,
      },
      global: equityGroupStats('Geral', members, canSeeValues),
      byGrade: groupBy((member) => member.grade),
      byFamily: groupBy((member) => member.family),
      byArea: groupBy((member) => member.area),
      leadership: {
        ...equityGroupStats('Liderança', leadership, canSeeValues),
        womenSharePct: leadership.length ? (leadership.filter((m) => m.gender === 'FEMININO').length / leadership.length) * 100 : null,
        womenShareOverallPct: members.length ? (members.filter((m) => m.gender === 'FEMININO').length / members.length) * 100 : null,
      },
      performanceDistribution: {
        counts: distribution,
        total: distribution.reduce((a, b) => a + b, 0),
      },
    };
  }

  async listMovements(me: AuthPayload, query: Record<string, string | undefined>) {
    return this.prisma.compensationMovementRequest.findMany({
      where: {
        companyId: me.companyId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      include: { currentPosition: true, targetPosition: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createMovement(me: AuthPayload, body: Record<string, unknown>) {
    const type = requiredString(body.type, 'Tipo de movimentação obrigatório');
    const reason = requiredString(body.reason, 'Motivo obrigatório');
    const justification = requiredString(body.justification, 'Justificativa obrigatória');
    const effectiveAt = requiredDate(body.effectiveAt, 'Data de vigência obrigatória');
    const currentSalary = money(body.currentSalary);
    const proposedSalary = money(body.proposedSalary);
    const monthlyImpact = proposedSalary !== null && currentSalary !== null ? proposedSalary.minus(currentSalary) : null;
    const annualImpact = monthlyImpact ? monthlyImpact.mul(12) : null;
    const availableBudget = money(body.availableBudget);
    if (monthlyImpact && monthlyImpact.gt(0) && availableBudget && monthlyImpact.gt(availableBudget)) {
      throw new ConflictException('Orçamento insuficiente para a movimentação');
    }
    const status = monthlyImpact && monthlyImpact.gt(0) && !availableBudget ? 'PENDING_BUDGET' : 'REQUESTED';
    const approvalSteps = buildApprovalSteps(body.approvalSteps);
    const protocol = await this.nextMovementProtocol(me.companyId);
    const employeeId = await this.assertCompanyRef(this.prisma.orgEmployee, me.companyId, cleanString(body.employeeId), 'Colaborador nao encontrado');
    const currentPositionId = await this.assertCompanyRef(this.prisma.compensationPosition, me.companyId, cleanString(body.currentPositionId), 'Posicao atual nao encontrada', { deletedAt: null });
    const targetPositionId = await this.assertCompanyRef(this.prisma.compensationPosition, me.companyId, cleanString(body.targetPositionId), 'Posicao destino nao encontrada', { deletedAt: null });
    const currentJobId = await this.assertCompanyRef(this.prisma.orgJob, me.companyId, cleanString(body.currentJobId), 'Cargo atual nao encontrado');
    const targetJobId = await this.assertCompanyRef(this.prisma.orgJob, me.companyId, cleanString(body.targetJobId), 'Cargo destino nao encontrado');
    const managerUserId = await this.assertCompanyRef(this.prisma.user, me.companyId, cleanString(body.managerUserId), 'Gestor nao encontrado', { deletedAt: null, active: true });
    const created = await this.prisma.compensationMovementRequest.create({
      data: {
        companyId: me.companyId,
        protocol,
        type,
        employeeId,
        currentPositionId,
        targetPositionId,
        currentJobId,
        targetJobId,
        currentBand: cleanString(body.currentBand),
        targetBand: cleanString(body.targetBand),
        currentSalary,
        proposedSalary,
        changePercent: percentageChange(currentSalary, proposedSalary),
        effectiveAt,
        reason,
        justification,
        monthlyImpact,
        annualImpact,
        costCenter: cleanString(body.costCenter),
        availableBudget,
        requesterId: me.sub,
        managerUserId,
        status,
        approvalSteps: approvalSteps as unknown as Prisma.InputJsonValue,
        attachments: jsonValue(body.attachments),
        evidences: jsonValue(body.evidences),
        notes: cleanString(body.notes),
      },
    });
    await this.audit(me, 'MOVEMENT_REQUESTED', 'CompensationMovementRequest', created.id, null, created, created.protocol, justification);
    // Notifica todos os aprovadores da empresa (e o gestor informado) sobre a nova fila.
    // Bloco best-effort: qualquer falha aqui nao deve impedir a criacao da movimentacao.
    try {
      const firstStep = approvalSteps[0];
      const approverIds = await this.findApproverUserIds(me.companyId, ['compensation:movements:approve', 'compensation:manage']);
      const recipients = new Set<string>(approverIds);
      const managerId = managerUserId;
      if (managerId) recipients.add(managerId);
      recipients.delete(me.sub); // nao notifica o proprio solicitante
      for (const userId of recipients) {
        await this.notifySafe(
          me.companyId,
          userId,
          `Movimentação ${created.protocol} aguardando aprovação`,
          `${type} · ${reason}${firstStep ? ` · Alçada: ${firstStep.role}` : ''}`,
          '/cargos-salarios/aprovacoes',
        );
      }
    } catch {
      /* notificacao best-effort */
    }
    return created;
  }

  async decideMovement(me: AuthPayload, id: string, decision: 'APPROVED' | 'REJECTED', note: string) {
    const before = await this.getMovement(me, id);
    if (MOVEMENT_FINAL_STATUSES.has(before.status)) throw new ConflictException('Movimentação já finalizada');

    // Aprovacao multi-alcada: avanca a primeira etapa pendente da cadeia.
    const steps = normalizeApprovalSteps(before.approvalSteps);
    const pendingIndex = steps.findIndex((step) => step.status === 'PENDING');
    const decidedStep = pendingIndex >= 0 ? steps[pendingIndex] : null;
    if (decidedStep) {
      decidedStep.status = decision;
      decidedStep.approverId = me.sub;
      decidedStep.decidedAt = new Date().toISOString();
      decidedStep.note = note || undefined;
    }
    const remainingPending = steps.some((step) => step.status === 'PENDING');
    // Status final: rejeitado encerra; aprovado so vira APPROVED quando nao ha mais alcadas.
    const nextStatus = decision === 'REJECTED' ? 'REJECTED' : remainingPending ? 'IN_APPROVAL' : 'APPROVED';
    const isFinal = nextStatus === 'REJECTED' || nextStatus === 'APPROVED';

    const updated = await this.prisma.compensationMovementRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        decidedAt: isFinal ? new Date() : null,
        notes: note || before.notes,
        approvalSteps: steps as unknown as Prisma.InputJsonValue,
      },
    });
    await this.audit(me, `MOVEMENT_${decision}`, 'CompensationMovementRequest', id, before, updated, updated.protocol, note);

    // Avisa o solicitante sobre o andamento.
    const label = decision === 'REJECTED' ? 'rejeitada' : remainingPending ? 'avançou de alçada' : 'aprovada';
    await this.notifySafe(
      me.companyId,
      before.requesterId,
      `Movimentação ${before.protocol} ${label}`,
      decidedStep ? `Alçada ${decidedStep.role}: ${decision === 'REJECTED' ? 'rejeitada' : 'aprovada'}${note ? ` · ${note}` : ''}` : note || '',
      '/cargos-salarios/movimentacoes',
    );
    return updated;
  }

  async applyMovement(me: AuthPayload, id: string) {
    const before = await this.getMovement(me, id);
    if (before.status !== 'APPROVED') throw new ConflictException('Apenas movimentações aprovadas podem ser aplicadas');
    const updated = await this.prisma.$transaction(async (tx) => {
      if (before.employeeId) {
        await tx.orgEmployee.updateMany({
          where: { id: before.employeeId, companyId: me.companyId },
          data: {
            jobId: before.targetJobId ?? undefined,
            band: before.targetBand ?? undefined,
            jobPretendedId: null,
            bandPretended: before.targetBand ?? undefined,
            approvalStatus: 'APROVADO',
          },
        });
      }
      if (before.targetPositionId) {
        const position = await tx.compensationPosition.updateMany({
          where: { id: before.targetPositionId, companyId: me.companyId, deletedAt: null },
          data: {
            currentEmployeeId: before.employeeId ?? undefined,
            status: before.employeeId ? 'OCCUPIED' : undefined,
            updatedById: me.sub,
          },
        });
        if (position.count === 0) throw new NotFoundException('Posicao destino nao encontrada');
      }
      if (before.employeeId && before.proposedSalary) {
        await tx.compensationSalarySnapshot.create({
          data: {
            companyId: me.companyId,
            employeeId: before.employeeId,
            orgJobId: before.targetJobId ?? before.currentJobId,
            currentSalary: before.proposedSalary,
            effectiveFrom: before.effectiveAt,
            reason: before.reason,
            createdById: me.sub,
          },
        });
      }
      await tx.compensationAllocationHistory.create({
        data: {
          companyId: me.companyId,
          positionId: before.targetPositionId,
          employeeId: before.employeeId,
          fromJobId: before.currentJobId,
          toJobId: before.targetJobId,
          fromPositionId: before.currentPositionId,
          toPositionId: before.targetPositionId,
          reason: before.reason,
          justification: before.justification,
          effectiveAt: before.effectiveAt,
          changedById: me.sub,
        },
      });
      return tx.compensationMovementRequest.update({
        where: { id },
        data: { status: 'APPLIED', appliedAt: new Date() },
      });
    });
    await this.audit(me, 'MOVEMENT_APPLIED', 'CompensationMovementRequest', id, before, updated, updated.protocol);
    await this.notifySafe(
      me.companyId,
      before.requesterId,
      `Movimentação ${before.protocol} aplicada`,
      `${before.type} · vigência ${before.effectiveAt.toLocaleDateString('pt-BR')}`,
      '/cargos-salarios/movimentacoes',
    );
    return updated;
  }

  // Monta o conteudo textual de uma descricao (reutilizado por export DOCX e export para o GED).
  private async buildDescriptionContent(me: AuthPayload, id: string): Promise<{ title: string; code: string; text: string }> {
    const description = await this.prisma.compensationJobDescription.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: { jobCatalog: { select: { code: true, name: true } } },
    });
    if (!description) throw new NotFoundException('Descrição não encontrada');
    const title = description.jobCatalog ? `${description.jobCatalog.code} - ${description.jobCatalog.name}` : 'Descrição de cargo';
    const sections: Array<[string, string | null]> = [
      ['Missão do cargo', description.mission],
      ['Principais responsabilidades', description.responsibilities],
      ['Atividades detalhadas', description.detailedActivities],
      ['Entregas esperadas', description.expectedDeliverables],
      ['Competências técnicas', description.technicalSkills],
      ['Competências comportamentais', description.behavioralSkills],
      ['Conhecimentos', description.knowledge],
      ['Ferramentas e sistemas', description.tools],
      ['Formação mínima', description.minimumEducation],
      ['Formação desejada', description.desiredEducation],
      ['Experiência exigida', description.requiredExperience],
      ['Cursos exigidos', description.requiredCourses],
      ['Certificações', description.certifications],
      ['Requisitos legais', description.legalRequirements],
      ['Superior imediato', description.immediateSuperior],
      ['Subordinados diretos', description.directReports],
      ['Nível de autonomia', description.autonomyLevel],
      ['Ambiente de trabalho', description.workEnvironment],
      ['Interfaces internas', description.internalInterfaces],
      ['Interfaces externas', description.externalInterfaces],
      ['Riscos ocupacionais', description.occupationalRisks],
      ['EPIs', description.epis],
      ['Observações', description.notes],
    ];
    const lines: string[] = [title, `Versão ${description.version} · ${description.status}`, ''];
    for (const [label, value] of sections) {
      if (value && value.trim()) lines.push(label.toUpperCase(), value, '');
    }
    return { title, code: description.jobCatalog?.code ?? id, text: lines.join('\n') };
  }

  async descriptionDocx(me: AuthPayload, id: string): Promise<{ filename: string; buffer: Buffer }> {
    const { code, text } = await this.buildDescriptionContent(me, id);
    await this.audit(me, 'EXPORT', 'CompensationJobDescription', id, null, { format: 'docx' }, code);
    return { filename: `descricao-${code}.docx`, buffer: buildDocx(text) };
  }

  // Exporta a descricao como documento controlado no GED, onde pode ser editado online
  // (Collabora/WOPI) pelo fluxo de liberacao do proprio modulo de documentos.
  async exportDescriptionToGed(me: AuthPayload, id: string): Promise<{ documentId: string; code: string | null }> {
    const { title, text } = await this.buildDescriptionContent(me, id);
    const doc = await this.documents.create(me, {
      title: `Descrição de cargo - ${title}`,
      content: text,
      changeNote: 'Gerado a partir do módulo Cargos e Salários',
    });
    await this.audit(me, 'EXPORT_GED', 'CompensationJobDescription', id, null, { documentId: doc.id, code: doc.code }, title);
    return { documentId: doc.id, code: doc.code };
  }

  async listCycles(me: AuthPayload, query: Record<string, string | undefined>) {
    await this.ensureBaseline(me);
    return this.prisma.compensationCycle.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.referencePeriod ? { referencePeriod: query.referencePeriod } : {}),
      },
      orderBy: [{ referencePeriod: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createCycle(me: AuthPayload, body: Record<string, unknown>) {
    const data = {
      companyId: me.companyId,
      name: requiredString(body.name, 'Nome do ciclo obrigatório'),
      referencePeriod: requiredString(body.referencePeriod, 'Período de referência obrigatório'),
      criteria: cleanString(body.criteria),
      guidelinePercent: ratioValue(body.guidelinePercent),
      totalBudget: money(body.totalBudget),
      areaBudgets: jsonValue(body.areaBudgets),
      calendar: jsonValue(body.calendar),
      workflow: jsonValue(body.workflow),
      eligibilityRules: jsonValue(body.eligibilityRules),
      status: optionalString(body.status) ?? 'DRAFT',
      createdById: me.sub,
      updatedById: me.sub,
    };
    const created = await this.prisma.compensationCycle.create({ data });
    await this.audit(me, 'CYCLE_CREATED', 'CompensationCycle', created.id, null, created, created.name);
    return created;
  }

  async updateCycle(me: AuthPayload, id: string, body: Record<string, unknown>) {
    const before = await this.prisma.compensationCycle.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!before) throw new NotFoundException('Ciclo não encontrado');
    // Atualiza apenas os campos enviados (permite salvar somente a matriz no workflow).
    const data: Prisma.CompensationCycleUpdateInput = { updatedById: me.sub };
    if (body.name !== undefined) data.name = requiredString(body.name, 'Nome do ciclo obrigatório');
    if (body.referencePeriod !== undefined) data.referencePeriod = requiredString(body.referencePeriod, 'Período de referência obrigatório');
    if (body.criteria !== undefined) data.criteria = cleanString(body.criteria);
    if (body.guidelinePercent !== undefined) data.guidelinePercent = ratioValue(body.guidelinePercent);
    if (body.totalBudget !== undefined) data.totalBudget = money(body.totalBudget);
    if (body.areaBudgets !== undefined) data.areaBudgets = jsonValue(body.areaBudgets) ?? Prisma.JsonNull;
    if (body.calendar !== undefined) data.calendar = jsonValue(body.calendar) ?? Prisma.JsonNull;
    if (body.workflow !== undefined) data.workflow = jsonValue(body.workflow) ?? Prisma.JsonNull;
    if (body.eligibilityRules !== undefined) data.eligibilityRules = jsonValue(body.eligibilityRules) ?? Prisma.JsonNull;
    if (body.status !== undefined) data.status = optionalString(body.status) ?? before.status;
    const updated = await this.prisma.compensationCycle.update({ where: { id }, data });
    await this.audit(me, 'CYCLE_UPDATED', 'CompensationCycle', id, before, updated, updated.name);
    return updated;
  }

  async listBudgets(me: AuthPayload, query: Record<string, string | undefined>) {
    await this.ensureBaseline(me);
    return this.prisma.compensationBudget.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(query.periodRef ? { periodRef: query.periodRef } : {}),
        ...(query.orgNodeId ? { orgNodeId: query.orgNodeId } : {}),
        ...(query.costCenter ? { costCenter: query.costCenter } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ periodRef: 'desc' }, { costCenter: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createBudget(me: AuthPayload, body: Record<string, unknown>) {
    const data = {
      companyId: me.companyId,
      periodRef: requiredString(body.periodRef, 'Período obrigatório'),
      orgNodeId: cleanString(body.orgNodeId),
      costCenter: cleanString(body.costCenter),
      plannedHeadcount: intValue(body.plannedHeadcount) ?? 0,
      plannedPayroll: money(body.plannedPayroll) ?? new Prisma.Decimal(0),
      plannedBenefits: money(body.plannedBenefits) ?? new Prisma.Decimal(0),
      plannedCharges: money(body.plannedCharges) ?? new Prisma.Decimal(0),
      status: optionalString(body.status) ?? 'ACTIVE',
      createdById: me.sub,
      updatedById: me.sub,
    };
    const created = await this.prisma.compensationBudget.create({ data });
    await this.audit(me, 'BUDGET_CREATED', 'CompensationBudget', created.id, null, created, created.periodRef);
    return created;
  }

  async listSalarySurveys(me: AuthPayload, query: Record<string, string | undefined>) {
    await this.ensureBaseline(me);
    return this.prisma.compensationSalarySurvey.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(query.periodRef ? { periodRef: query.periodRef } : {}),
        ...(query.internalJobCatalogId ? { internalJobCatalogId: query.internalJobCatalogId } : {}),
        ...(query.source ? { source: query.source } : {}),
      },
      orderBy: [{ periodRef: 'desc' }, { marketJobName: 'asc' }],
    });
  }

  async createSalarySurvey(me: AuthPayload, body: Record<string, unknown>) {
    const data = {
      companyId: me.companyId,
      source: requiredString(body.source, 'Fonte da pesquisa obrigatória'),
      provider: cleanString(body.provider),
      periodRef: requiredString(body.periodRef, 'Período obrigatório'),
      region: cleanString(body.region),
      segment: cleanString(body.segment),
      companySize: cleanString(body.companySize),
      internalJobCatalogId: cleanString(body.internalJobCatalogId),
      marketJobName: requiredString(body.marketJobName, 'Cargo de mercado obrigatório'),
      minSalary: money(body.minSalary),
      medianSalary: money(body.medianSalary),
      averageSalary: money(body.averageSalary),
      percentile25: money(body.percentile25),
      percentile50: money(body.percentile50),
      percentile75: money(body.percentile75),
      percentile90: money(body.percentile90),
      benefits: jsonValue(body.benefits),
      notes: cleanString(body.notes),
      attachments: jsonValue(body.attachments),
      createdById: me.sub,
    };
    const created = await this.prisma.compensationSalarySurvey.create({ data });
    await this.audit(me, 'SALARY_SURVEY_CREATED', 'CompensationSalarySurvey', created.id, null, created, created.marketJobName);
    return created;
  }

  async listSimulations(me: AuthPayload, query: Record<string, string | undefined>) {
    await this.ensureBaseline(me);
    return this.prisma.compensationSimulation.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.scenarioType ? { scenarioType: query.scenarioType } : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createSimulation(me: AuthPayload, body: Record<string, unknown>) {
    const monthlyImpact = money(body.monthlyImpact);
    const annualImpact = money(body.annualImpact) ?? (monthlyImpact ? monthlyImpact.mul(12) : null);
    const data = {
      companyId: me.companyId,
      name: requiredString(body.name, 'Nome da simulação obrigatório'),
      scenarioType: requiredString(body.scenarioType, 'Tipo de cenário obrigatório'),
      status: optionalString(body.status) ?? 'DRAFT',
      assumptions: jsonValue(body.assumptions),
      results: jsonValue(body.results),
      monthlyImpact,
      annualImpact,
      affectedCount: intValue(body.affectedCount) ?? 0,
      movementId: cleanString(body.movementId),
      createdById: me.sub,
    };
    const created = await this.prisma.compensationSimulation.create({ data });
    await this.audit(me, 'SIMULATION_CREATED', 'CompensationSimulation', created.id, null, created, created.name);
    return created;
  }

  async approveSimulation(me: AuthPayload, id: string) {
    const before = await this.prisma.compensationSimulation.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!before) throw new NotFoundException('Simulação não encontrada');
    const updated = await this.prisma.compensationSimulation.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: me.sub, approvedAt: new Date() },
    });
    await this.audit(me, 'SIMULATION_APPROVED', 'CompensationSimulation', id, before, updated, updated.name);
    return updated;
  }

  async approvals(me: AuthPayload) {
    await this.ensureBaseline(me);
    const [movements, descriptions, salaryTables, simulations] = await Promise.all([
      this.prisma.compensationMovementRequest.findMany({
        where: { companyId: me.companyId, status: { notIn: Array.from(MOVEMENT_FINAL_STATUSES) } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 50,
      }),
      this.prisma.compensationJobDescription.findMany({
        where: { companyId: me.companyId, deletedAt: null, status: { in: ['IN_REVIEW', 'IN_APPROVAL', 'APPROVED'] } },
        include: { jobCatalog: { select: { id: true, code: true, name: true } } },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: 50,
      }),
      this.prisma.compensationSalaryTable.findMany({
        where: { companyId: me.companyId, deletedAt: null, status: { not: 'PUBLISHED' } },
        include: { ranges: true },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: 50,
      }),
      this.prisma.compensationSimulation.findMany({
        where: { companyId: me.companyId, deletedAt: null, status: { notIn: ['APPROVED', 'CANCELLED'] } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 50,
      }),
    ]);
    return { movements, descriptions, salaryTables, simulations };
  }

  async settings(me: AuthPayload) {
    const record = await this.prisma.appSetting.findUnique({
      where: { companyId_key: { companyId: me.companyId, key: COMPENSATION_SETTINGS_KEY } },
    });
    return {
      key: COMPENSATION_SETTINGS_KEY,
      settings: parseSettings(record?.value),
      updatedAt: record?.updatedAt ?? null,
    };
  }

  async saveSettings(me: AuthPayload, body: Record<string, unknown>) {
    const input = isPlainObject(body.settings) ? body.settings : body;
    const current = await this.settings(me);
    const settings = { ...current.settings, ...input };
    const saved = await this.prisma.appSetting.upsert({
      where: { companyId_key: { companyId: me.companyId, key: COMPENSATION_SETTINGS_KEY } },
      create: {
        companyId: me.companyId,
        key: COMPENSATION_SETTINGS_KEY,
        value: JSON.stringify(settings),
        valueType: 'json',
        group: MODULE_NAME,
        description: 'Configurações do módulo de Cargos e Salários',
      },
      update: {
        value: JSON.stringify(settings),
        valueType: 'json',
        group: MODULE_NAME,
        description: 'Configurações do módulo de Cargos e Salários',
        active: true,
      },
    });
    await this.audit(me, 'SETTINGS_UPDATED', 'AppSetting', saved.id, current.settings, settings, COMPENSATION_SETTINGS_KEY);
    return { key: COMPENSATION_SETTINGS_KEY, settings, updatedAt: saved.updatedAt };
  }

  async reports(me: AuthPayload) {
    await this.ensureBaseline(me);
    const [jobs, positions, descriptions, salaryTables, movements, snapshots] = await Promise.all([
      this.prisma.compensationJobCatalog.count({ where: { companyId: me.companyId, deletedAt: null } }),
      this.prisma.compensationPosition.count({ where: { companyId: me.companyId, deletedAt: null } }),
      this.prisma.compensationJobDescription.count({ where: { companyId: me.companyId, deletedAt: null } }),
      this.prisma.compensationSalaryTable.count({ where: { companyId: me.companyId, deletedAt: null } }),
      this.prisma.compensationMovementRequest.count({ where: { companyId: me.companyId } }),
      this.prisma.compensationSalarySnapshot.count({ where: { companyId: me.companyId } }),
    ]);
    return [
      { slug: 'estrutura-quadro', name: 'Estrutura organizacional e quadro atual', records: positions, exportable: true },
      { slug: 'catalogo-cargos', name: 'Catálogo de cargos', records: jobs, exportable: true },
      { slug: 'descricoes-cargos', name: 'Descrições de cargos', records: descriptions, exportable: true },
      { slug: 'tabelas-salariais', name: 'Tabelas salariais vigentes', records: salaryTables, exportable: true },
      { slug: 'enquadramento-salarial', name: 'Enquadramento salarial', records: snapshots, exportable: true },
      { slug: 'movimentacoes', name: 'Movimentações salariais', records: movements, exportable: true },
      { slug: 'auditoria', name: 'Histórico de alterações e auditoria sensível', records: 0, exportable: true },
    ];
  }

  async auditTimeline(me: AuthPayload, query: Record<string, string | undefined>) {
    return this.prisma.auditLog.findMany({
      where: {
        companyId: me.companyId,
        module: MODULE_NAME,
        ...(query.entity ? { entity: query.entity } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: intValue(query.take) ?? 100,
    });
  }

  private async ensureBaseline(me: AuthPayload) {
    const orgJobs = await this.prisma.orgJob.findMany({ where: { companyId: me.companyId, active: true }, orderBy: { name: 'asc' } });
    const existingCatalogs = await this.prisma.compensationJobCatalog.findMany({
      where: { companyId: me.companyId },
      select: { id: true, orgJobId: true, code: true },
    });
    const byOrgJob = new Map(existingCatalogs.flatMap((job) => (job.orgJobId ? [[job.orgJobId, job]] : [])));

    for (const orgJob of orgJobs) {
      if (byOrgJob.has(orgJob.id)) continue;
      const code = await this.nextJobCode(me.companyId);
      const created = await this.prisma.compensationJobCatalog.create({
        data: {
          companyId: me.companyId,
          orgJobId: orgJob.id,
          code,
          name: orgJob.name,
          summary: orgJob.description,
          status: 'ACTIVE',
          createdById: me.sub,
          updatedById: me.sub,
        },
      });
      await this.prisma.compensationJobCatalogVersion.create({
        data: {
          companyId: me.companyId,
          jobCatalogId: created.id,
          version: 1,
          snapshot: this.jobSnapshot(created),
          changeReason: 'Migração automática do organograma',
          changedById: me.sub,
        },
      });
      byOrgJob.set(orgJob.id, created);
    }

    const employees = await this.prisma.orgEmployee.findMany({ where: { companyId: me.companyId } });
    for (const employee of employees) {
      // Vagas (status VACANT) não têm currentEmployeeId — dedup pela combinação
      // orgNode+cargo, senão cada GET criaria uma posição VACANT duplicada.
      const existing = await this.prisma.compensationPosition.findFirst({
        where:
          employee.status === 'VACANT'
            ? { companyId: me.companyId, orgNodeId: employee.orgNodeId, orgJobId: employee.jobId, status: 'VACANT', deletedAt: null }
            : { companyId: me.companyId, currentEmployeeId: employee.id, deletedAt: null },
        select: { id: true },
      });
      if (existing) continue;
      const catalog = byOrgJob.get(employee.jobId);
      const status = employee.status === 'VACANT' ? 'VACANT' : employee.status === 'INACTIVE' ? 'INACTIVE' : 'OCCUPIED';
      await this.prisma.compensationPosition.create({
        data: {
          companyId: me.companyId,
          code: await this.nextPositionCode(me.companyId),
          jobCatalogId: catalog?.id,
          orgJobId: employee.jobId,
          orgNodeId: employee.orgNodeId,
          shift: employee.shift,
          band: employee.band,
          status,
          budgetStatus: employee.isBudgeted ? 'IN_BUDGET' : 'OUT_OF_BUDGET',
          currentEmployeeId: employee.status === 'VACANT' ? null : employee.id,
          activeFrom: employee.createdAt,
          createdById: me.sub,
          updatedById: me.sub,
        },
      });
    }
  }

  private async getJob(me: AuthPayload, id: string) {
    const job = await this.prisma.compensationJobCatalog.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!job) throw new NotFoundException('Cargo não encontrado');
    return job;
  }

  private async getDescription(me: AuthPayload, id: string) {
    const description = await this.prisma.compensationJobDescription.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!description) throw new NotFoundException('Descrição de cargo não encontrada');
    return description;
  }

  private async getSalaryTable(me: AuthPayload, id: string) {
    const table = await this.prisma.compensationSalaryTable.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: { ranges: true },
    });
    if (!table) throw new NotFoundException('Tabela salarial não encontrada');
    return table;
  }

  private async getMovement(me: AuthPayload, id: string) {
    const movement = await this.prisma.compensationMovementRequest.findFirst({ where: { id, companyId: me.companyId } });
    if (!movement) throw new NotFoundException('Movimentação não encontrada');
    return movement;
  }

  private async assertCompanyRef(
    delegate: { findFirst: (args: any) => Promise<{ id: string } | null> },
    companyId: string,
    id: string | null | undefined,
    message: string,
    extraWhere: Record<string, unknown> = {},
  ) {
    if (!id) return null;
    const found = await delegate.findFirst({ where: { id, companyId, ...extraWhere }, select: { id: true } });
    if (!found) throw new NotFoundException(message);
    return found.id;
  }

  private jobDataFromBody(body: Record<string, unknown>, defaults: { name?: string; code?: string }) {
    const status = cleanString(body.status);
    if (status && !JOB_STATUSES.includes(status as any)) throw new BadRequestException('Status de cargo inválido');
    return {
      code: defaults.code ?? optionalString(body.code),
      name: defaults.name ?? optionalString(body.name),
      summary: cleanString(body.summary),
      family: cleanString(body.family),
      careerTrack: cleanString(body.careerTrack),
      hierarchyLevel: cleanString(body.hierarchyLevel),
      grade: cleanString(body.grade),
      salaryBand: cleanString(body.salaryBand),
      cbo: cleanString(body.cbo),
      jobType: optionalString(body.jobType),
      defaultOrgNodeId: cleanString(body.defaultOrgNodeId),
      defaultCostCenter: cleanString(body.defaultCostCenter),
      managerUserId: cleanString(body.managerUserId),
      unionCategory: cleanString(body.unionCategory),
      workSchedule: cleanString(body.workSchedule),
      shift: cleanString(body.shift),
      modality: cleanString(body.modality),
      criticality: cleanString(body.criticality),
      status: status ? status : undefined,
      effectiveFrom: optionalDate(body.effectiveFrom),
    };
  }

  private descriptionDataFromBody(body: Record<string, unknown>) {
    return {
      mission: cleanString(body.mission),
      responsibilities: cleanString(body.responsibilities),
      detailedActivities: cleanString(body.detailedActivities),
      expectedDeliverables: cleanString(body.expectedDeliverables),
      relatedIndicators: jsonValue(body.relatedIndicators),
      technicalSkills: cleanString(body.technicalSkills),
      behavioralSkills: cleanString(body.behavioralSkills),
      minimumEducation: cleanString(body.minimumEducation),
      desiredEducation: cleanString(body.desiredEducation),
      requiredExperience: cleanString(body.requiredExperience),
      requiredCourses: cleanString(body.requiredCourses),
      certifications: cleanString(body.certifications),
      knowledge: cleanString(body.knowledge),
      tools: cleanString(body.tools),
      occupationalRisks: cleanString(body.occupationalRisks),
      epis: cleanString(body.epis),
      legalRequirements: cleanString(body.legalRequirements),
      workSchedule: cleanString(body.workSchedule),
      workEnvironment: cleanString(body.workEnvironment),
      autonomyLevel: cleanString(body.autonomyLevel),
      directReports: cleanString(body.directReports),
      immediateSuperior: cleanString(body.immediateSuperior),
      internalInterfaces: cleanString(body.internalInterfaces),
      externalInterfaces: cleanString(body.externalInterfaces),
      notes: cleanString(body.notes),
      attachments: jsonValue(body.attachments),
      evidences: jsonValue(body.evidences),
      approverIds: arrayValue(body.approverIds).map(String),
    };
  }

  private async createRange(tx: Pick<PrismaService, 'compensationSalaryRange'>, me: AuthPayload, salaryTableId: string, body: Record<string, unknown>) {
    // Modelo simplificado: um único salário por cargo+faixa (body.salary). O legado
    // com mínimo/médio/máximo continua aceito por compatibilidade. Quando vem só o
    // valor único, gravamos min = médio = máx = valor (as telas de equidade/compa-ratio
    // continuam funcionando usando o médio).
    const single = body.salary ?? body.value;
    const hasSingle = single != null && single !== '';
    const minSalary = requiredMoney(hasSingle ? single : body.minSalary, 'Salário obrigatório');
    const midpointSalary = hasSingle ? minSalary : requiredMoney(body.midpointSalary, 'Ponto médio obrigatório');
    const maxSalary = hasSingle ? minSalary : requiredMoney(body.maxSalary, 'Salário máximo obrigatório');
    if (minSalary.gt(midpointSalary) || midpointSalary.gt(maxSalary)) {
      throw new BadRequestException('Faixa salarial inválida: mínimo <= médio <= máximo');
    }
    return tx.compensationSalaryRange.create({
      data: {
        companyId: me.companyId,
        salaryTableId,
        jobCatalogId: cleanString(body.jobCatalogId),
        orgJobId: cleanString(body.orgJobId),
        family: cleanString(body.family),
        grade: cleanString(body.grade),
        level: cleanString(body.level),
        band: requiredString(body.band, 'Faixa obrigatória'),
        step: cleanString(body.step),
        minSalary,
        midpointSalary,
        maxSalary,
        amplitude: midpointSalary.gt(0) ? maxSalary.minus(minSalary).div(midpointSalary) : null,
        levelPercent: money(body.levelPercent),
        benefits: jsonValue(body.benefits),
        notes: cleanString(body.notes),
      },
    });
  }

  private classifyEmployeeSalary(employee: { id: string; orgNode?: { name: string } | null }, snapshot?: any) {
    const range = snapshot?.salaryRange;
    if (!snapshot) return { employeeId: employee.id, areaName: employee.orgNode?.name ?? 'Sem área', situation: 'PENDENTE_ANALISE', compaRatio: null, positioningPercent: null };
    if (!range) return { employeeId: employee.id, areaName: employee.orgNode?.name ?? 'Sem área', situation: 'SEM_TABELA', compaRatio: null, positioningPercent: null };
    const salary = toNumber(snapshot.currentSalary);
    const min = toNumber(range.minSalary);
    const mid = toNumber(range.midpointSalary);
    const max = toNumber(range.maxSalary);
    const compaRatio = mid > 0 ? salary / mid : null;
    const positioningPercent = max > min ? ((salary - min) / (max - min)) * 100 : null;
    let situation = 'DENTRO_DA_FAIXA';
    if (salary < min) situation = 'ABAIXO_DA_FAIXA';
    else if (salary > max) situation = 'ACIMA_DA_FAIXA';
    else if (compaRatio !== null && compaRatio < 0.9) situation = 'PROXIMO_AO_MINIMO';
    else if (compaRatio !== null && compaRatio < 1.05) situation = 'PROXIMO_AO_PONTO_MEDIO';
    else if (positioningPercent !== null && positioningPercent > 85) situation = 'PROXIMO_AO_TETO';
    else if (compaRatio !== null && compaRatio > 1) situation = 'ACIMA_DO_PONTO_MEDIO';
    return {
      employeeId: employee.id,
      areaName: employee.orgNode?.name ?? 'Sem área',
      situation,
      compaRatio: compaRatio === null ? null : roundRatio(compaRatio),
      positioningPercent: positioningPercent === null ? null : roundRatio(positioningPercent),
    };
  }

  private async latestSalarySnapshots(companyId: string) {
    return this.prisma.compensationSalarySnapshot.findMany({
      where: { companyId },
      include: { salaryRange: { include: { salaryTable: true } } },
      orderBy: [{ employeeId: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }

  private positionWhere(companyId: string, query: Record<string, string | undefined>) {
    return {
      companyId,
      deletedAt: null,
      ...(query.orgNodeId ? { orgNodeId: query.orgNodeId } : {}),
      ...(query.jobCatalogId ? { jobCatalogId: query.jobCatalogId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.costCenter ? { costCenter: query.costCenter } : {}),
      ...(query.shift ? { shift: query.shift } : {}),
      ...(query.band ? { band: query.band } : {}),
      ...(query.budgetStatus ? { budgetStatus: query.budgetStatus } : {}),
    };
  }

  private async createOrgJob(tx: Pick<PrismaService, 'orgJob'>, me: AuthPayload, name: string, description?: string | null) {
    const orgJob = await tx.orgJob.create({ data: { companyId: me.companyId, name, description: description ?? null } });
    return orgJob.id;
  }

  /** Espelha o CBO do catálogo no cargo operacional (OrgJob) — fonte lida pelo prontuário/eSocial. */
  private async syncOrgJobCbo(tx: Pick<PrismaService, 'orgJob'>, orgJobId: string, cbo: string | null | undefined) {
    const digits = String(cbo ?? '').replace(/\D/g, '').slice(0, 6);
    await tx.orgJob.update({ where: { id: orgJobId }, data: { cbo: digits || null } });
  }

  private async createJobVersion(tx: Pick<PrismaService, 'compensationJobCatalogVersion'>, me: AuthPayload, job: any, reason: string) {
    return tx.compensationJobCatalogVersion.create({
      data: {
        companyId: me.companyId,
        jobCatalogId: job.id,
        version: job.currentVersion,
        snapshot: this.jobSnapshot(job),
        changeReason: reason,
        changedById: me.sub,
      },
    });
  }

  private jobSnapshot(job: any) {
    return {
      code: job.code,
      name: job.name,
      summary: job.summary,
      family: job.family,
      careerTrack: job.careerTrack,
      hierarchyLevel: job.hierarchyLevel,
      grade: job.grade,
      salaryBand: job.salaryBand,
      cbo: job.cbo,
      jobType: job.jobType,
      status: job.status,
      effectiveFrom: job.effectiveFrom,
    };
  }

  private async nextJobCode(companyId: string) {
    return this.nextCode(companyId, 'CARGO', (code) => this.prisma.compensationJobCatalog.count({ where: { companyId, code } }));
  }

  private async nextPositionCode(companyId: string) {
    return this.nextCode(companyId, 'POS', (code) => this.prisma.compensationPosition.count({ where: { companyId, code } }));
  }

  private async nextSalaryTableCode(companyId: string) {
    return this.nextCode(companyId, 'TAB', (code) => this.prisma.compensationSalaryTable.count({ where: { companyId, code } }));
  }

  private async nextMovementProtocol(companyId: string) {
    const year = new Date().getFullYear();
    return this.nextCode(companyId, `MOV-${year}`, (protocol) => this.prisma.compensationMovementRequest.count({ where: { companyId, protocol } }));
  }

  private async nextCode(companyId: string, prefix: string, exists: (code: string) => Promise<number>) {
    let counter = (await this.prisma.auditLog.count({ where: { companyId, module: MODULE_NAME } })) + 1;
    for (;;) {
      const code = `${prefix}-${String(counter).padStart(4, '0')}`;
      if ((await exists(code)) === 0) return code;
      counter += 1;
    }
  }

  private async hasAnyPermission(me: AuthPayload, permissions: string[]) {
    const user = await this.prisma.user.findFirst({
      where: { id: me.sub, companyId: me.companyId },
      select: {
        role: true,
        permissions: { select: { permission: { select: { key: true } } } },
        accessProfile: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
      },
    });
    if (!user) return false;
    const keys = new Set<string>();
    user.permissions.forEach((item) => keys.add(item.permission.key));
    user.accessProfile?.permissions.forEach((item) => keys.add(item.permission.key));
    if (user.role === UserRoleEnum.COMPANY_ADMIN && keys.size === 0) return true;
    return permissions.some((key) => keys.has(key) || keys.has('compensation:manage'));
  }

  private async audit(
    me: AuthPayload,
    action: string,
    entity: string,
    entityId: string | null,
    beforeValue: unknown,
    afterValue: unknown,
    recordLabel?: string | null,
    reason?: string | null,
  ) {
    await this.auditWriter.record(me, {
      action,
      module: MODULE_NAME,
      entity,
      entityId,
      message: recordLabel ?? undefined,
      payload: { route: '/cargos-salarios', reason: reason ?? null },
      before: beforeValue,
      after: afterValue,
    });
  }
}

interface ApprovalStep {
  role: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approverId?: string;
  decidedAt?: string;
  note?: string;
}

// Monta a cadeia de alcadas a partir do corpo (array de strings de papel ou objetos).
// Sem entrada valida, usa uma unica alcada de RH (compatibilidade com o fluxo anterior).
function buildApprovalSteps(raw: unknown): ApprovalStep[] {
  const arr = Array.isArray(raw) ? raw : null;
  if (!arr || arr.length === 0) return [{ role: 'RH', status: 'PENDING' }];
  const steps = arr
    .map((item): ApprovalStep | null => {
      if (typeof item === 'string') {
        const role = item.trim();
        return role ? { role, status: 'PENDING' } : null;
      }
      if (item && typeof item === 'object') {
        const role = String((item as Record<string, unknown>).role ?? '').trim();
        return role ? { role, status: 'PENDING' } : null;
      }
      return null;
    })
    .filter((step): step is ApprovalStep => step !== null);
  return steps.length ? steps : [{ role: 'RH', status: 'PENDING' }];
}

// Le a cadeia gravada (Json) de forma resiliente, sem chaves undefined.
function normalizeApprovalSteps(raw: unknown): ApprovalStep[] {
  const arr = Array.isArray(raw) ? raw : null;
  if (!arr || arr.length === 0) return [{ role: 'RH', status: 'PENDING' }];
  return arr.map((item) => {
    const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const step: ApprovalStep = {
      role: String(obj.role ?? 'RH'),
      status: (['PENDING', 'APPROVED', 'REJECTED'].includes(String(obj.status)) ? String(obj.status) : 'PENDING') as ApprovalStep['status'],
    };
    if (obj.approverId) step.approverId = String(obj.approverId);
    if (obj.decidedAt) step.decidedAt = String(obj.decidedAt);
    if (obj.note) step.note = String(obj.note);
    return step;
  });
}

function cleanString(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function optionalString(value: unknown) {
  const text = cleanString(value);
  return text === null ? undefined : text;
}

function requiredString(value: unknown, message: string) {
  const text = cleanString(value);
  if (!text) throw new BadRequestException(message);
  return text;
}

function optionalDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Data inválida');
  return date;
}

function requiredDate(value: unknown, message: string) {
  const date = optionalDate(value);
  if (!date) throw new BadRequestException(message);
  return date;
}

function intValue(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isInteger(number)) throw new BadRequestException('Número inteiro inválido');
  return number;
}

function money(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new BadRequestException('Valor monetário inválido');
  return new Prisma.Decimal(number);
}

function ratioValue(value: unknown) {
  const decimal = money(value);
  if (!decimal) return null;
  return decimal.gt(1) ? decimal.div(100) : decimal;
}

function requiredMoney(value: unknown, message: string) {
  const decimal = money(value);
  if (!decimal) throw new BadRequestException(message);
  return decimal;
}

function percentageChange(current: Prisma.Decimal | null, proposed: Prisma.Decimal | null) {
  if (!current || !proposed || current.equals(0)) return null;
  return proposed.minus(current).div(current);
}

function jsonValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function stringify(value: unknown) {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseSettings(value: string | null | undefined) {
  if (!value) return { ...DEFAULT_COMPENSATION_SETTINGS };
  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? { ...DEFAULT_COMPENSATION_SETTINGS, ...parsed } : { ...DEFAULT_COMPENSATION_SETTINGS };
  } catch {
    return { ...DEFAULT_COMPENSATION_SETTINGS };
  }
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value);
}

function moneyOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  return roundMoney(toNumber(value));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number) {
  return Math.round(value * 10000) / 10000;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return roundRatio(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function currentPeriodRef() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function periodWindow(periodRef: string) {
  const [year, month] = periodRef.split('-').map(Number);
  if (!year || !month) return undefined;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { gte: start, lt: end };
}

// ------------------------- helpers de equidade ------------------------------

const GENDER_VALUES = new Set(['FEMININO', 'MASCULINO', 'NAO_BINARIO', 'NAO_INFORMADO']);
const GENDER_ALIASES: Record<string, string> = {
  F: 'FEMININO',
  FEM: 'FEMININO',
  FEMININO: 'FEMININO',
  MULHER: 'FEMININO',
  M: 'MASCULINO',
  MASC: 'MASCULINO',
  MASCULINO: 'MASCULINO',
  HOMEM: 'MASCULINO',
  'NAO-BINARIO': 'NAO_BINARIO',
  'NÃO-BINÁRIO': 'NAO_BINARIO',
  NB: 'NAO_BINARIO',
};

function normalizeGender(value: unknown): string | null {
  const raw = cleanString(value);
  if (!raw) return null;
  const key = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_');
  const normalized = GENDER_ALIASES[key] ?? key;
  if (!GENDER_VALUES.has(normalized)) throw new BadRequestException(`Gênero inválido: ${raw}`);
  return normalized;
}

/** Rating de desempenho 1..4 (espelha PERFORMANCE_LEVELS do frontend). */
function normalizeRating(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 4) {
    throw new BadRequestException('Rating de desempenho deve ser um inteiro de 1 a 4.');
  }
  return number;
}

function monthsSince(date: Date | string | null): number | null {
  if (!date) return null;
  const from = new Date(date);
  if (Number.isNaN(from.getTime())) return null;
  const months = (Date.now() - from.getTime()) / (30.44 * 86_400_000);
  return months >= 0 ? Math.floor(months) : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** Heurística de liderança a partir do catálogo (nível hierárquico/trilha). */
function isLeadershipJob(catalog: { hierarchyLevel: string | null; careerTrack: string | null } | null): boolean {
  const text = `${catalog?.hierarchyLevel ?? ''} ${catalog?.careerTrack ?? ''}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return /gest|geren|coorden|diretor|superv|lider|chef|executiv/.test(text);
}

interface EquityMemberInput {
  gender: string;
  salary: number | null;
  tenureMonths: number | null;
}

/**
 * Estatísticas de equidade de um grupo. `gapMedianPct`/`gapMeanPct` = razão
 * mulher/homem - 1 (negativo = mulheres ganham menos), no padrão do Relatório
 * de Transparência Salarial. Suprime valores quando qualquer gênero tem menos
 * de 3 pessoas com salário (privacidade/LGPD) ou quando mascarado.
 */
function equityGroupStats(label: string, members: EquityMemberInput[], canSeeValues: boolean) {
  const women = members.filter((member) => member.gender === 'FEMININO');
  const men = members.filter((member) => member.gender === 'MASCULINO');
  const womenSalaries = women.map((member) => member.salary).filter((v): v is number => v !== null);
  const menSalaries = men.map((member) => member.salary).filter((v): v is number => v !== null);
  const suppressed = womenSalaries.length < 3 || menSalaries.length < 3;
  const visible = canSeeValues && !suppressed;
  const medianWomen = visible ? median(womenSalaries) : null;
  const medianMen = visible ? median(menSalaries) : null;
  const meanWomen = visible ? mean(womenSalaries) : null;
  const meanMen = visible ? mean(menSalaries) : null;
  const womenTenure = women.map((member) => member.tenureMonths).filter((v): v is number => v !== null);
  const menTenure = men.map((member) => member.tenureMonths).filter((v): v is number => v !== null);
  return {
    label,
    count: members.length,
    women: women.length,
    men: men.length,
    others: members.length - women.length - men.length,
    suppressed,
    medianWomen: medianWomen === null ? null : roundMoney(medianWomen),
    medianMen: medianMen === null ? null : roundMoney(medianMen),
    meanWomen: meanWomen === null ? null : roundMoney(meanWomen),
    meanMen: meanMen === null ? null : roundMoney(meanMen),
    gapMedianPct: medianWomen !== null && medianMen !== null && medianMen > 0 ? roundRatio((medianWomen / medianMen - 1) * 100) : null,
    gapMeanPct: meanWomen !== null && meanMen !== null && meanMen > 0 ? roundRatio((meanWomen / meanMen - 1) * 100) : null,
    avgTenureWomenMonths: womenTenure.length ? Math.round(womenTenure.reduce((a, b) => a + b, 0) / womenTenure.length) : null,
    avgTenureMenMonths: menTenure.length ? Math.round(menTenure.reduce((a, b) => a + b, 0) / menTenure.length) : null,
  };
}

function latestByEmployee<T extends { employeeId: string }>(snapshots: T[]) {
  const map = new Map<string, T>();
  for (const snapshot of snapshots) {
    if (!map.has(snapshot.employeeId)) map.set(snapshot.employeeId, snapshot);
  }
  return map;
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item) || 'Não informado';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function groupByArea(positions: Array<{ orgNodeId: string | null; status: string }>, employees: Array<{ orgNodeId: string | null; orgNode?: { name: string } | null }>) {
  const names = new Map<string, string>();
  employees.forEach((employee) => {
    if (employee.orgNodeId && employee.orgNode?.name) names.set(employee.orgNodeId, employee.orgNode.name);
  });
  const ids = new Set([...positions.map((position) => position.orgNodeId ?? 'none'), ...employees.map((employee) => employee.orgNodeId ?? 'none')]);
  return Array.from(ids).map((id) => {
    const areaPositions = positions.filter((position) => (position.orgNodeId ?? 'none') === id);
    const areaEmployees = employees.filter((employee) => (employee.orgNodeId ?? 'none') === id);
    return {
      id,
      name: id === 'none' ? 'Sem área' : names.get(id) ?? id,
      plannedPositions: areaPositions.length,
      realizedEmployees: areaEmployees.filter((employee: any) => employee.status !== 'VACANT').length,
      openPositions: areaPositions.filter((position) => POSITION_OPEN_STATUSES.has(position.status)).length,
    };
  });
}

function payrollEvolution(snapshots: Array<{ effectiveFrom: Date; currentSalary: unknown }>) {
  const groups = new Map<string, number>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.effectiveFrom.getFullYear()}-${String(snapshot.effectiveFrom.getMonth() + 1).padStart(2, '0')}`;
    groups.set(key, (groups.get(key) ?? 0) + toNumber(snapshot.currentSalary));
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([name, value]) => ({ name, value: roundMoney(value) }));
}

function averageApprovalHours(movements: Array<{ createdAt: Date; decidedAt: Date | null }>) {
  const values = movements
    .filter((movement) => movement.decidedAt)
    .map((movement) => ((movement.decidedAt as Date).getTime() - movement.createdAt.getTime()) / 36e5);
  return average(values);
}

function priorityAreas(items: Array<{ areaName: string; situation: string }>) {
  const relevant = items.filter((item) => item.situation === 'ABAIXO_DA_FAIXA' || item.situation === 'ACIMA_DA_FAIXA');
  return Object.entries(countBy(relevant, (item) => item.areaName))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}
