import { Controller, Get, Param } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  @Get('me')
  myCompany(@CurrentUser() me: AuthPayload) {
    return this.service.getById(me.companyId);
  }

  @Get('me/branches')
  myBranches(@CurrentUser() me: AuthPayload) {
    return this.service.listBranches(me.companyId);
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
