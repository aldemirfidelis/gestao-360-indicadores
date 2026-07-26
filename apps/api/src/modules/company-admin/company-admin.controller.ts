import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { CompanyDataQueryDto } from './company-admin.dto';
import { CompanyAdminService } from './company-admin.service';

@Controller('company-admin')
export class CompanyAdminController {
  constructor(private readonly service: CompanyAdminService) {}

  @Get('overview')
  @RequirePermissions('settings:view', 'settings:manage', 'users:view', 'users:profiles', 'users:manage', 'integrations:view', 'integrations:manage', 'company-data:view', 'company-data:export', 'audit:view', 'audit:export')
  overview(@CurrentUser() me: AuthPayload) {
    return this.service.overview(me);
  }

  @Get('data')
  @RequirePermissions('company-data:view', 'company-data:export')
  catalog() {
    return this.service.catalog();
  }

  @Get('data/:dataset/export')
  @RequirePermissions('company-data:export')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="dados-empresa.csv"')
  exportCsv(@CurrentUser() me: AuthPayload, @Param('dataset') dataset: string, @Query('search') search?: string) {
    return this.service.exportCsv(me, dataset, search);
  }

  @Get('data/:dataset')
  @RequirePermissions('company-data:view', 'company-data:export')
  list(@CurrentUser() me: AuthPayload, @Param('dataset') dataset: string, @Query() query: CompanyDataQueryDto) {
    return this.service.list(me, dataset, query);
  }
}
