export type OrgNodeLink = {
  id: string;
  parentId: string | null;
};

export function includeOrgAncestors<T extends OrgNodeLink>(nodes: T[], visibleIds: Iterable<string>) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const out = new Set<string>();

  for (const id of visibleIds) {
    let cursor: T | undefined = byId.get(id);
    const visited = new Set<string>();
    while (cursor && !visited.has(cursor.id)) {
      out.add(cursor.id);
      visited.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
  }

  return out;
}

export function filterOrgNodesWithAncestors<T extends OrgNodeLink>(nodes: T[], visibleIds: Iterable<string>) {
  const ids = includeOrgAncestors(nodes, visibleIds);
  return nodes.filter((node) => ids.has(node.id));
}
