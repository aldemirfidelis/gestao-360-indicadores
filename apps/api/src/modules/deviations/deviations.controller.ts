import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DeviationsService } from './deviations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { AnalysisMethod, DeviationSeverity, DeviationStatus } from '@prisma/client';

@Controller('deviations')
export class DeviationsController {
  constructor(private readonly service: DeviationsService) {}

  @Get()
  list(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: DeviationStatus,
    @Query('indicatorId') indicatorId?: string,
  ) {
    return this.service.list(me.companyId, status, indicatorId);
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  open(
    @CurrentUser() me: AuthPayload,
    @Body()
    body: {
      indicatorId: string;
      periodRef: string;
      title?: string;
      severity?: DeviationSeverity;
      responsibleUserId?: string;
      dueDate?: string;
      method?: AnalysisMethod;
      fact?: string;
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
      createdById: me.sub,
    });
  }

  @Patch(':id')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() patch: any) {
    return this.service.update(id, patch, me.sub);
  }

  @Post(':id/causes')
  addCause(
    @Param('id') id: string,
    @Body() body: { description: string; category?: string; weight?: number },
    @CurrentUser() me: AuthPayload,
  ) {
    return this.service.addCause(id, body.description, body.category, body.weight ?? 1, me.sub);
  }

  @Delete('causes/:causeId')
  removeCause(@Param('causeId') causeId: string) {
    return this.service.removeCause(causeId);
  }

  @Post(':id/analyses')
  addAnalysis(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { method: AnalysisMethod; content: string },
  ) {
    return this.service.addAnalysis(id, body.method, body.content, me.sub);
  }

  @Post(':id/actions')
  createAction(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body()
    body: {
      title: string;
      description?: string;
      responsibleUserId?: string | null;
      ownerNodeId?: string | null;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      dueDate?: string | null;
      estimatedCost?: number | null;
    },
  ) {
    return this.service.createAction(id, me.sub, body);
  }

  @Post(':id/close')
  close(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.close(id, me.sub);
  }
}
