import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PortalTabTag } from '../portal-admin/decorators/portal-tab.decorator';
import { SuperAdminPortalGuard } from '../portal-admin/guards/super-admin-portal.guard';
import { HelpService } from './help.service';

@Controller('admin/help')
@Roles(UserRoleEnum.SUPER_ADMIN)
@UseGuards(SuperAdminPortalGuard)
export class AdminHelpController {
  constructor(private readonly service: HelpService) {}

  @Get()
  @PortalTabTag('help')
  content() {
    return this.service.adminContent();
  }

  @Post('categories')
  @PortalTabTag('help')
  upsertCategory(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.upsertCategory(body, me);
  }

  @Put('categories/:id')
  @PortalTabTag('help')
  updateCategory(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.upsertCategory({ ...body, id }, me);
  }

  @Post('articles')
  @PortalTabTag('help')
  upsertArticle(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.upsertArticle(body, me);
  }

  @Put('articles/:id')
  @PortalTabTag('help')
  updateArticle(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.upsertArticle({ ...body, id }, me);
  }

  @Post('articles/:id/status')
  @PortalTabTag('help')
  setStatus(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { status?: string }) {
    return this.service.setArticleStatus(id, body?.status ?? 'PUBLISHED', me);
  }
}
