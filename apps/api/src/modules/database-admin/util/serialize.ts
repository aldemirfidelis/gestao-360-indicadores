/**
 * Serialização segura de resultados de SQL bruto.
 *
 * Resultados de `$queryRawUnsafe` podem conter BigInt (ex.: COUNT(*)),
 * Date, Buffer e objetos aninhados que quebram `JSON.stringify` ou viram
 * representações inúteis. Esta função normaliza tudo para valores JSON-safe.
 */
export function toJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') {
    // Mantém precisão: usa number quando seguro, senão string.
    return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `\\x${value.toString('hex')}`;
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toJsonSafe(v);
    }
    return out;
  }
  return value;
}

export function rowsToJsonSafe<T = Record<string, unknown>>(rows: T[]): Record<string, unknown>[] {
  return rows.map((r) => toJsonSafe(r) as Record<string, unknown>);
}

/** Stringify resiliente a BigInt para gravação em colunas de auditoria. */
export function safeStringify(value: unknown): string | null {
  try {
    return JSON.stringify(toJsonSafe(value));
  } catch {
    return null;
  }
}
