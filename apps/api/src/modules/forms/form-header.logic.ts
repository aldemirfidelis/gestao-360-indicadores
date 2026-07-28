/**
 * Cabeçalho do formulário — o bloco de contexto que vem ANTES das perguntas.
 *
 * Numa inspeção, quem lê o registro depois precisa saber onde foi, em que área,
 * que tipo de inspeção era, quem preencheu e quando. Isso não é pergunta: é o
 * cabeçalho do documento. Antes, quem montava o modelo só tinha uma lista plana
 * de campos e precisava repetir isso como se fossem perguntas.
 *
 * Implementado sobre o que já existe — `FormTemplateSection` com `code`
 * reservado e `FormField.defaultValue` para o preenchimento automático. Sem
 * tabela nova e sem migração.
 */

/** Código reservado da seção de cabeçalho. */
export const HEADER_SECTION_CODE = 'HEADER';

/**
 * Marcadores de preenchimento automático em `defaultValue`.
 * Resolvidos quando o preenchimento COMEÇA, não quando o modelo é salvo — o
 * valor certo é o de quem preenche, na hora em que preenche.
 */
export const AUTOFILL = {
  currentUser: '@usuarioAtual',
  now: '@agora',
  today: '@hoje',
  orgNode: '@areaDoUsuario',
} as const;

export interface HeaderFieldSeed {
  code: string;
  label: string;
  type: string;
  required: boolean;
  defaultValue?: string | null;
  helpText?: string | null;
  options?: string | null;
}

/**
 * Sugestões de cabeçalho para inspeção — ponto de partida, não obrigação.
 * Quem monta o modelo adiciona, remove, renomeia e reordena à vontade.
 */
export const HEADER_PRESETS: HeaderFieldSeed[] = [
  { code: 'TIPO_INSPECAO', label: 'Tipo de inspeção', type: 'SELECT', required: true, options: 'Planejada,Comportamental,Rotina,Extraordinária' },
  { code: 'RESPONSAVEL', label: 'Responsável pelo preenchimento', type: 'USER', required: true, defaultValue: AUTOFILL.currentUser, helpText: 'Preenchido automaticamente com quem está respondendo.' },
  { code: 'AREA', label: 'Área', type: 'ORG_NODE', required: true, defaultValue: AUTOFILL.orgNode },
  { code: 'SETOR', label: 'Setor', type: 'TEXT', required: false },
  { code: 'LOCAL', label: 'Local', type: 'TEXT', required: true },
  { code: 'DATA_INSPECAO', label: 'Data da inspeção', type: 'DATETIME', required: true, defaultValue: AUTOFILL.now, helpText: 'Preenchido automaticamente com a data e hora de início.' },
  { code: 'RESPONSAVEL_AREA', label: 'Responsável da área', type: 'TEXT', required: false },
];

export interface ParsedSection {
  code: string | null;
  title: string;
  description: string | null;
  position: number;
  columns: number;
  repeatable: boolean;
}

/** É a seção de cabeçalho? */
export function isHeaderSection(section: { code?: string | null } | null | undefined): boolean {
  return String(section?.code ?? '').trim().toUpperCase() === HEADER_SECTION_CODE;
}

/**
 * Ordena as seções garantindo que o cabeçalho venha primeiro.
 * O autor pode arrastar seções; o cabeçalho é sempre o topo do documento.
 */
export function sortSections<T extends { code?: string | null; position?: number | null }>(sections: T[]): T[] {
  return [...sections].sort((a, b) => {
    const headerA = isHeaderSection(a) ? 0 : 1;
    const headerB = isHeaderSection(b) ? 0 : 1;
    if (headerA !== headerB) return headerA - headerB;
    return (a.position ?? 0) - (b.position ?? 0);
  });
}

export interface AutofillContext {
  userId?: string | null;
  userName?: string | null;
  orgNodeId?: string | null;
  now?: Date;
}

/**
 * Resolve um marcador de preenchimento automático.
 * Devolve `null` quando não é marcador (valor literal fica como está) ou quando
 * o contexto não tem o dado — melhor campo vazio que texto `@usuarioAtual`
 * aparecendo para quem preenche.
 */
export function resolveAutofill(defaultValue: string | null | undefined, context: AutofillContext): string | null {
  const token = String(defaultValue ?? '').trim();
  if (!token.startsWith('@')) return null;

  const now = context.now ?? new Date();
  switch (token) {
    case AUTOFILL.currentUser:
      return context.userId ?? null;
    case AUTOFILL.orgNode:
      return context.orgNodeId ?? null;
    case AUTOFILL.now:
      return now.toISOString();
    case AUTOFILL.today:
      return now.toISOString().slice(0, 10);
    default:
      // Marcador desconhecido: não inventa valor nem vaza o texto cru.
      return null;
  }
}

/** Valores iniciais do cabeçalho para um preenchimento que começa agora. */
export function initialHeaderValues(
  fields: Array<{ id: string; code?: string | null; defaultValue?: string | null }>,
  context: AutofillContext,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const resolved = resolveAutofill(field.defaultValue, context);
    if (resolved !== null) values[field.id] = resolved;
    else if (field.defaultValue && !String(field.defaultValue).startsWith('@')) values[field.id] = String(field.defaultValue);
  }
  return values;
}
