import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ActionsModule } from '../actions/actions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MonthlyResultsController } from './monthly-results.controller';
import { MonthlyResultsService } from './monthly-results.service';

@Module({
  imports: [AiModule, ActionsModule, NotificationsModule],
  controllers: [MonthlyResultsController],
  providers: [MonthlyResultsService],
})
export class MonthlyResultsModule {}
