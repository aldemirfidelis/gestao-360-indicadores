import { describe, expect, it } from 'vitest';
import { buildQualifCadRows, dueDateFor, OBLIGATION_TEMPLATES, parseQualifCadReturn, qualifCadCsv } from './payroll-obligations.logic';

describe('payroll-obligations.logic', () => {
  it('calcula vencimento no mês seguinte à competência', () => {
    expect(dueDateFor('2026-07', 15)).toBe('2026-08-15');
    expect(dueDateFor('2026-12', 20)).toBe('2027-01-20');
    expect(dueDateFor('2026-07', 0)).toBeNull(); // sem vencimento fixo (DET)
    // dia além do fim do mês é limitado
    expect(dueDateFor('2026-01', 31)).toBe('2026-02-28');
  });

  it('tem os modelos das obrigações mensais usuais', () => {
    const kinds = OBLIGATION_TEMPLATES.map((t) => t.kind);
    expect(kinds).toContain('FGTS_DIGITAL');
    expect(kinds).toContain('DCTFWEB');
    expect(kinds).toContain('EFD_REINF');
    expect(kinds).toContain('DET');
  });

  it('monta o lote de Qualificação Cadastral e sinaliza CPF inválido', () => {
    const { rows, issues } = buildQualifCadRows([
      { cpf: '123.456.789-09', nis: '120.6581.234-5', name: 'Ana Silva', birthDate: '1990-05-20' },
      { cpf: '111', nis: null, name: 'Sem CPF', birthDate: null },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].cpf).toBe('12345678909');
    expect(rows[0].birthDate).toBe('20051990');
    expect(rows[0].name).toBe('ANA SILVA');
    expect(issues.some((i) => i.includes('Sem CPF'))).toBe(true);
    const csv = qualifCadCsv(rows);
    expect(csv).toContain('CPF;NIS;NOME;DATA_NASCIMENTO');
    expect(csv).toContain('12345678909;12065812345;ANA SILVA;20051990');
  });

  it('interpreta o retorno da Qualificação Cadastral', () => {
    const csv = 'CPF;SITUACAO\n12345678909;NOME DIVERGENTE\n98765432100;OK';
    const parsed = parseQualifCadReturn(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].status).toBe('DIVERGENTE');
    expect(parsed[0].divergences).toContain('Nome divergente');
    expect(parsed[1].status).toBe('OK');
  });
});
