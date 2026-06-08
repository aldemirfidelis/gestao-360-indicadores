import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FoodSafetyProcessStatus, FoodSafetyProgramStatus, FoodSafetyStepType, Prisma } from '@prisma/client';
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
      visibilities: VISIBILITIES,
    };
  }
}
