import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { PortalConfigService } from '../services/portal-config.service';

/**
 * Configuração efetiva do portal para o usuário logado (overlay resolvido).
 * Disponível a QUALQUER usuário autenticado (o shell consome para aplicar overrides).
 * Protegido apenas pelo JwtAuthGuard global — não é exclusivo do Super Admin.
 */
@Controller('portal')
export class PortalConfigController {
  constructor(private readonly config: PortalConfigService) {}

  @Get('config')
  getConfig(@CurrentUser() user: AuthPayload) {
    return this.config.getEffectiveConfig(user);
  }
}
