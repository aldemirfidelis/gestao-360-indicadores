import { describe, expect, it } from 'vitest';
import {
  canRecruiterAct,
  canWithdraw,
  isValidEmail,
  MAX_UPLOAD_BYTES,
  normalizeEmail,
  otpFromInt,
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
