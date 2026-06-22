import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OkrsService } from './okrs.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('okrs')
export class OkrsController {
  constructor(private readonly service: OkrsService) {}

  @Get('cycles')
  @RequirePermissions('okrs:view')
  cycles(@CurrentUser() me: AuthPayload) {
    return this.service.listCycles(me.companyId);
  }

  @Post('cycles')
  @RequirePermissions('okrs:create')
  createCycle(
    @CurrentUser() me: AuthPayload,
    @Body() body: { name: string; startsAt: string; endsAt: string },
  ) {
    return this.service.createCycle(me.companyId, body.name, new Date(body.startsAt), new Date(body.endsAt));
  }

  @Patch('cycles/:cycleId')
  @RequirePermissions('okrs:update')
  updateCycle(
    @CurrentUser() me: AuthPayload,
    @Param('cycleId') cycleId: string,
    @Body() body: { name?: string; startsAt?: string; endsAt?: string; active?: boolean },
  ) {
    return this.service.updateCycle(me.companyId, cycleId, body);
  }

  @Delete('cycles/:cycleId')
  @RequirePermissions('okrs:delete')
  removeCycle(@CurrentUser() me: AuthPayload, @Param('cycleId') cycleId: string) {
    return this.service.removeCycle(me.companyId, cycleId);
  }

  @Get('options')
  @RequirePermissions('okrs:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me.companyId);
  }

  @Get('cycles/:cycleId/objectives')
  @RequirePermissions('okrs:view')
  list(@CurrentUser() me: AuthPayload, @Param('cycleId') cycleId: string) {
    return this.service.listObjectives(me, cycleId);
  }

  @Get('objectives/:id')
  @RequirePermissions('okrs:view')
  objective(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getObjective(me, id);
  }

  @Post('cycles/:cycleId/objectives')
  @RequirePermissions('okrs:create')
  create(@CurrentUser() me: AuthPayload, @Param('cycleId') cycleId: string, @Body() body: any) {
    return this.service.createObjective(me, cycleId, body);
  }

  @Patch('objectives/:id')
  @RequirePermissions('okrs:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateObjective(me, id, body);
  }

  @Delete('objectives/:id')
  @RequirePermissions('okrs:delete')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeObjective(me, id);
  }

  @Post('objectives/:id/krs')
  @RequirePermissions('okrs:update')
  addKR(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addKeyResult(me, id, body);
  }

  @Patch('krs/:krId')
  @RequirePermissions('okrs:update')
  updateKR(@CurrentUser() me: AuthPayload, @Param('krId') krId: string, @Body() body: any) {
    return this.service.updateKeyResult(me, krId, body);
  }

  @Delete('krs/:krId')
  @RequirePermissions('okrs:delete')
  removeKR(@CurrentUser() me: AuthPayload, @Param('krId') krId: string) {
    return this.service.removeKeyResult(me, krId);
  }

  @Post('objectives/:id/checkin')
  @RequirePermissions('okrs:checkin')
  checkin(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { weekRef: string; confidence: number; progress: number; note?: string },
  ) {
    return this.service.checkin(me, id, body);
  }
}
