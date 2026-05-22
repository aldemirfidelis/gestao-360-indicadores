import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgNodeCreateInput } from '@g360/shared';

type OrgNodeAdminInput = OrgNodeCreateInput & {
  branchId?: string | null;
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

@Injectable()
export class OrgNodesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async tree(companyId: string): Promise<OrgTreeNode[]> {
    const flat = await this.listFlat(companyId);
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

  async create(input: OrgNodeAdminInput, companyId: string, isSuperAdmin = false) {
    const scopedCompanyId = isSuperAdmin ? input.companyId : companyId;
    await this.validateOrgLinks(scopedCompanyId, input);
    return this.prisma.orgNode.create({
      data: {
        companyId: scopedCompanyId,
        branchId: input.branchId ?? null,
        parentId: input.parentId ?? null,
        name: input.name,
        code: input.code ?? null,
        type: input.type,
        responsibleUserId: input.responsibleUserId ?? null,
        description: input.description ?? null,
        color: input.color ?? null,
        icon: input.icon ?? null,
        active: input.active ?? true,
      },
    });
  }

  async update(id: string, input: Partial<OrgNodeAdminInput>, companyId: string, isSuperAdmin = false) {
    const node = await this.prisma.orgNode.findFirst({ where: { id, deletedAt: null, ...(!isSuperAdmin ? { companyId } : {}) } });
    if (!node) throw new NotFoundException('No nao encontrado');
    await this.validateOrgLinks(node.companyId, input, id);
    return this.prisma.orgNode.update({
      where: { id },
      data: {
        name: input.name ?? node.name,
        branchId: input.branchId === undefined ? node.branchId : input.branchId,
        code: input.code ?? node.code,
        type: input.type ?? node.type,
        responsibleUserId: input.responsibleUserId ?? node.responsibleUserId,
        description: input.description ?? node.description,
        color: input.color ?? node.color,
        icon: input.icon ?? node.icon,
        active: input.active ?? node.active,
        parentId: input.parentId === undefined ? node.parentId : input.parentId,
      },
    });
  }

  async move(id: string, companyId: string, isSuperAdmin: boolean, newParentId: string | null) {
    const node = await this.prisma.orgNode.findFirst({ where: { id, deletedAt: null, ...(!isSuperAdmin ? { companyId } : {}) }, select: { id: true, companyId: true } });
    if (!node) throw new NotFoundException('No nao encontrado');
    if (newParentId) {
      const parent = await this.prisma.orgNode.findFirst({ where: { id: newParentId, companyId: node.companyId, deletedAt: null }, select: { id: true } });
      if (!parent) throw new NotFoundException('No pai nao encontrado para a empresa informada');
    }
    return this.prisma.orgNode.update({
      where: { id },
      data: { parentId: newParentId },
    });
  }

  async remove(id: string, companyId: string, isSuperAdmin = false) {
    const node = await this.prisma.orgNode.findFirst({ where: { id, deletedAt: null, ...(!isSuperAdmin ? { companyId } : {}) }, select: { id: true } });
    if (!node) throw new NotFoundException('No nao encontrado');
    const [children, indicators, actions, users] = await Promise.all([
      this.prisma.orgNode.count({ where: { parentId: id, deletedAt: null } }),
      this.prisma.indicator.count({ where: { ownerNodeId: id, deletedAt: null } }),
      this.prisma.actionPlan.count({ where: { ownerNodeId: id, deletedAt: null } }),
      this.prisma.user.count({ where: { defaultNodeId: id, deletedAt: null } }),
    ]);
    if (children + indicators + actions + users > 0) {
      throw new ConflictException('Estrutura em uso nao pode ser excluida. Inative o cadastro ou remova os vinculos.');
    }
    return this.prisma.orgNode.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
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
}
