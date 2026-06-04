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
    return this.service.list(me);
  }

  @Get('indicators')
  @RequirePermissions('projects:view')
  listIndicators(@CurrentUser() me: AuthPayload) {
    return this.service.listIndicators(me.companyId);
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

  @Post(':id/milestones')
  @RequirePermissions('projects:update')
  addMilestone(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { name: string; dueDate: string }) {
    return this.service.addMilestone(me, id, body.name, body.dueDate);
  }

  @Patch('milestones/:id')
  @RequirePermissions('projects:update')
  toggleMilestone(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { done: boolean }) {
    return this.service.toggleMilestone(me, id, body.done);
  }

  @Post(':id/tasks')
  @RequirePermissions('projects:update')
  addTask(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addTask(me, id, body);
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
}
