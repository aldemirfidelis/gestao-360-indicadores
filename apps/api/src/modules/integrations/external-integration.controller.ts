import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
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
 * Administracao de integracoes da empresa. O escopo SEMPRE vem da empresa da
 * sessao; credenciais nunca retornam ao cliente. O Super Admin continua com
 * acesso global por impersonacao, sem criar uma segunda implementacao.
 */
@Controller('integrations/external')
@RequirePermissions('integrations:view', 'integrations:manage')
export class ExternalIntegrationController {
  constructor(private readonly service: ExternalIntegrationService) {}

  // --- chaves de API (inbound) — declarar antes de ':id' p/ não colidir com a rota param ---
  @Get('keys')
  listApiKeys(@CurrentUser() me: AuthPayload) {
    return this.service.listApiKeys(me.companyId);
  }

  @Post('keys')
  @RequirePermissions('integrations:manage')
  createApiKey(@CurrentUser() me: AuthPayload, @Body() dto: CreateApiKeyDto) {
    return this.service.createApiKey(me, dto);
  }

  @Delete('keys/:id')
  @RequirePermissions('integrations:manage')
  revokeApiKey(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.revokeApiKey(me, id);
  }

  // --- conectores ---
  @Get()
  list(@CurrentUser() me: AuthPayload) {
    return this.service.listConnectors(me.companyId);
  }

  @Post()
  @RequirePermissions('integrations:manage')
  create(@CurrentUser() me: AuthPayload, @Body() dto: CreateExternalIntegrationDto) {
    return this.service.createConnector(me, dto);
  }

  @Get(':id')
  get(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getConnector(me.companyId, id);
  }

  @Patch(':id')
  @RequirePermissions('integrations:manage')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: UpdateExternalIntegrationDto) {
    return this.service.updateConnector(me, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('integrations:manage')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeConnector(me, id);
  }

  @Post(':id/test')
  @RequirePermissions('integrations:manage')
  test(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.testConnector(me, id);
  }

  @Post(':id/run')
  @RequirePermissions('integrations:manage')
  run(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: RunIntegrationDto) {
    return this.service.runConnector(me, id, dto.operation);
  }

  @Get(':id/logs')
  logs(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.listLogs(me.companyId, id);
  }
}
