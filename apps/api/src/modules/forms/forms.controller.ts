import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { FormsService } from './forms.service';

@Controller('forms')
export class FormsController {
  constructor(private readonly service: FormsService) {}

  @Get()
  @RequirePermissions('forms:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('orgNodeId') orgNodeId?: string,
    @Query('processId') processId?: string,
    @Query('indicatorId') indicatorId?: string,
  ) {
    return this.service.list(me, { status, type, search, orgNodeId, processId, indicatorId });
  }

  @Get('summary')
  @RequirePermissions('forms:view')
  summary(@CurrentUser() me: AuthPayload) {
    return this.service.summary(me);
  }

  @Get('options')
  @RequirePermissions('forms:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get(':id')
  @RequirePermissions('forms:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me, id);
  }

  @Post()
  @RequirePermissions('forms:create')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.create(me, body);
  }

  @Patch(':id')
  @RequirePermissions('forms:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.update(me, id, body);
  }

  @Delete(':id')
  @RequirePermissions('forms:delete')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }

  @Get(':id/submissions')
  @RequirePermissions('forms:view')
  submissions(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.listSubmissions(me, id);
  }

  @Post(':id/submissions')
  @RequirePermissions('forms:update')
  createSubmission(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.createSubmission(me, id, body);
  }

  @Patch('submissions/:submissionId')
  @RequirePermissions('forms:update')
  updateSubmission(@CurrentUser() me: AuthPayload, @Param('submissionId') submissionId: string, @Body() body: any) {
    return this.service.updateSubmission(me, submissionId, body);
  }
}
