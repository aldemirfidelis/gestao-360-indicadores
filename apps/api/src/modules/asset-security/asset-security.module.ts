import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AssetSecurityController } from './asset-security.controller';
import { AssetSecurityService } from './asset-security.service';

@Module({
  imports: [AiModule, NotificationsModule],
  controllers: [AssetSecurityController],
  providers: [AssetSecurityService],
  exports: [AssetSecurityService],
})
export class AssetSecurityModule {}
