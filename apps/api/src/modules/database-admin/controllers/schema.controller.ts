import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { SchemaInspectionService } from '../services/schema-inspection.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthPayload } from '../../auth/auth.types';

@Controller('admin/database')
@Roles(UserRoleEnum.SUPER_ADMIN)
@UseGuards(SuperAdminDbGuard)
export class SchemaController {
  constructor(private readonly schema: SchemaInspectionService) {}

  /** Estrutura completa para o diagrama ER (tabelas + colunas-chave + relacionamentos). */
  @Get('schema')
  @DbAdminSubmenuTag('structure')
  async getSchema(@CurrentUser() user: AuthPayload) {
    const [tables, relationships] = await Promise.all([
      this.schema.listCompanyScopedTables(user.companyId),
      this.schema.getCompanyScopedRelationships(),
    ]);
    return { tables, relationships };
  }

  @Get('relationships')
  @DbAdminSubmenuTag('structure')
  getRelationships() {
    return this.schema.getCompanyScopedRelationships();
  }

  @Get('indexes')
  @DbAdminSubmenuTag('indexes')
  getIndexes(@Query('table') table?: string) {
    return this.schema.getCompanyScopedIndexes(table || undefined);
  }
}
