import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ResultsService } from './results.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { indicatorResultUpsertSchema } from '@g360/shared';
import { z } from 'zod';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

const batchSchema = z.object({
  items: z.array(indicatorResultUpsertSchema).min(1).max(500),
});

@Controller('results')
export class ResultsController {
  constructor(private readonly service: ResultsService) {}

  @Get('pending')
  @RequirePermissions('launches:view')
  pending(
    @CurrentUser() me: AuthPayload,
    @Query('points') points?: string,
    @Query('ownerNodeId') ownerNodeId?: string,
    @Query('year') year?: string,
    @Query('indicatorId') indicatorId?: string,
  ) {
    const parsedYear = year ? parseInt(year, 10) : undefined;
    const parsedPoints = points ? parseInt(points, 10) : undefined;
    return this.service.pendingByCompany(me.companyId, {
      year: Number.isFinite(parsedYear) ? parsedYear : undefined,
      points: Number.isFinite(parsedPoints) ? parsedPoints : undefined,
      ownerNodeId,
      indicatorId,
    });
  }

  @Get('grain')
  @RequirePermissions('launches:view')
  grain(
    @CurrentUser() me: AuthPayload,
    @Query('indicatorId') indicatorId: string,
    @Query('granularity') granularity: string,
    @Query('month') month: string,
  ) {
    const allowed = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;
    const g = (allowed as readonly string[]).includes(granularity)
      ? (granularity as (typeof allowed)[number])
      : 'MONTHLY';
    return this.service.grainByMonth(me.companyId, indicatorId, g, month);
  }

  @Post()
  @RequirePermissions('results:launch')
  async upsert(
    @CurrentUser() me: AuthPayload,
    @Body(new ZodValidationPipe(indicatorResultUpsertSchema)) input: any,
  ) {
    return this.service.upsert(input, me.sub);
  }

  @Post('batch')
  @RequirePermissions('results:launch')
  async upsertBatch(
    @CurrentUser() me: AuthPayload,
    @Body(new ZodValidationPipe(batchSchema)) body: any,
  ) {
    const out = [];
    for (const item of body.items) {
      out.push(await this.service.upsert(item, me.sub));
    }
    return { count: out.length, results: out };
  }

  @Post(':id/approve')
  @RequirePermissions('results:approve')
  approve(@Param('id') id: string, @Body() body: { approve: boolean }) {
    return this.service.approve(id, body.approve);
  }
}
