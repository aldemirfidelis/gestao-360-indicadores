import { describe, expect, it } from 'vitest';
import {
  absenteeismRate,
  activeAtDate,
  businessDaysInMonth,
  computeTurnover,
  monthKeysBetween,
  overlapDays,
  type EmployeeLifecycleRow,
} from './reports.logic';

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe('DP reports logic', () => {
  it('detects active status at a reference date', () => {
    expect(activeAtDate(d('2026-01-10'), null, d('2026-02-01'))).toBe(true);
    expect(activeAtDate(d('2026-01-10'), d('2026-01-20'), d('2026-02-01'))).toBe(false);
    expect(activeAtDate(d('2026-03-10'), null, d('2026-02-01'))).toBe(false);
    expect(activeAtDate(null, null, d('2026-02-01'))).toBe(false);
  });

  it('lists competências between two dates inclusive', () => {
    expect(monthKeysBetween(d('2025-11-05'), d('2026-02-20'))).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthKeysBetween(d('2026-02-01'), d('2026-02-28'))).toEqual(['2026-02']);
  });

  it('counts business days (Mon–Fri) in a month', () => {
    expect(businessDaysInMonth('2026-02')).toBe(20); // fev/2026: 28 dias, 4 fins de semana completos
    expect(businessDaysInMonth('2026-03')).toBe(22);
  });

  it('computes overlap days between a leave and a window', () => {
    // afastamento 25/jan a 05/fev, janela = fevereiro → 5 dias (1..5)
    expect(overlapDays(d('2026-01-25'), d('2026-02-05'), d('2026-02-01'), d('2026-02-28'))).toBe(5);
    // afastamento em aberto começando no meio do mês
    expect(overlapDays(d('2026-02-20'), null, d('2026-02-01'), d('2026-02-28'))).toBe(9);
    // sem sobreposição
    expect(overlapDays(d('2026-01-01'), d('2026-01-10'), d('2026-02-01'), d('2026-02-28'))).toBe(0);
  });

  it('aggregates turnover with admissions, terminations and rate', () => {
    const rows: EmployeeLifecycleRow[] = [
      { employeeId: '1', orgNodeId: 'a', orgNodeName: 'Produção', admissionDate: d('2025-06-01'), terminationDate: null },
      { employeeId: '2', orgNodeId: 'a', orgNodeName: 'Produção', admissionDate: d('2025-06-01'), terminationDate: d('2026-01-15') },
      { employeeId: '3', orgNodeId: 'b', orgNodeName: 'Adm', admissionDate: d('2026-01-10'), terminationDate: null },
    ];
    const result = computeTurnover(rows, d('2026-01-01'), d('2026-01-31'));
    expect(result.admissions).toBe(1);
    expect(result.terminations).toBe(1);
    expect(result.headcountStart).toBe(2); // 1 e 2 ativos em 01/jan
    expect(result.headcountEnd).toBe(2); // 1 e 3 ativos em 31/jan
    expect(result.averageHeadcount).toBe(2);
    // ((1+1)/2)/2 = 0.5 → 50%
    expect(result.turnoverRate).toBe(50);
    expect(result.byArea.find((bucket) => bucket.key === 'a')?.terminations).toBe(1);
  });

  it('computes absenteeism rate as percentage of capacity', () => {
    expect(absenteeismRate(10, 5, 20)).toBe(10); // 10 / (5*20) = 10%
    expect(absenteeismRate(0, 5, 20)).toBe(0);
    expect(absenteeismRate(5, 0, 20)).toBe(0);
  });
});
