/**
 * Regras puras de candidato/candidatura (F3) — sem I/O, testáveis. Cobrem
 * normalização/validação de e-mail, allowlist de upload (defesa contra arquivos
 * perigosos), máquina de estados da candidatura e a versão do termo de consentimento.
 */

/** Versão do termo de consentimento LGPD aceito na candidatura. Suba ao mudar o texto. */
export const CONSENT_VERSION = '2026-07-15';

/** Finalidades de tratamento previstas. */
export const CONSENT_PURPOSES = ['RECRUITMENT', 'TALENT_POOL', 'SENSITIVE'] as const;

/** MIME permitidos para currículo/anexos do candidato. */
export const ALLOWED_UPLOAD_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export const APPLICATION_STATUSES = ['ACTIVE', 'HIRED', 'REJECTED', 'WITHDRAWN', 'DISQUALIFIED'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Normaliza e-mail para dedupe (minúsculo, sem espaços). */
export function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  const e = normalizeEmail(email);
  return e.length <= 254 && EMAIL_RE.test(e);
}

/** Valida um upload antes de tocar no storage. Retorna a extensão canônica se ok. */
export function validateUpload(input: { mimeType?: string | null; sizeBytes?: number | null }): {
  ok: boolean;
  ext?: string;
  error?: string;
} {
  const mime = String(input.mimeType ?? '').toLowerCase();
  const size = Number(input.sizeBytes ?? 0);
  if (!ALLOWED_UPLOAD_MIME[mime]) {
    return { ok: false, error: 'Tipo de arquivo não permitido. Envie PDF, DOC, DOCX, PNG ou JPG.' };
  }
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: 'Arquivo vazio.' };
  if (size > MAX_UPLOAD_BYTES) return { ok: false, error: 'Arquivo acima do limite de 8 MB.' };
  return { ok: true, ext: ALLOWED_UPLOAD_MIME[mime] };
}

/** O candidato só pode desistir de uma candidatura que ainda está ativa. */
export function canWithdraw(status: string): boolean {
  return status === 'ACTIVE';
}

/** O recrutador só movimenta/rejeita candidaturas ativas. */
export function canRecruiterAct(status: string): boolean {
  return status === 'ACTIVE';
}

/** Gera um código OTP numérico de 6 dígitos a partir de um inteiro aleatório [0, 1e6). */
export function otpFromInt(n: number): string {
  const v = Math.abs(Math.trunc(n)) % 1_000_000;
  return String(v).padStart(6, '0');
}

/** Sanitiza o slug de arquivo (defesa contra path traversal / nomes hostis). */
export function safeFileName(name: string): string {
  const base = String(name ?? 'arquivo')
    .replace(/^.*[\\/]/, '') // remove qualquer caminho
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 140);
  return base || 'arquivo';
}
