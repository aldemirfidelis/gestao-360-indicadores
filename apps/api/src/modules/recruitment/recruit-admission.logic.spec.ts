import { describe, expect, it } from 'vitest';
import { evaluateAdmissionReadiness, normalizeCpfRequired, probationReviewDueDates } from './recruit-admission.logic';

describe('recruit-admission.logic', () => {
  it('libera admissao somente com candidatura ativa, proposta aceita e ASO apto', () => {
    expect(evaluateAdmissionReadiness({
      applicationStatus: 'ACTIVE',
      offerStatus: 'ACCEPTED',
      preAdmissionStatus: 'ASO_CLEARED',
      asoResult: 'APTO',
    })).toEqual({ ready: true, blocks: [] });
  });

  it('bloqueia admissao com pendencias de proposta ou ASO', () => {
    const result = evaluateAdmissionReadiness({
      applicationStatus: 'ACTIVE',
      offerStatus: 'SENT',
      preAdmissionStatus: 'IN_ASO',
      asoResult: null,
    });
    expect(result.ready).toBe(false);
    expect(result.blocks).toContain('Proposta precisa estar aceita.');
    expect(result.blocks).toContain('Pre-admissao precisa estar liberada pelo ASO.');
  });

  it('bloqueia ASO inapto mesmo quando a pre-admissao foi marcada indevidamente', () => {
    const result = evaluateAdmissionReadiness({
      applicationStatus: 'ACTIVE',
      offerStatus: 'ACCEPTED',
      preAdmissionStatus: 'ASO_CLEARED',
      asoResult: 'INAPTO',
    });
    expect(result.ready).toBe(false);
    expect(result.blocks).toEqual(['ASO nao liberou a admissao.']);
  });

  it('calcula marcos de experiencia de 45 e 90 dias', () => {
    const dueDates = probationReviewDueDates(new Date(Date.UTC(2026, 6, 15)));
    expect(dueDates.map((item) => [item.cycleDay, item.dueAt.toISOString().slice(0, 10)])).toEqual([
      [45, '2026-08-29'],
      [90, '2026-10-13'],
    ]);
  });

  it('normaliza CPF obrigatorio somente com 11 digitos', () => {
    expect(normalizeCpfRequired('123.456.789-09')).toBe('12345678909');
    expect(normalizeCpfRequired('123')).toBeNull();
  });
});
