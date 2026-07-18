/**
 * Sobe a hierarquia de OrgNode (parentId) a partir de um nó semente, coletando
 * o responsibleUserId de cada nível até o topo. Nível 0 = responsável do nó
 * semente (gestor imediato); nível 1 = responsável do próximo nó acima com
 * responsável definido (ex.: superintendente); e assim por diante. Sem
 * duplicados — mantém o nível mais baixo (mais próximo) de cada usuário.
 *
 * Extraído de PrizeAnnexesService.listApprovers (prize-annexes.service.ts).
 */
export interface OrgHierarchyNode {
  id: string;
  parentId: string | null;
  responsibleUserId: string | null;
}

export interface ResponsibleChainEntry {
  userId: string;
  level: number;
  orgNodeName?: string;
}

export function resolveResponsibleChain(
  nodes: Array<OrgHierarchyNode & { name?: string }>,
  seedNodeIds: string | Iterable<string>,
): ResponsibleChainEntry[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const levelByUser = new Map<string, ResponsibleChainEntry>();
  const seeds = typeof seedNodeIds === 'string' ? [seedNodeIds] : seedNodeIds;

  for (const seedId of seeds) {
    let cur: string | null = seedId;
    let level = 0;
    const guard = new Set<string>();
    while (cur && !guard.has(cur)) {
      guard.add(cur);
      const node = byId.get(cur);
      if (!node) break;
      if (node.responsibleUserId) {
        const prev = levelByUser.get(node.responsibleUserId);
        if (!prev || level < prev.level) {
          levelByUser.set(node.responsibleUserId, { userId: node.responsibleUserId, level, orgNodeName: node.name });
        }
      }
      cur = node.parentId;
      level += 1;
    }
  }

  return [...levelByUser.values()].sort((a, b) => a.level - b.level);
}
