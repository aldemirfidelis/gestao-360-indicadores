import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PrizeCalcService } from './prize-calc.service';
import { PrizeCalcConfigService } from './prize-calc-config.service';

@Controller('prize/calc')
export class PrizeCalcController {
  constructor(
    private readonly calc: PrizeCalcService,
    private readonly config: PrizeCalcConfigService,
  ) {}

  // ----- apuracao -----
  @Post('competence/:competenceId/run')
  @RequirePermissions('prize:calc:run')
  run(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.calc.run(me, competenceId);
  }

  @Post('competence/:competenceId/reprocess')
  @RequirePermissions('prize:calc:run')
  reprocess(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Body() body: { reason: string }) {
    return this.calc.reprocess(me, competenceId, body?.reason ?? '');
  }

  @Get('competence/:competenceId/results')
  @RequirePermissions('prize:view')
  results(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.calc.results(me.companyId, competenceId);
  }

  @Post('competence/:competenceId/submit-review')
  @RequirePermissions('prize:calc:run')
  submitReview(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.calc.conference(me, competenceId, 'SUBMIT_REVIEW');
  }

  @Post('competence/:competenceId/approve')
  @RequirePermissions('prize:calc:approve')
  approve(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Body() body: { comment?: string }) {
    return this.calc.conference(me, competenceId, 'APPROVE', body?.comment);
  }

  @Post('competence/:competenceId/reject')
  @RequirePermissions('prize:calc:approve')
  reject(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Body() body: { comment: string }) {
    return this.calc.conference(me, competenceId, 'REJECT', body?.comment);
  }

  @Get('result/:resultId/memory')
  @RequirePermissions('prize:view')
  memory(@CurrentUser() me: AuthPayload, @Param('resultId') resultId: string) {
    return this.calc.memory(me.companyId, resultId);
  }

  // ----- moderadores -----
  @Get('moderators')
  @RequirePermissions('prize:view')
  listModerators(@CurrentUser() me: AuthPayload, @Query('programId') programId?: string) {
    return this.config.listModerators(me.companyId, programId);
  }

  @Post('moderators')
  @RequirePermissions('prize:admin')
  createModerator(@CurrentUser() me: AuthPayload, @Body() dto: any) {
    return this.config.upsertModerator(me, null, dto);
  }

  @Patch('moderators/:id')
  @RequirePermissions('prize:admin')
  updateModerator(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: any) {
    return this.config.upsertModerator(me, id, dto);
  }

  @Delete('moderators/:id')
  @RequirePermissions('prize:admin')
  removeModerator(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.config.removeModerator(me, id);
  }

  // ----- ajustes -----
  @Get('competence/:competenceId/adjustments')
  @RequirePermissions('prize:view')
  listAdjustments(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.config.listAdjustments(me.companyId, competenceId);
  }

  @Post('competence/:competenceId/adjustments')
  @RequirePermissions('prize:adjustments:manage')
  createAdjustment(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Body() dto: any) {
    return this.config.createAdjustment(me, competenceId, dto);
  }

  @Patch('adjustments/:id/decide')
  @RequirePermissions('prize:adjustments:approve')
  decideAdjustment(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { decision: 'APPROVE' | 'REJECT'; comment?: string }) {
    return this.config.decideAdjustment(me, id, body.decision, body.comment);
  }

  // ----- excecoes -----
  @Get('competence/:competenceId/exceptions')
  @RequirePermissions('prize:view')
  listExceptions(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.config.listExceptions(me.companyId, competenceId);
  }

  @Post('competence/:competenceId/exceptions')
  @RequirePermissions('prize:adjustments:manage')
  createException(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Body() dto: any) {
    return this.config.createException(me, competenceId, dto);
  }

  @Patch('exceptions/:id/decide')
  @RequirePermissions('prize:adjustments:approve')
  decideException(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { decision: 'APPROVE' | 'REJECT'; comment?: string }) {
    return this.config.decideException(me, id, body.decision, body.comment);
  }

  // ----- transitoriedade -----
  @Get('competence/:competenceId/allocations')
  @RequirePermissions('prize:view')
  listAllocations(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.config.listAllocations(me.companyId, competenceId);
  }

  @Post('competence/:competenceId/allocations')
  @RequirePermissions('prize:adjustments:manage')
  createAllocation(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Body() dto: any) {
    return this.config.createAllocation(me, competenceId, dto);
  }
}
