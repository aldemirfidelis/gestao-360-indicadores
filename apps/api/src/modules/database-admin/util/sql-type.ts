import { BadRequestException } from '@nestjs/common';

/**
 * Valida e normaliza um tipo de coluna para uso em DDL, prevenindo injeção.
 * Tipos built-in são aceitos por allowlist; tipos definidos pelo usuário
 * (enums/domínios) são aceitos como identificador e quotados (case-sensitive).
 */
const BUILTIN = new Set([
  'text', 'uuid', 'boolean', 'smallint', 'integer', 'bigint', 'real', 'double precision',
  'date', 'time', 'timetz', 'timestamp', 'timestamptz', 'timestamp with time zone',
  'timestamp without time zone', 'json', 'jsonb', 'serial', 'bigserial', 'smallserial',
  'bytea', 'inet', 'cidr', 'macaddr',
]);

const PARAMETRIC = /^(varchar|character varying|char|character|numeric|decimal|bit|varbit)\s*\(\s*\d+\s*(,\s*\d+\s*)?\)$/i;

export function normalizeType(type: string): string {
  const t = (type ?? '').trim();
  if (!t) throw new BadRequestException('Tipo de coluna não informado.');
  const lower = t.toLowerCase();
  if (BUILTIN.has(lower)) return lower;
  if (PARAMETRIC.test(t)) return t.toLowerCase();
  // Array de built-in (ex.: integer[])
  if (lower.endsWith('[]') && BUILTIN.has(lower.slice(0, -2).trim())) return lower;
  // Tipo definido pelo usuário (enum/domínio): identificador seguro, quotado.
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) return `"${t}"`;
  throw new BadRequestException(`Tipo de coluna inválido ou não permitido: ${type}`);
}
