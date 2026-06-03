import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PlatformService } from './platform.service';
import { CreateCompanyDto, SetCompanyStatusDto, SwitchCompanyDto, UpdateCompanyDto } from './platform.dto';

/**
 * Administração Geral da Plataforma — exclusiva do Super Admin.
 * Gestão global de empresas e métricas. Cada empresa permanece isolada;
 * administradores de empresa NÃO têm acesso a estas rotas.
 */
@Controller('platform')
@Roles(UserRoleEnum.SUPER_ADMIN)
export class PlatformController {
  constructor(private readonly service: PlatformService) {}

  @Get('overview')
  overview() {
    return this.service.overview();
  }

  @Get('companies')
  listCompanies() {
    return this.service.listCompanies();
  }

  /** Super Admin escolhe/entra em uma empresa para administrar (impersonação). */
  @Post('switch')
  switchCompany(@CurrentUser() me: AuthPayload, @Body() dto: SwitchCompanyDto) {
    return this.service.switchCompany(me, dto.companyId ?? null);
  }

  @Get('companies/:id')
  getCompany(@Param('id') id: string) {
    return this.service.getCompany(id);
  }

  @Post('companies')
  createCompany(@CurrentUser() me: AuthPayload, @Body() dto: CreateCompanyDto) {
    return this.service.createCompany(me, dto);
  }

  @Patch('companies/:id')
  updateCompany(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.service.updateCompany(me, id, dto);
  }

  @Patch('companies/:id/status')
  setStatus(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: SetCompanyStatusDto) {
    return this.service.setStatus(me, id, dto.status);
  }
}
