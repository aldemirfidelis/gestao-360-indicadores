import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { RisksService } from './risks.service';

@Controller('risks')
export class RisksController {
  constructor(private readonly service: RisksService) {}

  @Get()
  @RequirePermissions('risks:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('orgNodeId') orgNodeId?: string,
    @Query('indicatorId') indicatorId?: string,
    @Query('projectId') projectId?: string,
    @Query('actionId') actionId?: string,
  ) {
    return this.service.list(me, { status, category, search, orgNodeId, indicatorId, projectId, actionId });
  }

  @Get('summary')
  @RequirePermissions('risks:view')
  summary(@CurrentUser() me: AuthPayload) {
    return this.service.summary(me);
  }

  @Get('options')
  @RequirePermissions('risks:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get(':id')
  @RequirePermissions('risks:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me, id);
  }

  @Post()
  @RequirePermissions('risks:create')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.create(me, body);
  }

  @Patch(':id')
  @RequirePermissions('risks:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.update(me, id, body);
  }

  @Delete(':id')
  @RequirePermissions('risks:delete')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }
}
