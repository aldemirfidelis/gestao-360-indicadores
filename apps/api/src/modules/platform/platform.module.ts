import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { ProfileInfrastructureModule } from '../communication/profile-infrastructure.module';

@Module({
  imports: [ProfileInfrastructureModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
