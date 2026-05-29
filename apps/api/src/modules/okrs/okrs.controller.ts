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

  @Get('cycles/:cycleId/objectives')
  @RequirePermissions('okrs:view')
  list(@Param('cycleId') cycleId: string) {
    return this.service.listObjectives(cycleId);
  }

  @Get('objectives/:id')
  @RequirePermissions('okrs:view')
  objective(@Param('id') id: string) {
    return this.service.getObjective(id);
  }

  @Post('cycles/:cycleId/objectives')
  @RequirePermissions('okrs:create')
  create(@Param('cycleId') cycleId: string, @Body() body: any) {
    return this.service.createObjective(cycleId, body);
  }

  @Patch('objectives/:id')
  @RequirePermissions('okrs:update')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.updateObjective(id, body);
  }

  @Delete('objectives/:id')
  @RequirePermissions('okrs:delete')
  remove(@Param('id') id: string) {
    return this.service.removeObjective(id);
  }

  @Post('objectives/:id/krs')
  @RequirePermissions('okrs:update')
  addKR(@Param('id') id: string, @Body() body: any) {
    return this.service.addKeyResult(id, body);
  }

  @Patch('krs/:krId')
  @RequirePermissions('okrs:update')
  updateKR(@Param('krId') krId: string, @Body() body: any) {
    return this.service.updateKeyResult(krId, body);
  }

  @Delete('krs/:krId')
  @RequirePermissions('okrs:delete')
  removeKR(@Param('krId') krId: string) {
    return this.service.removeKeyResult(krId);
  }

  @Post('objectives/:id/checkin')
  @RequirePermissions('okrs:checkin')
  checkin(
    @Param('id') id: string,
    @Body() body: { weekRef: string; confidence: number; progress: number; note?: string },
  ) {
    return this.service.checkin(id, body);
  }
}
