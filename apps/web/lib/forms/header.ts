/**
 * Cabeçalho do formulário no construtor.
 *
 * Espelha `apps/api/src/modules/forms/form-header.logic.ts`: mesmo código de
 * seção reservado e mesmos marcadores de preenchimento automático. O backend é
 * quem resolve os marcadores, na hora em que o preenchimento começa.
 */

export const HEADER_SECTION_CODE = 'HEADER';
export const HEADER_SECTION_TITLE = 'Informações';

export const AUTOFILL = {
  currentUser: '@usuarioAtual',
  orgNode: '@areaDoUsuario',
  now: '@agora',
  today: '@hoje',
} as const;

export interface HeaderFieldForm {
  code: string;
  label: string;
  type: string;
  required: boolean;
  /** Vazio = digitado por quem preenche; `@...` = preenchido sozinho. */
  defaultValue: string;
  options: string;
}

export interface HeaderPreset {
  code: string;
  label: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  options?: string;
}

/** Sugestões para o cabeçalho de uma inspeção — ponto de partida, não regra. */
export const HEADER_PRESETS: HeaderPreset[] = [
  { code: 'TIPO_INSPECAO', label: 'Tipo de inspeção', type: 'SELECT', required: true, options: 'Planejada, Comportamental, Rotina, Extraordinária' },
  { code: 'RESPONSAVEL', label: 'Responsável pelo preenchimento', type: 'USER', required: true, defaultValue: AUTOFILL.currentUser },
  { code: 'AREA', label: 'Área', type: 'ORG_NODE', required: true, defaultValue: AUTOFILL.orgNode },
  { code: 'SETOR', label: 'Setor', type: 'TEXT', required: false },
  { code: 'LOCAL', label: 'Local', type: 'TEXT', required: true },
  { code: 'DATA_INSPECAO', label: 'Data da inspeção', type: 'DATETIME', required: true, defaultValue: AUTOFILL.now },
  { code: 'RESPONSAVEL_AREA', label: 'Responsável da área', type: 'TEXT', required: false },
];

export function headerFieldFromPreset(preset: HeaderPreset): HeaderFieldForm {
  return {
    code: preset.code,
    label: preset.label,
    type: preset.type,
    required: preset.required,
    defaultValue: preset.defaultValue ?? '',
    options: preset.options ?? '',
  };
}

/** Explica o preenchimento automático em texto de gente. */
export function autofillHint(defaultValue: string): string | null {
  switch (defaultValue) {
    case AUTOFILL.currentUser:
      return 'Preenchido com o nome de quem estiver respondendo.';
    case AUTOFILL.orgNode:
      return 'Preenchido com a área do usuário que responder.';
    case AUTOFILL.now:
      return 'Preenchido com a data e a hora em que o preenchimento começar.';
    case AUTOFILL.today:
      return 'Preenchido com a data do dia do preenchimento.';
    default:
      return null;
  }
}

/** Campos do cabeçalho no formato que a API espera (ligados pela seção). */
export function headerFieldsPayload(fields: HeaderFieldForm[]) {
  return fields
    .filter((field) => field.label.trim())
    .map((field, index) => ({
      order: index + 1,
      code: field.code.trim() || null,
      label: field.label.trim(),
      type: field.type,
      required: field.required,
      defaultValue: field.defaultValue || null,
      options: field.options.trim() || null,
      sectionCode: HEADER_SECTION_CODE,
    }));
}

/** Seção do cabeçalho — só existe no payload quando há campo nela. */
export function headerSectionPayload(fields: HeaderFieldForm[]) {
  if (!fields.some((field) => field.label.trim())) return [];
  return [{ code: HEADER_SECTION_CODE, title: HEADER_SECTION_TITLE, position: 0, columns: 2 }];
}

/** Reconstrói o formulário do cabeçalho a partir do que veio da API. */
export function headerFieldsFromTemplate(
  sections: Array<{ id: string; code?: string | null }> | undefined,
  fields: Array<{ sectionId?: string | null; code?: string | null; label: string; type: string; required?: boolean; defaultValue?: string | null; options?: string | null; order?: number }> | undefined,
): HeaderFieldForm[] {
  const headerSection = (sections ?? []).find((section) => String(section.code ?? '').toUpperCase() === HEADER_SECTION_CODE);
  if (!headerSection) return [];
  return (fields ?? [])
    .filter((field) => field.sectionId === headerSection.id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((field) => ({
      code: field.code ?? '',
      label: field.label,
      type: field.type,
      required: Boolean(field.required),
      defaultValue: field.defaultValue ?? '',
      options: field.options ?? '',
    }));
}

/** Ids dos campos que pertencem ao cabeçalho — para não repeti-los nas perguntas. */
export function headerFieldFilter(
  sections: Array<{ id: string; code?: string | null }> | undefined,
): (field: { sectionId?: string | null }) => boolean {
  const headerSection = (sections ?? []).find((section) => String(section.code ?? '').toUpperCase() === HEADER_SECTION_CODE);
  if (!headerSection) return () => false;
  return (field) => field.sectionId === headerSection.id;
}
