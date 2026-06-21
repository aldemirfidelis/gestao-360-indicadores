import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { CreateDirectDto, EditMessageDto, ReactionDto, SendMessageDto } from './conversation.dto';

@Controller('communication')
@RequirePermissions('communication:view')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationService,
    private readonly messages: MessageService,
  ) {}

  @Get('conversations')
  list(@CurrentUser() me: AuthPayload) {
    return this.conversations.listForUser(me.sub);
  }

  @Post('conversations/direct')
  @RequirePermissions('communication:create')
  createDirect(@CurrentUser() me: AuthPayload, @Body() dto: CreateDirectDto) {
    return this.conversations.getOrCreateDirect(me.sub, dto.userId, me.companyId);
  }

  @Get('conversations/:id')
  get(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.conversations.summaryById(id, me.sub);
  }

  @Get('conversations/:id/messages')
  messagesList(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messages.list(id, me.sub, cursor || undefined, limit ? Number(limit) : undefined);
  }

  @Post('conversations/:id/messages')
  @RequirePermissions('communication:create', 'communication:attachments')
  send(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.messages.send(id, me.sub, dto.body ?? '', dto.replyToId, dto.attachments ?? []);
  }

  @Get('message-attachments/:id')
  attachment(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.messages.getAttachment(id, me.sub);
  }

  @Post('conversations/:id/read')
  read(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.conversations.markRead(id, me.sub);
  }

  @Post('conversations/:id/mute')
  @RequirePermissions('communication:mute')
  mute(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { muted?: boolean }) {
    return this.conversations.setMuted(id, me.sub, !!body.muted);
  }

  @Post('conversations/:id/pin')
  @RequirePermissions('communication:pin')
  pin(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { pinned?: boolean }) {
    return this.conversations.setPinned(id, me.sub, !!body.pinned);
  }

  @Patch('messages/:id')
  @RequirePermissions('communication:update')
  edit(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: EditMessageDto) {
    return this.messages.edit(id, me.sub, dto.body);
  }

  @Delete('messages/:id')
  @RequirePermissions('communication:update')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.messages.remove(id, me.sub);
  }

  @Post('messages/:id/reactions')
  @RequirePermissions('communication:update')
  addReaction(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: ReactionDto) {
    return this.messages.react(id, me.sub, dto.emoji, true);
  }

  @Delete('messages/:id/reactions/:emoji')
  @RequirePermissions('communication:update')
  removeReaction(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('emoji') emoji: string) {
    return this.messages.react(id, me.sub, decodeURIComponent(emoji), false);
  }
}
