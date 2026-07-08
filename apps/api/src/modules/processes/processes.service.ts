import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProcessStatus, ProcessType, TraceEntityType, TraceEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { listTake } from '../../common/http/list-take';
import { TraceabilityService } from '../traceability/traceability.service';
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';

// Processos e SIPOC: mapeamento de processos (finalisticos/apoio/gerenciais) com SIPOC
// (fornecedores/entradas/saidas/clientes) e etapas ordenadas do fluxo. Vinculo a area/
// processo e indicador. Isolamento empresa + area (espelha documentos/auditorias).
const MODULE = 'processes';

type ProcessFilters = {
  status?: string;
  type?: string;
  search?: string;
  orgNodeId?: string;
  indicatorId?: string;
};

type LinkInput = {
  orgNodeId?: string | null;
  indicatorId?: string | null;
  ownerUserId?: string | null;
};

@Injectable()
export class ProcessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly access: AccessService,
  ) {}

  private include() {
    return {
      orgNode: { select: { id: true, name: true, type: true } },
      indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } },
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      steps: { orderBy: { order: 'asc' as const } },
    };
  }

  private areaOf(proc: any): string | null {
    return proc.orgNodeId ?? proc.orgNode?.id ?? proc.indicator?.ownerNodeId ?? null;
  }

  private async assertWriteArea(me: AuthPayload, area: string | null, action: AreaAction) {
    if (area) await this.access.assertCanWrite(me.sub, area, MODULE, action);
  }

  private async assertViewArea(me: AuthPayload, proc: any) {
    const area = this.areaOf(proc);
    if (!area) return;
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    if (permitted && !permitted.includes(area)) {
      throw new ForbiddenException('Voce nao tem acesso aos processos desta area.');
    }
  }

  private enrich(proc: any) {
    const steps: any[] = proc.steps ?? [];
    return { ...proc, stepsCount: steps.length, areaId: this.areaOf(proc) };
  }

  private parseStatus(value?: string): ProcessStatus | undefined {
    if (!value) return undefined;
    if (!Object.values(ProcessStatus).includes(value as ProcessStatus)) throw new BadRequestException('Status de processo invalido.');
    return value as ProcessStatus;
  }

  private parseType(value?: string): ProcessType | undefined {
    if (!value) return undefined;
    if (!Object.values(ProcessType).includes(value as ProcessType)) throw new BadRequestException('Tipo de processo invalido.');
    return value as ProcessType;
  }

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

  private visibilityWhere(permitted: string[] | null) {
    if (!permitted) return undefined;
    return {
      OR: [
        { orgNodeId: null, indicatorId: null },
        { orgNodeId: { in: permitted } },
        { indicator: { ownerNodeId: { in: permitted } } },
      ],
    };
  }

  private async loadScoped(id: string, companyId: string) {
    const proc = await this.prisma.process.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.include(),
    });
    if (!proc) throw new NotFoundException('Processo nao encontrado');
    return proc;
  }

  /** Carrega a etapa isolada por empresa (via processo) + traz a area. */
  private async loadStep(stepId: string, companyId: string) {
    const step = await this.prisma.processStep.findFirst({
      where: { id: stepId, process: { companyId, deletedAt: null } },
      include: { process: { include: { orgNode: { select: { id: true } }, indicator: { select: { ownerNodeId: true } } } } },
    });
    if (!step) throw new NotFoundException('Etapa nao encontrada');
    return step;
  }

  async list(me: AuthPayload, filters: ProcessFilters = {}) {
    const status = this.parseStatus(filters.status);
    const type = this.parseType(filters.type);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: Prisma.ProcessWhereInput[] = [];
    const areaFilter = this.visibilityWhere(permitted);
    if (areaFilter) and.push(areaFilter as Prisma.ProcessWhereInput);

    const term = filters.search?.trim();
    if (term) {
      and.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { code: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { objective: { contains: term, mode: 'insensitive' } },
          { steps: { some: { name: { contains: term, mode: 'insensitive' } } } },
        ],
      });
    }

    const items = await this.prisma.process.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(filters.orgNodeId ? { orgNodeId: filters.orgNodeId } : {}),
        ...(filters.indicatorId ? { indicatorId: filters.indicatorId } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      include: this.include(),
      orderBy: [{ status: 'asc' }, { type: 'asc' }, { number: 'desc' }],
      take: listTake((filters as { limit?: string }).limit),
    });

    return items.map((proc) => this.enrich(proc));
  }

  async summary(me: AuthPayload) {
    const list = await this.list(me);
    const byStatus = Object.fromEntries(Object.values(ProcessStatus).map((s) => [s, 0])) as Record<ProcessStatus, number>;
    const byType = Object.fromEntries(Object.values(ProcessType).map((t) => [t, 0])) as Record<ProcessType, number>;
    let mappedSteps = 0;
    for (const proc of list as any[]) {
      byStatus[proc.status as ProcessStatus]++;
      byType[proc.type as ProcessType]++;
      mappedSteps += proc.stepsCount;
    }
    return {
      total: list.length,
      active: byStatus[ProcessStatus.ACTIVE] ?? 0,
      draft: byStatus[ProcessStatus.DRAFT] ?? 0,
      underReview: byStatus[ProcessStatus.UNDER_REVIEW] ?? 0,
      mappedSteps,
      withoutSteps: (list as any[]).filter((p) => p.stepsCount === 0).length,
      byStatus,
      byType,
    };
  }

  async getById(me: AuthPayload, id: string) {
    const proc = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, proc);
    return this.enrich(proc);
  }

  async options(me: AuthPayload) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const areaWhere = permitted ? { id: { in: permitted } } : {};
    const indicatorWhere = permitted ? { ownerNodeId: { in: permitted } } : {};
    const [orgNodes, indicators, users] = await Promise.all([
      this.prisma.orgNode.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true, ...areaWhere },
        select: { id: true, name: true, type: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.indicator.findMany({
        where: { companyId: me.companyId, deletedAt: null, ...indicatorWhere },
        select: { id: true, name: true, code: true, ownerNodeId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, email: true, defaultNodeId: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { orgNodes, indicators, users, types: Object.values(ProcessType), statuses: Object.values(ProcessStatus) };
  }

  private async validateLinks(companyId: string, input: LinkInput) {
    const ids = {
      orgNodeId: input.orgNodeId ?? null,
      indicatorId: input.indicatorId ?? null,
      ownerUserId: input.ownerUserId ?? null,
    };
    const areas: string[] = [];

    if (ids.orgNodeId) {
      const orgNode = await this.prisma.orgNode.findFirst({ where: { id: ids.orgNodeId, companyId, deletedAt: null }, select: { id: true } });
      if (!orgNode) throw new NotFoundException('Area ou processo nao encontrado');
      areas.push(orgNode.id);
    }
    if (ids.indicatorId) {
      const indicator = await this.prisma.indicator.findFirst({ where: { id: ids.indicatorId, companyId, deletedAt: null }, select: { ownerNodeId: true } });
      if (!indicator) throw new NotFoundException('Indicador nao encontrado');
      if (indicator.ownerNodeId) areas.push(indicator.ownerNodeId);
    }
    if (ids.ownerUserId) {
      const user = await this.prisma.user.findFirst({ where: { id: ids.ownerUserId, companyId, deletedAt: null, active: true }, select: { id: true } });
      if (!user) throw new NotFoundException('Dono do processo nao encontrado');
    }

    const uniqueAreas = Array.from(new Set(areas.filter(Boolean)));
    if (uniqueAreas.length > 1) {
      throw new ConflictException('Vinculos do processo pertencem a areas diferentes.');
    }
    return { ids, area: uniqueAreas[0] ?? null };
  }

  async create(me: AuthPayload, body: any) {
    const name = this.requiredText(body?.name, 'Nome');
    const type = this.parseType(body?.type) ?? ProcessType.CORE;
    const status = this.parseStatus(body?.status) ?? ProcessStatus.DRAFT;
    const links = await this.validateLinks(me.companyId, {
      orgNodeId: this.id(body?.orgNodeId),
      indicatorId: this.id(body?.indicatorId),
      ownerUserId: this.id(body?.ownerUserId),
    });
    await this.assertWriteArea(me, links.area, 'create');

    const proc = await this.prisma.$transaction(async (tx) => {
      const last = await tx.process.findFirst({ where: { companyId: me.companyId }, orderBy: { number: 'desc' }, select: { number: true } });
      return tx.process.create({
        data: {
          companyId: me.companyId,
          number: (last?.number ?? 0) + 1,
          code: this.nullableText(body?.code) ?? null,
          name,
          description: this.nullableText(body?.description) ?? null,
          objective: this.nullableText(body?.objective) ?? null,
          type,
          status,
          version: this.nullableText(body?.version) ?? null,
          suppliers: this.nullableText(body?.suppliers) ?? null,
          inputs: this.nullableText(body?.inputs) ?? null,
          outputs: this.nullableText(body?.outputs) ?? null,
          customers: this.nullableText(body?.customers) ?? null,
          createdById: me.sub,
          ...links.ids,
        },
        include: this.include(),
      });
    });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: proc.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.CREATED,
      entityType: TraceEntityType.PROCESS,
      entityId: proc.id,
      title: `Processo #${proc.number} criado`,
      description: proc.name,
      statusTo: proc.status,
      metadata: { type: proc.type },
    });

    return this.enrich(proc);
  }

  async update(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(before), 'edit');

    const links = await this.validateLinks(me.companyId, {
      orgNodeId: 'orgNodeId' in (patch ?? {}) ? this.id(patch.orgNodeId) : before.orgNodeId,
      indicatorId: 'indicatorId' in (patch ?? {}) ? this.id(patch.indicatorId) : before.indicatorId,
      ownerUserId: 'ownerUserId' in (patch ?? {}) ? this.id(patch.ownerUserId) : before.ownerUserId,
    });
    await this.assertWriteArea(me, links.area, 'edit');

    const data: any = { ...links.ids };
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome');
    if ('code' in (patch ?? {})) data.code = this.nullableText(patch.code);
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('objective' in (patch ?? {})) data.objective = this.nullableText(patch.objective);
    if ('type' in (patch ?? {})) data.type = this.parseType(patch.type) ?? before.type;
    if ('version' in (patch ?? {})) data.version = this.nullableText(patch.version);
    if ('suppliers' in (patch ?? {})) data.suppliers = this.nullableText(patch.suppliers);
    if ('inputs' in (patch ?? {})) data.inputs = this.nullableText(patch.inputs);
    if ('outputs' in (patch ?? {})) data.outputs = this.nullableText(patch.outputs);
    if ('customers' in (patch ?? {})) data.customers = this.nullableText(patch.customers);
    const statusChanged = 'status' in (patch ?? {});
    if (statusChanged) data.status = this.parseStatus(patch.status) ?? before.status;

    const updated = await this.prisma.process.update({ where: { id }, data, include: this.include() });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: updated.indicatorId,
      userId: me.sub,
      eventType: statusChanged && before.status !== updated.status ? TraceEventType.STATUS_CHANGED : TraceEventType.UPDATED,
      entityType: TraceEntityType.PROCESS,
      entityId: updated.id,
      title: statusChanged && before.status !== updated.status ? `Status do processo #${updated.number} alterado` : `Processo #${updated.number} atualizado`,
      description: updated.name,
      statusFrom: before.status,
      statusTo: updated.status,
      metadata: { type: updated.type },
    });

    return this.enrich(updated);
  }

  async remove(me: AuthPayload, id: string) {
    const proc = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(proc), 'delete');
    const removed = await this.prisma.process.update({ where: { id }, data: { deletedAt: new Date() }, include: this.include() });
    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: proc.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.PROCESS,
      entityId: proc.id,
      title: `Processo #${proc.number} excluido`,
      description: proc.name,
      statusFrom: proc.status,
      statusTo: 'DELETED',
    });
    return this.enrich(removed);
  }

  // ---- Etapas (steps) ----

  async addStep(me: AuthPayload, processId: string, body: any) {
    const proc = await this.loadScoped(processId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(proc), 'edit');
    const explicitOrder = this.optionalInt(body?.order, 1);
    const order = explicitOrder ?? (proc.steps.length ? Math.max(...proc.steps.map((s: any) => s.order)) + 1 : 1);
    const step = await this.prisma.processStep.create({
      data: {
        processId,
        order,
        name: this.requiredText(body?.name, 'Nome da etapa'),
        description: this.nullableText(body?.description) ?? null,
        responsible: this.nullableText(body?.responsible) ?? null,
      },
    });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: proc.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.CREATED,
      entityType: TraceEntityType.PROCESS_STEP,
      entityId: step.id,
      relatedType: TraceEntityType.PROCESS,
      relatedId: processId,
      title: `Etapa adicionada ao processo #${proc.number}`,
      description: step.name,
      metadata: { order: step.order, processName: proc.name },
    });

    return step;
  }

  async updateStep(me: AuthPayload, stepId: string, patch: any) {
    const step = await this.loadStep(stepId, me.companyId);
    await this.assertWriteArea(me, step.process.orgNodeId ?? step.process.indicator?.ownerNodeId ?? null, 'edit');
    const data: any = {};
    if ('order' in (patch ?? {})) data.order = this.optionalInt(patch.order, 1) ?? step.order;
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome da etapa');
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('responsible' in (patch ?? {})) data.responsible = this.nullableText(patch.responsible);
    const updated = await this.prisma.processStep.update({ where: { id: stepId }, data });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: step.process.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.PROCESS_STEP,
      entityId: stepId,
      relatedType: TraceEntityType.PROCESS,
      relatedId: step.processId,
      title: 'Etapa de processo atualizada',
      description: updated.name,
      metadata: { orderFrom: step.order, orderTo: updated.order, processName: step.process.name },
    });

    return updated;
  }

  async removeStep(me: AuthPayload, stepId: string) {
    const step = await this.loadStep(stepId, me.companyId);
    await this.assertWriteArea(me, step.process.orgNodeId ?? step.process.indicator?.ownerNodeId ?? null, 'edit');
    const removed = await this.prisma.processStep.delete({ where: { id: stepId } });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: step.process.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.PROCESS_STEP,
      entityId: stepId,
      relatedType: TraceEntityType.PROCESS,
      relatedId: step.processId,
      title: 'Etapa de processo removida',
      description: step.name,
      metadata: { order: step.order, processName: step.process.name, removed: true },
    });

    return removed;
  }
}
