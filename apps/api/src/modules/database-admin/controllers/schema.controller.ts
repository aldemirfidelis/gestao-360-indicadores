import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { SchemaInspectionService } from '../services/schema-inspection.service';

@Controller('admin/database')
@UseGuards(SuperAdminDbGuard)
export class SchemaController {
  constructor(private readonly schema: SchemaInspectionService) {}

  /** Estrutura completa para o diagrama ER (tabelas + colunas-chave + relacionamentos). */
  @Get('schema')
  @DbAdminSubmenuTag('structure')
  async getSchema() {
    const [tables, relationships] = await Promise.all([
      this.schema.listTables(),
      this.schema.getRelationships(),
    ]);
    return { tables, relationships };
  }

  @Get('relationships')
  @DbAdminSubmenuTag('structure')
  getRelationships() {
    return this.schema.getRelationships();
  }

  @Get('indexes')
  @DbAdminSubmenuTag('indexes')
  getIndexes(@Query('table') table?: string) {
    return this.schema.getIndexes(table || undefined);
  }
}
