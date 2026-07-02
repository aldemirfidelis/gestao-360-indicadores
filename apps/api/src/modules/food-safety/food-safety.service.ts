import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { logSwallowed } from '../../common/logging/swallow';
import {
  FoodSafetyComplianceResult,
  FoodSafetyControlPlanStatus,
  FoodSafetyControlType,
  FoodSafetyHazardCategory,
  FoodSafetyHazardStatus,
  FoodSafetyLotStatus,
  FoodSafetyLotType,
  FoodSafetyMaterialCategory,
  FoodSafetyMaterialStatus,
  FoodSafetyMonitoringResult,
  FoodSafetyProcessStatus,
  FoodSafetyProgramStatus,
  FoodSafetyRecallItemStatus,
  FoodSafetyRecallSeverity,
  FoodSafetyRecallStatus,
  FoodSafetyRequirementCriticality,
  FoodSafetyRiskLevel,
  FoodSafetyStandardVersionStatus,
  FoodSafetyStepType,
  FoodSafetySupplierCriticality,
  FoodSafetySupplierStatus,
  FoodSafetyTraceEventType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';
import { GeminiService } from '../ai/gemini.service';
import { NonConformitiesService } from '../nonconformities/nonconformities.service';

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
    private readonly nonConformities: NonConformitiesService,
    private readonly gemini?: GeminiService,
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
        visualModel: this.nullableText(body?.visualModel) ?? null,
        inputs: this.nullableText(body?.inputs) ?? null,
        outputs: this.nullableText(body?.outputs) ?? null,
        positionX: this.optionalFloat(body?.positionX) ?? null,
        positionY: this.optionalFloat(body?.positionY) ?? null,
        isControlPoint: Boolean(body?.isControlPoint),
      },
    });
  }

  async addStepsBulk(me: AuthPayload, processId: string, body: any) {
    const proc = await this.loadProcess(me, processId);
    await this.assertProcessWriteArea(me, proc.orgNodeId, 'edit');
    const steps = Array.isArray(body?.steps) ? body.steps : [];
    if (steps.length === 0) throw new BadRequestException('Informe ao menos uma etapa.');
    if (steps.length > 40) throw new BadRequestException('O limite por importacao e de 40 etapas.');

    const startNumber = proc.steps.length
      ? Math.max(...proc.steps.map((step) => step.number)) + 1
      : 1;
    const rows = steps.map((step: any, index: number) => ({
      companyId: me.companyId,
      processId,
      number: startNumber + index,
      code: this.nullableText(step?.code) ?? null,
      name: this.requiredText(step?.name, `Nome da etapa ${index + 1}`),
      description: this.nullableText(step?.description) ?? null,
      type: this.parseStepType(step?.type) ?? FoodSafetyStepType.OTHER,
      visualModel: this.nullableText(step?.visualModel) ?? null,
      inputs: this.nullableText(step?.inputs) ?? null,
      outputs: this.nullableText(step?.outputs) ?? null,
      positionX: this.optionalFloat(step?.positionX) ?? null,
      positionY: this.optionalFloat(step?.positionY) ?? null,
      isControlPoint: Boolean(step?.isControlPoint),
    }));

    await this.prisma.foodSafetyProcessStep.createMany({ data: rows });
    return {
      created: rows.length,
      process: await this.loadProcess(me, processId),
    };
  }

  // --------------------------- modelos de fluxo -----------------------------
  // Modelos reutilizaveis da empresa (equivalentes aos da biblioteca fixa do
  // frontend): criados do zero, salvos de um processo ou importados via JSON.

  private normalizeFlowTemplateSteps(steps: unknown) {
    const list = Array.isArray(steps) ? steps : [];
    if (!list.length) throw new BadRequestException('Informe ao menos uma etapa para o modelo.');
    if (list.length > 60) throw new BadRequestException('O limite e de 60 etapas por modelo.');
    return list.map((step: any, index: number) => ({
      name: this.requiredText(step?.name, `Nome da etapa ${index + 1}`),
      type: this.parseStepType(step?.type) ?? FoodSafetyStepType.OTHER,
      visualModel: this.nullableText(step?.visualModel) ?? null,
      description: this.nullableText(step?.description) ?? null,
      inputs: this.nullableText(step?.inputs) ?? null,
      outputs: this.nullableText(step?.outputs) ?? null,
      isControlPoint: Boolean(step?.isControlPoint),
    }));
  }

  private async loadFlowTemplate(me: AuthPayload, id: string) {
    const template = await this.prisma.foodSafetyFlowTemplate.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
    });
    if (!template) throw new NotFoundException('Modelo de fluxo nao encontrado');
    return template;
  }

  async listFlowTemplates(me: AuthPayload, filters: { includeInactive?: string } = {}) {
    return this.prisma.foodSafetyFlowTemplate.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(filters.includeInactive === 'true' ? {} : { active: true }),
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async createFlowTemplate(me: AuthPayload, body: any) {
    const name = this.requiredText(body?.name, 'Nome do modelo');
    const steps = this.normalizeFlowTemplateSteps(body?.steps);
    return this.prisma.foodSafetyFlowTemplate.create({
      data: {
        companyId: me.companyId,
        name,
        sector: this.nullableText(body?.sector) ?? null,
        summary: this.nullableText(body?.summary) ?? null,
        color: this.nullableText(body?.color) ?? null,
        steps: steps as unknown as Prisma.InputJsonValue,
        stepCount: steps.length,
        sourceProcessId: this.id(body?.sourceProcessId),
        createdById: me.sub,
      },
    });
  }

  async updateFlowTemplate(me: AuthPayload, id: string, patch: any) {
    await this.loadFlowTemplate(me, id);
    const data: any = {};
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome do modelo');
    if ('sector' in (patch ?? {})) data.sector = this.nullableText(patch.sector);
    if ('summary' in (patch ?? {})) data.summary = this.nullableText(patch.summary);
    if ('color' in (patch ?? {})) data.color = this.nullableText(patch.color);
    if ('active' in (patch ?? {})) data.active = Boolean(patch.active);
    if ('steps' in (patch ?? {})) {
      const steps = this.normalizeFlowTemplateSteps(patch.steps);
      data.steps = steps as unknown as Prisma.InputJsonValue;
      data.stepCount = steps.length;
    }
    return this.prisma.foodSafetyFlowTemplate.update({ where: { id }, data });
  }

  async removeFlowTemplate(me: AuthPayload, id: string) {
    await this.loadFlowTemplate(me, id);
    return this.prisma.foodSafetyFlowTemplate.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  }

  /** Salva o fluxo (etapas) de um processo existente como modelo reutilizavel. */
  async saveProcessAsFlowTemplate(me: AuthPayload, processId: string, body: any) {
    const proc = await this.getProcess(me, processId);
    if (!proc.steps.length) throw new BadRequestException('O processo nao possui etapas para salvar como modelo.');
    const steps = proc.steps.map((step) => ({
      name: step.name,
      type: step.type,
      visualModel: step.visualModel ?? null,
      description: step.description ?? null,
      inputs: step.inputs ?? null,
      outputs: step.outputs ?? null,
      isControlPoint: step.isControlPoint,
    }));
    return this.prisma.foodSafetyFlowTemplate.create({
      data: {
        companyId: me.companyId,
        name: this.nullableText(body?.name) ?? `${proc.name} (modelo)`,
        sector: this.nullableText(body?.sector) ?? proc.productionLine ?? null,
        summary: this.nullableText(body?.summary) ?? proc.description ?? null,
        color: this.nullableText(body?.color) ?? null,
        steps: steps as unknown as Prisma.InputJsonValue,
        stepCount: steps.length,
        sourceProcessId: proc.id,
        createdById: me.sub,
      },
    });
  }

  /** Payload de exportacao (JSON) reimportavel via POST /flow-templates. */
  async exportFlowTemplate(me: AuthPayload, id: string) {
    const template = await this.loadFlowTemplate(me, id);
    return {
      format: 'g360.food-safety.flow-template',
      version: 1,
      name: template.name,
      sector: template.sector,
      summary: template.summary,
      color: template.color,
      steps: template.steps,
    };
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
    if ('visualModel' in (patch ?? {})) data.visualModel = this.nullableText(patch.visualModel);
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
      supplierStatuses: Object.values(FoodSafetySupplierStatus),
      supplierCriticalities: Object.values(FoodSafetySupplierCriticality),
      materialCategories: Object.values(FoodSafetyMaterialCategory),
      materialStatuses: Object.values(FoodSafetyMaterialStatus),
      lotTypes: Object.values(FoodSafetyLotType),
      lotStatuses: Object.values(FoodSafetyLotStatus),
      traceEventTypes: Object.values(FoodSafetyTraceEventType),
      recallStatuses: Object.values(FoodSafetyRecallStatus),
      recallSeverities: Object.values(FoodSafetyRecallSeverity),
      recallItemStatuses: Object.values(FoodSafetyRecallItemStatus),
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

  // ----------------------------- controle operacional (PPR/PPRO/PCC) --------
  private parseControlPlanStatus(v?: string): FoodSafetyControlPlanStatus | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyControlPlanStatus).includes(v as FoodSafetyControlPlanStatus)) throw new BadRequestException('Status de plano invalido.');
    return v as FoodSafetyControlPlanStatus;
  }
  private parseResult(v?: string): FoodSafetyMonitoringResult | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyMonitoringResult).includes(v as FoodSafetyMonitoringResult)) throw new BadRequestException('Resultado de monitoramento invalido.');
    return v as FoodSafetyMonitoringResult;
  }

  private planInclude() {
    return {
      hazard: {
        select: {
          id: true,
          number: true,
          name: true,
          controlType: true,
          process: { select: { id: true, name: true, code: true, orgNodeId: true, programId: true } },
          step: { select: { id: true, name: true } },
        },
      },
      responsible: { select: { id: true, name: true, email: true } },
      _count: { select: { records: true } },
    } satisfies Prisma.FoodSafetyControlPlanInclude;
  }

  private async loadControlPlan(me: AuthPayload, id: string) {
    const plan = await this.prisma.foodSafetyControlPlan.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: this.planInclude(),
    });
    if (!plan) throw new NotFoundException('Plano de controle nao encontrado');
    return plan;
  }

  async listControlPlans(me: AuthPayload, filters: { hazardId?: string; programId?: string; status?: string } = {}) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: Prisma.FoodSafetyControlPlanWhereInput[] = [];
    if (permitted) and.push({ hazard: { process: { OR: [{ orgNodeId: null }, { orgNodeId: { in: permitted } }] } } });
    if (filters.programId) and.push({ hazard: { process: { programId: filters.programId } } });
    return this.prisma.foodSafetyControlPlan.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(filters.hazardId ? { hazardId: filters.hazardId } : {}),
        ...(this.parseControlPlanStatus(filters.status) ? { status: this.parseControlPlanStatus(filters.status) } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      include: this.planInclude(),
      orderBy: [{ controlType: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getControlPlan(me: AuthPayload, id: string) {
    return this.loadControlPlan(me, id);
  }

  private controlPlanData(body: any) {
    return {
      parameter: this.nullableText(body?.parameter) ?? null,
      unit: this.nullableText(body?.unit) ?? null,
      criticalLimitText: this.nullableText(body?.criticalLimitText) ?? null,
      criticalMin: this.optionalFloat(body?.criticalMin) ?? null,
      criticalMax: this.optionalFloat(body?.criticalMax) ?? null,
      alertMin: this.optionalFloat(body?.alertMin) ?? null,
      alertMax: this.optionalFloat(body?.alertMax) ?? null,
      method: this.nullableText(body?.method) ?? null,
      instrument: this.nullableText(body?.instrument) ?? null,
      frequency: this.nullableText(body?.frequency) ?? null,
      correction: this.nullableText(body?.correction) ?? null,
      correctiveAction: this.nullableText(body?.correctiveAction) ?? null,
      requiresLotBlock: Boolean(body?.requiresLotBlock),
      requiresNonConformity: body?.requiresNonConformity === undefined ? true : Boolean(body.requiresNonConformity),
    };
  }

  async createControlPlan(me: AuthPayload, body: any) {
    const hazardId = this.requiredText(body?.hazardId, 'Perigo');
    const hazard = await this.loadHazard(me, hazardId);
    await this.assertProcessWriteArea(me, hazard.process.orgNodeId, 'create');
    const responsibleUserId = await this.validateUser(me.companyId, this.id(body?.responsibleUserId));
    const controlType = this.parseControlType(body?.controlType) ?? hazard.controlType ?? FoodSafetyControlType.CCP;
    return this.prisma.foodSafetyControlPlan.create({
      data: {
        companyId: me.companyId,
        hazardId,
        responsibleUserId,
        controlType,
        status: this.parseControlPlanStatus(body?.status) ?? FoodSafetyControlPlanStatus.ACTIVE,
        ...this.controlPlanData(body),
      },
      include: this.planInclude(),
    });
  }

  async updateControlPlan(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadControlPlan(me, id);
    await this.assertProcessWriteArea(me, before.hazard.process?.orgNodeId ?? null, 'edit');
    const data: any = {};
    const fields = this.controlPlanData(patch);
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
      if (key in (patch ?? {})) data[key] = fields[key];
    }
    if ('controlType' in (patch ?? {})) data.controlType = this.parseControlType(patch.controlType);
    if ('status' in (patch ?? {})) data.status = this.parseControlPlanStatus(patch.status);
    if ('responsibleUserId' in (patch ?? {})) data.responsibleUserId = await this.validateUser(me.companyId, this.id(patch.responsibleUserId));
    return this.prisma.foodSafetyControlPlan.update({ where: { id }, data, include: this.planInclude() });
  }

  async removeControlPlan(me: AuthPayload, id: string) {
    const plan = await this.loadControlPlan(me, id);
    await this.assertProcessWriteArea(me, plan.hazard.process?.orgNodeId ?? null, 'delete');
    return this.prisma.foodSafetyControlPlan.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private evaluateMonitoring(
    plan: { criticalMin: number | null; criticalMax: number | null; alertMin: number | null; alertMax: number | null },
    valueNum: number | null,
  ): FoodSafetyMonitoringResult {
    if (valueNum == null) return FoodSafetyMonitoringResult.OK;
    if ((plan.criticalMin != null && valueNum < plan.criticalMin) || (plan.criticalMax != null && valueNum > plan.criticalMax)) {
      return FoodSafetyMonitoringResult.OUT;
    }
    if ((plan.alertMin != null && valueNum < plan.alertMin) || (plan.alertMax != null && valueNum > plan.alertMax)) {
      return FoodSafetyMonitoringResult.ALERT;
    }
    return FoodSafetyMonitoringResult.OK;
  }

  async listRecords(me: AuthPayload, controlPlanId: string) {
    await this.loadControlPlan(me, controlPlanId); // garante escopo
    return this.prisma.foodSafetyMonitoringRecord.findMany({
      where: { companyId: me.companyId, controlPlanId, deletedAt: null },
      include: { recordedBy: { select: { id: true, name: true } } },
      orderBy: { measuredAt: 'desc' },
      take: 200,
    });
  }

  async recordMonitoring(me: AuthPayload, controlPlanId: string, body: any) {
    const plan = await this.loadControlPlan(me, controlPlanId);
    await this.assertProcessWriteArea(me, plan.hazard.process?.orgNodeId ?? null, 'edit');
    const valueNum = this.optionalFloat(body?.valueNum) ?? null;
    let result = this.evaluateMonitoring(plan, valueNum);
    // Sem valor numerico (limite textual), aceita classificacao manual.
    if (valueNum == null && body?.result) result = this.parseResult(body.result) ?? result;

    const isOut = result === FoodSafetyMonitoringResult.OUT;
    const lotBlocked = isOut && plan.requiresLotBlock;
    let nonConformityId: string | null = null;

    if (isOut && plan.requiresNonConformity) {
      try {
        const nc = (await this.nonConformities.create(me, {
          title: `Desvio de monitoramento — ${plan.parameter ?? plan.hazard.name}`,
          description: `Valor "${valueNum ?? this.nullableText(body?.valueText) ?? '-'}" fora do limite no controle ${plan.controlType} do processo "${plan.hazard.process?.name ?? '-'}".`,
          source: 'PROCESS',
          severity: plan.controlType === FoodSafetyControlType.CCP ? 'CRITICAL' : 'MAJOR',
          orgNodeId: plan.hazard.process?.orgNodeId ?? null,
          immediateAction: plan.correction ?? null,
        })) as { id?: string };
        nonConformityId = nc?.id ?? null;
      } catch (err) {
        // Nao bloqueia o registro do monitoramento se a abertura da NC falhar, mas registra.
        logSwallowed('foodSafety.monitoring.openNonConformity', err);
      }
    }

    return this.prisma.foodSafetyMonitoringRecord.create({
      data: {
        companyId: me.companyId,
        controlPlanId,
        recordedById: me.sub,
        measuredAt: this.optionalDate(body?.measuredAt) ?? new Date(),
        valueNum,
        valueText: this.nullableText(body?.valueText) ?? null,
        result,
        notes: this.nullableText(body?.notes) ?? null,
        evidenceUrl: this.nullableText(body?.evidenceUrl) ?? null,
        lotBlocked,
        nonConformityId,
      },
      include: { recordedBy: { select: { id: true, name: true } } },
    });
  }

  // ----------------------------- compliance / requisitos --------------------
  private parseVersionStatus(v?: string): FoodSafetyStandardVersionStatus | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyStandardVersionStatus).includes(v as FoodSafetyStandardVersionStatus)) throw new BadRequestException('Status de versao invalido.');
    return v as FoodSafetyStandardVersionStatus;
  }
  private parseComplianceResult(v?: string): FoodSafetyComplianceResult | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyComplianceResult).includes(v as FoodSafetyComplianceResult)) throw new BadRequestException('Resultado de avaliacao invalido.');
    return v as FoodSafetyComplianceResult;
  }
  private parseCriticality(v?: string): FoodSafetyRequirementCriticality | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyRequirementCriticality).includes(v as FoodSafetyRequirementCriticality)) throw new BadRequestException('Criticidade invalida.');
    return v as FoodSafetyRequirementCriticality;
  }

  // --- normas (catalogo) ---
  async listStandards(me: AuthPayload, filters: { search?: string } = {}) {
    const term = filters.search?.trim();
    return this.prisma.foodSafetyStandard.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(term
          ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { code: { contains: term, mode: 'insensitive' } }, { origin: { contains: term, mode: 'insensitive' } }] }
          : {}),
      },
      include: {
        versions: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, select: { id: true, versionLabel: true, status: true, effectiveDate: true, _count: { select: { requirements: true } } } },
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  private async loadStandard(me: AuthPayload, id: string) {
    const std = await this.prisma.foodSafetyStandard.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!std) throw new NotFoundException('Norma nao encontrada');
    return std;
  }

  async createStandard(me: AuthPayload, body: any) {
    return this.prisma.foodSafetyStandard.create({
      data: {
        companyId: me.companyId,
        name: this.requiredText(body?.name, 'Nome'),
        code: this.nullableText(body?.code) ?? null,
        origin: this.nullableText(body?.origin) ?? null,
        description: this.nullableText(body?.description) ?? null,
        active: body?.active === undefined ? true : Boolean(body.active),
      },
    });
  }

  async updateStandard(me: AuthPayload, id: string, patch: any) {
    await this.loadStandard(me, id);
    const data: any = {};
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome');
    if ('code' in (patch ?? {})) data.code = this.nullableText(patch.code);
    if ('origin' in (patch ?? {})) data.origin = this.nullableText(patch.origin);
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('active' in (patch ?? {})) data.active = Boolean(patch.active);
    return this.prisma.foodSafetyStandard.update({ where: { id }, data });
  }

  async removeStandard(me: AuthPayload, id: string) {
    await this.loadStandard(me, id);
    return this.prisma.foodSafetyStandard.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // --- versoes ---
  private async loadVersion(me: AuthPayload, id: string) {
    const version = await this.prisma.foodSafetyStandardVersion.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: { standard: { select: { id: true, name: true, code: true } } },
    });
    if (!version) throw new NotFoundException('Versao da norma nao encontrada');
    return version;
  }

  async createVersion(me: AuthPayload, body: any) {
    const standardId = this.requiredText(body?.standardId, 'Norma');
    await this.loadStandard(me, standardId);
    return this.prisma.foodSafetyStandardVersion.create({
      data: {
        companyId: me.companyId,
        standardId,
        versionLabel: this.requiredText(body?.versionLabel, 'Versao'),
        effectiveDate: this.optionalDate(body?.effectiveDate) ?? null,
        status: this.parseVersionStatus(body?.status) ?? FoodSafetyStandardVersionStatus.DRAFT,
        notes: this.nullableText(body?.notes) ?? null,
      },
      include: { standard: { select: { id: true, name: true, code: true } } },
    });
  }

  async updateVersion(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadVersion(me, id);
    const data: any = {};
    if ('versionLabel' in (patch ?? {})) data.versionLabel = this.requiredText(patch.versionLabel, 'Versao');
    if ('effectiveDate' in (patch ?? {})) data.effectiveDate = this.optionalDate(patch.effectiveDate);
    if ('notes' in (patch ?? {})) data.notes = this.nullableText(patch.notes);
    const status = 'status' in (patch ?? {}) ? this.parseVersionStatus(patch.status) : undefined;
    if (status && status === FoodSafetyStandardVersionStatus.ACTIVE) {
      return this.prisma.$transaction(async (tx) => {
        await tx.foodSafetyStandardVersion.updateMany({
          where: { companyId: me.companyId, standardId: before.standardId, status: FoodSafetyStandardVersionStatus.ACTIVE, id: { not: id } },
          data: { status: FoodSafetyStandardVersionStatus.SUPERSEDED },
        });
        return tx.foodSafetyStandardVersion.update({ where: { id }, data: { ...data, status }, include: { standard: { select: { id: true, name: true, code: true } } } });
      });
    }
    if (status) data.status = status;
    return this.prisma.foodSafetyStandardVersion.update({ where: { id }, data, include: { standard: { select: { id: true, name: true, code: true } } } });
  }

  async removeVersion(me: AuthPayload, id: string) {
    await this.loadVersion(me, id);
    return this.prisma.foodSafetyStandardVersion.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // --- requisitos ---
  private requirementInclude() {
    return {
      standardVersion: { select: { id: true, versionLabel: true, standard: { select: { id: true, name: true, code: true } } } },
      responsible: { select: { id: true, name: true, email: true } },
      assessments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        include: { responsible: { select: { id: true, name: true } } },
      },
    } satisfies Prisma.FoodSafetyRequirementInclude;
  }

  private async loadRequirement(me: AuthPayload, id: string) {
    const req = await this.prisma.foodSafetyRequirement.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: this.requirementInclude(),
    });
    if (!req) throw new NotFoundException('Requisito nao encontrado');
    return req;
  }

  async listRequirements(me: AuthPayload, filters: { standardVersionId?: string; result?: string; search?: string } = {}) {
    const term = filters.search?.trim();
    const result = this.parseComplianceResult(filters.result);
    const items = await this.prisma.foodSafetyRequirement.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(filters.standardVersionId ? { standardVersionId: filters.standardVersionId } : {}),
        ...(term
          ? { OR: [{ title: { contains: term, mode: 'insensitive' } }, { code: { contains: term, mode: 'insensitive' } }, { chapter: { contains: term, mode: 'insensitive' } }] }
          : {}),
      },
      include: this.requirementInclude(),
      orderBy: [{ chapter: 'asc' }, { code: 'asc' }, { createdAt: 'asc' }],
    });
    if (!result) return items;
    return items.filter((r) => (r.assessments[0]?.result ?? FoodSafetyComplianceResult.PENDING) === result);
  }

  async createRequirement(me: AuthPayload, body: any) {
    const standardVersionId = this.requiredText(body?.standardVersionId, 'Versao da norma');
    await this.loadVersion(me, standardVersionId);
    const responsibleUserId = await this.validateUser(me.companyId, this.id(body?.responsibleUserId));
    return this.prisma.foodSafetyRequirement.create({
      data: {
        companyId: me.companyId,
        standardVersionId,
        responsibleUserId,
        title: this.requiredText(body?.title, 'Titulo'),
        code: this.nullableText(body?.code) ?? null,
        chapter: this.nullableText(body?.chapter) ?? null,
        item: this.nullableText(body?.item) ?? null,
        subitem: this.nullableText(body?.subitem) ?? null,
        description: this.nullableText(body?.description) ?? null,
        applicability: this.nullableText(body?.applicability) ?? null,
        evidenceRequired: this.nullableText(body?.evidenceRequired) ?? null,
        criticality: this.parseCriticality(body?.criticality) ?? FoodSafetyRequirementCriticality.MEDIUM,
        periodicityDays: this.optionalInt(body?.periodicityDays, 1) ?? null,
        active: body?.active === undefined ? true : Boolean(body.active),
      },
      include: this.requirementInclude(),
    });
  }

  async updateRequirement(me: AuthPayload, id: string, patch: any) {
    await this.loadRequirement(me, id);
    const data: any = {};
    if ('title' in (patch ?? {})) data.title = this.requiredText(patch.title, 'Titulo');
    if ('code' in (patch ?? {})) data.code = this.nullableText(patch.code);
    if ('chapter' in (patch ?? {})) data.chapter = this.nullableText(patch.chapter);
    if ('item' in (patch ?? {})) data.item = this.nullableText(patch.item);
    if ('subitem' in (patch ?? {})) data.subitem = this.nullableText(patch.subitem);
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('applicability' in (patch ?? {})) data.applicability = this.nullableText(patch.applicability);
    if ('evidenceRequired' in (patch ?? {})) data.evidenceRequired = this.nullableText(patch.evidenceRequired);
    if ('criticality' in (patch ?? {})) data.criticality = this.parseCriticality(patch.criticality);
    if ('periodicityDays' in (patch ?? {})) data.periodicityDays = this.optionalInt(patch.periodicityDays, 1);
    if ('active' in (patch ?? {})) data.active = Boolean(patch.active);
    if ('responsibleUserId' in (patch ?? {})) data.responsibleUserId = await this.validateUser(me.companyId, this.id(patch.responsibleUserId));
    return this.prisma.foodSafetyRequirement.update({ where: { id }, data, include: this.requirementInclude() });
  }

  async removeRequirement(me: AuthPayload, id: string) {
    await this.loadRequirement(me, id);
    return this.prisma.foodSafetyRequirement.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // --- avaliacoes (cada avaliacao e um registro no historico; a mais recente vale) ---
  async assessRequirement(me: AuthPayload, requirementId: string, body: any) {
    const req = await this.loadRequirement(me, requirementId);
    const result = this.parseComplianceResult(body?.result) ?? FoodSafetyComplianceResult.PENDING;
    const responsibleUserId = await this.validateUser(me.companyId, this.id(body?.responsibleUserId));
    const periodicity = req.periodicityDays ?? null;
    const assessedAt = this.optionalDate(body?.assessedAt) ?? new Date();
    let nextAssessmentAt = this.optionalDate(body?.nextAssessmentAt) ?? null;
    if (!nextAssessmentAt && periodicity) nextAssessmentAt = new Date(assessedAt.getTime() + periodicity * 86400000);
    return this.prisma.foodSafetyRequirementAssessment.create({
      data: {
        companyId: me.companyId,
        requirementId,
        responsibleUserId,
        result,
        evidence: this.nullableText(body?.evidence) ?? null,
        notes: this.nullableText(body?.notes) ?? null,
        assessedAt,
        nextAssessmentAt,
      },
      include: { responsible: { select: { id: true, name: true } } },
    });
  }

  async complianceSummary(me: AuthPayload, standardVersionId?: string) {
    const reqs = await this.prisma.foodSafetyRequirement.findMany({
      where: { companyId: me.companyId, deletedAt: null, active: true, ...(standardVersionId ? { standardVersionId } : {}) },
      include: { assessments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1, select: { result: true } } },
    });
    const byResult = Object.fromEntries(Object.values(FoodSafetyComplianceResult).map((r) => [r, 0])) as Record<FoodSafetyComplianceResult, number>;
    for (const r of reqs) {
      byResult[r.assessments[0]?.result ?? FoodSafetyComplianceResult.PENDING]++;
    }
    const applicable = reqs.length - byResult[FoodSafetyComplianceResult.NOT_APPLICABLE];
    const compliancePct = applicable > 0 ? Math.round((byResult[FoodSafetyComplianceResult.MET] / applicable) * 100) : 0;
    return {
      requirements: reqs.length,
      met: byResult[FoodSafetyComplianceResult.MET],
      partial: byResult[FoodSafetyComplianceResult.PARTIAL],
      notMet: byResult[FoodSafetyComplianceResult.NOT_MET],
      notApplicable: byResult[FoodSafetyComplianceResult.NOT_APPLICABLE],
      pending: byResult[FoodSafetyComplianceResult.PENDING],
      applicable,
      compliancePct,
      byResult,
    };
  }

  // ----------------------------- cadeia / fornecedores / recall ------------
  private parseSupplierStatus(v?: string): FoodSafetySupplierStatus | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetySupplierStatus).includes(v as FoodSafetySupplierStatus)) throw new BadRequestException('Status de fornecedor invalido.');
    return v as FoodSafetySupplierStatus;
  }
  private parseSupplierCriticality(v?: string): FoodSafetySupplierCriticality | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetySupplierCriticality).includes(v as FoodSafetySupplierCriticality)) throw new BadRequestException('Criticidade de fornecedor invalida.');
    return v as FoodSafetySupplierCriticality;
  }
  private parseMaterialCategory(v?: string): FoodSafetyMaterialCategory | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyMaterialCategory).includes(v as FoodSafetyMaterialCategory)) throw new BadRequestException('Categoria de material invalida.');
    return v as FoodSafetyMaterialCategory;
  }
  private parseMaterialStatus(v?: string): FoodSafetyMaterialStatus | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyMaterialStatus).includes(v as FoodSafetyMaterialStatus)) throw new BadRequestException('Status de material invalido.');
    return v as FoodSafetyMaterialStatus;
  }
  private parseLotType(v?: string): FoodSafetyLotType | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyLotType).includes(v as FoodSafetyLotType)) throw new BadRequestException('Tipo de lote invalido.');
    return v as FoodSafetyLotType;
  }
  private parseLotStatus(v?: string): FoodSafetyLotStatus | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyLotStatus).includes(v as FoodSafetyLotStatus)) throw new BadRequestException('Status de lote invalido.');
    return v as FoodSafetyLotStatus;
  }
  private parseTraceEventType(v?: string): FoodSafetyTraceEventType | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyTraceEventType).includes(v as FoodSafetyTraceEventType)) throw new BadRequestException('Tipo de evento de rastreabilidade invalido.');
    return v as FoodSafetyTraceEventType;
  }
  private parseRecallStatus(v?: string): FoodSafetyRecallStatus | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyRecallStatus).includes(v as FoodSafetyRecallStatus)) throw new BadRequestException('Status de recall invalido.');
    return v as FoodSafetyRecallStatus;
  }
  private parseRecallSeverity(v?: string): FoodSafetyRecallSeverity | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyRecallSeverity).includes(v as FoodSafetyRecallSeverity)) throw new BadRequestException('Severidade de recall invalida.');
    return v as FoodSafetyRecallSeverity;
  }
  private parseRecallItemStatus(v?: string): FoodSafetyRecallItemStatus | undefined {
    if (!v) return undefined;
    if (!Object.values(FoodSafetyRecallItemStatus).includes(v as FoodSafetyRecallItemStatus)) throw new BadRequestException('Status de item de recall invalido.');
    return v as FoodSafetyRecallItemStatus;
  }

  private supplierInclude() {
    return {
      program: { select: { id: true, name: true, code: true } },
      orgNode: { select: { id: true, name: true, type: true } },
      responsible: { select: { id: true, name: true, email: true } },
      _count: { select: { materials: true, lots: true } },
    } satisfies Prisma.FoodSafetySupplierInclude;
  }

  private materialInclude() {
    return {
      program: { select: { id: true, name: true, code: true } },
      supplier: { select: { id: true, name: true, code: true, status: true, criticality: true } },
      _count: { select: { lots: true } },
    } satisfies Prisma.FoodSafetyMaterialInclude;
  }

  private lotInclude() {
    return {
      program: { select: { id: true, name: true, code: true } },
      material: { select: { id: true, name: true, code: true, category: true, allergens: true } },
      supplier: { select: { id: true, name: true, code: true, status: true } },
      process: { select: { id: true, name: true, code: true, orgNodeId: true, programId: true } },
      _count: { select: { outgoingTraceLinks: true, incomingTraceLinks: true, recallItems: true } },
    } satisfies Prisma.FoodSafetyLotInclude;
  }

  private traceLinkInclude() {
    return {
      fromLot: { include: { material: { select: { id: true, name: true, code: true } }, supplier: { select: { id: true, name: true, code: true } } } },
      toLot: { include: { material: { select: { id: true, name: true, code: true } }, supplier: { select: { id: true, name: true, code: true } } } },
      process: { select: { id: true, name: true, code: true } },
      step: { select: { id: true, number: true, name: true } },
    } satisfies Prisma.FoodSafetyTraceLinkInclude;
  }

  private recallInclude() {
    return {
      program: { select: { id: true, name: true, code: true } },
      rootLot: { include: { material: { select: { id: true, name: true, code: true } }, supplier: { select: { id: true, name: true, code: true } } } },
      responsible: { select: { id: true, name: true, email: true } },
      items: {
        where: { deletedAt: null },
        include: { lot: { include: { material: { select: { id: true, name: true, code: true } }, supplier: { select: { id: true, name: true, code: true } } } } },
        orderBy: { createdAt: 'asc' as const },
      },
    } satisfies Prisma.FoodSafetyRecallInclude;
  }

  private async validateProgram(me: AuthPayload, programId: string | null) {
    if (!programId) return null;
    await this.getProgram(me, programId);
    return programId;
  }

  private async loadSupplier(me: AuthPayload, id: string) {
    const supplier = await this.prisma.foodSafetySupplier.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: this.supplierInclude(),
    });
    if (!supplier) throw new NotFoundException('Fornecedor nao encontrado');
    return supplier;
  }

  async listSuppliers(me: AuthPayload, filters: { programId?: string; status?: string; criticality?: string; search?: string } = {}) {
    const status = this.parseSupplierStatus(filters.status);
    const criticality = this.parseSupplierCriticality(filters.criticality);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: Prisma.FoodSafetySupplierWhereInput[] = [];
    if (permitted) and.push({ OR: [{ orgNodeId: null }, { orgNodeId: { in: permitted } }] });
    const term = filters.search?.trim();
    if (term) {
      and.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { legalName: { contains: term, mode: 'insensitive' } },
          { code: { contains: term, mode: 'insensitive' } },
          { taxId: { contains: term, mode: 'insensitive' } },
        ],
      });
    }
    return this.prisma.foodSafetySupplier.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(filters.programId ? { programId: filters.programId } : {}),
        ...(status ? { status } : {}),
        ...(criticality ? { criticality } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      include: this.supplierInclude(),
      orderBy: [{ criticality: 'desc' }, { name: 'asc' }],
    });
  }

  async createSupplier(me: AuthPayload, body: any) {
    const orgNodeId = await this.validateOrgNode(me.companyId, this.id(body?.orgNodeId));
    await this.assertProcessWriteArea(me, orgNodeId, 'create');
    return this.prisma.foodSafetySupplier.create({
      data: {
        companyId: me.companyId,
        programId: await this.validateProgram(me, this.id(body?.programId)),
        orgNodeId,
        responsibleUserId: await this.validateUser(me.companyId, this.id(body?.responsibleUserId)),
        code: this.nullableText(body?.code) ?? null,
        name: this.requiredText(body?.name, 'Nome do fornecedor'),
        legalName: this.nullableText(body?.legalName) ?? null,
        taxId: this.nullableText(body?.taxId) ?? null,
        contactName: this.nullableText(body?.contactName) ?? null,
        contactEmail: this.nullableText(body?.contactEmail) ?? null,
        contactPhone: this.nullableText(body?.contactPhone) ?? null,
        address: this.nullableText(body?.address) ?? null,
        suppliedCategories: this.nullableText(body?.suppliedCategories) ?? null,
        criticality: this.parseSupplierCriticality(body?.criticality) ?? FoodSafetySupplierCriticality.MEDIUM,
        status: this.parseSupplierStatus(body?.status) ?? FoodSafetySupplierStatus.PROSPECT,
        score: this.optionalFloat(body?.score) ?? null,
        documentsStatus: this.nullableText(body?.documentsStatus) ?? null,
        lastAuditAt: this.optionalDate(body?.lastAuditAt) ?? null,
        nextReviewAt: this.optionalDate(body?.nextReviewAt) ?? null,
        notes: this.nullableText(body?.notes) ?? null,
      },
      include: this.supplierInclude(),
    });
  }

  async updateSupplier(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadSupplier(me, id);
    await this.assertProcessWriteArea(me, before.orgNodeId, 'edit');
    const data: Prisma.FoodSafetySupplierUpdateInput = {};
    if ('programId' in (patch ?? {})) data.program = this.id(patch.programId) ? { connect: { id: await this.validateProgram(me, this.id(patch.programId)) as string } } : { disconnect: true };
    if ('orgNodeId' in (patch ?? {})) {
      const orgNodeId = await this.validateOrgNode(me.companyId, this.id(patch.orgNodeId));
      await this.assertProcessWriteArea(me, orgNodeId, 'edit');
      data.orgNode = orgNodeId ? { connect: { id: orgNodeId } } : { disconnect: true };
    }
    if ('responsibleUserId' in (patch ?? {})) {
      const responsibleUserId = await this.validateUser(me.companyId, this.id(patch.responsibleUserId));
      data.responsible = responsibleUserId ? { connect: { id: responsibleUserId } } : { disconnect: true };
    }
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome do fornecedor');
    if ('code' in (patch ?? {})) data.code = this.nullableText(patch.code);
    if ('legalName' in (patch ?? {})) data.legalName = this.nullableText(patch.legalName);
    if ('taxId' in (patch ?? {})) data.taxId = this.nullableText(patch.taxId);
    if ('contactName' in (patch ?? {})) data.contactName = this.nullableText(patch.contactName);
    if ('contactEmail' in (patch ?? {})) data.contactEmail = this.nullableText(patch.contactEmail);
    if ('contactPhone' in (patch ?? {})) data.contactPhone = this.nullableText(patch.contactPhone);
    if ('address' in (patch ?? {})) data.address = this.nullableText(patch.address);
    if ('suppliedCategories' in (patch ?? {})) data.suppliedCategories = this.nullableText(patch.suppliedCategories);
    if ('criticality' in (patch ?? {})) data.criticality = this.parseSupplierCriticality(patch.criticality);
    if ('status' in (patch ?? {})) data.status = this.parseSupplierStatus(patch.status);
    if ('score' in (patch ?? {})) data.score = this.optionalFloat(patch.score);
    if ('documentsStatus' in (patch ?? {})) data.documentsStatus = this.nullableText(patch.documentsStatus);
    if ('lastAuditAt' in (patch ?? {})) data.lastAuditAt = this.optionalDate(patch.lastAuditAt);
    if ('nextReviewAt' in (patch ?? {})) data.nextReviewAt = this.optionalDate(patch.nextReviewAt);
    if ('notes' in (patch ?? {})) data.notes = this.nullableText(patch.notes);
    return this.prisma.foodSafetySupplier.update({ where: { id }, data, include: this.supplierInclude() });
  }

  async removeSupplier(me: AuthPayload, id: string) {
    const supplier = await this.loadSupplier(me, id);
    await this.assertProcessWriteArea(me, supplier.orgNodeId, 'delete');
    return this.prisma.foodSafetySupplier.update({ where: { id }, data: { deletedAt: new Date() }, include: this.supplierInclude() });
  }

  private async loadMaterial(me: AuthPayload, id: string) {
    const material = await this.prisma.foodSafetyMaterial.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: this.materialInclude(),
    });
    if (!material) throw new NotFoundException('Materia-prima/material nao encontrado');
    return material;
  }

  async listMaterials(me: AuthPayload, filters: { programId?: string; supplierId?: string; category?: string; status?: string; search?: string } = {}) {
    const category = this.parseMaterialCategory(filters.category);
    const status = this.parseMaterialStatus(filters.status);
    const term = filters.search?.trim();
    return this.prisma.foodSafetyMaterial.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(filters.programId ? { programId: filters.programId } : {}),
        ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
        ...(category ? { category } : {}),
        ...(status ? { status } : {}),
        ...(term ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { code: { contains: term, mode: 'insensitive' } }, { specification: { contains: term, mode: 'insensitive' } }] } : {}),
      },
      include: this.materialInclude(),
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async createMaterial(me: AuthPayload, body: any) {
    const supplierId = this.id(body?.supplierId);
    const supplier = supplierId ? await this.loadSupplier(me, supplierId) : null;
    const programId = await this.validateProgram(me, this.id(body?.programId) ?? supplier?.programId ?? null);
    return this.prisma.foodSafetyMaterial.create({
      data: {
        companyId: me.companyId,
        programId,
        supplierId,
        code: this.nullableText(body?.code) ?? null,
        name: this.requiredText(body?.name, 'Nome do material'),
        category: this.parseMaterialCategory(body?.category) ?? FoodSafetyMaterialCategory.RAW_MATERIAL,
        unit: this.nullableText(body?.unit) ?? null,
        specification: this.nullableText(body?.specification) ?? null,
        storageCondition: this.nullableText(body?.storageCondition) ?? null,
        allergens: this.nullableText(body?.allergens) ?? null,
        hazards: this.nullableText(body?.hazards) ?? null,
        requiredDocuments: this.nullableText(body?.requiredDocuments) ?? null,
        shelfLifeDays: this.optionalInt(body?.shelfLifeDays, 1) ?? null,
        status: this.parseMaterialStatus(body?.status) ?? FoodSafetyMaterialStatus.ACTIVE,
      },
      include: this.materialInclude(),
    });
  }

  async updateMaterial(me: AuthPayload, id: string, patch: any) {
    await this.loadMaterial(me, id);
    const data: any = {};
    if ('programId' in (patch ?? {})) data.programId = await this.validateProgram(me, this.id(patch.programId));
    if ('supplierId' in (patch ?? {})) {
      const supplierId = this.id(patch.supplierId);
      if (supplierId) await this.loadSupplier(me, supplierId);
      data.supplierId = supplierId;
    }
    if ('code' in (patch ?? {})) data.code = this.nullableText(patch.code);
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome do material');
    if ('category' in (patch ?? {})) data.category = this.parseMaterialCategory(patch.category);
    if ('unit' in (patch ?? {})) data.unit = this.nullableText(patch.unit);
    if ('specification' in (patch ?? {})) data.specification = this.nullableText(patch.specification);
    if ('storageCondition' in (patch ?? {})) data.storageCondition = this.nullableText(patch.storageCondition);
    if ('allergens' in (patch ?? {})) data.allergens = this.nullableText(patch.allergens);
    if ('hazards' in (patch ?? {})) data.hazards = this.nullableText(patch.hazards);
    if ('requiredDocuments' in (patch ?? {})) data.requiredDocuments = this.nullableText(patch.requiredDocuments);
    if ('shelfLifeDays' in (patch ?? {})) data.shelfLifeDays = this.optionalInt(patch.shelfLifeDays, 1);
    if ('status' in (patch ?? {})) data.status = this.parseMaterialStatus(patch.status);
    return this.prisma.foodSafetyMaterial.update({ where: { id }, data, include: this.materialInclude() });
  }

  async removeMaterial(me: AuthPayload, id: string) {
    await this.loadMaterial(me, id);
    return this.prisma.foodSafetyMaterial.update({ where: { id }, data: { deletedAt: new Date() }, include: this.materialInclude() });
  }

  private async loadLot(me: AuthPayload, id: string) {
    const lot = await this.prisma.foodSafetyLot.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: this.lotInclude(),
    });
    if (!lot) throw new NotFoundException('Lote nao encontrado');
    return lot;
  }

  async listLots(me: AuthPayload, filters: { programId?: string; materialId?: string; supplierId?: string; type?: string; status?: string; search?: string } = {}) {
    const type = this.parseLotType(filters.type);
    const status = this.parseLotStatus(filters.status);
    const term = filters.search?.trim();
    return this.prisma.foodSafetyLot.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(filters.programId ? { programId: filters.programId } : {}),
        ...(filters.materialId ? { materialId: filters.materialId } : {}),
        ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(term ? { OR: [{ code: { contains: term, mode: 'insensitive' } }, { storageLocation: { contains: term, mode: 'insensitive' } }, { customerName: { contains: term, mode: 'insensitive' } }] } : {}),
      },
      include: this.lotInclude(),
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
    });
  }

  async createLot(me: AuthPayload, body: any) {
    const materialId = this.id(body?.materialId);
    const material = materialId ? await this.loadMaterial(me, materialId) : null;
    const supplierId = this.id(body?.supplierId) ?? material?.supplierId ?? null;
    if (supplierId) await this.loadSupplier(me, supplierId);
    const processId = this.id(body?.processId);
    const process = processId ? await this.loadProcess(me, processId) : null;
    if (process) await this.assertProcessWriteArea(me, process.orgNodeId, 'create');
    const programId = await this.validateProgram(me, this.id(body?.programId) ?? material?.programId ?? process?.programId ?? null);
    return this.prisma.foodSafetyLot.create({
      data: {
        companyId: me.companyId,
        programId,
        materialId,
        supplierId,
        processId,
        code: this.requiredText(body?.code, 'Codigo do lote'),
        type: this.parseLotType(body?.type) ?? FoodSafetyLotType.RECEIVED,
        status: this.parseLotStatus(body?.status) ?? FoodSafetyLotStatus.QUARANTINED,
        quantity: this.optionalFloat(body?.quantity) ?? null,
        unit: this.nullableText(body?.unit) ?? material?.unit ?? null,
        receivedAt: this.optionalDate(body?.receivedAt) ?? null,
        producedAt: this.optionalDate(body?.producedAt) ?? null,
        expiresAt: this.optionalDate(body?.expiresAt) ?? null,
        storageLocation: this.nullableText(body?.storageLocation) ?? null,
        customerName: this.nullableText(body?.customerName) ?? null,
        destination: this.nullableText(body?.destination) ?? null,
        certificateUrl: this.nullableText(body?.certificateUrl) ?? null,
        notes: this.nullableText(body?.notes) ?? null,
      },
      include: this.lotInclude(),
    });
  }

  async updateLot(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadLot(me, id);
    await this.assertProcessWriteArea(me, before.process?.orgNodeId ?? null, 'edit');
    const data: any = {};
    if ('programId' in (patch ?? {})) data.programId = await this.validateProgram(me, this.id(patch.programId));
    if ('materialId' in (patch ?? {})) {
      const materialId = this.id(patch.materialId);
      if (materialId) await this.loadMaterial(me, materialId);
      data.materialId = materialId;
    }
    if ('supplierId' in (patch ?? {})) {
      const supplierId = this.id(patch.supplierId);
      if (supplierId) await this.loadSupplier(me, supplierId);
      data.supplierId = supplierId;
    }
    if ('processId' in (patch ?? {})) {
      const processId = this.id(patch.processId);
      const process = processId ? await this.loadProcess(me, processId) : null;
      if (process) await this.assertProcessWriteArea(me, process.orgNodeId, 'edit');
      data.processId = processId;
    }
    if ('code' in (patch ?? {})) data.code = this.requiredText(patch.code, 'Codigo do lote');
    if ('type' in (patch ?? {})) data.type = this.parseLotType(patch.type);
    if ('status' in (patch ?? {})) data.status = this.parseLotStatus(patch.status);
    if ('quantity' in (patch ?? {})) data.quantity = this.optionalFloat(patch.quantity);
    if ('unit' in (patch ?? {})) data.unit = this.nullableText(patch.unit);
    if ('receivedAt' in (patch ?? {})) data.receivedAt = this.optionalDate(patch.receivedAt);
    if ('producedAt' in (patch ?? {})) data.producedAt = this.optionalDate(patch.producedAt);
    if ('expiresAt' in (patch ?? {})) data.expiresAt = this.optionalDate(patch.expiresAt);
    if ('storageLocation' in (patch ?? {})) data.storageLocation = this.nullableText(patch.storageLocation);
    if ('customerName' in (patch ?? {})) data.customerName = this.nullableText(patch.customerName);
    if ('destination' in (patch ?? {})) data.destination = this.nullableText(patch.destination);
    if ('certificateUrl' in (patch ?? {})) data.certificateUrl = this.nullableText(patch.certificateUrl);
    if ('notes' in (patch ?? {})) data.notes = this.nullableText(patch.notes);
    return this.prisma.foodSafetyLot.update({ where: { id }, data, include: this.lotInclude() });
  }

  async removeLot(me: AuthPayload, id: string) {
    const lot = await this.loadLot(me, id);
    await this.assertProcessWriteArea(me, lot.process?.orgNodeId ?? null, 'delete');
    return this.prisma.foodSafetyLot.update({ where: { id }, data: { deletedAt: new Date() }, include: this.lotInclude() });
  }

  async listTraceLinks(me: AuthPayload, filters: { lotId?: string; programId?: string } = {}) {
    return this.prisma.foodSafetyTraceLink.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(filters.lotId ? { OR: [{ fromLotId: filters.lotId }, { toLotId: filters.lotId }] } : {}),
        ...(filters.programId ? { OR: [{ fromLot: { programId: filters.programId } }, { toLot: { programId: filters.programId } }] } : {}),
      },
      include: this.traceLinkInclude(),
      orderBy: { occurredAt: 'desc' },
      take: 300,
    });
  }

  async createTraceLink(me: AuthPayload, body: any) {
    const fromLotId = this.id(body?.fromLotId);
    const toLotId = this.id(body?.toLotId);
    if (!fromLotId && !toLotId) throw new BadRequestException('Informe ao menos um lote de origem ou destino.');
    if (fromLotId && toLotId && fromLotId === toLotId) throw new BadRequestException('Origem e destino devem ser lotes diferentes.');
    if (fromLotId) await this.loadLot(me, fromLotId);
    if (toLotId) await this.loadLot(me, toLotId);
    let processId = this.id(body?.processId);
    const stepId = this.id(body?.stepId);
    if (stepId) {
      const step = await this.loadStep(me, stepId);
      if (processId && step.processId !== processId) throw new BadRequestException('Etapa nao pertence ao processo informado.');
      processId = step.processId;
    }
    const process = processId ? await this.loadProcess(me, processId) : null;
    if (process) await this.assertProcessWriteArea(me, process.orgNodeId, 'edit');
    return this.prisma.foodSafetyTraceLink.create({
      data: {
        companyId: me.companyId,
        fromLotId,
        toLotId,
        processId,
        stepId,
        eventType: this.parseTraceEventType(body?.eventType) ?? FoodSafetyTraceEventType.PRODUCTION,
        quantity: this.optionalFloat(body?.quantity) ?? null,
        unit: this.nullableText(body?.unit) ?? null,
        occurredAt: this.optionalDate(body?.occurredAt) ?? new Date(),
        notes: this.nullableText(body?.notes) ?? null,
      },
      include: this.traceLinkInclude(),
    });
  }

  async traceLot(me: AuthPayload, lotId: string, depth?: string | number) {
    const rootLot = await this.loadLot(me, lotId);
    const maxDepth = Math.min(this.optionalInt(depth ?? 4, 1) ?? 4, 8);
    const links = await this.prisma.foodSafetyTraceLink.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      include: this.traceLinkInclude(),
      orderBy: { occurredAt: 'asc' },
      take: 1000,
    });
    const backward: Array<{ depth: number; link: unknown }> = [];
    const forward: Array<{ depth: number; link: unknown }> = [];
    const visitedBack = new Set<string>([lotId]);
    const visitedForward = new Set<string>([lotId]);
    const seenBackLinks = new Set<string>();
    const seenForwardLinks = new Set<string>();

    let frontier = [lotId];
    for (let level = 1; level <= maxDepth && frontier.length; level++) {
      const next: string[] = [];
      for (const link of links) {
        if (link.toLotId && frontier.includes(link.toLotId) && link.fromLotId && !seenBackLinks.has(link.id)) {
          seenBackLinks.add(link.id);
          backward.push({ depth: level, link });
          if (!visitedBack.has(link.fromLotId)) {
            visitedBack.add(link.fromLotId);
            next.push(link.fromLotId);
          }
        }
      }
      frontier = next;
    }

    frontier = [lotId];
    for (let level = 1; level <= maxDepth && frontier.length; level++) {
      const next: string[] = [];
      for (const link of links) {
        if (link.fromLotId && frontier.includes(link.fromLotId) && link.toLotId && !seenForwardLinks.has(link.id)) {
          seenForwardLinks.add(link.id);
          forward.push({ depth: level, link });
          if (!visitedForward.has(link.toLotId)) {
            visitedForward.add(link.toLotId);
            next.push(link.toLotId);
          }
        }
      }
      frontier = next;
    }

    return {
      rootLot,
      depth: maxDepth,
      backward,
      forward,
      backwardLotIds: Array.from(visitedBack).filter((id) => id !== lotId),
      forwardLotIds: Array.from(visitedForward).filter((id) => id !== lotId),
      impactedLotIds: Array.from(new Set([lotId, ...visitedForward])),
    };
  }

  private async loadRecall(me: AuthPayload, id: string) {
    const recall = await this.prisma.foodSafetyRecall.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: this.recallInclude(),
    });
    if (!recall) throw new NotFoundException('Recall nao encontrado');
    return recall;
  }

  async listRecalls(me: AuthPayload, filters: { programId?: string; status?: string; search?: string } = {}) {
    const status = this.parseRecallStatus(filters.status);
    const term = filters.search?.trim();
    return this.prisma.foodSafetyRecall.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(filters.programId ? { programId: filters.programId } : {}),
        ...(status ? { status } : {}),
        ...(term ? { OR: [{ title: { contains: term, mode: 'insensitive' } }, { code: { contains: term, mode: 'insensitive' } }, { reason: { contains: term, mode: 'insensitive' } }] } : {}),
      },
      include: this.recallInclude(),
      orderBy: { initiatedAt: 'desc' },
    });
  }

  async createRecall(me: AuthPayload, body: any) {
    const rootLotId = this.id(body?.rootLotId);
    const rootLot = rootLotId ? await this.loadLot(me, rootLotId) : null;
    const explicitItemIds = Array.isArray(body?.itemLotIds) ? body.itemLotIds.map((x: unknown) => this.id(x)).filter(Boolean) as string[] : [];
    const tracedIds = rootLotId && explicitItemIds.length === 0 ? (await this.traceLot(me, rootLotId, 5)).impactedLotIds : [];
    const itemLotIds = Array.from(new Set([...(rootLotId ? [rootLotId] : []), ...explicitItemIds, ...tracedIds]));
    for (const id of itemLotIds) await this.loadLot(me, id);
    const programId = await this.validateProgram(me, this.id(body?.programId) ?? rootLot?.programId ?? null);
    const responsibleUserId = await this.validateUser(me.companyId, this.id(body?.responsibleUserId));
    return this.prisma.foodSafetyRecall.create({
      data: {
        companyId: me.companyId,
        programId,
        rootLotId,
        responsibleUserId,
        code: this.nullableText(body?.code) ?? null,
        title: this.requiredText(body?.title, 'Titulo do recall'),
        reason: this.nullableText(body?.reason) ?? null,
        severity: this.parseRecallSeverity(body?.severity) ?? FoodSafetyRecallSeverity.MEDIUM,
        status: this.parseRecallStatus(body?.status) ?? FoodSafetyRecallStatus.SIMULATION,
        scopeDescription: this.nullableText(body?.scopeDescription) ?? null,
        affectedQuantity: this.optionalFloat(body?.affectedQuantity) ?? null,
        unit: this.nullableText(body?.unit) ?? rootLot?.unit ?? null,
        initiatedAt: this.optionalDate(body?.initiatedAt) ?? new Date(),
        closedAt: this.optionalDate(body?.closedAt) ?? null,
        actions: this.nullableText(body?.actions) ?? null,
        notes: this.nullableText(body?.notes) ?? null,
        items: itemLotIds.length ? { create: itemLotIds.map((lotId) => ({ companyId: me.companyId, lotId })) } : undefined,
      },
      include: this.recallInclude(),
    });
  }

  async updateRecall(me: AuthPayload, id: string, patch: any) {
    await this.loadRecall(me, id);
    const data: any = {};
    if ('programId' in (patch ?? {})) data.programId = await this.validateProgram(me, this.id(patch.programId));
    if ('rootLotId' in (patch ?? {})) {
      const rootLotId = this.id(patch.rootLotId);
      if (rootLotId) await this.loadLot(me, rootLotId);
      data.rootLotId = rootLotId;
    }
    if ('responsibleUserId' in (patch ?? {})) data.responsibleUserId = await this.validateUser(me.companyId, this.id(patch.responsibleUserId));
    if ('code' in (patch ?? {})) data.code = this.nullableText(patch.code);
    if ('title' in (patch ?? {})) data.title = this.requiredText(patch.title, 'Titulo do recall');
    if ('reason' in (patch ?? {})) data.reason = this.nullableText(patch.reason);
    if ('severity' in (patch ?? {})) data.severity = this.parseRecallSeverity(patch.severity);
    if ('status' in (patch ?? {})) data.status = this.parseRecallStatus(patch.status);
    if ('scopeDescription' in (patch ?? {})) data.scopeDescription = this.nullableText(patch.scopeDescription);
    if ('affectedQuantity' in (patch ?? {})) data.affectedQuantity = this.optionalFloat(patch.affectedQuantity);
    if ('unit' in (patch ?? {})) data.unit = this.nullableText(patch.unit);
    if ('initiatedAt' in (patch ?? {})) data.initiatedAt = this.optionalDate(patch.initiatedAt);
    if ('closedAt' in (patch ?? {})) data.closedAt = this.optionalDate(patch.closedAt);
    if ('actions' in (patch ?? {})) data.actions = this.nullableText(patch.actions);
    if ('notes' in (patch ?? {})) data.notes = this.nullableText(patch.notes);
    return this.prisma.foodSafetyRecall.update({ where: { id }, data, include: this.recallInclude() });
  }

  async addRecallItem(me: AuthPayload, recallId: string, body: any) {
    await this.loadRecall(me, recallId);
    const lotId = this.requiredText(body?.lotId, 'Lote');
    await this.loadLot(me, lotId);
    return this.prisma.foodSafetyRecallItem.create({
      data: {
        companyId: me.companyId,
        recallId,
        lotId,
        status: this.parseRecallItemStatus(body?.status) ?? FoodSafetyRecallItemStatus.PENDING,
        quantity: this.optionalFloat(body?.quantity) ?? null,
        unit: this.nullableText(body?.unit) ?? null,
        disposition: this.nullableText(body?.disposition) ?? null,
        notifiedAt: this.optionalDate(body?.notifiedAt) ?? null,
        notes: this.nullableText(body?.notes) ?? null,
      },
      include: { lot: { include: { material: true, supplier: true } } },
    });
  }

  async updateRecallItem(me: AuthPayload, id: string, patch: any) {
    const item = await this.prisma.foodSafetyRecallItem.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!item) throw new NotFoundException('Item de recall nao encontrado');
    const data: any = {};
    if ('status' in (patch ?? {})) data.status = this.parseRecallItemStatus(patch.status);
    if ('quantity' in (patch ?? {})) data.quantity = this.optionalFloat(patch.quantity);
    if ('unit' in (patch ?? {})) data.unit = this.nullableText(patch.unit);
    if ('disposition' in (patch ?? {})) data.disposition = this.nullableText(patch.disposition);
    if ('notifiedAt' in (patch ?? {})) data.notifiedAt = this.optionalDate(patch.notifiedAt);
    if ('notes' in (patch ?? {})) data.notes = this.nullableText(patch.notes);
    return this.prisma.foodSafetyRecallItem.update({ where: { id }, data, include: { lot: { include: { material: true, supplier: true } } } });
  }

  async supplyChainSummary(me: AuthPayload, programId?: string) {
    const [suppliers, materials, lots, recalls] = await Promise.all([
      this.prisma.foodSafetySupplier.findMany({ where: { companyId: me.companyId, deletedAt: null, ...(programId ? { programId } : {}) }, select: { status: true, criticality: true } }),
      this.prisma.foodSafetyMaterial.findMany({ where: { companyId: me.companyId, deletedAt: null, ...(programId ? { programId } : {}) }, select: { status: true, category: true } }),
      this.prisma.foodSafetyLot.findMany({ where: { companyId: me.companyId, deletedAt: null, ...(programId ? { programId } : {}) }, select: { status: true, type: true, expiresAt: true } }),
      this.prisma.foodSafetyRecall.findMany({ where: { companyId: me.companyId, deletedAt: null, ...(programId ? { programId } : {}) }, select: { status: true, severity: true } }),
    ]);
    const today = new Date();
    const expiringLots = lots.filter((l) => l.expiresAt && l.expiresAt.getTime() <= today.getTime() + 30 * 86400000).length;
    return {
      suppliers: suppliers.length,
      suppliersApproved: suppliers.filter((s) => s.status === FoodSafetySupplierStatus.APPROVED).length,
      suppliersBlocked: suppliers.filter((s) => s.status === FoodSafetySupplierStatus.BLOCKED).length,
      criticalSuppliers: suppliers.filter((s) => s.criticality === FoodSafetySupplierCriticality.CRITICAL).length,
      materials: materials.length,
      materialsBlocked: materials.filter((m) => m.status === FoodSafetyMaterialStatus.BLOCKED).length,
      lots: lots.length,
      lotsBlocked: lots.filter((l) => l.status === FoodSafetyLotStatus.BLOCKED).length,
      lotsRecalled: lots.filter((l) => l.status === FoodSafetyLotStatus.RECALLED).length,
      expiringLots,
      recalls: recalls.length,
      activeRecalls: recalls.filter((r) => r.status === FoodSafetyRecallStatus.ACTIVE || r.status === FoodSafetyRecallStatus.SIMULATION).length,
      criticalRecalls: recalls.filter((r) => r.severity === FoodSafetyRecallSeverity.CRITICAL).length,
    };
  }

  // ----------------------------- inteligencia / import-export (Fase 5) -----
  private clampScore(value: number) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private csvValue(value: unknown) {
    if (value === null || value === undefined) return '';
    const text = String(value).replace(/\r?\n/g, ' ').replace(/"/g, '""');
    return `"${text}"`;
  }

  private toCsv(headers: string[], rows: unknown[][]) {
    return [headers.map((h) => this.csvValue(h)).join(';'), ...rows.map((row) => row.map((v) => this.csvValue(v)).join(';'))].join('\n');
  }

  private supplierComputedScore(supplier: {
    status: FoodSafetySupplierStatus;
    criticality: FoodSafetySupplierCriticality;
    score: number | null;
    documentsStatus: string | null;
    nextReviewAt: Date | null;
    materials?: Array<{ status: FoodSafetyMaterialStatus }>;
    lots?: Array<{ status: FoodSafetyLotStatus }>;
  }) {
    if (supplier.score != null) return this.clampScore(supplier.score);
    const statusBase: Record<FoodSafetySupplierStatus, number> = {
      [FoodSafetySupplierStatus.APPROVED]: 90,
      [FoodSafetySupplierStatus.CONDITIONAL]: 70,
      [FoodSafetySupplierStatus.PROSPECT]: 55,
      [FoodSafetySupplierStatus.INACTIVE]: 35,
      [FoodSafetySupplierStatus.BLOCKED]: 10,
    };
    let score = statusBase[supplier.status] ?? 60;
    if (supplier.criticality === FoodSafetySupplierCriticality.CRITICAL) score -= 10;
    if (supplier.criticality === FoodSafetySupplierCriticality.HIGH) score -= 5;
    const doc = supplier.documentsStatus?.toLowerCase() ?? '';
    if (doc.includes('venc') || doc.includes('pend') || doc.includes('expired') || doc.includes('reprov')) score -= 15;
    if (doc.includes('ok') || doc.includes('valid') || doc.includes('regular')) score += 5;
    const blockedLots = (supplier.lots ?? []).filter((l) => l.status === FoodSafetyLotStatus.BLOCKED || l.status === FoodSafetyLotStatus.RECALLED).length;
    const blockedMaterials = (supplier.materials ?? []).filter((m) => m.status === FoodSafetyMaterialStatus.BLOCKED).length;
    score -= Math.min(25, blockedLots * 10);
    score -= Math.min(20, blockedMaterials * 10);
    if (supplier.nextReviewAt && supplier.nextReviewAt.getTime() < Date.now()) score -= 15;
    return this.clampScore(score);
  }

  async supplierScorecard(me: AuthPayload, programId?: string) {
    const suppliers = await this.prisma.foodSafetySupplier.findMany({
      where: { companyId: me.companyId, deletedAt: null, ...(programId ? { programId } : {}) },
      include: {
        responsible: { select: { id: true, name: true, email: true } },
        materials: { where: { deletedAt: null }, select: { id: true, status: true } },
        lots: { where: { deletedAt: null }, select: { id: true, status: true } },
      },
      orderBy: { name: 'asc' },
    });
    return suppliers.map((s) => {
      const computedScore = this.supplierComputedScore(s);
      const blockedLots = s.lots.filter((l) => l.status === FoodSafetyLotStatus.BLOCKED || l.status === FoodSafetyLotStatus.RECALLED).length;
      const blockedMaterials = s.materials.filter((m) => m.status === FoodSafetyMaterialStatus.BLOCKED).length;
      const reviewOverdue = Boolean(s.nextReviewAt && s.nextReviewAt.getTime() < Date.now());
      const riskLevel = computedScore < 50 || s.status === FoodSafetySupplierStatus.BLOCKED ? 'CRITICAL' : computedScore < 70 ? 'HIGH' : computedScore < 85 ? 'MEDIUM' : 'LOW';
      const drivers = [
        s.status !== FoodSafetySupplierStatus.APPROVED ? `Status ${s.status}` : null,
        s.criticality === FoodSafetySupplierCriticality.CRITICAL ? 'Fornecedor critico' : null,
        blockedLots > 0 ? `${blockedLots} lote(s) bloqueado(s)/recolhido(s)` : null,
        blockedMaterials > 0 ? `${blockedMaterials} material(is) bloqueado(s)` : null,
        reviewOverdue ? 'Revisao vencida' : null,
        s.documentsStatus ? `Documentos: ${s.documentsStatus}` : null,
      ].filter(Boolean);
      return {
        id: s.id,
        code: s.code,
        name: s.name,
        status: s.status,
        criticality: s.criticality,
        score: computedScore,
        riskLevel,
        materials: s.materials.length,
        lots: s.lots.length,
        blockedLots,
        blockedMaterials,
        reviewOverdue,
        responsible: s.responsible,
        drivers,
      };
    }).sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  }

  async intelligenceDashboard(me: AuthPayload, programId?: string) {
    const [overview, chain, compliance, scorecard, monitoringRecords, recalls] = await Promise.all([
      this.summary(me, programId),
      this.supplyChainSummary(me, programId),
      this.complianceSummary(me),
      this.supplierScorecard(me, programId),
      this.prisma.foodSafetyMonitoringRecord.findMany({
        where: {
          companyId: me.companyId,
          deletedAt: null,
          ...(programId ? { controlPlan: { hazard: { process: { programId } } } } : {}),
        },
        include: {
          controlPlan: {
            select: {
              controlType: true,
              parameter: true,
              hazard: { select: { name: true, process: { select: { id: true, name: true, programId: true } } } },
            },
          },
          recordedBy: { select: { id: true, name: true } },
        },
        orderBy: { measuredAt: 'desc' },
        take: 50,
      }),
      this.prisma.foodSafetyRecall.findMany({
        where: { companyId: me.companyId, deletedAt: null, ...(programId ? { programId } : {}), status: { in: [FoodSafetyRecallStatus.ACTIVE, FoodSafetyRecallStatus.SIMULATION] } },
        select: { id: true, title: true, status: true, severity: true, initiatedAt: true },
        orderBy: { initiatedAt: 'desc' },
        take: 10,
      }),
    ]);
    const monitoring = {
      total: monitoringRecords.length,
      ok: monitoringRecords.filter((r) => r.result === FoodSafetyMonitoringResult.OK).length,
      alert: monitoringRecords.filter((r) => r.result === FoodSafetyMonitoringResult.ALERT).length,
      out: monitoringRecords.filter((r) => r.result === FoodSafetyMonitoringResult.OUT).length,
      lotBlocked: monitoringRecords.filter((r) => r.lotBlocked).length,
      recentOut: monitoringRecords.filter((r) => r.result === FoodSafetyMonitoringResult.OUT).slice(0, 5),
    };
    const supplierAverageScore = scorecard.length ? Math.round(scorecard.reduce((sum, s) => sum + s.score, 0) / scorecard.length) : 0;
    const riskScore = this.clampScore(
      100
      - (overview.hazardsCritical ?? 0) * 10
      - (overview.hazardsHigh ?? 0) * 4
      - monitoring.out * 6
      - chain.suppliersBlocked * 8
      - chain.activeRecalls * 12
      - compliance.notMet * 4
      - compliance.partial * 2,
    );
    return {
      overview,
      chain,
      compliance,
      monitoring,
      supplierAverageScore,
      supplierRiskCount: scorecard.filter((s) => s.riskLevel === 'CRITICAL' || s.riskLevel === 'HIGH').length,
      riskScore,
      activeRecalls: recalls,
      generatedAt: new Date().toISOString(),
    };
  }

  async assistantInsights(me: AuthPayload, programId?: string) {
    const [dashboard, scorecard] = await Promise.all([this.intelligenceDashboard(me, programId), this.supplierScorecard(me, programId)]);
    const insights: Array<{ severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; title: string; description: string; action: string; area: string }> = [];
    if (dashboard.monitoring.out > 0) {
      insights.push({
        severity: 'CRITICAL',
        title: 'Monitoramentos fora do limite',
        description: `${dashboard.monitoring.out} registro(s) recente(s) ficaram fora do limite, com ${dashboard.monitoring.lotBlocked} lote(s) sinalizado(s) para bloqueio.`,
        action: 'Priorizar NCs abertas automaticamente, confirmar contencao e validar eficacia das acoes.',
        area: 'Monitoramento PPR/PPRO/PCC',
      });
    }
    if ((dashboard.overview.hazardsCritical ?? 0) > 0 || (dashboard.overview.hazardsHigh ?? 0) > 0) {
      insights.push({
        severity: (dashboard.overview.hazardsCritical ?? 0) > 0 ? 'CRITICAL' : 'HIGH',
        title: 'Perigos APPCC em nivel elevado',
        description: `${dashboard.overview.hazardsCritical ?? 0} perigo(s) critico(s) e ${dashboard.overview.hazardsHigh ?? 0} alto(s) permanecem na matriz.`,
        action: 'Revisar controles preventivos, limites e classificacao PPR/PPRO/PCC dos processos afetados.',
        area: 'Perigos / APPCC',
      });
    }
    const riskySuppliers = scorecard.filter((s) => s.riskLevel === 'CRITICAL' || s.riskLevel === 'HIGH').slice(0, 5);
    if (riskySuppliers.length > 0) {
      insights.push({
        severity: riskySuppliers.some((s) => s.riskLevel === 'CRITICAL') ? 'CRITICAL' : 'HIGH',
        title: 'Fornecedores com score de risco',
        description: riskySuppliers.map((s) => `${s.name} (${s.score})`).join(', '),
        action: 'Reavaliar homologacao, documentos, auditorias e bloqueios antes de novos recebimentos.',
        area: 'Fornecedores',
      });
    }
    if (dashboard.chain.activeRecalls > 0) {
      insights.push({
        severity: 'CRITICAL',
        title: 'Recall ou simulado ativo',
        description: `${dashboard.chain.activeRecalls} recall(s)/simulacao(oes) aguardam acompanhamento.`,
        action: 'Conferir lotes impactados, comunicacoes, disposicao e encerramento formal.',
        area: 'Rastreabilidade e Recall',
      });
    }
    if (dashboard.compliance.compliancePct < 80 && dashboard.compliance.requirements > 0) {
      insights.push({
        severity: dashboard.compliance.compliancePct < 60 ? 'HIGH' : 'MEDIUM',
        title: 'Conformidade normativa abaixo do alvo',
        description: `Conformidade atual em ${dashboard.compliance.compliancePct}% sobre ${dashboard.compliance.applicable} requisito(s) aplicavel(is).`,
        action: 'Avaliar requisitos pendentes/nao atendidos e abrir plano de adequacao para responsaveis.',
        area: 'Compliance',
      });
    }
    if (insights.length === 0) {
      insights.push({
        severity: 'LOW',
        title: 'Sem alertas criticos no momento',
        description: 'Os sinais recentes nao indicam desvios criticos acumulados.',
        action: 'Manter rotina de monitoramento, revisoes e simulados programados.',
        area: 'Visao Geral',
      });
    }
    const aiInsights = await this.tryGeminiFoodSafetyInsights({ dashboard, scorecard, fallbackInsights: insights });
    return {
      generatedAt: new Date().toISOString(),
      provider: aiInsights ? this.gemini?.provider : 'rules',
      model: aiInsights ? this.gemini?.modelName : null,
      insights: aiInsights ?? insights,
    };
  }

  private async tryGeminiFoodSafetyInsights(context: {
    dashboard: any;
    scorecard: any[];
    fallbackInsights: Array<{ severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; title: string; description: string; action: string; area: string }>;
  }): Promise<Array<{ severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; title: string; description: string; action: string; area: string }> | null> {
    if (!this.gemini?.isEnabled) return null;
    const prompt = `Voce e um especialista senior em seguranca de alimentos, APPCC, PPR/PPRO/PCC e compliance industrial.
Gere insights executivos em portugues do Brasil para o modulo Seguranca dos Alimentos.
Use somente os dados fornecidos. Nao aprove, bloqueie ou encerre nada automaticamente.

Responda apenas JSON no schema:
{
  "insights": [
    { "severity": "LOW|MEDIUM|HIGH|CRITICAL", "title": "...", "description": "...", "action": "...", "area": "..." }
  ]
}

CONTEXTO:
${JSON.stringify({
  dashboard: context.dashboard,
  supplierScorecard: context.scorecard.slice(0, 10),
  baseRules: context.fallbackInsights,
}, null, 2)}`;
    const json = await this.gemini.generateJson<{ insights?: Array<{ severity?: string; title?: string; description?: string; action?: string; area?: string }> }>(prompt, {
      temperature: 0.35,
      maxOutputTokens: 1600,
    });
    const allowed = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    const insights = json?.insights
      ?.map((item) => ({
        severity: allowed.has(String(item.severity)) ? String(item.severity) as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' : 'MEDIUM',
        title: String(item.title ?? '').trim(),
        description: String(item.description ?? '').trim(),
        action: String(item.action ?? '').trim(),
        area: String(item.area ?? 'Seguranca dos Alimentos').trim(),
      }))
      .filter((item) => item.title && item.description && item.action);
    return insights?.length ? insights.slice(0, 6) : null;
  }

  async exportData(me: AuthPayload, dataset: string, programId?: string) {
    const normalized = String(dataset || 'suppliers');
    if (normalized === 'suppliers') {
      const rows = await this.listSuppliers(me, { programId });
      const csv = this.toCsv(['codigo', 'nome', 'status', 'criticidade', 'score', 'documentos', 'proxima_revisao'], rows.map((r) => [r.code, r.name, r.status, r.criticality, r.score, r.documentsStatus, r.nextReviewAt?.toISOString?.() ?? r.nextReviewAt]));
      return { filename: 'food-safety-fornecedores.csv', mimeType: 'text/csv;charset=utf-8', encoding: 'utf8', content: csv, rowCount: rows.length };
    }
    if (normalized === 'materials') {
      const rows = await this.listMaterials(me, { programId });
      const csv = this.toCsv(['codigo', 'nome', 'categoria', 'status', 'fornecedor', 'alergenicos', 'documentos'], rows.map((r) => [r.code, r.name, r.category, r.status, r.supplier?.name, r.allergens, r.requiredDocuments]));
      return { filename: 'food-safety-materiais.csv', mimeType: 'text/csv;charset=utf-8', encoding: 'utf8', content: csv, rowCount: rows.length };
    }
    if (normalized === 'lots') {
      const rows = await this.listLots(me, { programId });
      const csv = this.toCsv(['lote', 'tipo', 'status', 'material', 'fornecedor', 'quantidade', 'unidade', 'validade'], rows.map((r) => [r.code, r.type, r.status, r.material?.name, r.supplier?.name, r.quantity, r.unit, r.expiresAt?.toISOString?.() ?? r.expiresAt]));
      return { filename: 'food-safety-lotes.csv', mimeType: 'text/csv;charset=utf-8', encoding: 'utf8', content: csv, rowCount: rows.length };
    }
    throw new BadRequestException('Dataset de exportacao invalido.');
  }

  async importData(me: AuthPayload, body: any) {
    const dataset = String(body?.dataset ?? '');
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) throw new BadRequestException('Informe linhas para importar.');
    const programId = await this.validateProgram(me, this.id(body?.programId));
    let created = 0;
    const errors: Array<{ row: number; message: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      try {
        const row = { ...rows[i], programId };
        if (dataset === 'suppliers') await this.createSupplier(me, row);
        else if (dataset === 'materials') await this.createMaterial(me, row);
        else if (dataset === 'lots') await this.createLot(me, row);
        else throw new BadRequestException('Dataset de importacao invalido.');
        created++;
      } catch (e: any) {
        errors.push({ row: i + 1, message: e?.message ?? 'Erro ao importar linha' });
      }
    }
    return { dataset, created, errors, total: rows.length };
  }
}
