import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ExternalIntegrationService } from './external-integration.service';
import {
  CreateApiKeyDto,
  CreateExternalIntegrationDto,
  RunIntegrationDto,
  UpdateExternalIntegrationDto,
} from './external-integration.dto';

/**
 * Administração de integrações com APIs externas — SOMENTE Super Admin (operadores da plataforma).
 * Telas de SAP/Apdata/SE Suite/REST + chaves de entrada ficam no Portal Admin Global; usuários da
 * empresa não acessam. Escopo SEMPRE = empresa da sessão (companyId efetivo, empresa selecionada/
 * impersonada). Credenciais nunca retornam ao cliente.
 */
@Controller('integrations/external')
@Roles(UserRoleEnum.SUPER_ADMIN)
@RequirePermissions('settings:manage')
export class ExternalIntegrationController {
  constructor(private readonly service: ExternalIntegrationService) {}

  // --- chaves de API (inbound) — declarar antes de ':id' p/ não colidir com a rota param ---
  @Get('keys')
  listApiKeys(@CurrentUser() me: AuthPayload) {
    return this.service.listApiKeys(me.companyId);
  }

  @Post('keys')
  createApiKey(@CurrentUser() me: AuthPayload, @Body() dto: CreateApiKeyDto) {
    return this.service.createApiKey(me, dto);
  }

  @Delete('keys/:id')
  revokeApiKey(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.revokeApiKey(me, id);
  }

  // --- conectores ---
  @Get()
  list(@CurrentUser() me: AuthPayload) {
    return this.service.listConnectors(me.companyId);
  }

  @Post()
  create(@CurrentUser() me: AuthPayload, @Body() dto: CreateExternalIntegrationDto) {
    return this.service.createConnector(me, dto);
  }

  @Get(':id')
  get(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getConnector(me.companyId, id);
  }

  @Patch(':id')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: UpdateExternalIntegrationDto) {
    return this.service.updateConnector(me, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeConnector(me, id);
  }

  @Post(':id/test')
  test(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.testConnector(me, id);
  }

  @Post(':id/run')
  run(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: RunIntegrationDto) {
    return this.service.runConnector(me, id, dto.operation);
  }

  @Get(':id/logs')
  logs(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.listLogs(me.companyId, id);
  }
}
