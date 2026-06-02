import { describe, it, expect } from 'vitest';
import { analyzeSql, stripForAnalysis, splitStatements } from './sql-analyze';

const PROTECTED = ['User', 'AuditLog'];

describe('sql-analyze — classificação para Modo Seguro/Avançado', () => {
  it('reconhece SELECT como somente-leitura', () => {
    const a = analyzeSql('SELECT * FROM "Indicator" WHERE id = 1', PROTECTED);
    expect(a.statementType).toBe('SELECT');
    expect(a.isReadOnly).toBe(true);
    expect(a.risk).toBe('none');
  });

  it('WITH ... SELECT é leitura; WITH ... DELETE é escrita', () => {
    expect(analyzeSql('WITH x AS (SELECT 1) SELECT * FROM x', PROTECTED).isReadOnly).toBe(true);
    expect(analyzeSql('WITH x AS (DELETE FROM "Indicator" RETURNING *) SELECT * FROM x', PROTECTED).isReadOnly).toBe(false);
  });

  it('classifica DML/DDL como escrita', () => {
    expect(analyzeSql('INSERT INTO "Indicator"(name) VALUES (\'x\')', PROTECTED).isReadOnly).toBe(false);
    expect(analyzeSql('UPDATE "Indicator" SET name=\'x\' WHERE id=1', PROTECTED).isReadOnly).toBe(false);
    expect(analyzeSql('DELETE FROM "Indicator" WHERE id=1', PROTECTED).isReadOnly).toBe(false);
  });

  it('DELETE/UPDATE sem WHERE => risco alto', () => {
    expect(analyzeSql('DELETE FROM "Indicator"', PROTECTED).risk).toBe('high');
    expect(analyzeSql('UPDATE "Indicator" SET name=\'x\'', PROTECTED).risk).toBe('high');
    expect(analyzeSql('DELETE FROM "Indicator" WHERE id=1', PROTECTED).risk).toBe('medium');
  });

  it('DROP/TRUNCATE/ALTER => risco alto', () => {
    expect(analyzeSql('DROP TABLE "X"', PROTECTED).risk).toBe('high');
    expect(analyzeSql('TRUNCATE "X"', PROTECTED).risk).toBe('high');
    expect(analyzeSql('ALTER TABLE "X" ADD COLUMN y int', PROTECTED).risk).toBe('high');
  });

  it('múltiplos comandos => risco alto e contagem correta', () => {
    const a = analyzeSql('SELECT 1; DELETE FROM "Indicator" WHERE id=1', PROTECTED);
    expect(a.statementCount).toBe(2);
    expect(a.risk).toBe('high');
  });

  it('escrita em tabela protegida => risco alto', () => {
    expect(analyzeSql('UPDATE "User" SET name=\'x\' WHERE id=1', PROTECTED).risk).toBe('high');
    // leitura de protegida não eleva risco
    expect(analyzeSql('SELECT * FROM "User"', PROTECTED).risk).toBe('none');
  });

  it('não confunde palavras-chave dentro de strings/comentários', () => {
    const a = analyzeSql("SELECT 'DROP TABLE x' AS txt -- DELETE FROM y", PROTECTED);
    expect(a.isReadOnly).toBe(true);
    expect(a.statementCount).toBe(1);
  });

  it('strip remove strings, comentários e ; em literais não quebram contagem', () => {
    const stripped = stripForAnalysis("SELECT ';;;' /* ; */ -- ;\n FROM t");
    expect(splitStatements(stripped).length).toBe(1);
  });
});
