import { Module } from '@nestjs/common';
import { PublicContactService } from './public-contact.service';
import { PublicController } from './public.controller';
import { TenantService } from './tenant.service';

@Module({
  controllers: [PublicController],
  providers: [TenantService, PublicContactService],
  exports: [TenantService],
})
export class PublicModule {}
