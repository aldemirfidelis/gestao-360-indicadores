import { BadRequestException } from '@nestjs/common';
import { quoteIdent } from './identifier.util';

export type FilterOperator =
  | 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte'
  | 'contains' | 'ncontains' | 'startsWith' | 'endsWith'
  | 'isEmpty' | 'isNotEmpty' | 'between' | 'in';

export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value?: unknown;
  values?: unknown[];
}

export interface WhereResult {
  clause: string; // sem o "WHERE"
  params: unknown[];
}

const NO_VALUE: FilterOperator[] = ['isEmpty', 'isNotEmpty'];

/**
 * Constrói uma cláusula WHERE 100% parametrizada a partir de condições validadas.
 * Identificadores passam pela allowlist; valores SEMPRE via bind ($n).
 * `combinator` controla AND/OR entre as condições.
 */
export function buildWhere(
  conditions: FilterCondition[],
  allowedColumns: Set<string>,
  startIndex = 1,
  combinator: 'AND' | 'OR' = 'AND',
): WhereResult {
  const params: unknown[] = [];
  let idx = startIndex;
  const parts: string[] = [];

  for (const c of conditions) {
    if (!allowedColumns.has(c.column)) throw new BadRequestException(`Coluna não permitida: ${c.column}`);
    const col = quoteIdent(c.column, 'coluna');
    const p = () => `$${idx++}`;

    switch (c.operator) {
      case 'eq': parts.push(`${col} = ${p()}`); params.push(c.value); break;
      case 'neq': parts.push(`${col} <> ${p()}`); params.push(c.value); break;
      case 'gt': parts.push(`${col} > ${p()}`); params.push(c.value); break;
      case 'lt': parts.push(`${col} < ${p()}`); params.push(c.value); break;
      case 'gte': parts.push(`${col} >= ${p()}`); params.push(c.value); break;
      case 'lte': parts.push(`${col} <= ${p()}`); params.push(c.value); break;
      case 'contains': parts.push(`${col}::text ILIKE ${p()}`); params.push(`%${String(c.value)}%`); break;
      case 'ncontains': parts.push(`${col}::text NOT ILIKE ${p()}`); params.push(`%${String(c.value)}%`); break;
      case 'startsWith': parts.push(`${col}::text ILIKE ${p()}`); params.push(`${String(c.value)}%`); break;
      case 'endsWith': parts.push(`${col}::text ILIKE ${p()}`); params.push(`%${String(c.value)}`); break;
      case 'isEmpty': parts.push(`(${col} IS NULL OR ${col}::text = '')`); break;
      case 'isNotEmpty': parts.push(`(${col} IS NOT NULL AND ${col}::text <> '')`); break;
      case 'between': {
        const vals = c.values ?? [];
        if (vals.length !== 2) throw new BadRequestException('between exige 2 valores');
        parts.push(`${col} BETWEEN ${p()} AND ${p()}`);
        params.push(vals[0], vals[1]);
        break;
      }
      case 'in': {
        const vals = c.values ?? [];
        if (vals.length === 0) throw new BadRequestException('in exige ao menos 1 valor');
        parts.push(`${col} = ANY(${p()})`);
        params.push(vals);
        break;
      }
      default:
        throw new BadRequestException(`Operador inválido: ${(c as FilterCondition).operator}`);
    }
    void NO_VALUE;
  }

  return { clause: parts.join(` ${combinator} `), params };
}
