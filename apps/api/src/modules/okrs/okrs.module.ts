import { Module } from '@nestjs/common';
import { OkrsService } from './okrs.service';
import { OkrsController } from './okrs.controller';

@Module({
  controllers: [OkrsController],
  providers: [OkrsService],
  exports: [OkrsService],
})
export class OkrsModule {}
