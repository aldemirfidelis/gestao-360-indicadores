import { describe, expect, it } from 'vitest';
import {
  AUTOFILL,
  HEADER_PRESETS,
  HEADER_SECTION_CODE,
  autofillHint,
  headerFieldFilter,
  headerFieldFromPreset,
  headerFieldsFromTemplate,
  headerFieldsPayload,
  headerSectionPayload,
} from './header';

const SECTIONS = [
  { id: 'sec-header', code: 'HEADER' },
  { id: 'sec-desvios', code: 'DESVIOS' },
];

describe('headerFieldFromPreset', () => {
  it('converte o preset preservando auto-preenchimento', () => {
    const preset = HEADER_PRESETS.find((p) => p.code === 'RESPONSAVEL')!;
    expect(headerFieldFromPreset(preset)).toEqual({
      code: 'RESPONSAVEL',
      label: 'Responsável pelo preenchimento',
      type: 'USER',
      required: true,
      defaultValue: AUTOFILL.currentUser,
      options: '',
    });
  });

  it('preset sem defaultValue vira campo digitado', () => {
    const preset = HEADER_PRESETS.find((p) => p.code === 'LOCAL')!;
    expect(headerFieldFromPreset(preset).defaultValue).toBe('');
  });
});

describe('headerFieldsPayload', () => {
  const fields = [
    { code: 'LOCAL', label: 'Local', type: 'TEXT', required: true, defaultValue: '', options: '' },
    { code: '', label: '  ', type: 'TEXT', required: false, defaultValue: '', options: '' },
    { code: 'DATA', label: 'Data', type: 'DATETIME', required: true, defaultValue: AUTOFILL.now, options: '' },
  ];

  it('descarta campo sem rótulo e numera na ordem', () => {
    const payload = headerFieldsPayload(fields);
    expect(payload).toHaveLength(2);
    expect(payload.map((f) => f.order)).toEqual([1, 2]);
  });

  it('todo campo do cabeçalho vai marcado com a seção', () => {
    for (const field of headerFieldsPayload(fields)) {
      expect(field.sectionCode).toBe(HEADER_SECTION_CODE);
    }
  });

  it('campo digitado manda defaultValue null, não string vazia', () => {
    expect(headerFieldsPayload(fields)[0].defaultValue).toBeNull();
    expect(headerFieldsPayload(fields)[1].defaultValue).toBe(AUTOFILL.now);
  });
});

describe('headerSectionPayload', () => {
  it('sem campo preenchido, não cria seção à toa', () => {
    expect(headerSectionPayload([])).toEqual([]);
    expect(headerSectionPayload([{ code: '', label: '   ', type: 'TEXT', required: false, defaultValue: '', options: '' }])).toEqual([]);
  });

  it('com campo, a seção vem na posição zero', () => {
    const payload = headerSectionPayload([{ code: 'LOCAL', label: 'Local', type: 'TEXT', required: true, defaultValue: '', options: '' }]);
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({ code: HEADER_SECTION_CODE, position: 0 });
  });
});

describe('headerFieldsFromTemplate', () => {
  it('lê só os campos do cabeçalho, na ordem', () => {
    const fields = [
      { sectionId: 'sec-desvios', label: 'Pergunta', type: 'CONFORMITY', order: 3 },
      { sectionId: 'sec-header', code: 'DATA', label: 'Data', type: 'DATETIME', order: 2, defaultValue: AUTOFILL.now },
      { sectionId: 'sec-header', code: 'LOCAL', label: 'Local', type: 'TEXT', order: 1, required: true },
    ];
    const header = headerFieldsFromTemplate(SECTIONS, fields);
    expect(header.map((f) => f.code)).toEqual(['LOCAL', 'DATA']);
    expect(header[1].defaultValue).toBe(AUTOFILL.now);
  });

  it('modelo sem seção de cabeçalho devolve vazio', () => {
    expect(headerFieldsFromTemplate([{ id: 'x', code: 'OUTRA' }], [{ sectionId: 'x', label: 'a', type: 'TEXT' }])).toEqual([]);
    expect(headerFieldsFromTemplate(undefined, undefined)).toEqual([]);
  });
});

describe('headerFieldFilter', () => {
  it('separa cabeçalho de pergunta — sem isso o campo apareceria duas vezes', () => {
    const isHeader = headerFieldFilter(SECTIONS);
    expect(isHeader({ sectionId: 'sec-header' })).toBe(true);
    expect(isHeader({ sectionId: 'sec-desvios' })).toBe(false);
    expect(isHeader({ sectionId: null })).toBe(false);
  });

  it('sem cabeçalho, nenhum campo é filtrado', () => {
    expect(headerFieldFilter([])({ sectionId: 'qualquer' })).toBe(false);
  });
});

describe('autofillHint', () => {
  it('explica cada marcador em texto de gente', () => {
    expect(autofillHint(AUTOFILL.currentUser)).toContain('quem estiver respondendo');
    expect(autofillHint(AUTOFILL.now)).toContain('data e a hora');
  });

  it('campo digitado não tem explicação', () => {
    expect(autofillHint('')).toBeNull();
  });
});
