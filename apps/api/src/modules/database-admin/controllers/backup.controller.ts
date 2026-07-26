import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { Request } from 'express';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { BackupService } from '../services/backup.service';
import { ImportService } from '../services/import.service';
import { PostgreSQLAdapter } from '../adapters/postgresql.adapter';
import { SchemaInspectionService } from '../services/schema-inspection.service';
import { quoteIdent } from '../util/identifier.util';
import { DB_ADMIN_LIMITS } from '../database-admin.constants';

@Controller('admin/database/backups')
@Roles(UserRoleEnum.SUPER_ADMIN)
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
  list(@CurrentUser() user: AuthPayload) {
    return this.backup.list(user.companyId);
  }

  /** Backup lógico manual de uma tabela. */
  @Post()
  async create(@Body() body: { table: string; reason?: string }, @CurrentUser() user: AuthPayload) {
    await this.schema.assertCompanyScopedTable(String(body?.table));
    const res = await this.pg.runReadOnly(
      `SELECT * FROM ${quoteIdent(body.table, 'tabela')} WHERE "companyId" = $1 LIMIT ${DB_ADMIN_LIMITS.maxSnapshotRows}`,
      { params: [user.companyId] },
    );
    return this.backup.snapshot({
      companyId: user.companyId,
      table: body.table, rows: res.rows, type: 'MANUAL_LOGICAL', reason: body?.reason ?? 'Backup manual',
      userId: user.sub, userEmail: user.email, important: true,
    });
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @CurrentUser() user: AuthPayload) {
    const file = await this.backup.getFile(id, user.companyId);
    if (!file) throw new BadRequestException('Backup indisponível ou arquivo ausente.');
    return file; // { name, content } — frontend gera o download
  }

  @Post(':id/verify')
  verify(@Param('id') id: string, @CurrentUser() user: AuthPayload) {
    return this.backup.verify(id, user.companyId);
  }

  @Post(':id/important')
  important(@Param('id') id: string, @Body() body: { important: boolean }, @CurrentUser() user: AuthPayload) {
    return this.backup.setImportant(id, user.companyId, Boolean(body?.important));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthPayload) {
    return this.backup.remove(id, user.companyId);
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
    const file = await this.backup.getFile(id, user.companyId);
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
