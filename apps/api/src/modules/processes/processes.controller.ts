import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ProcessesService } from './processes.service';

@Controller('processes')
export class ProcessesController {
  constructor(private readonly service: ProcessesService) {}

  @Get()
  @RequirePermissions('processes:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('orgNodeId') orgNodeId?: string,
    @Query('indicatorId') indicatorId?: string,
  ) {
    return this.service.list(me, { status, type, search, orgNodeId, indicatorId });
  }

  @Get('summary')
  @RequirePermissions('processes:view')
  summary(@CurrentUser() me: AuthPayload) {
    return this.service.summary(me);
  }

  @Get('options')
  @RequirePermissions('processes:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get(':id')
  @RequirePermissions('processes:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me, id);
  }

  @Post()
  @RequirePermissions('processes:create')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.create(me, body);
  }

  @Patch(':id')
  @RequirePermissions('processes:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.update(me, id, body);
  }

  @Delete(':id')
  @RequirePermissions('processes:delete')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }

  @Post(':id/steps')
  @RequirePermissions('processes:update')
  addStep(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addStep(me, id, body);
  }

  @Patch('steps/:stepId')
  @RequirePermissions('processes:update')
  updateStep(@CurrentUser() me: AuthPayload, @Param('stepId') stepId: string, @Body() body: any) {
    return this.service.updateStep(me, stepId, body);
  }

  @Delete('steps/:stepId')
  @RequirePermissions('processes:update')
  removeStep(@CurrentUser() me: AuthPayload, @Param('stepId') stepId: string) {
    return this.service.removeStep(me, stepId);
  }
}
