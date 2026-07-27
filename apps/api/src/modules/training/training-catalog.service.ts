import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TrainingRequirementTarget, TrainingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { TrainingMatrixService } from './training-matrix.service';

const MODULE = 'Treinamento';

/** Categorias sugeridas — criadas na primeira abertura do módulo pela empresa. */
const SEED_CATEGORIES = [
  { name: 'Segurança do Trabalho', color: '#ef4444' },
  { name: 'Qualidade', color: '#0ea5e9' },
  { name: 'Segurança dos Alimentos', color: '#10b981' },
  { name: 'Meio Ambiente', color: '#22c55e' },
  { name: 'Integração', color: '#6366f1' },
  { name: 'Operacional', color: '#f59e0b' },
  { name: 'Compliance', color: '#8b5cf6' },
  { name: 'Liderança', color: '#ec4899' },
];

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Catálogo do módulo: treinamentos, categorias, instrutores e as exigências
 * que alimentam a matriz.
 *
 * Toda alteração de exigência dispara a recomputação da matriz — é o que faz o
 * vínculo "cargo exige treinamento" virar pendência real do colaborador sem
 * ninguém precisar lançar nada à mão.
 */
@Injectable()
export class TrainingCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matrix: TrainingMatrixService,
    private readonly audit: AuditWriterService,
  ) {}

  // ==========================================================================
  // Categorias
  // ==========================================================================

  async categories(companyId: string, includeInactive = false) {
    const existing = await this.prisma.trainingCategory.findMany({
      where: { companyId, deletedAt: null, ...(includeInactive ? {} : { active: true }) },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
    if (existing.length > 0) return existing;

    await this.prisma.trainingCategory.createMany({
      data: SEED_CATEGORIES.map((category, index) => ({
        companyId,
        name: category.name,
        slug: slugify(category.name),
        color: category.color,
        position: index,
      })),
      skipDuplicates: true,
    });
    return this.prisma.trainingCategory.findMany({
      where: { companyId, deletedAt: null, active: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(me: AuthPayload, body: { name?: string; color?: string }) {
    const name = String(body?.name ?? '').trim();
    if (!name) throw new BadRequestException('Informe o nome da categoria.');
    const slug = slugify(name);
    const clash = await this.prisma.trainingCategory.findFirst({ where: { companyId: me.companyId, slug } });
    if (clash) {
      if (clash.deletedAt || !clash.active) {
        return this.prisma.trainingCategory.update({
          where: { id: clash.id },
          data: { deletedAt: null, active: true, name, color: body.color ?? clash.color },
        });
      }
      throw new BadRequestException('Já existe uma categoria com esse nome.');
    }
    const created = await this.prisma.trainingCategory.create({
      data: { companyId: me.companyId, name, slug, color: body.color ?? null },
    });
    await this.audit.record(me, { action: 'CREATE', module: MODULE, entity: 'TrainingCategory', entityId: created.id, message: name });
    return created;
  }

  // ==========================================================================
  // Instrutores
  // ==========================================================================

  async instructors(companyId: string) {
    return this.prisma.trainingInstructor.findMany({
      where: { companyId, deletedAt: null, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, institution: true, email: true, external: true, userId: true },
    });
  }

  async createInstructor(me: AuthPayload, body: { name?: string; userId?: string; institution?: string; email?: string }) {
    const name = String(body?.name ?? '').trim();
    if (!name) throw new BadRequestException('Informe o nome do instrutor.');
    if (body.userId) {
      const user = await this.prisma.user.findFirst({ where: { id: body.userId, companyId: me.companyId }, select: { id: true } });
      if (!user) throw new BadRequestException('Usuário informado não pertence à empresa.');
    }
    const created = await this.prisma.trainingInstructor.create({
      data: {
        companyId: me.companyId,
        name,
        userId: body.userId || null,
        institution: body.institution?.trim() || null,
        email: body.email?.trim() || null,
        external: !body.userId,
      },
    });
    await this.audit.record(me, { action: 'CREATE', module: MODULE, entity: 'TrainingInstructor', entityId: created.id, message: name });
    return created;
  }

  // ==========================================================================
  // Treinamentos
  // ==========================================================================

  async listTrainings(companyId: string, query: { search?: string; status?: string; categoryId?: string; modality?: string }) {
    const where: Prisma.TrainingWhereInput = { companyId, deletedAt: null };
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (query.status && Object.values(TrainingStatus).includes(query.status as TrainingStatus)) {
      where.status = query.status as TrainingStatus;
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.modality) where.modality = query.modality as any;

    const rows = await this.prisma.training.findMany({
      where,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        category: { select: { id: true, name: true, color: true } },
        document: { select: { id: true, code: true, title: true, version: true } },
        defaultInstructor: { select: { id: true, name: true } },
        _count: { select: { requirements: true, assignments: true, classes: true } },
      },
      take: 500,
    });
    return rows.map((row) => this.toTraining(row));
  }

  async getTraining(companyId: string, id: string) {
    const training = await this.prisma.training.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, color: true } },
        document: { select: { id: true, code: true, title: true, version: true, validUntil: true } },
        defaultInstructor: { select: { id: true, name: true } },
        _count: { select: { requirements: true, assignments: true, classes: true } },
      },
    });
    if (!training) throw new NotFoundException('Treinamento não encontrado.');
    return this.toTraining(training);
  }

  async createTraining(me: AuthPayload, body: any) {
    const data = await this.buildTrainingData(me.companyId, body, true);
    const created = await this.prisma.training.create({
      data: { ...data, companyId: me.companyId, createdById: me.sub } as Prisma.TrainingUncheckedCreateInput,
      select: { id: true, name: true },
    });
    await this.audit.record(me, { action: 'CREATE', module: MODULE, entity: 'Training', entityId: created.id, message: created.name });
    return this.getTraining(me.companyId, created.id);
  }

  async updateTraining(me: AuthPayload, id: string, body: any) {
    const current = await this.prisma.training.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!current) throw new NotFoundException('Treinamento não encontrado.');
    const data = await this.buildTrainingData(me.companyId, body, false, id);
    await this.prisma.training.update({ where: { id }, data });
    await this.audit.record(me, {
      action: 'UPDATE',
      module: MODULE,
      entity: 'Training',
      entityId: id,
      message: current.name,
      before: { status: current.status, validityKind: current.validityKind, validityValue: current.validityValue },
      after: { status: data.status, validityKind: data.validityKind, validityValue: data.validityValue },
    });
    // Mudou validade/prazo/documento: a matriz precisa refletir.
    await this.matrix.refreshValidityStatuses(me.companyId);
    return this.getTraining(me.companyId, id);
  }

  /** Inativa em vez de excluir: treinamento com histórico não pode sumir. */
  async archiveTraining(me: AuthPayload, id: string) {
    const training = await this.prisma.training.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: { _count: { select: { assignments: true } } },
    });
    if (!training) throw new NotFoundException('Treinamento não encontrado.');

    if (training._count.assignments > 0) {
      await this.prisma.training.update({ where: { id }, data: { status: TrainingStatus.INACTIVE } });
      await this.prisma.trainingRequirement.updateMany({ where: { trainingId: id }, data: { active: false } });
      await this.audit.record(me, { action: 'DEACTIVATE', module: MODULE, entity: 'Training', entityId: id, message: training.name });
      await this.matrix.recomputeCompany(me.companyId, 'MATRIX_CHANGED');
      return { deactivated: true, assignments: training._count.assignments };
    }

    await this.prisma.training.update({ where: { id }, data: { deletedAt: new Date(), status: TrainingStatus.INACTIVE } });
    await this.audit.record(me, { action: 'DELETE', module: MODULE, entity: 'Training', entityId: id, message: training.name });
    return { deleted: true };
  }

  // ==========================================================================
  // Exigências (matriz por cargo / área / empresa / pessoa)
  // ==========================================================================

  async listRequirements(companyId: string, query: { trainingId?: string; target?: string; targetId?: string }) {
    const where: Prisma.TrainingRequirementWhereInput = { companyId, deletedAt: null };
    if (query.trainingId) where.trainingId = query.trainingId;
    if (query.target) where.target = query.target as TrainingRequirementTarget;
    if (query.targetId) where.targetId = query.targetId;

    const rows = await this.prisma.trainingRequirement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        training: { select: { id: true, code: true, name: true, modality: true } },
        originDocument: { select: { id: true, code: true, title: true, version: true } },
        _count: { select: { assignments: true } },
      },
      take: 500,
    });
    return this.decorateRequirements(companyId, rows);
  }

  async createRequirement(me: AuthPayload, body: any) {
    const target = body?.target as TrainingRequirementTarget;
    if (!target || !Object.values(TrainingRequirementTarget).includes(target)) {
      throw new BadRequestException('Informe a quem a exigência se aplica.');
    }
    const targetId = target === TrainingRequirementTarget.ALL_COMPANY ? null : String(body?.targetId ?? '').trim() || null;
    if (target !== TrainingRequirementTarget.ALL_COMPANY && !targetId) {
      throw new BadRequestException('Informe o cargo, a área ou o colaborador da exigência.');
    }
    await this.assertTarget(me.companyId, target, targetId);

    const training = await this.prisma.training.findFirst({
      where: { id: String(body?.trainingId ?? ''), companyId: me.companyId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!training) throw new BadRequestException('Treinamento inválido.');

    const clash = await this.prisma.trainingRequirement.findFirst({
      where: { trainingId: training.id, target, targetId },
    });
    if (clash) {
      if (clash.deletedAt || !clash.active) {
        await this.prisma.trainingRequirement.update({ where: { id: clash.id }, data: { active: true, deletedAt: null } });
        await this.matrix.recomputeCompany(me.companyId, 'MATRIX_CHANGED');
        return this.getRequirement(me.companyId, clash.id);
      }
      throw new BadRequestException('Esta exigência já existe para o público informado.');
    }

    const created = await this.prisma.trainingRequirement.create({
      data: {
        companyId: me.companyId,
        trainingId: training.id,
        target,
        targetId,
        mandatory: body.mandatory !== false,
        admissionDeadlineDays: this.toInt(body.admissionDeadlineDays),
        movementDeadlineDays: this.toInt(body.movementDeadlineDays),
        validityKind: body.validityKind || null,
        validityValue: this.toInt(body.validityValue),
        originDocumentId: body.originDocumentId || null,
        originRiskId: body.originRiskId || null,
        originProcessId: body.originProcessId || null,
        originNonConformityId: body.originNonConformityId || null,
        originAuditId: body.originAuditId || null,
        activity: body.activity?.trim() || null,
        justification: body.justification?.trim() || null,
        blocksOperation: Boolean(body.blocksOperation),
        createdById: me.sub,
      },
      select: { id: true },
    });

    await this.audit.record(me, {
      action: 'CREATE',
      module: MODULE,
      entity: 'TrainingRequirement',
      entityId: created.id,
      message: `${training.name} → ${target}`,
    });
    // A exigência nasce valendo: gera as pendências agora.
    await this.matrix.recomputeCompany(me.companyId, 'MATRIX_CHANGED');
    return this.getRequirement(me.companyId, created.id);
  }

  async updateRequirement(me: AuthPayload, id: string, body: any) {
    const current = await this.prisma.trainingRequirement.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!current) throw new NotFoundException('Exigência não encontrada.');

    await this.prisma.trainingRequirement.update({
      where: { id },
      data: {
        ...(body.mandatory !== undefined ? { mandatory: Boolean(body.mandatory) } : {}),
        ...(body.admissionDeadlineDays !== undefined ? { admissionDeadlineDays: this.toInt(body.admissionDeadlineDays) } : {}),
        ...(body.movementDeadlineDays !== undefined ? { movementDeadlineDays: this.toInt(body.movementDeadlineDays) } : {}),
        ...(body.validityKind !== undefined ? { validityKind: body.validityKind || null } : {}),
        ...(body.validityValue !== undefined ? { validityValue: this.toInt(body.validityValue) } : {}),
        ...(body.activity !== undefined ? { activity: body.activity?.trim() || null } : {}),
        ...(body.justification !== undefined ? { justification: body.justification?.trim() || null } : {}),
        ...(body.blocksOperation !== undefined ? { blocksOperation: Boolean(body.blocksOperation) } : {}),
        ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
      },
    });
    await this.audit.record(me, { action: 'UPDATE', module: MODULE, entity: 'TrainingRequirement', entityId: id, before: current });
    await this.matrix.recomputeCompany(me.companyId, 'MATRIX_CHANGED');
    return this.getRequirement(me.companyId, id);
  }

  async removeRequirement(me: AuthPayload, id: string) {
    const current = await this.prisma.trainingRequirement.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!current) throw new NotFoundException('Exigência não encontrada.');
    await this.prisma.trainingRequirement.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
    await this.audit.record(me, { action: 'DELETE', module: MODULE, entity: 'TrainingRequirement', entityId: id });
    // Encerra as pendências que só existiam por causa desta regra.
    await this.matrix.recomputeCompany(me.companyId, 'MATRIX_CHANGED');
    return { deleted: true };
  }

  async getRequirement(companyId: string, id: string) {
    const row = await this.prisma.trainingRequirement.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        training: { select: { id: true, code: true, name: true, modality: true } },
        originDocument: { select: { id: true, code: true, title: true, version: true } },
        _count: { select: { assignments: true } },
      },
    });
    if (!row) throw new NotFoundException('Exigência não encontrada.');
    const [decorated] = await this.decorateRequirements(companyId, [row]);
    return decorated;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /** Resolve o nome do público (cargo/área/colaborador) em lote — evita N+1. */
  private async decorateRequirements(companyId: string, rows: any[]) {
    const jobIds = rows.filter((r) => r.target === 'JOB' && r.targetId).map((r) => r.targetId);
    const nodeIds = rows.filter((r) => r.target === 'ORG_NODE' && r.targetId).map((r) => r.targetId);
    const employeeIds = rows.filter((r) => r.target === 'EMPLOYEE' && r.targetId).map((r) => r.targetId);

    const [jobs, nodes, employees] = await Promise.all([
      jobIds.length ? this.prisma.orgJob.findMany({ where: { id: { in: jobIds }, companyId }, select: { id: true, name: true } }) : [],
      nodeIds.length ? this.prisma.orgNode.findMany({ where: { id: { in: nodeIds }, companyId }, select: { id: true, name: true, type: true } }) : [],
      employeeIds.length ? this.prisma.orgEmployee.findMany({ where: { id: { in: employeeIds }, companyId }, select: { id: true, name: true } }) : [],
    ]);
    const jobById = new Map(jobs.map((j) => [j.id, j.name]));
    const nodeById = new Map(nodes.map((n) => [n.id, n.name]));
    const employeeById = new Map(employees.map((e) => [e.id, e.name]));

    return rows.map((row) => ({
      id: row.id,
      trainingId: row.trainingId,
      training: row.training,
      target: row.target,
      targetId: row.targetId,
      targetLabel:
        row.target === 'ALL_COMPANY'
          ? 'Toda a empresa'
          : row.target === 'JOB'
            ? jobById.get(row.targetId) ?? 'Cargo'
            : row.target === 'ORG_NODE'
              ? nodeById.get(row.targetId) ?? 'Área'
              : employeeById.get(row.targetId) ?? 'Colaborador',
      mandatory: row.mandatory,
      admissionDeadlineDays: row.admissionDeadlineDays,
      movementDeadlineDays: row.movementDeadlineDays,
      validityKind: row.validityKind,
      validityValue: row.validityValue,
      originDocument: row.originDocument,
      activity: row.activity,
      justification: row.justification,
      blocksOperation: row.blocksOperation,
      active: row.active,
      assignments: row._count?.assignments ?? 0,
      createdAt: row.createdAt,
    }));
  }

  private async assertTarget(companyId: string, target: TrainingRequirementTarget, targetId: string | null) {
    if (!targetId) return;
    if (target === TrainingRequirementTarget.JOB) {
      const job = await this.prisma.orgJob.findFirst({ where: { id: targetId, companyId }, select: { id: true } });
      if (!job) throw new BadRequestException('Cargo não encontrado nesta empresa.');
    }
    if (target === TrainingRequirementTarget.ORG_NODE) {
      const node = await this.prisma.orgNode.findFirst({ where: { id: targetId, companyId, deletedAt: null }, select: { id: true } });
      if (!node) throw new BadRequestException('Área não encontrada nesta empresa.');
    }
    if (target === TrainingRequirementTarget.EMPLOYEE) {
      const employee = await this.prisma.orgEmployee.findFirst({ where: { id: targetId, companyId }, select: { id: true } });
      if (!employee) throw new BadRequestException('Colaborador não encontrado nesta empresa.');
    }
  }

  private async buildTrainingData(companyId: string, body: any, isCreate: boolean, currentId?: string) {
    const name = String(body?.name ?? '').trim();
    if (isCreate && !name) throw new BadRequestException('Informe o nome do treinamento.');

    let code = String(body?.code ?? '').trim().toUpperCase();
    if (isCreate) {
      if (!code) code = await this.nextCode(companyId);
      const clash = await this.prisma.training.findFirst({ where: { companyId, code } });
      if (clash) throw new BadRequestException(`Já existe um treinamento com o código ${code}.`);
    }

    if (body.documentId) {
      const document = await this.prisma.document.findFirst({
        where: { id: body.documentId, companyId, deletedAt: null },
        select: { id: true, version: true },
      });
      if (!document) throw new BadRequestException('Documento do GED não encontrado nesta empresa.');
      // A revisão treinada acompanha a versão publicada no momento do vínculo.
      body.documentVersion = document.version;
    }

    const workload = this.toInt(body.workloadMinutes);
    if (workload !== null && workload <= 0) throw new BadRequestException('A carga horária deve ser maior que zero.');

    const minimumScore = body.minimumScore === undefined || body.minimumScore === null || body.minimumScore === ''
      ? undefined
      : new Prisma.Decimal(Number(body.minimumScore));
    if (minimumScore && (minimumScore.lessThan(0) || minimumScore.greaterThan(100))) {
      throw new BadRequestException('A nota mínima deve estar entre 0 e 100.');
    }

    return {
      ...(isCreate ? { code } : {}),
      ...(name || isCreate ? { name } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId || null } : {}),
      ...(body.modality !== undefined ? { modality: body.modality } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(workload !== null ? { workloadMinutes: workload } : {}),
      ...(body.validityKind !== undefined ? { validityKind: body.validityKind } : {}),
      ...(body.validityValue !== undefined ? { validityValue: this.toInt(body.validityValue) } : {}),
      ...(body.dueSoonDays !== undefined ? { dueSoonDays: this.toInt(body.dueSoonDays) ?? 30 } : {}),
      ...(body.deadlineDays !== undefined ? { deadlineDays: this.toInt(body.deadlineDays) } : {}),
      ...(body.documentId !== undefined ? { documentId: body.documentId || null, documentVersion: body.documentVersion ?? null } : {}),
      ...(body.requiresAssessment !== undefined ? { requiresAssessment: Boolean(body.requiresAssessment) } : {}),
      ...(minimumScore !== undefined ? { minimumScore } : {}),
      ...(body.maxAttempts !== undefined ? { maxAttempts: this.toInt(body.maxAttempts) } : {}),
      ...(body.requiresAttendance !== undefined ? { requiresAttendance: Boolean(body.requiresAttendance) } : {}),
      ...(body.requiresEffectiveness !== undefined ? { requiresEffectiveness: Boolean(body.requiresEffectiveness) } : {}),
      ...(body.effectivenessDays !== undefined ? { effectivenessDays: this.toInt(body.effectivenessDays) } : {}),
      ...(body.requiresCertificate !== undefined ? { requiresCertificate: Boolean(body.requiresCertificate) } : {}),
      ...(body.allowsOnline !== undefined ? { allowsOnline: Boolean(body.allowsOnline) } : {}),
      ...(body.plannedCostCents !== undefined ? { plannedCostCents: this.toInt(body.plannedCostCents) } : {}),
      ...(body.responsibleUserId !== undefined ? { responsibleUserId: body.responsibleUserId || null } : {}),
      ...(body.defaultInstructorId !== undefined ? { defaultInstructorId: body.defaultInstructorId || null } : {}),
    } as Prisma.TrainingUncheckedUpdateInput & { code?: string; name?: string };
  }

  private async nextCode(companyId: string) {
    const count = await this.prisma.training.count({ where: { companyId } });
    return `TRN-${String(count + 1).padStart(4, '0')}`;
  }

  private toTraining(row: any) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      category: row.category,
      modality: row.modality,
      status: row.status,
      workloadMinutes: row.workloadMinutes,
      validityKind: row.validityKind,
      validityValue: row.validityValue,
      dueSoonDays: row.dueSoonDays,
      deadlineDays: row.deadlineDays,
      document: row.document,
      documentVersion: row.documentVersion,
      requiresAssessment: row.requiresAssessment,
      minimumScore: row.minimumScore ? Number(row.minimumScore) : null,
      maxAttempts: row.maxAttempts,
      requiresAttendance: row.requiresAttendance,
      requiresEffectiveness: row.requiresEffectiveness,
      effectivenessDays: row.effectivenessDays,
      requiresCertificate: row.requiresCertificate,
      allowsOnline: row.allowsOnline,
      plannedCostCents: row.plannedCostCents,
      defaultInstructor: row.defaultInstructor,
      requirements: row._count?.requirements ?? 0,
      assignments: row._count?.assignments ?? 0,
      classes: row._count?.classes ?? 0,
      createdAt: row.createdAt,
    };
  }

  private toInt(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
}
