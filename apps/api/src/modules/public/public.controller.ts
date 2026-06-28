import { Body, Controller, Get, HttpCode, NotFoundException, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { PublicContactDto } from './public-contact.dto';
import { PublicContactService } from './public-contact.service';
import { TenantService } from './tenant.service';

@Controller('public')
export class PublicController {
  constructor(
    private readonly tenants: TenantService,
    private readonly contacts: PublicContactService,
  ) {}

  /**
   * Recebe formulários institucionais e os encaminha pelo SMTP central.
   * O destinatário é decidido no backend e nunca aceito da requisição.
   */
  @Public()
  @Post('contact')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  sendContact(@Body() body: PublicContactDto) {
    return this.contacts.send(body);
  }

  /**
   * Branding da tela de login a partir do host (subdomínio ou domínio próprio).
   * Sempre 200; `tenant` é null quando o host é o apex/serviço ou não mapeia uma empresa.
   */
  @Public()
  @Get('tenant')
  async getTenant(@Query('host') host?: string) {
    return { tenant: await this.tenants.resolveByHost(host) };
  }

  /**
   * Endpoint "ask" do TLS on-demand do Caddy: responde 2xx apenas para hosts que
   * correspondem a um tenant conhecido (subdomínio ou domínio próprio), evitando
   * emissão de certificado para hosts arbitrários. O Caddy chama com `?domain=`.
   */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('tenant/allow')
  async allow(@Query('domain') domain?: string, @Query('host') host?: string) {
    const tenant = await this.tenants.resolveByHost(domain ?? host);
    if (!tenant) throw new NotFoundException('host não corresponde a um tenant');
    return { ok: true };
  }
}
