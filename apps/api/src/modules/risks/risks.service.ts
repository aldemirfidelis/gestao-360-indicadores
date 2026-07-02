import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RiskCategory, RiskStatus, TraceEntityType, TraceEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';
import { listTake } from '../../common/http/list-take';

const MODULE = 'risks';
const CLOSED_STATUSES = new Set<RiskStatus>([RiskStatus.CLOSED]);

type RiskFilters = {
  status?: string;
  category?: string;
  search?: string;
  orgNodeId?: string;
  indicatorId?: string;
  projectId?: string;
  actionId?: string;
};

type LinkInput = {
  orgNodeId?: string | null;
  indicatorId?: string | null;
  projectId?: string | null;
  mitigationActionId?: string | null;
  responsibleUserId?: string | null;
};

@Injectable()
export class RisksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly access: AccessService,
  ) {}

  private include() {
    return {
      orgNode: { select: { id: true, name: true, type: true } },
      indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } },
      project: {
        select: {
          id: true,
          name: true,
          status: true,
          indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } },
        },
      },
      mitigationAction: {
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          ownerNodeId: true,
          indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } },
        },
      },
      responsibleUser: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    };
  }

  private areaOf(risk: any): string | null {
    return (
      risk.orgNodeId ??
      risk.orgNode?.id ??
      risk.indicator?.ownerNodeId ??
      risk.project?.indicator?.ownerNodeId ??
      risk.mitigationAction?.ownerNodeId ??
      risk.mitigationAction?.indicator?.ownerNodeId ??
      null
    );
  }

  private async assertWriteArea(me: AuthPayload, area: string | null, action: AreaAction) {
    if (area) await this.access.assertCanWrite(me.sub, area, MODULE, action);
  }

  private async assertViewArea(me: AuthPayload, risk: any) {
    const area = this.areaOf(risk);
    if (!area) return;
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    if (permitted && !permitted.includes(area)) {
      throw new ForbiddenException('Voce nao tem acesso aos riscos desta area.');
    }
  }

  private score(probability: number, impact: number) {
    return probability * impact;
  }

  private level(score: number) {
    if (score <= 4) return 'LOW';
    if (score <= 9) return 'MODERATE';
    if (score <= 16) return 'HIGH';
    return 'CRITICAL';
  }

  private enrich(risk: any) {
    const score = this.score(risk.probability ?? 0, risk.impact ?? 0);
    const isClosed = CLOSED_STATUSES.has(risk.status);
    const dueDate = risk.dueDate ? new Date(risk.dueDate) : null;
    const isOverdue = Boolean(dueDate && dueDate < new Date() && !isClosed);
    const hasResidual = risk.residualProbability != null && risk.residualImpact != null;
    const residualScore = hasResidual ? this.score(risk.residualProbability, risk.residualImpact) : null;
    return {
      ...risk,
      score,
      level: this.level(score),
      residualScore,
      residualLevel: residualScore == null ? null : this.level(residualScore),
      // Redução obtida com a mitigação (% do score inerente eliminado).
      riskReductionPercent: residualScore != null && score > 0 ? Math.round(((score - residualScore) / score) * 100) : null,
      isOverdue,
      areaId: this.areaOf(risk),
    };
  }

  private parseStatus(value?: string): RiskStatus | undefined {
    if (!value) return undefined;
    if (!Object.values(RiskStatus).includes(value as RiskStatus)) {
      throw new BadRequestException('Status de risco invalido.');
    }
    return value as RiskStatus;
  }

  private parseCategory(value?: string): RiskCategory | undefined {
    if (!value) return undefined;
    if (!Object.values(RiskCategory).includes(value as RiskCategory)) {
      throw new BadRequestException('Categoria de risco invalida.');
    }
    return value as RiskCategory;
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

  private scoreValue(value: unknown, fallback = 3) {
    if (value === undefined || value === null || value === '') return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new BadRequestException('Probabilidade e impacto devem ser numericos.');
    return Math.min(5, Math.max(1, Math.round(n)));
  }

  /** Escala residual 1..5 opcional (null = não avaliado). */
  private optionalScale(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new BadRequestException('Probabilidade e impacto residuais devem ser numericos.');
    return Math.min(5, Math.max(1, Math.round(n)));
  }

  private optionalDate(value: unknown, field: string): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`${field} invalido.`);
    return d;
  }

  private visibilityWhere(permitted: string[] | null) {
    if (!permitted) return undefined;
    return {
      OR: [
        { orgNodeId: null, indicatorId: null, projectId: null, mitigationActionId: null },
        { orgNodeId: { in: permitted } },
        { indicator: { ownerNodeId: { in: permitted } } },
        {
          AND: [
            { orgNodeId: null },
            { indicatorId: null },
            { mitigationActionId: null },
            { project: { indicatorId: null } },
          ],
        },
        { project: { indicator: { ownerNodeId: { in: permitted } } } },
        {
          AND: [
            { orgNodeId: null },
            { indicatorId: null },
            { projectId: null },
            { mitigationAction: { ownerNodeId: null, indicatorId: null } },
          ],
        },
        { mitigationAction: { ownerNodeId: { in: permitted } } },
        { mitigationAction: { indicator: { ownerNodeId: { in: permitted } } } },
      ],
    };
  }

  private async loadScoped(id: string, companyId: string) {
    const risk = await this.prisma.riskRegister.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.include(),
    });
    if (!risk) throw new NotFoundException('Risco nao encontrado');
    return risk;
  }

  async list(me: AuthPayload, filters: RiskFilters = {}) {
    const status = this.parseStatus(filters.status);
    const category = this.parseCategory(filters.category);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: Prisma.RiskRegisterWhereInput[] = [];
    const areaFilter = this.visibilityWhere(permitted);
    if (areaFilter) and.push(areaFilter as Prisma.RiskRegisterWhereInput);

    const term = filters.search?.trim();
    if (term) {
      and.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { mitigationPlan: { contains: term, mode: 'insensitive' } },
          { contingencyPlan: { contains: term, mode: 'insensitive' } },
          { indicator: { name: { contains: term, mode: 'insensitive' } } },
          { indicator: { code: { contains: term, mode: 'insensitive' } } },
          { project: { name: { contains: term, mode: 'insensitive' } } },
          { mitigationAction: { title: { contains: term, mode: 'insensitive' } } },
          { responsibleUser: { name: { contains: term, mode: 'insensitive' } } },
        ],
      });
    }

    const items = await this.prisma.riskRegister.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
        ...(filters.orgNodeId ? { orgNodeId: filters.orgNodeId } : {}),
        ...(filters.indicatorId ? { indicatorId: filters.indicatorId } : {}),
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.actionId ? { mitigationActionId: filters.actionId } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      include: this.include(),
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      take: listTake((filters as { limit?: string }).limit),
    });

    return items.map((risk) => this.enrich(risk));
  }

  async summary(me: AuthPayload) {
    const risks = await this.list(me);
    const openRisks = risks.filter((risk: any) => !CLOSED_STATUSES.has(risk.status));
    const byStatus = Object.fromEntries(Object.values(RiskStatus).map((status) => [status, 0])) as Record<RiskStatus, number>;
    const byCategory = Object.fromEntries(Object.values(RiskCategory).map((category) => [category, 0])) as Record<RiskCategory, number>;

    for (const risk of risks as any[]) {
      byStatus[risk.status as RiskStatus]++;
      byCategory[risk.category as RiskCategory]++;
    }

    const avgScore = risks.length ? risks.reduce((sum: number, risk: any) => sum + risk.score, 0) / risks.length : 0;
    const topRisks = [...risks]
      .filter((risk: any) => !CLOSED_STATUSES.has(risk.status))
      .sort((a: any, b: any) => {
        if (b.score !== a.score) return b.score - a.score;
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      })
      .slice(0, 8)
      .map((risk: any) => ({
        id: risk.id,
        title: risk.title,
        status: risk.status,
        category: risk.category,
        probability: risk.probability,
        impact: risk.impact,
        score: risk.score,
        level: risk.level,
        dueDate: risk.dueDate,
        responsibleUser: risk.responsibleUser,
        orgNode: risk.orgNode,
        indicator: risk.indicator ? { id: risk.indicator.id, name: risk.indicator.name, code: risk.indicator.code } : null,
        project: risk.project ? { id: risk.project.id, name: risk.project.name } : null,
      }));

    // Matriz de risco 5x5 (heatmap): quantos riscos ABERTOS caem em cada
    // célula probabilidade x impacto, e a mesma contagem para o residual.
    const inherentMatrix = this.emptyMatrix();
    const residualMatrix = this.emptyMatrix();
    let residualCount = 0;
    let residualReductionSum = 0;
    for (const risk of openRisks as any[]) {
      const p = clampScale(risk.probability);
      const i = clampScale(risk.impact);
      if (p && i) inherentMatrix[i - 1][p - 1] += 1;
      if (risk.residualScore != null) {
        const rp = clampScale(risk.residualProbability);
        const ri = clampScale(risk.residualImpact);
        if (rp && ri) residualMatrix[ri - 1][rp - 1] += 1;
        residualCount += 1;
        if (risk.riskReductionPercent != null) residualReductionSum += risk.riskReductionPercent;
      }
    }

    return {
      totalRisks: risks.length,
      openRisks: openRisks.length,
      criticalRisks: openRisks.filter((risk: any) => risk.level === 'CRITICAL').length,
      highRisks: openRisks.filter((risk: any) => risk.level === 'HIGH').length,
      overdueMitigations: openRisks.filter((risk: any) => risk.isOverdue).length,
      avgScore,
      // Cobertura da avaliação residual e redução média obtida com a mitigação.
      residualAssessedPct: openRisks.length ? Math.round((residualCount / openRisks.length) * 100) : 0,
      avgRiskReductionPercent: residualCount ? Math.round(residualReductionSum / residualCount) : 0,
      inherentMatrix,
      residualMatrix,
      byStatus,
      byCategory,
      topRisks,
    };
  }

  /** Matriz 5x5 zerada; índice [impacto-1][probabilidade-1]. */
  private emptyMatrix(): number[][] {
    return Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
  }

  async getById(me: AuthPayload, id: string) {
    const risk = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, risk);
    return this.enrich(risk);
  }

  async options(me: AuthPayload) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const areaWhere = permitted ? { id: { in: permitted } } : {};
    const indicatorWhere = permitted ? { ownerNodeId: { in: permitted } } : {};
    const projectWhere: any = permitted
      ? { OR: [{ indicatorId: null }, { indicator: { ownerNodeId: { in: permitted } } }] }
      : {};
    const actionWhere: any = permitted
      ? {
          OR: [
            { ownerNodeId: null, indicatorId: null },
            { ownerNodeId: { in: permitted } },
            { indicator: { ownerNodeId: { in: permitted } } },
          ],
        }
      : {};

    const [orgNodes, indicators, projects, actions, users] = await Promise.all([
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
      this.prisma.project.findMany({
        where: { companyId: me.companyId, deletedAt: null, ...projectWhere },
        select: { id: true, name: true, status: true, indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.actionPlan.findMany({
        where: { companyId: me.companyId, deletedAt: null, ...actionWhere },
        select: { id: true, title: true, status: true, dueDate: true, ownerNodeId: true, indicatorId: true },
        orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
        take: 250,
      }),
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, email: true, defaultNodeId: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      orgNodes,
      indicators,
      projects,
      actions,
      users,
      statuses: Object.values(RiskStatus),
      categories: Object.values(RiskCategory),
    };
  }

  async create(me: AuthPayload, body: any) {
    const title = this.requiredText(body?.title, 'Titulo');
    const category = this.parseCategory(body?.category) ?? RiskCategory.OPERATIONAL;
    const status = this.parseStatus(body?.status) ?? RiskStatus.IDENTIFIED;
    const links = await this.validateLinks(me.companyId, {
      orgNodeId: this.id(body?.orgNodeId),
      indicatorId: this.id(body?.indicatorId),
      projectId: this.id(body?.projectId),
      mitigationActionId: this.id(body?.mitigationActionId ?? body?.actionId),
      responsibleUserId: this.id(body?.responsibleUserId),
    });

    await this.assertWriteArea(me, links.area, 'create');

    const risk = await this.prisma.riskRegister.create({
      data: {
        companyId: me.companyId,
        title,
        description: this.nullableText(body?.description) ?? null,
        category,
        status,
        probability: this.scoreValue(body?.probability, 3),
        impact: this.scoreValue(body?.impact, 3),
        residualProbability: this.optionalScale(body?.residualProbability) ?? null,
        residualImpact: this.optionalScale(body?.residualImpact) ?? null,
        mitigationPlan: this.nullableText(body?.mitigationPlan) ?? null,
        contingencyPlan: this.nullableText(body?.contingencyPlan) ?? null,
        dueDate: this.optionalDate(body?.dueDate, 'Data de mitigacao') ?? null,
        identifiedAt: this.optionalDate(body?.identifiedAt, 'Data de identificacao') ?? new Date(),
        closedAt: status === RiskStatus.CLOSED ? new Date() : null,
        createdById: me.sub,
        ...links.ids,
      },
      include: this.include(),
    });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: risk.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.CREATED,
      entityType: TraceEntityType.RISK,
      entityId: risk.id,
      title: 'Risco registrado',
      description: risk.title,
      statusTo: risk.status,
      metadata: { category: risk.category, probability: risk.probability, impact: risk.impact, score: this.score(risk.probability, risk.impact) },
    });

    return this.enrich(risk);
  }

  async update(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(before), 'edit');

    const links = await this.validateLinks(me.companyId, {
      orgNodeId: 'orgNodeId' in (patch ?? {}) ? this.id(patch.orgNodeId) : before.orgNodeId,
      indicatorId: 'indicatorId' in (patch ?? {}) ? this.id(patch.indicatorId) : before.indicatorId,
      projectId: 'projectId' in (patch ?? {}) ? this.id(patch.projectId) : before.projectId,
      mitigationActionId: 'mitigationActionId' in (patch ?? {}) || 'actionId' in (patch ?? {})
        ? this.id(patch.mitigationActionId ?? patch.actionId)
        : before.mitigationActionId,
      responsibleUserId: 'responsibleUserId' in (patch ?? {}) ? this.id(patch.responsibleUserId) : before.responsibleUserId,
    });
    await this.assertWriteArea(me, links.area, 'edit');

    const data: any = { ...links.ids };
    if ('title' in (patch ?? {})) data.title = this.requiredText(patch.title, 'Titulo');
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('category' in (patch ?? {})) data.category = this.parseCategory(patch.category);
    const statusChanged = 'status' in (patch ?? {});
    if (statusChanged) {
      data.status = this.parseStatus(patch.status) ?? before.status;
      data.closedAt = data.status === RiskStatus.CLOSED ? before.closedAt ?? new Date() : null;
    }
    if ('probability' in (patch ?? {})) data.probability = this.scoreValue(patch.probability, before.probability);
    if ('impact' in (patch ?? {})) data.impact = this.scoreValue(patch.impact, before.impact);
    if ('residualProbability' in (patch ?? {})) data.residualProbability = this.optionalScale(patch.residualProbability);
    if ('residualImpact' in (patch ?? {})) data.residualImpact = this.optionalScale(patch.residualImpact);
    if ('mitigationPlan' in (patch ?? {})) data.mitigationPlan = this.nullableText(patch.mitigationPlan);
    if ('contingencyPlan' in (patch ?? {})) data.contingencyPlan = this.nullableText(patch.contingencyPlan);
    if ('dueDate' in (patch ?? {})) data.dueDate = this.optionalDate(patch.dueDate, 'Data de mitigacao');
    if ('identifiedAt' in (patch ?? {})) data.identifiedAt = this.optionalDate(patch.identifiedAt, 'Data de identificacao') ?? before.identifiedAt;

    const updated = await this.prisma.riskRegister.update({
      where: { id },
      data,
      include: this.include(),
    });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: updated.indicatorId,
      userId: me.sub,
      eventType: statusChanged && before.status !== updated.status ? TraceEventType.STATUS_CHANGED : TraceEventType.UPDATED,
      entityType: TraceEntityType.RISK,
      entityId: updated.id,
      title: statusChanged && before.status !== updated.status ? 'Status do risco alterado' : 'Risco atualizado',
      description: updated.title,
      statusFrom: before.status,
      statusTo: updated.status,
      metadata: { category: updated.category, probability: updated.probability, impact: updated.impact, score: this.score(updated.probability, updated.impact) },
    });

    return this.enrich(updated);
  }

  async remove(me: AuthPayload, id: string) {
    const risk = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(risk), 'delete');
    const removed = await this.prisma.riskRegister.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: this.include(),
    });
    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: risk.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.RISK,
      entityId: risk.id,
      title: 'Risco excluido',
      description: risk.title,
      statusFrom: risk.status,
      statusTo: 'DELETED',
    });
    return this.enrich(removed);
  }

  private async validateLinks(companyId: string, input: LinkInput) {
    const ids = {
      orgNodeId: input.orgNodeId ?? null,
      indicatorId: input.indicatorId ?? null,
      projectId: input.projectId ?? null,
      mitigationActionId: input.mitigationActionId ?? null,
      responsibleUserId: input.responsibleUserId ?? null,
    };

    const areas: string[] = [];

    if (ids.orgNodeId) {
      const orgNode = await this.prisma.orgNode.findFirst({
        where: { id: ids.orgNodeId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!orgNode) throw new NotFoundException('Area ou processo nao encontrado');
      areas.push(orgNode.id);
    }

    if (ids.indicatorId) {
      const indicator = await this.prisma.indicator.findFirst({
        where: { id: ids.indicatorId, companyId, deletedAt: null },
        select: { ownerNodeId: true },
      });
      if (!indicator) throw new NotFoundException('Indicador nao encontrado');
      areas.push(indicator.ownerNodeId);
    }

    if (ids.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: ids.projectId, companyId, deletedAt: null },
        select: { indicator: { select: { ownerNodeId: true } } },
      });
      if (!project) throw new NotFoundException('Projeto nao encontrado');
      if (project.indicator?.ownerNodeId) areas.push(project.indicator.ownerNodeId);
    }

    if (ids.mitigationActionId) {
      const action = await this.prisma.actionPlan.findFirst({
        where: { id: ids.mitigationActionId, companyId, deletedAt: null },
        select: { ownerNodeId: true, indicator: { select: { ownerNodeId: true } } },
      });
      if (!action) throw new NotFoundException('Plano de mitigacao nao encontrado');
      const area = action.ownerNodeId ?? action.indicator?.ownerNodeId ?? null;
      if (area) areas.push(area);
    }

    if (ids.responsibleUserId) {
      const user = await this.prisma.user.findFirst({
        where: { id: ids.responsibleUserId, companyId, deletedAt: null, active: true },
        select: { id: true },
      });
      if (!user) throw new NotFoundException('Responsavel nao encontrado');
    }

    const uniqueAreas = Array.from(new Set(areas.filter(Boolean)));
    if (uniqueAreas.length > 1) {
      throw new ConflictException('Vinculos do risco pertencem a areas diferentes.');
    }

    return { ids, area: uniqueAreas[0] ?? null };
  }
}

/** Normaliza um valor de escala para 1..5 (0/null quando fora da faixa). */
function clampScale(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return 0;
  return n;
}
