import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';

const MODULE_NAME = 'Cargos e Salarios';

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
  constructor(private readonly prisma: PrismaService) {}

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
    const [jobs, employees, careerPaths, positions] = await Promise.all([
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
    ]);
    return { jobs, employees, careerPaths, positions };
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
    const name = requiredString(body.name, 'Nome do cargo e obrigatorio');
    const duplicate = await this.prisma.compensationJobCatalog.findFirst({
      where: { companyId: me.companyId, name: { equals: name, mode: 'insensitive' }, deletedAt: null },
    });
    if (duplicate) throw new ConflictException('Ja existe cargo com este nome');
    const code = cleanString(body.code) || (await this.nextJobCode(me.companyId));
    const data = this.jobDataFromBody(body, {});

    const created = await this.prisma.$transaction(async (tx) => {
      const orgJobId = cleanString(body.orgJobId) || (await this.createOrgJob(tx, me, name, cleanString(body.summary)));
      const job = await tx.compensationJobCatalog.create({
        data: { ...data, companyId: me.companyId, orgJobId, code, name, createdById: me.sub, updatedById: me.sub },
      });
      await this.createJobVersion(tx, me, job, 'Criacao do cargo');
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
      if (duplicate) throw new ConflictException('Ja existe cargo com este nome');
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
      await this.createJobVersion(tx, me, job, reason || 'Nova versao');
      return job;
    });
    await this.audit(me, 'VERSION', 'CompensationJobCatalog', id, before, updated, updated.name, reason);
    return updated;
  }

  async inactivateJob(me: AuthPayload, id: string, reason: string) {
    if (!reason.trim()) throw new BadRequestException('Justificativa obrigatoria para inativar cargo');
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
    const jobCatalogId = requiredString(body.jobCatalogId, 'Cargo obrigatorio');
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
    await this.audit(me, 'CREATE', 'CompensationJobDescription', created.id, null, created, `Descricao ${created.version}`);
    return created;
  }

  async updateDescription(me: AuthPayload, id: string, body: Record<string, unknown>) {
    const before = await this.getDescription(me, id);
    if (before.status === 'PUBLISHED') throw new ConflictException('Descricao publicada deve gerar nova versao');
    const updated = await this.prisma.compensationJobDescription.update({
      where: { id },
      data: { ...this.descriptionDataFromBody(body), updatedById: me.sub },
    });
    await this.audit(me, 'UPDATE', 'CompensationJobDescription', id, before, updated, `Descricao ${updated.version}`);
    return updated;
  }

  async changeDescriptionStatus(me: AuthPayload, id: string, status: string, reason: string) {
    const before = await this.getDescription(me, id);
    if (!DESCRIPTION_STATUSES.includes(status as any)) throw new BadRequestException('Status de descricao invalido');
    const allowed = DESCRIPTION_TRANSITIONS[before.status] ?? [];
    if (!allowed.includes(status) && before.status !== status) {
      throw new ConflictException(`Transicao de ${before.status} para ${status} nao permitida`);
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
    await this.audit(me, 'STATUS_CHANGE', 'CompensationJobDescription', id, before, updated, `Descricao ${updated.version}`, reason);
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
    const name = requiredString(body.name, 'Nome da tabela salarial e obrigatorio');
    const effectiveFrom = requiredDate(body.effectiveFrom, 'Vigencia inicial obrigatoria');
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
      throw new ConflictException('Tabela publicada nao deve ser sobrescrita. Gere nova revisao.');
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
    const created = await this.createRange(this.prisma, me, id, body);
    await this.audit(me, 'CREATE', 'CompensationSalaryRange', created.id, null, created, created.band);
    return created;
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
    const [employees, snapshots, positions] = await Promise.all([
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
    ]);
    const snapshotByEmployee = latestByEmployee(snapshots);
    const positionByEmployee = new Map(positions.flatMap((position) => (position.currentEmployeeId ? [[position.currentEmployeeId, position]] : [])));
    const rows = employees.map((employee) => {
      const snapshot = snapshotByEmployee.get(employee.id);
      const classified = this.classifyEmployeeSalary(employee, snapshot);
      const position = positionByEmployee.get(employee.id);
      const range = snapshot?.salaryRange;
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
      };
    });
    if (canSeeIndividual) {
      await this.audit(me, 'SENSITIVE_VIEW', 'CompensationSalaryFit', null, null, { count: rows.length }, 'Enquadramento salarial');
    }
    return query.situation ? rows.filter((row) => row.situation === query.situation) : rows;
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
    const type = requiredString(body.type, 'Tipo de movimentacao obrigatorio');
    const reason = requiredString(body.reason, 'Motivo obrigatorio');
    const justification = requiredString(body.justification, 'Justificativa obrigatoria');
    const effectiveAt = requiredDate(body.effectiveAt, 'Data de vigencia obrigatoria');
    const currentSalary = money(body.currentSalary);
    const proposedSalary = money(body.proposedSalary);
    const monthlyImpact = proposedSalary !== null && currentSalary !== null ? proposedSalary.minus(currentSalary) : null;
    const annualImpact = monthlyImpact ? monthlyImpact.mul(12) : null;
    const availableBudget = money(body.availableBudget);
    if (monthlyImpact && monthlyImpact.gt(0) && availableBudget && monthlyImpact.gt(availableBudget)) {
      throw new ConflictException('Orcamento insuficiente para a movimentacao');
    }
    const status = monthlyImpact && monthlyImpact.gt(0) && !availableBudget ? 'PENDING_BUDGET' : 'REQUESTED';
    const protocol = await this.nextMovementProtocol(me.companyId);
    const created = await this.prisma.compensationMovementRequest.create({
      data: {
        companyId: me.companyId,
        protocol,
        type,
        employeeId: cleanString(body.employeeId),
        currentPositionId: cleanString(body.currentPositionId),
        targetPositionId: cleanString(body.targetPositionId),
        currentJobId: cleanString(body.currentJobId),
        targetJobId: cleanString(body.targetJobId),
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
        managerUserId: cleanString(body.managerUserId),
        status,
        approvalSteps: jsonValue(body.approvalSteps) ?? [{ status: 'PENDING', role: 'RH' }],
        attachments: jsonValue(body.attachments),
        evidences: jsonValue(body.evidences),
        notes: cleanString(body.notes),
      },
    });
    await this.audit(me, 'MOVEMENT_REQUESTED', 'CompensationMovementRequest', created.id, null, created, created.protocol, justification);
    return created;
  }

  async decideMovement(me: AuthPayload, id: string, decision: 'APPROVED' | 'REJECTED', note: string) {
    const before = await this.getMovement(me, id);
    if (MOVEMENT_FINAL_STATUSES.has(before.status)) throw new ConflictException('Movimentacao ja finalizada');
    const updated = await this.prisma.compensationMovementRequest.update({
      where: { id },
      data: {
        status: decision,
        decidedAt: new Date(),
        notes: note || before.notes,
        approvalSteps: [{ status: decision, approverId: me.sub, decidedAt: new Date().toISOString(), note }],
      },
    });
    await this.audit(me, `MOVEMENT_${decision}`, 'CompensationMovementRequest', id, before, updated, updated.protocol, note);
    return updated;
  }

  async applyMovement(me: AuthPayload, id: string) {
    const before = await this.getMovement(me, id);
    if (before.status !== 'APPROVED') throw new ConflictException('Apenas movimentacoes aprovadas podem ser aplicadas');
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
        await tx.compensationPosition.update({
          where: { id: before.targetPositionId },
          data: {
            currentEmployeeId: before.employeeId ?? undefined,
            status: before.employeeId ? 'OCCUPIED' : undefined,
            updatedById: me.sub,
          },
        });
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
    return updated;
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
      { slug: 'catalogo-cargos', name: 'Catalogo de cargos', records: jobs, exportable: true },
      { slug: 'descricoes-cargos', name: 'Descricoes de cargos', records: descriptions, exportable: true },
      { slug: 'tabelas-salariais', name: 'Tabelas salariais vigentes', records: salaryTables, exportable: true },
      { slug: 'enquadramento-salarial', name: 'Enquadramento salarial', records: snapshots, exportable: true },
      { slug: 'movimentacoes', name: 'Movimentacoes salariais', records: movements, exportable: true },
      { slug: 'auditoria', name: 'Historico de alteracoes e auditoria sensivel', records: 0, exportable: true },
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
          changeReason: 'Migracao automatica do organograma',
          changedById: me.sub,
        },
      });
      byOrgJob.set(orgJob.id, created);
    }

    const employees = await this.prisma.orgEmployee.findMany({ where: { companyId: me.companyId } });
    for (const employee of employees) {
      const existing = await this.prisma.compensationPosition.findFirst({
        where: { companyId: me.companyId, currentEmployeeId: employee.id, deletedAt: null },
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
    if (!job) throw new NotFoundException('Cargo nao encontrado');
    return job;
  }

  private async getDescription(me: AuthPayload, id: string) {
    const description = await this.prisma.compensationJobDescription.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!description) throw new NotFoundException('Descricao de cargo nao encontrada');
    return description;
  }

  private async getSalaryTable(me: AuthPayload, id: string) {
    const table = await this.prisma.compensationSalaryTable.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: { ranges: true },
    });
    if (!table) throw new NotFoundException('Tabela salarial nao encontrada');
    return table;
  }

  private async getMovement(me: AuthPayload, id: string) {
    const movement = await this.prisma.compensationMovementRequest.findFirst({ where: { id, companyId: me.companyId } });
    if (!movement) throw new NotFoundException('Movimentacao nao encontrada');
    return movement;
  }

  private jobDataFromBody(body: Record<string, unknown>, defaults: { name?: string; code?: string }) {
    const status = cleanString(body.status);
    if (status && !JOB_STATUSES.includes(status as any)) throw new BadRequestException('Status de cargo invalido');
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
    const minSalary = requiredMoney(body.minSalary, 'Salario minimo obrigatorio');
    const midpointSalary = requiredMoney(body.midpointSalary, 'Ponto medio obrigatorio');
    const maxSalary = requiredMoney(body.maxSalary, 'Salario maximo obrigatorio');
    if (minSalary.gt(midpointSalary) || midpointSalary.gt(maxSalary)) {
      throw new BadRequestException('Faixa salarial invalida: minimo <= medio <= maximo');
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
        band: requiredString(body.band, 'Faixa obrigatoria'),
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
    if (!snapshot) return { employeeId: employee.id, areaName: employee.orgNode?.name ?? 'Sem area', situation: 'PENDENTE_ANALISE', compaRatio: null, positioningPercent: null };
    if (!range) return { employeeId: employee.id, areaName: employee.orgNode?.name ?? 'Sem area', situation: 'SEM_TABELA', compaRatio: null, positioningPercent: null };
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
      areaName: employee.orgNode?.name ?? 'Sem area',
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
    const user = await this.prisma.user.findUnique({
      where: { id: me.sub },
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
    await this.prisma.auditLog.create({
      data: {
        companyId: me.companyId,
        userId: me.sub,
        action,
        module: MODULE_NAME,
        entity,
        entityId,
        recordLabel: recordLabel ?? null,
        payload: stringify({ route: '/cargos-salarios', reason: reason ?? null }),
        beforeValue: stringify(beforeValue),
        afterValue: stringify(afterValue),
        result: 'SUCCESS',
      },
    });
  }
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
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Data invalida');
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
  if (!Number.isInteger(number)) throw new BadRequestException('Numero inteiro invalido');
  return number;
}

function money(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new BadRequestException('Valor monetario invalido');
  return new Prisma.Decimal(number);
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

function latestByEmployee<T extends { employeeId: string }>(snapshots: T[]) {
  const map = new Map<string, T>();
  for (const snapshot of snapshots) {
    if (!map.has(snapshot.employeeId)) map.set(snapshot.employeeId, snapshot);
  }
  return map;
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item) || 'Nao informado';
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
      name: id === 'none' ? 'Sem area' : names.get(id) ?? id,
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
