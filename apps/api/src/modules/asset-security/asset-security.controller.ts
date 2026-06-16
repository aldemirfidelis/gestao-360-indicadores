import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PortalGate } from '../portal-admin/decorators/portal-gate.decorator';
import { Public } from '../auth/public.decorator';
import { AuthPayload } from '../auth/auth.types';
import { AssetSecurityService } from './asset-security.service';

@Controller('asset-security')
@PortalGate({ module: 'asset-security' })
export class AssetSecurityController {
  constructor(private readonly service: AssetSecurityService) {}

  @Get('summary')
  @RequirePermissions('asset-security:view')
  summary(@CurrentUser() me: AuthPayload, @Query('unitId') unitId?: string, @Query('gateId') gateId?: string) {
    return this.service.summary(me, { unitId, gateId });
  }

  @Get('options')
  @RequirePermissions('asset-security:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Get('package')
  @RequirePermissions('asset-security:manage')
  packageConfig(@CurrentUser() me: AuthPayload, @Query('unitId') unitId?: string) {
    return this.service.getPackage(me, unitId);
  }

  @Patch('package')
  @RequirePermissions('asset-security:manage')
  updatePackage(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.updatePackage(me, body);
  }

  @Get('gates')
  @RequirePermissions('asset-security:view')
  gates(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listGates(me, query);
  }

  @Post('gates')
  @RequirePermissions('asset-security:create')
  createGate(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createGate(me, body);
  }

  @Patch('gates/:id')
  @RequirePermissions('asset-security:update')
  updateGate(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateGate(me, id, body);
  }

  @Get('posts')
  @RequirePermissions('asset-security:view')
  posts(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listPosts(me, query);
  }

  @Post('posts')
  @RequirePermissions('asset-security:create')
  createPost(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createPost(me, body);
  }

  @Patch('posts/:id')
  @RequirePermissions('asset-security:update')
  updatePost(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updatePost(me, id, body);
  }

  @Get('people')
  @RequirePermissions('asset-security:view')
  people(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listPeople(me, query);
  }

  @Post('people')
  @RequirePermissions('asset-security:create')
  createPerson(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createPerson(me, body);
  }

  @Patch('people/:id')
  @RequirePermissions('asset-security:update')
  updatePerson(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updatePerson(me, id, body);
  }

  @Get('contractor-companies')
  @RequirePermissions('asset-security:view')
  contractorCompanies(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listContractorCompanies(me, query);
  }

  @Post('contractor-companies')
  @RequirePermissions('asset-security:create')
  createContractorCompany(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createContractorCompany(me, body);
  }

  @Patch('contractor-companies/:id')
  @RequirePermissions('asset-security:update')
  updateContractorCompany(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateContractorCompany(me, id, body);
  }

  @Get('vehicles')
  @RequirePermissions('asset-security:view')
  vehicles(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listVehicles(me, query);
  }

  @Post('vehicles')
  @RequirePermissions('asset-security:create')
  createVehicle(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createVehicle(me, body);
  }

  @Patch('vehicles/:id')
  @RequirePermissions('asset-security:update')
  updateVehicle(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateVehicle(me, id, body);
  }

  @Get('document-requirements')
  @RequirePermissions('asset-security:view')
  documentRequirements(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listDocumentRequirements(me, query);
  }

  @Post('document-requirements')
  @RequirePermissions('asset-security:manage')
  createDocumentRequirement(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createDocumentRequirement(me, body);
  }

  @Patch('document-requirements/:id')
  @RequirePermissions('asset-security:manage')
  updateDocumentRequirement(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateDocumentRequirement(me, id, body);
  }

  @Get('authorizations')
  @RequirePermissions('asset-security:view')
  authorizations(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listAuthorizations(me, query);
  }

  @Post('authorizations')
  @RequirePermissions('asset-security:authorize')
  createAuthorization(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createAuthorization(me, body);
  }

  @Patch('authorizations/:id')
  @RequirePermissions('asset-security:authorize')
  updateAuthorization(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateAuthorization(me, id, body);
  }

  @Post('authorizations/:id/approve')
  @RequirePermissions('asset-security:approve')
  approveAuthorization(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.decideAuthorization(me, id, 'APPROVED', body);
  }

  @Post('authorizations/:id/reject')
  @RequirePermissions('asset-security:approve')
  rejectAuthorization(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.decideAuthorization(me, id, 'REJECTED', body);
  }

  @Post('authorizations/:id/external-invite')
  @RequirePermissions('asset-security:authorize')
  createExternalInvite(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.createExternalInvite(me, id, body);
  }

  @Get('movements')
  @RequirePermissions('asset-security:view')
  movements(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listMovements(me, query);
  }

  @Get('present')
  @RequirePermissions('asset-security:view')
  present(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.present(me, query);
  }

  @Get('pending-exits')
  @RequirePermissions('asset-security:view')
  pendingExits(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.pendingExits(me, query);
  }

  @Get('emergency-report')
  @RequirePermissions('asset-security:emergency')
  emergencyReport(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.emergencyReport(me, query);
  }

  @Post('movements/entry')
  @RequirePermissions('asset-security:entry')
  registerEntry(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.registerEntry(me, body);
  }

  @Post('movements/exit')
  @RequirePermissions('asset-security:exit')
  registerExit(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.registerExit(me, body);
  }

  @Get('materials')
  @RequirePermissions('asset-security:view')
  materials(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listMaterials(me, query);
  }

  @Post('materials')
  @RequirePermissions('asset-security:update')
  createMaterialMovement(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createMaterialMovement(me, body);
  }

  @Patch('materials/:id')
  @RequirePermissions('asset-security:update')
  updateMaterialMovement(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateMaterialMovement(me, id, body);
  }

  @Get('custody-items')
  @RequirePermissions('asset-security:view')
  custodyItems(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listCustodyItems(me, query);
  }

  @Post('custody-items')
  @RequirePermissions('asset-security:update')
  createCustodyItem(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createCustodyItem(me, body);
  }

  @Patch('custody-items/:id')
  @RequirePermissions('asset-security:update')
  updateCustodyItem(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateCustodyItem(me, id, body);
  }

  @Post('custody-items/:id/loan')
  @RequirePermissions('asset-security:update')
  loanCustodyItem(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.loanCustodyItem(me, id, body);
  }

  @Post('custody-items/:id/return')
  @RequirePermissions('asset-security:update')
  returnCustodyItem(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.returnCustodyItem(me, id, body);
  }

  @Get('correspondences')
  @RequirePermissions('asset-security:view')
  correspondences(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listCorrespondences(me, query);
  }

  @Post('correspondences')
  @RequirePermissions('asset-security:update')
  createCorrespondence(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createCorrespondence(me, body);
  }

  @Patch('correspondences/:id')
  @RequirePermissions('asset-security:update')
  updateCorrespondence(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateCorrespondence(me, id, body);
  }

  @Post('correspondences/:id/pickup')
  @RequirePermissions('asset-security:update')
  pickupCorrespondence(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.pickupCorrespondence(me, id, body);
  }

  @Get('blocklist')
  @RequirePermissions('asset-security:view')
  blocklist(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listBlocklist(me, query);
  }

  @Post('blocklist')
  @RequirePermissions('asset-security:block')
  createBlocklist(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createBlocklist(me, body);
  }

  @Patch('blocklist/:id')
  @RequirePermissions('asset-security:block')
  updateBlocklist(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateBlocklist(me, id, body);
  }

  @Get('incidents')
  @RequirePermissions('asset-security:view')
  incidents(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listIncidents(me, query);
  }

  @Post('incidents')
  @RequirePermissions('asset-security:incident')
  createIncident(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createIncident(me, body);
  }

  @Patch('incidents/:id')
  @RequirePermissions('asset-security:incident')
  updateIncident(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateIncident(me, id, body);
  }

  @Post('incidents/:id/close')
  @RequirePermissions('asset-security:incident')
  closeIncident(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.closeIncident(me, id, body);
  }

  @Get('round-routes')
  @RequirePermissions('asset-security:view')
  roundRoutes(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listRoundRoutes(me, query);
  }

  @Post('round-routes')
  @RequirePermissions('asset-security:rounds')
  createRoundRoute(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createRoundRoute(me, body);
  }

  @Patch('round-routes/:id')
  @RequirePermissions('asset-security:rounds')
  updateRoundRoute(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateRoundRoute(me, id, body);
  }

  @Post('round-routes/:id/checkpoints')
  @RequirePermissions('asset-security:rounds')
  createRoundCheckpoint(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.createRoundCheckpoint(me, id, body);
  }

  @Get('round-executions')
  @RequirePermissions('asset-security:view')
  roundExecutions(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listRoundExecutions(me, query);
  }

  @Post('round-executions')
  @RequirePermissions('asset-security:rounds')
  createRoundExecution(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createRoundExecution(me, body);
  }

  @Patch('round-executions/:id')
  @RequirePermissions('asset-security:rounds')
  updateRoundExecution(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateRoundExecution(me, id, body);
  }

  @Post('round-executions/:id/visit')
  @RequirePermissions('asset-security:rounds')
  visitRoundCheckpoint(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.visitRoundCheckpoint(me, id, body);
  }

  @Post('round-executions/:id/finish')
  @RequirePermissions('asset-security:rounds')
  finishRoundExecution(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.finishRoundExecution(me, id, body);
  }

  @Get('shift-handovers')
  @RequirePermissions('asset-security:view')
  shiftHandovers(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listShiftHandovers(me, query);
  }

  @Post('shift-handovers')
  @RequirePermissions('asset-security:handover')
  createShiftHandover(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createShiftHandover(me, body);
  }

  @Patch('shift-handovers/:id')
  @RequirePermissions('asset-security:handover')
  updateShiftHandover(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateShiftHandover(me, id, body);
  }

  @Post('shift-handovers/:id/complete')
  @RequirePermissions('asset-security:handover')
  completeShiftHandover(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.completeShiftHandover(me, id, body);
  }

  @Get('logbook')
  @RequirePermissions('asset-security:view')
  logbook(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listLogbook(me, query);
  }

  @Post('logbook')
  @RequirePermissions('asset-security:update')
  createLogbookEntry(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createLogbookEntry(me, body);
  }

  @Get('qrcodes/validate/:token')
  @RequirePermissions('asset-security:qrcode')
  validateQr(@CurrentUser() me: AuthPayload, @Param('token') token: string) {
    return this.service.validateQr(me, token);
  }

  @Post('qrcodes')
  @RequirePermissions('asset-security:qrcode')
  createQr(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.createQr(me, body);
  }

  @Get('offline-sync')
  @RequirePermissions('asset-security:offline')
  offlineSyncs(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listOfflineSyncs(me, query);
  }

  @Post('offline-sync')
  @RequirePermissions('asset-security:offline')
  syncOffline(@CurrentUser() me: AuthPayload, @Body() body: Record<string, unknown>) {
    return this.service.syncOffline(me, body);
  }

  @Get('assistant-insights')
  @RequirePermissions('asset-security:view')
  assistantInsights(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.assistantInsights(me, query);
  }

  @Get('audit-logs')
  @RequirePermissions('asset-security:manage')
  auditLogs(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.service.listAuditLogs(me, query);
  }

  @Get('export')
  @RequirePermissions('asset-security:export')
  exportData(@CurrentUser() me: AuthPayload, @Query('dataset') dataset?: string, @Query() query?: Record<string, string | undefined>) {
    return this.service.exportData(me, dataset ?? 'movements', query ?? {});
  }

  @Public()
  @Get('external/:token')
  externalInvite(@Param('token') token: string) {
    return this.service.getExternalInvite(token);
  }

  @Public()
  @Patch('external/:token')
  submitExternalInvite(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.service.submitExternalInvite(token, body);
  }
}
