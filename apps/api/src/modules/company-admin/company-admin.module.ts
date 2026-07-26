import { Module } from '@nestjs/common';
import { CompanyAdminController } from './company-admin.controller';
import { CompanyAdminService } from './company-admin.service';

@Module({
  controllers: [CompanyAdminController],
  providers: [CompanyAdminService],
})
export class CompanyAdminModule {}
