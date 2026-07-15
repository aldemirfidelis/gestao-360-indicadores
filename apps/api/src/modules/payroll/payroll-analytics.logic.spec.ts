import { describe, expect, it } from 'vitest';
import { computeKpis, detectPayrollAnomalies } from './payroll-analytics.logic';

describe('payroll-analytics.logic', () => {
  it('detecta entrada, saída e variações de líquido', () => {
    const previous = [
      { employeeId: 'a', name: 'Ana', netCents: 300000, earningsCents: 320000 },
      { employeeId: 'b', name: 'Bia', netCents: 200000, earningsCents: 210000 },
      { employeeId: 'c', name: 'Caio', netCents: 100000, earningsCents: 110000 },
    ];
    const current = [
      { employeeId: 'a', name: 'Ana', netCents: 300000, earningsCents: 320000 }, // igual
      { employeeId: 'b', name: 'Bia', netCents: 0, earningsCents: 0 }, // zerou
      { employeeId: 'd', name: 'Davi', netCents: 250000, earningsCents: 260000 }, // novo
      { employeeId: 'e', name: 'Eva', netCents: 700000, earningsCents: 720000 }, // novo (spike não conta p/ novo)
    ];
    const anomalies = detectPayrollAnomalies(current, previous);
    expect(anomalies.find((x) => x.code === 'NEW' && x.employeeId === 'd')).toBeTruthy();
    expect(anomalies.find((x) => x.code === 'NET_ZERO' && x.employeeId === 'b')?.severity).toBe('HIGH');
    expect(anomalies.find((x) => x.code === 'REMOVED' && x.employeeId === 'c')).toBeTruthy();
    // Ana sem variação → sem anomalia
    expect(anomalies.find((x) => x.employeeId === 'a')).toBeUndefined();
  });

  it('marca spike quando o líquido mais que dobra', () => {
    const anomalies = detectPayrollAnomalies(
      [{ employeeId: 'a', name: 'Ana', netCents: 700000, earningsCents: 720000 }],
      [{ employeeId: 'a', name: 'Ana', netCents: 300000, earningsCents: 320000 }],
    );
    expect(anomalies[0].code).toBe('NET_SPIKE');
    expect(anomalies[0].severity).toBe('HIGH');
  });

  it('respeita o limite de variação configurável', () => {
    const small = detectPayrollAnomalies(
      [{ employeeId: 'a', name: 'Ana', netCents: 310000, earningsCents: 320000 }],
      [{ employeeId: 'a', name: 'Ana', netCents: 300000, earningsCents: 320000 }],
    );
    expect(small).toHaveLength(0); // ~3% < 30%
  });

  it('computa KPIs de custo, médio e encargos', () => {
    const kpis = computeKpis({ periodRef: '2026-07', workers: 2, earningsCents: 640920, deductionsCents: 58194, netCents: 582726, inssCents: 55594, irrfCents: 2530, fgtsCents: 51273 });
    expect(kpis.totalCostCents).toBe(640920 + 51273);
    expect(kpis.workers).toBe(2);
    expect(kpis.avgCostCents).toBe(Math.round((640920 + 51273) / 2));
    expect(kpis.chargesPct).toBe(8); // 51273/640920 ≈ 8%
  });
});
