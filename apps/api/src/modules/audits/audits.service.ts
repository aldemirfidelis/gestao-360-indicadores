import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditApprovalDecision,
  AuditChecklistResponseKind,
  AuditChecklistTemplateStatus,
  AuditEvidenceStatus,
  AuditFindingStatus,
  AuditFindingType,
  AuditFollowUpStatus,
  AuditModality,
  AuditProgramStatus,
  AuditRiskLevel,
  AuditStatus,
  AuditType,
  AuditUniverseItemKind,
  AuditorKind,
  AuditorStatus,
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
import { AuditCodeService } from './audit-code.service';
import { AuditRiskService } from './audit-risk.service';
import { AuditStorageService } from './audit-storage.service';

const MODULE = 'audits';
const OPEN_AUDIT = new Set<AuditStatus>([
  AuditStatus.PLANNED,
  AuditStatus.SCHEDULED,
  AuditStatus.PREPARATION,
  AuditStatus.READY_EXECUTION,
  AuditStatus.IN_PROGRESS,
  AuditStatus.WAITING_COMPLEMENT,
  AuditStatus.LEAD_REVIEW,
  AuditStatus.WAITING_AUDITED_RESPONSE,
  AuditStatus.REPORT_ISSUED,
  AuditStatus.FOLLOW_UP,
  AuditStatus.RESCHEDULED,
]);
const NONCONFORMITY_FINDINGS = new Set<AuditFindingType>([
  AuditFindingType.NONCONFORMITY,
  AuditFindingType.MINOR_NONCONFORMITY,
  AuditFindingType.MAJOR_NONCONFORMITY,
  AuditFindingType.CRITICAL_NONCONFORMITY,
]);
const CLOSED_LOCKED = new Set<AuditStatus>([AuditStatus.COMPLETED, AuditStatus.CLOSED, AuditStatus.CANCELLED]);

type Tx = Prisma.TransactionClient;

type AuditFilters = {
  status?: string;
  type?: string;
  modality?: string;
  search?: string;
  orgNodeId?: string;
  programId?: string;
  leadAuditorUserId?: string;
};

@Injectable()
export class AuditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly access: AccessService,
    private readonly nonconformities: NonConformitiesService,
    private readonly codes: AuditCodeService,
    private readonly risk: AuditRiskService,
    private readonly storage: AuditStorageService,
  ) {}

  private include() {
    return {
      orgNode: { select: { id: true, name: true, type: true } },
      leadAuditor: { select: { id: true, name: true, email: true, defaultNodeId: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      findings: {
        where: { deletedAt: null },
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
    const ncFindings = findings.filter((f) => NONCONFORMITY_FINDINGS.has(f.type));
    const now = new Date();
    return {
      ...audit,
      findingsCount: findings.length,
      openFindings: findings.filter((f) => f.status !== AuditFindingStatus.CLOSED).length,
      ncCount: ncFindings.length,
      pendingNc: ncFindings.filter((f) => !f.nonConformityId).length,
      criticalFindings: findings.filter((f) => f.severity === NonConformitySeverity.CRITICAL || f.type === AuditFindingType.CRITICAL_NONCONFORMITY).length,
      overdueFindings: findings.filter((f) => f.dueDate && new Date(f.dueDate) < now && f.status !== AuditFindingStatus.CLOSED).length,
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

  private parseModality(value?: string): AuditModality | undefined {
    if (!value) return undefined;
    if (!Object.values(AuditModality).includes(value as AuditModality)) throw new BadRequestException('Modalidade de auditoria invalida.');
    return value as AuditModality;
  }

  private parseProgramStatus(value?: string): AuditProgramStatus | undefined {
    if (!value) return undefined;
    if (!Object.values(AuditProgramStatus).includes(value as AuditProgramStatus)) throw new BadRequestException('Status de programa invalido.');
    return value as AuditProgramStatus;
  }

  private parseUniverseKind(value?: string): AuditUniverseItemKind | undefined {
    if (!value) return undefined;
    if (!Object.values(AuditUniverseItemKind).includes(value as AuditUniverseItemKind)) throw new BadRequestException('Tipo de item auditavel invalido.');
    return value as AuditUniverseItemKind;
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

  private parseChecklistTemplateStatus(value?: string): AuditChecklistTemplateStatus | undefined {
    if (!value) return undefined;
    if (!Object.values(AuditChecklistTemplateStatus).includes(value as AuditChecklistTemplateStatus)) throw new BadRequestException('Status de checklist invalido.');
    return value as AuditChecklistTemplateStatus;
  }

  private parseResponse(value?: string): AuditChecklistResponseKind | undefined {
    if (!value) return undefined;
    if (!Object.values(AuditChecklistResponseKind).includes(value as AuditChecklistResponseKind)) throw new BadRequestException('Resposta de checklist invalida.');
    return value as AuditChecklistResponseKind;
  }

  private parseEvidenceStatus(value?: string): AuditEvidenceStatus | undefined {
    if (!value) return undefined;
    if (!Object.values(AuditEvidenceStatus).includes(value as AuditEvidenceStatus)) throw new BadRequestException('Status de evidencia invalido.');
    return value as AuditEvidenceStatus;
  }

  private parseFollowUpStatus(value?: string): AuditFollowUpStatus | undefined {
    if (!value) return undefined;
    if (!Object.values(AuditFollowUpStatus).includes(value as AuditFollowUpStatus)) throw new BadRequestException('Status de follow-up invalido.');
    return value as AuditFollowUpStatus;
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

  private idArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  private optionalDate(value: unknown, field: string): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`${field} invalido.`);
    return d;
  }

  private optionalNumber(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new BadRequestException('Valor numerico invalido.');
    return n;
  }

  private visibilityWhere(permitted: string[] | null) {
    if (!permitted) return undefined;
    return { OR: [{ orgNodeId: null }, { orgNodeId: { in: permitted } }] };
  }

  private programVisibilityWhere(permitted: string[] | null) {
    if (!permitted) return undefined;
    return { OR: [{ orgNodeIds: { isEmpty: true } }, { orgNodeIds: { hasSome: permitted } }] };
  }

  private async loadScoped(id: string, companyId: string) {
    const audit = await this.prisma.audit.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.include(),
    });
    if (!audit) throw new NotFoundException('Auditoria nao encontrada');
    return audit;
  }

  private async loadFinding(findingId: string, companyId: string) {
    const finding = await this.prisma.auditFinding.findFirst({
      where: { id: findingId, companyId, audit: { companyId, deletedAt: null }, deletedAt: null },
      include: { audit: { include: { orgNode: { select: { id: true } } } } },
    });
    if (!finding) throw new NotFoundException('Constatacao nao encontrada');
    return finding;
  }

  async list(me: AuthPayload, filters: AuditFilters = {}) {
    const status = this.parseStatus(filters.status);
    const type = this.parseType(filters.type);
    const modality = this.parseModality(filters.modality);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: Prisma.AuditWhereInput[] = [];
    const areaFilter = this.visibilityWhere(permitted);
    if (areaFilter) and.push(areaFilter as Prisma.AuditWhereInput);

    const term = filters.search?.trim();
    if (term) {
      and.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { code: { contains: term, mode: 'insensitive' } },
          { scope: { contains: term, mode: 'insensitive' } },
          { objective: { contains: term, mode: 'insensitive' } },
          { criteria: { contains: term, mode: 'insensitive' } },
          { summary: { contains: term, mode: 'insensitive' } },
          { findings: { some: { description: { contains: term, mode: 'insensitive' }, deletedAt: null } } },
        ],
      });
    }

    const items = await this.prisma.audit.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(modality ? { modality } : {}),
        ...(filters.orgNodeId ? { orgNodeId: filters.orgNodeId } : {}),
        ...(filters.programId ? { programId: filters.programId } : {}),
        ...(filters.leadAuditorUserId ? { leadAuditorUserId: filters.leadAuditorUserId } : {}),
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
    const byModality = Object.fromEntries(Object.values(AuditModality).map((m) => [m, 0])) as Record<AuditModality, number>;
    let openFindings = 0;
    let ncFindings = 0;
    let pendingNc = 0;
    let criticalFindings = 0;
    let overdueFindings = 0;
    const today = new Date();
    for (const audit of list as any[]) {
      byStatus[audit.status as AuditStatus]++;
      byType[audit.type as AuditType]++;
      byModality[audit.modality as AuditModality]++;
      openFindings += audit.openFindings;
      ncFindings += audit.ncCount;
      pendingNc += audit.pendingNc;
      criticalFindings += audit.criticalFindings;
      overdueFindings += audit.overdueFindings;
    }
    return {
      total: list.length,
      open: list.filter((a: any) => OPEN_AUDIT.has(a.status)).length,
      completed: (byStatus[AuditStatus.COMPLETED] ?? 0) + (byStatus[AuditStatus.CLOSED] ?? 0),
      overdueAudits: list.filter((a: any) => a.plannedDate && new Date(a.plannedDate) < today && OPEN_AUDIT.has(a.status)).length,
      openFindings,
      ncFindings,
      pendingNc,
      criticalFindings,
      overdueFindings,
      byStatus,
      byType,
      byModality,
      upcoming: [...list]
        .filter((a: any) => OPEN_AUDIT.has(a.status))
        .sort((a: any, b: any) => {
          const ad = a.plannedDate ? new Date(a.plannedDate).getTime() : Number.MAX_SAFE_INTEGER;
          const bd = b.plannedDate ? new Date(b.plannedDate).getTime() : Number.MAX_SAFE_INTEGER;
          return ad - bd;
        })
        .slice(0, 8)
        .map((a: any) => ({ id: a.id, number: a.number, code: a.code, title: a.title, type: a.type, modality: a.modality, status: a.status, plannedDate: a.plannedDate, orgNode: a.orgNode, leadAuditor: a.leadAuditor })),
    };
  }

  async dashboard(me: AuthPayload) {
    const audits = (await this.list(me)) as any[];
    const visibleIds = audits.map((audit) => audit.id);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const [summary, universe, programs, activity] = await Promise.all([
      this.summary(me),
      this.prisma.auditUniverseItem.findMany({
        where: {
          companyId: me.companyId,
          deletedAt: null,
          ...(permitted ? { OR: [{ orgNodeId: null }, { orgNodeId: { in: permitted } }] } : {}),
        },
        orderBy: [{ riskScore: 'desc' }, { priority: 'desc' }],
        take: 30,
      }),
      this.listPrograms(me, {}),
      visibleIds.length
        ? this.prisma.auditTimelineEvent.findMany({ where: { companyId: me.companyId, auditId: { in: visibleIds } }, orderBy: { createdAt: 'desc' }, take: 20 })
        : Promise.resolve([]),
    ]);

    const byArea = new Map<string, { name: string; total: number; open: number; critical: number }>();
    const workload = new Map<string, { auditor: string; total: number; open: number; hours: number }>();
    for (const audit of audits) {
      const areaName = audit.orgNode?.name ?? 'Sem area';
      const area = byArea.get(areaName) ?? { name: areaName, total: 0, open: 0, critical: 0 };
      area.total++;
      if (OPEN_AUDIT.has(audit.status)) area.open++;
      area.critical += audit.criticalFindings;
      byArea.set(areaName, area);

      const auditor = audit.leadAuditor?.name ?? 'Sem auditor';
      const item = workload.get(auditor) ?? { auditor, total: 0, open: 0, hours: 0 };
      item.total++;
      if (OPEN_AUDIT.has(audit.status)) item.open++;
      item.hours += Number(audit.estimatedHours ?? audit.actualHours ?? 0);
      workload.set(auditor, item);
    }

    const heatmap = Object.values(AuditRiskLevel).map((level) => ({
      level,
      total: universe.filter((item) => item.riskLevel === level).length,
      items: universe.filter((item) => item.riskLevel === level).slice(0, 6),
    }));

    return {
      summary,
      programs,
      coverageByArea: [...byArea.values()].sort((a, b) => b.total - a.total),
      workload: [...workload.values()].sort((a, b) => b.open - a.open),
      calendar: audits.filter((audit) => audit.plannedDate).map((audit) => ({ id: audit.id, code: audit.code ?? `#${audit.number}`, title: audit.title, status: audit.status, plannedDate: audit.plannedDate, orgNode: audit.orgNode })),
      riskQueue: universe.slice(0, 12),
      riskHeatmap: heatmap,
      criticalAudits: audits.filter((audit) => audit.criticalFindings > 0 || audit.overdueFindings > 0).slice(0, 10),
      activity,
    };
  }

  async getById(me: AuthPayload, id: string) {
    const audit = await this.loadScoped(id, me.companyId);
    await this.assertViewArea(me, audit);
    const [
      program,
      typeConfig,
      universeItem,
      checklistExecutions,
      evidence,
      reports,
      approvals,
      followUps,
      timeline,
      aiSuggestions,
    ] = await Promise.all([
      audit.programId ? this.prisma.auditProgram.findFirst({ where: { id: audit.programId, companyId: me.companyId, deletedAt: null } }) : null,
      audit.typeConfigId ? this.prisma.auditTypeConfig.findFirst({ where: { id: audit.typeConfigId, companyId: me.companyId, deletedAt: null } }) : null,
      audit.universeItemId ? this.prisma.auditUniverseItem.findFirst({ where: { id: audit.universeItemId, companyId: me.companyId, deletedAt: null } }) : null,
      this.prisma.auditChecklistExecution.findMany({ where: { auditId: id, companyId: me.companyId, deletedAt: null }, include: { responses: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditEvidence.findMany({ where: { auditId: id, companyId: me.companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditReport.findMany({ where: { auditId: id, companyId: me.companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditApproval.findMany({ where: { auditId: id, companyId: me.companyId }, orderBy: [{ approvalOrder: 'asc' }, { createdAt: 'desc' }] }),
      this.prisma.auditFollowUp.findMany({ where: { auditId: id, companyId: me.companyId, deletedAt: null }, orderBy: [{ status: 'asc' }, { dueDate: 'asc' }] }),
      this.prisma.auditTimelineEvent.findMany({ where: { auditId: id, companyId: me.companyId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.auditAiSuggestion.findMany({ where: { auditId: id, companyId: me.companyId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return { ...this.enrich(audit), program, typeConfig, universeItem, checklistExecutions, evidence, reports, approvals, followUps, timeline, aiSuggestions };
  }

  async options(me: AuthPayload) {
    await this.codes.ensureDefaults(me.companyId, me.sub);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const areaWhere = permitted ? { id: { in: permitted } } : {};
    const programWhere = this.programVisibilityWhere(permitted);
    const [orgNodes, users, typeConfigs, programs, universeItems, auditorProfiles, checklistTemplates, standards, classifications, riskCriteria] = await Promise.all([
      this.prisma.orgNode.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true, ...areaWhere },
        select: { id: true, name: true, type: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, email: true, defaultNodeId: true },
        orderBy: { name: 'asc' },
      }),
      this.codes.listTypes(me),
      this.prisma.auditProgram.findMany({
        where: { companyId: me.companyId, deletedAt: null, ...(programWhere ? { AND: [programWhere as Prisma.AuditProgramWhereInput] } : {}) },
        orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
        take: 100,
      }),
      this.prisma.auditUniverseItem.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: [{ riskScore: 'desc' }, { name: 'asc' }], take: 200 }),
      this.prisma.auditorProfile.findMany({ where: { companyId: me.companyId, deletedAt: null }, include: { competencies: { where: { deletedAt: null } }, certifications: { where: { deletedAt: null } } }, orderBy: [{ status: 'asc' }, { name: 'asc' }] }),
      this.prisma.auditChecklistTemplate.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: [{ status: 'asc' }, { name: 'asc' }], take: 100 }),
      this.prisma.auditStandard.findMany({ where: { companyId: me.companyId, deletedAt: null }, include: { requirements: { where: { deletedAt: null }, orderBy: { clause: 'asc' } } }, orderBy: { name: 'asc' } }),
      this.prisma.auditFindingClassification.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, orderBy: [{ level: 'asc' }, { name: 'asc' }] }),
      this.prisma.auditRiskCriterion.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, orderBy: { name: 'asc' } }),
    ]);
    return {
      orgNodes,
      users,
      typeConfigs,
      programs,
      universeItems,
      auditorProfiles,
      checklistTemplates,
      standards,
      classifications,
      riskCriteria,
      types: Object.values(AuditType),
      modalities: Object.values(AuditModality),
      statuses: Object.values(AuditStatus),
      findingTypes: Object.values(AuditFindingType),
      findingStatuses: Object.values(AuditFindingStatus),
      severities: Object.values(NonConformitySeverity),
      riskLevels: Object.values(AuditRiskLevel),
      universeKinds: Object.values(AuditUniverseItemKind),
      auditorKinds: Object.values(AuditorKind),
      auditorStatuses: Object.values(AuditorStatus),
      responseKinds: Object.values(AuditChecklistResponseKind),
    };
  }

  private statusTimestamps(status: AuditStatus, before?: { startedAt: Date | null; completedAt: Date | null; closedAt?: Date | null }) {
    const now = new Date();
    const startedAt = status === AuditStatus.IN_PROGRESS || status === AuditStatus.COMPLETED || status === AuditStatus.CLOSED ? before?.startedAt ?? now : before?.startedAt ?? null;
    const completedAt = status === AuditStatus.COMPLETED || status === AuditStatus.CLOSED ? before?.completedAt ?? now : status === AuditStatus.CANCELLED ? before?.completedAt ?? null : before?.completedAt ?? null;
    const closedAt = status === AuditStatus.CLOSED ? before?.closedAt ?? now : before?.closedAt ?? null;
    return { startedAt, completedAt, closedAt };
  }

  private async validateAuditLinks(companyId: string, links: { orgNodeId?: string | null; leadAuditorUserId?: string | null; programId?: string | null; typeConfigId?: string | null; universeItemId?: string | null }) {
    let area: string | null = null;
    if (links.orgNodeId) {
      const orgNode = await this.prisma.orgNode.findFirst({ where: { id: links.orgNodeId, companyId, deletedAt: null }, select: { id: true } });
      if (!orgNode) throw new NotFoundException('Area ou processo nao encontrado');
      area = orgNode.id;
    }
    if (links.leadAuditorUserId) {
      const user = await this.prisma.user.findFirst({ where: { id: links.leadAuditorUserId, companyId, deletedAt: null, active: true }, select: { id: true } });
      if (!user) throw new NotFoundException('Auditor lider nao encontrado');
    }
    if (links.programId) {
      const program = await this.prisma.auditProgram.findFirst({ where: { id: links.programId, companyId, deletedAt: null }, select: { id: true } });
      if (!program) throw new NotFoundException('Programa de auditoria nao encontrado');
    }
    if (links.typeConfigId) {
      const typeConfig = await this.prisma.auditTypeConfig.findFirst({ where: { id: links.typeConfigId, companyId, deletedAt: null, active: true }, select: { id: true } });
      if (!typeConfig) throw new NotFoundException('Tipo configurado de auditoria nao encontrado');
    }
    if (links.universeItemId) {
      const item = await this.prisma.auditUniverseItem.findFirst({ where: { id: links.universeItemId, companyId, deletedAt: null }, select: { id: true, orgNodeId: true } });
      if (!item) throw new NotFoundException('Item do universo de auditoria nao encontrado');
      area = area ?? item.orgNodeId;
    }
    return area;
  }

  private async auditorWarnings(companyId: string, area: string | null, leadAuditorUserId: string | null) {
    if (!leadAuditorUserId) return [];
    const profile = await this.prisma.auditorProfile.findFirst({
      where: { companyId, userId: leadAuditorUserId, deletedAt: null },
      include: { competencies: { where: { deletedAt: null } }, certifications: { where: { deletedAt: null } } },
    });
    const warnings: string[] = [];
    if (!profile) return ['Auditor lider sem perfil formal de auditor.'];
    if (profile.status !== AuditorStatus.ACTIVE) warnings.push('Auditor lider nao esta ativo.');
    if (area && profile.restrictedAreaIds.includes(area)) warnings.push('Conflito de interesse: auditor restrito para esta area.');
    const now = Date.now();
    const expired = profile.certifications.filter((cert) => cert.validUntil && new Date(cert.validUntil).getTime() < now);
    if (expired.length > 0) warnings.push('Auditor possui certificacao vencida.');
    if (profile.conflictPolicy === 'BLOCK' && warnings.length > 0) {
      throw new ConflictException(warnings.join(' '));
    }
    return warnings;
  }

  async create(me: AuthPayload, body: any) {
    await this.codes.ensureDefaults(me.companyId, me.sub);
    const title = this.requiredText(body?.title, 'Titulo');
    const type = this.parseType(body?.type) ?? AuditType.INTERNAL;
    const status = this.parseStatus(body?.status) ?? AuditStatus.PLANNED;
    const modality = this.parseModality(body?.modality) ?? AuditModality.PRESENTIAL;
    const orgNodeId = this.id(body?.orgNodeId);
    const leadAuditorUserId = this.id(body?.leadAuditorUserId);
    const programId = this.id(body?.programId);
    const typeConfigId = this.id(body?.typeConfigId);
    const universeItemId = this.id(body?.universeItemId);
    const area = await this.validateAuditLinks(me.companyId, { orgNodeId, leadAuditorUserId, programId, typeConfigId, universeItemId });
    await this.assertWriteArea(me, area, 'create');
    const warnings = await this.auditorWarnings(me.companyId, area, leadAuditorUserId);
    const stamps = this.statusTimestamps(status);

    const audit = await this.prisma.$transaction(async (tx) => {
      const numbering = await this.codes.nextAuditCode(tx, me.companyId, typeConfigId, type);
      const item = await tx.audit.create({
        data: {
          companyId: me.companyId,
          number: numbering.number,
          code: numbering.code,
          programId,
          typeConfigId,
          universeItemId,
          orgNodeId,
          leadAuditorUserId,
          title,
          scope: this.nullableText(body?.scope) ?? null,
          objective: this.nullableText(body?.objective) ?? null,
          criteria: this.nullableText(body?.criteria) ?? null,
          methodology: this.nullableText(body?.methodology) ?? null,
          origin: this.nullableText(body?.origin) ?? null,
          type,
          modality,
          status,
          plannedDate: this.optionalDate(body?.plannedDate, 'Data planejada') ?? null,
          plannedStartAt: this.optionalDate(body?.plannedStartAt, 'Inicio planejado') ?? null,
          plannedEndAt: this.optionalDate(body?.plannedEndAt, 'Fim planejado') ?? null,
          executedAt: this.optionalDate(body?.executedAt, 'Data realizada') ?? null,
          estimatedHours: this.optionalNumber(body?.estimatedHours) ?? null,
          actualHours: this.optionalNumber(body?.actualHours) ?? null,
          locations: jsonOrUndefined(body?.locations),
          agenda: jsonOrUndefined(body?.agenda),
          team: jsonOrUndefined(body?.team ?? (warnings.length ? { warnings } : undefined)),
          auditees: jsonOrUndefined(body?.auditees),
          approvers: jsonOrUndefined(body?.approvers),
          observers: jsonOrUndefined(body?.observers),
          standards: jsonOrUndefined(body?.standards),
          requirements: jsonOrUndefined(body?.requirements),
          documents: jsonOrUndefined(body?.documents),
          risks: jsonOrUndefined(body?.risks),
          meetingUrl: this.nullableText(body?.meetingUrl) ?? null,
          summary: this.nullableText(body?.summary) ?? null,
          followUpPlan: this.nullableText(body?.followUpPlan) ?? null,
          confidentiality: this.nullableText(body?.confidentiality) ?? 'INTERNAL',
          startedAt: stamps.startedAt,
          completedAt: stamps.completedAt,
          closedAt: stamps.closedAt,
          createdById: me.sub,
        },
        include: this.include(),
      });
      await this.recordTimelineTx(tx, me, item.id, 'AUDIT', item.id, 'CREATED', `Auditoria ${item.code ?? `#${item.number}`} criada`, item.title, null, { status: item.status, warnings });
      if (warnings.some((warning) => warning.includes('Conflito')) && leadAuditorUserId) {
        const profile = await tx.auditorProfile.findFirst({ where: { companyId: me.companyId, userId: leadAuditorUserId, deletedAt: null }, select: { id: true } });
        if (profile) {
          await tx.auditorConflict.create({
            data: {
              companyId: me.companyId,
              auditorProfileId: profile.id,
              auditId: item.id,
              orgNodeId,
              conflictType: 'AREA_RESTRICTION',
              severity: 'WARN',
              description: warnings.join(' '),
            },
          });
        }
      }
      return item;
    });

    await this.traceability.record({
      companyId: me.companyId,
      userId: me.sub,
      eventType: TraceEventType.CREATED,
      entityType: TraceEntityType.AUDIT,
      entityId: audit.id,
      title: `Auditoria ${audit.code ?? `#${audit.number}`} criada`,
      description: audit.title,
      statusTo: audit.status,
      metadata: { type: audit.type, modality: audit.modality, warnings },
    });

    return this.enrich(audit);
  }

  async update(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(before), 'edit');
    this.assertNotSilentlyLocked(before, patch);

    const data: any = {};
    const linksChanged = ['orgNodeId', 'leadAuditorUserId', 'programId', 'typeConfigId', 'universeItemId'].some((field) => field in (patch ?? {}));
    let area = this.areaOf(before);
    if (linksChanged) {
      const orgNodeId = 'orgNodeId' in (patch ?? {}) ? this.id(patch.orgNodeId) : before.orgNodeId;
      const leadAuditorUserId = 'leadAuditorUserId' in (patch ?? {}) ? this.id(patch.leadAuditorUserId) : before.leadAuditorUserId;
      const programId = 'programId' in (patch ?? {}) ? this.id(patch.programId) : before.programId;
      const typeConfigId = 'typeConfigId' in (patch ?? {}) ? this.id(patch.typeConfigId) : before.typeConfigId;
      const universeItemId = 'universeItemId' in (patch ?? {}) ? this.id(patch.universeItemId) : before.universeItemId;
      area = await this.validateAuditLinks(me.companyId, { orgNodeId, leadAuditorUserId, programId, typeConfigId, universeItemId });
      await this.assertWriteArea(me, area, 'edit');
      data.orgNodeId = orgNodeId;
      data.leadAuditorUserId = leadAuditorUserId;
      data.programId = programId;
      data.typeConfigId = typeConfigId;
      data.universeItemId = universeItemId;
    }
    if ('title' in (patch ?? {})) data.title = this.requiredText(patch.title, 'Titulo');
    if ('scope' in (patch ?? {})) data.scope = this.nullableText(patch.scope);
    if ('objective' in (patch ?? {})) data.objective = this.nullableText(patch.objective);
    if ('criteria' in (patch ?? {})) data.criteria = this.nullableText(patch.criteria);
    if ('methodology' in (patch ?? {})) data.methodology = this.nullableText(patch.methodology);
    if ('origin' in (patch ?? {})) data.origin = this.nullableText(patch.origin);
    if ('type' in (patch ?? {})) data.type = this.parseType(patch.type) ?? before.type;
    if ('modality' in (patch ?? {})) data.modality = this.parseModality(patch.modality) ?? before.modality;
    if ('summary' in (patch ?? {})) data.summary = this.nullableText(patch.summary);
    if ('followUpPlan' in (patch ?? {})) data.followUpPlan = this.nullableText(patch.followUpPlan);
    if ('plannedDate' in (patch ?? {})) data.plannedDate = this.optionalDate(patch.plannedDate, 'Data planejada');
    if ('plannedStartAt' in (patch ?? {})) data.plannedStartAt = this.optionalDate(patch.plannedStartAt, 'Inicio planejado');
    if ('plannedEndAt' in (patch ?? {})) data.plannedEndAt = this.optionalDate(patch.plannedEndAt, 'Fim planejado');
    if ('executedAt' in (patch ?? {})) data.executedAt = this.optionalDate(patch.executedAt, 'Data realizada');
    if ('estimatedHours' in (patch ?? {})) data.estimatedHours = this.optionalNumber(patch.estimatedHours);
    if ('actualHours' in (patch ?? {})) data.actualHours = this.optionalNumber(patch.actualHours);
    if ('score' in (patch ?? {})) data.score = this.optionalNumber(patch.score);
    if ('result' in (patch ?? {})) data.result = this.nullableText(patch.result);
    if ('opinion' in (patch ?? {})) data.opinion = this.nullableText(patch.opinion);
    if ('confidentiality' in (patch ?? {})) data.confidentiality = this.nullableText(patch.confidentiality) ?? before.confidentiality;
    for (const field of ['locations', 'agenda', 'team', 'auditees', 'approvers', 'observers', 'standards', 'requirements', 'documents', 'risks'] as const) {
      if (field in (patch ?? {})) data[field] = jsonOrNull(patch[field]);
    }

    const statusChanged = 'status' in (patch ?? {});
    if (statusChanged) {
      data.status = this.parseStatus(patch.status) ?? before.status;
      const stamps = this.statusTimestamps(data.status as AuditStatus, before);
      data.startedAt = stamps.startedAt;
      data.completedAt = stamps.completedAt;
      data.closedAt = stamps.closedAt;
      if (data.status === AuditStatus.CANCELLED) data.cancelledReason = this.nullableText(patch.reason ?? patch.cancelledReason) ?? before.cancelledReason;
      if (data.status === AuditStatus.RESCHEDULED) data.rescheduleReason = this.nullableText(patch.reason ?? patch.rescheduleReason) ?? before.rescheduleReason;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.audit.update({ where: { id }, data, include: this.include() });
      await this.recordTimelineTx(
        tx,
        me,
        id,
        'AUDIT',
        id,
        statusChanged && before.status !== item.status ? 'STATUS_CHANGED' : 'UPDATED',
        statusChanged && before.status !== item.status ? `Status da auditoria ${item.code ?? `#${item.number}`} alterado` : `Auditoria ${item.code ?? `#${item.number}`} atualizada`,
        this.nullableText(patch?.comment) ?? item.title,
        before,
        item,
      );
      return item;
    });

    await this.traceability.record({
      companyId: me.companyId,
      userId: me.sub,
      eventType: statusChanged && before.status !== updated.status ? TraceEventType.STATUS_CHANGED : TraceEventType.UPDATED,
      entityType: TraceEntityType.AUDIT,
      entityId: updated.id,
      title: statusChanged && before.status !== updated.status ? `Status da auditoria ${updated.code ?? `#${updated.number}`} alterado` : `Auditoria ${updated.code ?? `#${updated.number}`} atualizada`,
      description: updated.title,
      statusFrom: before.status,
      statusTo: updated.status,
    });

    return this.enrich(updated);
  }

  async remove(me: AuthPayload, id: string) {
    const audit = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(audit), 'delete');
    const removed = await this.prisma.$transaction(async (tx) => {
      const item = await tx.audit.update({ where: { id }, data: { deletedAt: new Date() }, include: this.include() });
      await this.recordTimelineTx(tx, me, id, 'AUDIT', id, 'DELETED', `Auditoria ${audit.code ?? `#${audit.number}`} excluida logicamente`, audit.title, audit, { deletedAt: item.deletedAt });
      return item;
    });
    await this.traceability.record({
      companyId: me.companyId,
      userId: me.sub,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.AUDIT,
      entityId: audit.id,
      title: `Auditoria ${audit.code ?? `#${audit.number}`} excluida`,
      description: audit.title,
      statusFrom: audit.status,
      statusTo: 'DELETED',
    });
    return this.enrich(removed);
  }

  async transition(me: AuthPayload, id: string, target: string, body: any = {}) {
    const audit = await this.loadScoped(id, me.companyId);
    await this.assertWriteArea(me, this.areaOf(audit), 'edit');
    const to = this.parseStatus(target);
    if (!to) throw new BadRequestException('Status destino invalido.');
    if (!this.canTransition(audit.status, to)) throw new ConflictException(`Transicao ${audit.status} -> ${to} nao permitida.`);
    if (to === AuditStatus.CANCELLED && !this.nullableText(body?.reason)) throw new BadRequestException('Informe a justificativa do cancelamento.');
    if (audit.status === AuditStatus.CLOSED && !this.nullableText(body?.reason)) throw new BadRequestException('Reabertura exige justificativa.');
    return this.update(me, id, { status: to, reason: body?.reason, comment: body?.comment ?? body?.reason });
  }

  async start(me: AuthPayload, id: string, body: any = {}) {
    return this.transition(me, id, AuditStatus.IN_PROGRESS, body);
  }

  async complete(me: AuthPayload, id: string, body: any = {}) {
    return this.transition(me, id, AuditStatus.COMPLETED, body);
  }

  async reopen(me: AuthPayload, id: string, body: any = {}) {
    const reason = this.requiredText(body?.reason, 'Justificativa de reabertura');
    const audit = await this.loadScoped(id, me.companyId);
    const reopenable: AuditStatus[] = [AuditStatus.COMPLETED, AuditStatus.CLOSED, AuditStatus.CANCELLED];
    if (!reopenable.includes(audit.status)) {
      throw new ConflictException('Somente auditoria concluida, encerrada ou cancelada pode ser reaberta.');
    }
    return this.update(me, id, { status: AuditStatus.PLANNED, comment: reason });
  }

  private canTransition(from: AuditStatus, to: AuditStatus) {
    if (from === to) return true;
    const transitions: Partial<Record<AuditStatus, AuditStatus[]>> = {
      [AuditStatus.DRAFT]: [AuditStatus.WAITING_APPROVAL, AuditStatus.PLANNED, AuditStatus.CANCELLED],
      [AuditStatus.WAITING_APPROVAL]: [AuditStatus.PLANNED, AuditStatus.CANCELLED],
      [AuditStatus.PLANNED]: [AuditStatus.SCHEDULED, AuditStatus.PREPARATION, AuditStatus.IN_PROGRESS, AuditStatus.RESCHEDULED, AuditStatus.CANCELLED],
      [AuditStatus.SCHEDULED]: [AuditStatus.PREPARATION, AuditStatus.READY_EXECUTION, AuditStatus.IN_PROGRESS, AuditStatus.RESCHEDULED, AuditStatus.CANCELLED],
      [AuditStatus.PREPARATION]: [AuditStatus.READY_EXECUTION, AuditStatus.IN_PROGRESS, AuditStatus.CANCELLED],
      [AuditStatus.READY_EXECUTION]: [AuditStatus.IN_PROGRESS, AuditStatus.CANCELLED],
      [AuditStatus.IN_PROGRESS]: [AuditStatus.WAITING_COMPLEMENT, AuditStatus.LEAD_REVIEW, AuditStatus.COMPLETED, AuditStatus.CANCELLED],
      [AuditStatus.WAITING_COMPLEMENT]: [AuditStatus.IN_PROGRESS, AuditStatus.LEAD_REVIEW],
      [AuditStatus.LEAD_REVIEW]: [AuditStatus.WAITING_AUDITED_RESPONSE, AuditStatus.REPORT_ISSUED, AuditStatus.COMPLETED],
      [AuditStatus.WAITING_AUDITED_RESPONSE]: [AuditStatus.REPORT_ISSUED, AuditStatus.FOLLOW_UP],
      [AuditStatus.REPORT_ISSUED]: [AuditStatus.FOLLOW_UP, AuditStatus.COMPLETED, AuditStatus.CLOSED],
      [AuditStatus.FOLLOW_UP]: [AuditStatus.COMPLETED, AuditStatus.CLOSED],
      [AuditStatus.COMPLETED]: [AuditStatus.CLOSED, AuditStatus.FOLLOW_UP],
      [AuditStatus.SUSPENDED]: [AuditStatus.PLANNED, AuditStatus.RESCHEDULED, AuditStatus.CANCELLED],
      [AuditStatus.RESCHEDULED]: [AuditStatus.PLANNED, AuditStatus.SCHEDULED, AuditStatus.CANCELLED],
    };
    return transitions[from]?.includes(to) ?? false;
  }

  private assertNotSilentlyLocked(audit: any, patch: any) {
    if (!CLOSED_LOCKED.has(audit.status) || 'status' in (patch ?? {})) return;
    const coreFields = ['title', 'scope', 'objective', 'criteria', 'methodology', 'type', 'modality', 'plannedDate', 'summary'];
    if (coreFields.some((field) => field in (patch ?? {})) && !this.nullableText(patch?.reopenReason)) {
      throw new ConflictException('Auditoria concluida/cancelada nao pode ser alterada silenciosamente. Reabra com justificativa.');
    }
  }

  // Programas
  async listPrograms(me: AuthPayload, filters: { status?: string; search?: string } = {}) {
    const status = this.parseProgramStatus(filters.status);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: Prisma.AuditProgramWhereInput[] = [];
    const areaFilter = this.programVisibilityWhere(permitted);
    if (areaFilter) and.push(areaFilter as Prisma.AuditProgramWhereInput);
    const term = filters.search?.trim();
    if (term) and.push({ OR: [{ name: { contains: term, mode: 'insensitive' } }, { code: { contains: term, mode: 'insensitive' } }, { description: { contains: term, mode: 'insensitive' } }] });
    return this.prisma.auditProgram.findMany({
      where: { companyId: me.companyId, deletedAt: null, ...(status ? { status } : {}), ...(and.length ? { AND: and } : {}) },
      orderBy: [{ status: 'asc' }, { startsAt: 'desc' }, { number: 'desc' }],
    });
  }

  async createProgram(me: AuthPayload, body: any) {
    const name = this.requiredText(body?.name, 'Nome do programa');
    const orgNodeIds = this.idArray(body?.orgNodeIds);
    await this.assertProgramAreas(me, orgNodeIds, 'create');
    return this.prisma.$transaction(async (tx) => {
      const numbering = await this.codes.nextProgramCode(tx, me.companyId);
      const program = await tx.auditProgram.create({
        data: {
          companyId: me.companyId,
          code: this.nullableText(body?.code) ?? numbering.code,
          number: numbering.number,
          name,
          description: this.nullableText(body?.description),
          status: this.parseProgramStatus(body?.status) ?? AuditProgramStatus.DRAFT,
          cycleKind: this.nullableText(body?.cycleKind) ?? 'ANNUAL',
          branchId: this.id(body?.branchId),
          ownerUserId: this.id(body?.ownerUserId) ?? me.sub,
          approverUserId: this.id(body?.approverUserId),
          startsAt: this.optionalDate(body?.startsAt, 'Inicio de vigencia') ?? null,
          endsAt: this.optionalDate(body?.endsAt, 'Fim de vigencia') ?? null,
          objectives: jsonOrUndefined(body?.objectives),
          standards: jsonOrUndefined(body?.standards),
          orgNodeIds,
          processIds: this.idArray(body?.processIds),
          supplierIds: this.idArray(body?.supplierIds),
          documentIds: this.idArray(body?.documentIds),
          riskIds: this.idArray(body?.riskIds),
          indicatorIds: this.idArray(body?.indicatorIds),
          estimatedHours: this.optionalNumber(body?.estimatedHours) ?? null,
          budget: this.optionalNumber(body?.budget) ?? null,
          attachments: jsonOrUndefined(body?.attachments),
          comments: this.nullableText(body?.comments),
          createdById: me.sub,
        },
      });
      await tx.auditProgramRevision.create({
        data: {
          companyId: me.companyId,
          programId: program.id,
          version: 1,
          reason: 'Criacao do programa',
          summary: this.nullableText(body?.comments),
          snapshot: jsonOrNull(program),
          createdById: me.sub,
        },
      });
      await this.recordTimelineTx(tx, me, null, 'AUDIT_PROGRAM', program.id, 'CREATED', `Programa ${program.code} criado`, program.name, null, program);
      return program;
    });
  }

  async updateProgram(me: AuthPayload, id: string, patch: any) {
    const before = await this.prisma.auditProgram.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!before) throw new NotFoundException('Programa de auditoria nao encontrado.');
    const orgNodeIds = 'orgNodeIds' in (patch ?? {}) ? this.idArray(patch.orgNodeIds) : before.orgNodeIds;
    await this.assertProgramAreas(me, orgNodeIds, 'edit');
    const data: Prisma.AuditProgramUpdateInput = {};
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome');
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('status' in (patch ?? {})) {
      const status = this.parseProgramStatus(patch.status) ?? before.status;
      data.status = status;
      const approvedStatuses: AuditProgramStatus[] = [AuditProgramStatus.APPROVED, AuditProgramStatus.ACTIVE];
      if (approvedStatuses.includes(status) && !before.approvedAt) {
        data.approvedAt = new Date();
        data.approvedById = me.sub;
      }
    }
    if ('cycleKind' in (patch ?? {})) data.cycleKind = this.nullableText(patch.cycleKind);
    if ('branchId' in (patch ?? {})) data.branchId = this.id(patch.branchId);
    if ('ownerUserId' in (patch ?? {})) data.ownerUserId = this.id(patch.ownerUserId);
    if ('approverUserId' in (patch ?? {})) data.approverUserId = this.id(patch.approverUserId);
    if ('startsAt' in (patch ?? {})) data.startsAt = this.optionalDate(patch.startsAt, 'Inicio de vigencia');
    if ('endsAt' in (patch ?? {})) data.endsAt = this.optionalDate(patch.endsAt, 'Fim de vigencia');
    if ('objectives' in (patch ?? {})) data.objectives = jsonOrNull(patch.objectives);
    if ('standards' in (patch ?? {})) data.standards = jsonOrNull(patch.standards);
    if ('orgNodeIds' in (patch ?? {})) data.orgNodeIds = orgNodeIds;
    if ('processIds' in (patch ?? {})) data.processIds = this.idArray(patch.processIds);
    if ('supplierIds' in (patch ?? {})) data.supplierIds = this.idArray(patch.supplierIds);
    if ('documentIds' in (patch ?? {})) data.documentIds = this.idArray(patch.documentIds);
    if ('riskIds' in (patch ?? {})) data.riskIds = this.idArray(patch.riskIds);
    if ('indicatorIds' in (patch ?? {})) data.indicatorIds = this.idArray(patch.indicatorIds);
    if ('estimatedHours' in (patch ?? {})) data.estimatedHours = this.optionalNumber(patch.estimatedHours);
    if ('budget' in (patch ?? {})) data.budget = this.optionalNumber(patch.budget);
    if ('comments' in (patch ?? {})) data.comments = this.nullableText(patch.comments);
    data.updatedById = me.sub;

    return this.prisma.$transaction(async (tx) => {
      const program = await tx.auditProgram.update({ where: { id }, data });
      if (this.nullableText(patch?.revisionReason)) {
        await tx.auditProgramRevision.create({
          data: {
            companyId: me.companyId,
            programId: id,
            version: before.version + 1,
            reason: this.requiredText(patch.revisionReason, 'Motivo da revisao'),
            summary: this.nullableText(patch.revisionSummary),
            snapshot: jsonOrNull(program),
            createdById: me.sub,
          },
        });
        await tx.auditProgram.update({ where: { id }, data: { version: before.version + 1 } });
      }
      await this.recordTimelineTx(tx, me, null, 'AUDIT_PROGRAM', id, 'UPDATED', `Programa ${program.code} atualizado`, program.name, before, program);
      return program;
    });
  }

  private async assertProgramAreas(me: AuthPayload, orgNodeIds: string[], action: AreaAction) {
    for (const orgNodeId of orgNodeIds) {
      const node = await this.prisma.orgNode.findFirst({ where: { id: orgNodeId, companyId: me.companyId, deletedAt: null }, select: { id: true } });
      if (!node) throw new NotFoundException('Area do programa nao encontrada.');
      await this.assertWriteArea(me, orgNodeId, action);
    }
  }

  // Universo auditavel e risco
  async listUniverse(me: AuthPayload, filters: { kind?: string; riskLevel?: string; search?: string } = {}) {
    const kind = this.parseUniverseKind(filters.kind);
    const riskLevel = filters.riskLevel && Object.values(AuditRiskLevel).includes(filters.riskLevel as AuditRiskLevel) ? filters.riskLevel as AuditRiskLevel : undefined;
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: Prisma.AuditUniverseItemWhereInput[] = [];
    if (permitted) and.push({ OR: [{ orgNodeId: null }, { orgNodeId: { in: permitted } }] });
    const term = filters.search?.trim();
    if (term) and.push({ OR: [{ name: { contains: term, mode: 'insensitive' } }, { code: { contains: term, mode: 'insensitive' } }, { description: { contains: term, mode: 'insensitive' } }] });
    return this.prisma.auditUniverseItem.findMany({
      where: { companyId: me.companyId, deletedAt: null, ...(kind ? { kind } : {}), ...(riskLevel ? { riskLevel } : {}), ...(and.length ? { AND: and } : {}) },
      orderBy: [{ riskScore: 'desc' }, { priority: 'desc' }, { name: 'asc' }],
    });
  }

  async createUniverseItem(me: AuthPayload, body: any) {
    const name = this.requiredText(body?.name, 'Nome do item auditavel');
    const orgNodeId = this.id(body?.orgNodeId);
    if (orgNodeId) await this.assertWriteArea(me, orgNodeId, 'create');
    if (body?.manualOverride && !this.nullableText(body?.overrideJustification)) {
      throw new BadRequestException('Justificativa e obrigatoria para ajuste manual de prioridade.');
    }
    const riskFactors = normalizeObject(body?.riskFactors ?? body?.criteriaValues);
    const score = await this.risk.calculate(me.companyId, riskFactors);
    return this.prisma.$transaction(async (tx) => {
      const code = this.nullableText(body?.code) ?? await this.codes.nextCode(tx, me.companyId, 'universe');
      const item = await tx.auditUniverseItem.create({
        data: {
          companyId: me.companyId,
          code,
          name,
          kind: this.parseUniverseKind(body?.kind) ?? AuditUniverseItemKind.AREA,
          description: this.nullableText(body?.description),
          branchId: this.id(body?.branchId),
          orgNodeId,
          processId: this.id(body?.processId),
          supplierId: this.id(body?.supplierId),
          documentId: this.id(body?.documentId),
          riskId: this.id(body?.riskId),
          indicatorId: this.id(body?.indicatorId),
          strategicObjectiveId: this.id(body?.strategicObjectiveId),
          ownerUserId: this.id(body?.ownerUserId),
          riskScore: score.score,
          riskLevel: score.level,
          priority: Math.round(score.score),
          recommendedFrequencyDays: score.recommendedFrequencyDays,
          lastAuditAt: this.optionalDate(body?.lastAuditAt, 'Ultima auditoria') ?? null,
          nextSuggestedAuditAt: addDays(new Date(), score.recommendedFrequencyDays),
          manualOverride: Boolean(body?.manualOverride),
          overrideJustification: this.nullableText(body?.overrideJustification),
          riskFactors: jsonOrUndefined(score.criteriaValues),
          status: this.nullableText(body?.status) ?? 'ACTIVE',
          createdById: me.sub,
        },
      });
      await tx.auditRiskScore.create({
        data: {
          companyId: me.companyId,
          universeItemId: item.id,
          calculatedScore: score.score,
          level: score.level,
          criteriaValues: jsonOrUndefined(score.criteriaValues),
          formulaSnapshot: score.formulaSnapshot,
          recommendedFrequencyDays: score.recommendedFrequencyDays,
          changedById: me.sub,
          justification: this.nullableText(body?.overrideJustification),
        },
      });
      await this.recordTimelineTx(tx, me, null, 'AUDIT_UNIVERSE', item.id, 'CREATED', `Item auditavel ${item.code} criado`, item.name, null, item);
      return item;
    });
  }

  async updateUniverseItem(me: AuthPayload, id: string, patch: any) {
    const before = await this.prisma.auditUniverseItem.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!before) throw new NotFoundException('Item auditavel nao encontrado.');
    const orgNodeId = 'orgNodeId' in (patch ?? {}) ? this.id(patch.orgNodeId) : before.orgNodeId;
    if (orgNodeId) await this.assertWriteArea(me, orgNodeId, 'edit');
    const data: Prisma.AuditUniverseItemUpdateInput = {};
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome');
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('kind' in (patch ?? {})) data.kind = this.parseUniverseKind(patch.kind) ?? before.kind;
    if ('orgNodeId' in (patch ?? {})) data.orgNodeId = orgNodeId;
    for (const field of ['branchId', 'processId', 'supplierId', 'documentId', 'riskId', 'indicatorId', 'strategicObjectiveId', 'ownerUserId'] as const) {
      if (field in (patch ?? {})) data[field] = this.id(patch[field]);
    }
    if ('status' in (patch ?? {})) data.status = this.nullableText(patch.status) ?? before.status;
    if ('manualOverride' in (patch ?? {})) data.manualOverride = Boolean(patch.manualOverride);
    if ('overrideJustification' in (patch ?? {})) data.overrideJustification = this.nullableText(patch.overrideJustification);
    if ('lastAuditAt' in (patch ?? {})) data.lastAuditAt = this.optionalDate(patch.lastAuditAt, 'Ultima auditoria');

    return this.prisma.$transaction(async (tx) => {
      if ('riskFactors' in (patch ?? {}) || 'criteriaValues' in (patch ?? {})) {
        const riskFactors = normalizeObject(patch.riskFactors ?? patch.criteriaValues);
        const scored = await this.risk.calculate(me.companyId, riskFactors, tx);
        data.riskScore = scored.score;
        data.riskLevel = scored.level;
        data.priority = Math.round(scored.score);
        data.recommendedFrequencyDays = scored.recommendedFrequencyDays;
        data.nextSuggestedAuditAt = addDays(new Date(), scored.recommendedFrequencyDays);
        data.riskFactors = jsonOrNull(scored.criteriaValues);
        await tx.auditRiskScore.create({
          data: {
            companyId: me.companyId,
            universeItemId: id,
            calculatedScore: scored.score,
            level: scored.level,
            criteriaValues: jsonOrUndefined(scored.criteriaValues),
            formulaSnapshot: scored.formulaSnapshot,
            recommendedFrequencyDays: scored.recommendedFrequencyDays,
            changedById: me.sub,
            justification: this.nullableText(patch?.overrideJustification),
          },
        });
      }
      const item = await tx.auditUniverseItem.update({ where: { id }, data });
      await this.recordTimelineTx(tx, me, null, 'AUDIT_UNIVERSE', id, 'UPDATED', `Item auditavel ${item.code} atualizado`, item.name, before, item);
      return item;
    });
  }

  async listRiskCriteria(me: AuthPayload) {
    await this.codes.ensureDefaults(me.companyId, me.sub);
    return this.prisma.auditRiskCriterion.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: [{ active: 'desc' }, { name: 'asc' }] });
  }

  async createRiskCriterion(me: AuthPayload, body: any) {
    return this.prisma.auditRiskCriterion.create({
      data: {
        companyId: me.companyId,
        name: this.requiredText(body?.name, 'Nome'),
        key: this.requiredText(body?.key, 'Chave').toLowerCase(),
        description: this.nullableText(body?.description),
        weight: this.optionalNumber(body?.weight) ?? 1,
        minScore: Math.round(this.optionalNumber(body?.minScore) ?? 1),
        maxScore: Math.round(this.optionalNumber(body?.maxScore) ?? 5),
        defaultScore: Math.round(this.optionalNumber(body?.defaultScore) ?? 3),
        formulaVariable: this.nullableText(body?.formulaVariable),
        active: body?.active ?? true,
        createdById: me.sub,
      },
    });
  }

  async updateRiskCriterion(me: AuthPayload, id: string, patch: any) {
    const before = await this.prisma.auditRiskCriterion.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!before) throw new NotFoundException('Criterio de risco nao encontrado.');
    const data: Prisma.AuditRiskCriterionUpdateInput = {};
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome');
    if ('key' in (patch ?? {})) data.key = this.requiredText(patch.key, 'Chave').toLowerCase();
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('weight' in (patch ?? {})) data.weight = this.optionalNumber(patch.weight) ?? before.weight;
    if ('minScore' in (patch ?? {})) data.minScore = Math.round(this.optionalNumber(patch.minScore) ?? before.minScore);
    if ('maxScore' in (patch ?? {})) data.maxScore = Math.round(this.optionalNumber(patch.maxScore) ?? before.maxScore);
    if ('defaultScore' in (patch ?? {})) data.defaultScore = Math.round(this.optionalNumber(patch.defaultScore) ?? before.defaultScore);
    if ('formulaVariable' in (patch ?? {})) data.formulaVariable = this.nullableText(patch.formulaVariable);
    if ('active' in (patch ?? {})) data.active = Boolean(patch.active);
    data.updatedById = me.sub;
    return this.prisma.auditRiskCriterion.update({ where: { id }, data });
  }

  // Tipos configuraveis
  async listTypes(me: AuthPayload) {
    return this.codes.listTypes(me);
  }

  async createType(me: AuthPayload, body: any) {
    return this.codes.createType(me, body);
  }

  async updateType(me: AuthPayload, id: string, patch: any) {
    return this.codes.updateType(me, id, patch);
  }

  // Auditores
  async listAuditors(me: AuthPayload) {
    return this.prisma.auditorProfile.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      include: {
        competencies: { where: { deletedAt: null }, orderBy: [{ validUntil: 'asc' }, { name: 'asc' }] },
        certifications: { where: { deletedAt: null }, orderBy: [{ validUntil: 'asc' }, { name: 'asc' }] },
        availabilities: { orderBy: { startsAt: 'asc' }, take: 30 },
        conflicts: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async createAuditor(me: AuthPayload, body: any) {
    const userId = this.id(body?.userId);
    const user = userId ? await this.prisma.user.findFirst({ where: { id: userId, companyId: me.companyId, deletedAt: null }, select: { id: true, name: true, email: true, defaultNodeId: true } }) : null;
    if (userId && !user) throw new NotFoundException('Usuario do auditor nao encontrado.');
    const name = this.requiredText(body?.name ?? user?.name, 'Nome do auditor');
    return this.prisma.$transaction(async (tx) => {
      const auditor = await tx.auditorProfile.create({
        data: {
          companyId: me.companyId,
          userId,
          kind: parseEnum(body?.kind, AuditorKind, AuditorKind.INTERNAL),
          status: parseEnum(body?.status, AuditorStatus, AuditorStatus.ACTIVE),
          name,
          email: this.nullableText(body?.email ?? user?.email),
          companyName: this.nullableText(body?.companyName),
          phone: this.nullableText(body?.phone),
          orgNodeIds: this.idArray(body?.orgNodeIds ?? (user?.defaultNodeId ? [user.defaultNodeId] : [])),
          allowedAreaIds: this.idArray(body?.allowedAreaIds),
          restrictedAreaIds: this.idArray(body?.restrictedAreaIds),
          specialties: this.idArray(body?.specialties),
          standards: this.idArray(body?.standards),
          competenceLevel: Math.round(this.optionalNumber(body?.competenceLevel) ?? 1),
          workloadHours: this.optionalNumber(body?.workloadHours) ?? 0,
          conflictPolicy: this.nullableText(body?.conflictPolicy) ?? 'WARN',
          availability: jsonOrUndefined(body?.availability),
          notes: this.nullableText(body?.notes),
          docs: jsonOrUndefined(body?.docs),
          createdById: me.sub,
        },
      });
      await this.replaceAuditorChildren(tx, me.companyId, auditor.id, body);
      return tx.auditorProfile.findUnique({ where: { id: auditor.id }, include: { competencies: true, certifications: true, availabilities: true, conflicts: true } });
    });
  }

  async updateAuditor(me: AuthPayload, id: string, patch: any) {
    const before = await this.prisma.auditorProfile.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!before) throw new NotFoundException('Auditor nao encontrado.');
    const data: Prisma.AuditorProfileUpdateInput = {};
    if ('userId' in (patch ?? {})) data.userId = this.id(patch.userId);
    if ('kind' in (patch ?? {})) data.kind = parseEnum(patch.kind, AuditorKind, before.kind);
    if ('status' in (patch ?? {})) data.status = parseEnum(patch.status, AuditorStatus, before.status);
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome');
    if ('email' in (patch ?? {})) data.email = this.nullableText(patch.email);
    if ('companyName' in (patch ?? {})) data.companyName = this.nullableText(patch.companyName);
    if ('phone' in (patch ?? {})) data.phone = this.nullableText(patch.phone);
    for (const field of ['orgNodeIds', 'allowedAreaIds', 'restrictedAreaIds', 'specialties', 'standards'] as const) {
      if (field in (patch ?? {})) data[field] = this.idArray(patch[field]);
    }
    if ('competenceLevel' in (patch ?? {})) data.competenceLevel = Math.round(this.optionalNumber(patch.competenceLevel) ?? before.competenceLevel);
    if ('workloadHours' in (patch ?? {})) data.workloadHours = this.optionalNumber(patch.workloadHours) ?? before.workloadHours;
    if ('conflictPolicy' in (patch ?? {})) data.conflictPolicy = this.nullableText(patch.conflictPolicy) ?? before.conflictPolicy;
    if ('availability' in (patch ?? {})) data.availability = jsonOrNull(patch.availability);
    if ('notes' in (patch ?? {})) data.notes = this.nullableText(patch.notes);
    if ('docs' in (patch ?? {})) data.docs = jsonOrNull(patch.docs);
    data.updatedById = me.sub;
    return this.prisma.$transaction(async (tx) => {
      await tx.auditorProfile.update({ where: { id }, data });
      if ('competencies' in (patch ?? {}) || 'certifications' in (patch ?? {}) || 'availabilities' in (patch ?? {})) {
        await this.replaceAuditorChildren(tx, me.companyId, id, patch);
      }
      return tx.auditorProfile.findUnique({ where: { id }, include: { competencies: true, certifications: true, availabilities: true, conflicts: true } });
    });
  }

  async suggestAuditors(me: AuthPayload, body: any = {}) {
    const areaId = this.id(body?.orgNodeId);
    const standards = this.idArray(body?.standards);
    const auditors = await this.listAuditors(me) as any[];
    const now = Date.now();
    return auditors
      .filter((auditor) => auditor.status === AuditorStatus.ACTIVE)
      .map((auditor) => {
        const warnings: string[] = [];
        let score = auditor.competenceLevel ?? 1;
        if (areaId && auditor.restrictedAreaIds.includes(areaId)) {
          score -= 100;
          warnings.push('Conflito de interesse com a area.');
        }
        if (areaId && auditor.allowedAreaIds.includes(areaId)) score += 3;
        const standardHits = standards.filter((standard) => auditor.standards.includes(standard)).length;
        score += standardHits * 2;
        const expired = auditor.certifications.filter((cert: any) => cert.validUntil && new Date(cert.validUntil).getTime() < now);
        if (expired.length) {
          score -= 3;
          warnings.push('Certificacao vencida.');
        }
        return { auditor, score, warnings };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  private async replaceAuditorChildren(tx: Tx, companyId: string, auditorProfileId: string, body: any) {
    if ('competencies' in (body ?? {})) {
      await tx.auditorCompetency.deleteMany({ where: { auditorProfileId } });
      const rows = Array.isArray(body.competencies) ? body.competencies : [];
      if (rows.length) {
        await tx.auditorCompetency.createMany({
          data: rows.map((item: any) => ({
            companyId,
            auditorProfileId,
            name: this.requiredText(item?.name, 'Competencia'),
            standardCode: this.nullableText(item?.standardCode),
            requirement: this.nullableText(item?.requirement),
            level: Math.round(this.optionalNumber(item?.level) ?? 1),
            validFrom: this.optionalDate(item?.validFrom, 'Validade inicial') ?? null,
            validUntil: this.optionalDate(item?.validUntil, 'Validade final') ?? null,
            evidenceDocumentIds: this.idArray(item?.evidenceDocumentIds),
            status: this.nullableText(item?.status) ?? 'VALID',
          })),
        });
      }
    }
    if ('certifications' in (body ?? {})) {
      await tx.auditorCertification.deleteMany({ where: { auditorProfileId } });
      const rows = Array.isArray(body.certifications) ? body.certifications : [];
      if (rows.length) {
        await tx.auditorCertification.createMany({
          data: rows.map((item: any) => ({
            companyId,
            auditorProfileId,
            name: this.requiredText(item?.name, 'Certificacao'),
            issuer: this.nullableText(item?.issuer),
            certificateNumber: this.nullableText(item?.certificateNumber),
            validFrom: this.optionalDate(item?.validFrom, 'Validade inicial') ?? null,
            validUntil: this.optionalDate(item?.validUntil, 'Validade final') ?? null,
            documentIds: this.idArray(item?.documentIds),
            status: this.nullableText(item?.status) ?? 'VALID',
          })),
        });
      }
    }
    if ('availabilities' in (body ?? {})) {
      await tx.auditorAvailability.deleteMany({ where: { auditorProfileId } });
      const rows = Array.isArray(body.availabilities) ? body.availabilities : [];
      if (rows.length) {
        await tx.auditorAvailability.createMany({
          data: rows.map((item: any) => ({
            companyId,
            auditorProfileId,
            startsAt: this.optionalDate(item?.startsAt, 'Inicio') ?? new Date(),
            endsAt: this.optionalDate(item?.endsAt, 'Fim') ?? new Date(),
            status: this.nullableText(item?.status) ?? 'AVAILABLE',
            notes: this.nullableText(item?.notes),
          })),
        });
      }
    }
  }

  // Normas e requisitos
  async listStandards(me: AuthPayload) {
    return this.prisma.auditStandard.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      include: { requirements: { where: { deletedAt: null }, orderBy: { clause: 'asc' } } },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async createStandard(me: AuthPayload, body: any) {
    return this.prisma.$transaction(async (tx) => {
      const standard = await tx.auditStandard.create({
        data: {
          companyId: me.companyId,
          code: this.requiredText(body?.code, 'Codigo').toUpperCase(),
          name: this.requiredText(body?.name, 'Nome'),
          version: this.nullableText(body?.version),
          description: this.nullableText(body?.description),
          issuer: this.nullableText(body?.issuer),
          effectiveFrom: this.optionalDate(body?.effectiveFrom, 'Vigencia inicial') ?? null,
          effectiveUntil: this.optionalDate(body?.effectiveUntil, 'Vigencia final') ?? null,
          status: this.nullableText(body?.status) ?? 'ACTIVE',
          documents: jsonOrUndefined(body?.documents),
          controls: jsonOrUndefined(body?.controls),
          risks: jsonOrUndefined(body?.risks),
          createdById: me.sub,
        },
      });
      const requirements = Array.isArray(body?.requirements) ? body.requirements : [];
      if (requirements.length) {
        await tx.auditRequirement.createMany({
          data: requirements.map((item: any) => ({
            companyId: me.companyId,
            standardId: standard.id,
            clause: this.requiredText(item?.clause, 'Clausula'),
            code: this.nullableText(item?.code),
            title: this.requiredText(item?.title ?? item?.description, 'Titulo do requisito'),
            description: this.nullableText(item?.description),
            evidenceExpected: jsonOrUndefined(item?.evidenceExpected),
            controls: jsonOrUndefined(item?.controls),
            risks: jsonOrUndefined(item?.risks),
            status: this.nullableText(item?.status) ?? 'ACTIVE',
          })),
        });
      }
      return tx.auditStandard.findUnique({ where: { id: standard.id }, include: { requirements: true } });
    });
  }

  async updateStandard(me: AuthPayload, id: string, patch: any) {
    const before = await this.prisma.auditStandard.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!before) throw new NotFoundException('Norma nao encontrada.');
    const data: Prisma.AuditStandardUpdateInput = {};
    if ('code' in (patch ?? {})) data.code = this.requiredText(patch.code, 'Codigo').toUpperCase();
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome');
    if ('version' in (patch ?? {})) data.version = this.nullableText(patch.version);
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('issuer' in (patch ?? {})) data.issuer = this.nullableText(patch.issuer);
    if ('effectiveFrom' in (patch ?? {})) data.effectiveFrom = this.optionalDate(patch.effectiveFrom, 'Vigencia inicial');
    if ('effectiveUntil' in (patch ?? {})) data.effectiveUntil = this.optionalDate(patch.effectiveUntil, 'Vigencia final');
    if ('status' in (patch ?? {})) data.status = this.nullableText(patch.status) ?? before.status;
    if ('documents' in (patch ?? {})) data.documents = jsonOrNull(patch.documents);
    if ('controls' in (patch ?? {})) data.controls = jsonOrNull(patch.controls);
    if ('risks' in (patch ?? {})) data.risks = jsonOrNull(patch.risks);
    data.updatedById = me.sub;
    return this.prisma.$transaction(async (tx) => {
      await tx.auditStandard.update({ where: { id }, data });
      if ('requirements' in (patch ?? {})) {
        await tx.auditRequirement.deleteMany({ where: { standardId: id } });
        const requirements = Array.isArray(patch.requirements) ? patch.requirements : [];
        if (requirements.length) {
          await tx.auditRequirement.createMany({
            data: requirements.map((item: any) => ({
              companyId: me.companyId,
              standardId: id,
              clause: this.requiredText(item?.clause, 'Clausula'),
              code: this.nullableText(item?.code),
              title: this.requiredText(item?.title ?? item?.description, 'Titulo do requisito'),
              description: this.nullableText(item?.description),
              evidenceExpected: jsonOrUndefined(item?.evidenceExpected),
              controls: jsonOrUndefined(item?.controls),
              risks: jsonOrUndefined(item?.risks),
              status: this.nullableText(item?.status) ?? 'ACTIVE',
            })),
          });
        }
      }
      return tx.auditStandard.findUnique({ where: { id }, include: { requirements: true } });
    });
  }

  // Checklists
  async listChecklistTemplates(me: AuthPayload) {
    return this.prisma.auditChecklistTemplate.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      include: { sections: { orderBy: { position: 'asc' }, include: { items: { where: { deletedAt: null }, orderBy: { position: 'asc' } } } } },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async createChecklistTemplate(me: AuthPayload, body: any) {
    return this.prisma.$transaction(async (tx) => {
      const code = this.nullableText(body?.code) ?? await this.codes.nextCode(tx, me.companyId, 'template');
      const template = await tx.auditChecklistTemplate.create({
        data: {
          companyId: me.companyId,
          code,
          name: this.requiredText(body?.name, 'Nome do modelo'),
          description: this.nullableText(body?.description),
          status: this.parseChecklistTemplateStatus(body?.status) ?? AuditChecklistTemplateStatus.DRAFT,
          auditType: this.parseType(body?.auditType),
          modality: this.parseModality(body?.modality),
          standardId: this.id(body?.standardId),
          orgNodeId: this.id(body?.orgNodeId),
          processId: this.id(body?.processId),
          supplierId: this.id(body?.supplierId),
          requiresApproval: Boolean(body?.requiresApproval),
          createdById: me.sub,
        },
      });
      await this.replaceChecklistSections(tx, me.companyId, template.id, body?.sections);
      return tx.auditChecklistTemplate.findUnique({ where: { id: template.id }, include: { sections: { include: { items: true }, orderBy: { position: 'asc' } } } });
    });
  }

  async updateChecklistTemplate(me: AuthPayload, id: string, patch: any) {
    const before = await this.prisma.auditChecklistTemplate.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!before) throw new NotFoundException('Modelo de checklist nao encontrado.');
    const data: Prisma.AuditChecklistTemplateUpdateInput = {};
    if ('name' in (patch ?? {})) data.name = this.requiredText(patch.name, 'Nome');
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('status' in (patch ?? {})) {
      const status = this.parseChecklistTemplateStatus(patch.status) ?? before.status;
      data.status = status;
      if (status === AuditChecklistTemplateStatus.APPROVED && !before.approvedAt) {
        data.approvedAt = new Date();
        data.approvedById = me.sub;
      }
    }
    if ('auditType' in (patch ?? {})) data.auditType = this.parseType(patch.auditType) ?? null;
    if ('modality' in (patch ?? {})) data.modality = this.parseModality(patch.modality) ?? null;
    if ('standardId' in (patch ?? {})) data.standardId = this.id(patch.standardId);
    if ('orgNodeId' in (patch ?? {})) data.orgNodeId = this.id(patch.orgNodeId);
    if ('processId' in (patch ?? {})) data.processId = this.id(patch.processId);
    if ('supplierId' in (patch ?? {})) data.supplierId = this.id(patch.supplierId);
    if ('requiresApproval' in (patch ?? {})) data.requiresApproval = Boolean(patch.requiresApproval);
    data.updatedById = me.sub;
    return this.prisma.$transaction(async (tx) => {
      await tx.auditChecklistTemplate.update({ where: { id }, data });
      if ('sections' in (patch ?? {})) await this.replaceChecklistSections(tx, me.companyId, id, patch.sections);
      return tx.auditChecklistTemplate.findUnique({ where: { id }, include: { sections: { include: { items: true }, orderBy: { position: 'asc' } } } });
    });
  }

  private async replaceChecklistSections(tx: Tx, companyId: string, templateId: string, sectionsInput: any) {
    if (!Array.isArray(sectionsInput)) return;
    await tx.auditChecklistSection.deleteMany({ where: { templateId } });
    for (let s = 0; s < sectionsInput.length; s++) {
      const sectionInput = sectionsInput[s];
      const section = await tx.auditChecklistSection.create({
        data: {
          companyId,
          templateId,
          title: this.requiredText(sectionInput?.title, 'Secao'),
          description: this.nullableText(sectionInput?.description),
          position: Number.isFinite(Number(sectionInput?.position)) ? Number(sectionInput.position) : s,
          weight: this.optionalNumber(sectionInput?.weight) ?? 1,
        },
      });
      const items = Array.isArray(sectionInput?.items) ? sectionInput.items : [];
      if (items.length) {
        await tx.auditChecklistItem.createMany({
          data: items.map((item: any, i: number) => ({
            companyId,
            sectionId: section.id,
            code: this.nullableText(item?.code),
            question: this.requiredText(item?.question, 'Pergunta'),
            instructions: this.nullableText(item?.instructions),
            examples: this.nullableText(item?.examples),
            requirementId: this.id(item?.requirementId),
            responseType: this.nullableText(item?.responseType) ?? 'SELECT',
            options: jsonOrUndefined(item?.options),
            weight: this.optionalNumber(item?.weight) ?? 1,
            criticality: this.nullableText(item?.criticality),
            evidenceRequired: Boolean(item?.evidenceRequired),
            commentRequired: Boolean(item?.commentRequired),
            mandatory: item?.mandatory ?? true,
            conditionalRules: jsonOrUndefined(item?.conditionalRules),
            position: Number.isFinite(Number(item?.position)) ? Number(item.position) : i,
          })),
        });
      }
    }
  }

  async startChecklist(me: AuthPayload, auditId: string, body: any = {}) {
    const audit = await this.loadScoped(auditId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(audit), 'edit');
    const templateId = this.id(body?.templateId);
    if (templateId) {
      const template = await this.prisma.auditChecklistTemplate.findFirst({ where: { id: templateId, companyId: me.companyId, deletedAt: null } });
      if (!template) throw new NotFoundException('Modelo de checklist nao encontrado.');
    }
    return this.prisma.$transaction(async (tx) => {
      const code = await this.codes.nextCode(tx, me.companyId, 'execution');
      const execution = await tx.auditChecklistExecution.create({
        data: {
          companyId: me.companyId,
          auditId,
          templateId,
          code,
          status: 'IN_PROGRESS',
          assignedToUserId: this.id(body?.assignedToUserId) ?? me.sub,
          startedAt: new Date(),
          currentSectionId: this.id(body?.currentSectionId),
          createdById: me.sub,
        },
      });
      await this.recordTimelineTx(tx, me, auditId, 'AUDIT_CHECKLIST', execution.id, 'STARTED', `Checklist ${execution.code} iniciado`, audit.title, null, execution);
      return execution;
    });
  }

  async saveChecklistResponse(me: AuthPayload, executionId: string, body: any) {
    const execution = await this.prisma.auditChecklistExecution.findFirst({
      where: { id: executionId, companyId: me.companyId, deletedAt: null },
      include: { audit: { include: { orgNode: { select: { id: true } } } } },
    });
    if (!execution) throw new NotFoundException('Execucao de checklist nao encontrada.');
    await this.assertWriteArea(me, execution.audit.orgNodeId ?? null, 'edit');
    const itemId = this.id(body?.itemId);
    const itemCode = this.nullableText(body?.itemCode);
    if (!itemId && !itemCode) throw new BadRequestException('Informe o item do checklist.');

    const data = {
      companyId: me.companyId,
      executionId,
      auditId: execution.auditId,
      itemId,
      itemCode,
      response: this.parseResponse(body?.response),
      valueText: this.nullableText(body?.valueText),
      valueNumber: this.optionalNumber(body?.valueNumber),
      valueDate: this.optionalDate(body?.valueDate, 'Data da resposta'),
      comments: this.nullableText(body?.comments),
      attachments: jsonOrUndefined(body?.attachments),
      evidenceIds: this.idArray(body?.evidenceIds),
      findingId: this.id(body?.findingId),
      markedForReview: Boolean(body?.markedForReview),
      answeredById: me.sub,
      answeredAt: new Date(),
    };

    return this.prisma.$transaction(async (tx) => {
      const response = itemId
        ? await tx.auditChecklistResponse.upsert({
            where: { executionId_itemId: { executionId, itemId } },
            create: data,
            update: { ...data, companyId: undefined, executionId: undefined, auditId: undefined, itemId: undefined },
          })
        : await tx.auditChecklistResponse.create({ data });
      await this.refreshChecklistProgress(tx, execution);
      await this.recordTimelineTx(tx, me, execution.auditId, 'AUDIT_CHECKLIST_RESPONSE', response.id, 'AUTOSAVED', 'Resposta de checklist salva', itemCode ?? itemId, null, response);
      return response;
    });
  }

  private async refreshChecklistProgress(tx: Tx, execution: { id: string; templateId: string | null }) {
    let totalItems = 0;
    if (execution.templateId) {
      totalItems = await tx.auditChecklistItem.count({
        where: { deletedAt: null, section: { templateId: execution.templateId } },
      });
    }
    const answered = await tx.auditChecklistResponse.count({
      where: {
        executionId: execution.id,
        OR: [{ response: { not: null } }, { valueText: { not: null } }, { valueNumber: { not: null } }, { valueDate: { not: null } }],
      },
    });
    const progress = totalItems > 0 ? Math.round((answered / totalItems) * 100) : answered > 0 ? 100 : 0;
    await tx.auditChecklistExecution.update({ where: { id: execution.id }, data: { progress, autosaveToken: `${Date.now()}` } });
  }

  async completeChecklist(me: AuthPayload, executionId: string, body: any = {}) {
    const execution = await this.prisma.auditChecklistExecution.findFirst({ where: { id: executionId, companyId: me.companyId, deletedAt: null }, include: { audit: true } });
    if (!execution) throw new NotFoundException('Execucao de checklist nao encontrada.');
    await this.assertWriteArea(me, execution.audit.orgNodeId ?? null, 'edit');
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.auditChecklistExecution.update({ where: { id: executionId }, data: { status: 'COMPLETED', completedAt: new Date(), progress: 100, updatedById: me.sub } });
      await this.recordTimelineTx(tx, me, execution.auditId, 'AUDIT_CHECKLIST', executionId, 'COMPLETED', `Checklist ${item.code} concluido`, this.nullableText(body?.comment), execution, item);
      return item;
    });
  }

  // Evidencias
  async addEvidence(me: AuthPayload, auditId: string, body: any) {
    const audit = await this.loadScoped(auditId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(audit), 'edit');
    const description = this.nullableText(body?.description);
    const content = this.nullableText(body?.content);
    return this.prisma.$transaction(async (tx) => {
      const code = await this.codes.nextCode(tx, me.companyId, 'evidence');
      const stored = content
        ? await this.storage.putText(me.companyId, `audits/${auditId}/evidence`, this.nullableText(body?.fileName) ?? `${code}.txt`, content, this.nullableText(body?.mimeType) ?? 'text/plain')
        : null;
      const evidence = await tx.auditEvidence.create({
        data: {
          companyId: me.companyId,
          auditId,
          findingId: this.id(body?.findingId),
          checklistExecutionId: this.id(body?.checklistExecutionId),
          checklistItemId: this.id(body?.checklistItemId),
          nonConformityId: this.id(body?.nonConformityId),
          code,
          fileName: stored?.fileName ?? this.nullableText(body?.fileName),
          fileUrl: this.nullableText(body?.fileUrl),
          mimeType: stored?.mimeType ?? this.nullableText(body?.mimeType),
          sizeBytes: stored?.sizeBytes ?? Math.round(this.optionalNumber(body?.sizeBytes) ?? 0),
          hashSha256: stored?.hashSha256 ?? this.nullableText(body?.hashSha256),
          description,
          type: this.nullableText(body?.type) ?? 'TEXT',
          origin: this.nullableText(body?.origin) ?? 'AUDIT',
          authorUserId: this.id(body?.authorUserId) ?? me.sub,
          location: this.nullableText(body?.location),
          confidentiality: this.nullableText(body?.confidentiality) ?? 'INTERNAL',
          status: this.parseEvidenceStatus(body?.status) ?? AuditEvidenceStatus.ACTIVE,
          storageProvider: stored?.storageProvider,
          storageKey: stored?.storageKey,
          retentionUntil: this.optionalDate(body?.retentionUntil, 'Retencao') ?? null,
        },
      });
      await this.recordTimelineTx(tx, me, auditId, 'AUDIT_EVIDENCE', evidence.id, 'CREATED', `Evidencia ${evidence.code} adicionada`, description, null, evidence);
      return evidence;
    });
  }

  async listEvidence(me: AuthPayload, auditId: string) {
    const audit = await this.loadScoped(auditId, me.companyId);
    await this.assertViewArea(me, audit);
    return this.prisma.auditEvidence.findMany({ where: { auditId, companyId: me.companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
  }

  // Constatacoes
  async addFinding(me: AuthPayload, auditId: string, body: any) {
    const audit = await this.loadScoped(auditId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(audit), 'edit');
    const classificationId = this.id(body?.classificationId);
    const classification = classificationId
      ? await this.prisma.auditFindingClassification.findFirst({ where: { id: classificationId, companyId: me.companyId, deletedAt: null } })
      : null;
    return this.prisma.$transaction(async (tx) => {
      const code = await this.codes.nextCode(tx, me.companyId, 'finding');
      const finding = await tx.auditFinding.create({
        data: {
          companyId: me.companyId,
          auditId,
          code,
          type: this.parseFindingType(body?.type) ?? classification?.findingType ?? AuditFindingType.OBSERVATION,
          severity: this.parseSeverity(body?.severity) ?? classification?.severity ?? null,
          status: this.parseFindingStatus(body?.status) ?? AuditFindingStatus.OPEN,
          requirement: this.nullableText(body?.requirement) ?? null,
          standardId: this.id(body?.standardId),
          requirementId: this.id(body?.requirementId),
          orgNodeId: this.id(body?.orgNodeId) ?? audit.orgNodeId,
          processId: this.id(body?.processId),
          supplierId: this.id(body?.supplierId),
          checklistExecutionId: this.id(body?.checklistExecutionId),
          checklistItemId: this.id(body?.checklistItemId),
          classificationId,
          description: this.requiredText(body?.description, 'Descricao da constatacao'),
          conditionFound: this.nullableText(body?.conditionFound),
          expectedCriteria: this.nullableText(body?.expectedCriteria),
          riskImpact: this.nullableText(body?.riskImpact),
          responsibleUserId: this.id(body?.responsibleUserId),
          auditorUserId: this.id(body?.auditorUserId) ?? me.sub,
          auditedUserId: this.id(body?.auditedUserId),
          criticality: this.nullableText(body?.criticality),
          recurrence: Boolean(body?.recurrence),
          similarFindingIds: this.idArray(body?.similarFindingIds),
          actionPlanIds: this.idArray(body?.actionPlanIds),
          documentIds: this.idArray(body?.documentIds),
          indicatorIds: this.idArray(body?.indicatorIds),
          riskIds: this.idArray(body?.riskIds),
          evidence: this.nullableText(body?.evidence) ?? null,
          recommendation: this.nullableText(body?.recommendation) ?? null,
          dueDate: this.optionalDate(body?.dueDate, 'Prazo') ?? null,
        },
        include: { nonConformity: { select: { id: true, number: true, title: true, status: true } } },
      });
      await this.recordTimelineTx(tx, me, auditId, 'AUDIT_FINDING', finding.id, 'CREATED', `Constatacao ${finding.code} registrada`, finding.description, null, finding);
      return finding;
    }).then(async (finding) => {
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
    });
  }

  async updateFinding(me: AuthPayload, findingId: string, patch: any) {
    const finding = await this.loadFinding(findingId, me.companyId);
    await this.assertWriteArea(me, finding.audit.orgNodeId ?? null, 'edit');
    const data: Prisma.AuditFindingUpdateInput = {};
    if ('type' in (patch ?? {})) data.type = this.parseFindingType(patch.type) ?? finding.type;
    if ('severity' in (patch ?? {})) data.severity = this.parseSeverity(patch.severity) ?? null;
    if ('status' in (patch ?? {})) data.status = this.parseFindingStatus(patch.status) ?? finding.status;
    if ('requirement' in (patch ?? {})) data.requirement = this.nullableText(patch.requirement);
    if ('standardId' in (patch ?? {})) data.standardId = this.id(patch.standardId);
    if ('requirementId' in (patch ?? {})) data.requirementId = this.id(patch.requirementId);
    if ('orgNodeId' in (patch ?? {})) data.orgNodeId = this.id(patch.orgNodeId);
    if ('classificationId' in (patch ?? {})) data.classificationId = this.id(patch.classificationId);
    if ('description' in (patch ?? {})) data.description = this.requiredText(patch.description, 'Descricao da constatacao');
    if ('conditionFound' in (patch ?? {})) data.conditionFound = this.nullableText(patch.conditionFound);
    if ('expectedCriteria' in (patch ?? {})) data.expectedCriteria = this.nullableText(patch.expectedCriteria);
    if ('riskImpact' in (patch ?? {})) data.riskImpact = this.nullableText(patch.riskImpact);
    if ('responsibleUserId' in (patch ?? {})) data.responsibleUserId = this.id(patch.responsibleUserId);
    if ('auditorUserId' in (patch ?? {})) data.auditorUserId = this.id(patch.auditorUserId);
    if ('auditedUserId' in (patch ?? {})) data.auditedUserId = this.id(patch.auditedUserId);
    if ('criticality' in (patch ?? {})) data.criticality = this.nullableText(patch.criticality);
    if ('recurrence' in (patch ?? {})) data.recurrence = Boolean(patch.recurrence);
    for (const field of ['similarFindingIds', 'actionPlanIds', 'documentIds', 'indicatorIds', 'riskIds'] as const) {
      if (field in (patch ?? {})) data[field] = this.idArray(patch[field]);
    }
    if ('evidence' in (patch ?? {})) data.evidence = this.nullableText(patch.evidence);
    if ('recommendation' in (patch ?? {})) data.recommendation = this.nullableText(patch.recommendation);
    if ('dueDate' in (patch ?? {})) data.dueDate = this.optionalDate(patch.dueDate, 'Prazo');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.auditFinding.update({
        where: { id: findingId },
        data,
        include: { nonConformity: { select: { id: true, number: true, title: true, status: true } } },
      });
      await this.recordTimelineTx(tx, me, finding.auditId, 'AUDIT_FINDING', findingId, 'UPDATED', `Constatacao ${updated.code ?? findingId} atualizada`, updated.description, finding, updated);
      return updated;
    });
  }

  async removeFinding(me: AuthPayload, findingId: string) {
    const finding = await this.loadFinding(findingId, me.companyId);
    await this.assertWriteArea(me, finding.audit.orgNodeId ?? null, 'edit');
    return this.prisma.$transaction(async (tx) => {
      const removed = await tx.auditFinding.update({ where: { id: findingId }, data: { deletedAt: new Date() } });
      await this.recordTimelineTx(tx, me, finding.auditId, 'AUDIT_FINDING', findingId, 'DELETED', `Constatacao ${finding.code ?? findingId} removida`, finding.description, finding, { deletedAt: removed.deletedAt });
      return removed;
    });
  }

  async generateNonConformity(me: AuthPayload, findingId: string, body: any = {}) {
    const finding = await this.loadFinding(findingId, me.companyId);
    await this.assertWriteArea(me, finding.audit.orgNodeId ?? null, 'edit');
    if (finding.nonConformityId) {
      throw new BadRequestException('Esta constatacao ja possui uma nao conformidade vinculada.');
    }

    const nc = await this.nonconformities.create(me, {
      title: this.nullableText(body?.title) ?? `Auditoria #${finding.audit.number}: ${finding.description}`.slice(0, 180),
      description: finding.evidence ?? finding.conditionFound ?? finding.description,
      source: 'AUDIT',
      severity: finding.severity ?? NonConformitySeverity.MAJOR,
      orgNodeId: finding.orgNodeId ?? finding.audit.orgNodeId ?? undefined,
      responsibleUserId: this.id(body?.responsibleUserId) ?? finding.responsibleUserId ?? undefined,
      dueDate: body?.dueDate ?? finding.dueDate ?? undefined,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.auditFinding.update({
        where: { id: findingId },
        data: { nonConformityId: nc.id, status: AuditFindingStatus.IN_TREATMENT },
        include: { nonConformity: { select: { id: true, number: true, title: true, status: true } } },
      });
      await tx.auditFollowUp.create({
        data: {
          companyId: me.companyId,
          auditId: finding.auditId,
          findingId,
          nonConformityId: nc.id,
          responsibleUserId: this.id(body?.responsibleUserId) ?? finding.responsibleUserId,
          title: `Tratativa da NC #${nc.number}`,
          description: finding.recommendation ?? finding.description,
          dueDate: this.optionalDate(body?.dueDate, 'Prazo') ?? finding.dueDate,
          createdById: me.sub,
        },
      });
      await this.recordTimelineTx(tx, me, finding.auditId, 'NON_CONFORMITY', nc.id, 'CREATED', 'Nao conformidade gerada a partir de constatacao', nc.title, finding, nc);
      return item;
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

  // Follow-up, relatorios e IA
  async createFollowUp(me: AuthPayload, auditId: string, body: any) {
    const audit = await this.loadScoped(auditId, me.companyId);
    await this.assertWriteArea(me, this.areaOf(audit), 'edit');
    return this.prisma.auditFollowUp.create({
      data: {
        companyId: me.companyId,
        auditId,
        findingId: this.id(body?.findingId),
        nonConformityId: this.id(body?.nonConformityId),
        actionPlanId: this.id(body?.actionPlanId),
        responsibleUserId: this.id(body?.responsibleUserId),
        title: this.requiredText(body?.title, 'Titulo do follow-up'),
        description: this.nullableText(body?.description),
        status: this.parseFollowUpStatus(body?.status) ?? AuditFollowUpStatus.OPEN,
        dueDate: this.optionalDate(body?.dueDate, 'Prazo') ?? null,
        effectivenessStatus: this.nullableText(body?.effectivenessStatus),
        verificationNotes: this.nullableText(body?.verificationNotes),
        createdById: me.sub,
      },
    });
  }

  async updateFollowUp(me: AuthPayload, id: string, patch: any) {
    const before = await this.prisma.auditFollowUp.findFirst({ where: { id, companyId: me.companyId, deletedAt: null }, include: { audit: true } });
    if (!before) throw new NotFoundException('Follow-up nao encontrado.');
    await this.assertWriteArea(me, before.audit.orgNodeId ?? null, 'edit');
    const data: Prisma.AuditFollowUpUpdateInput = {};
    if ('title' in (patch ?? {})) data.title = this.requiredText(patch.title, 'Titulo');
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('status' in (patch ?? {})) {
      const status = this.parseFollowUpStatus(patch.status) ?? before.status;
      data.status = status;
      const completedStatuses: AuditFollowUpStatus[] = [AuditFollowUpStatus.CLOSED, AuditFollowUpStatus.EFFECTIVE, AuditFollowUpStatus.INEFFECTIVE];
      if (completedStatuses.includes(status)) data.completedAt = new Date();
    }
    if ('dueDate' in (patch ?? {})) data.dueDate = this.optionalDate(patch.dueDate, 'Prazo');
    if ('effectivenessStatus' in (patch ?? {})) data.effectivenessStatus = this.nullableText(patch.effectivenessStatus);
    if ('verificationNotes' in (patch ?? {})) data.verificationNotes = this.nullableText(patch.verificationNotes);
    data.updatedById = me.sub;
    return this.prisma.auditFollowUp.update({ where: { id }, data });
  }

  async generateReport(me: AuthPayload, auditId: string, body: any = {}) {
    const detail = await this.getById(me, auditId) as any;
    await this.assertWriteArea(me, detail.areaId ?? null, 'edit');
    return this.prisma.$transaction(async (tx) => {
      const code = await this.codes.nextCode(tx, me.companyId, 'report');
      const findings = detail.findings ?? [];
      const report = await tx.auditReport.create({
        data: {
          companyId: me.companyId,
          auditId,
          code,
          title: this.nullableText(body?.title) ?? `Relatorio ${detail.code ?? `#${detail.number}`} - ${detail.title}`,
          status: this.nullableText(body?.status) ?? 'PRELIMINARY',
          summary: this.nullableText(body?.summary) ?? detail.summary,
          executiveSummary: this.nullableText(body?.executiveSummary) ?? `Auditoria com ${findings.length} constatacoes, ${detail.ncCount} relacionadas a nao conformidade.`,
          findingsSummary: this.nullableText(body?.findingsSummary) ?? findings.map((f: any) => `${f.code ?? f.id}: ${f.description}`).join('\n'),
          conclusions: this.nullableText(body?.conclusions) ?? detail.opinion,
          recommendations: this.nullableText(body?.recommendations) ?? findings.map((f: any) => f.recommendation).filter(Boolean).join('\n'),
          score: this.optionalNumber(body?.score) ?? detail.score,
          result: this.nullableText(body?.result) ?? detail.result,
          issuedAt: body?.issue ? new Date() : null,
          createdById: me.sub,
          documentId: this.id(body?.documentId),
          data: jsonOrUndefined({ audit: { id: detail.id, code: detail.code, title: detail.title }, findingsCount: findings.length, evidenceCount: detail.evidence?.length ?? 0 }),
        },
      });
      await tx.audit.update({ where: { id: auditId }, data: { status: AuditStatus.REPORT_ISSUED, summary: report.summary ?? detail.summary } });
      await this.recordTimelineTx(tx, me, auditId, 'AUDIT_REPORT', report.id, 'CREATED', `Relatorio ${report.code} gerado`, report.title, null, report);
      return report;
    });
  }

  async decideReport(me: AuthPayload, reportId: string, body: any = {}) {
    const report = await this.prisma.auditReport.findFirst({ where: { id: reportId, companyId: me.companyId, deletedAt: null }, include: { audit: true } });
    if (!report) throw new NotFoundException('Relatorio nao encontrado.');
    await this.assertWriteArea(me, report.audit.orgNodeId ?? null, 'edit');
    const approved = body?.decision === 'APPROVED';
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.auditReport.update({
        where: { id: reportId },
        data: { status: approved ? 'APPROVED' : 'ADJUSTMENTS_REQUESTED', approvedAt: approved ? new Date() : null, approvedById: approved ? me.sub : null },
      });
      await tx.auditApproval.create({
        data: {
          companyId: me.companyId,
          auditId: report.auditId,
          stage: 'REPORT',
          decision: approved ? AuditApprovalDecision.APPROVED : AuditApprovalDecision.ADJUSTMENTS_REQUESTED,
          approverUserId: me.sub,
          comment: this.nullableText(body?.comment),
          decidedAt: new Date(),
        },
      });
      await this.recordTimelineTx(tx, me, report.auditId, 'AUDIT_REPORT', reportId, approved ? 'APPROVED' : 'ADJUSTMENTS_REQUESTED', `Relatorio ${report.code} avaliado`, this.nullableText(body?.comment), report, updated);
      return updated;
    });
  }

  async createAiSuggestions(me: AuthPayload, auditId: string, body: any = {}) {
    const audit = await this.getById(me, auditId) as any;
    await this.assertViewArea(me, audit);
    const suggestions = [
      {
        suggestionType: 'CHECKLIST',
        title: 'Revisar cobertura do checklist',
        content: `Sugestao: verifique se o escopo "${audit.scope ?? audit.title}" possui perguntas para documentos vigentes, riscos, indicadores fora da meta e NCs anteriores.`,
      },
      {
        suggestionType: 'FINDING_TEXT',
        title: 'Estrutura objetiva da constatacao',
        content: 'Sugestao: redija cada constatacao como criterio, condicao encontrada, evidencia objetiva, risco/impacto e tratativa necessaria.',
      },
      {
        suggestionType: 'FOLLOW_UP',
        title: 'Priorizar follow-up',
        content: audit.criticalFindings > 0 ? 'Sugestao: priorize follow-up para constatacoes criticas antes da emissao do relatorio final.' : 'Sugestao: planeje follow-up apenas para itens com risco, acao ou NC vinculada.',
      },
    ];
    const selected = this.nullableText(body?.type) ? suggestions.filter((item) => item.suggestionType === body.type) : suggestions;
    return this.prisma.$transaction(
      selected.map((item) =>
        this.prisma.auditAiSuggestion.create({
          data: {
            companyId: me.companyId,
            auditId,
            suggestionType: item.suggestionType,
            title: item.title,
            content: item.content,
            context: jsonOrUndefined({ auditId, source: 'deterministic_assistant', generatedBy: me.sub }),
          },
        }),
      ),
    );
  }

  async decideAiSuggestion(me: AuthPayload, id: string, body: any = {}) {
    const suggestion = await this.prisma.auditAiSuggestion.findFirst({ where: { id, companyId: me.companyId } });
    if (!suggestion) throw new NotFoundException('Sugestao nao encontrada.');
    if (suggestion.auditId) {
      const audit = await this.loadScoped(suggestion.auditId, me.companyId);
      await this.assertWriteArea(me, this.areaOf(audit), 'edit');
    }
    const status = String(body?.status ?? '').toUpperCase();
    if (!['ACCEPTED', 'REJECTED', 'APPLIED'].includes(status)) throw new BadRequestException('Status de sugestao invalido.');
    return this.prisma.auditAiSuggestion.update({ where: { id }, data: { status: status as any, decidedAt: new Date(), decidedById: me.sub } });
  }

  private async recordTimelineTx(
    tx: Tx,
    me: AuthPayload,
    auditId: string | null,
    entityType: string,
    entityId: string | null,
    action: string,
    title: string,
    description?: string | null,
    beforeValue?: unknown,
    afterValue?: unknown,
  ) {
    await tx.auditTimelineEvent.create({
      data: {
        companyId: me.companyId,
        auditId,
        entityType,
        entityId,
        userId: me.sub,
        action,
        title,
        description,
        beforeValue: beforeValue === undefined ? undefined : jsonOrNull(beforeValue),
        afterValue: afterValue === undefined ? undefined : jsonOrNull(afterValue),
      },
    });
  }
}

function jsonOrUndefined(value: unknown) {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return { value: String(value) };
  }
}

function jsonOrNull(value: unknown) {
  if (value === null || value === undefined) return Prisma.JsonNull;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return { value: String(value) };
  }
}

function normalizeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function parseEnum<T extends Record<string, string>>(value: unknown, values: T, fallback: T[keyof T]) {
  if (!value) return fallback;
  const text = String(value);
  if (!Object.values(values).includes(text)) throw new BadRequestException('Valor invalido.');
  return text as T[keyof T];
}
