import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { actionCreateSchema } from '@g360/shared';
import { ActionStatus } from '@prisma/client';

@Controller('actions')
export class ActionsController {
  constructor(private readonly service: ActionsService) {}

  @Get()
  list(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: ActionStatus,
    @Query('responsibleUserId') responsibleUserId?: string,
    @Query('ownerNodeId') ownerNodeId?: string,
    @Query('overdue') overdue?: string,
    @Query('origin') origin?: string,
  ) {
    return this.service.list({
      companyId: me.companyId,
      status,
      responsibleUserId,
      ownerNodeId,
      overdue: overdue === 'true',
      origin,
    });
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  create(
    @CurrentUser() me: AuthPayload,
    @Body(new ZodValidationPipe(actionCreateSchema)) input: any,
  ) {
    return this.service.create(input, me.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() patch: any) {
    return this.service.update(id, patch);
  }

  @Patch(':id/status')
  changeStatus(@Param('id') id: string, @Body() body: { status: ActionStatus }) {
    return this.service.changeStatus(id, body.status);
  }

  @Post(':id/tasks')
  addTask(
    @Param('id') id: string,
    @Body() body: { title: string; dueDate?: string },
  ) {
    return this.service.addTask(id, body.title, body.dueDate ? new Date(body.dueDate) : undefined);
  }

  @Patch('tasks/:taskId')
  toggleTask(@Param('taskId') taskId: string, @Body() body: { done: boolean }) {
    return this.service.toggleTask(taskId, body.done);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
