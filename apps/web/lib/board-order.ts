/**
 * Ordem de itens em listas e quadros arrastáveis (Kanban de tarefas, roteiro da
 * reunião, causas do Ishikawa). Funções puras: a tela guarda os grupos como
 * listas de ids e só grava no servidor o resultado final do arraste.
 */

/** Grupos de itens por coluna/categoria, na ordem em que aparecem. */
export type Containers = Record<string, string[]>;

const POSITION_STEP = 1000;

/**
 * Posição numérica para um item solto entre dois vizinhos. Os quadros gravam
 * posição decimal; o meio do intervalo evita renumerar a coluna inteira.
 */
export function positionBetween(previous?: number | null, next?: number | null, step = POSITION_STEP) {
  const hasPrevious = typeof previous === 'number' && Number.isFinite(previous);
  const hasNext = typeof next === 'number' && Number.isFinite(next);
  if (hasPrevious && hasNext) return (previous + next) / 2;
  if (hasPrevious) return previous + step;
  if (hasNext) return next - step;
  return step;
}

export function findContainer(containers: Containers, id: string): string | undefined {
  if (id in containers) return id;
  return Object.keys(containers).find((key) => containers[key].includes(id));
}

/**
 * Move `activeId` para onde está `overId`: um item (fica no lugar dele) ou um
 * grupo (vai para o fim). Devolve o mesmo objeto quando nada muda.
 */
export function moveItem(containers: Containers, activeId: string, overId: string): Containers {
  const from = findContainer(containers, activeId);
  const to = findContainer(containers, overId);
  if (!from || !to) return containers;
  const source = containers[from];
  const fromIndex = source.indexOf(activeId);
  if (from === to) {
    const toIndex = overId === to ? source.length - 1 : source.indexOf(overId);
    if (toIndex < 0 || toIndex === fromIndex) return containers;
    const items = [...source];
    items.splice(fromIndex, 1);
    items.splice(toIndex, 0, activeId);
    return { ...containers, [from]: items };
  }
  const target = containers[to];
  const overIndex = overId === to ? -1 : target.indexOf(overId);
  const insertAt = overIndex < 0 ? target.length : overIndex;
  return {
    ...containers,
    [from]: source.filter((id) => id !== activeId),
    [to]: [...target.slice(0, insertAt), activeId, ...target.slice(insertAt)],
  };
}

/** Sobe (-1) ou desce (+1) um item dentro do próprio grupo: alternativa ao arraste. */
export function shiftItem(containers: Containers, id: string, direction: -1 | 1): Containers {
  const key = findContainer(containers, id);
  if (!key || key === id) return containers;
  const items = containers[key];
  const index = items.indexOf(id);
  const target = index + direction;
  if (target < 0 || target >= items.length) return containers;
  const next = [...items];
  next.splice(index, 1);
  next.splice(target, 0, id);
  return { ...containers, [key]: next };
}

/**
 * Onde o item terminou e a posição a gravar, a partir das posições conhecidas
 * dos vizinhos. `null` quando ele voltou ao mesmo lugar.
 */
export function placement(
  before: Containers,
  after: Containers,
  id: string,
  positionOf: (id: string) => number | null | undefined,
): { container: string; index: number; position: number } | null {
  const container = findContainer(after, id);
  const original = findContainer(before, id);
  if (!container || container === id || !original) return null;
  const items = after[container];
  const index = items.indexOf(id);
  if (container === original && before[original].indexOf(id) === index) return null;
  const previous = index > 0 ? positionOf(items[index - 1]) : undefined;
  const next = index < items.length - 1 ? positionOf(items[index + 1]) : undefined;
  return { container, index, position: positionBetween(previous, next) };
}
