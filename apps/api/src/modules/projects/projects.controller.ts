import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  list(@CurrentUser() me: AuthPayload) {
    return this.service.list(me.companyId);
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.create(me.companyId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/milestones')
  addMilestone(@Param('id') id: string, @Body() body: { name: string; dueDate: string }) {
    return this.service.addMilestone(id, body.name, body.dueDate);
  }

  @Patch('milestones/:id')
  toggleMilestone(@Param('id') id: string, @Body() body: { done: boolean }) {
    return this.service.toggleMilestone(id, body.done);
  }

  @Post(':id/tasks')
  addTask(@Param('id') id: string, @Body() body: any) {
    return this.service.addTask(id, body);
  }

  @Patch('tasks/:id')
  updateTask(@Param('id') id: string, @Body() body: any) {
    return this.service.updateTask(id, body);
  }

  @Delete('tasks/:id')
  removeTask(@Param('id') id: string) {
    return this.service.removeTask(id);
  }
}
