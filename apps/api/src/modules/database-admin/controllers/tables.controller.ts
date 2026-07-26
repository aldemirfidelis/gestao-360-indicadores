import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { SchemaInspectionService } from '../services/schema-inspection.service';
import { getTableCatalogEntry } from '../table-catalog';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthPayload } from '../../auth/auth.types';

@Controller('admin/database/tables')
@Roles(UserRoleEnum.SUPER_ADMIN)
@UseGuards(SuperAdminDbGuard)
@DbAdminSubmenuTag('tables')
export class TablesController {
  constructor(private readonly schema: SchemaInspectionService) {}

  @Get()
  list(@CurrentUser() user: AuthPayload) {
    return this.schema.listCompanyScopedTables(user.companyId);
  }

  @Get(':table/schema')
  async getSchema(@Param('table') table: string) {
    await this.schema.assertCompanyScopedTable(table);
    const [columns, constraints, indexes] = await Promise.all([
      this.schema.getColumns(table),
      this.schema.getConstraints(table),
      this.schema.getIndexes(table),
    ]);
    return { table, catalog: getTableCatalogEntry(table), columns, constraints, indexes };
  }
}
