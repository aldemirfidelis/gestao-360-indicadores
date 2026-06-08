import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FoodSafetyControlType,
  FoodSafetyHazardCategory,
  FoodSafetyHazardStatus,
  FoodSafetyProcessStatus,
  FoodSafetyProgramStatus,
  FoodSafetyRiskLevel,
  FoodSafetyStepType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';

/**
 * Modulo Seguranca dos Alimentos (FSMS) — Fase 1 (Fundacao).
 * Programas (workspaces por empresa/unidade), processos (com workflow de
 * aprovacao) e etapas (base do fluxograma/matriz). Isolamento por empresa e,
 * nos processos, por area (espelha o modulo processes/documents/audits).
 * Perigos/APPCC, PPR/PPRO/PCC, requisitos versionados, fornecedores e
 * rastreabilidade/recall entram nas fases seguintes.
 */
const MODULE = 'food-safety';
const VISIBILITIES = ['PUBLIC', 'PRIVATE', 'RESTRICTED'];

@Injectable()
export class FoodSafetyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  // ----------------------------- helpers ------------------------------------
  private requiredText(value: unknown, field: string) {
    const text = String(value ?? '').trim();
    if (!text) throw new BadRequestException(`${field} e obrigatorio.`);
    return text;
  }
  private nullableText(value: unknown) {
    if (value === undefined) return undefined;
    const text = String(value ?? '').trim();
    return text ? text : null;
  }
  private id(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }
  private optionalInt(value: unknown, min = 0): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new BadRequestException('Valor numerico invalido.');
    return Math.max(min, Math.round(n));
  }
  private optionalFloat(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new BadRequestException('Valor numerico invalido.');
    return n;
  }
  private optionalDate(value: unknown): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Data invalida.');
    return d;
  }
  private parseProgramStatus(v?: string): FoodSafetyProgramStatus | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyProgramStatus).includes(v as FoodSafetyProgramStatus)) throw new BadRequestException('Status de programa invalido.');
    return v as FoodSafetyProgramStatus;
  }
  private parseProcessStatus(v?: string): FoodSafetyProcessStatus | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyProcessStatus).includes(v as FoodSafetyProcessStatus)) throw new BadRequestException('Status de processo invalido.');
    return v as FoodSafetyProcessStatus;
  }
  private parseStepType(v?: string): FoodSafetyStepType | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyStepType).includes(v as FoodSafetyStepType)) throw new BadRequestException('Tipo de etapa invalido.');
    return v as FoodSafetyStepType;
  }
  private async validateOrgNode(companyId: string, orgNodeId: string | null) {
    if (!orgNodeId) return null;
    const node = await this.prisma.orgNode.findFirst({ where: { id: orgNodeId, companyId, deletedAt: null }, select: { id: true } });
    if (!node) throw new NotFoundException('Unidade/area nao encontrada');
    return node.id;
  }
  private async validateUser(companyId: string, userId: string | null) {
    if (!userId) return null;
    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId, deletedAt: null, active: true }, select: { id: true } });
    if (!user) throw new NotFoundException('Usuario responsavel nao encontrado');
    return user.id;
  }

  // ----------------------------- programs -----------------------------------
  private programInclude() {
    return {
      orgNode: { select: { id: true, name: true, type: true } },
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { processes: true } },
    } satisfies Prisma.FoodSafetyProgramInclude;
  }

  async listPrograms(me: AuthPayload, filters: { status?: string; search?: string } = {}) {
    const status = this.parseProgramStatus(filters.status);
    const term = filters.search?.trim();
    return this.prisma.foodSafetyProgram.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { code: { contains: term, mode: 'insensitive' } },
                { description: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: this.programInclude(),
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async getProgram(me: AuthPayload, id: string) {
    const program = await this.prisma.foodSafetyProgram.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: this.programInclude(),
    });
    if (!program) throw new NotFoundException('Programa nao encontrado');
    return program;
  }

  async createProgram(me: AuthPayload, body: any) {
    const name = this.requiredText(body?.name, 'Nome');
    const orgNodeId = await this.validateOrgNode(me.companyId, this.id(body?.orgNodeId));
    const ownerUserId = await this.validateUser(me.companyId, this.id(body?.ownerUserId));
    return this.prisma.foodSafetyProgram.create({
      data: {
        companyId: me.companyId,
        name,
        code: this.nullableText(body?.code) ?? null,
        description: this.nullableText(body?.description) ?? null,
        scope: this.nullableText(body?.scope) ?? null,
        visibility: VISIBILITIES.includes(String(body?.visibility)) ? String(body.visibility) : 'PRIVATE',
        status: this.parseProgramStatus(body?.status) ?? FoodSafetyProgramStatus.ACTIVE,
        orgNodeId,
        ownerUserId,
        createdById: me.sub,
      },
      include: this.programInclude(),
    });
  }

  async updateProgram(me: AuthPayload, id: string, patch: any) {
    await this.getProgram(me, id);
    const data: any = {};
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome');
    if ('code' in (patch ?? {})) data.code = this.nullableText(patch.code);
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('scope' in (patch ?? {})) data.scope = this.nullableText(patch.scope);
    if ('visibility' in (patch ?? {}) && VISIBILITIES.includes(String(patch.visibility))) data.visibility = String(patch.visibility);
    if ('status' in (patch ?? {})) data.status = this.parseProgramStatus(patch.status);
    if ('orgNodeId' in (patch ?? {})) data.orgNodeId = await this.validateOrgNode(me.companyId, this.id(patch.orgNodeId));
    if ('ownerUserId' in (patch ?? {})) data.ownerUserId = await this.validateUser(me.companyId, this.id(patch.ownerUserId));
    return this.prisma.foodSafetyProgram.update({ where: { id }, data, include: this.programInclude() });
  }

  async removeProgram(me: AuthPayload, id: string) {
    await this.getProgram(me, id);
    return this.prisma.foodSafetyProgram.update({ where: { id }, data: { deletedAt: new Date() }, include: this.programInclude() });
  }

  // ----------------------------- processes ----------------------------------
  private processInclude() {
    return {
      program: { select: { id: true, name: true, code: true } },
      orgNode: { select: { id: true, name: true, type: true } },
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      steps: { where: { deletedAt: null }, orderBy: { number: 'asc' as const } },
    } satisfies Prisma.FoodSafetyProcessInclude;
  }

  private async assertProcessWriteArea(me: AuthPayload, area: string | null, action: AreaAction) {
    if (area) await this.access.assertCanWrite(me.sub, area, MODULE, action);
  }

  private async loadProcess(me: AuthPayload, id: string) {
    const proc = await this.prisma.foodSafetyProcess.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: this.processInclude(),
    });
    if (!proc) throw new NotFoundException('Processo nao encontrado');
    return proc;
  }

  async listProcesses(me: AuthPayload, filters: { programId?: string; status?: string; search?: string } = {}) {
    const status = this.parseProcessStatus(filters.status);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: Prisma.FoodSafetyProcessWhereInput[] = [];
    if (permitted) and.push({ OR: [{ orgNodeId: null }, { orgNodeId: { in: permitted } }] });
    const term = filters.search?.trim();
    if (term) {
      and.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { code: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { productName: { contains: term, mode: 'insensitive' } },
        ],
      });
    }
    return this.prisma.foodSafetyProcess.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(filters.programId ? { programId: filters.programId } : {}),
        ...(status ? { status } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      include: this.processInclude(),
      orderBy: [{ status: 'asc' }, { number: 'desc' }],
    });
  }

  async getProcess(me: AuthPayload, id: string) {
    const proc = await this.loadProcess(me, id);
    if (proc.orgNodeId) {
      const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
      if (permitted && !permitted.includes(proc.orgNodeId)) {
        throw new ForbiddenException('Voce nao tem acesso aos processos desta area.');
      }
    }
    return proc;
  }

  async createProcess(me: AuthPayload, body: any) {
    const programId = this.requiredText(body?.programId, 'Programa');
    await this.getProgram(me, programId); // valida pertencimento a empresa
    const name = this.requiredText(body?.name, 'Nome');
    const orgNodeId = await this.validateOrgNode(me.companyId, this.id(body?.orgNodeId));
    const ownerUserId = await this.validateUser(me.companyId, this.id(body?.ownerUserId));
    await this.assertProcessWriteArea(me, orgNodeId, 'create');

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.foodSafetyProcess.findFirst({ where: { companyId: me.companyId }, orderBy: { number: 'desc' }, select: { number: true } });
      return tx.foodSafetyProcess.create({
        data: {
          companyId: me.companyId,
          programId,
          number: (last?.number ?? 0) + 1,
          code: this.nullableText(body?.code) ?? null,
          name,
          description: this.nullableText(body?.description) ?? null,
          objective: this.nullableText(body?.objective) ?? null,
          productName: this.nullableText(body?.productName) ?? null,
          productionLine: this.nullableText(body?.productionLine) ?? null,
          version: this.nullableText(body?.version) ?? null,
          status: this.parseProcessStatus(body?.status) ?? FoodSafetyProcessStatus.DRAFT,
          positionX: this.optionalFloat(body?.positionX) ?? null,
          positionY: this.optionalFloat(body?.positionY) ?? null,
          reviewPeriodicityDays: this.optionalInt(body?.reviewPeriodicityDays, 1) ?? null,
          nextReviewAt: this.optionalDate(body?.nextReviewAt) ?? null,
          orgNodeId,
          ownerUserId,
          createdById: me.sub,
        },
        include: this.processInclude(),
      });
    });
  }

  async updateProcess(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadProcess(me, id);
    await this.assertProcessWriteArea(me, before.orgNodeId, 'edit');
    const data: any = {};
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome');
    if ('code' in (patch ?? {})) data.code = this.nullableText(patch.code);
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('objective' in (patch ?? {})) data.objective = this.nullableText(patch.objective);
    if ('productName' in (patch ?? {})) data.productName = this.nullableText(patch.productName);
    if ('productionLine' in (patch ?? {})) data.productionLine = this.nullableText(patch.productionLine);
    if ('version' in (patch ?? {})) data.version = this.nullableText(patch.version);
    if ('positionX' in (patch ?? {})) data.positionX = this.optionalFloat(patch.positionX);
    if ('positionY' in (patch ?? {})) data.positionY = this.optionalFloat(patch.positionY);
    if ('reviewPeriodicityDays' in (patch ?? {})) data.reviewPeriodicityDays = this.optionalInt(patch.reviewPeriodicityDays, 1);
    if ('nextReviewAt' in (patch ?? {})) data.nextReviewAt = this.optionalDate(patch.nextReviewAt);
    if ('lastReviewAt' in (patch ?? {})) data.lastReviewAt = this.optionalDate(patch.lastReviewAt);
    if ('status' in (patch ?? {})) data.status = this.parseProcessStatus(patch.status);
    if ('orgNodeId' in (patch ?? {})) {
      data.orgNodeId = await this.validateOrgNode(me.companyId, this.id(patch.orgNodeId));
      await this.assertProcessWriteArea(me, data.orgNodeId, 'edit');
    }
    if ('ownerUserId' in (patch ?? {})) data.ownerUserId = await this.validateUser(me.companyId, this.id(patch.ownerUserId));
    return this.prisma.foodSafetyProcess.update({ where: { id }, data, include: this.processInclude() });
  }

  async removeProcess(me: AuthPayload, id: string) {
    const proc = await this.loadProcess(me, id);
    await this.assertProcessWriteArea(me, proc.orgNodeId, 'delete');
    return this.prisma.foodSafetyProcess.update({ where: { id }, data: { deletedAt: new Date() }, include: this.processInclude() });
  }

  // ----------------------------- steps --------------------------------------
  private async loadStep(me: AuthPayload, stepId: string) {
    const step = await this.prisma.foodSafetyProcessStep.findFirst({
      where: { id: stepId, companyId: me.companyId, deletedAt: null },
      include: { process: { select: { id: true, number: true, name: true, orgNodeId: true } } },
    });
    if (!step) throw new NotFoundException('Etapa nao encontrada');
    return step;
  }

  async addStep(me: AuthPayload, processId: string, body: any) {
    const proc = await this.loadProcess(me, processId);
    await this.assertProcessWriteArea(me, proc.orgNodeId, 'edit');
    const explicit = this.optionalInt(body?.number, 1);
    const number = explicit ?? (proc.steps.length ? Math.max(...proc.steps.map((s) => s.number)) + 1 : 1);
    return this.prisma.foodSafetyProcessStep.create({
      data: {
        companyId: me.companyId,
        processId,
        number,
        code: this.nullableText(body?.code) ?? null,
        name: this.requiredText(body?.name, 'Nome da etapa'),
        description: this.nullableText(body?.description) ?? null,
        type: this.parseStepType(body?.type) ?? FoodSafetyStepType.OTHER,
        inputs: this.nullableText(body?.inputs) ?? null,
        outputs: this.nullableText(body?.outputs) ?? null,
        positionX: this.optionalFloat(body?.positionX) ?? null,
        positionY: this.optionalFloat(body?.positionY) ?? null,
        isControlPoint: Boolean(body?.isControlPoint),
      },
    });
  }

  async updateStep(me: AuthPayload, stepId: string, patch: any) {
    const step = await this.loadStep(me, stepId);
    await this.assertProcessWriteArea(me, step.process.orgNodeId, 'edit');
    const data: any = {};
    if ('number' in (patch ?? {})) data.number = this.optionalInt(patch.number, 1) ?? step.number;
    if ('code' in (patch ?? {})) data.code = this.nullableText(patch.code);
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome da etapa');
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('type' in (patch ?? {})) data.type = this.parseStepType(patch.type);
    if ('inputs' in (patch ?? {})) data.inputs = this.nullableText(patch.inputs);
    if ('outputs' in (patch ?? {})) data.outputs = this.nullableText(patch.outputs);
    if ('positionX' in (patch ?? {})) data.positionX = this.optionalFloat(patch.positionX);
    if ('positionY' in (patch ?? {})) data.positionY = this.optionalFloat(patch.positionY);
    if ('isControlPoint' in (patch ?? {})) data.isControlPoint = Boolean(patch.isControlPoint);
    return this.prisma.foodSafetyProcessStep.update({ where: { id: stepId }, data });
  }

  async removeStep(me: AuthPayload, stepId: string) {
    const step = await this.loadStep(me, stepId);
    await this.assertProcessWriteArea(me, step.process.orgNodeId, 'edit');
    return this.prisma.foodSafetyProcessStep.update({ where: { id: stepId }, data: { deletedAt: new Date() } });
  }

  // ----------------------------- overview / options -------------------------
  async summary(me: AuthPayload, programId?: string) {
    const processes = await this.listProcesses(me, { programId });
    const byStatus = Object.fromEntries(Object.values(FoodSafetyProcessStatus).map((s) => [s, 0])) as Record<FoodSafetyProcessStatus, number>;
    let steps = 0;
    let controlPoints = 0;
    for (const p of processes) {
      byStatus[p.status]++;
      steps += p.steps.length;
      controlPoints += p.steps.filter((s) => s.isControlPoint).length;
    }

    const hazards = await this.prisma.foodSafetyHazard.findMany({
      where: { companyId: me.companyId, deletedAt: null, ...(programId ? { process: { programId } } : {}) },
      select: { riskLevel: true, controlType: true },
    });
    const byLevel = Object.fromEntries(Object.values(FoodSafetyRiskLevel).map((l) => [l, 0])) as Record<FoodSafetyRiskLevel, number>;
    let ccp = 0;
    let oprp = 0;
    for (const h of hazards) {
      if (h.riskLevel) byLevel[h.riskLevel]++;
      if (h.controlType === FoodSafetyControlType.CCP) ccp++;
      if (h.controlType === FoodSafetyControlType.OPRP) oprp++;
    }

    return {
      processes: processes.length,
      published: byStatus[FoodSafetyProcessStatus.PUBLISHED] ?? 0,
      draft: byStatus[FoodSafetyProcessStatus.DRAFT] ?? 0,
      inReview: byStatus[FoodSafetyProcessStatus.IN_REVIEW] ?? 0,
      pendingApproval: byStatus[FoodSafetyProcessStatus.PENDING_APPROVAL] ?? 0,
      obsolete: byStatus[FoodSafetyProcessStatus.OBSOLETE] ?? 0,
      steps,
      controlPoints,
      byStatus,
      hazards: hazards.length,
      hazardsCritical: byLevel[FoodSafetyRiskLevel.CRITICAL] ?? 0,
      hazardsHigh: byLevel[FoodSafetyRiskLevel.HIGH] ?? 0,
      ccp,
      oprp,
      hazardsByLevel: byLevel,
    };
  }

  async options(me: AuthPayload) {
    const [orgNodes, users] = await Promise.all([
      this.prisma.orgNode.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, type: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      orgNodes,
      users,
      programStatuses: Object.values(FoodSafetyProgramStatus),
      processStatuses: Object.values(FoodSafetyProcessStatus),
      stepTypes: Object.values(FoodSafetyStepType),
      hazardCategories: Object.values(FoodSafetyHazardCategory),
      riskLevels: Object.values(FoodSafetyRiskLevel),
      controlTypes: Object.values(FoodSafetyControlType),
      hazardStatuses: Object.values(FoodSafetyHazardStatus),
      visibilities: VISIBILITIES,
    };
  }

  // ----------------------------- matriz de risco ----------------------------
  async getRiskMatrix(me: AuthPayload) {
    const existing = await this.prisma.foodSafetyRiskMatrix.findFirst({
      where: { companyId: me.companyId, deletedAt: null, active: true },
    });
    if (existing) return existing;
    return this.prisma.foodSafetyRiskMatrix.create({ data: { companyId: me.companyId } });
  }

  async updateRiskMatrix(me: AuthPayload, patch: any) {
    const matrix = await this.getRiskMatrix(me);
    const data: any = {};
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome');
    if ('severityScale' in (patch ?? {})) data.severityScale = this.scale(patch.severityScale, 'Escala de severidade');
    if ('probabilityScale' in (patch ?? {})) data.probabilityScale = this.scale(patch.probabilityScale, 'Escala de probabilidade');
    if ('detectionScale' in (patch ?? {})) data.detectionScale = this.scale(patch.detectionScale, 'Escala de deteccao');
    if ('useDetection' in (patch ?? {})) data.useDetection = Boolean(patch.useDetection);
    if ('thresholdLow' in (patch ?? {})) data.thresholdLow = this.scale(patch.thresholdLow, 'Limite baixo');
    if ('thresholdModerate' in (patch ?? {})) data.thresholdModerate = this.scale(patch.thresholdModerate, 'Limite moderado');
    if ('thresholdHigh' in (patch ?? {})) data.thresholdHigh = this.scale(patch.thresholdHigh, 'Limite alto');
    const low = data.thresholdLow ?? matrix.thresholdLow;
    const mod = data.thresholdModerate ?? matrix.thresholdModerate;
    const high = data.thresholdHigh ?? matrix.thresholdHigh;
    if (!(low < mod && mod < high)) throw new BadRequestException('Os limites devem ser crescentes: baixo < moderado < alto.');
    return this.prisma.foodSafetyRiskMatrix.update({ where: { id: matrix.id }, data });
  }

  private scale(value: unknown, field: string): number {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 1) throw new BadRequestException(`${field} deve ser um numero >= 1.`);
    return n;
  }

  private scaleValue(value: unknown, max: number): number | null {
    if (value === undefined || value === null || value === '') return null;
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) throw new BadRequestException('Valor de escala invalido.');
    if (n < 1 || n > max) throw new BadRequestException(`Valor deve estar entre 1 e ${max}.`);
    return n;
  }

  private computeRisk(
    matrix: { useDetection: boolean; thresholdLow: number; thresholdModerate: number; thresholdHigh: number },
    severity: number | null,
    probability: number | null,
    detection: number | null,
  ): { riskIndex: number | null; riskLevel: FoodSafetyRiskLevel | null } {
    if (severity == null || probability == null) return { riskIndex: null, riskLevel: null };
    let index = severity * probability;
    if (matrix.useDetection && detection != null) index *= detection;
    let level: FoodSafetyRiskLevel;
    if (index <= matrix.thresholdLow) level = FoodSafetyRiskLevel.LOW;
    else if (index <= matrix.thresholdModerate) level = FoodSafetyRiskLevel.MODERATE;
    else if (index <= matrix.thresholdHigh) level = FoodSafetyRiskLevel.HIGH;
    else level = FoodSafetyRiskLevel.CRITICAL;
    return { riskIndex: index, riskLevel: level };
  }

  // ----------------------------- perigos / APPCC ----------------------------
  private parseCategory(v?: string): FoodSafetyHazardCategory | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyHazardCategory).includes(v as FoodSafetyHazardCategory)) throw new BadRequestException('Categoria de perigo invalida.');
    return v as FoodSafetyHazardCategory;
  }
  private parseControlType(v?: string): FoodSafetyControlType | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyControlType).includes(v as FoodSafetyControlType)) throw new BadRequestException('Tipo de controle invalido.');
    return v as FoodSafetyControlType;
  }
  private parseHazardStatus(v?: string): FoodSafetyHazardStatus | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyHazardStatus).includes(v as FoodSafetyHazardStatus)) throw new BadRequestException('Status de perigo invalido.');
    return v as FoodSafetyHazardStatus;
  }

  private hazardInclude() {
    return {
      process: { select: { id: true, number: true, name: true, code: true, orgNodeId: true, programId: true } },
      step: { select: { id: true, number: true, name: true } },
      responsible: { select: { id: true, name: true, email: true } },
    } satisfies Prisma.FoodSafetyHazardInclude;
  }

  private async loadHazard(me: AuthPayload, id: string) {
    const hazard = await this.prisma.foodSafetyHazard.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: this.hazardInclude(),
    });
    if (!hazard) throw new NotFoundException('Perigo nao encontrado');
    return hazard;
  }

  async listHazards(me: AuthPayload, filters: { processId?: string; stepId?: string; category?: string; status?: string; search?: string } = {}) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: Prisma.FoodSafetyHazardWhereInput[] = [];
    if (permitted) and.push({ process: { OR: [{ orgNodeId: null }, { orgNodeId: { in: permitted } }] } });
    const term = filters.search?.trim();
    if (term) {
      and.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { code: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { source: { contains: term, mode: 'insensitive' } },
        ],
      });
    }
    return this.prisma.foodSafetyHazard.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(filters.processId ? { processId: filters.processId } : {}),
        ...(filters.stepId ? { stepId: filters.stepId } : {}),
        ...(this.parseCategory(filters.category) ? { category: this.parseCategory(filters.category) } : {}),
        ...(this.parseHazardStatus(filters.status) ? { status: this.parseHazardStatus(filters.status) } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      include: this.hazardInclude(),
      orderBy: [{ number: 'desc' }],
    });
  }

  async getHazard(me: AuthPayload, id: string) {
    return this.loadHazard(me, id);
  }

  async createHazard(me: AuthPayload, body: any) {
    const processId = this.requiredText(body?.processId, 'Processo');
    const proc = await this.loadProcess(me, processId);
    await this.assertProcessWriteArea(me, proc.orgNodeId, 'create');
    const stepId = this.id(body?.stepId);
    if (stepId && !proc.steps.some((s) => s.id === stepId)) throw new BadRequestException('Etapa nao pertence ao processo informado.');
    const responsibleUserId = await this.validateUser(me.companyId, this.id(body?.responsibleUserId));
    const matrix = await this.getRiskMatrix(me);
    const severity = this.scaleValue(body?.severity, matrix.severityScale);
    const probability = this.scaleValue(body?.probability, matrix.probabilityScale);
    const detection = matrix.useDetection ? this.scaleValue(body?.detection, matrix.detectionScale) : null;
    const risk = this.computeRisk(matrix, severity, probability, detection);

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.foodSafetyHazard.findFirst({ where: { companyId: me.companyId }, orderBy: { number: 'desc' }, select: { number: true } });
      return tx.foodSafetyHazard.create({
        data: {
          companyId: me.companyId,
          processId,
          stepId,
          responsibleUserId,
          number: (last?.number ?? 0) + 1,
          code: this.nullableText(body?.code) ?? null,
          category: this.parseCategory(body?.category) ?? FoodSafetyHazardCategory.BIOLOGICAL,
          name: this.requiredText(body?.name, 'Nome do perigo'),
          description: this.nullableText(body?.description) ?? null,
          source: this.nullableText(body?.source) ?? null,
          consequence: this.nullableText(body?.consequence) ?? null,
          justification: this.nullableText(body?.justification) ?? null,
          severity,
          probability,
          detection,
          riskIndex: risk.riskIndex,
          riskLevel: risk.riskLevel,
          controlType: this.parseControlType(body?.controlType) ?? FoodSafetyControlType.NONE,
          controlJustification: this.nullableText(body?.controlJustification) ?? null,
          existingControls: this.nullableText(body?.existingControls) ?? null,
          additionalControls: this.nullableText(body?.additionalControls) ?? null,
          status: this.parseHazardStatus(body?.status) ?? FoodSafetyHazardStatus.OPEN,
        },
        include: this.hazardInclude(),
      });
    });
  }

  async updateHazard(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadHazard(me, id);
    await this.assertProcessWriteArea(me, before.process.orgNodeId, 'edit');
    const matrix = await this.getRiskMatrix(me);
    const data: any = {};
    if ('stepId' in (patch ?? {})) {
      const stepId = this.id(patch.stepId);
      if (stepId) {
        const step = await this.prisma.foodSafetyProcessStep.findFirst({ where: { id: stepId, processId: before.processId, deletedAt: null }, select: { id: true } });
        if (!step) throw new BadRequestException('Etapa nao pertence ao processo do perigo.');
      }
      data.stepId = stepId;
    }
    if ('responsibleUserId' in (patch ?? {})) data.responsibleUserId = await this.validateUser(me.companyId, this.id(patch.responsibleUserId));
    if ('code' in (patch ?? {})) data.code = this.nullableText(patch.code);
    if ('category' in (patch ?? {})) data.category = this.parseCategory(patch.category);
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome do perigo');
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('source' in (patch ?? {})) data.source = this.nullableText(patch.source);
    if ('consequence' in (patch ?? {})) data.consequence = this.nullableText(patch.consequence);
    if ('justification' in (patch ?? {})) data.justification = this.nullableText(patch.justification);
    if ('controlType' in (patch ?? {})) data.controlType = this.parseControlType(patch.controlType);
    if ('controlJustification' in (patch ?? {})) data.controlJustification = this.nullableText(patch.controlJustification);
    if ('existingControls' in (patch ?? {})) data.existingControls = this.nullableText(patch.existingControls);
    if ('additionalControls' in (patch ?? {})) data.additionalControls = this.nullableText(patch.additionalControls);
    if ('status' in (patch ?? {})) data.status = this.parseHazardStatus(patch.status);

    const touchesRisk = ['severity', 'probability', 'detection'].some((k) => k in (patch ?? {}));
    if (touchesRisk) {
      const severity = 'severity' in patch ? this.scaleValue(patch.severity, matrix.severityScale) : before.severity;
      const probability = 'probability' in patch ? this.scaleValue(patch.probability, matrix.probabilityScale) : before.probability;
      const detection = matrix.useDetection ? ('detection' in patch ? this.scaleValue(patch.detection, matrix.detectionScale) : before.detection) : null;
      const risk = this.computeRisk(matrix, severity, probability, detection);
      data.severity = severity;
      data.probability = probability;
      data.detection = detection;
      data.riskIndex = risk.riskIndex;
      data.riskLevel = risk.riskLevel;
    }
    return this.prisma.foodSafetyHazard.update({ where: { id }, data, include: this.hazardInclude() });
  }

  async removeHazard(me: AuthPayload, id: string) {
    const hazard = await this.loadHazard(me, id);
    await this.assertProcessWriteArea(me, hazard.process.orgNodeId, 'delete');
    return this.prisma.foodSafetyHazard.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
