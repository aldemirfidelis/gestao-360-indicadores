import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { SchemaInspectionService } from '../services/schema-inspection.service';
import { assertInAllowlist } from '../util/identifier.util';

@Controller('admin/database/tables')
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
    return { table, columns, constraints, indexes };
  }
}
