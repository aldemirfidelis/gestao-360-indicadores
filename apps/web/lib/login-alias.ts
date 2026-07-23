/**
 * Usuários de autoatendimento criados pelo Serviço Pessoal usam um e-mail
 * sintético como chave interna (cpf-<dígitos>@<slug>.local ou
 * mat-<matrícula>@<slug>.local) e entram no portal digitando só o CPF ou a
 * matrícula. Estes helpers traduzem a chave interna para exibição amigável —
 * o e-mail sintético nunca deve aparecer cru nas telas.
 */

export type LoginAlias =
  | { kind: 'CPF'; value: string }
  | { kind: 'MATRICULA'; value: string }
  | null;

export function parseLoginAlias(email: string | null | undefined): LoginAlias {
  const match = /^(cpf|mat)-([^@]+)@[a-z0-9-]+\.local$/i.exec(String(email ?? '').trim());
  if (!match) return null;
  return match[1].toLowerCase() === 'cpf' ? { kind: 'CPF', value: match[2] } : { kind: 'MATRICULA', value: match[2] };
}

export function formatCpf(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length !== 11) return digits;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** "CPF 915.623.780-40" / "Matrícula 000123" / o próprio e-mail quando real. */
export function displayLogin(email: string | null | undefined): string {
  const alias = parseLoginAlias(email);
  if (!alias) return String(email ?? '');
  return alias.kind === 'CPF' ? `CPF ${formatCpf(alias.value)}` : `Matrícula ${alias.value}`;
}
