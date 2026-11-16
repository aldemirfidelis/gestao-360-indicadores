import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthPayload } from '../auth/auth.types';
import type { ProcessIntegrationType } from '@g360/shared';
import { ProcessGovernanceService } from './process-governance.service';
import { readBpmn } from './bpmn';

@Controller('processes')
export class ProcessGovernanceController {
  constructor(private readonly service: ProcessGovernanceService) {}

  @Get('governance/dashboard') @RequirePermissions('processes:view')
  dashboard(@CurrentUser() me: AuthPayload) { return this.service.dashboard(me); }

  @Post('governance/validate-bpmn') @RequirePermissions('processes:update')
  validateBpmn(@Body() body: { xml?: unknown }) {
    return readBpmn(typeof body?.xml === 'string' ? body.xml : '');
  }

  @Get('governance/targets') @RequirePermissions('processes:view')
  targets(@CurrentUser() me: AuthPayload, @Query('type') type: ProcessIntegrationType, @Query('search') search?: string, @Query('selected') selected?: string) { return this.service.targets(me, type, search, selected?.split(',').filter(Boolean)); }

  @Get('governance/subjects') @RequirePermissions('processes:view')
  subjects(@CurrentUser() me: AuthPayload, @Query('search') search?: string) { return this.service.subjects(me, search); }

  @Get('governance/related') @RequirePermissions('processes:view')
  related(@CurrentUser() me: AuthPayload, @Query('type') type: ProcessIntegrationType, @Query('targetId') targetId: string) { return this.service.related(me, type, targetId); }

  @Get(':id/context') @RequirePermissions('processes:view')
  overview(@CurrentUser() me: AuthPayload, @Param('id') id: string) { return this.service.overview(me, id); }

  @Post(':id/artifacts') @RequirePermissions('processes:update')
  create(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: unknown) { return this.service.createArtifact(me, id, body); }

  @Get('governance/artifacts/:id') @RequirePermissions('processes:view')
  get(@CurrentUser() me: AuthPayload, @Param('id') id: string) { return this.service.getArtifact(me, id); }

  @Patch('governance/artifacts/:id') @RequirePermissions('processes:update')
  save(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: unknown) { return this.service.saveArtifact(me, id, body); }

  @Post('governance/artifacts/:id/transition') @RequirePermissions('processes:update', 'processes:approve', 'processes:publish', 'processes:delete')
  transition(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: unknown) { return this.service.transition(me, id, body); }

  @Get('governance/artifacts/:id/versions/:versionId') @RequirePermissions('processes:view')
  version(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('versionId') versionId: string) { return this.service.version(me, id, versionId); }

  @Get('governance/artifacts/:id/versions') @RequirePermissions('processes:view')
  versions(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Query('before') before?: string) { return this.service.versions(me, id, before); }

  @Get('governance/artifacts/:id/compare/:otherId') @RequirePermissions('processes:view')
  compare(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('otherId') otherId: string) { return this.service.compare(me, id, otherId); }

  @Patch('governance/activities/:id') @RequirePermissions('processes:update')
  activity(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: unknown) { return this.service.saveActivity(me, id, body); }

  @Post(':id/integrations') @RequirePermissions('processes:update')
  link(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: unknown) { return this.service.addIntegration(me, id, body); }

  @Delete('governance/integrations/:id') @RequirePermissions('processes:update')
  unlink(@CurrentUser() me: AuthPayload, @Param('id') id: string) { return this.service.removeIntegration(me, id); }
}
