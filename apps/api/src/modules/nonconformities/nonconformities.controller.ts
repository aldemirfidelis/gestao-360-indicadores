import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { NonConformitiesService } from './nonconformities.service';

@Controller('nonconformities')
export class NonConformitiesController {
  constructor(private readonly service: NonConformitiesService) {}

  @Get()
  @RequirePermissions('nc:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('severity') severity?: string,
    @Query('search') search?: string,
    @Query('orgNodeId') orgNodeId?: string,
    @Query('indicatorId') indicatorId?: string,
    @Query('deviationId') deviationId?: string,
    @Query('actionId') actionId?: string,
  ) {
    return this.service.list(me, { status, source, severity, search, orgNodeId, indicatorId, deviationId, actionId });
  }

  @Get('summary')
  @RequirePermissions('nc:view')
  summary(@CurrentUser() me: AuthPayload) {
    return this.service.summary(me);
  }

  @Get('options')
  @RequirePermissions('nc:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get(':id')
  @RequirePermissions('nc:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me, id);
  }

  @Post()
  @RequirePermissions('nc:create')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.create(me, body);
  }

  @Patch(':id')
  @RequirePermissions('nc:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.update(me, id, body);
  }

  @Delete(':id')
  @RequirePermissions('nc:delete')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }
}
