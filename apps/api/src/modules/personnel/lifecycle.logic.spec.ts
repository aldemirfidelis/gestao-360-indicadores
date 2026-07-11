import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OFFBOARDING_ITEMS,
  DEFAULT_ONBOARDING_ITEMS,
  defaultExamValidity,
  defaultItemsFor,
  examStatus,
} from './lifecycle.logic';

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe('lifecycle.logic', () => {
  it('checklists padrão: admissão exige documentos e contrato; desligamento exige demissional', () => {
    expect(defaultItemsFor('ONBOARDING')).toBe(DEFAULT_ONBOARDING_ITEMS);
    expect(defaultItemsFor('OFFBOARDING')).toBe(DEFAULT_OFFBOARDING_ITEMS);
    expect(DEFAULT_ONBOARDING_ITEMS.some((item) => item.dossierKind === 'CPF' && item.required)).toBe(true);
    expect(DEFAULT_ONBOARDING_ITEMS.some((item) => item.dossierKind === 'CONTRATO' && item.required)).toBe(true);
    expect(DEFAULT_OFFBOARDING_ITEMS.some((item) => item.title.includes('demissional') && item.required)).toBe(true);
    // ordem estável e títulos únicos
    const titles = DEFAULT_ONBOARDING_ITEMS.map((item) => item.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('defaultExamValidity: 12 meses, exceto demissional (sem validade)', () => {
    expect(defaultExamValidity('PERIODICO', d('2026-07-10'))?.toISOString().slice(0, 10)).toBe('2027-07-10');
    expect(defaultExamValidity('ADMISSIONAL', d('2026-01-31'))?.toISOString().slice(0, 10)).toBe('2027-01-31');
    expect(defaultExamValidity('DEMISSIONAL', d('2026-07-10'))).toBeNull();
  });

  it('examStatus: válido, vencendo (janela 60d), vencido e sem validade', () => {
    const today = d('2026-07-10');
    expect(examStatus(d('2027-07-01'), today)).toBe('VALID');
    expect(examStatus(d('2026-08-15'), today)).toBe('EXPIRING');
    expect(examStatus(d('2026-07-01'), today)).toBe('EXPIRED');
    expect(examStatus(null, today)).toBe('NO_EXPIRY');
  });
});
