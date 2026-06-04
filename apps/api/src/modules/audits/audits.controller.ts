import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { AuditsService } from './audits.service';

@Controller('audits')
export class AuditsController {
  constructor(private readonly service: AuditsService) {}

  @Get()
  @RequirePermissions('audits:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('orgNodeId') orgNodeId?: string,
  ) {
    return this.service.list(me, { status, type, search, orgNodeId });
  }

  @Get('summary')
  @RequirePermissions('audits:view')
  summary(@CurrentUser() me: AuthPayload) {
    return this.service.summary(me);
  }

  @Get('options')
  @RequirePermissions('audits:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get(':id')
  @RequirePermissions('audits:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me, id);
  }

  @Post()
  @RequirePermissions('audits:create')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.create(me, body);
  }

  @Patch(':id')
  @RequirePermissions('audits:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.update(me, id, body);
  }

  @Delete(':id')
  @RequirePermissions('audits:delete')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }

  // Constatacoes (findings)
  @Post(':id/findings')
  @RequirePermissions('audits:update')
  addFinding(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addFinding(me, id, body);
  }

  @Patch('findings/:findingId')
  @RequirePermissions('audits:update')
  updateFinding(@CurrentUser() me: AuthPayload, @Param('findingId') findingId: string, @Body() body: any) {
    return this.service.updateFinding(me, findingId, body);
  }

  @Delete('findings/:findingId')
  @RequirePermissions('audits:update')
  removeFinding(@CurrentUser() me: AuthPayload, @Param('findingId') findingId: string) {
    return this.service.removeFinding(me, findingId);
  }

  /** Gera uma nao conformidade a partir de uma constatacao. */
  @Post('findings/:findingId/nonconformity')
  @RequirePermissions('audits:update')
  generateNc(@CurrentUser() me: AuthPayload, @Param('findingId') findingId: string, @Body() body: any) {
    return this.service.generateNonConformity(me, findingId, body);
  }
}
