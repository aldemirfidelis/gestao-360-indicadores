import { Injectable } from '@nestjs/common';
import { CommAudienceKind } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

/** Regra de publico vinda da tela (etapa 3 da criacao). */
export interface AudienceSelection {
  kind: CommAudienceKind;
  refId?: string | null;
}

export interface AudienceOption {
  id: string;
  name: string;
  detail?: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Administradores da plataforma',
  COMPANY_ADMIN: 'Administradores da empresa',
  DIRECTOR: 'Diretoria',
  MANAGER: 'Gestores',
  ANALYST: 'Analistas',
  OPERATOR: 'Operadores',
  VIEWER: 'Visualizadores',
};

const NODE_TYPE_LABEL: Record<string, string> = {
  COMPANY: 'Empresa',
  BRANCH: 'Filial',
  UNIT: 'Unidade',
  DIRECTORATE: 'Diretoria',
  MANAGEMENT: 'Gerência',
  COORDINATION: 'Coordenação',
  SECTOR: 'Setor',
  SUBSECTOR: 'Subsetor',
  AREA: 'Área',
  SUBAREA: 'Subárea',
  DEPARTMENT: 'Departamento',
  COST_CENTER: 'Centro de custo',
  MACROPROCESS: 'Macroprocesso',
  PROCESS: 'Processo',
};

/**
 * Resolve o publico de uma publicacao em uma lista concreta de usuarios da
 * empresa. Um no da estrutura (unidade, diretoria, area, setor...) alcanca
 * tambem os nos descendentes — quem publica para a Diretoria Industrial atinge
 * os setores abaixo dela sem ter que marcar um por um.
 */
@Injectable()
export class CommunicationAudienceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Opcoes para a etapa "Publico" da criacao (sem tela separada de Pessoas). */
  async options(companyId: string) {
    const [nodes, jobs, users] = await Promise.all([
      this.prisma.orgNode.findMany({
        where: { companyId, deletedAt: null, active: true },
        select: { id: true, name: true, type: true, parentId: true },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.orgJob.findMany({
        where: { companyId, active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { companyId, deletedAt: null, active: true },
        select: { id: true, name: true, email: true, role: true, defaultNode: { select: { name: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);

    const roles = Array.from(new Set(users.map((u) => u.role))).map((role) => ({
      id: role,
      name: ROLE_LABEL[role] ?? role,
      detail: `${users.filter((u) => u.role === role).length} pessoa(s)`,
    }));

    return {
      total: users.length,
      orgNodes: nodes.map((node) => ({
        id: node.id,
        name: node.name,
        detail: NODE_TYPE_LABEL[node.type] ?? node.type,
        parentId: node.parentId,
      })),
      jobs: jobs.map((job) => ({ id: job.id, name: job.name })),
      roles,
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        detail: user.defaultNode?.name ?? user.email,
      })),
    };
  }

  /** Quantidade estimada de pessoas alcancadas (exibida na etapa Publico). */
  async estimate(companyId: string, selections: AudienceSelection[]) {
    const userIds = await this.resolveUserIds(companyId, selections);
    return { count: userIds.length };
  }

  /**
   * Converte a selecao em ids de usuario. Uma publicacao sem regra nenhuma
   * nao alcanca ninguem (o formulario obriga escolher ao menos um publico).
   */
  async resolveUserIds(companyId: string, selections: AudienceSelection[]): Promise<string[]> {
    const rules = this.normalize(selections);
    if (rules.length === 0) return [];

    if (rules.some((rule) => rule.kind === 'ALL')) {
      const all = await this.prisma.user.findMany({
        where: { companyId, deletedAt: null, active: true },
        select: { id: true },
      });
      return all.map((user) => user.id);
    }

    const nodeIds = rules.filter((r) => r.kind === 'ORG_NODE').map((r) => r.refId!);
    const jobIds = rules.filter((r) => r.kind === 'JOB').map((r) => r.refId!);
    const roles = rules.filter((r) => r.kind === 'ROLE').map((r) => r.refId!);
    const directUserIds = rules.filter((r) => r.kind === 'USER').map((r) => r.refId!);

    const matched = new Set<string>(directUserIds);

    if (nodeIds.length > 0) {
      const expanded = await this.expandNodes(companyId, nodeIds);
      const byNode = await this.prisma.user.findMany({
        where: { companyId, deletedAt: null, active: true, defaultNodeId: { in: Array.from(expanded) } },
        select: { id: true },
      });
      for (const user of byNode) matched.add(user.id);
    }

    if (roles.length > 0) {
      const byRole = await this.prisma.user.findMany({
        where: { companyId, deletedAt: null, active: true, role: { in: roles as any[] } },
        select: { id: true },
      });
      for (const user of byRole) matched.add(user.id);
    }

    if (jobIds.length > 0) {
      // Cargo mora no cadastro funcional (OrgEmployee); o vinculo com o login
      // do portal e o PersonnelEmployeeProfile.userId.
      const profiles = await this.prisma.personnelEmployeeProfile.findMany({
        where: { companyId, userId: { not: null }, employee: { jobId: { in: jobIds } } },
        select: { userId: true },
      });
      const ids = profiles.map((p) => p.userId).filter((id): id is string => Boolean(id));
      if (ids.length > 0) {
        const active = await this.prisma.user.findMany({
          where: { companyId, deletedAt: null, active: true, id: { in: ids } },
          select: { id: true },
        });
        for (const user of active) matched.add(user.id);
      }
    }

    // Usuarios informados diretamente ainda precisam existir e estar ativos.
    if (directUserIds.length > 0) {
      const valid = await this.prisma.user.findMany({
        where: { companyId, deletedAt: null, active: true, id: { in: directUserIds } },
        select: { id: true },
      });
      const validIds = new Set(valid.map((user) => user.id));
      for (const id of directUserIds) if (!validIds.has(id)) matched.delete(id);
    }

    return Array.from(matched);
  }

  /** Descricao curta do publico para listagens ("Toda a empresa", "3 áreas"...). */
  async describe(companyId: string, selections: AudienceSelection[]): Promise<string> {
    const labels = await this.describeMany(companyId, [{ id: 'single', rules: selections }]);
    return labels.get('single') ?? 'Sem público definido';
  }

  /**
   * Versao em lote da descricao: resolve os nomes de todos os nos/cargos das
   * publicacoes de uma listagem em tres consultas, e nao uma por publicacao.
   */
  async describeMany(
    companyId: string,
    entries: Array<{ id: string; rules: AudienceSelection[] }>,
  ): Promise<Map<string, string>> {
    const normalized = entries.map((entry) => ({ id: entry.id, rules: this.normalize(entry.rules) }));
    const nodeIds = new Set<string>();
    const jobIds = new Set<string>();
    for (const entry of normalized) {
      for (const rule of entry.rules) {
        if (rule.kind === 'ORG_NODE' && rule.refId) nodeIds.add(rule.refId);
        if (rule.kind === 'JOB' && rule.refId) jobIds.add(rule.refId);
      }
    }

    const [nodes, jobs] = await Promise.all([
      nodeIds.size > 0
        ? this.prisma.orgNode.findMany({ where: { id: { in: Array.from(nodeIds) }, companyId }, select: { id: true, name: true } })
        : Promise.resolve([]),
      jobIds.size > 0
        ? this.prisma.orgJob.findMany({ where: { id: { in: Array.from(jobIds) }, companyId }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);
    const nodeName = new Map(nodes.map((node) => [node.id, node.name]));
    const jobName = new Map(jobs.map((job) => [job.id, job.name]));

    const result = new Map<string, string>();
    for (const entry of normalized) {
      result.set(entry.id, this.buildLabel(entry.rules, nodeName, jobName));
    }
    return result;
  }

  private buildLabel(rules: AudienceSelection[], nodeName: Map<string, string>, jobName: Map<string, string>): string {
    if (rules.length === 0) return 'Sem público definido';
    if (rules.some((rule) => rule.kind === 'ALL')) return 'Todos os colaboradores';

    const parts: string[] = [];
    const nodes = rules.filter((rule) => rule.kind === 'ORG_NODE');
    if (nodes.length > 0) {
      parts.push(nodes.length === 1 ? nodeName.get(nodes[0]!.refId!) ?? 'Área' : `${nodes.length} áreas`);
    }
    const jobs = rules.filter((rule) => rule.kind === 'JOB');
    if (jobs.length > 0) {
      parts.push(jobs.length === 1 ? jobName.get(jobs[0]!.refId!) ?? 'Cargo' : `${jobs.length} cargos`);
    }
    const roles = rules.filter((rule) => rule.kind === 'ROLE').map((rule) => rule.refId!);
    if (roles.length > 0) parts.push(roles.map((role) => ROLE_LABEL[role] ?? role).join(', '));
    const users = rules.filter((rule) => rule.kind === 'USER').length;
    if (users > 0) parts.push(users === 1 ? '1 colaborador' : `${users} colaboradores`);

    return parts.join(' · ');
  }

  /** Remove duplicidades e regras invalidas (ex.: ORG_NODE sem refId). */
  normalize(selections: AudienceSelection[] | undefined | null): AudienceSelection[] {
    const list = Array.isArray(selections) ? selections : [];
    const seen = new Set<string>();
    const result: AudienceSelection[] = [];
    for (const item of list) {
      const kind = item?.kind;
      if (!kind || !Object.values(CommAudienceKind).includes(kind)) continue;
      const refId = kind === 'ALL' ? null : String(item.refId ?? '').trim() || null;
      if (kind !== 'ALL' && !refId) continue;
      const key = `${kind}:${refId ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ kind, refId });
    }
    // "Todos" absorve qualquer outra regra.
    if (result.some((rule) => rule.kind === 'ALL')) return [{ kind: CommAudienceKind.ALL, refId: null }];
    return result;
  }

  /** Um no + todos os descendentes (a estrutura e uma arvore por parentId). */
  private async expandNodes(companyId: string, rootIds: string[]): Promise<Set<string>> {
    const nodes = await this.prisma.orgNode.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    const childrenOf = new Map<string, string[]>();
    for (const node of nodes) {
      if (!node.parentId) continue;
      const list = childrenOf.get(node.parentId) ?? [];
      list.push(node.id);
      childrenOf.set(node.parentId, list);
    }
    const result = new Set<string>();
    const queue = [...rootIds];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (result.has(current)) continue;
      result.add(current);
      for (const child of childrenOf.get(current) ?? []) queue.push(child);
    }
    return result;
  }
}
