import { describe, expect, it } from 'vitest';
import {
  canRecordAso,
  canRequestAso,
  canScheduleAso,
  isAsoCleared,
  normalizeAsoResult,
  preAdmissionStatusAfterAso,
  redactAsoForRecruitment,
} from './recruit-occupational-health.logic';

describe('recruit-occupational-health.logic', () => {
  it('permite solicitar ASO somente quando a pre-admissao esta pronta ou bloqueada por ASO anterior', () => {
    expect(canRequestAso('READY_FOR_ASO')).toBe(true);
    expect(canRequestAso('ASO_BLOCKED')).toBe(true);
    expect(canRequestAso('IN_DOCUMENTS')).toBe(false);
    expect(canRequestAso('ASO_CLEARED')).toBe(false);
  });

  it('agenda e registra apenas requisicoes abertas', () => {
    expect(canScheduleAso('REQUESTED')).toBe(true);
    expect(canScheduleAso('SCHEDULED')).toBe(true);
    expect(canScheduleAso('COMPLETED')).toBe(false);
    expect(canRecordAso('CANCELLED')).toBe(false);
  });

  it('converte resultado do ASO em liberacao ou bloqueio operacional', () => {
    expect(isAsoCleared('APTO')).toBe(true);
    expect(isAsoCleared('APTO_COM_RESTRICAO')).toBe(true);
    expect(isAsoCleared('INAPTO')).toBe(false);
    expect(preAdmissionStatusAfterAso('APTO')).toBe('ASO_CLEARED');
    expect(preAdmissionStatusAfterAso('INAPTO')).toBe('ASO_BLOCKED');
  });

  it('normaliza resultado aceito e rejeita valores desconhecidos', () => {
    expect(normalizeAsoResult('apto')).toBe('APTO');
    expect(normalizeAsoResult('apto_com_restricao')).toBe('APTO_COM_RESTRICAO');
    expect(normalizeAsoResult('pendente')).toBeNull();
  });

  it('remove campos clinicos da visao do recrutamento', () => {
    const safe = redactAsoForRecruitment({
      id: 'aso-1',
      result: 'APTO',
      examDate: new Date('2026-07-15'),
      validUntil: null,
      physicianName: 'Dra. Exemplo',
      clinicalNotes: 'Dado clinico',
      cidCodes: ['Z00'],
    });
    expect(safe).toEqual(expect.objectContaining({ id: 'aso-1', result: 'APTO' }));
    expect(safe).not.toHaveProperty('clinicalNotes');
    expect(safe).not.toHaveProperty('cidCodes');
    expect(safe).not.toHaveProperty('physicianName');
  });
});
