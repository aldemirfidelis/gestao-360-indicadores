import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Surface (somente leitura) do RBAC existente para a aba Perfis/Permissões.
 * A edição reusa os endpoints já existentes em /admin/security (Configurações > Segurança).
 */
@Injectable()
export class PermissionViewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [profiles, permissions, roleCounts] = await Promise.all([
      this.prisma.accessProfile.findMany({
        where: { deletedAt: null },
        select: { id: true, code: true, name: true, role: true, status: true, system: true, _count: { select: { users: true, permissions: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] }),
      this.prisma.user.groupBy({ by: ['role'], where: { deletedAt: null }, _count: { _all: true } }),
    ]);
    const byModule = new Map<string, number>();
    for (const p of permissions) byModule.set(p.module, (byModule.get(p.module) ?? 0) + 1);
    return {
      profiles,
      permissionModules: Array.from(byModule.entries()).map(([module, count]) => ({ module, count })),
      totalPermissions: permissions.length,
      usersByRole: roleCounts.map((r) => ({ role: r.role, count: r._count._all })),
      note: 'A edição de perfis/permissões é feita em Configurações > Segurança (RBAC existente).',
    };
  }
}
