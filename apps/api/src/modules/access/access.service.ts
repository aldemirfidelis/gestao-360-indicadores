import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { effectiveCompanyId } from '../../common/effective-company';
import { swallow } from '../../common/logging/swallow';
import {
  AreaAction,
  AreaScope,
  ExceptionLite,
  ResolveInput,
  RuleLite,
  VisibilityLevelName,
  levelForArea,
  resolveAreaScope,
} from './access.logic';

export interface AccessContext {
  userId: string;
  companyId: string;
  role: string;
  companyWide: boolean;
  areaAccessEnabled: boolean;
  primaryAreaId: string | null;
  ownAreaIds: string[];
}

const COMPANY_WIDE_ROLES = new Set<string>([UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN]);
const CONTEXT_TTL_MS = 10_000;

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  private cache = new Map<string, { ctx: AccessContext; expires: number }>();

  /** Contexto de acesso do usuário (com cache curto para evitar N consultas por requisição). */
  async getContext(userId: string): Promise<AccessContext> {
    const cached = this.cache.get(userId);
    if (cached && cached.expires > Date.now()) return cached.ctx;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        companyId: true,
        activeCompanyId: true,
        role: true,
        defaultNodeId: true,
        company: { select: { areaAccessEnabled: true } },
      },
    });
    if (!user) throw new ForbiddenException('Usuário inválido.');

    // Empresa efetiva: Super Admin impersonando opera no contexto da empresa ativa.
    const companyId = effectiveCompanyId(user);

    const now = new Date();
    const assignments = await this.prisma.userAreaAssignment.findMany({
      where: { userId, companyId },
      select: { orgNodeId: true, validFrom: true, validUntil: true },
    });
    const activeAssignmentAreas = assignments
      .filter((a) => (!a.validFrom || a.validFrom <= now) && (!a.validUntil || a.validUntil >= now))
      .map((a) => a.orgNodeId);

    const ownAreaIds = Array.from(
      new Set([user.defaultNodeId, ...activeAssignmentAreas].filter((x): x is string => !!x)),
    );

    const ctx: AccessContext = {
      userId,
      companyId,
      role: user.role,
      companyWide: COMPANY_WIDE_ROLES.has(user.role),
      areaAccessEnabled: user.company?.areaAccessEnabled ?? true,
      primaryAreaId: user.defaultNodeId ?? null,
      ownAreaIds,
    };
    this.cache.set(userId, { ctx, expires: Date.now() + CONTEXT_TTL_MS });
    return ctx;
  }

  /** Áreas permitidas para (módulo, ação). 'ALL' = sem restrição (admins/flag off/diretor em leitura). */
  async permittedAreaIds(userId: string, moduleKey: string, action: AreaAction): Promise<AreaScope> {
    const ctx = await this.getContext(userId);
    if (ctx.companyWide || !ctx.areaAccessEnabled) return 'ALL';
    if (ctx.role === UserRoleEnum.DIRECTOR && (action === 'view' || action === 'export')) return 'ALL';

    const { rules, exceptions } = await this.loadRulesAndExceptions(ctx, moduleKey);
    const input: ResolveInput = {
      role: ctx.role,
      companyWide: ctx.companyWide,
      areaAccessEnabled: ctx.areaAccessEnabled,
      ownAreaIds: ctx.ownAreaIds,
      moduleKey,
      action,
      rules,
      exceptions,
    };
    return resolveAreaScope(input);
  }

  /** true se o usuário pode escrever na área (ação padrão 'edit'). */
  async canWriteArea(userId: string, areaId: string | null, moduleKey: string, action: AreaAction = 'edit'): Promise<boolean> {
    const scope = await this.permittedAreaIds(userId, moduleKey, action);
    if (scope === 'ALL') return true;
    if (!areaId) return false;
    return scope.includes(areaId);
  }

  async assertCanWrite(userId: string, areaId: string | null, moduleKey: string, action: AreaAction = 'edit'): Promise<void> {
    if (!(await this.canWriteArea(userId, areaId, moduleKey, action))) {
      await this.auditDenied(userId, moduleKey, action, areaId);
      throw new ForbiddenException('Você não tem permissão para alterar dados desta área.');
    }
  }

  /**
   * Filtro de área para LISTAGENS. Retorna null quando não há restrição ('ALL'),
   * ou o conjunto de áreas permitidas EXPANDIDO com descendentes (para que atribuir
   * o usuário a uma AREA cubra também seus setores/sub-áreas).
   * Uso: `where: { ...(filter ? { <areaField>: { in: filter } } : {}) }`.
   */
  async listAreaFilter(userId: string, moduleKey: string, action: AreaAction = 'view'): Promise<string[] | null> {
    const scope = await this.permittedAreaIds(userId, moduleKey, action);
    if (scope === 'ALL') return null;
    const ctx = await this.getContext(userId);
    return this.expandWithDescendants(ctx.companyId, scope);
  }

  /** Expande um conjunto de áreas incluindo todos os descendentes na árvore de OrgNode. */
  async expandWithDescendants(companyId: string, areaIds: string[]): Promise<string[]> {
    if (areaIds.length === 0) return [];
    const nodes = await this.prisma.orgNode.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    const children = new Map<string, string[]>();
    for (const n of nodes) {
      if (!n.parentId) continue;
      const list = children.get(n.parentId) ?? [];
      list.push(n.id);
      children.set(n.parentId, list);
    }
    const out = new Set<string>(areaIds);
    const queue = [...areaIds];
    while (queue.length) {
      const parent = queue.shift()!;
      for (const child of children.get(parent) ?? []) {
        if (out.has(child)) continue;
        out.add(child);
        queue.push(child);
      }
    }
    return Array.from(out);
  }

  /** Defesa em profundidade: garante que o registro pertence à empresa do usuário. */
  async assertSameCompany(userId: string, recordCompanyId: string): Promise<void> {
    const ctx = await this.getContext(userId);
    if (ctx.companyId !== recordCompanyId) {
      await this.auditDenied(userId, 'company', 'view', null, 'cross-company');
      throw new ForbiddenException('Recurso de outra empresa.');
    }
  }

  /** Registra uma tentativa de acesso negada na auditoria (best-effort). */
  private async auditDenied(userId: string, moduleKey: string, action: AreaAction | string, areaId: string | null, note?: string) {
    const ctx = this.cache.get(userId)?.ctx;
    await this.prisma.auditLog
      .create({
        data: {
          companyId: ctx?.companyId,
          userId,
          action: `DENIED_${String(action).toUpperCase()}`,
          module: moduleKey,
          entity: 'AreaAccess',
          entityId: areaId,
          result: 'DENIED',
          recordLabel: note ?? `Acesso negado a área ${areaId ?? '-'} (${moduleKey}/${action}).`,
        },
      })
      .catch(swallow(undefined, 'access.auditDenied', 'debug'));
  }

  /** Nível de visibilidade do usuário sobre uma área (para decidir projeção resumida). */
  async visibilityLevel(userId: string, moduleKey: string, areaId: string | null): Promise<VisibilityLevelName> {
    if (!areaId) return 'FULL';
    const ctx = await this.getContext(userId);
    const { rules, exceptions } = await this.loadRulesAndExceptions(ctx, moduleKey);
    return levelForArea(
      {
        role: ctx.role,
        companyWide: ctx.companyWide,
        areaAccessEnabled: ctx.areaAccessEnabled,
        ownAreaIds: ctx.ownAreaIds,
        moduleKey,
        rules,
        exceptions,
      },
      areaId,
    );
  }

  private async loadRulesAndExceptions(ctx: AccessContext, moduleKey: string): Promise<{ rules: RuleLite[]; exceptions: ExceptionLite[] }> {
    if (ctx.ownAreaIds.length === 0) {
      // Sem área de origem: só exceções podem conceder acesso.
    }
    const now = new Date();
    const [rawRules, rawExceptions] = await Promise.all([
      ctx.ownAreaIds.length
        ? this.prisma.areaVisibilityRule.findMany({
            where: {
              companyId: ctx.companyId,
              sourceAreaId: { in: ctx.ownAreaIds },
              OR: [{ moduleKey }, { moduleKey: '*' }],
            },
          })
        : Promise.resolve([]),
      this.prisma.userVisibilityException.findMany({
        where: { userId: ctx.userId, companyId: ctx.companyId, OR: [{ moduleKey }, { moduleKey: '*' }] },
      }),
    ]);

    const rules: RuleLite[] = rawRules.map((r) => ({
      sourceAreaId: r.sourceAreaId,
      targetAreaId: r.targetAreaId,
      moduleKey: r.moduleKey,
      visibilityLevel: r.visibilityLevel,
      canView: r.canView,
      canCreate: r.canCreate,
      canEdit: r.canEdit,
      canDelete: r.canDelete,
      canApprove: r.canApprove,
      canExport: r.canExport,
    }));
    const exceptions: ExceptionLite[] = rawExceptions
      .filter((e) => (!e.validFrom || e.validFrom <= now) && (!e.validUntil || e.validUntil >= now))
      .map((e) => ({ targetAreaId: e.targetAreaId, moduleKey: e.moduleKey, effect: e.effect }));

    return { rules, exceptions };
  }

  /** Invalida o cache de um usuário (após mudança de área/permissão). */
  invalidate(userId: string) {
    this.cache.delete(userId);
  }
}
