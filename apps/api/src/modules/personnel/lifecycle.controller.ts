import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { LifecycleService } from './lifecycle.service';

@Controller('personnel')
export class LifecycleController {
  constructor(private readonly service: LifecycleService) {}

  // ---------------- Admissão / Desligamento ----------------

  @Get('processes')
  @RequirePermissions('pessoal:view')
  listProcesses(@CurrentUser() me: AuthPayload, @Query('kind') kind?: string, @Query('status') status?: string) {
    return this.service.listProcesses(me, { kind, status });
  }

  @Post('processes')
  @RequirePermissions('pessoal:update')
  startProcess(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.startProcess(me, body);
  }

  @Get('processes/:id')
  @RequirePermissions('pessoal:view')
  getProcess(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getProcess(me, id);
  }

  @Post('processes/:id/items/:itemId/toggle')
  @RequirePermissions('pessoal:update')
  toggleItem(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('itemId') itemId: string, @Body() body: any) {
    return this.service.toggleItem(me, id, itemId, body);
  }

  @Post('processes/:id/complete')
  @RequirePermissions('pessoal:update')
  completeProcess(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.completeProcess(me, id, body);
  }

  @Post('processes/:id/cancel')
  @RequirePermissions('pessoal:update')
  cancelProcess(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.cancelProcess(me, id, body);
  }

  // ---------------- Saúde ocupacional (ASO) ----------------

  @Get('medical-exams')
  @RequirePermissions('pessoal:view')
  listExams(@CurrentUser() me: AuthPayload, @Query('employeeId') employeeId?: string, @Query('expiring') expiring?: string) {
    return this.service.listExams(me, { employeeId, expiring });
  }

  @Post('medical-exams')
  @RequirePermissions('pessoal:update')
  createExam(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createExam(me, body);
  }

  @Delete('medical-exams/:id')
  @RequirePermissions('pessoal:update')
  removeExam(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeExam(me, id);
  }
}
