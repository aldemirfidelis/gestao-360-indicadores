import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrgNodesService } from './orgnodes.service';
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
  list(@CurrentUser() me: AuthPayload) {
    return this.service.listFlat(me.companyId);
  }

  @Get('tree')
  tree(@CurrentUser() me: AuthPayload) {
    return this.service.tree(me.companyId);
  }

  @Post()
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  create(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(orgNodeCreateSchema)) input: any) {
    return this.service.create(input, me.companyId);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() input: any) {
    return this.service.update(id, input, me.companyId);
  }

  @Patch(':id/move')
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  move(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { parentId: string | null }) {
    return this.service.move(id, me.companyId, body.parentId);
  }

  @Delete(':id')
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
  @RequirePermissions('org:manage')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(id, me.companyId);
  }
}
