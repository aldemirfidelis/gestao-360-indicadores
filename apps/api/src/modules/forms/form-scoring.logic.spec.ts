import { describe, expect, it } from 'vitest';
import { classifyAnswer, conformityScore, conformitySummary, effectiveWeight, scoreSheet } from './form-scoring.logic';

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

  // Checklist real (ISSMA) montado com lista de opções em vez do tipo Conformidade.
  it('lista de opção com vocabulário de conformidade conta como avaliação', () => {
    expect(classifyAnswer({ fieldType: 'SELECT', value: 'Conforme' })).toBe('CONFORME');
    expect(classifyAnswer({ fieldType: 'SELECT', value: 'Não Conforme' })).toBe('NAO_CONFORME');
    expect(classifyAnswer({ fieldType: 'SELECT', value: 'Não se Aplica' })).toBe('NAO_APLICAVEL');
    expect(classifyAnswer({ fieldType: 'RADIO', value: 'NC' })).toBe('NAO_CONFORME');
  });

  it('lista sem vocabulário de conformidade fica fora da conta', () => {
    // "Tipo de inspeção: IG, ST, GE, RE" é registro, não julgamento.
    expect(classifyAnswer({ fieldType: 'SELECT', value: 'IG' })).toBe('IGNORADO');
    // Sim/Não numa lista genérica é ambíguo: só conta em campo Sim/Não declarado.
    expect(classifyAnswer({ fieldType: 'SELECT', value: 'Sim' })).toBe('IGNORADO');
    expect(classifyAnswer({ fieldType: 'SELECT', value: 'Não' })).toBe('IGNORADO');
    expect(classifyAnswer({ fieldType: 'YES_NO', value: 'Sim' })).toBe('CONFORME');
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

  // Regressão: o ISSMA de produção saía "Sem itens avaliáveis" e o indicador
  // nunca recebia a média. Cabeçalho (texto/data/usuário), lista de contexto
  // ("Tipo de inspeção") e observações finais convivem com as perguntas.
  it('inspeção montada com lista de opções resulta em percentual, não em nulo', () => {
    const resultado = conformityScore([
      { fieldType: 'TEXT', value: 'Frente 3' },
      { fieldType: 'DATETIME', value: '2026-08-03T09:46' },
      { fieldType: 'SELECT', value: 'IG' },
      { fieldType: 'USER', value: 'Aldemir' },
      ...Array.from({ length: 8 }, () => ({ fieldType: 'SELECT', value: 'Conforme', weight: 1 })),
      { fieldType: 'SELECT', value: 'Não Conforme', weight: 1 },
      { fieldType: 'SELECT', value: 'Não se Aplica', weight: 1 },
      { fieldType: 'TEXTAREA', value: 'Sem observações', weight: 1 },
    ]);
    expect(resultado.percent).toBe(88.9);
    expect(resultado.conformes).toBe(8);
    expect(resultado.naoConformes).toBe(1);
    expect(resultado.naoAplicaveis).toBe(1);
    // Tudo valendo 1 e nada fora do resultado: segue sendo checklist comum.
    expect(resultado.usaNotas).toBe(false);
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

describe('nota por pergunta', () => {
  it('a nota do modelo define quanto o item vale na conta', () => {
    // Nota 30 + nota 30 + nota 40; só a de 40 reprovada => 60 de 100 = 60%.
    const resultado = conformityScore([
      { fieldType: 'CONFORMITY', value: 'Conforme', weight: 30 },
      { fieldType: 'CONFORMITY', value: 'Conforme', weight: 30 },
      { fieldType: 'CONFORMITY', value: 'Não conforme', weight: 40 },
    ]);
    expect(resultado.percent).toBe(60);
    expect(resultado.pesoConforme).toBe(60);
    expect(resultado.pesoAvaliado).toBe(100);
    expect(resultado.usaNotas).toBe(true);
  });

  it('item não aplicável devolve os pontos dele ao total, mantendo o 100%', () => {
    // Se a pergunta de nota 40 não se aplica, disputam-se só 60 pontos.
    const resultado = conformityScore([
      { fieldType: 'CONFORMITY', value: 'Conforme', weight: 30 },
      { fieldType: 'CONFORMITY', value: 'Conforme', weight: 30 },
      { fieldType: 'CONFORMITY', value: 'N/A', weight: 40 },
    ]);
    expect(resultado.percent).toBe(100);
    expect(resultado.pesoAvaliado).toBe(60);
  });

  it('a nota escrita manda; criticidade só vale quando não há nota', () => {
    // Sem nota, crítico continua pesando 3 (comportamento antigo preservado).
    expect(effectiveWeight(null, true)).toBe(3);
    expect(effectiveWeight(null, false)).toBe(1);
    // Com nota, o número do autor prevalece — 30 crítico vale 30, não 90.
    expect(effectiveWeight(30, true)).toBe(30);
    expect(effectiveWeight(1, true)).toBe(1);
  });

  it('modelo sem nota nenhuma não é marcado como pontuado', () => {
    expect(conformityScore(conforme(3)).usaNotas).toBe(false);
    // Crítico sozinho não é "nota": quem definiu peso foi o sistema, não o autor.
    expect(conformityScore([{ fieldType: 'CONFORMITY', value: 'Conforme', critical: true }]).usaNotas).toBe(false);
  });

  it('scoreSheet: conforme ganha a nota inteira, reprovado zera, o resto é null', () => {
    const { items } = scoreSheet([
      { fieldType: 'CONFORMITY', value: 'Conforme', weight: 30 },
      { fieldType: 'CONFORMITY', value: 'Não conforme', weight: 30 },
      // N/A, sem resposta e campo de registro não valem ponto nenhum.
      { fieldType: 'CONFORMITY', value: 'N/A', weight: 30 },
      { fieldType: 'CONFORMITY', value: '', weight: 30 },
      { fieldType: 'TEXT', value: 'observação', weight: 30 },
    ]);
    expect(items.map((item) => item.points)).toEqual([30, 0, null, null, null]);
  });
});

describe('pergunta sem nota', () => {
  // Regra do usuário: nem toda pergunta tem nota. Num checklist pontuado, a
  // pergunta sem nota é respondida mas fica fora do resultado.
  const misto = [
    { fieldType: 'CONFORMITY', value: 'Conforme', weight: 70 },
    { fieldType: 'CONFORMITY', value: 'Não conforme', weight: 30 },
    { fieldType: 'CONFORMITY', value: 'Não conforme', weight: null },
    { fieldType: 'CONFORMITY', value: 'Conforme' },
  ];

  it('num checklist pontuado, só as perguntas com nota entram no resultado', () => {
    const resultado = conformityScore(misto);
    // 70 de 100: as duas sem nota não somaram nem subtraíram nada.
    expect(resultado.percent).toBe(70);
    expect(resultado.pesoAvaliado).toBe(100);
    expect(resultado.semNota).toBe(2);
    expect(resultado.usaNotas).toBe(true);
  });

  it('a pergunta sem nota não recebe pontos, nem zero', () => {
    const { items } = scoreSheet(misto);
    expect(items.map((item) => item.points)).toEqual([70, 0, null, null]);
    expect(items.map((item) => item.outOfScore)).toEqual([false, false, true, true]);
    // Uma reprovação sem nota não vira "0 de 0" no relatório: ela está fora.
    expect(items[2].note).toBeNull();
  });

  it('sem nota nenhuma no modelo, todas as perguntas valem igual (checklist comum)', () => {
    const resultado = conformityScore([
      { fieldType: 'CONFORMITY', value: 'Conforme' },
      { fieldType: 'CONFORMITY', value: 'Conforme' },
      { fieldType: 'CONFORMITY', value: 'Não conforme' },
    ]);
    expect(resultado.percent).toBe(66.7);
    expect(resultado.semNota).toBe(0);
    expect(resultado.usaNotas).toBe(false);
  });

  it('formulário antigo (tudo com nota 1) continua sendo checklist comum', () => {
    // O default antigo da coluna era 1: sem isso, todo modelo já existente
    // passaria a exibir "pontos" de uma hora para outra.
    const resultado = conformityScore([
      { fieldType: 'CONFORMITY', value: 'Conforme', weight: 1 },
      { fieldType: 'CONFORMITY', value: 'Não conforme', weight: 1 },
    ]);
    expect(resultado.percent).toBe(50);
    expect(resultado.usaNotas).toBe(false);
  });

  it('só as perguntas escolhidas pontuam, mesmo com nota 1', () => {
    // Autor quis "só estas duas contam" sem inventar pesos.
    const resultado = conformityScore([
      { fieldType: 'CONFORMITY', value: 'Conforme', weight: 1 },
      { fieldType: 'CONFORMITY', value: 'Não conforme', weight: 1 },
      { fieldType: 'CONFORMITY', value: 'Não conforme', weight: null },
    ]);
    expect(resultado.percent).toBe(50);
    expect(resultado.usaNotas).toBe(true);
    expect(resultado.semNota).toBe(1);
  });

  it('item crítico sem nota não é promovido a nota num checklist pontuado', () => {
    const resultado = conformityScore([
      { fieldType: 'CONFORMITY', value: 'Conforme', weight: 50 },
      { fieldType: 'CONFORMITY', value: 'Não conforme', critical: true },
    ]);
    // O crítico ficou fora: quem pontua é a nota, e ele não tem nota.
    expect(resultado.percent).toBe(100);
    expect(resultado.semNota).toBe(1);
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

  it('com notas, resume em pontos — que é o que o usuário conferiu', () => {
    const resumo = conformitySummary(
      conformityScore([
        { fieldType: 'CONFORMITY', value: 'Conforme', weight: 70 },
        { fieldType: 'CONFORMITY', value: 'NC', weight: 30 },
      ]),
    );
    expect(resumo).toBe('70% — 70 de 100 pontos');
  });
});
