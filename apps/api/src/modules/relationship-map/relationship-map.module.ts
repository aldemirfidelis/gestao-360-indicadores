import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { RelationshipMapController } from './relationship-map.controller';
import { RelationshipMapService } from './relationship-map.service';

@Module({
  imports: [TraceabilityModule],
  controllers: [RelationshipMapController],
  providers: [RelationshipMapService],
})
export class RelationshipMapModule {}
