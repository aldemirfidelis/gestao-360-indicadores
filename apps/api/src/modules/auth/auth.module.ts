import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ExclusiveAccessProfileGuard } from '../../common/guards/exclusive-access-profile.guard';
import { requireSecret } from '../../common/env';
import { PublicModule } from '../public/public.module';

@Module({
  imports: [
    PublicModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // registerAsync: o segredo e resolvido na inicializacao do modulo (apos o
    // ConfigModule carregar o .env), e nao no import-time. Sem fallback
    // 'change-me' -> fail-fast se o segredo nao estiver configurado/for fraco.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: requireSecret('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: process.env.JWT_ACCESS_TTL ?? '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ExclusiveAccessProfileGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
