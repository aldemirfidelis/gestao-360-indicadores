import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { SensitiveBody } from '../../common/decorators/sensitive-body.decorator';
import { Public } from '../auth/public.decorator';
import { AuthPayload } from '../auth/auth.types';
import { KioskService } from './kiosk.service';

@Controller('personnel/kiosk')
export class KioskController {
  constructor(private readonly service: KioskService) {}

  @Post('challenge')
  @Public()
  @SensitiveBody()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  challenge(@Req() req: Request) {
    return this.service.challenge(bearerToken(req));
  }

  /** Batida por totem: dispositivo autorizado por token, identificação facial 1:N. */
  @Post('identify-punch')
  @Public()
  @SensitiveBody()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  identifyPunch(@Body() body: any, @Req() req: Request) {
    return this.service.identifyAndPunch(bearerToken(req), body, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Get('devices')
  @RequirePermissions('ponto:manage')
  listDevices(@CurrentUser() me: AuthPayload) {
    return this.service.listDevices(me);
  }

  @Post('devices')
  @RequirePermissions('ponto:manage')
  createDevice(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createDevice(me, body);
  }

  @Patch('devices/:id')
  @RequirePermissions('ponto:manage')
  setDeviceActive(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.setDeviceActive(me, id, body);
  }

  @Post('devices/:id/rotate')
  @RequirePermissions('ponto:manage')
  rotateDeviceToken(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.rotateDeviceToken(me, id, body);
  }
}

function bearerToken(req: Request): string {
  const value = String(req.headers.authorization ?? '');
  return /^Bearer\s+/i.test(value) ? value.replace(/^Bearer\s+/i, '').trim() : '';
}
