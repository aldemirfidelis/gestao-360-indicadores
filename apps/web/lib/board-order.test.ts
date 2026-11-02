import { describe, expect, it } from 'vitest';
import { findContainer, moveItem, placement, positionBetween, shiftItem, type Containers } from './board-order';

const board: Containers = {
  todo: ['a', 'b', 'c'],
  doing: ['d'],
  done: [],
};
const positions: Record<string, number> = { a: 1000, b: 2000, c: 3000, d: 1000 };

describe('ordem de quadros arrastáveis', () => {
  it('calcula a posição pelo meio dos vizinhos ou um passo além da ponta', () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
    expect(positionBetween(undefined, 1000)).toBe(0);
    expect(positionBetween(3000, undefined)).toBe(4000);
    expect(positionBetween(null, null)).toBe(1000);
  });

  it('acha o grupo de um item ou reconhece o próprio grupo', () => {
    expect(findContainer(board, 'd')).toBe('doing');
    expect(findContainer(board, 'done')).toBe('done');
    expect(findContainer(board, 'x')).toBeUndefined();
  });

  it('reordena dentro do grupo e leva para o fim ao soltar no fundo do grupo', () => {
    expect(moveItem(board, 'c', 'a').todo).toEqual(['c', 'a', 'b']);
    expect(moveItem(board, 'a', 'todo').todo).toEqual(['b', 'c', 'a']);
    expect(moveItem(board, 'b', 'b')).toBe(board);
  });

  it('troca de grupo no lugar do item de destino ou no fim de um grupo vazio', () => {
    const moved = moveItem(board, 'b', 'd');
    expect(moved.todo).toEqual(['a', 'c']);
    expect(moved.doing).toEqual(['b', 'd']);
    expect(moveItem(board, 'a', 'done').done).toEqual(['a']);
  });

  it('sobe e desce dentro do grupo sem passar das pontas', () => {
    expect(shiftItem(board, 'b', -1).todo).toEqual(['b', 'a', 'c']);
    expect(shiftItem(board, 'c', 1)).toBe(board);
    expect(shiftItem(board, 'todo', 1)).toBe(board);
  });

  it('informa grupo, índice e posição a gravar, ou nada quando o item não saiu do lugar', () => {
    const toTop = moveItem(board, 'c', 'a');
    expect(placement(board, toTop, 'c', (id) => positions[id])).toEqual({ container: 'todo', index: 0, position: 0 });

    const between = moveItem(board, 'd', 'b');
    expect(placement(board, between, 'd', (id) => positions[id])).toEqual({ container: 'todo', index: 1, position: 1500 });

    const empty = moveItem(board, 'a', 'done');
    expect(placement(board, empty, 'a', (id) => positions[id])).toEqual({ container: 'done', index: 0, position: 1000 });

    expect(placement(board, board, 'a', (id) => positions[id])).toBeNull();
  });
});
