import { describe, expect, it } from 'vitest';
import { areasOf, sectorsOf } from './execute';

const ARVORE = [
  { id: 'agricola', name: 'Agrícola', parentId: null },
  { id: 'colheita', name: 'Colheita Mecanizada', parentId: 'agricola' },
  { id: 'plantio', name: 'Plantio', parentId: 'agricola' },
  { id: 'industrial', name: 'Industrial', parentId: null },
  { id: 'destilaria', name: 'Destilaria', parentId: 'industrial' },
];

describe('areasOf', () => {
  it('área é o nó que tem setores abaixo', () => {
    expect(areasOf(ARVORE).map((a) => a.id)).toEqual(['agricola', 'industrial']);
  });

  it('árvore rasa (sem filhos) oferece todos os nós, em vez de lista vazia', () => {
    const rasa = [{ id: 'a', name: 'A', parentId: null }, { id: 'b', name: 'B', parentId: null }];
    expect(areasOf(rasa).map((a) => a.id)).toEqual(['a', 'b']);
  });
});

describe('sectorsOf', () => {
  it('lista só os setores da área escolhida', () => {
    expect(sectorsOf(ARVORE, 'agricola').map((s) => s.name)).toEqual(['Colheita Mecanizada', 'Plantio']);
    expect(sectorsOf(ARVORE, 'industrial').map((s) => s.name)).toEqual(['Destilaria']);
  });

  it('sem área escolhida não sugere setor', () => {
    expect(sectorsOf(ARVORE, '')).toEqual([]);
  });

  it('área sem filhos devolve vazio (a tela avisa)', () => {
    expect(sectorsOf(ARVORE, 'colheita')).toEqual([]);
  });
});
