import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  @RequirePermissions('projects:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('indicatorId') indicatorId?: string,
    @Query('status') status?: any,
    @Query('search') search?: string,
    @Query('priority') priority?: string,
    @Query('managerId') managerId?: string,
    @Query('processId') processId?: string,
  ) {
    return this.service.list(me, { indicatorId, status, search, priority, managerId, processId });
  }

  @Get('indicators')
  @RequirePermissions('projects:view')
  listIndicators(@CurrentUser() me: AuthPayload) {
    return this.service.listIndicators(me);
  }

  @Get('options')
  @RequirePermissions('projects:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get('portfolio')
  @RequirePermissions('projects:view')
  portfolio(
    @CurrentUser() me: AuthPayload,
    @Query('indicatorId') indicatorId?: string,
    @Query('status') status?: any,
    @Query('search') search?: string,
    @Query('priority') priority?: string,
    @Query('managerId') managerId?: string,
    @Query('processId') processId?: string,
  ) {
    return this.service.portfolio(me, { indicatorId, status, search, priority, managerId, processId });
  }

  @Get('portfolio/execution')
  @RequirePermissions('projects:view')
  execution(
    @CurrentUser() me: AuthPayload,
    @Query('indicatorId') indicatorId?: string,
    @Query('status') status?: any,
    @Query('search') search?: string,
    @Query('priority') priority?: string,
    @Query('managerId') managerId?: string,
    @Query('processId') processId?: string,
  ) {
    return this.service.execution(me, { indicatorId, status, search, priority, managerId, processId });
  }

  @Get(':id')
  @RequirePermissions('projects:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me, id);
  }

  @Post()
  @RequirePermissions('projects:create')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.create(me, body);
  }

  @Patch(':id')
  @RequirePermissions('projects:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.update(me, id, body);
  }

  @Delete(':id')
  @RequirePermissions('projects:delete')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }

  @Post(':id/duplicate')
  @RequirePermissions('projects:create')
  duplicate(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.duplicate(me, id, body);
  }

  // Marcos

  @Post(':id/milestones')
  @RequirePermissions('projects:update')
  addMilestone(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { name: string; dueDate: string; description?: string }) {
    return this.service.addMilestone(me, id, body?.name, body?.dueDate, body?.description);
  }

  @Patch('milestones/:id')
  @RequirePermissions('projects:update')
  updateMilestone(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateMilestone(me, id, body);
  }

  @Delete('milestones/:id')
  @RequirePermissions('projects:update')
  removeMilestone(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeMilestone(me, id);
  }

  // Tarefas do cronograma

  @Post(':id/tasks')
  @RequirePermissions('projects:update')
  addTask(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addTask(me, id, body);
  }

  @Post(':id/tasks/reorder')
  @RequirePermissions('projects:update')
  reorderTasks(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { ids: string[] }) {
    return this.service.reorderTasks(me, id, body?.ids);
  }

  @Patch('tasks/:id')
  @RequirePermissions('projects:update')
  updateTask(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateTask(me, id, body);
  }

  @Delete('tasks/:id')
  @RequirePermissions('projects:update')
  removeTask(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeTask(me, id);
  }

  // Equipe

  @Post(':id/members')
  @RequirePermissions('projects:update')
  addMember(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addMember(me, id, body);
  }

  @Patch('members/:id')
  @RequirePermissions('projects:update')
  updateMember(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateMember(me, id, body);
  }

  @Delete('members/:id')
  @RequirePermissions('projects:update')
  removeMember(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeMember(me, id);
  }

  // Custos

  @Post(':id/costs')
  @RequirePermissions('projects:update')
  addCost(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addCost(me, id, body);
  }

  @Patch('costs/:id')
  @RequirePermissions('projects:update')
  updateCost(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateCost(me, id, body);
  }

  @Delete('costs/:id')
  @RequirePermissions('projects:update')
  removeCost(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeCost(me, id);
  }

  // Riscos e impedimentos

  @Post(':id/risks')
  @RequirePermissions('projects:update')
  addRisk(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addRisk(me, id, body);
  }

  @Patch('risks/:id')
  @RequirePermissions('projects:update')
  updateRisk(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateRisk(me, id, body);
  }

  @Delete('risks/:id')
  @RequirePermissions('projects:update')
  removeRisk(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeRisk(me, id);
  }

  // Status report

  @Post(':id/updates')
  @RequirePermissions('projects:update')
  addUpdate(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addUpdate(me, id, body);
  }

  @Delete('updates/:id')
  @RequirePermissions('projects:update')
  removeUpdate(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeUpdate(me, id);
  }
}
