/**
 * Layout em árvore do fluxograma de OKRs: cada objetivo fica centrado acima dos
 * seus filhos e cada ramo ocupa só a largura de que precisa, então as ligações
 * não se cruzam. Ramos recolhidos contam como uma folha.
 */

export interface TreeItem {
  id: string;
  parentId: string | null;
}

export interface TreeNodeBox {
  id: string;
  x: number;
  y: number;
  depth: number;
  childCount: number;
  /** Descendentes escondidos quando o ramo está recolhido. */
  hiddenCount: number;
}

export interface TreeLayout {
  nodes: TreeNodeBox[];
  edges: Array<{ source: string; target: string }>;
}

export interface TreeSizes {
  nodeWidth: number;
  nodeHeight: number;
  gapX: number;
  gapY: number;
}

export function treeStructure(items: TreeItem[]) {
  const ids = new Set(items.map((item) => item.id));
  const children = new Map<string, string[]>();
  const parent = new Map<string, string>();
  const roots: string[] = [];
  for (const item of items) {
    if (item.parentId && item.parentId !== item.id && ids.has(item.parentId)) {
      children.set(item.parentId, [...(children.get(item.parentId) ?? []), item.id]);
      parent.set(item.id, item.parentId);
    } else {
      roots.push(item.id);
    }
  }
  // Ciclo (A pai de B e B pai de A): ninguém do ciclo é raiz. O primeiro item
  // não alcançado vira raiz e a ligação de volta para ele é ignorada.
  const reached = new Set<string>();
  const visit = (id: string) => {
    if (reached.has(id)) return;
    reached.add(id);
    for (const child of children.get(id) ?? []) visit(child);
  };
  roots.forEach(visit);
  for (const item of items) {
    if (reached.has(item.id)) continue;
    const previousParent = parent.get(item.id);
    if (previousParent) children.set(previousParent, (children.get(previousParent) ?? []).filter((child) => child !== item.id));
    roots.push(item.id);
    parent.delete(item.id);
    visit(item.id);
  }
  return { roots, children, parent };
}

/** Objetivo selecionado, os de cima (até a raiz) e todos os de baixo. */
export function lineageOf(items: TreeItem[], id: string | null): Set<string> {
  const lineage = new Set<string>();
  if (!id || !items.some((item) => item.id === id)) return lineage;
  const { children, parent } = treeStructure(items);
  for (let current: string | undefined = id; current && !lineage.has(current); current = parent.get(current)) lineage.add(current);
  const queue = [...(children.get(id) ?? [])];
  while (queue.length) {
    const next = queue.shift()!;
    if (lineage.has(next)) continue;
    lineage.add(next);
    queue.push(...(children.get(next) ?? []));
  }
  return lineage;
}

export function layoutTree(items: TreeItem[], collapsed: ReadonlySet<string>, sizes: TreeSizes): TreeLayout {
  const { roots, children } = treeStructure(items);
  const visibleChildren = (id: string) => (collapsed.has(id) ? [] : children.get(id) ?? []);
  const countDescendants = (id: string): number =>
    (children.get(id) ?? []).reduce((total, child) => total + 1 + countDescendants(child), 0);

  const widths = new Map<string, number>();
  const measure = (id: string): number => {
    const kids = visibleChildren(id);
    const childrenWidth = kids.reduce((total, child) => total + measure(child), 0) + Math.max(0, kids.length - 1) * sizes.gapX;
    const width = Math.max(sizes.nodeWidth, childrenWidth);
    widths.set(id, width);
    return width;
  };

  const nodes: TreeNodeBox[] = [];
  const edges: TreeLayout['edges'] = [];
  // Devolve o x do objetivo: no meio entre o primeiro e o último filho visível.
  const place = (id: string, left: number, depth: number): number => {
    const width = widths.get(id) ?? sizes.nodeWidth;
    const kids = visibleChildren(id);
    const childrenWidth = kids.reduce((total, child) => total + (widths.get(child) ?? 0), 0) + Math.max(0, kids.length - 1) * sizes.gapX;
    let cursor = left + (width - childrenWidth) / 2;
    const childX: number[] = [];
    for (const child of kids) {
      edges.push({ source: id, target: child });
      childX.push(place(child, cursor, depth + 1));
      cursor += (widths.get(child) ?? 0) + sizes.gapX;
    }
    const x = childX.length ? (childX[0] + childX[childX.length - 1]) / 2 : left + (width - sizes.nodeWidth) / 2;
    nodes.push({
      id,
      x,
      y: depth * (sizes.nodeHeight + sizes.gapY),
      depth,
      childCount: children.get(id)?.length ?? 0,
      hiddenCount: collapsed.has(id) ? countDescendants(id) : 0,
    });
    return x;
  };

  let left = 0;
  for (const root of roots) {
    measure(root);
    place(root, left, 0);
    left += (widths.get(root) ?? sizes.nodeWidth) + sizes.gapX * 2;
  }
  return { nodes, edges };
}

/** Desloca o layout para que o objetivo de referência continue onde estava na tela. */
export function anchorLayout(layout: TreeLayout, anchor: { id: string; x: number; y: number } | null): TreeLayout {
  const node = anchor && layout.nodes.find((item) => item.id === anchor.id);
  if (!anchor || !node) return layout;
  const dx = anchor.x - node.x;
  const dy = anchor.y - node.y;
  if (!dx && !dy) return layout;
  return { ...layout, nodes: layout.nodes.map((item) => ({ ...item, x: item.x + dx, y: item.y + dy })) };
}
