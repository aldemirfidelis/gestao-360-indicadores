import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActionStatus, Prisma, UserRoleEnum } from '@prisma/client';
import { OrgNodeCreateInput } from '@g360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { AccessService } from '../access/access.service';
import { filterOrgNodesWithAncestors, type OrgNodeLink } from './orgnodes.visibility';

type OrgNodeAdminInput = OrgNodeCreateInput & {
  branchId?: string | null;
};

type ActivityInput = {
  title?: string;
  description?: string | null;
  orderIndex?: number;
  isActive?: boolean;
  items?: Array<{ description: string; orderIndex?: number; isActive?: boolean }>;
};

type ActivityItemInput = {
  description?: string;
  orderIndex?: number;
  isActive?: boolean;
};

export interface OrgTreeNode {
  id: string;
  parentId: string | null;
  name: string;
  code: string | null;
  type: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  active: boolean;
  responsibleUserId: string | null;
  responsibleUser: { id: string; name: string } | null;
  indicatorsCount: number;
  children: OrgTreeNode[];
}

export type OrgTreeScope = 'mine' | 'all';

const MODULE = 'org';
const ORG_VIEW_ALL_PERMISSION = 'org:view_all';
const CLOSED_ACTION_STATUSES: ActionStatus[] = [
  ActionStatus.DONE,
  ActionStatus.DONE_LATE,
  ActionStatus.CANCELLED,
  ActionStatus.EFFECTIVE,
];

@Injectable()
export class OrgNodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async listFlat(companyId: string) {
    return this.prisma.orgNode.findMany({
      where: { companyId, deletedAt: null },
      include: {
        responsibleUser: { select: { id: true, name: true } },
        _count: { select: { indicatorsOwned: true, children: true } },
      },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  async listFlatForUser(me: AuthPayload, scope?: OrgTreeScope) {
    const flat = await this.listFlat(me.companyId);
    const visibleIds = await this.resolveVisibleOrgNodeIds(me, flat, scope);
    if (!visibleIds) return flat;
    return flat.filter((node) => visibleIds.has(node.id));
  }

  async tree(companyId: string): Promise<OrgTreeNode[]> {
    const flat = await this.listFlat(companyId);
    return this.buildTree(flat);
  }

  async treeForUser(me: AuthPayload, scope?: OrgTreeScope): Promise<OrgTreeNode[]> {
    const flat = await this.listFlatForUser(me, scope);
    return this.buildTree(flat);
  }

  private buildTree(flat: Awaited<ReturnType<OrgNodesService['listFlat']>>): OrgTreeNode[] {
    const byId = new Map<string, OrgTreeNode>();
    flat.forEach((n) => {
      byId.set(n.id, {
        id: n.id,
        parentId: n.parentId,
        name: n.name,
        code: n.code,
        type: n.type,
        description: n.description,
        color: n.color,
        icon: n.icon,
        active: n.active,
        responsibleUserId: n.responsibleUserId,
        responsibleUser: n.responsibleUser,
        indicatorsCount: n._count.indicatorsOwned,
        children: [],
      });
    });
    const roots: OrgTreeNode[] = [];
    byId.forEach((node) => {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }

  async detail(id: string, me: AuthPayload) {
    const node = await this.prisma.orgNode.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: {
        company: { select: { id: true, name: true, tradeName: true } },
        branch: { select: { id: true, name: true, code: true, city: true, state: true } },
        parent: { select: { id: true, name: true, type: true, parentId: true } },
        responsibleUser: { select: { id: true, name: true, email: true, jobTitle: true } },
        activities: {
          where: { deletedAt: null },
          include: {
            items: {
              where: { deletedAt: null },
              orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
            },
          },
          orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!node) throw new NotFoundException('No organizacional nao encontrado');

    const allNodes = await this.prisma.orgNode.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      select: { id: true, parentId: true, name: true, type: true },
    });
    await this.assertCanViewOrgNode(me, node.id, allNodes);

    const [
      childrenCount,
      usersCount,
      employeesCount,
      indicatorsCount,
      openActionsCount,
    ] = await Promise.all([
      this.prisma.orgNode.count({ where: { parentId: id, companyId: me.companyId, deletedAt: null } }),
      this.prisma.user.count({ where: { defaultNodeId: id, companyId: me.companyId, deletedAt: null } }),
      this.prisma.orgEmployee.count({ where: { orgNodeId: id, companyId: me.companyId } }),
      this.prisma.indicator.count({ where: { ownerNodeId: id, companyId: me.companyId, deletedAt: null } }),
      this.prisma.actionPlan.count({
        where: {
          ownerNodeId: id,
          companyId: me.companyId,
          deletedAt: null,
          status: { notIn: CLOSED_ACTION_STATUSES },
        },
      }),
    ]);

    return {
      ...node,
      breadcrumb: this.buildBreadcrumb(node.id, allNodes, node.company.name),
      counts: {
        children: childrenCount,
        users: usersCount,
        employees: employeesCount,
        indicators: indicatorsCount,
        openActions: openActionsCount,
      },
      canEdit: me.role === UserRoleEnum.SUPER_ADMIN || me.role === UserRoleEnum.COMPANY_ADMIN,
    };
  }

  private async assertCanViewOrgNode(me: AuthPayload, orgNodeId: string, allNodes?: OrgNodeLink[]) {
    const visibleIds = await this.resolveVisibleOrgNodeIds(me, allNodes, undefined);
    if (visibleIds && !visibleIds.has(orgNodeId)) {
      throw new ForbiddenException('Voce nao tem permissao para visualizar esta area da arvore organizacional.');
    }
  }

  private async resolveVisibleOrgNodeIds(me: AuthPayload, allNodes?: OrgNodeLink[], requestedScope?: OrgTreeScope): Promise<Set<string> | null> {
    const ctx = await this.access.getContext(me.sub);
    if (!ctx.areaAccessEnabled) return null;

    const canViewAll = await this.canViewAllOrg(me);
    const scope = requestedScope ?? (canViewAll ? 'all' : 'mine');
    if (scope === 'all') {
      if (!canViewAll) {
        throw new ForbiddenException('Voce nao tem permissao para visualizar todos os setores.');
      }
      return null;
    }

    let scopedIds: string[];
    if (ctx.companyWide || ctx.role === UserRoleEnum.DIRECTOR) {
      scopedIds = await this.access.expandWithDescendants(ctx.companyId, ctx.ownAreaIds);
    } else {
      scopedIds = (await this.access.listAreaFilter(me.sub, MODULE, 'view')) ?? [];
    }
    if (scopedIds.length === 0) return new Set();

    const nodes =
      allNodes ??
      (await this.prisma.orgNode.findMany({
        where: { companyId: me.companyId, deletedAt: null },
        select: { id: true, parentId: true },
      }));
    return new Set(filterOrgNodesWithAncestors(nodes, scopedIds).map((node) => node.id));
  }

  private async canViewAllOrg(me: AuthPayload) {
    if (
      me.role === UserRoleEnum.SUPER_ADMIN ||
      me.role === UserRoleEnum.COMPANY_ADMIN ||
      me.role === UserRoleEnum.DIRECTOR
    ) {
      return true;
    }
    const keys = await this.getPermissionKeys(me.sub);
    return keys.has(ORG_VIEW_ALL_PERMISSION) || keys.has('org:manage');
  }

  private async getPermissionKeys(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        permissions: { select: { permission: { select: { key: true } } } },
        accessProfile: {
          select: {
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    });
    const keys = new Set<string>();
    user?.permissions.forEach((item) => keys.add(item.permission.key));
    user?.accessProfile?.permissions.forEach((item) => keys.add(item.permission.key));
    return keys;
  }

  async create(input: OrgNodeAdminInput, companyId: string, actorId?: string | null) {
    const scopedCompanyId = companyId;
    const name = this.cleanRequired(input.name, 'Nome');
    this.assertAllowedOrgNodeName(name);
    await this.validateOrgLinks(scopedCompanyId, input);
    await this.assertNameAvailable(scopedCompanyId, name, input.parentId ?? null);
    const created = await this.prisma.orgNode.create({
      data: {
        companyId: scopedCompanyId,
        branchId: input.branchId ?? null,
        parentId: input.parentId ?? null,
        name,
        code: this.cleanOptional(input.code),
        type: input.type,
        responsibleUserId: input.responsibleUserId ?? null,
        description: this.cleanOptional(input.description),
        color: this.cleanOptional(input.color),
        icon: this.cleanOptional(input.icon),
        active: input.active ?? true,
      },
    });
    await this.audit(scopedCompanyId, actorId ?? null, 'CREATE', 'OrgNode', created.id, null, created, created.name);
    return created;
  }

  async update(id: string, input: Partial<OrgNodeAdminInput>, companyId: string, actorId?: string | null) {
    const node = await this.prisma.orgNode.findFirst({ where: { id, deletedAt: null, companyId } });
    if (!node) throw new NotFoundException('No nao encontrado');

    const nextName = input.name === undefined ? node.name : this.cleanRequired(input.name, 'Nome');
    const nextParentId = input.parentId === undefined ? node.parentId : input.parentId;
    this.assertAllowedOrgNodeName(nextName);
    await this.validateOrgLinks(node.companyId, { ...input, parentId: nextParentId }, id);
    await this.assertNoHierarchyCycle(node.companyId, id, nextParentId ?? null);
    await this.assertNameAvailable(node.companyId, nextName, nextParentId ?? null, id);

    const updated = await this.prisma.orgNode.update({
      where: { id },
      data: {
        name: nextName,
        branchId: input.branchId === undefined ? node.branchId : input.branchId,
        code: input.code === undefined ? node.code : this.cleanOptional(input.code),
        type: input.type ?? node.type,
        responsibleUserId: input.responsibleUserId === undefined ? node.responsibleUserId : input.responsibleUserId,
        description: input.description === undefined ? node.description : this.cleanOptional(input.description),
        color: input.color === undefined ? node.color : this.cleanOptional(input.color),
        icon: input.icon === undefined ? node.icon : this.cleanOptional(input.icon),
        active: input.active ?? node.active,
        parentId: nextParentId,
      },
    });
    await this.audit(node.companyId, actorId ?? null, 'UPDATE', 'OrgNode', id, node, updated, updated.name);
    return updated;
  }

  async move(id: string, companyId: string, newParentId: string | null, actorId?: string | null) {
    const node = await this.prisma.orgNode.findFirst({ where: { id, deletedAt: null, companyId }, select: { id: true, companyId: true, parentId: true, name: true } });
    if (!node) throw new NotFoundException('No nao encontrado');
    if (newParentId) {
      const parent = await this.prisma.orgNode.findFirst({ where: { id: newParentId, companyId: node.companyId, deletedAt: null }, select: { id: true } });
      if (!parent) throw new NotFoundException('No pai nao encontrado para a empresa informada');
    }
    await this.assertNoHierarchyCycle(node.companyId, id, newParentId);
    await this.assertNameAvailable(node.companyId, node.name, newParentId, id);
    const updated = await this.prisma.orgNode.update({
      where: { id },
      data: { parentId: newParentId },
    });
    await this.audit(node.companyId, actorId ?? null, 'MOVE', 'OrgNode', id, node, updated, updated.name);
    return updated;
  }

  async removalImpact(id: string, companyId: string) {
    const node = await this.prisma.orgNode.findFirst({ where: { id, deletedAt: null, companyId }, select: { id: true, name: true } });
    if (!node) throw new NotFoundException('No nao encontrado');
    const [
      children,
      indicators,
      guidelineIndicators,
      users,
      userAssignments,
      actions,
      risks,
      nonConformities,
      documents,
      audits,
      processes,
      formTemplates,
      formSubmissions,
      strategicObjectives,
      strategicObjectiveLinks,
      orgEmployees,
      activities,
    ] = await Promise.all([
      this.prisma.orgNode.count({ where: { parentId: id, deletedAt: null } }),
      this.prisma.indicator.count({ where: { ownerNodeId: id, deletedAt: null } }),
      this.prisma.indicator.count({ where: { guidelineNodeId: id, deletedAt: null } }),
      this.prisma.user.count({ where: { defaultNodeId: id, deletedAt: null } }),
      this.prisma.userAreaAssignment.count({ where: { orgNodeId: id } }),
      this.prisma.actionPlan.count({ where: { ownerNodeId: id, deletedAt: null } }),
      this.prisma.riskRegister.count({ where: { orgNodeId: id, deletedAt: null } }),
      this.prisma.nonConformity.count({ where: { orgNodeId: id, deletedAt: null } }),
      this.prisma.document.count({ where: { orgNodeId: id, deletedAt: null } }),
      this.prisma.audit.count({ where: { orgNodeId: id, deletedAt: null } }),
      this.prisma.process.count({ where: { orgNodeId: id, deletedAt: null } }),
      this.prisma.formTemplate.count({ where: { orgNodeId: id, deletedAt: null } }),
      this.prisma.formSubmission.count({ where: { orgNodeId: id, deletedAt: null } }),
      this.prisma.strategicObjective.count({ where: { ownerNodeId: id, deletedAt: null } }),
      this.prisma.strategicObjectiveOrgNode.count({ where: { orgNodeId: id, deletedAt: null } }),
      this.prisma.orgEmployee.count({ where: { orgNodeId: id } }),
      this.prisma.organizationalUnitActivity.count({ where: { organizationalUnitId: id, deletedAt: null } }),
    ]);
    const relationships = {
      children,
      indicators,
      guidelineIndicators,
      users,
      userAssignments,
      actions,
      risks,
      nonConformities,
      documents,
      audits,
      processes,
      formTemplates,
      formSubmissions,
      strategicObjectives,
      strategicObjectiveLinks,
      orgEmployees,
      activities,
    };
    return {
      node,
      relationships,
      total: Object.values(relationships).reduce((sum, value) => sum + value, 0),
    };
  }

  async remove(id: string, companyId: string, actorId?: string | null) {
    const impact = await this.removalImpact(id, companyId);
    if (impact.total > 0) {
      await this.audit(companyId, actorId ?? null, 'DELETE_BLOCKED', 'OrgNode', id, null, impact.relationships, impact.node.name, 'BLOCKED');
      throw new ConflictException({
        message: 'Estrutura em uso nao pode ser excluida. Realoque ou desvincule os itens informados antes da exclusao.',
        relationships: impact.relationships,
      });
    }
    const updated = await this.prisma.orgNode.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    await this.audit(companyId, actorId ?? null, 'DELETE', 'OrgNode', id, impact.node, updated, impact.node.name);
    return updated;
  }

  async createActivity(me: AuthPayload, orgNodeId: string, body: ActivityInput) {
    await this.assertCanMaintainActivities(me, orgNodeId);
    const title = this.cleanRequired(body.title, 'Titulo');
    const orderIndex = await this.nextActivityOrder(me.companyId, orgNodeId, body.orderIndex);
    await this.assertActivityTitleAvailable(me.companyId, orgNodeId, title);

    const created = await this.prisma.organizationalUnitActivity.create({
      data: {
        companyId: me.companyId,
        organizationalUnitId: orgNodeId,
        title,
        description: this.cleanOptional(body.description),
        orderIndex,
        isActive: body.isActive ?? true,
        createdById: me.sub,
        updatedById: me.sub,
        items: body.items?.length
          ? {
              create: body.items.map((item, index) => ({
                description: this.cleanRequired(item.description, 'Topico'),
                orderIndex: item.orderIndex ?? index + 1,
                isActive: item.isActive ?? true,
                createdById: me.sub,
                updatedById: me.sub,
              })),
            }
          : undefined,
      },
      include: { items: { where: { deletedAt: null }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }] } },
    });
    await this.audit(me.companyId, me.sub, 'ACTIVITY_CREATE', 'OrganizationalUnitActivity', created.id, null, created, created.title);
    return created;
  }

  async updateActivity(me: AuthPayload, orgNodeId: string, activityId: string, body: ActivityInput) {
    await this.assertCanMaintainActivities(me, orgNodeId);
    const before = await this.getActivity(me.companyId, orgNodeId, activityId);
    const nextTitle = body.title === undefined ? before.title : this.cleanRequired(body.title, 'Titulo');
    if (nextTitle !== before.title) {
      await this.assertActivityTitleAvailable(me.companyId, orgNodeId, nextTitle, activityId);
    }
    const updated = await this.prisma.organizationalUnitActivity.update({
      where: { id: activityId },
      data: {
        title: nextTitle,
        description: body.description === undefined ? before.description : this.cleanOptional(body.description),
        orderIndex: body.orderIndex ?? before.orderIndex,
        isActive: body.isActive ?? before.isActive,
        updatedById: me.sub,
      },
      include: { items: { where: { deletedAt: null }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }] } },
    });
    await this.audit(me.companyId, me.sub, 'ACTIVITY_UPDATE', 'OrganizationalUnitActivity', activityId, before, updated, updated.title);
    return updated;
  }

  async removeActivity(me: AuthPayload, orgNodeId: string, activityId: string) {
    await this.assertCanMaintainActivities(me, orgNodeId);
    const before = await this.getActivity(me.companyId, orgNodeId, activityId);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.organizationalUnitActivityItem.updateMany({
        where: { activityId, deletedAt: null },
        data: { deletedAt: now, isActive: false, updatedById: me.sub },
      });
      return tx.organizationalUnitActivity.update({
        where: { id: activityId },
        data: { deletedAt: now, isActive: false, updatedById: me.sub },
      });
    });
    await this.audit(me.companyId, me.sub, 'ACTIVITY_DELETE', 'OrganizationalUnitActivity', activityId, before, updated, before.title);
    return updated;
  }

  async createActivityItem(me: AuthPayload, orgNodeId: string, activityId: string, body: ActivityItemInput) {
    await this.assertCanMaintainActivities(me, orgNodeId);
    await this.getActivity(me.companyId, orgNodeId, activityId);
    const description = this.cleanRequired(body.description, 'Topico');
    await this.assertActivityItemAvailable(activityId, description);
    const orderIndex = await this.nextActivityItemOrder(activityId, body.orderIndex);
    const created = await this.prisma.organizationalUnitActivityItem.create({
      data: {
        activityId,
        description,
        orderIndex,
        isActive: body.isActive ?? true,
        createdById: me.sub,
        updatedById: me.sub,
      },
    });
    await this.audit(me.companyId, me.sub, 'ACTIVITY_ITEM_CREATE', 'OrganizationalUnitActivityItem', created.id, null, created, description);
    return created;
  }

  async updateActivityItem(me: AuthPayload, orgNodeId: string, activityId: string, itemId: string, body: ActivityItemInput) {
    await this.assertCanMaintainActivities(me, orgNodeId);
    await this.getActivity(me.companyId, orgNodeId, activityId);
    const before = await this.getActivityItem(activityId, itemId);
    const nextDescription = body.description === undefined ? before.description : this.cleanRequired(body.description, 'Topico');
    if (nextDescription !== before.description) {
      await this.assertActivityItemAvailable(activityId, nextDescription, itemId);
    }
    const updated = await this.prisma.organizationalUnitActivityItem.update({
      where: { id: itemId },
      data: {
        description: nextDescription,
        orderIndex: body.orderIndex ?? before.orderIndex,
        isActive: body.isActive ?? before.isActive,
        updatedById: me.sub,
      },
    });
    await this.audit(me.companyId, me.sub, 'ACTIVITY_ITEM_UPDATE', 'OrganizationalUnitActivityItem', itemId, before, updated, nextDescription);
    return updated;
  }

  async removeActivityItem(me: AuthPayload, orgNodeId: string, activityId: string, itemId: string) {
    await this.assertCanMaintainActivities(me, orgNodeId);
    await this.getActivity(me.companyId, orgNodeId, activityId);
    const before = await this.getActivityItem(activityId, itemId);
    const updated = await this.prisma.organizationalUnitActivityItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date(), isActive: false, updatedById: me.sub },
    });
    await this.audit(me.companyId, me.sub, 'ACTIVITY_ITEM_DELETE', 'OrganizationalUnitActivityItem', itemId, before, updated, before.description);
    return updated;
  }

  private async validateOrgLinks(companyId: string, input: Partial<OrgNodeAdminInput>, currentId?: string) {
    if (input.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: input.branchId, companyId, deletedAt: null }, select: { id: true } });
      if (!branch) throw new NotFoundException('Filial nao encontrada para a empresa informada');
    }
    if (input.parentId) {
      if (input.parentId === currentId) throw new ConflictException('Um no nao pode ser pai dele mesmo');
      const parent = await this.prisma.orgNode.findFirst({ where: { id: input.parentId, companyId, deletedAt: null }, select: { id: true } });
      if (!parent) throw new NotFoundException('No pai nao encontrado para a empresa informada');
    }
    if (input.responsibleUserId) {
      const user = await this.prisma.user.findFirst({ where: { id: input.responsibleUserId, companyId, deletedAt: null }, select: { id: true } });
      if (!user) throw new NotFoundException('Responsavel nao encontrado para a empresa informada');
    }
  }

  private async assertCanMaintainActivities(me: AuthPayload, orgNodeId: string) {
    await this.assertOrgNodeInCompany(me.companyId, orgNodeId);
    await this.access.assertCanWrite(me.sub, orgNodeId, MODULE, 'edit');
  }

  private async assertOrgNodeInCompany(companyId: string, id: string) {
    const exists = await this.prisma.orgNode.count({ where: { id, companyId, deletedAt: null } });
    if (!exists) throw new NotFoundException('No organizacional nao encontrado para a empresa informada');
  }

  private async assertNameAvailable(companyId: string, name: string, parentId: string | null, ignoreId?: string) {
    const duplicate = await this.prisma.orgNode.findFirst({
      where: {
        companyId,
        parentId,
        deletedAt: null,
        name: { equals: name, mode: Prisma.QueryMode.insensitive },
        id: ignoreId ? { not: ignoreId } : undefined,
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Ja existe item organizacional com este nome no mesmo nivel.');
  }

  private async assertNoHierarchyCycle(companyId: string, nodeId: string, parentId: string | null) {
    if (!parentId) return;
    let cursor: string | null = parentId;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor === nodeId) throw new ConflictException('A hierarquia selecionada criaria um ciclo.');
      if (visited.has(cursor)) throw new ConflictException('Hierarquia invalida com ciclo existente.');
      visited.add(cursor);
      const parent: { parentId: string | null } | null = await this.prisma.orgNode.findFirst({
        where: { id: cursor, companyId, deletedAt: null },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }

  private async getActivity(companyId: string, orgNodeId: string, activityId: string) {
    const activity = await this.prisma.organizationalUnitActivity.findFirst({
      where: { id: activityId, companyId, organizationalUnitId: orgNodeId, deletedAt: null },
      include: { items: { where: { deletedAt: null }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!activity) throw new NotFoundException('Atividade nao encontrada para esta unidade organizacional');
    return activity;
  }

  private async getActivityItem(activityId: string, itemId: string) {
    const item = await this.prisma.organizationalUnitActivityItem.findFirst({
      where: { id: itemId, activityId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Topico nao encontrado para esta atividade');
    return item;
  }

  private async assertActivityTitleAvailable(companyId: string, orgNodeId: string, title: string, ignoreId?: string) {
    const duplicate = await this.prisma.organizationalUnitActivity.findFirst({
      where: {
        companyId,
        organizationalUnitId: orgNodeId,
        deletedAt: null,
        title: { equals: title, mode: Prisma.QueryMode.insensitive },
        id: ignoreId ? { not: ignoreId } : undefined,
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Ja existe bloco de atividade com este titulo nesta unidade.');
  }

  private async assertActivityItemAvailable(activityId: string, description: string, ignoreId?: string) {
    const duplicate = await this.prisma.organizationalUnitActivityItem.findFirst({
      where: {
        activityId,
        deletedAt: null,
        description: { equals: description, mode: Prisma.QueryMode.insensitive },
        id: ignoreId ? { not: ignoreId } : undefined,
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Ja existe topico com esta descricao no bloco.');
  }

  private async nextActivityOrder(companyId: string, orgNodeId: string, requested?: number) {
    if (requested !== undefined && Number.isFinite(requested)) return Math.max(0, Math.trunc(requested));
    const max = await this.prisma.organizationalUnitActivity.aggregate({
      where: { companyId, organizationalUnitId: orgNodeId, deletedAt: null },
      _max: { orderIndex: true },
    });
    return (max._max.orderIndex ?? 0) + 1;
  }

  private async nextActivityItemOrder(activityId: string, requested?: number) {
    if (requested !== undefined && Number.isFinite(requested)) return Math.max(0, Math.trunc(requested));
    const max = await this.prisma.organizationalUnitActivityItem.aggregate({
      where: { activityId, deletedAt: null },
      _max: { orderIndex: true },
    });
    return (max._max.orderIndex ?? 0) + 1;
  }

  private buildBreadcrumb(nodeId: string, nodes: Array<{ id: string; parentId: string | null; name: string; type: string }>, companyName: string) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const trail: Array<{ id: string; name: string; type: string }> = [];
    let cursor = byId.get(nodeId);
    const visited = new Set<string>();
    while (cursor && !visited.has(cursor.id)) {
      trail.unshift({ id: cursor.id, name: cursor.name, type: cursor.type });
      visited.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    if (trail[0]?.name !== companyName) {
      return [{ id: null, name: companyName, type: 'COMPANY' }, ...trail];
    }
    return trail;
  }

  private cleanRequired(value: unknown, label: string) {
    const cleaned = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    if (!cleaned) throw new BadRequestException(`${label} e obrigatorio.`);
    return cleaned;
  }

  private cleanOptional(value: unknown) {
    if (value === null || value === undefined) return null;
    const cleaned = String(value).trim();
    return cleaned ? cleaned : null;
  }

  private assertAllowedOrgNodeName(name: string) {
    const normalized = normalizeText(name);
    if (normalized === 'area nao classificada') {
      throw new ConflictException('A area provisoria "Area nao classificada" nao pode ser criada na Arvore Organizacional.');
    }
  }

  private async audit(
    companyId: string | null,
    userId: string | null,
    action: string,
    entity: string,
    entityId: string,
    beforeValue: unknown,
    afterValue: unknown,
    recordLabel?: string | null,
    result = 'SUCCESS',
  ) {
    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action,
        module: MODULE,
        entity,
        entityId,
        recordLabel: recordLabel ?? null,
        beforeValue: beforeValue === null || beforeValue === undefined ? null : JSON.stringify(beforeValue),
        afterValue: afterValue === null || afterValue === undefined ? null : JSON.stringify(afterValue),
        result,
      },
    });
  }
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
