import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { AccessAdminService } from './access-admin.service';
import { AddAssignmentDto, CreateExceptionDto, SetPrimaryAreaDto, UpsertMatrixRuleDto } from './access-admin.dto';

/**
 * Administração de acesso por área (Admin da Empresa / Super Admin).
 * Tudo escopado à empresa do usuário autenticado (companyId vem da sessão).
 */
@Controller('access')
@Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
@RequirePermissions('users:manage')
export class AccessAdminController {
  constructor(private readonly service: AccessAdminService) {}

  @Get('modules')
  modules() {
    return this.service.modules();
  }

  @Get('areas')
  areas(@CurrentUser() me: AuthPayload) {
    return this.service.areas(me.companyId);
  }

  @Get('users/:userId/areas')
  userAreas(@CurrentUser() me: AuthPayload, @Param('userId') userId: string) {
    return this.service.userAreas(me.companyId, userId);
  }

  @Post('users/:userId/areas')
  addAssignment(@CurrentUser() me: AuthPayload, @Param('userId') userId: string, @Body() dto: AddAssignmentDto) {
    return this.service.addAssignment(me, me.companyId, userId, dto);
  }

  @Delete('users/:userId/areas/:orgNodeId')
  removeAssignment(@CurrentUser() me: AuthPayload, @Param('userId') userId: string, @Param('orgNodeId') orgNodeId: string) {
    return this.service.removeAssignment(me, me.companyId, userId, orgNodeId);
  }

  @Patch('users/:userId/primary-area')
  setPrimaryArea(@CurrentUser() me: AuthPayload, @Param('userId') userId: string, @Body() dto: SetPrimaryAreaDto) {
    return this.service.setPrimaryArea(me, me.companyId, userId, dto.orgNodeId);
  }

  @Get('matrix')
  matrix(@CurrentUser() me: AuthPayload) {
    return this.service.matrix(me.companyId);
  }

  @Post('matrix')
  upsertRule(@CurrentUser() me: AuthPayload, @Body() dto: UpsertMatrixRuleDto) {
    return this.service.upsertRule(me, me.companyId, dto);
  }

  @Delete('matrix/:id')
  removeRule(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeRule(me, me.companyId, id);
  }

  @Get('exceptions')
  exceptions(@CurrentUser() me: AuthPayload, @Query('userId') userId?: string) {
    return this.service.exceptions(me.companyId, userId || undefined);
  }

  @Post('exceptions')
  createException(@CurrentUser() me: AuthPayload, @Body() dto: CreateExceptionDto) {
    return this.service.createException(me, me.companyId, dto);
  }

  @Delete('exceptions/:id')
  removeException(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeException(me, me.companyId, id);
  }

  @Get('simulate/:userId')
  simulate(@Param('userId') userId: string) {
    return this.service.simulate(userId);
  }
}
