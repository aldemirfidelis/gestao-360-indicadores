import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthPayload } from '../auth/auth.types';
import { AdminService } from './admin.service';

@Controller('admin')
@Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN)
@RequirePermissions('settings:manage')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('bootstrap')
  @RequirePermissions('settings:view', 'settings:manage', 'users:view', 'users:profiles', 'users:manage', 'audit:view')
  bootstrap(@CurrentUser() me: AuthPayload) {
    return this.service.bootstrap(me);
  }

  @Get('permissions')
  @RequirePermissions('users:permissions', 'users:profiles', 'users:manage')
  permissions() {
    return this.service.listPermissions();
  }

  @Post('companies')
  createCompany(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createCompany(me, body);
  }

  @Patch('companies/:id')
  updateCompany(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateCompany(me, id, body);
  }

  @Delete('companies/:id')
  removeCompany(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeCompany(me, id);
  }

  @Post('branches')
  createBranch(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createBranch(me, body);
  }

  @Patch('branches/:id')
  updateBranch(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateBranch(me, id, body);
  }

  @Delete('branches/:id')
  removeBranch(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeBranch(me, id);
  }

  @Post('parameters/categories')
  createCategory(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createCategory(me, body);
  }

  @Patch('parameters/categories/:id')
  updateCategory(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateCategory(me, id, body);
  }

  @Delete('parameters/categories/:id')
  removeCategory(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeCategory(me, id);
  }

  @Post('parameters/items')
  createItem(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createItem(me, body);
  }

  @Patch('parameters/items/:id')
  updateItem(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateItem(me, id, body);
  }

  @Delete('parameters/items/:id')
  removeItem(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeItem(me, id);
  }

  @Post('security/profiles')
  @RequirePermissions('users:profiles', 'users:manage')
  createProfile(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createProfile(me, body);
  }

  @Patch('security/profiles/:id')
  @RequirePermissions('users:profiles', 'users:manage')
  updateProfile(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateProfile(me, id, body);
  }

  @Patch('security/profiles/:id/permissions')
  @RequirePermissions('users:profiles', 'users:manage')
  setProfilePermissions(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { permissionKeys: string[] }) {
    return this.service.setProfilePermissions(me, id, body.permissionKeys ?? []);
  }

  @Delete('security/profiles/:id')
  @RequirePermissions('users:profiles', 'users:manage')
  removeProfile(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeProfile(me, id);
  }

  @Put('system/settings')
  upsertSetting(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.upsertSetting(me, body);
  }
}
