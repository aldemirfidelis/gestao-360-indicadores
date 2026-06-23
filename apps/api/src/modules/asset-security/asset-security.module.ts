import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AssetSecurityController } from './asset-security.controller';
import { AssetSecurityService } from './asset-security.service';

@Module({
  imports: [AiModule],
  controllers: [AssetSecurityController],
  providers: [AssetSecurityService],
  exports: [AssetSecurityService],
})
export class AssetSecurityModule {}
