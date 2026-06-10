import { Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PrizeReportsService } from './prize-reports.service';
import { PrizeAiService } from './prize-ai.service';

@Controller('prize/reports')
export class PrizeReportsController {
  constructor(
    private readonly reports: PrizeReportsService,
    private readonly ai: PrizeAiService,
  ) {}

  @Get('apuracao/:competenceId')
  @RequirePermissions('prize:reports:view')
  apuracao(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.reports.apuracao(me.companyId, competenceId);
  }

  @Get('apuracao/:competenceId/export')
  @RequirePermissions('prize:reports:view')
  async apuracaoExport(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Res() res: Response) {
    const csv = await this.reports.apuracaoCsv(me.companyId, competenceId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=apuracao-${competenceId.slice(0, 8)}.csv`);
    res.send('﻿' + csv);
  }

  @Get('operational')
  @RequirePermissions('prize:reports:view')
  operational(@CurrentUser() me: AuthPayload, @Query('competenceId') competenceId?: string) {
    return this.reports.operational(me.companyId, competenceId);
  }

  // ----- IA assistiva (recomendacao; nunca altera dados) -----
  @Post('ai/memory/:resultId')
  @RequirePermissions('prize:reports:view')
  explainMemory(@CurrentUser() me: AuthPayload, @Param('resultId') resultId: string) {
    return this.ai.explainMemory(me.companyId, resultId);
  }

  @Post('ai/competence/:competenceId')
  @RequirePermissions('prize:reports:view')
  summarize(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.ai.summarizeCompetence(me.companyId, competenceId);
  }
}
