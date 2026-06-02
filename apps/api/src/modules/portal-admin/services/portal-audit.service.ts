import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { PortalTab } from '../portal-admin.constants';

const SENSITIVE_KEY = /password|passwordhash|token|secret|refreshtoken|authorization|apikey|api_key|connectionstring|database_url/i;

export interface PortalAuditInput {
  user?: AuthPayload | null;
  tab: PortalTab | string;
  action: string;
  targetType?: string | null;
  targetCode?: string | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  reason?: string | null;
  result?: 'SUCCESS' | 'ERROR' | 'DENIED';
  message?: string | null;
  snapshotId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class PortalAuditService {
  private readonly logger = new Logger(PortalAuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: PortalAuditInput): Promise<string | null> {
    try {
      const created = await this.prisma.portalAdminAuditLog.create({
        data: {
          userId: entry.user?.sub ?? null,
          userEmail: entry.user?.email ?? null,
          userRole: entry.user?.role ?? null,
          tab: String(entry.tab),
          action: entry.action,
          targetType: entry.targetType ?? null,
          targetCode: entry.targetCode ?? null,
          beforeValue: entry.beforeValue !== undefined ? stringify(redact(entry.beforeValue)) : null,
          afterValue: entry.afterValue !== undefined ? stringify(redact(entry.afterValue)) : null,
          reason: entry.reason ?? null,
          result: entry.result ?? 'SUCCESS',
          message: entry.message ?? null,
          snapshotId: entry.snapshotId ?? null,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
        },
        select: { id: true },
      });
      return created.id;
    } catch (err) {
      this.logger.warn(`Falha ao gravar auditoria do portal: ${(err as Error).message}`);
      return null;
    }
  }

  async list(params: { from?: string; to?: string; userId?: string; tab?: string; action?: string; result?: string; targetCode?: string; q?: string; skip?: number; take?: number }) {
    const where: Record<string, unknown> = {};
    if (params.userId) where.userId = params.userId;
    if (params.tab) where.tab = params.tab;
    if (params.action) where.action = params.action;
    if (params.result) where.result = params.result;
    if (params.targetCode) where.targetCode = params.targetCode;
    if (params.from || params.to) where.createdAt = { ...(params.from ? { gte: new Date(params.from) } : {}), ...(params.to ? { lte: new Date(params.to) } : {}) };
    if (params.q) {
      where.OR = [
        { message: { contains: params.q, mode: 'insensitive' } },
        { targetCode: { contains: params.q, mode: 'insensitive' } },
        { userEmail: { contains: params.q, mode: 'insensitive' } },
        { action: { contains: params.q, mode: 'insensitive' } },
        { reason: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    const take = Math.min(Math.max(params.take ?? 100, 1), 500);
    const skip = Math.max(params.skip ?? 0, 0);
    const [rows, total] = await Promise.all([
      this.prisma.portalAdminAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.portalAdminAuditLog.count({ where }),
    ]);
    return { rows, total, skip, take };
  }
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v);
    return out;
  }
  return value;
}
function stringify(value: unknown): string | null {
  try { return JSON.stringify(value); } catch { return null; }
}
