import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { EmployeeFeedService } from './employee-feed.service';

/**
 * Minha Vida Funcional > Comunicacao Interna.
 * Todo colaborador com acesso ao portal enxerga aqui — e somente aqui — as
 * publicacoes destinadas a ele.
 */
@Controller('communication/feed')
export class EmployeeFeedController {
  constructor(private readonly service: EmployeeFeedService) {}

  @Get()
  @RequirePermissions('communication:view')
  feed(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string>) {
    return this.service.feed(me, query);
  }

  @Get('pending')
  @RequirePermissions('communication:view')
  pending(@CurrentUser() me: AuthPayload) {
    return this.service.pending(me);
  }

  /** Abrir = registrar a visualizacao (nunca ao apenas listar). */
  @Post(':id/open')
  @RequirePermissions('communication:view')
  open(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Req() req: Request) {
    return this.service.open(me, id, this.context(req));
  }

  @Post(':id/confirm')
  @RequirePermissions('communication:view')
  confirm(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Req() req: Request, @Body() _body: unknown) {
    return this.service.confirm(me, id, this.context(req));
  }

  /** IP e navegador ficam registrados para auditoria da ciência. */
  private context(req: Request) {
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim();
    return {
      ip: forwarded || req.ip || null,
      device: String(req.headers['user-agent'] ?? '').slice(0, 200) || null,
    };
  }
}
