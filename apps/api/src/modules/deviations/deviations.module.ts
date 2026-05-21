import { Module } from '@nestjs/common';
import { DeviationsService } from './deviations.service';
import { DeviationsController } from './deviations.controller';

@Module({
  controllers: [DeviationsController],
  providers: [DeviationsService],
  exports: [DeviationsService],
})
export class DeviationsModule {}
