/** Escolha de Área → Setor → Formulário na execução de um checklist. */

export interface OrgNodeOption {
  id: string;
  name: string;
  type?: string | null;
  parentId?: string | null;
}

export interface FormOption {
  id: string;
  title: string;
  code?: string | null;
  version?: string | null;
  status?: string | null;
  type?: string | null;
}

export interface ExecuteSelection {
  areaId: string;
  sectorId: string;
  templateId: string;
}

/**
 * Rótulo do formulário na escolha do executor.
 * Ex.: "ISSMA - Atividades Diversas com Equipamento - rev 2026".
 */
export function formOptionLabel(form: FormOption): string {
  const revisao = form.version?.trim() ? ` - rev ${form.version.trim()}` : '';
  return `${form.title}${revisao}`;
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
