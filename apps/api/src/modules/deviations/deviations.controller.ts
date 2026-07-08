import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DeviationsService } from './deviations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { AnalysisMethod, DeviationSeverity, DeviationStatus } from '@prisma/client';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  deviationActionSchema,
  deviationAnalysisSchema,
  deviationCauseSchema,
  deviationOpenSchema,
  deviationUpdateSchema,
} from './deviations.dto';

@Controller('deviations')
export class DeviationsController {
  constructor(private readonly service: DeviationsService) {}

  @Get()
  @RequirePermissions('deviations:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: DeviationStatus,
    @Query('indicatorId') indicatorId?: string,
  ) {
    return this.service.list(me, status, indicatorId);
  }

  @Get(':id')
  @RequirePermissions('deviations:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me, id);
  }

  @Post()
  @RequirePermissions('deviations:create')
  open(
    @CurrentUser() me: AuthPayload,
    @Body(new ZodValidationPipe(deviationOpenSchema))
    body: {
      indicatorId: string;
      periodRef: string;
      title?: string;
      severity?: DeviationSeverity;
      responsibleUserId?: string;
      dueDate?: string;
      method?: AnalysisMethod;
      fact?: string;
      immediateAction?: string;
    },
  ) {
    return this.service.open({
      companyId: me.companyId,
      indicatorId: body.indicatorId,
      periodRef: body.periodRef,
      title: body.title,
      severity: body.severity,
      responsibleUserId: body.responsibleUserId ?? null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      method: body.method,
      fact: body.fact,
      immediateAction: body.immediateAction,
      createdById: me.sub,
    });
  }

  @Patch(':id')
  @RequirePermissions('deviations:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(deviationUpdateSchema)) patch: any) {
    return this.service.update(me, id, patch);
  }

  @Post(':id/causes')
  @RequirePermissions('deviations:update')
  addCause(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(deviationCauseSchema)) body: { description: string; category?: string; weight?: number },
    @CurrentUser() me: AuthPayload,
  ) {
    return this.service.addCause(me, id, body.description, body.category, body.weight ?? 1);
  }

  @Delete('causes/:causeId')
  @RequirePermissions('deviations:update')
  removeCause(@CurrentUser() me: AuthPayload, @Param('causeId') causeId: string) {
    return this.service.removeCause(me, causeId);
  }

  @Post(':id/analyses')
  @RequirePermissions('deviations:update')
  addAnalysis(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(deviationAnalysisSchema)) body: { method: AnalysisMethod; content: string },
  ) {
    return this.service.addAnalysis(me, id, body.method, body.content);
  }

  @Post(':id/actions')
  @RequirePermissions('actions:create')
  createAction(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(deviationActionSchema))
    body: {
      title: string;
      description?: string;
      responsibleUserId?: string | null;
      ownerNodeId?: string | null;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      dueDate?: string | null;
      estimatedCost?: number | null;
      expectedResult?: string | null;
    },
  ) {
    return this.service.createAction(me, id, body);
  }

  @Post(':id/close')
  @RequirePermissions('deviations:close')
  close(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.close(me, id);
  }
}
