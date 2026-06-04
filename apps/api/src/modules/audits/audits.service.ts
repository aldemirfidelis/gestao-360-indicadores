import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditFindingStatus,
  AuditFindingType,
  AuditStatus,
  AuditType,
  NonConformitySeverity,
  Prisma,
  TraceEntityType,
  TraceEventType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';
import { NonConformitiesService } from '../nonconformities/nonconformities.service';

// Auditorias e compliance: programa/execucao de auditorias com constatacoes (findings).
// Uma constatacao de nao conformidade pode gerar uma NC (reuso do modulo NC), fechando o
// ciclo auditoria -> constatacao -> NC -> acao corretiva -> eficacia. Isolamento empresa+area.
const MODULE = 'audits';
const OPEN_AUDIT = new Set<AuditStatus>([AuditStatus.PLANNED, AuditStatus.IN_PROGRESS]);

type AuditFilters = {
  status?: string;
  type?: string;
  search?: string;
  orgNodeId?: string;
};

@Injectable()
export class AuditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly access: AccessService,
    private readonly nonconformities: NonConformitiesService,
  ) {}

  private include() {
    return {
      orgNode: { select: { id: true, name: true, type: true } },
      leadAuditor: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      findings: {
        orderBy: { createdAt: 'asc' as const },
        include: { nonConformity: { select: { id: true, number: true, title: true, status: true } } },
      },
    };
  }

  private areaOf(audit: any): string | null {
    return audit.orgNodeId ?? audit.orgNode?.id ?? null;
  }

  private async assertWriteArea(me: AuthPayload, area: string | null, action: AreaAction) {
    if (area) await this.access.assertCanWrite(me.sub, area, MODULE, action);
  }

  private async assertViewArea(me: AuthPayload, audit: any) {
    const area = this.areaOf(audit);
    if (!area) return;
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    if (permitted && !permitted.includes(area)) {
      throw new ForbiddenException('Voce nao tem acesso as auditorias desta area.');
    }
  }

  private enrich(audit: any) {
    const findings: any[] = audit.findings ?? [];
    const ncFindings = findings.filter((f) => f.type === AuditFindingType.NONCONFORMITY);
    return {
      ...audit,
      findingsCount: findings.length,
      openFindings: findings.filter((f) => f.status !== AuditFindingStatus.CLOSED).length,
      ncCount: ncFindings.length,
      pendingNc: ncFindings.filter((f) => !f.nonConformityId).length,
      areaId: this.areaOf(audit),
    };
  }

  private parseStatus(value?: string): AuditStatus | undefined {
    if (!value) return undefined;
    if (!Object.values(AuditStatus).includes(value as AuditStatus)) throw new BadRequestException('Status de auditoria invalido.');
    return value as AuditStatus;
  }

  private parseType(value?: string): AuditType | undefined {
    if (!value) return undefined;
    if (!Object.values(AuditType).includes(value as AuditType)) throw new BadRequestException('Tipo de auditoria invalido.');
    return value as AuditType;
  }

  private parseFindingType(value?: string): AuditFindingType | undefined {
    if (!value) return undefined;
    if (!Object.values(AuditFindingType).includes(value as AuditFindingType)) throw new BadRequestException('Tipo de constatacao invalido.');
    return value as AuditFindingType;
  }

  private parseFindingStatus(value?: string): AuditFindingStatus | undefined {
    if (!value) return undefined;
    if (!Object.values(AuditFindingStatus).includes(value as AuditFindingStatus)) throw new BadRequestException('Status de constatacao invalido.');
    return value as AuditFindingStatus;
  }

  private parseSeverity(value?: string): NonConformitySeverity | undefined {
    if (!value) return undefined;
    if (!Object.values(NonConformitySeverity).includes(value as NonConformitySeverity)) throw new BadRequestException('Severidade invalida.');
    return value as NonConformitySeverity;
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

  private optionalDate(value: unknown, field: string): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`${field} invalido.`);
    return d;
  }

  private visibilityWhere(permitted: string[] | null) {
    if (!permitted) return undefined;
    return { OR: [{ orgNodeId: null }, { orgNodeId: { in: permitted } }] };
  }

  private async loadScoped(id: string, companyId: string) {
    const audit = await this.prisma.audit.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.include(),
    });
    if (!audit) throw new NotFoundException('Auditoria nao encontrada');
    return audit;
  }

  /** Carrega a constatacao isolada por empresa (via auditoria) + traz a area. */
  private async loadFinding(findingId: string, companyId: string) {
    const finding = await this.prisma.auditFinding.findFirst({
      where: { id: findingId, audit: { companyId, deletedAt: null } },
      include: { audit: { include: { orgNode: { select: { id: true } } } } },
    });
    if (!finding) throw new NotFoundException('Constatacao nao encontrada');
    return finding;
  }

  async list(me: AuthPayload, filters: AuditFilters = {}) {
    const status = this.parseStatus(filters.status);
    const type = this.parseType(filters.type);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: Prisma.AuditWhereInput[] = [];
    const areaFilter = this.visibilityWhere(permitted);
    if (areaFilter) and.push(areaFilter as Prisma.AuditWhereInput);

    const term = filters.search?.trim();
    if (term) {
      and.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { scope: { contains: term, mode: 'insensitive' } },
          { summary: { contains: term, mode: 'insensitive' } },
          { findings: { some: { description: { contains: term, mode: 'insensitive' } } } },
        ],
      });
    }

    const items = await this.prisma.audit.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(filters.orgNodeId ? { orgNodeId: filters.orgNodeId } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      include: this.include(),
      orderBy: [{ status: 'asc' }, { plannedDate: 'asc' }, { number: 'desc' }],
    });

    return items.map((audit) => this.enrich(audit));
  }

  async summary(me: AuthPayload) {
    const list = await this.list(me);
    const byStatus = Object.fromEntries(Object.values(AuditStatus).map((s) => [s, 0])) as Record<AuditStatus, number>;
    const byType = Object.fromEntries(Object.values(AuditType).map((t) => [t, 0])) as Record<AuditType, number>;
    let openFindings = 0;
    let ncFindings = 0;
    let pendingNc = 0;
    for (const audit of list as any[]) {
      byStatus[audit.status as AuditStatus]++;
      byType[audit.type as AuditType]++;
      openFindings += audit.openFindings;
      ncFindings += audit.ncCount;
      pendingNc += audit.pendingNc;
    }
    return {
      total: list.length,
      open: list.filter((a: any) => OPEN_AUDIT.has(a.status)).length,
      completed: byStatus[AuditStatus.COMPLETED] ?? 0,
      openFindings,
      ncFindings,
      pendingNc,
      byStatus,
      byType,
      upcoming: [...list]
        .filter((a: any) => OPEN_AUDIT.has(a.status))
        .sort((a: any, b: any) => {
          const ad = a.plannedDate ? new Date(a.plannedDate).getTime() : Number.MAX_SAFE_INTEGER;
          const bd = b.plannedDate ? new Date(b.plannedDate).getTime() : Number.MAX_SAFE_INTEGER;
          return ad - bd;
        })
        .slice(0, 8)
        .map((a: any) => ({ id: a.id, number: a.number, title: a.title, type: a.type, status: a.status, plannedDate: a.plannedDate, orgNode: a.orgNode, leadAuditor: a.leadAuditor })),
    };
  }

  async getById(me: AuthPayload, id: string) {
    const audit = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, audit);
    return this.enrich(audit);
  }

  async options(me: AuthPayload) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const areaWhere = permitted ? { id: { in: permitted } } : {};
    const [orgNodes, users] = await Promise.all([
      this.prisma.orgNode.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true, ...areaWhere },
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
      types: Object.values(AuditType),
      statuses: Object.values(AuditStatus),
      findingTypes: Object.values(AuditFindingType),
      findingStatuses: Object.values(AuditFindingStatus),
      severities: Object.values(NonConformitySeverity),
    };
  }

  private statusTimestamps(status: AuditStatus, before?: { startedAt: Date | null; completedAt: Date | null }) {
    const now = new Date();
    const startedAt = status === AuditStatus.IN_PROGRESS || status === AuditStatus.COMPLETED ? before?.startedAt ?? now : before?.startedAt ?? null;
    const completedAt = status === AuditStatus.COMPLETED ? before?.completedAt ?? now : null;
    return { startedAt, completedAt };
  }

  private async validateAuditLinks(companyId: string, orgNodeId: string | null, leadAuditorUserId: string | null) {
    let area: string | null = null;
    if (orgNodeId) {
      const orgNode = await this.prisma.orgNode.findFirst({ where: { id: orgNodeId, companyId, deletedAt: null }, select: { id: true } });
      if (!orgNode) throw new NotFoundException('Area ou processo nao encontrado');
      area = orgNode.id;
    }
    if (leadAuditorUserId) {
      const user = await this.prisma.user.findFirst({ where: { id: leadAuditorUserId, companyId, deletedAt: null, active: true }, select: { id: true } });
      if (!user) throw new NotFoundException('Auditor lider nao encontrado');
    }
    return area;
  }

  async create(me: AuthPayload, body: any) {
    const title = this.requiredText(body?.title, 'Titulo');
    const type = this.parseType(body?.type) ?? AuditType.INTERNAL;
    const status = this.parseStatus(body?.status) ?? AuditStatus.PLANNED;
    const orgNodeId = this.id(body?.orgNodeId);
    const leadAuditorUserId = this.id(body?.leadAuditorUserId);
    const area = await this.validateAuditLinks(me.companyId, orgNodeId, leadAuditorUserId);
    await this.assertWriteArea(me, area, 'create');
    const stamps = this.statusTimestamps(status);

    const audit = await this.prisma.$transaction(async (tx) => {
      const last = await tx.audit.findFirst({ where: { companyId: me.companyId }, orderBy: { number: 'desc' }, select: { number: true } });
      return tx.audit.create({
        data: {
          companyId: me.companyId,
          number: (last?.number ?? 0) + 1,
          orgNodeId,
          leadAuditorUserId,
          title,
          scope: this.nullableText(body?.scope) ?? null,
          type,
          status,
          plannedDate: this.optionalDate(body?.plannedDate, 'Data planejada') ?? null,
          startedAt: stamps.startedAt,
          completedAt: stamps.completedAt,
          summary: this.nullableText(body?.summary) ?? null,
          createdById: me.sub,
        },
        include: this.include(),
      });
    });

    await this.traceability.record({
      companyId: me.companyId,
      userId: me.sub,
      eventType: TraceEventType.CREATED,
      entityType: TraceEntityType.AUDIT,
      entityId: audit.id,
      title: `Auditoria #${audit.number} criada`,
      description: audit.title,
      statusTo: audit.status,
      metadata: { type: audit.type },
    });

    return this.enrich(audit);
  }

  async update(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(before), 'edit');

    const data: any = {};
    if ('orgNodeId' in (patch ?? {}) || 'leadAuditorUserId' in (patch ?? {})) {
      const orgNodeId = 'orgNodeId' in (patch ?? {}) ? this.id(patch.orgNodeId) : before.orgNodeId;
      const leadAuditorUserId = 'leadAuditorUserId' in (patch ?? {}) ? this.id(patch.leadAuditorUserId) : before.leadAuditorUserId;
      const area = await this.validateAuditLinks(me.companyId, orgNodeId, leadAuditorUserId);
      await this.assertWriteArea(me, area, 'edit');
      data.orgNodeId = orgNodeId;
      data.leadAuditorUserId = leadAuditorUserId;
    }
    if ('title' in (patch ?? {})) data.title = this.requiredText(patch.title, 'Titulo');
    if ('scope' in (patch ?? {})) data.scope = this.nullableText(patch.scope);
    if ('type' in (patch ?? {})) data.type = this.parseType(patch.type) ?? before.type;
    if ('summary' in (patch ?? {})) data.summary = this.nullableText(patch.summary);
    if ('plannedDate' in (patch ?? {})) data.plannedDate = this.optionalDate(patch.plannedDate, 'Data planejada');
    const statusChanged = 'status' in (patch ?? {});
    if (statusChanged) {
      data.status = this.parseStatus(patch.status) ?? before.status;
      const stamps = this.statusTimestamps(data.status, before);
      data.startedAt = stamps.startedAt;
      data.completedAt = stamps.completedAt;
    }

    const updated = await this.prisma.audit.update({ where: { id }, data, include: this.include() });

    await this.traceability.record({
      companyId: me.companyId,
      userId: me.sub,
      eventType: statusChanged && before.status !== updated.status ? TraceEventType.STATUS_CHANGED : TraceEventType.UPDATED,
      entityType: TraceEntityType.AUDIT,
      entityId: updated.id,
      title: statusChanged && before.status !== updated.status ? `Status da auditoria #${updated.number} alterado` : `Auditoria #${updated.number} atualizada`,
      description: updated.title,
      statusFrom: before.status,
      statusTo: updated.status,
    });

    return this.enrich(updated);
  }

  async remove(me: AuthPayload, id: string) {
    const audit = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(audit), 'delete');
    const removed = await this.prisma.audit.update({ where: { id }, data: { deletedAt: new Date() }, include: this.include() });
    await this.traceability.record({
      companyId: me.companyId,
      userId: me.sub,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.AUDIT,
      entityId: audit.id,
      title: `Auditoria #${audit.number} excluida`,
      description: audit.title,
      statusFrom: audit.status,
      statusTo: 'DELETED',
    });
    return this.enrich(removed);
  }

  // ---- Constatacoes (findings) ----

  async addFinding(me: AuthPayload, auditId: string, body: any) {
    const audit = await this.loadScoped(auditId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(audit), 'edit');
    const finding = await this.prisma.auditFinding.create({
      data: {
        auditId,
        type: this.parseFindingType(body?.type) ?? AuditFindingType.OBSERVATION,
        severity: this.parseSeverity(body?.severity) ?? null,
        status: this.parseFindingStatus(body?.status) ?? AuditFindingStatus.OPEN,
        requirement: this.nullableText(body?.requirement) ?? null,
        description: this.requiredText(body?.description, 'Descricao da constatacao'),
        evidence: this.nullableText(body?.evidence) ?? null,
        recommendation: this.nullableText(body?.recommendation) ?? null,
        dueDate: this.optionalDate(body?.dueDate, 'Prazo') ?? null,
      },
      include: { nonConformity: { select: { id: true, number: true, title: true, status: true } } },
    });
    await this.traceability.record({
      companyId: me.companyId,
      userId: me.sub,
      eventType: TraceEventType.CREATED,
      entityType: TraceEntityType.AUDIT_FINDING,
      entityId: finding.id,
      relatedType: TraceEntityType.AUDIT,
      relatedId: auditId,
      title: 'Constatacao registrada na auditoria',
      description: finding.description,
      metadata: { type: finding.type, severity: finding.severity, auditNumber: audit.number },
    });
    return finding;
  }

  async updateFinding(me: AuthPayload, findingId: string, patch: any) {
    const finding = await this.loadFinding(findingId, me.companyId);
    await this.assertWriteArea(me, finding.audit.orgNodeId ?? null, 'edit');
    const data: any = {};
    if ('type' in (patch ?? {})) data.type = this.parseFindingType(patch.type) ?? finding.type;
    if ('severity' in (patch ?? {})) data.severity = this.parseSeverity(patch.severity) ?? null;
    if ('status' in (patch ?? {})) data.status = this.parseFindingStatus(patch.status) ?? finding.status;
    if ('requirement' in (patch ?? {})) data.requirement = this.nullableText(patch.requirement);
    if ('description' in (patch ?? {})) data.description = this.requiredText(patch.description, 'Descricao da constatacao');
    if ('evidence' in (patch ?? {})) data.evidence = this.nullableText(patch.evidence);
    if ('recommendation' in (patch ?? {})) data.recommendation = this.nullableText(patch.recommendation);
    if ('dueDate' in (patch ?? {})) data.dueDate = this.optionalDate(patch.dueDate, 'Prazo');
    return this.prisma.auditFinding.update({
      where: { id: findingId },
      data,
      include: { nonConformity: { select: { id: true, number: true, title: true, status: true } } },
    });
  }

  async removeFinding(me: AuthPayload, findingId: string) {
    const finding = await this.loadFinding(findingId, me.companyId);
    await this.assertWriteArea(me, finding.audit.orgNodeId ?? null, 'edit');
    return this.prisma.auditFinding.delete({ where: { id: findingId } });
  }

  /** Gera uma Nao Conformidade a partir de uma constatacao e a vincula (reuso do modulo NC). */
  async generateNonConformity(me: AuthPayload, findingId: string, body: any = {}) {
    const finding = await this.loadFinding(findingId, me.companyId);
    await this.assertWriteArea(me, finding.audit.orgNodeId ?? null, 'edit');
    if (finding.nonConformityId) {
      throw new BadRequestException('Esta constatacao ja possui uma nao conformidade vinculada.');
    }

    const nc = await this.nonconformities.create(me, {
      title: this.nullableText(body?.title) ?? `Auditoria #${finding.audit.number}: ${finding.description}`.slice(0, 180),
      description: finding.evidence ?? finding.description,
      source: 'AUDIT',
      severity: finding.severity ?? NonConformitySeverity.MAJOR,
      orgNodeId: finding.audit.orgNodeId ?? undefined,
      responsibleUserId: this.id(body?.responsibleUserId) ?? undefined,
      dueDate: body?.dueDate ?? undefined,
    });

    const updated = await this.prisma.auditFinding.update({
      where: { id: findingId },
      data: { nonConformityId: nc.id, status: AuditFindingStatus.IN_TREATMENT },
      include: { nonConformity: { select: { id: true, number: true, title: true, status: true } } },
    });

    await this.traceability.record({
      companyId: me.companyId,
      userId: me.sub,
      eventType: TraceEventType.CREATED,
      entityType: TraceEntityType.NON_CONFORMITY,
      entityId: nc.id,
      relatedType: TraceEntityType.AUDIT_FINDING,
      relatedId: findingId,
      title: 'Nao conformidade gerada a partir de constatacao de auditoria',
      description: nc.title,
      metadata: { auditNumber: finding.audit.number, ncNumber: nc.number },
    });

    return updated;
  }
}
