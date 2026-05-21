import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgNodeCreateInput } from '@g360/shared';

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

  async create(input: OrgNodeCreateInput) {
    return this.prisma.orgNode.create({
      data: {
        companyId: input.companyId,
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

  async update(id: string, input: Partial<OrgNodeCreateInput>) {
    const node = await this.prisma.orgNode.findUnique({ where: { id } });
    if (!node) throw new NotFoundException('No nao encontrado');
    return this.prisma.orgNode.update({
      where: { id },
      data: {
        name: input.name ?? node.name,
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

  async move(id: string, newParentId: string | null) {
    return this.prisma.orgNode.update({
      where: { id },
      data: { parentId: newParentId },
    });
  }

  async remove(id: string) {
    return this.prisma.orgNode.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }
}
