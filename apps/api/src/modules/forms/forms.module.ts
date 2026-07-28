import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { NonConformitiesModule } from '../nonconformities/nonconformities.module';
import { TraceabilityModule } from '../traceability/traceability.module';
import { ResultsModule } from '../results/results.module';
import { FormCodeService } from './form-code.service';
import { FormIndicatorService } from './form-indicator.service';
import { FormStorageService } from './form-storage.service';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';

@Module({
  imports: [AiModule, TraceabilityModule, NonConformitiesModule, ResultsModule],
  controllers: [FormsController],
  providers: [FormsService, FormCodeService, FormStorageService, FormIndicatorService],
  exports: [FormsService],
})
export class FormsModule {}
