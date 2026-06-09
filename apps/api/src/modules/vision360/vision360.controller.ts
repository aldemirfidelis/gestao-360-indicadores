import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Vision360Service } from './vision360.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('vision360')
export class Vision360Controller {
  constructor(private readonly service: Vision360Service) {}

  @Get('links')
  @RequirePermissions('vision360:view')
  async getLinks(
    @CurrentUser() me: AuthPayload,
    @Query('type') type: string,
    @Query('id') id: string,
  ) {
    const summary = await this.service.getEntitySummary(me.companyId, type, id);
    const breadcrumbs = await this.service.getBreadcrumbs(me.companyId, type, id);
    const userPermissions = me.role === 'SUPER_ADMIN' ? [] : await this.service.getUserPermissionKeys(me.sub);
    const relationships = await this.service.getRelationships(
      me.companyId,
      type,
      id,
      userPermissions,
      me.role,
    );

    return {
      summary,
      breadcrumbs,
      relationships,
    };
  }

  @Post('links')
  @RequirePermissions('vision360:manage')
  async addLink(
    @CurrentUser() me: AuthPayload,
    @Body() body: {
      sourceEntityType: string;
      sourceEntityId: string;
      targetEntityType: string;
      targetEntityId: string;
      relationshipType: string;
      criticality: string;
      isMandatory: boolean;
      notes?: string;
    },
  ) {
    return this.service.addLink(me.companyId, me.sub, body);
  }

  @Delete('links/:id')
  @RequirePermissions('vision360:manage')
  async removeLink(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
  ) {
    return this.service.removeLink(me.companyId, me.sub, id);
  }

  @Get('impact-simulation')
  @RequirePermissions('vision360:impact')
  async simulateImpact(
    @CurrentUser() me: AuthPayload,
    @Query('type') type: string,
    @Query('id') id: string,
    @Query('depth') depth?: string,
  ) {
    const maxDepth = depth ? parseInt(depth, 10) : 3;
    return this.service.simulateImpact(me.companyId, type, id, maxDepth);
  }

  @Post('impact-analysis')
  @RequirePermissions('vision360:impact')
  async saveImpactAnalysis(
    @CurrentUser() me: AuthPayload,
    @Body() body: any,
  ) {
    return this.service.saveImpactAnalysis(me.companyId, me.sub, body);
  }

  @Get('pending-impacts')
  @RequirePermissions('vision360:impact')
  async getPendingImpacts(@CurrentUser() me: AuthPayload) {
    return this.service.getPendingImpacts(me.companyId);
  }

  @Get('export-xlsx')
  @RequirePermissions('vision360:view')
  async exportXlsx(
    @CurrentUser() me: AuthPayload,
    @Query('type') type: string,
    @Query('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportXlsx(me.companyId, type, id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-impacto-${type.toLowerCase()}-${id.slice(0, 8)}.xlsx`);
    res.send(buffer);
  }

  @Get('search')
  @RequirePermissions('vision360:view')
  async searchEntities(
    @CurrentUser() me: AuthPayload,
    @Query('type') type: string,
    @Query('q') q: string,
  ) {
    return this.service.searchEntities(me.companyId, type ?? '', q ?? '');
  }

  @Patch('impact-items/:id/resolve')
  @RequirePermissions('vision360:impact')
  async resolvePendingImpact(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
  ) {
    return this.service.resolvePendingImpact(me.companyId, id, me.sub);
  }
}
