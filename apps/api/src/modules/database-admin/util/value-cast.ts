import { ColumnInfo } from '../services/schema-inspection.service';
import { assertValidIdentifier } from './identifier.util';

/**
 * Mapeia data_type do information_schema para uma expressão de cast SQL segura.
 * Para tipos definidos pelo usuário (enums), usa o udt_name quotado.
 */
export function castSuffix(col: ColumnInfo): string {
  const t = col.dataType.toLowerCase();
  if (t === 'user-defined') {
    assertValidIdentifier(col.udtName, 'tipo');
    return `::"${col.udtName}"`;
  }
  const map: Record<string, string> = {
    integer: '::integer',
    bigint: '::bigint',
    smallint: '::smallint',
    numeric: '::numeric',
    'double precision': '::double precision',
    real: '::real',
    boolean: '::boolean',
    uuid: '::uuid',
    json: '::json',
    jsonb: '::jsonb',
    date: '::date',
    'timestamp with time zone': '::timestamptz',
    'timestamp without time zone': '::timestamp',
    'time without time zone': '::time',
    text: '::text',
    'character varying': '::varchar',
    character: '::bpchar',
  };
  return map[t] ?? '';
}

/** Converte o valor recebido (JSON) para um parâmetro de bind adequado ao tipo da coluna. */
export function coerceParam(col: ColumnInfo, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const t = col.dataType.toLowerCase();
  // Vazio em coluna não-textual = NULL
  if (value === '' && !['text', 'character varying', 'character'].includes(t)) return null;

  if (['integer', 'bigint', 'smallint'].includes(t)) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`Valor inválido para inteiro em ${col.name}: ${String(value)}`);
    return Math.trunc(n);
  }
  if (['numeric', 'double precision', 'real'].includes(t)) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`Valor inválido para número em ${col.name}: ${String(value)}`);
    return n;
  }
  if (t === 'boolean') {
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1' || value === 1;
  }
  if (t === 'json' || t === 'jsonb') {
    if (typeof value === 'string') return value; // assume JSON textual válido (cast ::jsonb valida)
    return JSON.stringify(value);
  }
  // uuid, datas, text, enums, etc.: enviar como string (cast valida no servidor)
  return typeof value === 'string' ? value : String(value);
}
