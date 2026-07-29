/**
 * Escolha de Área → Setor no preenchimento de um checklist.
 *
 * O formulário não entra aqui: quem chega nesta tela já clicou em "Preencher"
 * no modelo, e repetir a escolha só permitia divergir do que está sendo
 * respondido.
 */

export interface OrgNodeOption {
  id: string;
  name: string;
  type?: string | null;
  parentId?: string | null;
}

export interface ExecuteSelection {
  areaId: string;
  sectorId: string;
}

/** Setores são os filhos diretos da área escolhida na árvore organizacional. */
export function sectorsOf(nodes: OrgNodeOption[], areaId: string): OrgNodeOption[] {
  if (!areaId) return [];
  return nodes.filter((node) => node.parentId === areaId);
}

/** Áreas são os nós que têm filhos; árvore rasa devolve tudo, em vez de nada. */
export function areasOf(nodes: OrgNodeOption[]): OrgNodeOption[] {
  const comFilhos = new Set(nodes.map((node) => node.parentId).filter(Boolean) as string[]);
  const areas = nodes.filter((node) => comFilhos.has(node.id));
  return areas.length > 0 ? areas : nodes;
}
