import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { SensitiveBody } from '../../common/decorators/sensitive-body.decorator';
import { AuthPayload } from '../auth/auth.types';
import { BiometricService } from './biometric.service';

@Controller('personnel/biometrics')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@SensitiveBody()
export class BiometricController {
  constructor(private readonly service: BiometricService) {}

  @Get('me')
  @RequirePermissions('ponto:view')
  status(@CurrentUser() me: AuthPayload) { return this.service.status(me); }

  @Get('employees')
  @RequirePermissions('ponto:manage')
  employeeProfiles(
    @CurrentUser() me: AuthPayload,
    @Query('search') search?: string,
    @Query('biometricStatus') biometricStatus?: string,
  ) {
    return this.service.listEmployeeProfiles(me, { search, biometricStatus });
  }

  @Post('employees/:employeeId/challenge')
  @RequirePermissions('ponto:manage')
  employeeEnrollmentChallenge(@CurrentUser() me: AuthPayload, @Param('employeeId') employeeId: string) {
    return this.service.employeeEnrollmentChallenge(me, employeeId);
  }

  @Post('employees/:employeeId/enroll')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermissions('ponto:manage')
  enrollEmployee(@CurrentUser() me: AuthPayload, @Param('employeeId') employeeId: string, @Body() body: any) {
    return this.service.enrollEmployee(me, employeeId, body);
  }

  @Post('employees/:employeeId/revoke')
  @RequirePermissions('ponto:manage')
  revokeEmployee(@CurrentUser() me: AuthPayload, @Param('employeeId') employeeId: string, @Body() body: any) {
    return this.service.revokeEmployee(me, employeeId, body);
  }

  @Post('challenge/enroll')
  @RequirePermissions('ponto:view')
  enrollmentChallenge(@CurrentUser() me: AuthPayload) { return this.service.challenge(me, 'ENROLL'); }

  // Batida facial pelo portal exige `ponto:clock` (guard é OR — ver punch).
  @Post('challenge/punch')
  @RequirePermissions('ponto:clock')
  punchChallenge(@CurrentUser() me: AuthPayload) { return this.service.challenge(me, 'VERIFY_PUNCH'); }

  @Post('enroll')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @RequirePermissions('ponto:view')
  enroll(@CurrentUser() me: AuthPayload, @Body() body: any) { return this.service.enroll(me, body); }

  @Post('verify-and-punch')
  @RequirePermissions('ponto:clock')
  verifyAndPunch(@CurrentUser() me: AuthPayload, @Body() body: any, @Req() req: Request) {
    return this.service.verifyAndPunch(me, body, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Post('revoke')
  @RequirePermissions('ponto:view')
  revoke(@CurrentUser() me: AuthPayload, @Body() body: any) { return this.service.revoke(me, body); }
}
