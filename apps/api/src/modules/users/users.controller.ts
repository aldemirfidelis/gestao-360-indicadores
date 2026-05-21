import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@prisma/client';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { userCreateSchema } from '@g360/shared';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  list(@CurrentUser() me: AuthPayload) {
    return this.service.list(me.companyId);
  }

  @Get('permissions')
  permissions() {
    return this.service.listPermissions();
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
  @Post()
  create(@Body(new ZodValidationPipe(userCreateSchema)) input: any) {
    return this.service.create(input);
  }

  @Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() input: any) {
    return this.service.update(id, input);
  }

  @Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
  @Patch(':id/permissions')
  setPermissions(@Param('id') id: string, @Body() body: { permissionKeys: string[] }) {
    return this.service.setPermissions(id, body.permissionKeys ?? []);
  }

  @Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body() body: { active: boolean }) {
    return this.service.setActive(id, body.active);
  }

  @Roles(UserRoleEnum.COMPANY_ADMIN, UserRoleEnum.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
