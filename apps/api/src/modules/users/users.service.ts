import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UserCreateInput } from '@g360/shared';
import { Prisma, UserAccessStatus, UserRoleEnum } from '@prisma/client';
import { PERMISSION_CATALOG } from './permission-catalog';

type UserAdminCreateInput = UserCreateInput & {
  branchId?: string | null;
  accessProfileId?: string | null;
  status?: UserAccessStatus;
  active?: boolean;
  passwordResetRequired?: boolean;
};

@Injectable()
export class UsersService {
  private permissionsReady = false;

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
        status: true,
        jobTitle: true,
        phone: true,
        avatarUrl: true,
        active: true,
        lastLoginAt: true,
        passwordResetRequired: true,
        branch: { select: { id: true, name: true, code: true } },
        accessProfile: { select: { id: true, code: true, name: true } },
        defaultNode: { select: { id: true, name: true } },
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
  }

  async getById(id: string, companyId?: string, isSuperAdmin = false) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, ...(companyId ? { companyId } : {}) },
      include: {
        defaultNode: true,
        permissions: { select: { permission: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuário nao encontrado');
    return user;
  }

  async listPermissions() {
    await this.ensurePermissionCatalog();
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }, { key: 'asc' }],
    });
  }

  async create(input: UserAdminCreateInput, actorIsSuperAdmin = false) {
    // Anti-escalonamento de privilegio: apenas SUPER_ADMIN pode criar SUPER_ADMIN.
    if (input.role === UserRoleEnum.SUPER_ADMIN && !actorIsSuperAdmin) {
      throw new ForbiddenException('Somente um Super Admin pode atribuir o papel SUPER_ADMIN.');
    }
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ConflictException('Email ja cadastrado');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
    const hash = await bcrypt.hash(input.password, rounds);
    const status = input.status ?? UserAccessStatus.ACTIVE;
    await this.validateUserLinks(input.companyId, input);
    return this.prisma.user.create({
      data: {
        companyId: input.companyId,
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: hash,
        role: input.role,
        status,
        active: input.active ?? status === UserAccessStatus.ACTIVE,
        branchId: input.branchId ?? null,
        accessProfileId: input.accessProfileId ?? null,
        passwordResetRequired: input.passwordResetRequired ?? false,
        jobTitle: input.jobTitle ?? null,
        phone: input.phone ?? null,
        defaultNodeId: input.defaultNodeId ?? null,
      },
    });
  }

  async setActive(id: string, companyId: string, isSuperAdmin: boolean, active: boolean) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null, companyId }, select: { id: true } });
    if (!user) throw new NotFoundException('Usuário nao encontrado');
    return this.prisma.user.update({
      where: { id },
      data: { active, status: active ? UserAccessStatus.ACTIVE : UserAccessStatus.INACTIVE },
    });
  }

  async update(
    id: string,
    companyId: string,
    isSuperAdmin: boolean,
    input: {
      email?: string;
      name?: string;
      role?: UserRoleEnum;
      jobTitle?: string | null;
      phone?: string | null;
      defaultNodeId?: string | null;
      active?: boolean;
      status?: UserAccessStatus;
      password?: string;
      branchId?: string | null;
      accessProfileId?: string | null;
      passwordResetRequired?: boolean;
    },
  ) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null, companyId } });
    if (!user) throw new NotFoundException('Usuário nao encontrado');
    // Anti-escalonamento: nao-super-admin nao pode promover ninguem (nem a si) a SUPER_ADMIN,
    // nem rebaixar um SUPER_ADMIN existente.
    if (!isSuperAdmin && (input.role === UserRoleEnum.SUPER_ADMIN || user.role === UserRoleEnum.SUPER_ADMIN)) {
      throw new ForbiddenException('Somente um Super Admin pode gerenciar o papel SUPER_ADMIN.');
    }
    await this.validateUserLinks(user.companyId, input);

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
      active: input.active ?? (input.status ? input.status === UserAccessStatus.ACTIVE : undefined),
      status: input.status ?? (input.active === undefined ? undefined : input.active ? UserAccessStatus.ACTIVE : UserAccessStatus.INACTIVE),
      passwordResetRequired: input.passwordResetRequired,
      branch: input.branchId === undefined
        ? undefined
        : input.branchId
          ? { connect: { id: input.branchId } }
          : { disconnect: true },
      accessProfile: input.accessProfileId === undefined
        ? undefined
        : input.accessProfileId
          ? { connect: { id: input.accessProfileId } }
          : { disconnect: true },
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

  async setPermissions(id: string, companyId: string, isSuperAdmin: boolean, permissionKeys: string[]) {
    await this.ensurePermissionCatalog();
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null, companyId }, select: { id: true } });
    if (!user) throw new NotFoundException('Usuário nao encontrado');
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

    return this.getById(id, companyId, isSuperAdmin);
  }

  async remove(id: string, companyId: string, isSuperAdmin: boolean) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null, companyId }, select: { id: true } });
    if (!user) throw new NotFoundException('Usuário nao encontrado');
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), active: false, status: UserAccessStatus.INACTIVE },
    });
  }

  private async ensurePermissionCatalog() {
    if (this.permissionsReady) return;
    const keys = PERMISSION_CATALOG.map(([key]) => key);
    const existing = await this.prisma.permission.findMany({ where: { key: { in: keys } }, select: { key: true } });
    const existingKeys = new Set(existing.map((permission) => permission.key));
    const missing = PERMISSION_CATALOG.filter(([key]) => !existingKeys.has(key));
    if (missing.length > 0) {
      await this.prisma.permission.createMany({
        data: missing.map(([key, description, module, action]) => ({ key, description, module, action })),
        skipDuplicates: true,
      });
    }
    this.permissionsReady = true;
  }

  private async validateUserLinks(
    companyId: string,
    input: { branchId?: string | null; accessProfileId?: string | null; defaultNodeId?: string | null },
  ) {
    if (input.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: input.branchId, companyId, deletedAt: null }, select: { id: true } });
      if (!branch) throw new NotFoundException('Filial nao encontrada para a empresa informada');
    }
    if (input.accessProfileId) {
      const profile = await this.prisma.accessProfile.findFirst({
        where: { id: input.accessProfileId, OR: [{ companyId }, { companyId: null }], deletedAt: null },
        select: { id: true },
      });
      if (!profile) throw new NotFoundException('Perfil de acesso nao encontrado para a empresa informada');
    }
    if (input.defaultNodeId) {
      const node = await this.prisma.orgNode.findFirst({ where: { id: input.defaultNodeId, companyId, deletedAt: null }, select: { id: true } });
      if (!node) throw new NotFoundException('Estrutura organizacional nao encontrada para a empresa informada');
    }
  }
}
