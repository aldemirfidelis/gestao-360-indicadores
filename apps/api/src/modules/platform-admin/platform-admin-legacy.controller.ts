import { BadRequestException, Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Prisma, UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { Public } from '../auth/public.decorator';
import { AdminService } from '../admin/admin.service';
import { AccessAdminService } from '../access/access-admin.service';
import { OverviewService } from '../database-admin/services/overview.service';
import { SchemaInspectionService } from '../database-admin/services/schema-inspection.service';
import { DiagnosticsService } from '../database-admin/services/diagnostics.service';
import { BackupService } from '../database-admin/services/backup.service';
import { RecordManagementService } from '../database-admin/services/record-management.service';
import { QueryExecutionService } from '../database-admin/services/query-execution.service';
import { StructureService } from '../database-admin/services/structure.service';
import { ExportService, ExportFormat } from '../database-admin/services/export.service';
import { ImportService, ImportFormat, ImportStrategy } from '../database-admin/services/import.service';
import { DbAdminAuditService } from '../database-admin/services/db-admin-audit.service';
import { DbAdminSettingsService } from '../database-admin/services/db-admin-settings.service';
import { PostgreSQLAdapter } from '../database-admin/adapters/postgresql.adapter';
import { getTableCatalogEntry } from '../database-admin/table-catalog';
import { assertInAllowlist, quoteIdent } from '../database-admin/util/identifier.util';
import { DB_ADMIN_LIMITS } from '../database-admin/database-admin.constants';
import type { FilterCondition } from '../database-admin/util/where-builder';
import { HelpService } from '../help/help.service';
import { ExternalIntegrationService } from '../integrations/external-integration.service';
import { OrgNodesService } from '../orgnodes/orgnodes.service';
import { PortalOverviewService } from '../portal-admin/services/portal-overview.service';
import { RegistryService } from '../portal-admin/services/registry.service';
import { FeatureFlagService } from '../portal-admin/services/feature-flag.service';
import { PortalAuditService } from '../portal-admin/services/portal-audit.service';
import { NavigationService } from '../portal-admin/services/navigation.service';
import { ScopeService } from '../portal-admin/services/scope.service';
import { MaintenanceService } from '../portal-admin/services/maintenance.service';
import { ParameterService } from '../portal-admin/services/parameter.service';
import { IntegrationService } from '../portal-admin/services/integration.service';
import { AnnouncementService } from '../portal-admin/services/announcement.service';
import { SnapshotService } from '../portal-admin/services/snapshot.service';
import { PortalDiagnosticsService } from '../portal-admin/services/portal-diagnostics.service';
import { PermissionViewService } from '../portal-admin/services/permission-view.service';
import { PrizeConnectorsService, UpsertConnectorDto } from '../prize/prize-connectors.service';
import { LgpdService } from '../lgpd/lgpd.service';
import { UpsertDataIncidentDto, UpsertProcessingRecordDto, UpsertSubprocessorDto } from '../lgpd/lgpd.dto';
import { PlatformAdminRequired } from './decorators/platform-permissions.decorator';
import { CurrentPlatformAdmin } from './decorators/current-platform-admin.decorator';
import { PlatformAdminIdentity } from './platform-admin.types';

function asAuthPayload(user: PlatformAdminIdentity, companyId = ''): AuthPayload {
  return {
    sub: user.sub,
    email: user.email,
    name: user.name,
    role: UserRoleEnum.SUPER_ADMIN,
    companyId,
    homeCompanyId: companyId,
  };
}

function requestMeta(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null };
}

function requestedCompanyId(req?: Request) {
  const raw = req?.headers['x-platform-company-id'];
  if (Array.isArray(raw)) return raw[0];
  return raw ? String(raw) : null;
}

async function resolveCompanyId(prisma: PrismaService, req?: Request, preferredCompanyId?: string | null) {
  const requested = preferredCompanyId || requestedCompanyId(req);
  if (requested) {
    const found = await prisma.company.findFirst({ where: { id: String(requested), deletedAt: null }, select: { id: true } });
    if (found) return found.id;
  }
  const first = await prisma.company.findFirst({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true } });
  return first?.id ?? '';
}

async function asScopedAuth(prisma: PrismaService, user: PlatformAdminIdentity, req?: Request, preferredCompanyId?: string | null) {
  return asAuthPayload(user, await resolveCompanyId(prisma, req, preferredCompanyId));
}

function companyAuditWhere(
  companyId: string,
  filters: { entity?: string; action?: string; module?: string; userId?: string; q?: string; from?: string; to?: string },
): Prisma.AuditLogWhereInput {
  return {
    companyId,
    ...(filters.entity ? { entity: filters.entity } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.module ? { module: filters.module } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { entity: { contains: filters.q, mode: Prisma.QueryMode.insensitive } },
            { module: { contains: filters.q, mode: Prisma.QueryMode.insensitive } },
            { action: { contains: filters.q, mode: Prisma.QueryMode.insensitive } },
            { recordLabel: { contains: filters.q, mode: Prisma.QueryMode.insensitive } },
            { payload: { contains: filters.q, mode: Prisma.QueryMode.insensitive } },
            { beforeValue: { contains: filters.q, mode: Prisma.QueryMode.insensitive } },
            { afterValue: { contains: filters.q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
  };
}

function csvAuditValue(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

@Public()
@Controller('platform-admin/admin')
@PlatformAdminRequired()
export class PlatformAdminLegacySettingsController {
  constructor(
    private readonly admin: AdminService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('bootstrap')
  async bootstrap(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request) {
    return this.admin.bootstrap(await this.auth(user, req));
  }

  @Get('permissions')
  permissions() {
    return this.admin.listPermissions();
  }

  @Post('companies')
  async createCompany(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() body: any) {
    return this.admin.createCompany(await this.auth(user, req, body?.companyId), body);
  }

  @Patch('companies/:id')
  async updateCompany(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.admin.updateCompany(await this.auth(user, req, id), id, body);
  }

  @Delete('companies/:id')
  async removeCompany(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    return this.admin.removeCompany(await this.auth(user, req, id), id);
  }

  @Post('branches')
  async createBranch(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() body: any) {
    return this.admin.createBranch(await this.auth(user, req, body?.companyId), body);
  }

  @Patch('branches/:id')
  async updateBranch(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.admin.updateBranch(await this.auth(user, req), id, body);
  }

  @Delete('branches/:id')
  async removeBranch(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    return this.admin.removeBranch(await this.auth(user, req), id);
  }

  @Post('parameters/categories')
  async createCategory(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() body: any) {
    return this.admin.createCategory(await this.auth(user, req), body);
  }

  @Patch('parameters/categories/:id')
  async updateCategory(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.admin.updateCategory(await this.auth(user, req), id, body);
  }

  @Delete('parameters/categories/:id')
  async removeCategory(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    return this.admin.removeCategory(await this.auth(user, req), id);
  }

  @Post('parameters/items')
  async createItem(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() body: any) {
    return this.admin.createItem(await this.auth(user, req), body);
  }

  @Patch('parameters/items/:id')
  async updateItem(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.admin.updateItem(await this.auth(user, req), id, body);
  }

  @Delete('parameters/items/:id')
  async removeItem(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    return this.admin.removeItem(await this.auth(user, req), id);
  }

  @Post('security/profiles')
  async createProfile(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() body: any) {
    return this.admin.createProfile(await this.auth(user, req, body?.companyId), body);
  }

  @Patch('security/profiles/:id')
  async updateProfile(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.admin.updateProfile(await this.auth(user, req), id, body);
  }

  @Patch('security/profiles/:id/permissions')
  async setProfilePermissions(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() body: { permissionKeys: string[] }) {
    return this.admin.setProfilePermissions(await this.auth(user, req), id, body?.permissionKeys ?? []);
  }

  @Delete('security/profiles/:id')
  async removeProfile(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    return this.admin.removeProfile(await this.auth(user, req), id);
  }

  @Put('system/settings')
  async upsertSetting(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() body: any) {
    return this.admin.upsertSetting(await this.auth(user, req, body?.companyId), body);
  }

  private auth(user: PlatformAdminIdentity, req?: Request, preferredCompanyId?: string | null) {
    return asScopedAuth(this.prisma, user, req, preferredCompanyId);
  }
}

@Public()
@Controller('platform-admin/access')
@PlatformAdminRequired()
export class PlatformAdminLegacyAccessController {
  constructor(
    private readonly access: AccessAdminService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('modules')
  modules() {
    return this.access.modules();
  }

  @Get('areas')
  async areas(@Req() req: Request) {
    return this.access.areas(await resolveCompanyId(this.prisma, req));
  }

  @Get('users/:userId/areas')
  async userAreas(@Req() req: Request, @Param('userId') userId: string) {
    return this.access.userAreas(await resolveCompanyId(this.prisma, req), userId);
  }

  @Post('users/:userId/areas')
  async addAssignment(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('userId') userId: string, @Body() body: any) {
    const auth = await asScopedAuth(this.prisma, user, req);
    return this.access.addAssignment(auth, auth.companyId, userId, body);
  }

  @Delete('users/:userId/areas/:orgNodeId')
  async removeAssignment(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('userId') userId: string, @Param('orgNodeId') orgNodeId: string) {
    const auth = await asScopedAuth(this.prisma, user, req);
    return this.access.removeAssignment(auth, auth.companyId, userId, orgNodeId);
  }

  @Patch('users/:userId/primary-area')
  async setPrimaryArea(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('userId') userId: string, @Body() body: { orgNodeId: string }) {
    const auth = await asScopedAuth(this.prisma, user, req);
    return this.access.setPrimaryArea(auth, auth.companyId, userId, body?.orgNodeId);
  }

  @Get('matrix')
  async matrix(@Req() req: Request) {
    return this.access.matrix(await resolveCompanyId(this.prisma, req));
  }

  @Post('matrix')
  async upsertRule(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() body: any) {
    const auth = await asScopedAuth(this.prisma, user, req);
    return this.access.upsertRule(auth, auth.companyId, body);
  }

  @Delete('matrix/:id')
  async removeRule(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    const auth = await asScopedAuth(this.prisma, user, req);
    return this.access.removeRule(auth, auth.companyId, id);
  }

  @Get('exceptions')
  async exceptions(@Req() req: Request, @Query('userId') userId?: string) {
    return this.access.exceptions(await resolveCompanyId(this.prisma, req), userId || undefined);
  }

  @Post('exceptions')
  async createException(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() body: any) {
    const auth = await asScopedAuth(this.prisma, user, req);
    return this.access.createException(auth, auth.companyId, body);
  }

  @Delete('exceptions/:id')
  async removeException(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    const auth = await asScopedAuth(this.prisma, user, req);
    return this.access.removeException(auth, auth.companyId, id);
  }

  @Get('simulate/:userId')
  simulate(@Param('userId') userId: string) {
    return this.access.simulate(userId);
  }
}

@Public()
@Controller('platform-admin/orgnodes')
@PlatformAdminRequired()
export class PlatformAdminLegacyOrgNodesController {
  constructor(
    private readonly orgNodes: OrgNodesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@Req() req: Request) {
    return this.orgNodes.listFlat(await resolveCompanyId(this.prisma, req));
  }

  @Get('tree')
  async tree(@Req() req: Request) {
    return this.orgNodes.tree(await resolveCompanyId(this.prisma, req));
  }

  @Post()
  async create(@Req() req: Request, @Body() body: any) {
    const companyId = await resolveCompanyId(this.prisma, req, body?.companyId);
    return this.orgNodes.create(body, companyId);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.orgNodes.update(id, body, await resolveCompanyId(this.prisma, req));
  }

  @Patch(':id/move')
  async move(@Req() req: Request, @Param('id') id: string, @Body() body: { parentId?: string | null }) {
    return this.orgNodes.move(id, await resolveCompanyId(this.prisma, req), body?.parentId ?? null);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.orgNodes.remove(id, await resolveCompanyId(this.prisma, req));
  }
}

@Public()
@Controller('platform-admin/company-audit')
@PlatformAdminRequired('platform.audit_logs.view')
export class PlatformAdminLegacyCompanyAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('module') module?: string,
    @Query('userId') userId?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: companyAuditWhere(await resolveCompanyId(this.prisma, req), { entity, action, module, userId, q, from, to }),
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 500,
    });
  }

  @Get('exports/csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="auditoria-empresa.csv"')
  async exportCsv(@Req() req: Request, @Query('limit') limit?: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { companyId: await resolveCompanyId(this.prisma, req) },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 1000,
    });
    const header = ['data_hora', 'usuario', 'email', 'acao', 'modulo', 'entidade', 'registro', 'resultado', 'ip'];
    return [
      header.join(';'),
      ...rows.map((row) =>
        [
          row.createdAt.toISOString(),
          row.user?.name ?? '',
          row.user?.email ?? '',
          row.action,
          row.module ?? '',
          row.entity,
          row.entityId ?? '',
          row.result ?? '',
          row.ip ?? '',
        ].map(csvAuditValue).join(';'),
      ),
    ].join('\n');
  }
}

@Public()
@Controller('platform-admin/integrations/external')
@PlatformAdminRequired()
export class PlatformAdminLegacyExternalIntegrationsController {
  constructor(
    private readonly integrations: ExternalIntegrationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('keys')
  async listApiKeys(@Req() req: Request) {
    return this.integrations.listApiKeys(await resolveCompanyId(this.prisma, req));
  }

  @Post('keys')
  async createApiKey(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() body: any) {
    return this.integrations.createApiKey(await asScopedAuth(this.prisma, user, req), body);
  }

  @Delete('keys/:id')
  async revokeApiKey(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    return this.integrations.revokeApiKey(await asScopedAuth(this.prisma, user, req), id);
  }

  @Get()
  async list(@Req() req: Request) {
    return this.integrations.listConnectors(await resolveCompanyId(this.prisma, req));
  }

  @Post()
  async create(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() body: any) {
    return this.integrations.createConnector(await asScopedAuth(this.prisma, user, req), body);
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    return this.integrations.getConnector(await resolveCompanyId(this.prisma, req), id);
  }

  @Patch(':id')
  async update(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.integrations.updateConnector(await asScopedAuth(this.prisma, user, req), id, body);
  }

  @Delete(':id')
  async remove(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    return this.integrations.removeConnector(await asScopedAuth(this.prisma, user, req), id);
  }

  @Post(':id/test')
  async test(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    return this.integrations.testConnector(await asScopedAuth(this.prisma, user, req), id);
  }

  @Post(':id/run')
  async run(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() body: { operation: string }) {
    return this.integrations.runConnector(await asScopedAuth(this.prisma, user, req), id, body?.operation);
  }

  @Get(':id/logs')
  async logs(@Req() req: Request, @Param('id') id: string) {
    return this.integrations.listLogs(await resolveCompanyId(this.prisma, req), id);
  }
}

@Public()
@Controller('platform-admin/prize/eligible')
@PlatformAdminRequired()
export class PlatformAdminLegacyPrizeEligibleController {
  constructor(
    private readonly connectors: PrizeConnectorsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('connectors')
  async listConnectors(@Req() req: Request) {
    return this.connectors.list(await resolveCompanyId(this.prisma, req));
  }

  @Post('connectors')
  async createConnector(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() body: UpsertConnectorDto) {
    return this.connectors.upsert(await asScopedAuth(this.prisma, user, req), null, body);
  }

  @Patch('connectors/:id')
  async updateConnector(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() body: UpsertConnectorDto) {
    return this.connectors.upsert(await asScopedAuth(this.prisma, user, req), id, body);
  }

  @Delete('connectors/:id')
  async removeConnector(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    return this.connectors.remove(await asScopedAuth(this.prisma, user, req), id);
  }

  @Post('connectors/:id/test')
  async testConnector(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    return this.connectors.test(await asScopedAuth(this.prisma, user, req), id);
  }

  @Get('jobs')
  async jobs(@Req() req: Request, @Query('kind') kind?: string, @Query('competenceId') competenceId?: string) {
    return this.connectors.listJobs(await resolveCompanyId(this.prisma, req), kind, competenceId);
  }
}

@Public()
@Controller('platform-admin/lgpd')
@PlatformAdminRequired()
export class PlatformAdminLegacyLgpdController {
  constructor(
    private readonly lgpd: LgpdService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('overview')
  async overview(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request) {
    return this.lgpd.overview(await asScopedAuth(this.prisma, user, req));
  }

  @Get('processing-records')
  async listRecords(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request) {
    return this.lgpd.listProcessingRecords(await asScopedAuth(this.prisma, user, req));
  }

  @Post('processing-records')
  async createRecord(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() dto: UpsertProcessingRecordDto) {
    return this.lgpd.createProcessingRecord(await asScopedAuth(this.prisma, user, req), dto);
  }

  @Patch('processing-records/:id')
  async updateRecord(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() dto: UpsertProcessingRecordDto) {
    return this.lgpd.updateProcessingRecord(await asScopedAuth(this.prisma, user, req), id, dto);
  }

  @Delete('processing-records/:id')
  async removeRecord(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    return this.lgpd.removeProcessingRecord(await asScopedAuth(this.prisma, user, req), id);
  }

  @Get('subprocessors')
  async listSubprocessors(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request) {
    return this.lgpd.listSubprocessors(await asScopedAuth(this.prisma, user, req));
  }

  @Post('subprocessors')
  async createSubprocessor(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() dto: UpsertSubprocessorDto) {
    return this.lgpd.createSubprocessor(await asScopedAuth(this.prisma, user, req), dto);
  }

  @Patch('subprocessors/:id')
  async updateSubprocessor(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() dto: UpsertSubprocessorDto) {
    return this.lgpd.updateSubprocessor(await asScopedAuth(this.prisma, user, req), id, dto);
  }

  @Delete('subprocessors/:id')
  async removeSubprocessor(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    return this.lgpd.removeSubprocessor(await asScopedAuth(this.prisma, user, req), id);
  }

  @Get('incidents')
  async listIncidents(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request) {
    return this.lgpd.listIncidents(await asScopedAuth(this.prisma, user, req));
  }

  @Post('incidents')
  async createIncident(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() dto: UpsertDataIncidentDto) {
    return this.lgpd.createIncident(await asScopedAuth(this.prisma, user, req), dto);
  }

  @Patch('incidents/:id')
  async updateIncident(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() dto: UpsertDataIncidentDto) {
    return this.lgpd.updateIncident(await asScopedAuth(this.prisma, user, req), id, dto);
  }

  @Delete('incidents/:id')
  async removeIncident(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string) {
    return this.lgpd.removeIncident(await asScopedAuth(this.prisma, user, req), id);
  }
}

@Public()
@Controller('platform-admin/admin/help')
@PlatformAdminRequired()
export class PlatformAdminLegacyHelpController {
  constructor(
    private readonly help: HelpService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  content() {
    return this.help.adminContent();
  }

  @Post('categories')
  async upsertCategory(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.help.upsertCategory(body, await asScopedAuth(this.prisma, user, req));
  }

  @Put('categories/:id')
  async updateCategory(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.help.upsertCategory({ ...body, id }, await asScopedAuth(this.prisma, user, req));
  }

  @Post('articles')
  async upsertArticle(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.help.upsertArticle(body, await asScopedAuth(this.prisma, user, req));
  }

  @Put('articles/:id')
  async updateArticle(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.help.upsertArticle({ ...body, id }, await asScopedAuth(this.prisma, user, req));
  }

  @Post('articles/:id/status')
  async setStatus(@CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request, @Param('id') id: string, @Body() body: { status?: string }) {
    return this.help.setArticleStatus(id, body?.status ?? 'PUBLISHED', await asScopedAuth(this.prisma, user, req));
  }
}

@Public()
@Controller('platform-admin/admin/database')
@PlatformAdminRequired('platform.database.read')
export class PlatformAdminLegacyDatabaseController {
  constructor(
    private readonly overview: OverviewService,
    private readonly schema: SchemaInspectionService,
    private readonly diagnostics: DiagnosticsService,
    private readonly backup: BackupService,
    private readonly records: RecordManagementService,
    private readonly query: QueryExecutionService,
    private readonly structure: StructureService,
    private readonly exporter: ExportService,
    private readonly importer: ImportService,
    private readonly audit: DbAdminAuditService,
    private readonly settings: DbAdminSettingsService,
    private readonly pg: PostgreSQLAdapter,
  ) {}

  @Get('overview')
  getOverview() {
    return this.overview.getOverview();
  }

  @Get('tables')
  listTables() {
    return this.schema.listTables();
  }

  @Get('tables/:table/schema')
  async getTableSchema(@Param('table') table: string) {
    const allow = await this.schema.getAllowlist();
    assertInAllowlist(table, allow, 'tabela');
    const [columns, constraints, indexes] = await Promise.all([
      this.schema.getColumns(table),
      this.schema.getConstraints(table),
      this.schema.getIndexes(table),
    ]);
    return { table, catalog: getTableCatalogEntry(table), columns, constraints, indexes };
  }

  @Get('schema')
  async getSchema() {
    const [tables, relationships] = await Promise.all([
      this.schema.listTables(),
      this.schema.getRelationships(),
    ]);
    return { tables, relationships };
  }

  @Get('relationships')
  getRelationships() {
    return this.schema.getRelationships();
  }

  @Get('indexes')
  getIndexes(@Query('table') table?: string) {
    return this.schema.getIndexes(table || undefined);
  }

  @Get('diagnostics')
  @PlatformAdminRequired('platform.database.health')
  getDiagnostics() {
    return this.diagnostics.run();
  }

  @Post('diagnostics/run')
  @PlatformAdminRequired('platform.database.health')
  runDiagnostics() {
    return this.diagnostics.run();
  }

  @Get('settings')
  getSettings() {
    return this.settings.get();
  }

  @Put('settings')
  @PlatformAdminRequired('platform.environments.manage')
  setSettings(@Body() body: { key: string; value: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) {
    return this.settings.set(body?.key, body?.value ?? '', asAuthPayload(user));
  }

  @Get('audit')
  listAudit(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
    @Query('submenu') submenu?: string,
    @Query('action') action?: string,
    @Query('result') result?: string,
    @Query('targetTable') targetTable?: string,
    @Query('q') q?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.audit.list({ from, to, userId, submenu, action, result, targetTable, q, skip: skip ? parseInt(skip, 10) : undefined, take: take ? parseInt(take, 10) : undefined });
  }

  @Post('query/validate')
  validateQuery(@Body() body: { sql: string }) {
    return this.query.validate(body?.sql ?? '');
  }

  @Post('query/execute')
  @PlatformAdminRequired('platform.database.restore_request')
  executeQuery(@Body() body: { sql: string; mode?: 'safe' | 'advanced'; confirmationPhrase?: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request) {
    return this.query.execute(body?.sql ?? '', body?.mode === 'advanced' ? 'advanced' : 'safe', body?.confirmationPhrase, asAuthPayload(user), requestMeta(req));
  }

  @Post('query/explain')
  explainQuery(@Body() body: { sql: string }) {
    return this.query.explain(body?.sql ?? '');
  }

  @Get('query/history')
  queryHistory(@CurrentPlatformAdmin() user: PlatformAdminIdentity) {
    return this.query.listHistory(user.sub);
  }

  @Get('query/favorites')
  queryFavorites(@CurrentPlatformAdmin() user: PlatformAdminIdentity) {
    return this.query.listFavorites(user.sub);
  }

  @Post('query/favorites')
  @PlatformAdminRequired('platform.database.read')
  saveQueryFavorite(@Body() body: { name: string; sql: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) {
    return this.query.saveFavorite(user.sub, body?.name ?? 'Consulta', body?.sql ?? '');
  }

  @Delete('query/favorites/:id')
  @PlatformAdminRequired('platform.database.read')
  deleteQueryFavorite(@Param('id') id: string, @CurrentPlatformAdmin() user: PlatformAdminIdentity) {
    return this.query.deleteFavorite(user.sub, id);
  }

  @Post('structure/preview')
  previewStructure(@Body() body: { operation: string; params: Record<string, unknown> }) {
    return this.structure.plan(body?.operation, body?.params ?? {});
  }

  @Post('structure/execute')
  @PlatformAdminRequired('platform.database.restore_request')
  executeStructure(@Body() body: { operation: string; params: Record<string, unknown>; confirmationPhrase?: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request) {
    return this.structure.execute(body?.operation, body?.params ?? {}, body?.confirmationPhrase, asAuthPayload(user), requestMeta(req));
  }

  @Get('tables/:table/rows')
  listRows(@Param('table') table: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('sort') sort?: string, @Query('dir') dir?: string, @Query('search') search?: string, @Query('filters') filters?: string) {
    let parsedFilters: FilterCondition[] = [];
    if (filters) {
      try {
        const arr = JSON.parse(filters);
        if (Array.isArray(arr)) parsedFilters = arr;
      } catch {
        parsedFilters = [];
      }
    }
    return this.records.getRows(table, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      sort,
      dir: dir === 'desc' ? 'desc' : 'asc',
      search,
      filters: parsedFilters,
    });
  }

  @Post('tables/:table/rows')
  @PlatformAdminRequired('platform.database.restore_request')
  createRow(@Param('table') table: string, @Body() body: { values: Record<string, unknown> }, @CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request) {
    return this.records.insert(table, body?.values ?? {}, asAuthPayload(user), requestMeta(req));
  }

  @Patch('tables/:table/rows')
  @PlatformAdminRequired('platform.database.restore_request')
  updateRow(@Param('table') table: string, @Body() body: { key: Record<string, unknown>; values: Record<string, unknown> }, @CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request) {
    return this.records.update(table, body?.key ?? {}, body?.values ?? {}, asAuthPayload(user), requestMeta(req));
  }

  @Post('tables/:table/rows/delete')
  @PlatformAdminRequired('platform.database.restore_request')
  deleteRows(@Param('table') table: string, @Body() body: { keys: Record<string, unknown>[] }, @CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request) {
    return this.records.deleteRows(table, body?.keys ?? [], asAuthPayload(user), requestMeta(req));
  }

  @Post('export')
  @PlatformAdminRequired('platform.database.read')
  exportData(@Body() body: { table?: string; sql?: string; format: ExportFormat }, @CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request) {
    if (body?.sql) return this.exporter.exportQuery(body.sql, body.format, asAuthPayload(user), requestMeta(req));
    return this.exporter.exportTable(String(body?.table), body?.format ?? 'csv', asAuthPayload(user), requestMeta(req));
  }

  @Post('import/preview')
  previewImport(@Body() body: { table: string; format: ImportFormat; content: string }) {
    return this.importer.preview(body?.table, body?.format ?? 'csv', body?.content ?? '');
  }

  @Post('import/commit')
  @PlatformAdminRequired('platform.database.restore_request')
  commitImport(@Body() body: { table: string; format: ImportFormat; content: string; mapping?: Record<string, string>; strategy: ImportStrategy; keyColumns?: string[] }, @CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request) {
    return this.importer.commit(body?.table, body?.format ?? 'csv', body?.content ?? '', body?.mapping ?? {}, body?.strategy ?? 'insert', body?.keyColumns ?? [], asAuthPayload(user), requestMeta(req));
  }

  @Get('backups')
  @PlatformAdminRequired('platform.database.backup')
  listBackups() {
    return this.backup.list();
  }

  @Post('backups')
  @PlatformAdminRequired('platform.database.backup')
  async createBackup(@Body() body: { table: string; reason?: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) {
    const allow = await this.schema.getAllowlist();
    assertInAllowlist(String(body?.table), allow, 'tabela');
    const res = await this.pg.runReadOnly(`SELECT * FROM ${quoteIdent(body.table, 'tabela')} LIMIT ${DB_ADMIN_LIMITS.maxSnapshotRows}`);
    return this.backup.snapshot({
      table: body.table,
      rows: res.rows,
      type: 'MANUAL_LOGICAL',
      reason: body?.reason ?? 'Backup manual',
      userId: user.sub,
      userEmail: user.email,
      important: true,
    });
  }

  @Get('backups/:id/download')
  @PlatformAdminRequired('platform.database.backup')
  async downloadBackup(@Param('id') id: string) {
    const file = await this.backup.getFile(id);
    if (!file) throw new BadRequestException('Backup indisponivel ou arquivo ausente.');
    return file;
  }

  @Post('backups/:id/verify')
  @PlatformAdminRequired('platform.database.backup')
  verifyBackup(@Param('id') id: string) {
    return this.backup.verify(id);
  }

  @Post('backups/:id/important')
  @PlatformAdminRequired('platform.database.backup')
  importantBackup(@Param('id') id: string, @Body() body: { important: boolean }) {
    return this.backup.setImportant(id, Boolean(body?.important));
  }

  @Delete('backups/:id')
  @PlatformAdminRequired('platform.database.backup')
  removeBackup(@Param('id') id: string) {
    return this.backup.remove(id);
  }

  @Post('backups/:id/restore')
  @PlatformAdminRequired('platform.database.restore_request')
  async restoreBackup(@Param('id') id: string, @Body() body: { confirmationPhrase?: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity, @Req() req: Request) {
    if (body?.confirmationPhrase !== 'CONFIRMAR ALTERAÇÃO CRÍTICA') {
      throw new BadRequestException('Restauração exige a frase de confirmação: "CONFIRMAR ALTERAÇÃO CRÍTICA".');
    }
    const file = await this.backup.getFile(id);
    if (!file) throw new BadRequestException('Backup indisponivel.');
    const payload = JSON.parse(file.content) as { table: string; rows: Record<string, unknown>[] };
    if (!payload?.table || !Array.isArray(payload.rows)) throw new BadRequestException('Snapshot invalido.');
    const report = await this.importer.commit(payload.table, 'json', JSON.stringify(payload.rows), {}, 'ignoreDuplicates', [], asAuthPayload(user), requestMeta(req));
    return { restoredInto: payload.table, ...report };
  }
}

@Public()
@Controller('platform-admin/admin/portal')
@PlatformAdminRequired()
export class PlatformAdminLegacyPortalController {
  constructor(
    private readonly overview: PortalOverviewService,
    private readonly registry: RegistryService,
    private readonly flags: FeatureFlagService,
    private readonly audit: PortalAuditService,
    private readonly navigation: NavigationService,
    private readonly scope: ScopeService,
    private readonly maintenance: MaintenanceService,
    private readonly parameters: ParameterService,
    private readonly integrations: IntegrationService,
    private readonly announcements: AnnouncementService,
    private readonly snapshots: SnapshotService,
    private readonly diagnostics: PortalDiagnosticsService,
    private readonly permissions: PermissionViewService,
  ) {}

  @Get('overview') getOverview() { return this.overview.getOverview(); }
  @Post('registry/sync') sync(@CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.registry.sync(asAuthPayload(user)); }
  @Get('modules') listModules() { return this.registry.listModules(); }
  @Put('modules/:code') updateModule(@Param('code') code: string, @Body() body: Record<string, unknown>, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.registry.updateModule(code, body ?? {}, asAuthPayload(user)); }
  @Post('modules/:code/status') setModuleStatus(@Param('code') code: string, @Body() body: { status: string; confirmationPhrase?: string; reason?: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.registry.setModuleStatus(code, body?.status, { confirmationPhrase: body?.confirmationPhrase, reason: body?.reason }, asAuthPayload(user)); }
  @Post('modules/:code/enable') enableModule(@Param('code') code: string, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.registry.setModuleStatus(code, 'ACTIVE', {}, asAuthPayload(user)); }
  @Post('modules/:code/disable') disableModule(@Param('code') code: string, @Body() body: { confirmationPhrase?: string; reason?: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.registry.setModuleStatus(code, 'INACTIVE', { confirmationPhrase: body?.confirmationPhrase, reason: body?.reason }, asAuthPayload(user)); }
  @Post('modules/:code/maintenance') maintenanceModule(@Param('code') code: string, @Body() body: { confirmationPhrase?: string; reason?: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.registry.setModuleStatus(code, 'MAINTENANCE', { confirmationPhrase: body?.confirmationPhrase, reason: body?.reason }, asAuthPayload(user)); }
  @Get('pages') listPages() { return this.registry.listPages(); }
  @Post('pages/:code/status') setPageStatus(@Param('code') code: string, @Body() body: { status: string; confirmationPhrase?: string; reason?: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.registry.setPageStatus(code, body?.status, { confirmationPhrase: body?.confirmationPhrase, reason: body?.reason }, asAuthPayload(user)); }
  @Put('pages/:code') updatePage(@Param('code') code: string, @Body() body: Record<string, unknown>, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.registry.updatePage(code, body ?? {}, asAuthPayload(user)); }
  @Get('features') listFeatures() { return this.registry.listFeatures(); }
  @Post('features/:code/status') setFeatureStatus(@Param('code') code: string, @Body() body: { status: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.registry.setFeatureStatus(code, body?.status, asAuthPayload(user)); }
  @Put('features/:code') updateFeature(@Param('code') code: string, @Body() body: Record<string, unknown>, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.registry.updateFeature(code, body ?? {}, asAuthPayload(user)); }
  @Get('flags') listFlags() { return this.flags.list(); }
  @Put('flags') upsertFlag(@Body() body: Record<string, unknown>, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.flags.upsert(body as Parameters<FeatureFlagService['upsert']>[0], asAuthPayload(user)); }
  @Delete('flags/:key') deleteFlag(@Param('key') key: string, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.flags.remove(key, asAuthPayload(user)); }
  @Get('audit') auditLogs(@Query('from') from?: string, @Query('to') to?: string, @Query('tab') tab?: string, @Query('action') action?: string, @Query('result') result?: string, @Query('q') q?: string, @Query('skip') skip?: string, @Query('take') take?: string) { return this.audit.list({ from, to, tab, action, result, q, skip: skip ? parseInt(skip, 10) : undefined, take: take ? parseInt(take, 10) : undefined }); }
  @Get('navigation') navList() { return this.navigation.list(); }
  @Put('navigation') navUpsert(@Body() body: { itemKey: string; kind?: string; hidden?: boolean; order?: number | null; labelOverride?: string | null; iconOverride?: string | null; groupOverride?: string | null }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.navigation.upsert(body.itemKey, body, asAuthPayload(user)); }
  @Post('navigation/reorder') navReorder(@Body() body: { items: { itemKey: string; order: number }[] }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.navigation.reorder(body?.items ?? [], asAuthPayload(user)); }
  @Delete('navigation/:itemKey') navRemove(@Param('itemKey') key: string, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.navigation.remove(decodeURIComponent(key), asAuthPayload(user)); }
  @Get('scope') scopeList(@Query('targetType') targetType?: string, @Query('targetCode') targetCode?: string) { return this.scope.list(targetType, targetCode); }
  @Get('scope/options') scopeOptions() { return this.scope.options(); }
  @Post('scope') scopeCreate(@Body() body: { targetType: string; targetCode: string; scopeType: string; scopeId: string; effect?: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.scope.create(body, asAuthPayload(user)); }
  @Delete('scope/:id') scopeRemove(@Param('id') id: string, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.scope.remove(id, asAuthPayload(user)); }
  @Get('maintenance') maintList() { return this.maintenance.list(); }
  @Post('maintenance') maintCreate(@Body() body: Record<string, unknown>, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.maintenance.create(body, asAuthPayload(user)); }
  @Put('maintenance/:id') maintUpdate(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.maintenance.update(id, body, asAuthPayload(user)); }
  @Delete('maintenance/:id') maintCancel(@Param('id') id: string, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.maintenance.cancel(id, asAuthPayload(user)); }
  @Get('parameters') paramList() { return this.parameters.list(); }
  @Put('parameters') paramSet(@Body() body: { key: string; value: string; valueType?: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.parameters.set(body?.key, body?.value ?? '', body?.valueType ?? null, asAuthPayload(user)); }
  @Get('integrations') intList() { return this.integrations.list(); }
  @Post('integrations/:code/test') intTest(@Param('code') code: string, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.integrations.test(code, asAuthPayload(user)); }
  @Post('integrations/:code/status') intStatus(@Param('code') code: string, @Body() body: { status: 'enabled' | 'disabled' }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.integrations.setStatus(code, body?.status === 'disabled' ? 'disabled' : 'enabled', asAuthPayload(user)); }
  @Get('announcements') annList() { return this.announcements.list(); }
  @Post('announcements') annCreate(@Body() body: Record<string, unknown>, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.announcements.create(body, asAuthPayload(user)); }
  @Put('announcements/:id') annUpdate(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.announcements.update(id, body, asAuthPayload(user)); }
  @Delete('announcements/:id') annRemove(@Param('id') id: string, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.announcements.remove(id, asAuthPayload(user)); }
  @Get('snapshots') snapList() { return this.snapshots.list(); }
  @Post('snapshots') snapCreate(@Body() body: { label?: string; reason?: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.snapshots.create(body?.label ?? '', body?.reason ?? null, 'MANUAL', asAuthPayload(user)); }
  @Get('snapshots/:id/diff') snapDiff(@Param('id') id: string) { return this.snapshots.diff(id); }
  @Post('snapshots/:id/restore') snapRestore(@Param('id') id: string, @Body() body: { confirmationPhrase?: string }, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.snapshots.restore(id, body?.confirmationPhrase, asAuthPayload(user)); }
  @Delete('snapshots/:id') snapRemove(@Param('id') id: string, @CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.snapshots.remove(id, asAuthPayload(user)); }
  @Get('diagnostics') diagGet(@CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.diagnostics.run(asAuthPayload(user)); }
  @Post('diagnostics/run') diagRun(@CurrentPlatformAdmin() user: PlatformAdminIdentity) { return this.diagnostics.run(asAuthPayload(user)); }
  @Get('permissions') perms() { return this.permissions.overview(); }
}
