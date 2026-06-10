import { Module } from '@nestjs/common';
import { AssetSecurityController } from './asset-security.controller';
import { AssetSecurityService } from './asset-security.service';

@Module({
  controllers: [AssetSecurityController],
  providers: [AssetSecurityService],
  exports: [AssetSecurityService],
})
export class AssetSecurityModule {}
