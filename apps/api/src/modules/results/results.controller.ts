import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ResultsService } from './results.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { indicatorResultUpsertSchema } from '@g360/shared';
import { z } from 'zod';

const batchSchema = z.object({
  items: z.array(indicatorResultUpsertSchema).min(1).max(500),
});

@Controller('results')
export class ResultsController {
  constructor(private readonly service: ResultsService) {}

  @Get('pending')
  pending(
    @CurrentUser() me: AuthPayload,
    @Query('points') points?: string,
    @Query('ownerNodeId') ownerNodeId?: string,
  ) {
    return this.service.pendingByCompany(
      me.companyId,
      points ? parseInt(points, 10) : 6,
      ownerNodeId,
    );
  }

  @Post()
  async upsert(
    @CurrentUser() me: AuthPayload,
    @Body(new ZodValidationPipe(indicatorResultUpsertSchema)) input: any,
  ) {
    return this.service.upsert(input, me.sub);
  }

  @Post('batch')
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
  approve(@Param('id') id: string, @Body() body: { approve: boolean }) {
    return this.service.approve(id, body.approve);
  }
}
