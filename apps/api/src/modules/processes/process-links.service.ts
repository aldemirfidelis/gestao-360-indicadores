import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { isProductModuleActive, type ProcessIntegrationType } from '@g360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { AuthService } from '../auth/auth.service';
import type { AuthPayload } from '../auth/auth.types';
import { PortalConfigService } from '../portal-admin/services/portal-config.service';

const indicatorArea = { indicator: { select: { ownerNodeId: true } } };
type Policy = { model: string; field: string; module: string; permissions: string[]; title: string; route: string; select?: any; area?: string; nestedCompany?: boolean; noDelete?: boolean };
export const PROCESS_TARGETS: Record<ProcessIntegrationType, Policy> = {
  INDICATOR: { model: 'indicator', field: 'indicatorId', module: 'indicators', permissions: ['indicators:view'], title: 'name', route: '/indicators/', area: 'ownerNodeId', select: { code: true, status: true, results: { orderBy: { periodDate: 'desc' }, take: 1, select: { periodRef: true, value: true, light: true, attainment: true } } } },
  PROJECT: { model: 'project', field: 'projectId', module: 'projects', permissions: ['projects:view'], title: 'name', route: '/projects/', area: 'indicator.ownerNodeId', select: { status: true, ...indicatorArea } },
  PROJECT_TASK: { model: 'projectTask', field: 'projectTaskId', module: 'projects', permissions: ['projects:view'], title: 'name', route: '/projects/', area: 'project.indicator.ownerNodeId', nestedCompany: true, noDelete: true, select: { projectId: true, project: { select: { indicator: { select: { ownerNodeId: true } } } } } },
  TASK: { model: 'workspaceTask', field: 'workspaceTaskId', module: 'tasks', permissions: ['myday:view'], title: 'title', route: '/tarefas?task=', area: 'areaId', noDelete: true },
  ACTION: { model: 'actionPlan', field: 'actionPlanId', module: 'actions', permissions: ['actions:view'], title: 'title', route: '/actions/', area: 'ownerNodeId', select: { status: true } },
  DEVIATION: { model: 'deviation', field: 'deviationId', module: 'deviations', permissions: ['deviations:view'], title: 'title', route: '/deviations/', area: 'indicator.ownerNodeId', select: { status: true, ...indicatorArea } },
  DOCUMENT: { model: 'document', field: 'documentId', module: 'documents', permissions: ['doc:view'], title: 'title', route: '/documents?id=', area: 'orgNodeId', select: { status: true } },
  FORM: { model: 'formTemplate', field: 'formTemplateId', module: 'forms', permissions: ['forms:view'], title: 'title', route: '/forms?id=', area: 'orgNodeId', select: { status: true } },
  RISK: { model: 'riskRegister', field: 'riskId', module: 'risks', permissions: ['risks:view'], title: 'title', route: '/risks?id=', area: 'orgNodeId', select: { status: true } },
  AUDIT: { model: 'audit', field: 'auditId', module: 'audits', permissions: ['audits:view'], title: 'title', route: '/audits/', area: 'orgNodeId', select: { status: true } },
  TRAINING: { model: 'training', field: 'trainingId', module: 'training', permissions: ['training:view'], title: 'name', route: '/treinamento/catalogo?id=', select: { status: true } },
  MEETING: { model: 'meeting', field: 'meetingId', module: 'meetings', permissions: ['meetings:view'], title: 'title', route: '/meetings/', area: 'indicator.ownerNodeId', select: { status: true, ...indicatorArea } },
  OBJECTIVE: { model: 'strategicObjective', field: 'objectiveId', module: 'strategy', permissions: ['strategy:view'], title: 'name', route: '/strategy/', area: 'ownerNodeId', nestedCompany: true, select: { mapId: true, status: true } },
  PROCESS: { model: 'process', field: 'relatedProcessId', module: 'processes', permissions: ['processes:view'], title: 'name', route: '/processes/', area: 'orgNodeId', select: { ...indicatorArea } },
  AREA: { model: 'orgNode', field: 'orgNodeId', module: 'org', permissions: ['org:view', 'org:view_all'], title: 'name', route: '/org?nodeId=', area: 'id' },
};
export type ProcessLinkContext = { permissions: Set<string>; modules: Set<string>; admin: boolean; user: AuthPayload };

@Injectable()
export class ProcessLinksService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessService, private readonly auth: AuthService, private readonly portal: PortalConfigService) {}

  async context(me: AuthPayload): Promise<ProcessLinkContext> {
    const admin = me.role === 'SUPER_ADMIN';
    const [profile, config] = await Promise.all([this.auth.me(me), this.portal.getEffectiveConfig(me)]);
    return { user: me, admin, permissions: new Set(profile.permissions), modules: new Set(config.modules.filter((module) => !module.unavailable && !module.hidden && !module.maintenance && (!module.allowedRoles.length || module.allowedRoles.includes(me.role))).map((module) => module.code)) };
  }

  canRead(context: ProcessLinkContext, type: ProcessIntegrationType) {
    if (!Object.prototype.hasOwnProperty.call(PROCESS_TARGETS, type)) return false;
    const policy = PROCESS_TARGETS[type];
    return isProductModuleActive(policy.module) && (context.admin || (context.modules.has(policy.module === 'tasks' ? 'tasks' : policy.module) && policy.permissions.some((permission) => context.permissions.has(permission) || context.permissions.has(`${permission.split(':')[0]}:manage`))));
  }

  async query(context: ProcessLinkContext, type: ProcessIntegrationType, targetId?: string | string[], search?: string) {
    if (!Object.prototype.hasOwnProperty.call(PROCESS_TARGETS, type)) throw new BadRequestException('Tipo de vínculo inválido.');
    if (!this.canRead(context, type)) throw new ForbiddenException('Sem acesso ao módulo do registro relacionado.');
    const p = PROCESS_TARGETS[type];
    const me = context.user;
    const areaModule = p.module === 'documents' ? 'documents' : p.module === 'org' ? 'org' : p.module;
    const areas = await this.access.listAreaFilter(me.sub, areaModule, 'view');
    const where: any = p.nestedCompany
      ? type === 'PROJECT_TASK' ? { project: { companyId: me.companyId, deletedAt: null } } : { map: { companyId: me.companyId, deletedAt: null } }
      : { companyId: me.companyId };
    if (!p.noDelete) where.deletedAt = null;
    if (targetId) where.id = Array.isArray(targetId) ? { in: targetId } : targetId;
    if (search?.trim()) where[p.title] = { contains: search.trim().slice(0, 120), mode: 'insensitive' };
    if (type === 'TASK') {
      where.isArchived = false;
      if (!['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(me.role)) where.OR = [{ assigneeId: me.sub }, { createdById: me.sub }];
    }
    if (type === 'AREA') where.active = true;
    if (areas && p.area) {
      const nested = (value: any) => p.area!.split('.').reduceRight<any>((result, key) => ({ [key]: result }), value);
      const missingRelations = p.area.split('.').slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).reduceRight<any>((value, key) => ({ [key]: value }), null));
      const areaFilter = type === 'AREA' ? { id: { in: areas } } : type === 'PROCESS' ? { OR: [{ orgNodeId: { in: areas } }, { orgNodeId: null, indicator: { ownerNodeId: { in: areas } } }, { orgNodeId: null, indicatorId: null }] } : { OR: [nested({ in: areas }), nested(null), ...missingRelations] };
      where.AND = [areaFilter];
    }
    const select: any = { id: true, [p.title]: true, ...(p.select ?? {}) };
    if (p.area && !p.area.includes('.')) select[p.area] = true;
    const items = await (this.prisma as any)[p.model].findMany({ where, select, take: Array.isArray(targetId) ? Math.min(targetId.length, 1000) : targetId ? 1 : 50, orderBy: { [p.title]: 'asc' } });
    return items.map((item: any) => ({ id: item.id, type, name: item[p.title], href: p.route + encodeURIComponent(type === 'PROJECT_TASK' ? item.projectId : type === 'OBJECTIVE' ? item.mapId : item.id), status: item.status ?? null, result: item.results?.[0] ?? null }));
  }

  async requireTarget(context: ProcessLinkContext, type: ProcessIntegrationType, targetId: string) {
    const items = await this.query(context, type, targetId);
    if (!items.length) throw new NotFoundException('Registro relacionado não encontrado ou fora do escopo.');
    return items[0];
  }

  async subject(me: AuthPayload, subjectType: 'USER' | 'AREA' | 'JOB', subjectId: string, allowInactive = false) {
    let record: any;
    const areas = await this.access.listAreaFilter(me.sub, 'processes', 'view');
    if (subjectType === 'USER') {
      record = await this.prisma.user.findFirst({ where: { id: subjectId, companyId: me.companyId, deletedAt: null }, select: { id: true, name: true, active: true, defaultNodeId: true, jobTitle: true } });
      if (record && areas && (!record.defaultNodeId || !areas.includes(record.defaultNodeId))) record = null;
    } else if (subjectType === 'AREA') {
      record = await this.prisma.orgNode.findFirst({ where: { id: subjectId, companyId: me.companyId, deletedAt: null, ...(areas ? { id: { equals: subjectId, in: areas } } : {}) }, select: { id: true, name: true, active: true, parentId: true, type: true } });
    } else {
      // O catálogo de cargos continua sendo o OrgJob existente, sem novo cadastro.
      record = await this.prisma.orgJob.findFirst({ where: { id: subjectId, companyId: me.companyId, ...(areas ? { employees: { some: { orgNodeId: { in: areas }, status: 'ACTIVE' } } } : {}) }, select: { id: true, name: true, active: true } });
    }
    if (!record || (!allowInactive && !record.active)) throw new NotFoundException('Participante não encontrado, inativo ou fora do escopo.');
    return record;
  }
}
