import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { ExportService, ExportFormat } from '../services/export.service';
import { ImportService, ImportFormat, ImportStrategy } from '../services/import.service';

function meta(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null };
}

@Controller('admin/database')
@UseGuards(SuperAdminDbGuard)
@DbAdminSubmenuTag('import-export')
export class ImportExportController {
  constructor(
    private readonly exporter: ExportService,
    private readonly importer: ImportService,
  ) {}

  @Post('export')
  export(
    @Body() body: { table?: string; sql?: string; format: ExportFormat },
    @CurrentUser() user: AuthPayload,
    @Req() req: Request,
  ) {
    if (body?.sql) return this.exporter.exportQuery(body.sql, body.format, user, meta(req));
    return this.exporter.exportTable(String(body?.table), body?.format ?? 'csv', user, meta(req));
  }

  @Post('import/preview')
  preview(@Body() body: { table: string; format: ImportFormat; content: string }) {
    return this.importer.preview(body?.table, body?.format ?? 'csv', body?.content ?? '');
  }

  @Post('import/commit')
  commit(
    @Body()
    body: { table: string; format: ImportFormat; content: string; mapping?: Record<string, string>; strategy: ImportStrategy; keyColumns?: string[] },
    @CurrentUser() user: AuthPayload,
    @Req() req: Request,
  ) {
    return this.importer.commit(
      body?.table,
      body?.format ?? 'csv',
      body?.content ?? '',
      body?.mapping ?? {},
      body?.strategy ?? 'insert',
      body?.keyColumns ?? [],
      user,
      meta(req),
    );
  }
}
