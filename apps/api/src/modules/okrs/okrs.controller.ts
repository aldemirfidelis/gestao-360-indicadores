import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OkrsService } from './okrs.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';

@Controller('okrs')
export class OkrsController {
  constructor(private readonly service: OkrsService) {}

  @Get('cycles')
  cycles(@CurrentUser() me: AuthPayload) {
    return this.service.listCycles(me.companyId);
  }

  @Post('cycles')
  createCycle(
    @CurrentUser() me: AuthPayload,
    @Body() body: { name: string; startsAt: string; endsAt: string },
  ) {
    return this.service.createCycle(me.companyId, body.name, new Date(body.startsAt), new Date(body.endsAt));
  }

  @Get('cycles/:cycleId/objectives')
  list(@Param('cycleId') cycleId: string) {
    return this.service.listObjectives(cycleId);
  }

  @Get('objectives/:id')
  objective(@Param('id') id: string) {
    return this.service.getObjective(id);
  }

  @Post('cycles/:cycleId/objectives')
  create(@Param('cycleId') cycleId: string, @Body() body: any) {
    return this.service.createObjective(cycleId, body);
  }

  @Patch('objectives/:id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.updateObjective(id, body);
  }

  @Delete('objectives/:id')
  remove(@Param('id') id: string) {
    return this.service.removeObjective(id);
  }

  @Post('objectives/:id/krs')
  addKR(@Param('id') id: string, @Body() body: any) {
    return this.service.addKeyResult(id, body);
  }

  @Patch('krs/:krId')
  updateKR(@Param('krId') krId: string, @Body() body: any) {
    return this.service.updateKeyResult(krId, body);
  }

  @Delete('krs/:krId')
  removeKR(@Param('krId') krId: string) {
    return this.service.removeKeyResult(krId);
  }

  @Post('objectives/:id/checkin')
  checkin(
    @Param('id') id: string,
    @Body() body: { weekRef: string; confidence: number; progress: number; note?: string },
  ) {
    return this.service.checkin(id, body);
  }
}
