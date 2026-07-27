import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { CreateDirectDto, EditMessageDto, ReactionDto, SendMessageDto } from './conversation.dto';

@Controller('communication')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationService,
    private readonly messages: MessageService,
  ) {}

  @Get('conversations')
  list(@CurrentUser() me: AuthPayload) {
    return this.conversations.listForUser(me.sub, me.companyId);
  }

  @Post('conversations/direct')
  createDirect(@CurrentUser() me: AuthPayload, @Body() dto: CreateDirectDto) {
    return this.conversations.getOrCreateDirect(me.sub, dto.userId, me.companyId);
  }

  @Get('conversations/:id')
  get(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.conversations.summaryById(id, me.sub, me.companyId);
  }

  @Get('conversations/:id/messages')
  messagesList(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messages.list(id, me.sub, me.companyId, cursor || undefined, limit ? Number(limit) : undefined);
  }

  @Post('conversations/:id/messages')
  send(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.messages.send(id, me.sub, me.companyId, dto.body ?? '', dto.replyToId, dto.attachments ?? []);
  }

  @Get('message-attachments/:id')
  attachment(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.messages.getAttachment(id, me.sub, me.companyId);
  }

  @Post('conversations/:id/read')
  read(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.conversations.markRead(id, me.sub, me.companyId);
  }

  @Post('conversations/:id/mute')
  mute(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { muted?: boolean }) {
    return this.conversations.setMuted(id, me.sub, me.companyId, !!body.muted);
  }

  @Post('conversations/:id/pin')
  pin(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { pinned?: boolean }) {
    return this.conversations.setPinned(id, me.sub, me.companyId, !!body.pinned);
  }

  @Patch('messages/:id')
  edit(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: EditMessageDto) {
    return this.messages.edit(id, me.sub, me.companyId, dto.body);
  }

  @Delete('messages/:id')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.messages.remove(id, me.sub, me.companyId);
  }

  @Post('messages/:id/reactions')
  addReaction(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: ReactionDto) {
    return this.messages.react(id, me.sub, me.companyId, dto.emoji, true);
  }

  @Delete('messages/:id/reactions/:emoji')
  removeReaction(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('emoji') emoji: string) {
    return this.messages.react(id, me.sub, me.companyId, decodeURIComponent(emoji), false);
  }
}
