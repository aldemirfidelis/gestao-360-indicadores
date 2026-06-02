import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { analyzeSql, SqlAnalysis } from '../util/sql-analyze';
import { PROTECTED_TABLES, CRITICAL_CONFIRMATION_PHRASE } from '../database-admin.constants';

export interface ValidationResult extends SqlAnalysis {
  allowedInSafeMode: boolean;
  requiresConfirmationPhrase: boolean;
  confirmationPhrase: string;
}

/**
 * Classifica e valida comandos SQL. Fonte da verdade para o que o Modo Seguro
 * bloqueia e quando o Modo Avançado exige a frase de confirmação reforçada.
 */
@Injectable()
export class QueryValidationService {
  analyze(sql: string): ValidationResult {
    const a = analyzeSql(sql, PROTECTED_TABLES);
    return {
      ...a,
      allowedInSafeMode: a.isReadOnly,
      requiresConfirmationPhrase: a.risk === 'high',
      confirmationPhrase: CRITICAL_CONFIRMATION_PHRASE,
    };
  }

  assertExecutable(sql: string, mode: 'safe' | 'advanced', confirmationPhrase?: string): ValidationResult {
    const v = this.analyze(sql);
    if (v.statementType === 'EMPTY') throw new BadRequestException('Comando SQL vazio.');

    if (mode === 'safe') {
      if (!v.allowedInSafeMode) {
        throw new ForbiddenException(
          'Modo Seguro permite apenas leitura (SELECT/EXPLAIN/SHOW/WITH). Ative o Modo Avançado para comandos de escrita/estrutura.',
        );
      }
      return v;
    }

    // Modo avançado
    if (v.statementCount > 1) {
      throw new BadRequestException('Execute apenas um comando por vez no Modo Avançado.');
    }
    if (v.requiresConfirmationPhrase && confirmationPhrase !== v.confirmationPhrase) {
      throw new BadRequestException(
        `Operação de alto risco. Para confirmar, digite exatamente: "${v.confirmationPhrase}".`,
      );
    }
    return v;
  }
}
