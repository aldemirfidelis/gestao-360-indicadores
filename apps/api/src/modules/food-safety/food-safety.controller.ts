import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { FoodSafetyService } from './food-safety.service';

@Controller('food-safety')
export class FoodSafetyController {
  constructor(private readonly service: FoodSafetyService) {}

  // ----- overview / opcoes -----
  @Get('summary')
  @RequirePermissions('fsms:view')
  summary(@CurrentUser() me: AuthPayload, @Query('programId') programId?: string) {
    return this.service.summary(me, programId);
  }

  @Get('options')
  @RequirePermissions('fsms:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  // ----- programas -----
  @Get('programs')
  @RequirePermissions('fsms:view')
  listPrograms(@CurrentUser() me: AuthPayload, @Query('status') status?: string, @Query('search') search?: string) {
    return this.service.listPrograms(me, { status, search });
  }

  @Get('programs/:id')
  @RequirePermissions('fsms:view')
  getProgram(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getProgram(me, id);
  }

  @Post('programs')
  @RequirePermissions('fsms:create')
  createProgram(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createProgram(me, body);
  }

  @Patch('programs/:id')
  @RequirePermissions('fsms:update')
  updateProgram(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateProgram(me, id, body);
  }

  @Delete('programs/:id')
  @RequirePermissions('fsms:delete')
  removeProgram(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeProgram(me, id);
  }

  // ----- processos -----
  @Get('processes')
  @RequirePermissions('fsms:view')
  listProcesses(
    @CurrentUser() me: AuthPayload,
    @Query('programId') programId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listProcesses(me, { programId, status, search });
  }

  @Get('processes/:id')
  @RequirePermissions('fsms:view')
  getProcess(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getProcess(me, id);
  }

  @Post('processes')
  @RequirePermissions('fsms:create')
  createProcess(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createProcess(me, body);
  }

  @Patch('processes/:id')
  @RequirePermissions('fsms:update')
  updateProcess(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateProcess(me, id, body);
  }

  @Delete('processes/:id')
  @RequirePermissions('fsms:delete')
  removeProcess(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeProcess(me, id);
  }

  // ----- etapas -----
  @Post('processes/:id/steps')
  @RequirePermissions('fsms:update')
  addStep(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addStep(me, id, body);
  }

  @Patch('steps/:stepId')
  @RequirePermissions('fsms:update')
  updateStep(@CurrentUser() me: AuthPayload, @Param('stepId') stepId: string, @Body() body: any) {
    return this.service.updateStep(me, stepId, body);
  }

  @Delete('steps/:stepId')
  @RequirePermissions('fsms:delete')
  removeStep(@CurrentUser() me: AuthPayload, @Param('stepId') stepId: string) {
    return this.service.removeStep(me, stepId);
  }

  // ----- matriz de risco -----
  @Get('risk-matrix')
  @RequirePermissions('fsms:view')
  getRiskMatrix(@CurrentUser() me: AuthPayload) {
    return this.service.getRiskMatrix(me);
  }

  @Patch('risk-matrix')
  @RequirePermissions('fsms:update')
  updateRiskMatrix(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.updateRiskMatrix(me, body);
  }

  // ----- perigos / APPCC -----
  @Get('hazards')
  @RequirePermissions('fsms:view')
  listHazards(
    @CurrentUser() me: AuthPayload,
    @Query('processId') processId?: string,
    @Query('stepId') stepId?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listHazards(me, { processId, stepId, category, status, search });
  }

  @Get('hazards/:id')
  @RequirePermissions('fsms:view')
  getHazard(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getHazard(me, id);
  }

  @Post('hazards')
  @RequirePermissions('fsms:create')
  createHazard(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createHazard(me, body);
  }

  @Patch('hazards/:id')
  @RequirePermissions('fsms:update')
  updateHazard(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateHazard(me, id, body);
  }

  @Delete('hazards/:id')
  @RequirePermissions('fsms:delete')
  removeHazard(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeHazard(me, id);
  }
}
