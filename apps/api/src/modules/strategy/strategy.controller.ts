import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ObjectiveStatus, PerspectiveKind } from '@prisma/client';

@Controller('strategy')
export class StrategyController {
  constructor(private readonly service: StrategyService) {}

  @Get('maps')
  list(@CurrentUser() me: AuthPayload) {
    return this.service.listMaps(me.companyId);
  }

  @Get('maps/:id')
  getMap(@Param('id') id: string) {
    return this.service.getMap(id);
  }

  @Post('maps')
  createMap(
    @CurrentUser() me: AuthPayload,
    @Body() body: { name: string; startsAt: string; endsAt: string },
  ) {
    return this.service.createMap(me.companyId, body.name, new Date(body.startsAt), new Date(body.endsAt));
  }

  @Post('maps/:id/perspectives')
  addPerspective(
    @Param('id') id: string,
    @Body() body: { kind: PerspectiveKind; name: string; color?: string },
  ) {
    return this.service.addPerspective(id, body.kind, body.name, body.color);
  }

  @Post('maps/:id/objectives')
  addObjective(
    @Param('id') id: string,
    @Body() body: { perspectiveId: string; name: string; description?: string; weight?: number },
  ) {
    return this.service.addObjective(id, body.perspectiveId, body.name, body.description, body.weight ?? 1);
  }

  @Patch('objectives/:objId')
  updateObjective(
    @Param('objId') objId: string,
    @Body() body: { name?: string; description?: string; status?: ObjectiveStatus; weight?: number; priority?: number },
  ) {
    return this.service.updateObjective(objId, body);
  }

  @Delete('objectives/:objId')
  removeObjective(@Param('objId') objId: string) {
    return this.service.removeObjective(objId);
  }

  @Post('relations')
  addRelation(@Body() body: { fromId: string; toId: string; weight?: number }) {
    return this.service.addRelation(body.fromId, body.toId, body.weight ?? 1);
  }

  @Delete('relations/:id')
  removeRelation(@Param('id') id: string) {
    return this.service.removeRelation(id);
  }

  @Post('objectives/:objId/indicators/:indicatorId')
  attachIndicator(@Param('objId') objId: string, @Param('indicatorId') indicatorId: string) {
    return this.service.attachIndicator(objId, indicatorId);
  }

  @Delete('indicators/:indicatorId/objective')
  detachIndicator(@Param('indicatorId') indicatorId: string) {
    return this.service.detachIndicator(indicatorId);
  }
}
