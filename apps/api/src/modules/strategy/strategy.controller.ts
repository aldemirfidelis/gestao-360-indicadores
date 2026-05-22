import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { StrategyService } from './strategy.service';

@Controller('strategy')
@RequirePermissions('strategy:view')
export class StrategyController {
  constructor(private readonly service: StrategyService) {}

  @Get('maps')
  list(@CurrentUser() me: AuthPayload, @Query('includeInactive') includeInactive?: string) {
    return this.service.listMaps(me.companyId, includeInactive === 'true');
  }

  @Get('options')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me.companyId);
  }

  @Get('maps/:id')
  getMap(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getMap(me.companyId, id);
  }

  @Post('maps')
  @RequirePermissions('strategy:maps:create')
  createMap(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createMap(me, body);
  }

  @Patch('maps/:id')
  @RequirePermissions('strategy:maps:update')
  updateMap(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateMap(me, id, body);
  }

  @Delete('maps/:id')
  @RequirePermissions('strategy:maps:delete')
  removeMap(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeMap(me, id);
  }

  @Post('maps/:id/perspectives')
  @RequirePermissions('strategy:perspectives:create')
  addPerspective(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addPerspective(me, id, body);
  }

  @Patch('perspectives/:id')
  @RequirePermissions('strategy:perspectives:update')
  updatePerspective(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updatePerspective(me, id, body);
  }

  @Delete('perspectives/:id')
  @RequirePermissions('strategy:perspectives:delete')
  removePerspective(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removePerspective(me, id);
  }

  @Patch('maps/:id/perspectives/reorder')
  @RequirePermissions('strategy:perspectives:update')
  reorderPerspectives(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { ids: string[] }) {
    return this.service.reorderPerspectives(me, id, body.ids ?? []);
  }

  @Post('maps/:id/objectives')
  @RequirePermissions('strategy:objectives:create')
  addObjective(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addObjective(me, id, body);
  }

  @Patch('objectives/:objId')
  @RequirePermissions('strategy:objectives:update')
  updateObjective(@CurrentUser() me: AuthPayload, @Param('objId') objId: string, @Body() body: any) {
    return this.service.updateObjective(me, objId, body);
  }

  @Delete('objectives/:objId')
  @RequirePermissions('strategy:objectives:delete')
  removeObjective(@CurrentUser() me: AuthPayload, @Param('objId') objId: string) {
    return this.service.removeObjective(me, objId);
  }

  @Patch('maps/:id/layout')
  @RequirePermissions('strategy:objectives:update')
  saveLayout(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { nodes: any[] }) {
    return this.service.saveLayout(me, id, body.nodes ?? []);
  }

  @Post('relations')
  @RequirePermissions('strategy:links:manage')
  addRelation(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.addRelation(me, body);
  }

  @Patch('relations/:id')
  @RequirePermissions('strategy:links:manage')
  updateRelation(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateRelation(me, id, body);
  }

  @Delete('relations/:id')
  @RequirePermissions('strategy:links:manage')
  removeRelation(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeRelation(me, id);
  }

  @Post('objectives/:objId/indicators/:indicatorId')
  @RequirePermissions('strategy:indicators:link')
  attachIndicator(@CurrentUser() me: AuthPayload, @Param('objId') objId: string, @Param('indicatorId') indicatorId: string) {
    return this.service.attachIndicator(me, objId, indicatorId);
  }

  @Delete('objectives/:objId/indicators/:indicatorId')
  @RequirePermissions('strategy:indicators:link')
  detachObjectiveIndicator(@CurrentUser() me: AuthPayload, @Param('objId') objId: string, @Param('indicatorId') indicatorId: string) {
    return this.service.detachIndicator(me, objId, indicatorId);
  }

  @Delete('indicators/:indicatorId/objective')
  @RequirePermissions('strategy:indicators:link')
  detachIndicator(@CurrentUser() me: AuthPayload, @Param('indicatorId') indicatorId: string) {
    return this.service.detachIndicatorLegacy(me, indicatorId);
  }

  @Post('objectives/:objId/orgnodes/:orgNodeId')
  @RequirePermissions('strategy:objectives:update')
  attachOrgNode(@CurrentUser() me: AuthPayload, @Param('objId') objId: string, @Param('orgNodeId') orgNodeId: string, @Body() body: { kind?: string }) {
    return this.service.attachOrgNode(me, objId, orgNodeId, body.kind ?? 'responsavel');
  }

  @Delete('objectives/:objId/orgnodes/:orgNodeId')
  @RequirePermissions('strategy:objectives:update')
  detachOrgNode(@CurrentUser() me: AuthPayload, @Param('objId') objId: string, @Param('orgNodeId') orgNodeId: string, @Query('kind') kind?: string) {
    return this.service.detachOrgNode(me, objId, orgNodeId, kind ?? 'responsavel');
  }

  @Get('maps/:id/versions')
  @RequirePermissions('strategy:history:view')
  listVersions(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.listVersions(me, id);
  }

  @Post('maps/:id/versions')
  @RequirePermissions('strategy:publish')
  createVersion(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.createVersion(me, id, body);
  }
}
