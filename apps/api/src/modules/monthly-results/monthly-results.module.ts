import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { MonthlyResultsController } from './monthly-results.controller';
import { MonthlyResultsService } from './monthly-results.service';

@Module({
  imports: [AiModule],
  controllers: [MonthlyResultsController],
  providers: [MonthlyResultsService],
})
export class MonthlyResultsModule {}
