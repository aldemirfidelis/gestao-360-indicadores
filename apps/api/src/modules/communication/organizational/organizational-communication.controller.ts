import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { OrganizationalCommunicationService } from './organizational-communication.service';

@Controller('communication/organizational')
export class OrganizationalCommunicationController {
  constructor(private readonly service: OrganizationalCommunicationService) {}

  @Get()
  @RequirePermissions('communication:view')
  overview(@CurrentUser() me: AuthPayload) {
    return this.service.overview(me);
  }

  @Get('posts/:id')
  @RequirePermissions('communication:view')
  post(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getPost(me, id);
  }

  @Post('posts')
  @RequirePermissions('communication:create', 'communication:manage', 'communication:attachments')
  createPost(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createPost(me, body);
  }

  @Patch('posts/:id')
  @RequirePermissions('communication:update', 'communication:manage', 'communication:attachments')
  updatePost(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updatePost(me, id, body);
  }

  @Post('posts/:id/status')
  @RequirePermissions('communication:approve', 'communication:publish', 'communication:manage', 'communication:attachments')
  changeStatus(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.changeStatus(me, id, body);
  }

  @Post('posts/:id/read')
  @RequirePermissions('communication:view')
  markRead(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.markRead(me, id, body ?? {});
  }

  @Post('posts/:id/reactions')
  @RequirePermissions('communication:view')
  react(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.react(me, id, body ?? {});
  }

  @Post('posts/:id/comments')
  @RequirePermissions('communication:view')
  comment(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.comment(me, id, body ?? {});
  }

  @Post('posts/:id/poll-responses')
  @RequirePermissions('communication:view')
  pollResponse(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.respondPoll(me, id, body ?? {});
  }

  @Post('campaigns')
  @RequirePermissions('communication:create', 'communication:manage', 'communication:attachments')
  createCampaign(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createCampaign(me, body);
  }

  @Post('media')
  @RequirePermissions('communication:media', 'communication:manage', 'communication:attachments')
  createMedia(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createMedia(me, body);
  }

  @Post('media/upload')
  @RequirePermissions('communication:media', 'communication:manage', 'communication:attachments')
  uploadMedia(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.uploadMedia(me, body);
  }

  @Post('ai/draft')
  @RequirePermissions('communication:create', 'communication:manage', 'communication:attachments', 'ai:use')
  aiDraft(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.aiDraft(me, body ?? {});
  }
}
