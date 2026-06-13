import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AutomationsModule } from '../automations/automations.module';
import { ActionsModule } from '../actions/actions.module';
import { DocumentsModule } from '../documents/documents.module';
import { MyDayController } from './my-day.controller';
import { MyDayService } from './my-day.service';
import { MyDayTeamService } from './my-day-team.service';
import { WorkItemAggregationService } from './work-item-aggregation.service';
import { WorkItemPriorityService } from './work-item-priority.service';

@Module({
  imports: [PrismaModule, AutomationsModule, ActionsModule, DocumentsModule],
  controllers: [MyDayController],
  providers: [MyDayService, MyDayTeamService, WorkItemAggregationService, WorkItemPriorityService],
  exports: [WorkItemAggregationService, WorkItemPriorityService],
})
export class MyDayModule {}
