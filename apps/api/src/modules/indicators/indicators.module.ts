import { Module } from '@nestjs/common';
import { PeriodsModule } from '../periods/periods.module';
import { IndicatorsService } from './indicators.service';
import { IndicatorsController } from './indicators.controller';

@Module({
  imports: [PeriodsModule],
  controllers: [IndicatorsController],
  providers: [IndicatorsService],
  exports: [IndicatorsService],
})
export class IndicatorsModule {}
