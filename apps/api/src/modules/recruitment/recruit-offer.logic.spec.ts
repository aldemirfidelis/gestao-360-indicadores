import { describe, expect, it } from 'vitest';
import { canCandidateDecideOffer, canSendOffer, evaluateSalaryBand, preAdmissionIsReady } from './recruit-offer.logic';

describe('recruit-offer.logic', () => {
  it('aprova proposta dentro da faixa sem nova alçada', () => {
    expect(evaluateSalaryBand({ salaryAmountCents: 500000, salaryMinCents: 400000, salaryMaxCents: 600000 })).toEqual({
      within: true,
      approvalRequired: false,
      reason: null,
    });
  });

  it('exige aprovação quando a proposta sai da faixa', () => {
    const high = evaluateSalaryBand({ salaryAmountCents: 700000, salaryMinCents: 400000, salaryMaxCents: 600000 });
    expect(high.within).toBe(false);
    expect(high.approvalRequired).toBe(true);
    expect(canSendOffer('PENDING_APPROVAL', high.approvalRequired)).toBe(false);
    expect(canSendOffer('APPROVED', high.approvalRequired)).toBe(true);
  });

  it('impede aceite de proposta expirada ou não enviada', () => {
    const now = new Date('2026-07-15T12:00:00Z');
    expect(canCandidateDecideOffer('DRAFT', null, now)).toBe(false);
    expect(canCandidateDecideOffer('SENT', '2026-07-15T11:59:00Z', now)).toBe(false);
    expect(canCandidateDecideOffer('SENT', '2026-07-16T00:00:00Z', now)).toBe(true);
  });

  it('considera a pré-admissão pronta quando obrigatórios foram aprovados ou dispensados', () => {
    expect(preAdmissionIsReady([
      { required: true, status: 'APPROVED' },
      { required: true, status: 'WAIVED' },
      { required: false, status: 'PENDING' },
    ])).toBe(true);
    expect(preAdmissionIsReady([{ required: true, status: 'SUBMITTED' }])).toBe(false);
  });
});
