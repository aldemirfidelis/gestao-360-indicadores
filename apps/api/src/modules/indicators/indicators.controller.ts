import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IndicatorsService } from './indicators.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { indicatorTargetUpsertSchema } from '@g360/shared';
import { TrafficLight } from '@prisma/client';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('indicators')
export class IndicatorsController {
  constructor(private readonly service: IndicatorsService) {}

  @Get()
  @RequirePermissions('indicators:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('ownerNodeId') ownerNodeId?: string,
    @Query('areaMacroId') areaMacroId?: string,
    @Query('areaMicroId') areaMicroId?: string,
    @Query('type') type?: string,
    @Query('periodicity') periodicity?: string,
    @Query('responsibleUserId') responsibleUserId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('light') light?: TrafficLight,
    @Query('companyId') companyId?: string,
    @Query('year') year?: string,
  ) {
    return this.service.list({
      companyId: me.role === 'SUPER_ADMIN' && companyId ? companyId : me.companyId,
      enforceUserId: me.sub,
      ownerNodeId,
      areaMacroId,
      areaMicroId,
      type,
      periodicity,
      responsibleUserId,
      status,
      search,
      light,
      year,
    });
  }

  @Get('options')
  @RequirePermissions('indicators:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get('tree/graph')
  @RequirePermissions('indicators:view')
  graph(@CurrentUser() me: AuthPayload) {
    return this.service.treeGraph(me.companyId);
  }

  @Get(':id')
  @RequirePermissions('indicators:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(id, me);
  }

  @Get(':id/series')
  @RequirePermissions('indicators:view')
  series(@Param('id') id: string, @Query('points') points?: string) {
    return this.service.series(id, points ? parseInt(points, 10) : 12);
  }

  @Get(':id/targets')
  @RequirePermissions('indicators:view')
  targets(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.listTargets(id, me);
  }

  @Get(':id/history')
  @RequirePermissions('indicators:view')
  history(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.history(me, id);
  }

  @Post()
  @RequirePermissions('indicators:create')
  create(@CurrentUser() me: AuthPayload, @Body() input: any) {
    return this.service.create(me, input);
  }

  @Patch(':id')
  @RequirePermissions('indicators:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() input: any) {
    return this.service.update(me, id, input);
  }

  @Post(':id/targets')
  @RequirePermissions('indicators:update')
  upsertTarget(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(indicatorTargetUpsertSchema.partial({ indicatorId: true }))) body: any,
  ) {
    return this.service.upsertTarget({ ...body, indicatorId: id }, me);
  }

  @Post(':id/target')
  @RequirePermissions('indicators:update')
  upsertManagedTarget(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.upsertTargetForIndicator(me, id, body);
  }

  @Post(':id/targets/batch')
  @RequirePermissions('indicators:update')
  upsertTargetsBatch(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.upsertTargetsBatchForIndicator(me, id, body);
  }

  @Post(':id/results')
  @RequirePermissions('results:launch')
  upsertResult(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.upsertResult(me, id, body);
  }

  // --- anexos e comentarios de um resultado lancado (chaveados por indicador + periodo) ---

  @Get(':id/period/:periodRef/notes')
  @RequirePermissions('indicators:view')
  resultNotes(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Param('periodRef') periodRef: string,
  ) {
    return this.service.listResultNotes(me.companyId, id, periodRef);
  }

  @Post(':id/period/:periodRef/attachments')
  @RequirePermissions('results:launch')
  addResultAttachment(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Param('periodRef') periodRef: string,
    @Body() body: { fileName: string; mimeType?: string; dataBase64: string },
  ) {
    return this.service.addResultAttachment(me, id, periodRef, body);
  }

  @Post(':id/period/:periodRef/comments')
  @RequirePermissions('results:launch')
  addResultComment(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Param('periodRef') periodRef: string,
    @Body() body: { body: string },
  ) {
    return this.service.addResultComment(me, id, periodRef, body);
  }

  @Get('result-attachments/:attachmentId')
  @RequirePermissions('indicators:view')
  downloadResultAttachment(@CurrentUser() me: AuthPayload, @Param('attachmentId') attachmentId: string) {
    return this.service.getResultAttachment(me.companyId, attachmentId);
  }

  @Delete('result-attachments/:attachmentId')
  @RequirePermissions('results:launch')
  deleteResultAttachment(@CurrentUser() me: AuthPayload, @Param('attachmentId') attachmentId: string) {
    return this.service.deleteResultAttachment(me.companyId, attachmentId);
  }

  @Delete(':id')
  @RequirePermissions('indicators:delete')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }

  // --- tree ---

  @Get(':id/children')
  @RequirePermissions('indicators:view')
  children(@Param('id') id: string) {
    return this.service.listChildren(id);
  }

  @Post(':id/children')
  @RequirePermissions('indicators:update')
  addChild(
    @Param('id') id: string,
    @Body() body: { childId: string; kind?: string; weight?: number },
  ) {
    return this.service.addRelation(id, body.childId, body.kind ?? 'POSITIVE', body.weight ?? 1);
  }

  @Delete(':id/children/:childId')
  @RequirePermissions('indicators:update')
  removeChild(@Param('id') id: string, @Param('childId') childId: string) {
    return this.service.removeRelation(id, childId);
  }

  @Get(':id/impact')
  @RequirePermissions('indicators:view')
  impact(@Param('id') id: string, @Query('depth') depth?: string) {
    return this.service.simulateImpact(id, depth ? parseInt(depth, 10) : 4);
  }
}
