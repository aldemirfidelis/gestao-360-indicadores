/**
 * Traduz erros do PostgreSQL (via Prisma raw) para mensagens claras em PT-BR,
 * sem vazar detalhes sensíveis (string de conexão, stack, segredos).
 */
const SQLSTATE_MESSAGES: Record<string, string> = {
  '23505': 'Violação de unicidade: já existe um registro com esse valor único.',
  '23503': 'Violação de chave estrangeira: o registro referencia (ou é referenciado por) outro que impede a operação.',
  '23502': 'Campo obrigatório: um valor NOT NULL não foi informado.',
  '23514': 'Violação de restrição (CHECK): o valor não atende a uma regra da coluna.',
  '22P02': 'Valor inválido para o tipo da coluna (formato/representação incorreta).',
  '22003': 'Valor numérico fora do intervalo permitido.',
  '42703': 'Coluna inexistente.',
  '42P01': 'Tabela inexistente.',
  '42601': 'Erro de sintaxe no comando SQL.',
  '42501': 'Permissão insuficiente no banco para esta operação.',
  '40001': 'Conflito de concorrência (serialization). Tente novamente.',
  '57014': 'Operação cancelada por exceder o tempo limite (statement_timeout).',
  '53300': 'Limite de conexões atingido.',
};

interface PgLikeError {
  code?: string;
  meta?: { code?: string; message?: string; cause?: string };
  message?: string;
}

export function pgSqlState(err: unknown): string | undefined {
  const e = err as PgLikeError;
  // Prisma conhecido: P2010 com meta.code = SQLSTATE
  if (e?.meta?.code) return e.meta.code;
  // pg cru: err.code = SQLSTATE
  if (e?.code && /^[0-9A-Z]{5}$/.test(e.code)) return e.code;
  return undefined;
}

export function translatePgError(err: unknown): string {
  const state = pgSqlState(err);
  if (state && SQLSTATE_MESSAGES[state]) return SQLSTATE_MESSAGES[state];

  // Tenta extrair a mensagem do banco sem expor stack/conexão.
  const e = err as PgLikeError;
  const raw = e?.meta?.message || e?.meta?.cause || e?.message || 'Falha ao executar a operação no banco.';
  const firstLine = String(raw).split('\n')[0].slice(0, 300);
  // Remove possíveis trechos com credenciais.
  return firstLine.replace(/postgres(ql)?:\/\/[^\s]+/gi, '[conexão omitida]');
}
