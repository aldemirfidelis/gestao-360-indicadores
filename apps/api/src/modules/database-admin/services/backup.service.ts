import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { mkdir, readFile, writeFile, stat, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { PrismaService } from '../../../prisma/prisma.service';
import { safeStringify } from '../util/serialize';

export interface SnapshotResult {
  backupId: string | null;
  filePath: string;
  checksum: string;
  rowCount: number;
  sizeBytes: number;
}

/**
 * Backup LÓGICO por operação. Não é dump de banco inteiro (isso é via Neon PITR).
 * Antes de operações destrutivas, persiste as linhas afetadas em arquivo JSON
 * fora do banco (DB_ADMIN_BACKUP_DIR) e registra metadados em DbAdminBackup,
 * permitindo restauração no nível da operação.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  private dir(): string {
    return resolve(process.env.DB_ADMIN_BACKUP_DIR || join(process.cwd(), 'storage', 'db-admin-backups'));
  }

  /** Cria um snapshot lógico de linhas (pré-operação ou export). */
  async snapshot(params: {
    table: string;
    rows: Record<string, unknown>[];
    type?: 'PRE_OP' | 'TABLE_EXPORT' | 'MANUAL_LOGICAL';
    reason?: string;
    relatedOperation?: string;
    userId?: string | null;
    userEmail?: string | null;
    important?: boolean;
  }): Promise<SnapshotResult> {
    const dir = this.dir();
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${params.table}__${params.type ?? 'PRE_OP'}__${ts}.json`;
    const filePath = join(dir, fileName);
    const payload = {
      table: params.table,
      type: params.type ?? 'PRE_OP',
      reason: params.reason ?? null,
      relatedOperation: params.relatedOperation ?? null,
      createdAt: new Date().toISOString(),
      rowCount: params.rows.length,
      rows: params.rows,
    };
    const content = safeStringify(payload) ?? '{}';
    await writeFile(filePath, content, 'utf8');
    const checksum = createHash('sha256').update(content).digest('hex');
    const sizeBytes = Buffer.byteLength(content, 'utf8');

    let backupId: string | null = null;
    try {
      const created = await this.prisma.dbAdminBackup.create({
        data: {
          userId: params.userId ?? null,
          userEmail: params.userEmail ?? null,
          type: params.type ?? 'PRE_OP',
          reason: params.reason ?? null,
          relatedOperation: params.relatedOperation ?? null,
          targetTables: safeStringify([params.table]) ?? '[]',
          format: 'json',
          filePath,
          sizeBytes,
          rowCount: params.rows.length,
          checksum,
          important: params.important ?? false,
          status: 'AVAILABLE',
          integrityVerified: true,
        },
        select: { id: true },
      });
      backupId = created.id;
    } catch (err) {
      this.logger.warn(`Falha ao registrar metadados de backup: ${(err as Error).message}`);
    }
    return { backupId, filePath, checksum, rowCount: params.rows.length, sizeBytes };
  }

  async list() {
    return this.prisma.dbAdminBackup.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async getFile(id: string): Promise<{ name: string; content: string } | null> {
    const b = await this.prisma.dbAdminBackup.findUnique({ where: { id } });
    if (!b || !existsSync(b.filePath)) return null;
    const content = await readFile(b.filePath, 'utf8');
    return { name: b.filePath.split(/[\\/]/).pop() ?? `backup-${id}.json`, content };
  }

  async verify(id: string): Promise<{ ok: boolean; reason?: string }> {
    const b = await this.prisma.dbAdminBackup.findUnique({ where: { id } });
    if (!b) return { ok: false, reason: 'Backup não encontrado' };
    if (!existsSync(b.filePath)) return { ok: false, reason: 'Arquivo ausente' };
    const content = await readFile(b.filePath, 'utf8');
    const checksum = createHash('sha256').update(content).digest('hex');
    const ok = checksum === b.checksum;
    await this.prisma.dbAdminBackup.update({ where: { id }, data: { integrityVerified: ok, status: ok ? b.status : 'CORRUPTED' } });
    return ok ? { ok } : { ok, reason: 'Checksum divergente' };
  }

  async setImportant(id: string, important: boolean) {
    return this.prisma.dbAdminBackup.update({ where: { id }, data: { important } });
  }

  async remove(id: string) {
    const b = await this.prisma.dbAdminBackup.findUnique({ where: { id } });
    if (b && existsSync(b.filePath)) {
      try {
        await unlink(b.filePath);
      } catch {
        /* arquivo pode já não existir */
      }
    }
    await this.prisma.dbAdminBackup.update({ where: { id }, data: { status: 'DELETED' } });
    return { ok: true };
  }

  async fileMeta(id: string): Promise<{ exists: boolean; sizeBytes: number }> {
    const b = await this.prisma.dbAdminBackup.findUnique({ where: { id } });
    if (!b || !existsSync(b.filePath)) return { exists: false, sizeBytes: 0 };
    const s = await stat(b.filePath);
    return { exists: true, sizeBytes: s.size };
  }
}
