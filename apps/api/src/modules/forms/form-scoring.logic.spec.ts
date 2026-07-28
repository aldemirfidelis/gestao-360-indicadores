import { describe, expect, it } from 'vitest';
import { classifyAnswer, conformityScore, conformitySummary } from './form-scoring.logic';

const conforme = (n: number) => Array.from({ length: n }, () => ({ fieldType: 'CONFORMITY', value: 'Conforme' }));

describe('classifyAnswer', () => {
  it('reconhece conformidade em variações de escrita', () => {
    for (const value of ['Conforme', 'conforme', 'C', 'OK', 'Sim', 'aprovado']) {
      expect(classifyAnswer({ fieldType: 'CONFORMITY', value })).toBe('CONFORME');
    }
  });

  it('reconhece desvio com e sem acento', () => {
    for (const value of ['Não conforme', 'Nao conforme', 'NC', 'nok', 'Reprovado', 'Não']) {
      expect(classifyAnswer({ fieldType: 'CONFORMITY', value })).toBe('NAO_CONFORME');
    }
  });

  it('reconhece não aplicável', () => {
    for (const value of ['Não aplicável', 'Nao aplicavel', 'N/A', 'não se aplica']) {
      expect(classifyAnswer({ fieldType: 'CONFORMITY', value })).toBe('NAO_APLICAVEL');
    }
  });

  it('campo de registro não vira nota', () => {
    expect(classifyAnswer({ fieldType: 'TEXT', value: 'Conforme' })).toBe('IGNORADO');
    expect(classifyAnswer({ fieldType: 'PHOTO', value: 'foto.jpg' })).toBe('IGNORADO');
    expect(classifyAnswer({ fieldType: 'DATE', value: '2026-07-27' })).toBe('IGNORADO');
  });

  it('sem resposta ou com valor estranho, não inventa veredito', () => {
    expect(classifyAnswer({ fieldType: 'CONFORMITY', value: '' })).toBe('IGNORADO');
    expect(classifyAnswer({ fieldType: 'CONFORMITY', value: null })).toBe('IGNORADO');
    expect(classifyAnswer({ fieldType: 'CONFORMITY', value: 'talvez' })).toBe('IGNORADO');
  });
});

describe('conformityScore', () => {
  it('34 questões todas conformes = 100%', () => {
    const resultado = conformityScore(conforme(34));
    expect(resultado.percent).toBe(100);
    expect(resultado.conformes).toBe(34);
    expect(resultado.avaliados).toBe(34);
  });

  it('uma não conforme em 34 derruba o percentual', () => {
    const resultado = conformityScore([...conforme(33), { fieldType: 'CONFORMITY', value: 'Não conforme' }]);
    expect(resultado.percent).toBe(97.1);
    expect(resultado.naoConformes).toBe(1);
  });

  it('não aplicável sai da conta — 30 conformes + 4 N/A ainda é 100%', () => {
    const resultado = conformityScore([
      ...conforme(30),
      ...Array.from({ length: 4 }, () => ({ fieldType: 'CONFORMITY', value: 'Não aplicável' })),
    ]);
    expect(resultado.percent).toBe(100);
    expect(resultado.avaliados).toBe(30);
    expect(resultado.naoAplicaveis).toBe(4);
  });

  it('metade conforme = 50%', () => {
    const resultado = conformityScore([
      ...conforme(5),
      ...Array.from({ length: 5 }, () => ({ fieldType: 'CONFORMITY', value: 'NC' })),
    ]);
    expect(resultado.percent).toBe(50);
  });

  it('item com peso maior pesa mais na conta', () => {
    // Um crítico (peso 3) reprovado e dois normais conformes: 2/(2+3) = 40%.
    const resultado = conformityScore([
      { fieldType: 'CONFORMITY', value: 'Conforme', weight: 1 },
      { fieldType: 'CONFORMITY', value: 'Conforme', weight: 1 },
      { fieldType: 'CONFORMITY', value: 'Não conforme', weight: 3 },
    ]);
    expect(resultado.percent).toBe(40);
  });

  it('peso inválido cai para 1, sem quebrar a conta', () => {
    const resultado = conformityScore([
      { fieldType: 'CONFORMITY', value: 'Conforme', weight: 0 },
      { fieldType: 'CONFORMITY', value: 'Não conforme', weight: null },
    ]);
    expect(resultado.percent).toBe(50);
  });

  it('campos de registro não diluem o percentual', () => {
    const resultado = conformityScore([
      ...conforme(2),
      { fieldType: 'TEXT', value: 'Observação qualquer' },
      { fieldType: 'PHOTO', value: 'foto.jpg' },
    ]);
    expect(resultado.percent).toBe(100);
    expect(resultado.avaliados).toBe(2);
  });

  it('sem item avaliável, percentual é null (não é zero)', () => {
    expect(conformityScore([]).percent).toBeNull();
    expect(conformityScore([{ fieldType: 'TEXT', value: 'x' }]).percent).toBeNull();
    // Zero significaria "tudo reprovado"; null significa "nada a avaliar".
    expect(conformityScore([{ fieldType: 'CONFORMITY', value: 'N/A' }]).percent).toBeNull();
  });

  it('sim/não também contam, para checklist simples', () => {
    expect(conformityScore([{ fieldType: 'YES_NO', value: 'Sim' }, { fieldType: 'BOOLEAN', value: 'Nao' }]).percent).toBe(50);
  });
});

describe('conformitySummary', () => {
  it('resume em uma linha legível', () => {
    expect(conformitySummary(conformityScore([...conforme(33), { fieldType: 'CONFORMITY', value: 'NC' }]))).toBe(
      '97,1% — 33 de 34 conformes',
    );
  });

  it('cita os não aplicáveis quando houver', () => {
    const resumo = conformitySummary(conformityScore([...conforme(30), { fieldType: 'CONFORMITY', value: 'N/A' }]));
    expect(resumo).toContain('1 não aplicável');
  });

  it('sem item avaliável, diz isso em vez de 0%', () => {
    expect(conformitySummary(conformityScore([]))).toBe('Sem itens avaliáveis');
  });
});
