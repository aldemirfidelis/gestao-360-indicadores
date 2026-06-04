import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @RequirePermissions('doc:view')
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
  @RequirePermissions('doc:view')
  summary(@CurrentUser() me: AuthPayload) {
    return this.service.summary(me);
  }

  @Get('options')
  @RequirePermissions('doc:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get(':id')
  @RequirePermissions('doc:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me, id);
  }

  @Post()
  @RequirePermissions('doc:create')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.create(me, body);
  }

  @Patch(':id')
  @RequirePermissions('doc:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.update(me, id, body);
  }

  @Delete(':id')
  @RequirePermissions('doc:delete')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }
}
