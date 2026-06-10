import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PrizePayrollService } from './prize-payroll.service';
import { ReturnRow } from './prize-payroll.util';

@Controller('prize/payroll')
export class PrizePayrollController {
  constructor(private readonly service: PrizePayrollService) {}

  @Get('batches')
  @RequirePermissions('prize:view')
  list(@CurrentUser() me: AuthPayload, @Query('competenceId') competenceId?: string) {
    return this.service.list(me.companyId, competenceId);
  }

  @Get('batches/:id')
  @RequirePermissions('prize:view')
  get(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.get(me.companyId, id);
  }

  @Get('batches/:id/export')
  @RequirePermissions('prize:payroll:manage')
  async export(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Res() res: Response) {
    const { filename, csv } = await this.service.exportCsv(me.companyId, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send('﻿' + csv);
  }

  @Post('competence/:competenceId/generate')
  @RequirePermissions('prize:payroll:manage')
  generate(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Body() body: { rubric?: string }) {
    return this.service.generate(me, competenceId, body?.rubric);
  }

  @Post('batches/:id/sent')
  @RequirePermissions('prize:payroll:manage')
  markSent(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { protocol?: string }) {
    return this.service.markSent(me, id, body?.protocol);
  }

  @Post('batches/:id/return')
  @RequirePermissions('prize:payroll:manage')
  importReturn(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { rows: ReturnRow[] }) {
    return this.service.importReturn(me, id, body?.rows ?? []);
  }

  @Post('batches/:id/cancel')
  @RequirePermissions('prize:payroll:manage')
  cancel(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.cancel(me, id);
  }
}
