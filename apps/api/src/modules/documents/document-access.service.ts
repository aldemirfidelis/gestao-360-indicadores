import { ForbiddenException, Injectable } from '@nestjs/common';
import { DocumentConfidentiality, Prisma, UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';

const MODULE = 'documents';
const CACHE_TTL_MS = 10_000;

/** Campos mínimos de um documento para decidir quem pode vê-lo. */
export interface DocumentAccessTarget {
  id: string;
  companyId: string;
  confidentiality?: DocumentConfidentiality | string | null;
  ownerUserId?: string | null;
  createdById?: string | null;
  approverUserId?: string | null;
  orgNodeId?: string | null;
  indicatorId?: string | null;
  indicator?: { ownerNodeId?: string | null } | null;
}

/**
 * Regras de acesso do GED.
 *
 * - Interno: quem enxerga a área do documento (regra geral de áreas).
 * - Restrito e Confidencial: além da área, só responsável, autor, aprovador,
 *   participantes do fluxo e quem estiver autorizado (pessoa, grupo de acesso
 *   ou área). Gestores do GED (`doc:manage`) e administradores veem todos.
 * - Confidencial nunca é enviado para a IA (`forAi`).
 */
@Injectable()
export class DocumentAccessService {
  private readonly cache = new Map<string, { keys: Set<string>; groups: string[]; ancestors: string[]; expires: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private async context(userId: string) {
    const cached = this.cache.get(userId);
    if (cached && cached.expires > Date.now()) return cached;
    const [user, memberships, accessCtx] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          permissions: { select: { permission: { select: { key: true } } } },
          accessProfile: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
        },
      }),
      this.prisma.documentAccessGroupUser.findMany({ where: { userId }, select: { groupId: true } }),
      this.access.getContext(userId),
    ]);
    const keys = new Set<string>();
    user?.permissions.forEach((item) => keys.add(item.permission.key));
    user?.accessProfile?.permissions.forEach((item) => keys.add(item.permission.key));
    const groupIds = memberships.map((item) => item.groupId);
    const groups = groupIds.length
      ? (await this.prisma.documentAccessGroup.findMany({
          where: { id: { in: groupIds }, companyId: accessCtx.companyId, active: true, deletedAt: null },
          select: { id: true },
        })).map((group) => group.id)
      : [];
    const ancestors = await this.ancestorsOf(accessCtx.companyId, accessCtx.ownAreaIds);
    const entry = { keys, groups, ancestors, expires: Date.now() + CACHE_TTL_MS };
    this.cache.set(userId, entry);
    return entry;
  }

  /** Áreas do usuário e todas as áreas acima delas (autorização por área cobre sub-áreas). */
  private async ancestorsOf(companyId: string, areaIds: string[]): Promise<string[]> {
    if (!areaIds.length) return [];
    const nodes = await this.prisma.orgNode.findMany({ where: { companyId, deletedAt: null }, select: { id: true, parentId: true } });
    const parent = new Map(nodes.map((node) => [node.id, node.parentId]));
    const out = new Set<string>();
    for (const start of areaIds) {
      let current: string | null | undefined = start;
      let guard = 0;
      while (current && !out.has(current) && guard++ < 64) {
        out.add(current);
        current = parent.get(current) ?? null;
      }
    }
    return [...out];
  }

  invalidate(userId?: string) {
    if (userId) this.cache.delete(userId);
    else this.cache.clear();
  }

  async permissionKeys(userId: string): Promise<Set<string>> {
    return (await this.context(userId)).keys;
  }

  /** Mesma semântica do guard: a permissão exata ou o curinga `doc:manage`. */
  async has(me: AuthPayload, key: string): Promise<boolean> {
    if (me.role === UserRoleEnum.SUPER_ADMIN) return true;
    const keys = await this.permissionKeys(me.sub);
    return keys.has(key) || keys.has('doc:manage');
  }

  async isManager(me: AuthPayload): Promise<boolean> {
    if (me.role === UserRoleEnum.SUPER_ADMIN || me.role === UserRoleEnum.COMPANY_ADMIN) return true;
    return (await this.permissionKeys(me.sub)).has('doc:manage');
  }

  async areaFilter(me: AuthPayload, action: AreaAction = 'view'): Promise<string[] | null> {
    return this.access.listAreaFilter(me.sub, MODULE, action);
  }

  /** Filtro Prisma de visibilidade: área + confidencialidade (+ exclusão da IA). */
  async visibilityWhere(me: AuthPayload, options: { forAi?: boolean } = {}): Promise<Prisma.DocumentWhereInput> {
    const [areas, manager, ctx] = await Promise.all([this.areaFilter(me), this.isManager(me), this.context(me.sub)]);
    const and: Prisma.DocumentWhereInput[] = [];
    if (areas) {
      and.push({
        OR: [
          { orgNodeId: null, indicatorId: null },
          { orgNodeId: { in: areas } },
          { indicator: { ownerNodeId: { in: areas } } },
        ],
      });
    }
    if (options.forAi) and.push({ confidentiality: { not: DocumentConfidentiality.CONFIDENTIAL } });
    if (!manager) {
      const grants: Prisma.DocumentPermissionWhereInput[] = [{ userId: me.sub }];
      if (ctx.groups.length) grants.push({ groupId: { in: ctx.groups } });
      if (ctx.ancestors.length) grants.push({ orgNodeId: { in: ctx.ancestors } });
      and.push({
        OR: [
          { confidentiality: DocumentConfidentiality.INTERNAL },
          { ownerUserId: me.sub },
          { createdById: me.sub },
          { approverUserId: me.sub },
          { workflowSteps: { some: { userId: me.sub } } },
          { permissions: { some: { allowed: true, OR: grants } } },
        ],
      });
    }
    return and.length ? { AND: and } : {};
  }

  /** true quando o usuário pode ver o documento (área + confidencialidade). */
  async canView(me: AuthPayload, doc: DocumentAccessTarget): Promise<boolean> {
    if (doc.companyId !== me.companyId) return false;
    const area = doc.orgNodeId ?? doc.indicator?.ownerNodeId ?? null;
    if (area) {
      const permitted = await this.areaFilter(me);
      if (permitted && !permitted.includes(area)) return false;
    }
    const level = (doc.confidentiality ?? DocumentConfidentiality.INTERNAL) as DocumentConfidentiality;
    if (level === DocumentConfidentiality.INTERNAL) return true;
    if (await this.isManager(me)) return true;
    if ([doc.ownerUserId, doc.createdById, doc.approverUserId].includes(me.sub)) return true;
    const ctx = await this.context(me.sub);
    const [step, grant] = await Promise.all([
      this.prisma.documentWorkflowStep.findFirst({ where: { documentId: doc.id, userId: me.sub }, select: { id: true } }),
      this.prisma.documentPermission.findFirst({
        where: {
          documentId: doc.id,
          allowed: true,
          OR: [
            { userId: me.sub },
            ...(ctx.groups.length ? [{ groupId: { in: ctx.groups } }] : []),
            ...(ctx.ancestors.length ? [{ orgNodeId: { in: ctx.ancestors } }] : []),
          ],
        },
        select: { id: true },
      }),
    ]);
    return Boolean(step || grant);
  }

  async assertCanView(me: AuthPayload, doc: DocumentAccessTarget) {
    if (!(await this.canView(me, doc))) {
      const level = doc.confidentiality ?? DocumentConfidentiality.INTERNAL;
      throw new ForbiddenException(
        level === DocumentConfidentiality.INTERNAL
          ? 'Você não tem acesso aos documentos desta área.'
          : 'Documento de acesso restrito. Peça liberação ao responsável.',
      );
    }
  }

  /** Escrita: precisa enxergar o documento e ter escrita na área dele. */
  async canWriteArea(me: AuthPayload, doc: DocumentAccessTarget, action: AreaAction = 'edit'): Promise<boolean> {
    const area = doc.orgNodeId ?? doc.indicator?.ownerNodeId ?? null;
    if (!area) return true;
    return this.access.canWriteArea(me.sub, area, MODULE, action);
  }
}
