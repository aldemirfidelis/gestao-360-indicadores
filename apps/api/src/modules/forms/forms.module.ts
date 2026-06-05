import { Module } from '@nestjs/common';
import { TraceabilityModule } from '../traceability/traceability.module';
import { FormCodeService } from './form-code.service';
import { FormStorageService } from './form-storage.service';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';

@Module({
  imports: [TraceabilityModule],
  controllers: [FormsController],
  providers: [FormsService, FormCodeService, FormStorageService],
  exports: [FormsService],
})
export class FormsModule {}
