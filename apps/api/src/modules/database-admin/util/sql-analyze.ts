/**
 * Análise estática de SQL para o Editor SQL (classificação + risco).
 * NÃO é um parser completo — é uma heurística conservadora cujo objetivo é
 * decidir o que o Modo Seguro bloqueia e quando exigir confirmação reforçada.
 * O Modo Seguro adicionalmente roda em transação READ ONLY no servidor, então
 * mesmo um falso negativo aqui não permite escrita.
 */

export type StatementType =
  | 'SELECT' | 'EXPLAIN' | 'SHOW' | 'WITH'
  | 'INSERT' | 'UPDATE' | 'DELETE'
  | 'CREATE' | 'ALTER' | 'DROP' | 'TRUNCATE'
  | 'GRANT' | 'REVOKE' | 'OTHER' | 'EMPTY';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface SqlAnalysis {
  statementType: StatementType;
  statementCount: number;
  isReadOnly: boolean;
  hasWhere: boolean;
  risk: RiskLevel;
  reasons: string[];
  /** keywords iniciais de cada statement (para múltiplos) */
  statementTypes: StatementType[];
}

const READ_ONLY_TYPES: StatementType[] = ['SELECT', 'EXPLAIN', 'SHOW', 'WITH'];

/** Remove comentários e literais (strings, identificadores quotados, dollar-quote) para análise estrutural. */
export function stripForAnalysis(sql: string): string {
  let s = sql;
  // dollar-quoted strings: $tag$ ... $tag$
  s = s.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, ' ');
  // block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // line comments
  s = s.replace(/--[^\n]*/g, ' ');
  // single-quoted strings (com '' escapado)
  s = s.replace(/'(?:''|[^'])*'/g, " '' ");
  // double-quoted identifiers
  s = s.replace(/"(?:""|[^"])*"/g, ' _ident_ ');
  return s;
}

export function splitStatements(strippedSql: string): string[] {
  return strippedSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function leadingType(statement: string): StatementType {
  const m = /^\s*([A-Za-z]+)/.exec(statement);
  if (!m) return 'EMPTY';
  const kw = m[1].toUpperCase();
  const map: Record<string, StatementType> = {
    SELECT: 'SELECT', EXPLAIN: 'EXPLAIN', SHOW: 'SHOW', WITH: 'WITH', TABLE: 'SELECT', VALUES: 'SELECT',
    INSERT: 'INSERT', UPDATE: 'UPDATE', DELETE: 'DELETE',
    CREATE: 'CREATE', ALTER: 'ALTER', DROP: 'DROP', TRUNCATE: 'TRUNCATE',
    GRANT: 'GRANT', REVOKE: 'REVOKE',
  };
  return map[kw] ?? 'OTHER';
}

/** Para `WITH ...`, descobre se a operação final é de leitura (SELECT) ou escrita. */
function withIsReadOnly(statement: string): boolean {
  // Se há INSERT/UPDATE/DELETE dentro do WITH, é escrita.
  return !/\b(INSERT|UPDATE|DELETE)\b/i.test(statement);
}

export function analyzeSql(sql: string, protectedTables: string[] = []): SqlAnalysis {
  const stripped = stripForAnalysis(sql);
  const statements = splitStatements(stripped);
  const reasons: string[] = [];

  if (statements.length === 0) {
    return { statementType: 'EMPTY', statementCount: 0, isReadOnly: true, hasWhere: false, risk: 'none', reasons: ['Comando vazio.'], statementTypes: [] };
  }

  const statementTypes = statements.map(leadingType);
  const first = statementTypes[0];
  const multiple = statements.length > 1;

  // read-only do conjunto
  let isReadOnly = statementTypes.every((t) => {
    if (t === 'WITH') return withIsReadOnly(statements[statementTypes.indexOf(t)]);
    return READ_ONLY_TYPES.includes(t);
  });
  if (first === 'WITH') isReadOnly = isReadOnly && withIsReadOnly(statements[0]);

  const hasWhere = /\bWHERE\b/i.test(stripped);

  let risk: RiskLevel = isReadOnly ? 'none' : 'medium';

  if (multiple) {
    risk = 'high';
    reasons.push('Múltiplos comandos em uma única execução.');
  }
  for (const t of statementTypes) {
    if (t === 'DROP' || t === 'TRUNCATE' || t === 'ALTER') {
      risk = 'high';
      reasons.push(`Comando ${t} altera estrutura/remove dados.`);
    }
    if (t === 'GRANT' || t === 'REVOKE') {
      risk = 'high';
      reasons.push(`Comando ${t} altera permissões do banco.`);
    }
  }
  if ((statementTypes.includes('DELETE') || statementTypes.includes('UPDATE')) && !hasWhere) {
    risk = 'high';
    reasons.push('DELETE/UPDATE sem cláusula WHERE afeta todos os registros.');
  }

  // Tabelas protegidas mencionadas (busca no SQL original, com ou sem aspas)
  const touched = protectedTables.filter((t) =>
    new RegExp(`(^|[^A-Za-z0-9_])"?${escapeRegex(t)}"?([^A-Za-z0-9_]|$)`, 'i').test(sql),
  );
  if (touched.length > 0 && !isReadOnly) {
    risk = 'high';
    reasons.push(`Operação sobre tabela(s) crítica(s): ${touched.join(', ')}.`);
  }

  if (risk === 'none' && !isReadOnly) risk = 'medium';
  if (isReadOnly && reasons.length === 0) reasons.push('Consulta somente-leitura.');

  return { statementType: first, statementCount: statements.length, isReadOnly, hasWhere, risk, reasons, statementTypes };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
