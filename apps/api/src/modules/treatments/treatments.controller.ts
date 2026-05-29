import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ActionPriority, AnalysisMethod, MeetingFormat, MeetingParticipantRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { TreatmentsService } from './treatments.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('treatments')
export class TreatmentsController {
  constructor(private readonly service: TreatmentsService) {}

  @Get(':id')
  @RequirePermissions('treatments:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me.companyId, id);
  }

  @Get('indicators/:indicatorId/current')
  @RequirePermissions('treatments:view')
  currentForIndicator(
    @CurrentUser() me: AuthPayload,
    @Param('indicatorId') indicatorId: string,
    @Query('periodRef') periodRef?: string,
  ) {
    return this.service.currentForIndicator(me.companyId, indicatorId, periodRef);
  }

  @Post('from-result/:resultId/start')
  @RequirePermissions('treatments:manage')
  startFromResult(@CurrentUser() me: AuthPayload, @Param('resultId') resultId: string) {
    return this.service.startFromResult(me.companyId, resultId, me.sub);
  }

  @Post(':id/ignore')
  @RequirePermissions('treatments:ignore')
  ignore(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { reason: string }) {
    return this.service.ignore(me.companyId, id, me.sub, body.reason);
  }

  @Post(':id/analysis')
  @RequirePermissions('treatments:manage')
  createAnalysis(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body()
    body: {
      problem: string;
      probableCause?: string;
      rootCause: string;
      method: AnalysisMethod;
      evidence?: string;
      observations?: string;
      dueDate?: string;
    },
  ) {
    return this.service.createAnalysis(me.companyId, id, me.sub, body);
  }

  @Post(':id/meeting')
  @RequirePermissions('treatments:manage')
  scheduleMeeting(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      startsAt: string;
      endsAt?: string;
      location?: string;
      format?: MeetingFormat;
      objective?: string;
      notes?: string;
      participants?: Array<{
        userId?: string;
        name?: string;
        email?: string;
        jobTitle?: string;
        area?: string;
        role?: MeetingParticipantRole;
        notes?: string;
      }>;
    },
  ) {
    return this.service.scheduleMeeting(me.companyId, id, me.sub, body);
  }

  @Post(':id/actions')
  @RequirePermissions('treatments:manage')
  createAction(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body()
    body: {
      title: string;
      description?: string;
      responsibleUserId?: string;
      responsibleEmail?: string;
      ownerNodeId?: string;
      startDate?: string;
      dueDate?: string;
      priority?: ActionPriority;
      evidenceRequired?: boolean;
      expectedResult?: string;
      observations?: string;
    },
  ) {
    return this.service.createAction(me.companyId, id, me.sub, body);
  }

  @Post(':id/reevaluate')
  @RequirePermissions('treatments:manage')
  reevaluate(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.reevaluate(me.companyId, id, me.sub);
  }
}
