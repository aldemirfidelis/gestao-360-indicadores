import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrgNodesService, type OrgTreeScope } from './orgnodes.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { orgNodeCreateSchema } from '@g360/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@prisma/client';

@Controller('orgnodes')
export class OrgNodesController {
  constructor(private readonly service: OrgNodesService) {}

  @Get()
  @RequirePermissions('org:view', 'org:view_all')
  list(@CurrentUser() me: AuthPayload, @Query('scope') scope?: OrgTreeScope) {
    return this.service.listFlatForUser(me, scope);
  }

  @Get('tree')
  @RequirePermissions('org:view', 'org:view_all')
  tree(@CurrentUser() me: AuthPayload, @Query('scope') scope?: OrgTreeScope) {
    return this.service.treeForUser(me, scope);
  }

  @Get(':id/removal-impact')
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  removalImpact(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removalImpact(id, me.companyId);
  }

  @Get(':id')
  @RequirePermissions('org:view', 'org:view_all')
  detail(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.detail(id, me);
  }

  @Post()
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  create(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(orgNodeCreateSchema)) input: any) {
    return this.service.create(input, me.companyId, me.sub);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() input: any) {
    return this.service.update(id, input, me.companyId, me.sub);
  }

  @Patch(':id/move')
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  move(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { parentId: string | null }) {
    return this.service.move(id, me.companyId, body.parentId, me.sub);
  }

  @Delete(':id')
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(id, me.companyId, me.sub);
  }

  @Post(':id/activities')
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  createActivity(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.createActivity(me, id, body);
  }

  @Patch(':id/activities/:activityId')
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  updateActivity(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('activityId') activityId: string, @Body() body: any) {
    return this.service.updateActivity(me, id, activityId, body);
  }

  @Delete(':id/activities/:activityId')
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  removeActivity(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('activityId') activityId: string) {
    return this.service.removeActivity(me, id, activityId);
  }

  @Post(':id/activities/:activityId/items')
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  createActivityItem(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('activityId') activityId: string, @Body() body: any) {
    return this.service.createActivityItem(me, id, activityId, body);
  }

  @Patch(':id/activities/:activityId/items/:itemId')
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  updateActivityItem(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Param('activityId') activityId: string,
    @Param('itemId') itemId: string,
    @Body() body: any,
  ) {
    return this.service.updateActivityItem(me, id, activityId, itemId, body);
  }

  @Delete(':id/activities/:activityId/items/:itemId')
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  removeActivityItem(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Param('activityId') activityId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeActivityItem(me, id, activityId, itemId);
  }
}
