import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [CommunicationModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
