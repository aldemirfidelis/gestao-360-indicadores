import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ActionsModule } from '../actions/actions.module';
import { AuthModule } from '../auth/auth.module';
import { PortalAdminModule } from '../portal-admin/portal-admin.module';
import { MyDayController } from './my-day.controller';
import { MyDayService } from './my-day.service';
import { MyDayTeamService } from './my-day-team.service';
import { WorkItemAggregationService } from './work-item-aggregation.service';
import { WorkItemPriorityService } from './work-item-priority.service';

@Module({
  imports: [PrismaModule, ActionsModule, AuthModule, PortalAdminModule],
  controllers: [MyDayController],
  providers: [MyDayService, MyDayTeamService, WorkItemAggregationService, WorkItemPriorityService],
  exports: [WorkItemAggregationService, WorkItemPriorityService],
})
export class MyDayModule {}
