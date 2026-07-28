import { describe, expect, it } from 'vitest';
import { averageConformity, competenceOf, competenceRange, groupForIndicator } from './form-indicator.logic';

/** 10 frentes de serviço no mesmo setor, mesmo formulário, mesmo mês. */
function frentes(scores: number[], overrides: Partial<{ orgNodeId: string; templateId: string; mes: string }> = {}) {
  const { orgNodeId = 'setor-colheita', templateId = 'issma', mes = '2026-07' } = overrides;
  return scores.map((score, index) => ({
    id: `insp-${index + 1}`,
    orgNodeId,
    templateId,
    score,
    completedAt: `${mes}-15T12:00:00.000Z`,
  }));
}

describe('competenceOf', () => {
  it('extrai o mês da conclusão', () => {
    expect(competenceOf('2026-07-26T20:59:34.000Z')).toBe('2026-07');
    expect(competenceOf(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01');
  });

  it('data ausente ou inválida não vira competência', () => {
    expect(competenceOf(null)).toBeNull();
    expect(competenceOf('nao e data')).toBeNull();
  });
});

describe('groupForIndicator', () => {
  it('10 inspeções ISSMA viram uma média — soma dividida por 10', () => {
    const grupos = groupForIndicator(frentes([100, 100, 90, 80, 100, 95, 70, 100, 85, 90]));
    expect(grupos).toHaveLength(1);
    expect(grupos[0].count).toBe(10);
    // (100+100+90+80+100+95+70+100+85+90)/10 = 91
    expect(grupos[0].value).toBe(91);
    expect(grupos[0].competence).toBe('2026-07');
    expect(grupos[0].orgNodeId).toBe('setor-colheita');
  });

  it('todas conformes dá 100 no indicador', () => {
    expect(groupForIndicator(frentes(Array(10).fill(100)))[0].value).toBe(100);
  });

  it('cada inspeção pesa igual, não importa o tamanho do checklist', () => {
    // Duas inspeções: uma 100%, outra 50% → 75%, mesmo que uma tivesse 34
    // questões e a outra 4.
    expect(groupForIndicator(frentes([100, 50]))[0].value).toBe(75);
  });

  it('separa por setor', () => {
    const grupos = groupForIndicator([
      ...frentes([100, 100], { orgNodeId: 'setor-colheita' }),
      ...frentes([50, 50], { orgNodeId: 'setor-plantio' }),
    ]);
    expect(grupos).toHaveLength(2);
    expect(grupos.find((g) => g.orgNodeId === 'setor-colheita')?.value).toBe(100);
    expect(grupos.find((g) => g.orgNodeId === 'setor-plantio')?.value).toBe(50);
  });

  it('separa por formulário — ISSMA não se mistura com outro checklist', () => {
    const grupos = groupForIndicator([
      ...frentes([100, 100], { templateId: 'issma' }),
      ...frentes([40, 60], { templateId: 'ordem-servico' }),
    ]);
    expect(grupos).toHaveLength(2);
    expect(grupos.find((g) => g.templateId === 'issma')?.value).toBe(100);
  });

  it('separa por mês — a NC entra na competência em que ocorreu', () => {
    const grupos = groupForIndicator([...frentes([100], { mes: '2026-06' }), ...frentes([50], { mes: '2026-07' })]);
    expect(grupos.map((g) => `${g.competence}:${g.value}`)).toEqual(['2026-06:100', '2026-07:50']);
  });

  it('ignora o que não é medição', () => {
    const grupos = groupForIndicator([
      { id: 'a', orgNodeId: 'setor', templateId: 't', score: null, completedAt: '2026-07-01T00:00:00Z' },
      { id: 'b', orgNodeId: null, templateId: 't', score: 100, completedAt: '2026-07-01T00:00:00Z' },
      { id: 'c', orgNodeId: 'setor', templateId: 't', score: 100, completedAt: null },
    ]);
    expect(grupos).toEqual([]);
  });

  it('arredonda para uma casa', () => {
    // (100+100+90)/3 = 96,666...
    expect(groupForIndicator(frentes([100, 100, 90]))[0].value).toBe(96.7);
  });

  it('guarda quais inspeções entraram na conta (auditoria do número)', () => {
    const grupo = groupForIndicator(frentes([100, 80]))[0];
    expect(grupo.submissionIds).toEqual(['insp-1', 'insp-2']);
  });
});

describe('averageConformity', () => {
  it('média simples ignorando vazios', () => {
    expect(averageConformity([100, 80, null, undefined])).toBe(90);
  });

  it('sem valor válido devolve null, não zero', () => {
    expect(averageConformity([])).toBeNull();
    expect(averageConformity([null])).toBeNull();
  });
});

describe('competenceRange', () => {
  it('cobre o mês inteiro', () => {
    const range = competenceRange('2026-07')!;
    expect(range.start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-07-31T23:59:59.999Z');
  });

  it('fevereiro bissexto tem 29 dias', () => {
    expect(competenceRange('2024-02')!.end.toISOString()).toBe('2024-02-29T23:59:59.999Z');
  });

  it('competência inválida devolve null', () => {
    expect(competenceRange('2026-13')).toBeNull();
    expect(competenceRange('julho')).toBeNull();
  });
});
