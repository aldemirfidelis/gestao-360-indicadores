import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { DbAdminSubmenu } from '../database-admin.constants';
import { safeStringify } from '../util/serialize';

export interface AuditEntryInput {
  user?: AuthPayload | null;
  submenu: DbAdminSubmenu | string;
  action: string;
  mode?: 'safe' | 'advanced' | null;
  targetTable?: string | null;
  targetRecordId?: string | null;
  sqlText?: string | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  rowsAffected?: number | null;
  result?: 'SUCCESS' | 'ERROR' | 'DENIED';
  message?: string | null;
  transactionId?: string | null;
  backupId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Padrões redigidos em SQL/valores antes de persistir. */
const SENSITIVE_KEY = /password|passwordhash|token|secret|refreshtoken|authorization|apikey|api_key/i;

@Injectable()
export class DbAdminAuditService {
  private readonly logger = new Logger(DbAdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Grava um evento administrativo. Nunca lança — auditoria não pode quebrar a operação. */
  async record(entry: AuditEntryInput): Promise<string | null> {
    try {
      const created = await this.prisma.dbAdminAuditLog.create({
        data: {
          userId: entry.user?.sub ?? null,
          userEmail: entry.user?.email ?? null,
          userRole: entry.user?.role ?? null,
          submenu: String(entry.submenu),
          action: entry.action,
          mode: entry.mode ?? null,
          targetTable: entry.targetTable ?? null,
          targetRecordId: entry.targetRecordId ?? null,
          sqlText: entry.sqlText ?? null,
          beforeValue: entry.beforeValue !== undefined ? this.redactStringify(entry.beforeValue) : null,
          afterValue: entry.afterValue !== undefined ? this.redactStringify(entry.afterValue) : null,
          rowsAffected: entry.rowsAffected ?? null,
          result: entry.result ?? 'SUCCESS',
          message: entry.message ?? null,
          transactionId: entry.transactionId ?? null,
          backupId: entry.backupId ?? null,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
        },
        select: { id: true },
      });
      return created.id;
    } catch (err) {
      this.logger.warn(`Falha ao gravar auditoria administrativa: ${(err as Error).message}`);
      return null;
    }
  }

  private redactStringify(value: unknown): string | null {
    return safeStringify(redactDeep(value));
  }

  async list(params: {
    from?: string;
    to?: string;
    userId?: string;
    submenu?: string;
    action?: string;
    result?: string;
    targetTable?: string;
    q?: string;
    skip?: number;
    take?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (params.userId) where.userId = params.userId;
    if (params.submenu) where.submenu = params.submenu;
    if (params.action) where.action = params.action;
    if (params.result) where.result = params.result;
    if (params.targetTable) where.targetTable = params.targetTable;
    if (params.from || params.to) {
      where.createdAt = {
        ...(params.from ? { gte: new Date(params.from) } : {}),
        ...(params.to ? { lte: new Date(params.to) } : {}),
      };
    }
    if (params.q) {
      where.OR = [
        { message: { contains: params.q, mode: 'insensitive' } },
        { sqlText: { contains: params.q, mode: 'insensitive' } },
        { targetTable: { contains: params.q, mode: 'insensitive' } },
        { userEmail: { contains: params.q, mode: 'insensitive' } },
        { action: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    const take = Math.min(Math.max(params.take ?? 100, 1), 500);
    const skip = Math.max(params.skip ?? 0, 0);
    const [rows, total] = await Promise.all([
      this.prisma.dbAdminAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.dbAdminAuditLog.count({ where }),
    ]);
    return { rows, total, skip, take };
  }
}

function redactDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redactDeep(v);
    }
    return out;
  }
  return value;
}
