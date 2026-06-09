import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { LaunchActualDto, PrizeActualsService } from './prize-actuals.service';
import { PrizePrevistoRealizadoService } from './prize-previsto-realizado.service';

@Controller('prize/actuals')
export class PrizeActualsController {
  constructor(
    private readonly service: PrizeActualsService,
    private readonly pxr: PrizePrevistoRealizadoService,
  ) {}

  @Get('competence/:competenceId')
  @RequirePermissions('prize:view')
  list(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.service.listByCompetence(me.companyId, competenceId);
  }

  @Get('previsto-realizado/:competenceId')
  @RequirePermissions('prize:view')
  previstoRealizado(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Query('scopeKey') scopeKey?: string) {
    return this.pxr.forCompetence(me.companyId, competenceId, scopeKey ?? '');
  }

  @Post('competence/:competenceId')
  @RequirePermissions('prize:actuals:manage')
  launch(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Body() dto: LaunchActualDto) {
    return this.service.launch(me, competenceId, dto);
  }

  @Post('competence/:competenceId/grid')
  @RequirePermissions('prize:actuals:manage')
  saveGrid(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Body() body: { rows: LaunchActualDto[] }) {
    return this.service.saveGrid(me, competenceId, body?.rows ?? []);
  }

  @Post('competence/:competenceId/close')
  @RequirePermissions('prize:actuals:close')
  closeActuals(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.service.closeForCompetence(me, competenceId);
  }

  @Patch(':actualId/status')
  @RequirePermissions('prize:actuals:manage')
  transition(@CurrentUser() me: AuthPayload, @Param('actualId') actualId: string, @Body() body: { status: any }) {
    return this.service.transition(me, actualId, body.status);
  }

  @Post(':actualId/reopen')
  @RequirePermissions('prize:actuals:close')
  reopen(@CurrentUser() me: AuthPayload, @Param('actualId') actualId: string, @Body() body: { justification: string }) {
    return this.service.reopen(me, actualId, body?.justification ?? '');
  }

  @Post(':actualId/evidence')
  @RequirePermissions('prize:actuals:manage')
  addEvidence(@CurrentUser() me: AuthPayload, @Param('actualId') actualId: string, @Body() body: { fileName: string; fileUrl?: string; note?: string }) {
    return this.service.addEvidence(me, actualId, body);
  }

  @Delete(':actualId/evidence/:evidenceId')
  @RequirePermissions('prize:actuals:manage')
  removeEvidence(@CurrentUser() me: AuthPayload, @Param('actualId') actualId: string, @Param('evidenceId') evidenceId: string) {
    return this.service.removeEvidence(me, actualId, evidenceId);
  }
}
