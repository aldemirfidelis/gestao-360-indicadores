import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminAuthGuard } from './guards/platform-admin-auth.guard';
import { PlatformAdminAuthService } from './services/platform-admin-auth.service';
import { PlatformAdminAuditService } from './services/platform-admin-audit.service';
import { PlatformAdminService } from './services/platform-admin.service';
import { PlatformAdminBootstrapService } from './services/platform-admin-bootstrap.service';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [PlatformAdminController],
  providers: [
    PlatformAdminAuthGuard,
    PlatformAdminAuthService,
    PlatformAdminAuditService,
    PlatformAdminService,
    PlatformAdminBootstrapService,
  ],
  exports: [PlatformAdminService],
})
export class PlatformAdminGlobalModule {}
