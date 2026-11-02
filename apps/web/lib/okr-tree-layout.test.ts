import { describe, expect, it } from 'vitest';
import { anchorLayout, layoutTree, lineageOf, treeStructure, type TreeItem } from './okr-tree-layout';

const sizes = { nodeWidth: 100, nodeHeight: 50, gapX: 20, gapY: 30 };

// Duas raízes; "a" tem dois filhos e "a2" tem dois netos.
const items: TreeItem[] = [
  { id: 'a', parentId: null },
  { id: 'a1', parentId: 'a' },
  { id: 'a2', parentId: 'a' },
  { id: 'a2x', parentId: 'a2' },
  { id: 'a2y', parentId: 'a2' },
  { id: 'b', parentId: null },
];

function byId(nodes: ReturnType<typeof layoutTree>['nodes']) {
  return new Map(nodes.map((node) => [node.id, node]));
}

describe('layout em árvore dos OKRs', () => {
  it('centraliza cada objetivo acima dos filhos e não sobrepõe ramos', () => {
    const nodes = byId(layoutTree(items, new Set(), sizes).nodes);

    expect(nodes.get('a2x')).toMatchObject({ x: 120, y: 160, depth: 2 });
    expect(nodes.get('a2y')).toMatchObject({ x: 240, y: 160 });
    expect(nodes.get('a2')!.x).toBe(180);
    expect(nodes.get('a1')!.x).toBe(0);
    // "a" fica no meio entre a1 (0) e a2 (180).
    expect(nodes.get('a')!.x).toBe(90);
    // A raiz seguinte começa depois da largura do ramo "a" (340) mais um espaço duplo.
    expect(nodes.get('b')!.x).toBe(380);
  });

  it('liga só pai e filho visíveis e conta os escondidos no ramo recolhido', () => {
    const layout = layoutTree(items, new Set(['a2']), sizes);
    const nodes = byId(layout.nodes);

    expect(nodes.has('a2x')).toBe(false);
    expect(nodes.get('a2')).toMatchObject({ childCount: 2, hiddenCount: 2 });
    expect(layout.edges).toEqual([
      { source: 'a', target: 'a1' },
      { source: 'a', target: 'a2' },
    ]);
  });

  it('trata pai inexistente como raiz e não entra em laço com ciclo', () => {
    const cyclic: TreeItem[] = [
      { id: 'x', parentId: 'y' },
      { id: 'y', parentId: 'x' },
      { id: 'orfao', parentId: 'removido' },
    ];
    expect(treeStructure(cyclic).roots).toEqual(['orfao', 'x']);

    const layout = layoutTree(cyclic, new Set(), sizes);
    expect(layout.nodes).toHaveLength(3);
    expect(layout.edges).toEqual([{ source: 'x', target: 'y' }]);
    expect([...lineageOf(cyclic, 'y')].sort()).toEqual(['x', 'y']);
  });

  it('linhagem traz os de cima e os de baixo, sem os ramos vizinhos', () => {
    expect([...lineageOf(items, 'a2')].sort()).toEqual(['a', 'a2', 'a2x', 'a2y']);
    expect(lineageOf(items, null).size).toBe(0);
  });

  it('mantém o objetivo de referência parado ao recolher um ramo', () => {
    const open = byId(layoutTree(items, new Set(), sizes).nodes).get('a2')!;
    const closed = anchorLayout(layoutTree(items, new Set(['a2']), sizes), { id: 'a2', x: open.x, y: open.y });

    expect(byId(closed.nodes).get('a2')).toMatchObject({ x: open.x, y: open.y });
  });
});
