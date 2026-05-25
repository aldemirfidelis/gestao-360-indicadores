import { Module } from '@nestjs/common';
import { ClosedMonthsController } from './closed-months.controller';
import { ClosedMonthsService } from './closed-months.service';

@Module({
  controllers: [ClosedMonthsController],
  providers: [ClosedMonthsService],
  exports: [ClosedMonthsService],
})
export class ClosedMonthsModule {}
