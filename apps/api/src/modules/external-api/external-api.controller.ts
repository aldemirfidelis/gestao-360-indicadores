import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { ApiKeyCtx, ApiKeyContext, ApiKeyGuard, RequireScopes } from './api-key.guard';
import { ExternalApiService } from './external-api.service';
import { ExternalPrizeEligibleDto, ExternalPrizeEventsDto, ExternalResultsDto } from './external-api.dto';

/**
 * API pública para sistemas externos (SAP, Apdata, SE Suite, etc.).
 * Autenticação por chave de API no header `X-Api-Key` — a EMPRESA é sempre derivada da
 * chave (nunca do corpo). Isolada por empresa; protegida por escopos e rate limit.
 */
@Controller('external/v1')
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class ExternalApiController {
  constructor(private readonly service: ExternalApiService) {}

  /** Valida a chave e retorna a empresa/escopos resolvidos. */
  @Get('health')
  health(@ApiKeyCtx() ctx: ApiKeyContext) {
    return { ok: true, companyId: ctx.companyId, scopes: ctx.scopes };
  }

  /** Lista indicadores da empresa (definição + último período). */
  @Get('indicators')
  @RequireScopes('indicators:read')
  indicators(@ApiKeyCtx() ctx: ApiKeyContext) {
    return this.service.indicators(ctx.companyId);
  }

  /** Importa realizados por código de indicador + período. */
  @Post('results')
  @RequireScopes('results:write')
  results(@ApiKeyCtx() ctx: ApiKeyContext, @Body() body: ExternalResultsDto) {
    return this.service.upsertResults(ctx.companyId, body.items);
  }

  /** Estrutura organizacional (áreas/setores) da empresa. */
  @Get('areas')
  @RequireScopes('org:read')
  areas(@ApiKeyCtx() ctx: ApiKeyContext) {
    return this.service.areas(ctx.companyId);
  }

  /** Planos de ação da empresa (resumo). */
  @Get('action-plans')
  @RequireScopes('actions:read')
  actionPlans(@ApiKeyCtx() ctx: ApiKeyContext) {
    return this.service.actionPlans(ctx.companyId);
  }

  // ----- Gestão de Prêmio (push direto do Apdata/folha, sem arquivos) -----

  /**
   * Push da base elegível da competência (programCode + year/month): cria snapshot
   * imutável por lote e devolve a conciliação (novos/saíram/alterados/pendências).
   * Auto-cria a competência se ainda não existir.
   */
  @Post('prize/eligible')
  @RequireScopes('prize:write')
  prizeEligible(@ApiKeyCtx() ctx: ApiKeyContext, @Body() body: ExternalPrizeEligibleDto) {
    return this.service.prizeEligiblePush(ctx.companyId, body);
  }

  /** Push de eventos (faltas, atestados, medidas, acidentes, treinamento) da competência. */
  @Post('prize/events')
  @RequireScopes('prize:write')
  prizeEvents(@ApiKeyCtx() ctx: ApiKeyContext, @Body() body: ExternalPrizeEventsDto) {
    return this.service.prizeEventsPush(ctx.companyId, body);
  }
}
