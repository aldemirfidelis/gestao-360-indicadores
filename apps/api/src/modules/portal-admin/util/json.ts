/** Helpers para campos JSON serializados como String no Prisma. */
export function parseArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const v = JSON.parse(value);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function stringifyArray(value: unknown[]): string {
  try {
    return JSON.stringify(value ?? []);
  } catch {
    return '[]';
  }
}
