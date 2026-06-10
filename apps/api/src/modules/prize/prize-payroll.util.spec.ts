import { describe, it, expect } from 'vitest';
import { buildPayrollItems, payrollToCsv, reconcileReturn } from './prize-payroll.util';

const results = [
  { id: 'r1', registration: '1', name: 'Ana', finalValue: 800, blocked: false },
  { id: 'r2', registration: '2', name: 'Bruno', finalValue: 0, blocked: true, blockReason: 'Treinamento' },
  { id: 'r3', registration: '3', name: 'Carla', finalValue: 1200.5, blocked: false },
];

describe('buildPayrollItems', () => {
  it('separa pagáveis de bloqueados', () => {
    const items = buildPayrollItems(results, '1234');
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ registration: '1', value: 800, status: 'PENDING', rubric: '1234' });
    expect(items[1]).toMatchObject({ registration: '2', value: 0, status: 'BLOCKED', blockReason: 'Treinamento' });
    expect(items[2]).toMatchObject({ value: 1200.5, status: 'PENDING' });
  });
});

describe('payrollToCsv', () => {
  it('gera CSV apenas com pagáveis e valor BR', () => {
    const items = buildPayrollItems(results, '1234');
    const csv = payrollToCsv(items.map((i) => ({ registration: i.registration, name: i.name, rubric: i.rubric, value: i.value, status: i.status })), '2026-06');
    const lines = csv.split('\n');
    expect(lines[0]).toBe('competencia;matricula;nome;rubrica;valor;status');
    expect(lines).toHaveLength(3); // header + 2 pagaveis (bloqueado fora)
    expect(lines[1]).toContain('800,00');
    expect(csv).not.toContain('Bruno');
  });
});

describe('reconcileReturn', () => {
  it('concilia matches, rejeições e não-encontrados', () => {
    const items = [{ registration: '1' }, { registration: '2' }];
    const r = reconcileReturn(items, [
      { registration: '1', status: 'ACCEPTED' },
      { registration: '2', status: 'REJEITADO' },
      { registration: '9', status: 'ACCEPTED' },
    ]);
    expect(r.matched).toBe(2);
    expect(r.rejected).toBe(1);
    expect(r.notFound).toEqual(['9']);
  });
});
