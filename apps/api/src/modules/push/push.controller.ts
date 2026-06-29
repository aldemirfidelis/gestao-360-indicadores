import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PushService, WebPushSubscriptionInput } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly service: PushService) {}

  @Get('public-key')
  publicKey() {
    return this.service.getPublicKey();
  }

  @Post('subscribe')
  subscribe(@CurrentUser() me: AuthPayload, @Body() body: WebPushSubscriptionInput) {
    return this.service.subscribe(me.sub, me.companyId ?? null, body);
  }

  @Post('unsubscribe')
  unsubscribe(@Body() body: { endpoint?: string }) {
    return this.service.unsubscribe(body?.endpoint ?? '');
  }

  @Post('test')
  async test(@CurrentUser() me: AuthPayload) {
    await this.service.sendToUser(me.sub, {
      title: 'Gestão 360',
      body: 'Notificação de teste recebida com sucesso ✓',
      link: '/',
      tag: 'g360-test',
    });
    return { ok: true };
  }
}
