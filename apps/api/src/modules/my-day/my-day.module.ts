import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AutomationsModule } from '../automations/automations.module';
import { ActionsModule } from '../actions/actions.module';
import { MyDayController } from './my-day.controller';
import { MyDayService } from './my-day.service';
import { WorkItemAggregationService } from './work-item-aggregation.service';
import { WorkItemPriorityService } from './work-item-priority.service';

@Module({
  imports: [PrismaModule, AutomationsModule, ActionsModule],
  controllers: [MyDayController],
  providers: [MyDayService, WorkItemAggregationService, WorkItemPriorityService],
  exports: [WorkItemAggregationService, WorkItemPriorityService],
})
export class MyDayModule {}
