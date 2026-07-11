import { Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ReportsService } from './reports.service';

@Controller('personnel/reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('overview')
  @RequirePermissions('pessoal:view')
  overview(@CurrentUser() me: AuthPayload, @Query('ref') ref?: string) {
    return this.service.overview(me, ref);
  }

  @Get('turnover')
  @RequirePermissions('pessoal:view')
  turnover(@CurrentUser() me: AuthPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.turnover(me, from, to);
  }

  @Get('absenteeism')
  @RequirePermissions('pessoal:view')
  absenteeism(@CurrentUser() me: AuthPayload, @Query('ref') ref?: string) {
    return this.service.absenteeism(me, ref);
  }

  @Get('overtime')
  @RequirePermissions('pessoal:view')
  overtime(@CurrentUser() me: AuthPayload, @Query('ref') ref?: string) {
    return this.service.overtime(me, ref);
  }

  @Get('payroll/:ref/export.csv')
  @RequirePermissions('pessoal:view', 'pessoal:manage')
  async payrollCsv(@CurrentUser() me: AuthPayload, @Param('ref') ref: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.service.payrollExport(me, ref, 'csv');
    res.setHeader('content-type', result.mimeType);
    res.setHeader('content-disposition', `attachment; filename="${result.fileName}"`);
    return new StreamableFile(result.content);
  }

  @Get('payroll/:ref/export.xlsx')
  @RequirePermissions('pessoal:view', 'pessoal:manage')
  async payrollXlsx(@CurrentUser() me: AuthPayload, @Param('ref') ref: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.service.payrollExport(me, ref, 'xlsx');
    res.setHeader('content-type', result.mimeType);
    res.setHeader('content-disposition', `attachment; filename="${result.fileName}"`);
    return new StreamableFile(result.content);
  }
}
