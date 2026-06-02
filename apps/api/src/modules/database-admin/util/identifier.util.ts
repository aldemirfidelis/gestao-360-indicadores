import { BadRequestException } from '@nestjs/common';
import { IDENTIFIER_REGEX } from '../database-admin.constants';

/**
 * Valida e quota um identificador SQL (tabela/coluna).
 *
 * Defesa contra SQL injection em estrutura: identificadores NUNCA podem ser
 * parametrizados via bind ($1), então validamos contra uma regex estrita e,
 * quando aplicável, contra uma allowlist da introspecção (ver SchemaInspectionService).
 * O quote com aspas duplas preserva o case (Prisma usa PascalCase).
 */
export function assertValidIdentifier(name: string, label = 'identificador'): string {
  if (typeof name !== 'string' || !IDENTIFIER_REGEX.test(name)) {
    throw new BadRequestException(`Nome de ${label} inválido: ${JSON.stringify(name)}`);
  }
  if (name.length > 63) {
    throw new BadRequestException(`Nome de ${label} excede 63 caracteres.`);
  }
  return name;
}

/** Quota um identificador já validado para uso seguro em SQL. */
export function quoteIdent(name: string, label = 'identificador'): string {
  assertValidIdentifier(name, label);
  // A regex já proíbe aspas; o replace é defesa extra.
  return `"${name.replace(/"/g, '""')}"`;
}

/** Quota `schema.table`. */
export function quoteQualified(schema: string, table: string): string {
  return `${quoteIdent(schema, 'schema')}.${quoteIdent(table, 'tabela')}`;
}

/**
 * Valida que `name` pertence à allowlist (conjunto de nomes existentes).
 * Lança 400 caso contrário — bloqueia operar sobre objetos inexistentes.
 */
export function assertInAllowlist(name: string, allow: Set<string>, label = 'tabela'): string {
  assertValidIdentifier(name, label);
  if (!allow.has(name)) {
    throw new BadRequestException(`${label} não encontrada ou não permitida: ${name}`);
  }
  return name;
}
