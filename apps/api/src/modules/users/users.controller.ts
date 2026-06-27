import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@prisma/client';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { userCreateSchema } from '@g360/shared';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
  @RequirePermissions('users:view', 'users:profiles', 'users:manage')
  list(@CurrentUser() me: AuthPayload) {
    return this.service.list(me.companyId);
  }

  @Get('permissions')
  @Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
  @RequirePermissions('users:permissions', 'users:profiles', 'users:manage')
  permissions() {
    return this.service.listPermissions();
  }

  @Get('access-context')
  @Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
  @RequirePermissions('users:view', 'users:create', 'users:update', 'users:permissions', 'users:profiles', 'users:manage')
  accessContext(@CurrentUser() me: AuthPayload) {
    return this.service.accessContext(me.companyId);
  }

  @Get(':id')
  @Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
  @RequirePermissions('users:view', 'users:update', 'users:profiles', 'users:manage')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(id, me.companyId, me.role === UserRoleEnum.SUPER_ADMIN);
  }

  @Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
  @RequirePermissions('users:create', 'users:manage')
  @Post()
  create(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(userCreateSchema)) input: any) {
    const isSuperAdmin = me.role === UserRoleEnum.SUPER_ADMIN;
    // Empresa SEMPRE da sessão (companyId efetivo). Super Admin cria na empresa em que
    // está "dentro" (troca pelo seletor) — nunca em outra via payload.
    return this.service.create(
      {
        ...input,
        companyId: me.companyId,
      },
      isSuperAdmin,
    );
  }

  @Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
  @RequirePermissions('users:update', 'users:manage')
  @Patch(':id')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() input: any) {
    return this.service.update(id, me.companyId, me.role === UserRoleEnum.SUPER_ADMIN, input);
  }

  @Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
  @RequirePermissions('users:permissions', 'users:manage')
  @Patch(':id/permissions')
  setPermissions(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { permissionKeys: string[] }) {
    return this.service.setPermissions(id, me.companyId, me.role === UserRoleEnum.SUPER_ADMIN, body.permissionKeys ?? []);
  }

  @Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
  @RequirePermissions('users:update', 'users:manage')
  @Patch(':id/active')
  setActive(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { active: boolean }) {
    return this.service.setActive(id, me.companyId, me.role === UserRoleEnum.SUPER_ADMIN, body.active);
  }

  @Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
  @RequirePermissions('users:delete', 'users:manage')
  @Delete(':id')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(id, me.companyId, me.role === UserRoleEnum.SUPER_ADMIN);
  }
}
