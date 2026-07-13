import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { BiometricService } from './biometric.service';

@Controller('personnel/biometrics')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class BiometricController {
  constructor(private readonly service: BiometricService) {}

  @Get('me')
  @RequirePermissions('ponto:view')
  status(@CurrentUser() me: AuthPayload) { return this.service.status(me); }

  @Post('challenge/enroll')
  @RequirePermissions('ponto:view')
  enrollmentChallenge(@CurrentUser() me: AuthPayload) { return this.service.challenge(me, 'ENROLL'); }

  @Post('challenge/punch')
  @RequirePermissions('ponto:clock', 'ponto:view')
  punchChallenge(@CurrentUser() me: AuthPayload) { return this.service.challenge(me, 'VERIFY_PUNCH'); }

  @Post('enroll')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @RequirePermissions('ponto:view')
  enroll(@CurrentUser() me: AuthPayload, @Body() body: any) { return this.service.enroll(me, body); }

  @Post('verify-and-punch')
  @RequirePermissions('ponto:clock', 'ponto:view')
  verifyAndPunch(@CurrentUser() me: AuthPayload, @Body() body: any, @Req() req: Request) {
    return this.service.verifyAndPunch(me, body, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Post('revoke')
  @RequirePermissions('ponto:view')
  revoke(@CurrentUser() me: AuthPayload, @Body() body: any) { return this.service.revoke(me, body); }
}
