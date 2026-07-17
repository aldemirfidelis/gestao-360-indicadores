import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
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
  // Identificador de login: e-mail (chave interna), CPF ou matrícula (aliases).
  // Mantém a chave "email" por compatibilidade com o front.
  email: z.string().min(3).max(255),
  password: z.string().min(1),
  // Host de origem (subdomínio/domínio do tenant). Usado para validar que o
  // usuário pertence à empresa daquele endereço. Opcional (apex não envia).
  host: z.string().max(255).optional(),
});

const refreshDto = z.object({
  refreshToken: z.string().min(10),
});

const changePasswordDto = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
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
      tenantHost: body.host,
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

  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  changePassword(
    @CurrentUser() me: AuthPayload,
    @Body(new ZodValidationPipe(changePasswordDto)) body: z.infer<typeof changePasswordDto>,
    @Req() req: Request,
  ) {
    return this.auth.changePassword(me.sub, body.currentPassword, body.newPassword, {
      companyId: me.companyId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
