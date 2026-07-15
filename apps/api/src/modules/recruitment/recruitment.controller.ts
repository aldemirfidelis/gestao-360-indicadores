import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { RecruitRequisitionService } from './recruit-requisition.service';
import { RecruitPostingService } from './recruit-posting.service';

/**
 * Recrutamento e Seleção (F1-F2). Rotas autenticadas /api/recruitment/*.
 * O portal público de carreiras é servido pelo CareersController (@Public).
 */
@Controller('recruitment')
export class RecruitmentController {
  constructor(
    private readonly requisitions: RecruitRequisitionService,
    private readonly postings: RecruitPostingService,
  ) {}

  // ------------------------------ pipelines ------------------------------

  @Get('pipelines')
  @RequirePermissions('recruit:view')
  listPipelines(@CurrentUser() me: AuthPayload) {
    return this.postings.listPipelines(me);
  }

  @Post('pipelines')
  @RequirePermissions('recruit:manage')
  createPipeline(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.postings.createPipeline(me, body);
  }

  // ------------------------------ vagas ------------------------------

  @Get('postings')
  @RequirePermissions('recruit:view')
  listPostings(@CurrentUser() me: AuthPayload, @Query('status') status?: string) {
    return this.postings.listPostings(me, status);
  }

  @Get('postings/:id')
  @RequirePermissions('recruit:view')
  getPosting(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.postings.getPosting(me, id);
  }

  @Post('requisitions/:id/posting')
  @RequirePermissions('recruit:manage')
  createPosting(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.postings.createFromRequisition(me, id);
  }

  @Post('postings/:id')
  @RequirePermissions('recruit:manage')
  updatePosting(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.postings.updatePosting(me, id, body);
  }

  @Post('postings/:id/publish')
  @RequirePermissions('recruit:manage')
  publishPosting(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.postings.publish(me, id);
  }

  @Post('postings/:id/status')
  @RequirePermissions('recruit:manage')
  setPostingStatus(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.postings.setStatus(me, id, String(body?.status ?? ''));
  }

  @Get('requisitions')
  @RequirePermissions('recruit:view')
  list(@CurrentUser() me: AuthPayload, @Query('status') status?: string, @Query('orgNodeId') orgNodeId?: string) {
    return this.requisitions.list(me, { status, orgNodeId });
  }

  @Get('requisitions/:id')
  @RequirePermissions('recruit:view')
  get(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.requisitions.get(me, id);
  }

  @Get('requisitions/:id/gate')
  @RequirePermissions('recruit:view')
  gate(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.requisitions.evaluateGate(me, id);
  }

  @Post('requisitions')
  @RequirePermissions('recruit:requisition:create')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.requisitions.create(me, body);
  }

  @Post('requisitions/:id/submit')
  @RequirePermissions('recruit:requisition:create')
  submit(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.requisitions.submit(me, id);
  }

  @Post('requisitions/:id/decide')
  @RequirePermissions('recruit:requisition:approve')
  decide(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.requisitions.decide(me, id, body);
  }

  @Post('requisitions/:id/gate-exception')
  @RequirePermissions('recruit:requisition:approve')
  gateException(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.requisitions.addGateException(me, id, body);
  }

  @Post('requisitions/:id/send-to-recruitment')
  @RequirePermissions('recruit:requisition:approve')
  sendToRecruitment(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.requisitions.sendToRecruitment(me, id);
  }

  @Post('requisitions/:id/cancel')
  @RequirePermissions('recruit:requisition:create')
  cancel(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.requisitions.cancel(me, id, body);
  }
}
