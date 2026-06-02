import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { BackupService } from '../services/backup.service';
import { ImportService } from '../services/import.service';
import { PostgreSQLAdapter } from '../adapters/postgresql.adapter';
import { SchemaInspectionService } from '../services/schema-inspection.service';
import { assertInAllowlist, quoteIdent } from '../util/identifier.util';
import { DB_ADMIN_LIMITS } from '../database-admin.constants';

@Controller('admin/database/backups')
@UseGuards(SuperAdminDbGuard)
@DbAdminSubmenuTag('backup')
export class BackupController {
  constructor(
    private readonly backup: BackupService,
    private readonly importer: ImportService,
    private readonly pg: PostgreSQLAdapter,
    private readonly schema: SchemaInspectionService,
  ) {}

  @Get()
  list() {
    return this.backup.list();
  }

  /** Backup lógico manual de uma tabela. */
  @Post()
  async create(@Body() body: { table: string; reason?: string }, @CurrentUser() user: AuthPayload) {
    const allow = await this.schema.getAllowlist();
    assertInAllowlist(String(body?.table), allow, 'tabela');
    const res = await this.pg.runReadOnly(`SELECT * FROM ${quoteIdent(body.table, 'tabela')} LIMIT ${DB_ADMIN_LIMITS.maxSnapshotRows}`);
    return this.backup.snapshot({
      table: body.table, rows: res.rows, type: 'MANUAL_LOGICAL', reason: body?.reason ?? 'Backup manual',
      userId: user.sub, userEmail: user.email, important: true,
    });
  }

  @Get(':id/download')
  async download(@Param('id') id: string) {
    const file = await this.backup.getFile(id);
    if (!file) throw new BadRequestException('Backup indisponível ou arquivo ausente.');
    return file; // { name, content } — frontend gera o download
  }

  @Post(':id/verify')
  verify(@Param('id') id: string) {
    return this.backup.verify(id);
  }

  @Post(':id/important')
  important(@Param('id') id: string, @Body() body: { important: boolean }) {
    return this.backup.setImportant(id, Boolean(body?.important));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.backup.remove(id);
  }

  /**
   * Restauração LÓGICA: reinsere as linhas do snapshot na tabela (ON CONFLICT DO NOTHING),
   * via o pipeline seguro de import (transação + auditoria). Não é restore de banco inteiro.
   */
  @Post(':id/restore')
  async restore(
    @Param('id') id: string,
    @Body() body: { confirmationPhrase?: string },
    @CurrentUser() user: AuthPayload,
    @Req() req: Request,
  ) {
    if (body?.confirmationPhrase !== 'CONFIRMAR ALTERAÇÃO CRÍTICA') {
      throw new BadRequestException('Restauração exige a frase de confirmação: "CONFIRMAR ALTERAÇÃO CRÍTICA".');
    }
    const file = await this.backup.getFile(id);
    if (!file) throw new BadRequestException('Backup indisponível.');
    const payload = JSON.parse(file.content) as { table: string; rows: Record<string, unknown>[] };
    if (!payload?.table || !Array.isArray(payload.rows)) throw new BadRequestException('Snapshot inválido.');
    const report = await this.importer.commit(
      payload.table, 'json', JSON.stringify(payload.rows), {}, 'ignoreDuplicates', [], user,
      { ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null },
    );
    return { restoredInto: payload.table, ...report };
  }
}
