import { describe, expect, it } from 'vitest';
import {
  AUTOFILL,
  HEADER_PRESETS,
  HEADER_SECTION_CODE,
  initialHeaderValues,
  isHeaderSection,
  resolveAutofill,
  sortSections,
} from './form-header.logic';

const CONTEXT = {
  userId: 'user-1',
  userName: 'Sebastião Carlos Sales',
  orgNodeId: 'node-9',
  now: new Date('2026-07-26T20:59:34.000Z'),
};

describe('isHeaderSection', () => {
  it('reconhece o código reservado, em qualquer caixa', () => {
    expect(isHeaderSection({ code: HEADER_SECTION_CODE })).toBe(true);
    expect(isHeaderSection({ code: 'header' })).toBe(true);
    expect(isHeaderSection({ code: ' Header ' })).toBe(true);
  });

  it('outra seção não é cabeçalho', () => {
    expect(isHeaderSection({ code: 'DESVIOS' })).toBe(false);
    expect(isHeaderSection({ code: null })).toBe(false);
    expect(isHeaderSection(null)).toBe(false);
  });
});

describe('sortSections', () => {
  it('cabeçalho vem primeiro mesmo com posição maior', () => {
    const ordenadas = sortSections([
      { code: 'DESVIOS', position: 1 },
      { code: 'HEADER', position: 9 },
      { code: 'FOTOS', position: 2 },
    ]);
    expect(ordenadas.map((s) => s.code)).toEqual(['HEADER', 'DESVIOS', 'FOTOS']);
  });

  it('sem cabeçalho, mantém a ordem por posição', () => {
    const ordenadas = sortSections([
      { code: 'B', position: 2 },
      { code: 'A', position: 1 },
    ]);
    expect(ordenadas.map((s) => s.code)).toEqual(['A', 'B']);
  });

  it('não muta o array recebido', () => {
    const original = [{ code: 'DESVIOS', position: 1 }, { code: 'HEADER', position: 9 }];
    sortSections(original);
    expect(original.map((s) => s.code)).toEqual(['DESVIOS', 'HEADER']);
  });
});

describe('resolveAutofill', () => {
  it('usuário atual vira o id de quem preenche', () => {
    expect(resolveAutofill(AUTOFILL.currentUser, CONTEXT)).toBe('user-1');
  });

  it('área do usuário vira o nó organizacional', () => {
    expect(resolveAutofill(AUTOFILL.orgNode, CONTEXT)).toBe('node-9');
  });

  it('agora vira a data/hora de início do preenchimento', () => {
    expect(resolveAutofill(AUTOFILL.now, CONTEXT)).toBe('2026-07-26T20:59:34.000Z');
  });

  it('hoje vira só a data', () => {
    expect(resolveAutofill(AUTOFILL.today, CONTEXT)).toBe('2026-07-26');
  });

  it('valor literal não é marcador', () => {
    expect(resolveAutofill('USINA GOIASA', CONTEXT)).toBeNull();
    expect(resolveAutofill('', CONTEXT)).toBeNull();
    expect(resolveAutofill(null, CONTEXT)).toBeNull();
  });

  it('contexto sem o dado não inventa valor', () => {
    expect(resolveAutofill(AUTOFILL.currentUser, { now: CONTEXT.now })).toBeNull();
    expect(resolveAutofill(AUTOFILL.orgNode, { now: CONTEXT.now })).toBeNull();
  });

  it('marcador desconhecido não vaza o texto cru para a tela', () => {
    expect(resolveAutofill('@inventado', CONTEXT)).toBeNull();
  });
});

describe('initialHeaderValues', () => {
  it('resolve marcadores e preserva valores literais', () => {
    const valores = initialHeaderValues(
      [
        { id: 'f1', defaultValue: AUTOFILL.currentUser },
        { id: 'f2', defaultValue: AUTOFILL.now },
        { id: 'f3', defaultValue: 'USINA GOIASA' },
        { id: 'f4', defaultValue: null },
      ],
      CONTEXT,
    );
    expect(valores).toEqual({ f1: 'user-1', f2: '2026-07-26T20:59:34.000Z', f3: 'USINA GOIASA' });
    expect(valores).not.toHaveProperty('f4');
  });

  it('marcador sem contexto fica de fora, em vez de virar texto', () => {
    const valores = initialHeaderValues([{ id: 'f1', defaultValue: AUTOFILL.currentUser }], { now: CONTEXT.now });
    expect(valores).toEqual({});
  });
});

describe('HEADER_PRESETS', () => {
  it('cobre o cabeçalho de uma inspeção real', () => {
    const codigos = HEADER_PRESETS.map((p) => p.code);
    expect(codigos).toEqual(expect.arrayContaining(['TIPO_INSPECAO', 'RESPONSAVEL', 'AREA', 'SETOR', 'LOCAL', 'DATA_INSPECAO', 'RESPONSAVEL_AREA']));
  });

  it('responsável e data já vêm preenchidos automaticamente', () => {
    expect(HEADER_PRESETS.find((p) => p.code === 'RESPONSAVEL')?.defaultValue).toBe(AUTOFILL.currentUser);
    expect(HEADER_PRESETS.find((p) => p.code === 'DATA_INSPECAO')?.defaultValue).toBe(AUTOFILL.now);
  });

  it('todo preset tem rótulo e tipo válidos', () => {
    for (const preset of HEADER_PRESETS) {
      expect(preset.label.trim().length).toBeGreaterThan(0);
      expect(preset.type.trim().length).toBeGreaterThan(0);
    }
  });
});
