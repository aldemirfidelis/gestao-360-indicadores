import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from './auth.types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const loginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshDto = z.object({
  refreshToken: z.string().min(10),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Anti brute-force: limite estrito por IP (5 tentativas/min) bem abaixo
  // do throttle global (200/min), sem depender de account lockout.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('login')
  login(
    @Body(new ZodValidationPipe(loginDto)) body: z.infer<typeof loginDto>,
    @Req() req: Request,
  ) {
    return this.auth.login(body.email, body.password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Public()
  @Post('refresh')
  refresh(@Body(new ZodValidationPipe(refreshDto)) body: z.infer<typeof refreshDto>) {
    return this.auth.refresh(body.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() me: AuthPayload, @Body() body: { refreshToken?: string }, @Req() req: Request) {
    return this.auth.logout(body.refreshToken, {
      userId: me.sub,
      companyId: me.companyId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthPayload) {
    return this.auth.me(user);
  }
}
