import { Module } from '@nestjs/common';
import { OrgNodesService } from './orgnodes.service';
import { OrgNodesController } from './orgnodes.controller';

@Module({
  controllers: [OrgNodesController],
  providers: [OrgNodesService],
  exports: [OrgNodesService],
})
export class OrgNodesModule {}
