import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IndicatorsService } from './indicators.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { indicatorCreateSchema, indicatorTargetUpsertSchema } from '@g360/shared';
import { TrafficLight } from '@prisma/client';

@Controller('indicators')
export class IndicatorsController {
  constructor(private readonly service: IndicatorsService) {}

  @Get()
  list(
    @CurrentUser() me: AuthPayload,
    @Query('ownerNodeId') ownerNodeId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('light') light?: TrafficLight,
  ) {
    return this.service.list({
      companyId: me.companyId,
      ownerNodeId,
      type,
      status,
      search,
      light,
    });
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Get(':id/series')
  series(@Param('id') id: string, @Query('points') points?: string) {
    return this.service.series(id, points ? parseInt(points, 10) : 12);
  }

  @Get(':id/targets')
  targets(@Param('id') id: string) {
    return this.service.listTargets(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(indicatorCreateSchema)) input: any) {
    return this.service.create(input);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: any) {
    return this.service.update(id, input);
  }

  @Post(':id/targets')
  upsertTarget(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(indicatorTargetUpsertSchema.partial({ indicatorId: true }))) body: any,
  ) {
    return this.service.upsertTarget({ ...body, indicatorId: id });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // --- tree ---

  @Get('tree/graph')
  graph(@CurrentUser() me: AuthPayload) {
    return this.service.treeGraph(me.companyId);
  }

  @Get(':id/children')
  children(@Param('id') id: string) {
    return this.service.listChildren(id);
  }

  @Post(':id/children')
  addChild(
    @Param('id') id: string,
    @Body() body: { childId: string; kind?: string; weight?: number },
  ) {
    return this.service.addRelation(id, body.childId, body.kind ?? 'POSITIVE', body.weight ?? 1);
  }

  @Delete(':id/children/:childId')
  removeChild(@Param('id') id: string, @Param('childId') childId: string) {
    return this.service.removeRelation(id, childId);
  }

  @Get(':id/impact')
  impact(@Param('id') id: string, @Query('depth') depth?: string) {
    return this.service.simulateImpact(id, depth ? parseInt(depth, 10) : 4);
  }
}
