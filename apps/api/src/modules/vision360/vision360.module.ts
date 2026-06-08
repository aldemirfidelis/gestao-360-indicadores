import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { Vision360Service } from './vision360.service';
import { Vision360Controller } from './vision360.controller';

@Module({
  imports: [PrismaModule],
  controllers: [Vision360Controller],
  providers: [Vision360Service],
  exports: [Vision360Service],
})
export class Vision360Module {}
