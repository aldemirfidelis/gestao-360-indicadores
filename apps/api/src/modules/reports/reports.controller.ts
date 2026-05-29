import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('reports')
@RequirePermissions('reports:export')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('indicators.csv')
  async indicators(@CurrentUser() me: AuthPayload, @Res() res: Response) {
    const csv = await this.service.indicatorsCsv(me.companyId);
    this.sendCsv(res, 'indicadores.csv', csv);
  }

  @Get('results.csv')
  async results(
    @CurrentUser() me: AuthPayload,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.service.resultsCsv(me.companyId, from, to);
    this.sendCsv(res, 'lançamentos.csv', csv);
  }

  @Get('actions.csv')
  async actions(@CurrentUser() me: AuthPayload, @Res() res: Response) {
    const csv = await this.service.actionsCsv(me.companyId);
    this.sendCsv(res, 'ações.csv', csv);
  }

  @Get('deviations.csv')
  async deviations(@CurrentUser() me: AuthPayload, @Res() res: Response) {
    const csv = await this.service.deviationsCsv(me.companyId);
    this.sendCsv(res, 'desvios.csv', csv);
  }

  private sendCsv(res: Response, filename: string, csv: string) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv); // BOM para Excel pt-BR
  }
}
