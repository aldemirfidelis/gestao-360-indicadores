import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { TaskBoardQuery, TasksService } from './tasks.service';

@Controller('tasks')
@RequirePermissions('myday:view')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get('board')
  board(@CurrentUser() me: AuthPayload, @Query() query: TaskBoardQuery) {
    return this.service.getBoard(me, query);
  }

  @Get('context')
  context(@CurrentUser() me: AuthPayload) {
    return this.service.getContext(me);
  }

  @Patch('board/wiki')
  @RequirePermissions('myday:act')
  updateWiki(@CurrentUser() me: AuthPayload, @Body() body: { content?: string }) {
    return this.service.updateWiki(me, body.content);
  }

  @Post()
  @RequirePermissions('myday:act')
  create(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createTask(me, body);
  }

  @Get(':id')
  detail(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getTask(me, id);
  }

  @Patch(':id')
  @RequirePermissions('myday:act')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateTask(me, id, body);
  }

  @Delete(':id')
  @RequirePermissions('myday:act')
  archive(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.archiveTask(me, id);
  }

  @Post(':id/move')
  @RequirePermissions('myday:act')
  move(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { columnId?: string; position?: number }) {
    return this.service.moveTask(me, id, body);
  }

  @Post(':id/comments')
  @RequirePermissions('myday:act')
  comment(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { content?: string; mentions?: string[] }) {
    return this.service.addComment(me, id, body);
  }

  @Post(':id/checklist')
  @RequirePermissions('myday:act')
  addChecklist(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { title?: string; assigneeId?: string | null }) {
    return this.service.addChecklistItem(me, id, body);
  }

  @Patch(':id/checklist/:itemId')
  @RequirePermissions('myday:act')
  updateChecklist(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { title?: string; isDone?: boolean; assigneeId?: string | null },
  ) {
    return this.service.updateChecklistItem(me, id, itemId, body);
  }

  @Delete(':id/checklist/:itemId')
  @RequirePermissions('myday:act')
  removeChecklist(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.removeChecklistItem(me, id, itemId);
  }

  @Post(':id/attachments')
  @RequirePermissions('myday:act')
  attachment(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.addAttachment(me, id, body);
  }

  @Post(':id/links')
  @RequirePermissions('myday:act')
  link(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.addLink(me, id, body);
  }

  @Delete(':id/links/:linkId')
  @RequirePermissions('myday:act')
  unlink(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('linkId') linkId: string) {
    return this.service.removeLink(me, id, linkId);
  }
}
