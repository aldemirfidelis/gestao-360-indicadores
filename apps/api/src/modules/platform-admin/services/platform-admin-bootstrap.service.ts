import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { PLATFORM_PERMISSIONS, PLATFORM_ROLES } from '../platform-admin.catalog';

/**
 * Bootstrap idempotente do Portal Admin Global.
 *
 * O `seed.ts` cria permissoes/papeis/usuario interno apenas em desenvolvimento
 * (e e destrutivo). Em producao o deploy roda somente `prisma migrate deploy`,
 * o que deixaria as tabelas internas vazias e o login separado inacessivel.
 *
 * Este servico roda no boot da API e garante, de forma segura e idempotente:
 *  - o catalogo de permissoes internas;
 *  - os papeis de sistema (somente quando ainda nao existem);
 *  - um usuario PLATFORM_OWNER inicial quando nao houver nenhum usuario interno.
 *
 * As credenciais iniciais vem de variaveis de ambiente; sem senha definida,
 * uma senha forte e gerada e registrada uma unica vez no log do boot.
 */
@Injectable()
export class PlatformAdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger('PlatformAdminBootstrap');

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.PLATFORM_ADMIN_BOOTSTRAP_DISABLED === '1') return;
    try {
      await this.ensurePermissions();
      await this.ensureRoles();
      await this.ensureOwner();
    } catch (err) {
      // Nunca derruba a API por causa do bootstrap (ex.: tabelas ainda nao
      // migradas). O deploy roda `migrate deploy` antes do start, mas mantemos
      // a tolerancia para ordens de inicializacao atipicas.
      this.logger.error(`Bootstrap do Portal Admin Global ignorado: ${(err as Error).message}`);
    }
  }

  /** Catalogo de permissoes internas (reference data) — sempre reconciliado. */
  private async ensurePermissions(): Promise<void> {
    await this.prisma.platformAdminPermission.createMany({
      data: PLATFORM_PERMISSIONS.map(([key, description, group, action]) => ({ key, description, group, action })),
      skipDuplicates: true,
    });
  }

  /**
   * Papeis de sistema. So cria os que ainda nao existem para preservar
   * eventuais customizacoes feitas pela administracao.
   */
  private async ensureRoles(): Promise<void> {
    const permissions = await this.prisma.platformAdminPermission.findMany({ select: { id: true, key: true } });
    const idByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));

    for (const role of PLATFORM_ROLES) {
      const existing = await this.prisma.platformAdminRole.findUnique({ where: { code: role.code } });
      if (existing) continue;
      const created = await this.prisma.platformAdminRole.create({
        data: { code: role.code, name: role.name, description: role.description, system: true },
      });
      const links = role.permissions
        .map((key) => idByKey.get(key))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: created.id, permissionId }));
      if (links.length > 0) {
        await this.prisma.platformAdminRolePermission.createMany({ data: links, skipDuplicates: true });
      }
    }
  }

  /** Cria o primeiro PLATFORM_OWNER quando nao existe nenhum usuario interno. */
  private async ensureOwner(): Promise<void> {
    const email = (process.env.PLATFORM_ADMIN_BOOTSTRAP_EMAIL ?? 'platform@gestao360.org').trim().toLowerCase();
    const name = process.env.PLATFORM_ADMIN_BOOTSTRAP_NAME ?? 'Platform Owner';
    const provided = process.env.PLATFORM_ADMIN_BOOTSTRAP_PASSWORD;
    const generated = !provided || provided.trim() === '';
    const password = generated ? randomBytes(12).toString('base64url') : provided;
    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10) || 10;

    const ownerRole = await this.prisma.platformAdminRole.findUnique({ where: { code: 'PLATFORM_OWNER' } });
    if (!ownerRole) {
      this.logger.error('Papel PLATFORM_OWNER ausente; usuario inicial nao foi criado.');
      return;
    }

    const count = await this.prisma.platformAdminUser.count();
    if (count > 0) {
      if (!generated) {
        await this.promoteDemoOwnerIfNeeded({ email, name, password, rounds, ownerRoleId: ownerRole.id, userCount: count });
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, rounds);

    const owner = await this.prisma.platformAdminUser.create({
      data: { email, name, passwordHash, status: 'ACTIVE', passwordResetRequired: generated },
    });
    await this.prisma.platformAdminUserRole.create({ data: { userId: owner.id, roleId: ownerRole.id } });

    if (generated) {
      this.logger.warn(
        `[Portal Admin Global] Usuario inicial criado: ${email} | senha temporaria: ${password} ` +
          '(defina PLATFORM_ADMIN_BOOTSTRAP_PASSWORD e troque apos o primeiro acesso)',
      );
    } else {
      this.logger.log(`[Portal Admin Global] Usuario inicial criado: ${email}`);
    }
  }

  private async promoteDemoOwnerIfNeeded(params: {
    email: string;
    name: string;
    password: string;
    rounds: number;
    ownerRoleId: string;
    userCount: number;
  }): Promise<void> {
    const demoEmail = 'platform@demo.com';
    if (params.email === demoEmail || params.userCount !== 1) return;

    const demoOwner = await this.prisma.platformAdminUser.findUnique({ where: { email: demoEmail } });
    if (!demoOwner) return;

    const desiredOwner = await this.prisma.platformAdminUser.findUnique({ where: { email: params.email } });
    if (desiredOwner) return;

    const passwordHash = await bcrypt.hash(params.password, params.rounds);
    await this.prisma.platformAdminUser.update({
      where: { id: demoOwner.id },
      data: {
        email: params.email,
        name: params.name,
        passwordHash,
        status: 'ACTIVE',
        passwordResetRequired: false,
        deletedAt: null,
      },
    });
    await this.prisma.platformAdminUserRole.upsert({
      where: { userId_roleId: { userId: demoOwner.id, roleId: params.ownerRoleId } },
      create: { userId: demoOwner.id, roleId: params.ownerRoleId },
      update: {},
    });
    this.logger.warn(`[Portal Admin Global] Usuario demo promovido para credencial bootstrap configurada: ${params.email}`);
  }
}
