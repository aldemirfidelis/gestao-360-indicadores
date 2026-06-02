import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { RecordManagementService } from '../services/record-management.service';
import type { FilterCondition } from '../util/where-builder';

function meta(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null };
}

@Controller('admin/database/tables/:table/rows')
@UseGuards(SuperAdminDbGuard)
@DbAdminSubmenuTag('records')
export class RecordsController {
  constructor(private readonly records: RecordManagementService) {}

  @Get()
  list(
    @Param('table') table: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: string,
    @Query('search') search?: string,
    @Query('filters') filters?: string,
  ) {
    let parsedFilters: FilterCondition[] = [];
    if (filters) {
      try {
        const arr = JSON.parse(filters);
        if (Array.isArray(arr)) parsedFilters = arr;
      } catch {
        parsedFilters = [];
      }
    }
    return this.records.getRows(table, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      sort,
      dir: dir === 'desc' ? 'desc' : 'asc',
      search,
      filters: parsedFilters,
    });
  }

  @Post()
  create(
    @Param('table') table: string,
    @Body() body: { values: Record<string, unknown> },
    @CurrentUser() user: AuthPayload,
    @Req() req: Request,
  ) {
    return this.records.insert(table, body?.values ?? {}, user, meta(req));
  }

  @Patch()
  update(
    @Param('table') table: string,
    @Body() body: { key: Record<string, unknown>; values: Record<string, unknown> },
    @CurrentUser() user: AuthPayload,
    @Req() req: Request,
  ) {
    return this.records.update(table, body?.key ?? {}, body?.values ?? {}, user, meta(req));
  }

  @Post('delete')
  remove(
    @Param('table') table: string,
    @Body() body: { keys: Record<string, unknown>[] },
    @CurrentUser() user: AuthPayload,
    @Req() req: Request,
  ) {
    return this.records.deleteRows(table, body?.keys ?? [], user, meta(req));
  }
}
