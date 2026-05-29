import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  @RequirePermissions('projects:view')
  list(@CurrentUser() me: AuthPayload) {
    return this.service.list(me.companyId);
  }

  @Get('indicators')
  @RequirePermissions('projects:view')
  listIndicators(@CurrentUser() me: AuthPayload) {
    return this.service.listIndicators(me.companyId);
  }

  @Get(':id')
  @RequirePermissions('projects:view')
  byId(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequirePermissions('projects:create')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.create(me.companyId, body);
  }

  @Patch(':id')
  @RequirePermissions('projects:update')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('projects:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/milestones')
  @RequirePermissions('projects:update')
  addMilestone(@Param('id') id: string, @Body() body: { name: string; dueDate: string }) {
    return this.service.addMilestone(id, body.name, body.dueDate);
  }

  @Patch('milestones/:id')
  @RequirePermissions('projects:update')
  toggleMilestone(@Param('id') id: string, @Body() body: { done: boolean }) {
    return this.service.toggleMilestone(id, body.done);
  }

  @Post(':id/tasks')
  @RequirePermissions('projects:update')
  addTask(@Param('id') id: string, @Body() body: any) {
    return this.service.addTask(id, body);
  }

  @Patch('tasks/:id')
  @RequirePermissions('projects:update')
  updateTask(@Param('id') id: string, @Body() body: any) {
    return this.service.updateTask(id, body);
  }

  @Delete('tasks/:id')
  @RequirePermissions('projects:update')
  removeTask(@Param('id') id: string) {
    return this.service.removeTask(id);
  }
}
