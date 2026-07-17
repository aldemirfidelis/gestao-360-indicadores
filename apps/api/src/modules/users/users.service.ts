import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UserCreateInput } from '@g360/shared';
import { Prisma, UserAccessStatus, UserRoleEnum } from '@prisma/client';
import { DEFAULT_PROFILES, PERMISSION_CATALOG } from './permission-catalog';

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

  async accessContext(companyId: string) {
    await this.ensurePermissionCatalog();
    await this.ensureCompanyProfiles(companyId);
    const [branches, profiles] = await Promise.all([
      this.prisma.branch.findMany({
        where: { companyId, deletedAt: null },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.accessProfile.findMany({
        where: { OR: [{ companyId }, { companyId: null }], deletedAt: null },
        select: {
          id: true,
          companyId: true,
          code: true,
          name: true,
          description: true,
          role: true,
          permissions: {
            select: {
              permission: {
                select: { id: true, key: true, description: true, module: true, action: true },
              },
            },
          },
        },
        orderBy: [{ system: 'desc' }, { name: 'asc' }],
      }),
    ]);
    return { branches, profiles };
  }

  /** Garante os perfis de sistema da empresa e devolve o id do perfil pelo código. */
  async ensureAndGetProfileId(companyId: string, code: string): Promise<string | null> {
    await this.ensureCompanyProfiles(companyId);
    const profile = await this.prisma.accessProfile.findFirst({
      where: { companyId, code, deletedAt: null },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  /** Papel base de um perfil de acesso da empresa (ou global). */
  async getProfileRole(companyId: string, profileId: string): Promise<UserRoleEnum | null> {
    const profile = await this.prisma.accessProfile.findFirst({
      where: { id: profileId, OR: [{ companyId }, { companyId: null }], deletedAt: null },
      select: { role: true },
    });
    return (profile?.role as UserRoleEnum) ?? null;
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
    await this.validateUserLinks(input.companyId, input, input.role, !actorIsSuperAdmin);
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
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null, companyId }, select: { id: true, role: true } });
    if (!user) throw new NotFoundException('Usuário nao encontrado');
    if (!isSuperAdmin && user.role === UserRoleEnum.SUPER_ADMIN) {
      throw new ForbiddenException('Somente um Super Admin pode alterar outro Super Admin.');
    }
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
    await this.validateUserLinks(user.companyId, input, input.role ?? user.role, !isSuperAdmin);

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
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null, companyId }, select: { id: true, role: true } });
    if (!user) throw new NotFoundException('Usuário nao encontrado');
    if (!isSuperAdmin && user.role === UserRoleEnum.SUPER_ADMIN) {
      throw new ForbiddenException('Somente um Super Admin pode alterar outro Super Admin.');
    }
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
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null, companyId }, select: { id: true, role: true } });
    if (!user) throw new NotFoundException('Usuário nao encontrado');
    if (!isSuperAdmin && user.role === UserRoleEnum.SUPER_ADMIN) {
      throw new ForbiddenException('Somente um Super Admin pode alterar outro Super Admin.');
    }
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

  private async ensureCompanyProfiles(companyId: string) {
    const defaults = DEFAULT_PROFILES.filter((profile) => profile.role !== UserRoleEnum.SUPER_ADMIN);
    const existing = await this.prisma.accessProfile.findMany({
      where: { companyId, code: { in: defaults.map((profile) => profile.code) }, deletedAt: null },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((profile) => profile.code));
    const missing = defaults.filter((profile) => !existingCodes.has(profile.code));

    if (missing.length > 0) {
      await this.prisma.accessProfile.createMany({
        data: missing.map((profile) => ({
          companyId,
          code: profile.code,
          name: profile.name,
          description: profile.description,
          role: profile.role as UserRoleEnum,
          system: true,
        })),
        skipDuplicates: true,
      });
    }

    // Reconciliação ADITIVA dos perfis de sistema com o catálogo: garante que
    // perfis já provisionados (empresas antigas) recebam permissões novas
    // adicionadas ao DEFAULT_PROFILES. Só insere o que falta (skipDuplicates) e
    // nunca remove — grants extras que o admin adicionou continuam intactos.
    const [profiles, permissions] = await Promise.all([
      this.prisma.accessProfile.findMany({
        where: { companyId, code: { in: defaults.map((profile) => profile.code) }, system: true, deletedAt: null },
        select: { id: true, code: true, permissions: { select: { permissionId: true } } },
      }),
      this.prisma.permission.findMany({ select: { id: true, key: true } }),
    ]);
    const profileByCode = new Map(profiles.map((profile) => [profile.code, profile]));
    const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));
    const entries = defaults.flatMap((profile) => {
      const current = profileByCode.get(profile.code);
      if (!current) return [];
      const already = new Set(current.permissions.map((item) => item.permissionId));
      return profile.permissions.flatMap((key) => {
        const permissionId = permissionByKey.get(key);
        return permissionId && !already.has(permissionId) ? [{ profileId: current.id, permissionId }] : [];
      });
    });
    if (entries.length > 0) {
      await this.prisma.profilePermission.createMany({ data: entries, skipDuplicates: true });
    }
  }

  private async validateUserLinks(
    companyId: string,
    input: { branchId?: string | null; accessProfileId?: string | null; defaultNodeId?: string | null },
    role?: UserRoleEnum,
    enforceProfileRole = false,
  ) {
    if (input.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: input.branchId, companyId, deletedAt: null }, select: { id: true } });
      if (!branch) throw new NotFoundException('Filial nao encontrada para a empresa informada');
    }
    if (input.accessProfileId) {
      const profile = await this.prisma.accessProfile.findFirst({
        where: { id: input.accessProfileId, OR: [{ companyId }, { companyId: null }], deletedAt: null },
        select: { id: true, role: true },
      });
      if (!profile) throw new NotFoundException('Perfil de acesso nao encontrado para a empresa informada');
      if (enforceProfileRole && profile.role && role && profile.role !== role) {
        throw new BadRequestException('O papel do usuário deve ser o mesmo papel base definido no perfil de acesso.');
      }
    }
    if (input.defaultNodeId) {
      const node = await this.prisma.orgNode.findFirst({ where: { id: input.defaultNodeId, companyId, deletedAt: null }, select: { id: true } });
      if (!node) throw new NotFoundException('Estrutura organizacional nao encontrada para a empresa informada');
    }
  }
}
