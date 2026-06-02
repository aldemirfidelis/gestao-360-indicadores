import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

import { PostgreSQLAdapter } from './adapters/postgresql.adapter';
import { SchemaInspectionService } from './services/schema-inspection.service';
import { DbAdminAuditService } from './services/db-admin-audit.service';
import { OverviewService } from './services/overview.service';
import { DiagnosticsService } from './services/diagnostics.service';
import { BackupService } from './services/backup.service';
import { RecordManagementService } from './services/record-management.service';
import { QueryValidationService } from './services/query-validation.service';
import { QueryExecutionService } from './services/query-execution.service';
import { StructureService } from './services/structure.service';
import { ExportService } from './services/export.service';
import { ImportService } from './services/import.service';
import { DbAdminSettingsService } from './services/db-admin-settings.service';
import { SuperAdminDbGuard } from './guards/super-admin-db.guard';

import { OverviewController } from './controllers/overview.controller';
import { TablesController } from './controllers/tables.controller';
import { SchemaController } from './controllers/schema.controller';
import { DiagnosticsController } from './controllers/diagnostics.controller';
import { RecordsController } from './controllers/records.controller';
import { QueryController } from './controllers/query.controller';
import { StructureController } from './controllers/structure.controller';
import { ImportExportController } from './controllers/import-export.controller';
import { BackupController } from './controllers/backup.controller';
import { DbAuditController } from './controllers/db-audit.controller';
import { DbSettingsController } from './controllers/db-settings.controller';

/**
 * Módulo de Administração do Banco de Dados (Configurações > Banco de Dados).
 * Acesso exclusivo do Super Admin (SuperAdminDbGuard, que também audita acessos).
 */
@Module({
  imports: [PrismaModule],
  controllers: [
    OverviewController,
    TablesController,
    SchemaController,
    DiagnosticsController,
    RecordsController,
    QueryController,
    StructureController,
    ImportExportController,
    BackupController,
    DbAuditController,
    DbSettingsController,
  ],
  providers: [
    PostgreSQLAdapter,
    SchemaInspectionService,
    DbAdminAuditService,
    OverviewService,
    DiagnosticsService,
    BackupService,
    RecordManagementService,
    QueryValidationService,
    QueryExecutionService,
    StructureService,
    ExportService,
    ImportService,
    DbAdminSettingsService,
    SuperAdminDbGuard,
  ],
  exports: [PostgreSQLAdapter, SchemaInspectionService, DbAdminAuditService, BackupService],
})
export class DatabaseAdminModule {}
