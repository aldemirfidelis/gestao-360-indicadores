import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Ator da operação — AuthPayload serve direto; jobs/sistema passam nulls. */
export interface AuditActor {
  companyId?: string | null;
  sub?: string | null;
}

export interface DomainAuditEntry {
  /** ação semântica: CREATE, UPDATE, DELETE, UPDATE_TARGET, APPROVE... */
  action: string;
  /** nome do módulo exibido na tela de Auditoria (ex.: 'Indicadores') */
  module: string;
  /** entidade Prisma/negócio (ex.: 'Indicator') */
  entity: string;
  entityId?: string | null;
  /** rótulo humano do registro/operação */
  message?: string;
  before?: unknown;
  after?: unknown;
  /** payload custom (vence o default {message}) para módulos com contexto extra */
  payload?: unknown;
  /** SUCCESS (default), ERROR, DENIED, BLOCKED... — coluna livre no schema */
  result?: string;
}

/**
 * Escrita central de auditoria de DOMÍNIO (B1 da auditoria DRY).
 *
 * O AuditInterceptor global já registra toda mutação HTTP; este serviço é o
 * complemento para entradas semânticas dos serviços (before/after de negócio,
 * ações como UPDATE_TARGET). Substitui os métodos privados `writeAudit`/`audit`
 * duplicados por módulo. Nunca lança: auditoria não pode quebrar a operação.
 */
@Injectable()
export class AuditWriterService {
  private readonly logger = new Logger(AuditWriterService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(me: AuditActor, entry: DomainAuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId: me.companyId ?? null,
          userId: me.sub ?? null,
          action: entry.action,
          module: entry.module,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          recordLabel: entry.message ?? null,
          payload:
            entry.payload !== undefined
              ? safeStringify(entry.payload)
              : entry.message
                ? safeStringify({ message: entry.message })
                : null,
          beforeValue: safeStringify(entry.before),
          afterValue: safeStringify(entry.after),
          result: entry.result ?? 'SUCCESS',
        },
      });
    } catch (error) {
      this.logger.warn({ err: error, entity: entry.entity, action: entry.action }, 'falha ao gravar auditoria de domínio');
    }
  }

  /** Atalho com módulo fixo — cada serviço cria o seu no construtor. */
  forModule(me: AuditActor, module: string) {
    return (entry: Omit<DomainAuditEntry, 'module'>) => this.record(me, { ...entry, module });
  }
}

function safeStringify(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value, (_key, inner) => {
      if (typeof inner === 'bigint') return inner.toString();
      if (inner instanceof Date) return inner.toISOString();
      return inner;
    });
  } catch {
    return null;
  }
}
