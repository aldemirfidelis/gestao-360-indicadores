import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { CompaniesService } from './companies.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  @Get('me')
  myCompany(@CurrentUser() me: AuthPayload) {
    return this.service.getById(me.companyId);
  }

  /**
   * Identidade visual da empresa da sessão. Sem exigir permissão: todo usuário
   * autenticado precisa dela para o portal abrir com a cara da própria empresa.
   */
  @Get('me/branding')
  myBranding(@CurrentUser() me: AuthPayload) {
    return this.service.branding(me.companyId);
  }

  @Patch('me/branding')
  @RequirePermissions('settings:manage')
  updateMyBranding(
    @CurrentUser() me: AuthPayload,
    @Body() body: { brandColor?: string | null; logoUrl?: string | null },
  ) {
    return this.service.updateBranding(me.companyId, body);
  }

  @Get('me/branches')
  myBranches(@CurrentUser() me: AuthPayload) {
    return this.service.listBranches(me.companyId);
  }

  @Get(':id')
  @Roles(UserRoleEnum.SUPER_ADMIN)
  byId(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
