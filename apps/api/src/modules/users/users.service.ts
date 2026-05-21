import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UserCreateInput } from '@g360/shared';
import { Prisma, UserRoleEnum } from '@prisma/client';

const PERMISSION_CATALOG = [
  ['dashboard:view', 'Visualizar dashboards', 'Dashboard', 'view'],
  ['indicators:view', 'Visualizar indicadores', 'Indicadores', 'view'],
  ['indicators:create', 'Criar indicadores', 'Indicadores', 'create'],
  ['indicators:update', 'Editar indicadores', 'Indicadores', 'update'],
  ['results:launch', 'Lancar resultados', 'Lancamentos', 'create'],
  ['actions:manage', 'Gerenciar planos de acao', 'Planos de acao', 'manage'],
  ['deviations:manage', 'Gerenciar desvios e analises', 'Desvios', 'manage'],
  ['projects:manage', 'Gerenciar projetos', 'Projetos', 'manage'],
  ['strategy:manage', 'Gerenciar mapa estrategico', 'Estrategia', 'manage'],
  ['okrs:manage', 'Gerenciar OKRs', 'OKRs', 'manage'],
  ['org:manage', 'Gerenciar estrutura organizacional', 'Estrutura', 'manage'],
  ['reports:export', 'Exportar relatorios', 'Relatorios', 'export'],
  ['users:manage', 'Gerenciar usuarios e permissoes', 'Usuarios', 'manage'],
] as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        jobTitle: true,
        avatarUrl: true,
        active: true,
        lastLoginAt: true,
        defaultNode: { select: { id: true, name: true } },
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
  }

  async getById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        defaultNode: true,
        permissions: { select: { permission: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuario nao encontrado');
    return user;
  }

  async listPermissions() {
    await this.ensurePermissionCatalog();
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }, { key: 'asc' }],
    });
  }

  async create(input: UserCreateInput) {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ConflictException('Email ja cadastrado');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
    const hash = await bcrypt.hash(input.password, rounds);
    return this.prisma.user.create({
      data: {
        companyId: input.companyId,
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: hash,
        role: input.role,
        jobTitle: input.jobTitle ?? null,
        phone: input.phone ?? null,
        defaultNodeId: input.defaultNodeId ?? null,
      },
    });
  }

  async setActive(id: string, active: boolean) {
    return this.prisma.user.update({ where: { id }, data: { active } });
  }

  async update(
    id: string,
    input: {
      email?: string;
      name?: string;
      role?: UserRoleEnum;
      jobTitle?: string | null;
      phone?: string | null;
      defaultNodeId?: string | null;
      active?: boolean;
      password?: string;
    },
  ) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('Usuario nao encontrado');

    if (input.email && input.email.toLowerCase() !== user.email) {
      const exists = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
      if (exists) throw new ConflictException('Email ja cadastrado');
    }

    const data: Prisma.UserUpdateInput = {
      email: input.email ? input.email.toLowerCase() : undefined,
      name: input.name,
      role: input.role,
      jobTitle: input.jobTitle,
      phone: input.phone,
      active: input.active,
      defaultNode: input.defaultNodeId === undefined
        ? undefined
        : input.defaultNodeId
          ? { connect: { id: input.defaultNodeId } }
          : { disconnect: true },
    };

    if (input.password) {
      const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
      data.passwordHash = await bcrypt.hash(input.password, rounds);
    }

    return this.prisma.user.update({ where: { id }, data });
  }

  async setPermissions(id: string, permissionKeys: string[]) {
    await this.ensurePermissionCatalog();
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!user) throw new NotFoundException('Usuario nao encontrado');
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true },
    });

    await this.prisma.$transaction([
      this.prisma.userPermission.deleteMany({ where: { userId: id } }),
      ...permissions.map((permission) =>
        this.prisma.userPermission.create({
          data: { userId: id, permissionId: permission.id },
        }),
      ),
    ]);

    return this.getById(id);
  }

  async remove(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }

  private async ensurePermissionCatalog() {
    await Promise.all(
      PERMISSION_CATALOG.map(([key, description, module, action]) =>
        this.prisma.permission.upsert({
          where: { key },
          create: { key, description, module, action },
          update: { description, module, action },
        }),
      ),
    );
  }
}
