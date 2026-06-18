import { describe, expect, it } from 'vitest';
import {
  isValidCpf,
  normalizeHeader,
  parseAtestadoRows,
  parseEligibleRows,
  parseEventRows,
  parseFlexDate,
  parsePtNumber,
} from './prize-eligible-import.util';

describe('normalizeHeader', () => {
  it('remove acentos, caixa e separadores', () => {
    expect(normalizeHeader('Matrícula')).toBe('matricula');
    expect(normalizeHeader(' Centro de Custo ')).toBe('centro_de_custo');
    expect(normalizeHeader('SALÁRIO-BASE')).toBe('salario_base');
    expect(normalizeHeader('Data Admissão')).toBe('data_admissao');
  });
});

describe('parsePtNumber', () => {
  it('aceita formatos pt-BR e en', () => {
    expect(parsePtNumber('3.500,75')).toBe(3500.75);
    expect(parsePtNumber('3500.75')).toBe(3500.75);
    expect(parsePtNumber('3500,75')).toBe(3500.75);
    expect(parsePtNumber('R$ 1.234,50')).toBe(1234.5);
    expect(parsePtNumber('3.500')).toBe(3500); // milhar pt-BR
    expect(parsePtNumber('1.234.567,89')).toBe(1234567.89);
    expect(parsePtNumber(2800)).toBe(2800);
  });
  it('vazio = null; lixo = NaN', () => {
    expect(parsePtNumber('')).toBeNull();
    expect(parsePtNumber(null)).toBeNull();
    expect(Number.isNaN(parsePtNumber('abc') as number)).toBe(true);
  });
});

describe('parseFlexDate', () => {
  it('aceita dd/mm/aaaa, ISO, Date e serial Excel', () => {
    expect(parseFlexDate('10/01/2022')).toBe('2022-01-10');
    expect(parseFlexDate('2022-01-10')).toBe('2022-01-10');
    expect(parseFlexDate(new Date(Date.UTC(2022, 0, 10)))).toBe('2022-01-10');
    expect(parseFlexDate(44571)).toBe('2022-01-10'); // serial Excel
  });
  it('rejeita data inexistente e lixo', () => {
    expect(parseFlexDate('31/02/2023')).toBe('INVALID');
    expect(parseFlexDate('ontem')).toBe('INVALID');
    expect(parseFlexDate('')).toBeNull();
  });
});

describe('isValidCpf', () => {
  it('valida digito verificador', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true); // CPF de exemplo valido (gerador)
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('52998224724')).toBe(false); // DV errado
    expect(isValidCpf('111.111.111-11')).toBe(false); // todos iguais
    expect(isValidCpf('123')).toBe(false);
  });
});

const validRow = {
  matricula: '1001',
  nome: 'Ana Silva',
  cpf: '529.982.247-25',
  cargo: 'Operador I',
  area: 'Producao',
  centro_de_custo: 'CC-100',
  salario_base: '3.500,75',
  data_admissao: '10/01/2022',
  situacao: 'ATIVO',
  dias_trabalhados: 30,
};

describe('parseEligibleRows', () => {
  it('linha valida completa vira EligibleRow normalizada', () => {
    const out = parseEligibleRows([validRow]);
    expect(out.errors).toHaveLength(0);
    expect(out.rows).toHaveLength(1);
    const r = out.rows[0];
    expect(r.registration).toBe('1001');
    expect(r.name).toBe('Ana Silva');
    expect(r.cpf).toBe('52998224725');
    expect(r.baseSalary).toBe(3500.75);
    expect(r.admissionDate).toBe('2022-01-10');
    expect(r.situation).toBe('ACTIVE');
    expect(r.workedDays).toBe(30);
  });

  it('aceita cabecalhos com acento/caixa diferentes', () => {
    const out = parseEligibleRows([{ 'Matrícula': '2', 'Nome': 'B', 'Salário Base': '1000', 'Situação': 'Férias' }]);
    expect(out.errors).toHaveLength(0);
    expect(out.rows[0].baseSalary).toBe(1000);
    expect(out.rows[0].situation).toBe('VACATION');
  });

  it('rejeita matricula/nome ausentes e matricula duplicada', () => {
    const out = parseEligibleRows([
      { nome: 'Sem Matricula' },
      { matricula: '10' },
      { matricula: '11', nome: 'Ok' },
      { matricula: '11', nome: 'Duplicado' },
    ]);
    expect(out.rows).toHaveLength(1);
    expect(out.errors.map((e) => e.column)).toEqual(['matricula', 'nome', 'matricula']);
    expect(out.errors[2].message).toContain('duplicada');
  });

  it('rejeita CPF com DV invalido (pagamento nao pode errar)', () => {
    const out = parseEligibleRows([{ ...validRow, cpf: '529.982.247-24' }]);
    expect(out.rows).toHaveLength(0);
    expect(out.errors[0].column).toBe('cpf');
  });

  it('rejeita salario negativo/invalido; avisa salario ausente ou zerado', () => {
    const neg = parseEligibleRows([{ ...validRow, salario_base: '-10' }]);
    expect(neg.errors[0].column).toBe('salario_base');
    const bad = parseEligibleRows([{ ...validRow, salario_base: 'tres mil' }]);
    expect(bad.errors[0].column).toBe('salario_base');
    const missing = parseEligibleRows([{ matricula: '1', nome: 'X' }]);
    expect(missing.errors).toHaveLength(0);
    expect(missing.warnings.some((w) => w.column === 'salario_base')).toBe(true);
    const zero = parseEligibleRows([{ ...validRow, salario_base: 0 }]);
    expect(zero.warnings.some((w) => w.column === 'salario_base')).toBe(true);
  });

  it('rejeita datas invalidas e desligamento anterior a admissao', () => {
    const bad = parseEligibleRows([{ ...validRow, data_admissao: '31/02/2023' }]);
    expect(bad.errors[0].column).toBe('data_admissao');
    const inverted = parseEligibleRows([{ ...validRow, data_desligamento: '01/01/2020' }]);
    expect(inverted.errors[0].column).toBe('data_desligamento');
  });

  it('rejeita dias trabalhados fora de 0..31', () => {
    const out = parseEligibleRows([{ ...validRow, dias_trabalhados: 45 }]);
    expect(out.errors[0].column).toBe('dias_trabalhados');
  });

  it('avisa situacao desconhecida e desligado sem data', () => {
    const unknown = parseEligibleRows([{ ...validRow, situacao: 'SUMIDO' }]);
    expect(unknown.errors).toHaveLength(0);
    expect(unknown.warnings.some((w) => w.column === 'situacao')).toBe(true);
    const term = parseEligibleRows([{ ...validRow, situacao: 'DESLIGADO' }]);
    expect(term.warnings.some((w) => w.column === 'data_desligamento')).toBe(true);
  });

  it('reporta colunas desconhecidas (typo) sem perder a linha', () => {
    const out = parseEligibleRows([{ ...validRow, salariooo: 123 }]);
    expect(out.unknownColumns).toContain('salariooo');
    expect(out.rows).toHaveLength(1);
  });
});

describe('parseAtestadoRows', () => {
  it('aceita cabecalhos nativos do Apdata DatasAtestados', () => {
    const out = parseAtestadoRows([
      {
        'Id Contratado': '900415',
        Nome: 'Armando Donizetti Miranda',
        'Data Início na Situação': new Date(Date.UTC(2026, 3, 2)),
        'Data Fim da Situação': new Date(Date.UTC(2026, 3, 2)),
        'Quantidade de Dias': 1,
        'Código Oficial CID': 'F41.1',
        'Doença CID': 'Ansiedade generalizada',
        'Tipo de atestado': 'Atestado Médico Normal',
      },
    ], new Set(['900415']));

    expect(out.errors).toHaveLength(0);
    expect(out.warnings).toHaveLength(0);
    expect(out.unknownColumns).toHaveLength(0);
    expect(out.events[0]).toMatchObject({
      registration: '900415',
      type: 'ATESTADO',
      date: '2026-04-02',
      days: 1,
    });
    expect(out.events[0].description).toContain('F41.1');
  });

  it('ignora atestado de contratado fora da base elegivel sem bloquear importacao', () => {
    const out = parseAtestadoRows([
      {
        'Id Contratado': '900415',
        'Data Início na Situação': '01/04/2026',
        'Data Fim da Situação': '01/04/2026',
        'Quantidade de Dias': 1,
      },
      {
        'Id Contratado': '947115',
        'Data Início na Situação': '02/04/2026',
        'Data Fim da Situação': '02/04/2026',
        'Quantidade de Dias': 1,
      },
    ], new Set(['900415']));

    expect(out.errors).toHaveLength(0);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0].message).toContain('ignorado');
    expect(out.events).toHaveLength(1);
    expect(out.events[0].registration).toBe('900415');
  });
});

describe('parseEventRows', () => {
  it('mapeia tipo com alias e normaliza valores', () => {
    const out = parseEventRows([
      { matricula: '1001', tipo: 'Falta', data: '05/03/2026', dias: '2' },
      { matricula: '1001', tipo: 'medida disciplinar', dias: 1 },
    ]);
    expect(out.errors).toHaveLength(0);
    expect(out.events[0]).toMatchObject({ registration: '1001', type: 'FALTA', date: '2026-03-05', days: 2 });
    expect(out.events[1].type).toBe('MEDIDA_DISCIPLINAR');
  });

  it('REJEITA tipo desconhecido (nao casaria com regra de moderador)', () => {
    const out = parseEventRows([{ matricula: '1', tipo: 'FALTOU' }]);
    expect(out.events).toHaveLength(0);
    expect(out.errors[0].column).toBe('tipo');
  });

  it('rejeita matricula fora da base quando a base e conhecida', () => {
    const out = parseEventRows([{ matricula: '999', tipo: 'FALTA', dias: 1 }], new Set(['1001']));
    expect(out.errors[0].message).toContain('não existe na base');
  });

  it('avisa falta/atestado sem dias e rejeita dias fora da faixa', () => {
    const warn = parseEventRows([{ matricula: '1', tipo: 'ATESTADO' }]);
    expect(warn.warnings.some((w) => w.column === 'dias')).toBe(true);
    const bad = parseEventRows([{ matricula: '1', tipo: 'FALTA', dias: 40 }]);
    expect(bad.errors[0].column).toBe('dias');
  });
});
