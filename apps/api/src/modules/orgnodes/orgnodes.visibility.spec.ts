import { describe, expect, it } from 'vitest';
import { filterOrgNodesWithAncestors, includeOrgAncestors, type OrgNodeLink } from './orgnodes.visibility';

const nodes: OrgNodeLink[] = [
  { id: 'goiasa', parentId: null },
  { id: 'gestao-pessoas', parentId: 'goiasa' },
  { id: 'comportamento', parentId: 'gestao-pessoas' },
  { id: 'desenvolvimento-humano', parentId: 'gestao-pessoas' },
  { id: 'area-agricola', parentId: 'goiasa' },
  { id: 'estradas', parentId: 'area-agricola' },
];

describe('orgnodes visibility helpers', () => {
  it('inclui ancestrais da area permitida sem incluir areas irmas', () => {
    const visible = includeOrgAncestors(nodes, ['comportamento']);

    expect([...visible]).toEqual(['comportamento', 'gestao-pessoas', 'goiasa']);
    expect(visible.has('area-agricola')).toBe(false);
    expect(visible.has('estradas')).toBe(false);
  });

  it('filtra a arvore visivel mantendo descendentes ja expandidos pelo escopo', () => {
    const visible = filterOrgNodesWithAncestors(nodes, [
      'gestao-pessoas',
      'comportamento',
      'desenvolvimento-humano',
    ]);

    expect(visible.map((node) => node.id)).toEqual([
      'goiasa',
      'gestao-pessoas',
      'comportamento',
      'desenvolvimento-humano',
    ]);
  });
});
