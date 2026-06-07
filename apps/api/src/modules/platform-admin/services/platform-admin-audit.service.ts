import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlatformAdminIdentity } from '../platform-admin.types';

const SENSITIVE = /password|passwordhash|token|secret|authorization|apikey|api_key|database_url|connection/i;

export interface PlatformAuditInput {
  user?: PlatformAdminIdentity | null;
  action: string;
  permissionKey?: string | null;
  companyId?: string | null;
  moduleCode?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  justification?: string | null;
  result?: 'SUCCESS' | 'ERROR' | 'DENIED';
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class PlatformAdminAuditService {
  private readonly logger = new Logger(PlatformAdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: PlatformAuditInput): Promise<string | null> {
    try {
      const entry = await this.prisma.platformAuditLog.create({
        data: {
          userId: input.user?.sub ?? null,
          userEmail: input.user?.email ?? null,
          roleCodes: stringify(input.user?.roles ?? []),
          permissionKey: input.permissionKey ?? null,
          companyId: input.companyId ?? null,
          moduleCode: input.moduleCode ?? null,
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          targetLabel: input.targetLabel ?? null,
          action: input.action,
          beforeValue: input.beforeValue !== undefined ? stringify(redact(input.beforeValue)) : null,
          afterValue: input.afterValue !== undefined ? stringify(redact(input.afterValue)) : null,
          justification: input.justification ?? null,
          result: input.result ?? 'SUCCESS',
          sessionId: input.user?.sessionId ?? null,
          environment: process.env.NODE_ENV ?? 'development',
          correlationId: randomUUID(),
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
        select: { id: true },
      });
      return entry.id;
    } catch (err) {
      this.logger.warn(`Falha ao gravar auditoria do Portal Admin Global: ${(err as Error).message}`);
      return null;
    }
  }

  async list(params: {
    from?: string;
    to?: string;
    companyId?: string;
    moduleCode?: string;
    action?: string;
    result?: string;
    q?: string;
    skip?: number;
    take?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (params.companyId) where.companyId = params.companyId;
    if (params.moduleCode) where.moduleCode = params.moduleCode;
    if (params.action) where.action = params.action;
    if (params.result) where.result = params.result;
    if (params.from || params.to) {
      where.createdAt = {
        ...(params.from ? { gte: new Date(params.from) } : {}),
        ...(params.to ? { lte: new Date(params.to) } : {}),
      };
    }
    if (params.q) {
      where.OR = [
        { userEmail: { contains: params.q, mode: 'insensitive' } },
        { action: { contains: params.q, mode: 'insensitive' } },
        { targetLabel: { contains: params.q, mode: 'insensitive' } },
        { justification: { contains: params.q, mode: 'insensitive' } },
        { moduleCode: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const take = Math.min(Math.max(params.take ?? 100, 1), 500);
    const skip = Math.max(params.skip ?? 0, 0);
    const [rows, total] = await Promise.all([
      this.prisma.platformAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
      this.prisma.platformAuditLog.count({ where }),
    ]);
    return { rows, total, take, skip };
  }
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, val]) => [
      key,
      SENSITIVE.test(key) ? '[redacted]' : redact(val),
    ]),
  );
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
}
