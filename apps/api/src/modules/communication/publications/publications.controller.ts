import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { CommunicationAudienceService, type AudienceSelection } from './audience.service';
import { CommunicationSettingsService } from './communication-settings.service';
import { PublicationsService, type PublicationInput } from './publications.service';

/**
 * Central administrativa de publicacoes internas.
 * Rotas do modulo refatorado: visao geral, publicacoes, publico e metricas.
 */
@Controller('communication/publications')
export class PublicationsController {
  constructor(
    private readonly service: PublicationsService,
    private readonly audience: CommunicationAudienceService,
  ) {}

  @Get('overview')
  @RequirePermissions('communication:view')
  overview(@CurrentUser() me: AuthPayload) {
    return this.service.overview(me);
  }

  @Get()
  @RequirePermissions('communication:view')
  list(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string>) {
    return this.service.list(me, query);
  }

  /** Opcoes de publico (etapa 3) — sem tela separada de "Pessoas". */
  @Get('audience/options')
  @RequirePermissions('communication:view')
  audienceOptions(@CurrentUser() me: AuthPayload) {
    return this.audience.options(me.companyId);
  }

  @Post('audience/estimate')
  @RequirePermissions('communication:view')
  audienceEstimate(@CurrentUser() me: AuthPayload, @Body() body: { audience?: AudienceSelection[] }) {
    return this.audience.estimate(me.companyId, this.audience.normalize(body?.audience));
  }

  @Get(':id')
  @RequirePermissions('communication:view')
  detail(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.detail(me, id);
  }

  @Get(':id/metrics')
  @RequirePermissions('communication:reports', 'communication:manage')
  metrics(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.metrics(me, id);
  }

  @Get(':id/metrics.csv')
  @RequirePermissions('communication:export', 'communication:manage')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportMetrics(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Res() res: Response) {
    const { fileName, csv } = await this.service.exportMetricsCsv(me, id);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv);
  }

  @Post()
  @RequirePermissions('communication:create', 'communication:manage')
  create(@CurrentUser() me: AuthPayload, @Body() body: PublicationInput) {
    return this.service.create(me, body);
  }

  @Patch(':id')
  @RequirePermissions('communication:update', 'communication:update:any', 'communication:manage')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: PublicationInput) {
    return this.service.update(me, id, body);
  }

  @Post(':id/duplicate')
  @RequirePermissions('communication:create', 'communication:manage')
  duplicate(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.duplicate(me, id);
  }

  /** Publicar, agendar, encerrar, arquivar, enviar/retornar da aprovacao. */
  @Post(':id/status')
  @RequirePermissions('communication:publish', 'communication:approve', 'communication:manage')
  changeStatus(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.changeStatus(me, id, body ?? {});
  }

  @Delete(':id')
  @RequirePermissions('communication:delete', 'communication:manage')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }
}

/** Categorias e fluxo de aprovacao (Configuracoes do modulo). */
@Controller('communication/settings')
export class CommunicationSettingsController {
  constructor(private readonly settings: CommunicationSettingsService) {}

  @Get()
  @RequirePermissions('communication:view')
  async get(@CurrentUser() me: AuthPayload) {
    const [settings, categories] = await Promise.all([
      this.settings.settings(me.companyId),
      this.settings.categories(me.companyId, true),
    ]);
    return { settings, categories };
  }

  @Get('categories')
  @RequirePermissions('communication:view')
  categories(@CurrentUser() me: AuthPayload) {
    return this.settings.categories(me.companyId);
  }

  @Patch()
  @RequirePermissions('communication:manage')
  update(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.settings.updateSettings(me, body ?? {});
  }

  @Post('categories')
  @RequirePermissions('communication:categories', 'communication:manage')
  createCategory(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.settings.createCategory(me, body ?? {});
  }

  @Patch('categories/:id')
  @RequirePermissions('communication:categories', 'communication:manage')
  updateCategory(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.settings.updateCategory(me, id, body ?? {});
  }

  @Delete('categories/:id')
  @RequirePermissions('communication:categories', 'communication:manage')
  removeCategory(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.settings.removeCategory(me, id);
  }
}
