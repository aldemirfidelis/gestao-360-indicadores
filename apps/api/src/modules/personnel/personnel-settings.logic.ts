/**
 * Lógica pura da numeração de matrícula (registro do colaborador).
 * Separada do serviço para ser testável sem banco.
 */
export interface RegistrationFormat {
  registrationPrefix: string;
  registrationSuffix: string;
  registrationWidth: number;
  registrationPadChar: string;
}

/**
 * Monta a matrícula a partir do sequencial e do formato configurado.
 * Ex.: prefix "9", width 5 → "900001"; prefix "MAT-", width 4 → "MAT-0001".
 * Aceita forma numérica ou alfanumérica (prefixo/sufixo livres).
 */
export function formatRegistration(seq: number, fmt: RegistrationFormat): string {
  const prefix = fmt.registrationPrefix ?? '';
  const suffix = fmt.registrationSuffix ?? '';
  const width = Number.isFinite(fmt.registrationWidth) ? Math.max(0, Math.trunc(fmt.registrationWidth)) : 0;
  const padCharRaw = fmt.registrationPadChar ?? '0';
  const padChar = padCharRaw.length > 0 ? padCharRaw[0] : '0';
  const body = String(Math.max(0, Math.trunc(seq)));
  const padded = width > 0 ? body.padStart(width, padChar) : body;
  return `${prefix}${padded}${suffix}`;
}

/** Normaliza os campos de formato vindos do usuário para limites sãos. */
export function sanitizeRegistrationFormat(input: Partial<RegistrationFormat> & { registrationNextSequence?: number }) {
  const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };
  const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : undefined);
  return {
    registrationPrefix: str(input.registrationPrefix, 16),
    registrationSuffix: str(input.registrationSuffix, 16),
    registrationWidth: input.registrationWidth === undefined ? undefined : clampInt(input.registrationWidth, 0, 12, 5),
    registrationPadChar: input.registrationPadChar === undefined ? undefined : (str(input.registrationPadChar, 1) || '0'),
    registrationNextSequence: input.registrationNextSequence === undefined ? undefined : clampInt(input.registrationNextSequence, 0, 2_000_000_000, 1),
  };
}
