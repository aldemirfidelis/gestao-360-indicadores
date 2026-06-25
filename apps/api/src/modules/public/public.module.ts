import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { TenantService } from './tenant.service';

@Module({
  controllers: [PublicController],
  providers: [TenantService],
  exports: [TenantService],
})
export class PublicModule {}
