import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';

export interface PrizeAuditInput {
  action: string;
  entityType: string;
  entityId: string;
  competenceId?: string | null;
  before?: unknown;
  after?: unknown;
  justification?: string | null;
}

/**
 * Trilha de auditoria do modulo de premio. Registros imutaveis (sem update/delete
 * por telas comuns). Toda acao critica (criar, editar, submeter, aprovar, fechar,
 * reabrir, substituir) deve chamar log().
 */
@Injectable()
export class PrizeAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(me: AuthPayload, input: PrizeAuditInput) {
    return this.prisma.prizeAuditLog.create({
      data: {
        companyId: me.companyId,
        userId: me.sub,
        userEmail: me.email,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        competenceId: input.competenceId ?? null,
        before: (input.before as object) ?? undefined,
        after: (input.after as object) ?? undefined,
        justification: input.justification ?? null,
      },
    });
  }

  async list(companyId: string, filters: { entityType?: string; entityId?: string; competenceId?: string } = {}) {
    return this.prisma.prizeAuditLog.findMany({
      where: {
        companyId,
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.entityId ? { entityId: filters.entityId } : {}),
        ...(filters.competenceId ? { competenceId: filters.competenceId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
