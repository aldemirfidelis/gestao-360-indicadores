import { describe, expect, it } from 'vitest';
import {
  CARD_LEFT,
  LANE_PAD_TOP,
  arrangeLayout,
  cardPosition,
  deriveLayout,
  dropLane,
  layoutChanges,
  moveCards,
  resizeCard,
  type LayoutChanges,
  type LayoutObjective,
  type LayoutPerspective,
} from './strategy-map-layout';

// Formato gravado pelo seed da demonstração: faixas de 180 a cada 200 e cards em x=40,
// por baixo do rótulo da faixa.
const legacyPerspectives: LayoutPerspective[] = [
  { id: 'fin', positionX: 0, positionY: 0, width: 1240, height: 180 },
  { id: 'cli', positionX: 0, positionY: 200, width: 1240, height: 180 },
];
const legacyObjectives: LayoutObjective[] = [
  { id: 'f1', perspectiveId: 'fin', positionX: 40, positionY: 40, width: 260, height: 150 },
  { id: 'f2', perspectiveId: 'fin', positionX: 340, positionY: 40, width: 260, height: 150 },
  { id: 'c1', perspectiveId: 'cli', positionX: 40, positionY: 240, width: 260, height: 150 },
  { id: 'c2', perspectiveId: 'cli', positionX: 640, positionY: 240, width: 260, height: 150 },
];

function applyChanges(perspectives: LayoutPerspective[], objectives: LayoutObjective[], changes: LayoutChanges) {
  const lanes = new Map(changes.lanes.map((lane) => [lane.id, lane]));
  const cards = new Map(changes.objectives.map((card) => [card.id, card]));
  return {
    perspectives: perspectives.map((perspective) => ({ ...perspective, ...lanes.get(perspective.id) })),
    objectives: objectives.map((objective) => ({ ...objective, ...cards.get(objective.id) })),
  };
}

describe('layout do mapa estratégico', () => {
  it('converte mapas antigos tirando os cards de baixo do rótulo sem desfazer o arranjo', () => {
    const layout = deriveLayout(legacyPerspectives, legacyObjectives);

    expect(layout.cards.get('f1')).toMatchObject({ perspectiveId: 'fin', x: CARD_LEFT, y: 40 });
    expect(layout.cards.get('f2')).toMatchObject({ x: CARD_LEFT + 300, y: 40 });
    expect(layout.cards.get('c2')).toMatchObject({ x: CARD_LEFT + 600, y: 40 });
    expect(layout.lanes).toEqual([
      { perspectiveId: 'fin', top: 0, height: 220 },
      { perspectiveId: 'cli', top: 240, height: 220 },
    ]);
    expect(cardPosition(layout, layout.cards.get('c1')!)).toEqual({ x: CARD_LEFT, y: 280 });
  });

  it('depois de gravado, ler de novo dá o mesmo layout e nada a gravar', () => {
    const layout = deriveLayout(legacyPerspectives, legacyObjectives);
    const changes = layoutChanges(layout, legacyPerspectives, legacyObjectives);
    expect(changes.objectives.length).toBeGreaterThan(0);

    const stored = applyChanges(legacyPerspectives, legacyObjectives, changes);
    const reread = deriveLayout(stored.perspectives, stored.objectives);

    expect(reread).toEqual(layout);
    expect(layoutChanges(reread, stored.perspectives, stored.objectives)).toEqual({ objectives: [], lanes: [] });
  });

  it('mantém o card na faixa de origem até o meio da faixa de baixo e troca para cima ao entrar', () => {
    const { lanes } = deriveLayout(legacyPerspectives, legacyObjectives);

    expect(dropLane(lanes, 'fin', 300)?.perspectiveId).toBe('fin');
    expect(dropLane(lanes, 'fin', 360)?.perspectiveId).toBe('cli');
    expect(dropLane(lanes, 'cli', 200)?.perspectiveId).toBe('fin');
    expect(dropLane(lanes, 'cli', 2000)?.perspectiveId).toBe('cli');
  });

  it('soltar sobre outra faixa troca a perspectiva e a posição passa a ser relativa a ela', () => {
    const layout = deriveLayout(legacyPerspectives, legacyObjectives);
    const moved = moveCards(layout, [{ id: 'f2', x: 893, y: 300 }]);

    expect(moved.cards.get('f2')).toMatchObject({ perspectiveId: 'cli', x: 890, y: 60 });
    expect(moved.lanes[0].height).toBe(220);
  });

  it('abrir uma linha nova embaixo faz a faixa crescer e empurra a de baixo com os cards', () => {
    const layout = deriveLayout(legacyPerspectives, legacyObjectives);
    const moved = moveCards(layout, [{ id: 'f2', x: CARD_LEFT, y: 220 }]);

    expect(moved.cards.get('f2')).toMatchObject({ perspectiveId: 'fin', y: 220 });
    expect(moved.lanes[0].height).toBe(400);
    expect(moved.lanes[1].top).toBe(420);
    expect(cardPosition(moved, moved.cards.get('c1')!).y).toBe(460);
  });

  it('não deixa o card subir acima do topo da faixa nem entrar no rótulo', () => {
    const layout = deriveLayout(legacyPerspectives, legacyObjectives);
    const moved = moveCards(layout, [{ id: 'c1', x: 12, y: 245 }]);

    expect(moved.cards.get('c1')).toMatchObject({ perspectiveId: 'cli', x: CARD_LEFT, y: LANE_PAD_TOP });
  });

  it('coloca objetivos novos (sem posição) na primeira vaga livre da faixa', () => {
    const layout = deriveLayout(legacyPerspectives, [
      ...legacyObjectives,
      { id: 'novo', perspectiveId: 'cli', positionX: 0, positionY: 0, width: 260, height: 150 },
      { id: 'vazio', perspectiveId: 'fin', positionX: 0, positionY: 0 },
    ]);

    expect(layout.cards.get('novo')).toMatchObject({ x: CARD_LEFT + 300, y: LANE_PAD_TOP });
    expect(layout.cards.get('vazio')).toMatchObject({ x: CARD_LEFT + 600, y: LANE_PAD_TOP, width: 260, height: 150 });
  });

  it('ignora objetivos de perspectiva inativa', () => {
    const layout = deriveLayout(legacyPerspectives, [
      ...legacyObjectives,
      { id: 'orfao', perspectiveId: 'removida', positionX: 400, positionY: 400 },
    ]);

    expect(layout.cards.has('orfao')).toBe(false);
  });

  it('redimensiona arredondando para a grade e respeitando o tamanho mínimo', () => {
    const layout = deriveLayout(legacyPerspectives, legacyObjectives);
    const resized = resizeCard(layout, 'f1', { x: CARD_LEFT, y: 40, width: 314, height: 40 });

    expect(resized.cards.get('f1')).toMatchObject({ width: 310, height: 100 });
  });

  it('organizar distribui cada faixa em linhas de até quatro cards', () => {
    const many: LayoutObjective[] = Array.from({ length: 6 }, (_, index) => ({
      id: `o${index}`,
      perspectiveId: 'fin',
      positionX: 900 - index * 100,
      positionY: 40,
      width: 260,
      height: 150,
    }));
    const arranged = arrangeLayout(deriveLayout(legacyPerspectives.slice(0, 1), many));

    expect(arranged.cards.get('o5')).toMatchObject({ x: CARD_LEFT, y: LANE_PAD_TOP });
    expect(arranged.cards.get('o2')).toMatchObject({ x: CARD_LEFT + 900, y: LANE_PAD_TOP });
    expect(arranged.cards.get('o1')).toMatchObject({ x: CARD_LEFT, y: LANE_PAD_TOP + 180 });
  });
});
