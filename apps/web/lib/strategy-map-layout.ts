/**
 * Geometria do Mapa Estratégico (BSC). As perspectivas são faixas horizontais
 * empilhadas na ordem do mapa e cada objetivo fica dentro da faixa da sua
 * perspectiva, com posição relativa a ela: quando uma faixa cresce, as de baixo
 * descem levando os seus cards. As faixas se ajustam sozinhas ao conteúdo.
 *
 * No banco a posição do objetivo continua absoluta e cada perspectiva guarda a
 * origem e o tamanho da sua faixa. Ler: posição gravada menos a origem gravada
 * da faixa. Gravar: topo calculado da faixa mais a posição relativa. Mapas
 * antigos, com faixas que nunca gravaram origem, usam o empilhamento antigo
 * pela altura de cada faixa.
 */

export const LAYOUT_GRID = 10;
export const LANE_HEADER_WIDTH = 160;
/** Primeira coluna livre para cards, depois do rótulo da faixa. */
export const CARD_LEFT = LANE_HEADER_WIDTH + 30;
export const LANE_PAD_TOP = 30;
const LANE_PAD_BOTTOM = 30;
const LANE_PAD_RIGHT = 40;
export const LANE_GAP = 20;
const LANE_MIN_HEIGHT = 180;
const LANE_MIN_WIDTH = 1200;
export const CARD_DEFAULT_WIDTH = 260;
export const CARD_DEFAULT_HEIGHT = 150;
export const CARD_MIN_WIDTH = 180;
export const CARD_MIN_HEIGHT = 100;
const CARD_GAP_X = 40;
const CARD_GAP_Y = 30;
const ROW_SLOTS = 4;
/** Altura padrão das faixas no layout antigo (mapas gravados antes deste). */
const LEGACY_LANE_HEIGHT = 230;

export interface LayoutPerspective {
  id: string;
  positionX?: number | null;
  positionY?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface LayoutObjective {
  id: string;
  perspectiveId: string;
  positionX: number;
  positionY: number;
  width?: number | null;
  height?: number | null;
}

export interface LaneBox {
  perspectiveId: string;
  top: number;
  height: number;
}

/** Card com x/y relativos ao canto superior esquerdo da faixa. */
export interface CardBox {
  id: string;
  perspectiveId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapLayout {
  lanes: LaneBox[];
  width: number;
  cards: Map<string, CardBox>;
}

/** Posição absoluta (canto superior esquerdo) de um card depois de arrastado. */
export interface CardMove {
  id: string;
  x: number;
  y: number;
}

export interface LayoutChanges {
  objectives: Array<{ id: string; perspectiveId: string; positionX: number; positionY: number; width: number; height: number }>;
  lanes: Array<{ id: string; positionX: number; positionY: number; width: number; height: number }>;
}

export function snapToGrid(value: number) {
  return Math.round(value / LAYOUT_GRID) * LAYOUT_GRID;
}

function cardSize(value: number | null | undefined, fallback: number, min: number) {
  return Math.max(min, snapToGrid(value && value > 0 ? value : fallback));
}

/** Objetivo criado sem posição (0,0) ainda não foi colocado no mapa. */
function isPlaced(objective: LayoutObjective) {
  return objective.positionX !== 0 || objective.positionY !== 0;
}

/** Origem de cada faixa como está gravada: a salva na perspectiva ou o empilhamento antigo. */
function storedLaneOrigins(perspectives: LayoutPerspective[]) {
  const origins = new Map<string, { x: number; y: number }>();
  let stacked = 0;
  for (const perspective of perspectives) {
    const x = perspective.positionX ?? 0;
    const y = perspective.positionY ?? 0;
    origins.set(perspective.id, x !== 0 || y !== 0 ? { x, y } : { x: 0, y: stacked });
    stacked += perspective.height ?? LEGACY_LANE_HEIGHT;
  }
  return origins;
}

function laneIdsOf(layout: MapLayout) {
  return layout.lanes.map((lane) => lane.perspectiveId);
}

function computeLayout(laneIds: string[], cards: Map<string, CardBox>): MapLayout {
  const bottoms = new Map<string, number>();
  let right = 0;
  for (const card of cards.values()) {
    bottoms.set(card.perspectiveId, Math.max(bottoms.get(card.perspectiveId) ?? 0, card.y + card.height));
    right = Math.max(right, card.x + card.width);
  }
  let top = 0;
  const lanes = laneIds.map((perspectiveId) => {
    const height = Math.max(LANE_MIN_HEIGHT, (bottoms.get(perspectiveId) ?? 0) + LANE_PAD_BOTTOM);
    const lane = { perspectiveId, top, height };
    top += height + LANE_GAP;
    return lane;
  });
  return { lanes, width: Math.max(LANE_MIN_WIDTH, right + LANE_PAD_RIGHT), cards };
}

function conflicts(slot: { x: number; y: number }, size: { width: number; height: number }, other: CardBox) {
  const margin = LAYOUT_GRID;
  return (
    slot.x < other.x + other.width + margin &&
    other.x < slot.x + size.width + margin &&
    slot.y < other.y + other.height + margin &&
    other.y < slot.y + size.height + margin
  );
}

/** Primeira vaga livre da faixa, da esquerda para a direita e de cima para baixo. */
function freeSlot(laneCards: CardBox[], size: { width: number; height: number }) {
  const stepX = CARD_DEFAULT_WIDTH + CARD_GAP_X;
  const stepY = CARD_DEFAULT_HEIGHT + CARD_GAP_Y;
  const bottom = laneCards.reduce((max, card) => Math.max(max, card.y + card.height), 0);
  for (let y = LANE_PAD_TOP; y <= bottom; y += stepY) {
    for (let column = 0; column < ROW_SLOTS; column += 1) {
      const slot = { x: CARD_LEFT + column * stepX, y };
      if (!laneCards.some((card) => conflicts(slot, size, card))) return slot;
    }
  }
  return { x: CARD_LEFT, y: snapToGrid(Math.max(LANE_PAD_TOP, bottom + CARD_GAP_Y)) };
}

export function deriveLayout(perspectives: LayoutPerspective[], objectives: LayoutObjective[]): MapLayout {
  const origins = storedLaneOrigins(perspectives);
  const placed: CardBox[] = [];
  const unplaced: CardBox[] = [];
  for (const objective of objectives) {
    const origin = origins.get(objective.perspectiveId);
    // Objetivo de perspectiva inativa não tem faixa onde ficar.
    if (!origin) continue;
    const card: CardBox = {
      id: objective.id,
      perspectiveId: objective.perspectiveId,
      x: objective.positionX - origin.x,
      y: objective.positionY - origin.y,
      width: cardSize(objective.width, CARD_DEFAULT_WIDTH, CARD_MIN_WIDTH),
      height: cardSize(objective.height, CARD_DEFAULT_HEIGHT, CARD_MIN_HEIGHT),
    };
    (isPlaced(objective) ? placed : unplaced).push(card);
  }

  // Mapas antigos podem ter cards por baixo do rótulo da faixa ou acima do topo
  // dela: desloca o conjunto, não card a card, para preservar o arranjo.
  const shiftX = CARD_LEFT - placed.reduce((min, card) => Math.min(min, card.x), CARD_LEFT);
  const minYByLane = new Map<string, number>();
  for (const card of placed) {
    minYByLane.set(card.perspectiveId, Math.min(minYByLane.get(card.perspectiveId) ?? LANE_PAD_TOP, card.y));
  }
  const cards = new Map<string, CardBox>();
  for (const card of placed) {
    const shiftY = LANE_PAD_TOP - (minYByLane.get(card.perspectiveId) ?? LANE_PAD_TOP);
    cards.set(card.id, { ...card, x: snapToGrid(card.x + shiftX), y: snapToGrid(card.y + shiftY) });
  }
  for (const card of unplaced) {
    const laneCards = [...cards.values()].filter((other) => other.perspectiveId === card.perspectiveId);
    cards.set(card.id, { ...card, ...freeSlot(laneCards, card) });
  }
  return computeLayout(perspectives.map((perspective) => perspective.id), cards);
}

export function cardPosition(layout: MapLayout, card: CardBox) {
  const lane = layout.lanes.find((item) => item.perspectiveId === card.perspectiveId);
  return { x: card.x, y: (lane?.top ?? 0) + card.y };
}

function distanceToLane(y: number, lane: LaneBox) {
  if (y < lane.top) return lane.top - y;
  return Math.max(0, y - (lane.top + lane.height));
}

/**
 * Faixa onde o card cai ao ser solto, pela altura do seu centro. Para baixo, a
 * faixa de origem segura o card até o meio da faixa seguinte: assim dá para
 * abrir uma linha nova embaixo dos outros cards sem trocar de perspectiva. Para
 * cima, ele muda assim que entra na faixa de cima.
 */
export function dropLane(lanes: LaneBox[], originId: string, centerY: number): LaneBox | undefined {
  if (!lanes.length) return undefined;
  const index = lanes.findIndex((lane) => lane.perspectiveId === originId);
  if (index >= 0) {
    const origin = lanes[index];
    const next = lanes[index + 1];
    const limit = next ? next.top + next.height / 2 : Number.POSITIVE_INFINITY;
    if (centerY >= origin.top - LANE_GAP && centerY < limit) return origin;
  }
  const inside = lanes.find((lane) => centerY >= lane.top && centerY < lane.top + lane.height);
  if (inside) return inside;
  return lanes.reduce((best, lane) => (distanceToLane(centerY, lane) < distanceToLane(centerY, best) ? lane : best));
}

export function moveCards(layout: MapLayout, moves: CardMove[]): MapLayout {
  const cards = new Map(layout.cards);
  for (const move of moves) {
    const card = layout.cards.get(move.id);
    const lane = card && dropLane(layout.lanes, card.perspectiveId, move.y + card.height / 2);
    if (!card || !lane) continue;
    cards.set(card.id, {
      ...card,
      perspectiveId: lane.perspectiveId,
      x: Math.max(CARD_LEFT, snapToGrid(move.x)),
      y: Math.max(LANE_PAD_TOP, snapToGrid(move.y - lane.top)),
    });
  }
  return computeLayout(laneIdsOf(layout), cards);
}

/** Redimensionar pelos cantos também move o card; ele continua na mesma faixa. */
export function resizeCard(layout: MapLayout, id: string, box: { x: number; y: number; width: number; height: number }): MapLayout {
  const card = layout.cards.get(id);
  const lane = card && layout.lanes.find((item) => item.perspectiveId === card.perspectiveId);
  if (!card || !lane) return layout;
  const cards = new Map(layout.cards);
  cards.set(id, {
    ...card,
    x: Math.max(CARD_LEFT, snapToGrid(box.x)),
    y: Math.max(LANE_PAD_TOP, snapToGrid(box.y - lane.top)),
    width: Math.max(CARD_MIN_WIDTH, snapToGrid(box.width)),
    height: Math.max(CARD_MIN_HEIGHT, snapToGrid(box.height)),
  });
  return computeLayout(laneIdsOf(layout), cards);
}

/** "Organizar": cada faixa em linhas de até quatro cards, na ordem de leitura atual. */
export function arrangeLayout(layout: MapLayout): MapLayout {
  const cards = new Map<string, CardBox>();
  for (const lane of layout.lanes) {
    const laneCards = [...layout.cards.values()]
      .filter((card) => card.perspectiveId === lane.perspectiveId)
      .sort((a, b) => Math.round(a.y / 100) - Math.round(b.y / 100) || a.x - b.x || a.id.localeCompare(b.id));
    let x = CARD_LEFT;
    let y = LANE_PAD_TOP;
    let rowBottom = LANE_PAD_TOP;
    let inRow = 0;
    for (const card of laneCards) {
      if (inRow === ROW_SLOTS) {
        x = CARD_LEFT;
        y = rowBottom + CARD_GAP_Y;
        inRow = 0;
      }
      cards.set(card.id, { ...card, x, y });
      x += card.width + CARD_GAP_X;
      rowBottom = Math.max(rowBottom, y + card.height);
      inRow += 1;
    }
  }
  return computeLayout(laneIdsOf(layout), cards);
}

/** Só o que difere do gravado: é o que o PATCH de layout precisa enviar. */
export function layoutChanges(layout: MapLayout, perspectives: LayoutPerspective[], objectives: LayoutObjective[]): LayoutChanges {
  const laneTop = new Map(layout.lanes.map((lane) => [lane.perspectiveId, lane.top]));
  const storedObjectives = new Map(objectives.map((objective) => [objective.id, objective]));
  const storedPerspectives = new Map(perspectives.map((perspective) => [perspective.id, perspective]));
  const changes: LayoutChanges = { objectives: [], lanes: [] };
  for (const card of layout.cards.values()) {
    const next = {
      id: card.id,
      perspectiveId: card.perspectiveId,
      positionX: card.x,
      positionY: (laneTop.get(card.perspectiveId) ?? 0) + card.y,
      width: card.width,
      height: card.height,
    };
    const stored = storedObjectives.get(card.id);
    if (
      !stored ||
      stored.perspectiveId !== next.perspectiveId ||
      stored.positionX !== next.positionX ||
      stored.positionY !== next.positionY ||
      stored.width !== next.width ||
      stored.height !== next.height
    ) {
      changes.objectives.push(next);
    }
  }
  for (const lane of layout.lanes) {
    const next = { id: lane.perspectiveId, positionX: 0, positionY: lane.top, width: layout.width, height: lane.height };
    const stored = storedPerspectives.get(lane.perspectiveId);
    if (
      !stored ||
      (stored.positionX ?? 0) !== next.positionX ||
      (stored.positionY ?? 0) !== next.positionY ||
      stored.width !== next.width ||
      stored.height !== next.height
    ) {
      changes.lanes.push(next);
    }
  }
  return changes;
}
