import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { MapMode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { RelationshipMapService } from './relationship-map.service';

@Controller('relationship-map')
export class RelationshipMapController {
  constructor(private readonly service: RelationshipMapService) {}

  @Get()
  list(@CurrentUser() me: AuthPayload) {
    return this.service.list(me.companyId);
  }

  @Get('default')
  defaultMap(@CurrentUser() me: AuthPayload) {
    return this.service.defaultMap(me.companyId);
  }

  @Get(':id')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me.companyId, id);
  }

  @Post()
  createMap(
    @CurrentUser() me: AuthPayload,
    @Body() body: { name: string; description?: string; mode?: MapMode },
  ) {
    return this.service.createMap(me.companyId, body);
  }

  @Post('nodes')
  createNode(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createNode(me.companyId, body);
  }

  @Patch('nodes/:id')
  updateNode(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateNode(me.companyId, id, body);
  }

  @Delete('nodes/:id')
  removeNode(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeNode(me.companyId, id);
  }

  @Post('edges')
  createEdge(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createEdge(me.companyId, body);
  }

  @Delete('edges/:id')
  removeEdge(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeEdge(me.companyId, id);
  }

  @Post(':id/layout')
  saveLayout(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.saveLayout(me.companyId, me.sub, id, body);
  }
}
