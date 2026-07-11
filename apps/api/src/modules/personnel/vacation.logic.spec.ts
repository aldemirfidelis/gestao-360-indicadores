import { describe, expect, it } from 'vitest';
import {
  acquisitivePeriods,
  allocateVacations,
  calendarDaysInclusive,
  rangesOverlap,
  validateVacationRange,
} from './vacation.logic';

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe('vacation.logic', () => {
  it('calendarDaysInclusive conta as pontas', () => {
    expect(calendarDaysInclusive(d('2026-07-01'), d('2026-07-01'))).toBe(1);
    expect(calendarDaysInclusive(d('2026-07-01'), d('2026-07-30'))).toBe(30);
    expect(calendarDaysInclusive(d('2026-01-28'), d('2026-02-03'))).toBe(7);
  });

  it('acquisitivePeriods: só períodos de 12 meses completos', () => {
    const periods = acquisitivePeriods(d('2024-03-10'), d('2026-07-10'));
    expect(periods).toHaveLength(2);
    expect(periods[0].ref).toBe('2024/2025');
    expect(periods[0].start.toISOString().slice(0, 10)).toBe('2024-03-10');
    expect(periods[0].end.toISOString().slice(0, 10)).toBe('2025-03-09');
    expect(periods[0].concessiveDeadline.toISOString().slice(0, 10)).toBe('2026-03-09');
    expect(periods[1].ref).toBe('2025/2026');
    // admissão recente: nenhum período completo
    expect(acquisitivePeriods(d('2026-01-01'), d('2026-07-10'))).toHaveLength(0);
    expect(acquisitivePeriods(null, d('2026-07-10'))).toHaveLength(0);
  });

  it('allocateVacations: FIFO nos períodos mais antigos e saldo total', () => {
    const periods = acquisitivePeriods(d('2024-03-10'), d('2026-07-10'));
    const allocation = allocateVacations(periods, [{ days: 20 }, { days: 15 }], d('2026-07-10'));
    expect(allocation.periods[0].usedDays).toBe(30); // período antigo consumido primeiro
    expect(allocation.periods[0].balanceDays).toBe(0);
    expect(allocation.periods[1].usedDays).toBe(5);
    expect(allocation.periods[1].balanceDays).toBe(25);
    expect(allocation.totalBalance).toBe(25);
  });

  it('allocateVacations: alerta de dobra quando concessivo venceu com saldo', () => {
    // admissão 2023: 1º concessivo venceu em 2025 sem gozo
    const periods = acquisitivePeriods(d('2023-01-02'), d('2026-07-10'));
    const allocation = allocateVacations(periods, [], d('2026-07-10'));
    expect(allocation.overdue).toBe(true);
    expect(allocation.totalBalance).toBeGreaterThanOrEqual(60);
    // com gozo total, sem alerta
    const clean = allocateVacations(periods, [{ days: 90 }], d('2026-07-10'));
    expect(clean.totalBalance).toBe(0);
    expect(clean.overdue).toBe(false);
  });

  it('validateVacationRange: futuro, 5 a 30 dias', () => {
    const today = d('2026-07-10');
    expect(validateVacationRange(d('2026-08-01'), d('2026-08-15'), today)).toBeNull();
    expect(validateVacationRange(d('2026-07-10'), d('2026-07-20'), today)).not.toBeNull(); // começa hoje
    expect(validateVacationRange(d('2026-08-01'), d('2026-08-02'), today)).not.toBeNull(); // < 5 dias
    expect(validateVacationRange(d('2026-08-01'), d('2026-09-15'), today)).not.toBeNull(); // > 30 dias
    expect(validateVacationRange(d('2026-08-10'), d('2026-08-05'), today)).not.toBeNull(); // invertido
  });

  it('rangesOverlap', () => {
    expect(rangesOverlap(d('2026-07-01'), d('2026-07-10'), d('2026-07-10'), d('2026-07-20'))).toBe(true);
    expect(rangesOverlap(d('2026-07-01'), d('2026-07-09'), d('2026-07-10'), d('2026-07-20'))).toBe(false);
  });
});
