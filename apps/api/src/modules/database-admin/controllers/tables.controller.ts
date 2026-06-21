import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { SchemaInspectionService } from '../services/schema-inspection.service';
import { assertInAllowlist } from '../util/identifier.util';
import { getTableCatalogEntry } from '../table-catalog';

@Controller('admin/database/tables')
@Roles(UserRoleEnum.SUPER_ADMIN)
@UseGuards(SuperAdminDbGuard)
@DbAdminSubmenuTag('tables')
export class TablesController {
  constructor(private readonly schema: SchemaInspectionService) {}

  @Get()
  list() {
    return this.schema.listTables();
  }

  @Get(':table/schema')
  async getSchema(@Param('table') table: string) {
    const allow = await this.schema.getAllowlist();
    assertInAllowlist(table, allow, 'tabela');
    const [columns, constraints, indexes] = await Promise.all([
      this.schema.getColumns(table),
      this.schema.getConstraints(table),
      this.schema.getIndexes(table),
    ]);
    return { table, catalog: getTableCatalogEntry(table), columns, constraints, indexes };
  }
}
