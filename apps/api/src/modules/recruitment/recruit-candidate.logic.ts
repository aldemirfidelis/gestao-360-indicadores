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

// ------------------------------ perfil estruturado do candidato ------------------------------

/** Perfil estruturado que o candidato preenche no portal — alimenta a triagem por IA e a visão do recrutador. */
export interface CandidateProfileData {
  about?: string;
  availableForRelocation?: boolean;
  availableForTravel?: boolean;
  desiredSalary?: string;
  availabilityToStart?: string;
  skills?: string[];
  experiences?: Array<{ role?: string; company?: string; period?: string; description?: string }>;
  education?: Array<{ course?: string; institution?: string; period?: string; status?: string }>;
  languages?: Array<{ name?: string; level?: string }>;
}

const PROFILE_MAX_LIST = 30;
const PROFILE_MAX_LONG = 4000;
const PROFILE_MAX_SHORT = 300;

function clampProfileStr(v: unknown, max = PROFILE_MAX_SHORT): string | undefined {
  if (!['string', 'number'].includes(typeof v)) return undefined;
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : undefined;
}

/**
 * Valida e limita o perfil estruturado vindo do candidato (defesa contra JSON gigante/hostil):
 * só mantém as chaves conhecidas, corta strings e listas em limites sãos. Devolve `undefined`
 * quando não há nada útil, para não gravar `{}`.
 */
export function normalizeCandidateProfileData(raw: unknown): CandidateProfileData | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const src = raw as Record<string, unknown>;
  const out: CandidateProfileData = {};

  const about = clampProfileStr(src.about, PROFILE_MAX_LONG);
  if (about) out.about = about;
  if (typeof src.availableForRelocation === 'boolean') out.availableForRelocation = src.availableForRelocation;
  if (typeof src.availableForTravel === 'boolean') out.availableForTravel = src.availableForTravel;
  const desiredSalary = clampProfileStr(src.desiredSalary);
  if (desiredSalary) out.desiredSalary = desiredSalary;
  const availabilityToStart = clampProfileStr(src.availabilityToStart);
  if (availabilityToStart) out.availabilityToStart = availabilityToStart;

  if (Array.isArray(src.skills)) {
    const skills = [...new Set(src.skills.map((s) => clampProfileStr(s, 60)).filter((s): s is string => Boolean(s)))].slice(0, PROFILE_MAX_LIST);
    if (skills.length) out.skills = skills;
  }
  if (Array.isArray(src.experiences)) {
    const experiences = (src.experiences as any[]).slice(0, PROFILE_MAX_LIST)
      .map((e) => ({ role: clampProfileStr(e?.role), company: clampProfileStr(e?.company), period: clampProfileStr(e?.period), description: clampProfileStr(e?.description, PROFILE_MAX_LONG) }))
      .filter((e) => e.role || e.company || e.description);
    if (experiences.length) out.experiences = experiences;
  }
  if (Array.isArray(src.education)) {
    const education = (src.education as any[]).slice(0, PROFILE_MAX_LIST)
      .map((e) => ({ course: clampProfileStr(e?.course), institution: clampProfileStr(e?.institution), period: clampProfileStr(e?.period), status: clampProfileStr(e?.status, 60) }))
      .filter((e) => e.course || e.institution);
    if (education.length) out.education = education;
  }
  if (Array.isArray(src.languages)) {
    const languages = (src.languages as any[]).slice(0, PROFILE_MAX_LIST)
      .map((l) => ({ name: clampProfileStr(l?.name, 60), level: clampProfileStr(l?.level, 60) }))
      .filter((l) => l.name);
    if (languages.length) out.languages = languages;
  }

  return Object.keys(out).length ? out : undefined;
}

/** Resumo em texto do perfil estruturado, para alimentar a triagem por IA e o fallback determinístico. */
export function profileDataToText(raw: unknown): string {
  const p = normalizeCandidateProfileData(raw);
  if (!p) return '';
  const parts: string[] = [];
  if (p.about) parts.push(`Sobre: ${p.about}`);
  if (p.skills?.length) parts.push(`Habilidades: ${p.skills.join(', ')}`);
  if (p.experiences?.length) parts.push('Experiência: ' + p.experiences.map((e) => [e.role, e.company, e.period, e.description].filter(Boolean).join(' - ')).join(' | '));
  if (p.education?.length) parts.push('Formação: ' + p.education.map((e) => [e.course, e.institution, e.period, e.status].filter(Boolean).join(' - ')).join(' | '));
  if (p.languages?.length) parts.push('Idiomas: ' + p.languages.map((l) => [l.name, l.level].filter(Boolean).join(' ')).join(', '));
  const availability: string[] = [];
  if (p.availableForRelocation != null) availability.push(`mudança: ${p.availableForRelocation ? 'sim' : 'não'}`);
  if (p.availableForTravel != null) availability.push(`viagens: ${p.availableForTravel ? 'sim' : 'não'}`);
  if (p.availabilityToStart) availability.push(`início: ${p.availabilityToStart}`);
  if (availability.length) parts.push(`Disponibilidade: ${availability.join(', ')}`);
  if (p.desiredSalary) parts.push(`Pretensão salarial: ${p.desiredSalary}`);
  return parts.join('\n');
}
