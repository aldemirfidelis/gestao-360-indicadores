import { describe, expect, it } from 'vitest';
import {
  canRecruiterAct,
  canWithdraw,
  isValidEmail,
  MAX_UPLOAD_BYTES,
  normalizeCandidateProfileData,
  normalizeEmail,
  otpFromInt,
  profileDataToText,
  safeFileName,
  validateUpload,
} from './recruit-candidate.logic';

describe('recruit-candidate.logic', () => {
  it('normaliza e valida e-mail', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
    expect(isValidEmail('foo@bar.com')).toBe(true);
    expect(isValidEmail('foo@bar')).toBe(false);
    expect(isValidEmail('sem-arroba.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('valida upload por MIME e tamanho', () => {
    expect(validateUpload({ mimeType: 'application/pdf', sizeBytes: 1000 })).toEqual({ ok: true, ext: 'pdf' });
    expect(validateUpload({ mimeType: 'image/jpeg', sizeBytes: 1000 }).ok).toBe(true);
    expect(validateUpload({ mimeType: 'application/x-msdownload', sizeBytes: 1000 }).ok).toBe(false);
    expect(validateUpload({ mimeType: 'application/pdf', sizeBytes: 0 }).ok).toBe(false);
    expect(validateUpload({ mimeType: 'application/pdf', sizeBytes: MAX_UPLOAD_BYTES + 1 }).ok).toBe(false);
  });

  it('máquina de estados da candidatura', () => {
    expect(canWithdraw('ACTIVE')).toBe(true);
    expect(canWithdraw('HIRED')).toBe(false);
    expect(canWithdraw('WITHDRAWN')).toBe(false);
    expect(canRecruiterAct('ACTIVE')).toBe(true);
    expect(canRecruiterAct('REJECTED')).toBe(false);
  });

  it('gera OTP de 6 dígitos com zero-padding', () => {
    expect(otpFromInt(42)).toBe('000042');
    expect(otpFromInt(999999)).toBe('999999');
    expect(otpFromInt(1_000_042)).toBe('000042');
    expect(otpFromInt(-5)).toBe('000005');
  });

  it('sanitiza nome de arquivo contra path traversal', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\Users\\a\\cv final.pdf')).toBe('cv-final.pdf');
    expect(safeFileName('')).toBe('arquivo');
  });
});

describe('normalizeCandidateProfileData', () => {
  it('devolve undefined para entrada não-objeto ou vazia', () => {
    expect(normalizeCandidateProfileData(null)).toBeUndefined();
    expect(normalizeCandidateProfileData('x')).toBeUndefined();
    expect(normalizeCandidateProfileData([])).toBeUndefined();
    expect(normalizeCandidateProfileData({})).toBeUndefined();
    expect(normalizeCandidateProfileData({ irrelevante: 1 })).toBeUndefined();
  });

  it('mantém só as chaves conhecidas e filtra itens vazios', () => {
    const out = normalizeCandidateProfileData({
      about: '  Dev sênior  ',
      availableForRelocation: true,
      availableForTravel: false,
      desiredSalary: 'R$ 8.000',
      availabilityToStart: 'imediata',
      skills: ['React', 'React', ' Node ', ''],
      experiences: [{ role: 'Dev', company: 'Acme', period: '2020-2024', description: 'API' }, { role: '', company: '', description: '' }],
      education: [{ course: 'ADS', institution: 'IF', period: '2018', status: 'concluído' }, {}],
      languages: [{ name: 'Inglês', level: 'Avançado' }, { name: '' }],
      hackeado: 'ignore-me',
    });
    expect(out).toEqual({
      about: 'Dev sênior',
      availableForRelocation: true,
      availableForTravel: false,
      desiredSalary: 'R$ 8.000',
      availabilityToStart: 'imediata',
      skills: ['React', 'Node'],
      experiences: [{ role: 'Dev', company: 'Acme', period: '2020-2024', description: 'API' }],
      education: [{ course: 'ADS', institution: 'IF', period: '2018', status: 'concluído' }],
      languages: [{ name: 'Inglês', level: 'Avançado' }],
    });
    expect((out as any).hackeado).toBeUndefined();
  });

  it('limita o tamanho das listas', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ role: `r${i}` }));
    const out = normalizeCandidateProfileData({ experiences: many });
    expect(out?.experiences?.length).toBe(30);
  });

  it('profileDataToText serializa em texto legível para a IA', () => {
    const text = profileDataToText({ about: 'Dev', skills: ['React'], availableForTravel: true, availabilityToStart: '30 dias' });
    expect(text).toContain('Sobre: Dev');
    expect(text).toContain('Habilidades: React');
    expect(text).toContain('viagens: sim');
    expect(text).toContain('início: 30 dias');
    expect(profileDataToText(null)).toBe('');
  });
});
