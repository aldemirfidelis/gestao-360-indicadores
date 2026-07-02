import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { FoodSafetyService } from './food-safety.service';

@Controller('food-safety')
export class FoodSafetyController {
  constructor(private readonly service: FoodSafetyService) {}

  // ----- overview / opcoes -----
  @Get('summary')
  @RequirePermissions('fsms:view')
  summary(@CurrentUser() me: AuthPayload, @Query('programId') programId?: string) {
    return this.service.summary(me, programId);
  }

  @Get('options')
  @RequirePermissions('fsms:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  // ----- programas -----
  @Get('programs')
  @RequirePermissions('fsms:view')
  listPrograms(@CurrentUser() me: AuthPayload, @Query('status') status?: string, @Query('search') search?: string) {
    return this.service.listPrograms(me, { status, search });
  }

  @Get('programs/:id')
  @RequirePermissions('fsms:view')
  getProgram(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getProgram(me, id);
  }

  @Post('programs')
  @RequirePermissions('fsms:create')
  createProgram(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createProgram(me, body);
  }

  @Patch('programs/:id')
  @RequirePermissions('fsms:update')
  updateProgram(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateProgram(me, id, body);
  }

  @Delete('programs/:id')
  @RequirePermissions('fsms:delete')
  removeProgram(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeProgram(me, id);
  }

  // ----- processos -----
  @Get('processes')
  @RequirePermissions('fsms:view')
  listProcesses(
    @CurrentUser() me: AuthPayload,
    @Query('programId') programId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listProcesses(me, { programId, status, search });
  }

  @Get('processes/:id')
  @RequirePermissions('fsms:view')
  getProcess(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getProcess(me, id);
  }

  @Post('processes')
  @RequirePermissions('fsms:create')
  createProcess(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createProcess(me, body);
  }

  @Patch('processes/:id')
  @RequirePermissions('fsms:update')
  updateProcess(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateProcess(me, id, body);
  }

  @Delete('processes/:id')
  @RequirePermissions('fsms:delete')
  removeProcess(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeProcess(me, id);
  }

  // ----- etapas -----
  @Post('processes/:id/steps')
  @RequirePermissions('fsms:update')
  addStep(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addStep(me, id, body);
  }

  @Post('processes/:id/steps/bulk')
  @RequirePermissions('fsms:update')
  addStepsBulk(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addStepsBulk(me, id, body);
  }

  @Patch('steps/:stepId')
  @RequirePermissions('fsms:update')
  updateStep(@CurrentUser() me: AuthPayload, @Param('stepId') stepId: string, @Body() body: any) {
    return this.service.updateStep(me, stepId, body);
  }

  @Delete('steps/:stepId')
  @RequirePermissions('fsms:delete')
  removeStep(@CurrentUser() me: AuthPayload, @Param('stepId') stepId: string) {
    return this.service.removeStep(me, stepId);
  }

  // ----- modelos de fluxo (empresa) -----
  @Get('flow-templates')
  @RequirePermissions('fsms:view')
  listFlowTemplates(@CurrentUser() me: AuthPayload, @Query('includeInactive') includeInactive?: string) {
    return this.service.listFlowTemplates(me, { includeInactive });
  }

  @Post('flow-templates')
  @RequirePermissions('fsms:update')
  createFlowTemplate(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createFlowTemplate(me, body);
  }

  @Patch('flow-templates/:id')
  @RequirePermissions('fsms:update')
  updateFlowTemplate(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateFlowTemplate(me, id, body);
  }

  @Delete('flow-templates/:id')
  @RequirePermissions('fsms:delete')
  removeFlowTemplate(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeFlowTemplate(me, id);
  }

  @Get('flow-templates/:id/export')
  @RequirePermissions('fsms:view')
  exportFlowTemplate(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.exportFlowTemplate(me, id);
  }

  @Post('processes/:id/save-as-template')
  @RequirePermissions('fsms:update')
  saveProcessAsTemplate(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.saveProcessAsFlowTemplate(me, id, body);
  }

  // ----- matriz de risco -----
  @Get('risk-matrix')
  @RequirePermissions('fsms:view')
  getRiskMatrix(@CurrentUser() me: AuthPayload) {
    return this.service.getRiskMatrix(me);
  }

  @Patch('risk-matrix')
  @RequirePermissions('fsms:update')
  updateRiskMatrix(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.updateRiskMatrix(me, body);
  }

  // ----- perigos / APPCC -----
  @Get('hazards')
  @RequirePermissions('fsms:view')
  listHazards(
    @CurrentUser() me: AuthPayload,
    @Query('processId') processId?: string,
    @Query('stepId') stepId?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listHazards(me, { processId, stepId, category, status, search });
  }

  @Get('hazards/:id')
  @RequirePermissions('fsms:view')
  getHazard(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getHazard(me, id);
  }

  @Post('hazards')
  @RequirePermissions('fsms:create')
  createHazard(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createHazard(me, body);
  }

  @Patch('hazards/:id')
  @RequirePermissions('fsms:update')
  updateHazard(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateHazard(me, id, body);
  }

  @Delete('hazards/:id')
  @RequirePermissions('fsms:delete')
  removeHazard(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeHazard(me, id);
  }

  // ----- controle operacional (PPR/PPRO/PCC) -----
  @Get('control-plans')
  @RequirePermissions('fsms:view')
  listControlPlans(
    @CurrentUser() me: AuthPayload,
    @Query('hazardId') hazardId?: string,
    @Query('programId') programId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listControlPlans(me, { hazardId, programId, status });
  }

  @Get('control-plans/:id')
  @RequirePermissions('fsms:view')
  getControlPlan(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getControlPlan(me, id);
  }

  @Post('control-plans')
  @RequirePermissions('fsms:create')
  createControlPlan(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createControlPlan(me, body);
  }

  @Patch('control-plans/:id')
  @RequirePermissions('fsms:update')
  updateControlPlan(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateControlPlan(me, id, body);
  }

  @Delete('control-plans/:id')
  @RequirePermissions('fsms:delete')
  removeControlPlan(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeControlPlan(me, id);
  }

  @Get('control-plans/:id/records')
  @RequirePermissions('fsms:view')
  listRecords(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.listRecords(me, id);
  }

  @Post('control-plans/:id/records')
  @RequirePermissions('fsms:update')
  recordMonitoring(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.recordMonitoring(me, id, body);
  }

  // ----- compliance: normas, versoes, requisitos, avaliacoes -----
  @Get('standards')
  @RequirePermissions('fsms:view')
  listStandards(@CurrentUser() me: AuthPayload, @Query('search') search?: string) {
    return this.service.listStandards(me, { search });
  }

  @Post('standards')
  @RequirePermissions('fsms:create')
  createStandard(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createStandard(me, body);
  }

  @Patch('standards/:id')
  @RequirePermissions('fsms:update')
  updateStandard(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateStandard(me, id, body);
  }

  @Delete('standards/:id')
  @RequirePermissions('fsms:delete')
  removeStandard(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeStandard(me, id);
  }

  @Post('standard-versions')
  @RequirePermissions('fsms:create')
  createVersion(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createVersion(me, body);
  }

  @Patch('standard-versions/:id')
  @RequirePermissions('fsms:update')
  updateVersion(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateVersion(me, id, body);
  }

  @Delete('standard-versions/:id')
  @RequirePermissions('fsms:delete')
  removeVersion(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeVersion(me, id);
  }

  @Get('compliance-summary')
  @RequirePermissions('fsms:view')
  complianceSummary(@CurrentUser() me: AuthPayload, @Query('standardVersionId') standardVersionId?: string) {
    return this.service.complianceSummary(me, standardVersionId);
  }

  @Get('requirements')
  @RequirePermissions('fsms:view')
  listRequirements(
    @CurrentUser() me: AuthPayload,
    @Query('standardVersionId') standardVersionId?: string,
    @Query('result') result?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listRequirements(me, { standardVersionId, result, search });
  }

  @Post('requirements')
  @RequirePermissions('fsms:create')
  createRequirement(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createRequirement(me, body);
  }

  @Patch('requirements/:id')
  @RequirePermissions('fsms:update')
  updateRequirement(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateRequirement(me, id, body);
  }

  @Delete('requirements/:id')
  @RequirePermissions('fsms:delete')
  removeRequirement(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeRequirement(me, id);
  }

  @Post('requirements/:id/assess')
  @RequirePermissions('fsms:update')
  assessRequirement(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.assessRequirement(me, id, body);
  }

  // ----- cadeia: fornecedores, materiais, lotes, rastreabilidade e recall -----
  @Get('supply-chain-summary')
  @RequirePermissions('fsms:view')
  supplyChainSummary(@CurrentUser() me: AuthPayload, @Query('programId') programId?: string) {
    return this.service.supplyChainSummary(me, programId);
  }

  @Get('suppliers')
  @RequirePermissions('fsms:view')
  listSuppliers(
    @CurrentUser() me: AuthPayload,
    @Query('programId') programId?: string,
    @Query('status') status?: string,
    @Query('criticality') criticality?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listSuppliers(me, { programId, status, criticality, search });
  }

  @Post('suppliers')
  @RequirePermissions('fsms:create')
  createSupplier(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createSupplier(me, body);
  }

  @Patch('suppliers/:id')
  @RequirePermissions('fsms:update')
  updateSupplier(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateSupplier(me, id, body);
  }

  @Delete('suppliers/:id')
  @RequirePermissions('fsms:delete')
  removeSupplier(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeSupplier(me, id);
  }

  @Get('materials')
  @RequirePermissions('fsms:view')
  listMaterials(
    @CurrentUser() me: AuthPayload,
    @Query('programId') programId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listMaterials(me, { programId, supplierId, category, status, search });
  }

  @Post('materials')
  @RequirePermissions('fsms:create')
  createMaterial(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createMaterial(me, body);
  }

  @Patch('materials/:id')
  @RequirePermissions('fsms:update')
  updateMaterial(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateMaterial(me, id, body);
  }

  @Delete('materials/:id')
  @RequirePermissions('fsms:delete')
  removeMaterial(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeMaterial(me, id);
  }

  @Get('lots')
  @RequirePermissions('fsms:view')
  listLots(
    @CurrentUser() me: AuthPayload,
    @Query('programId') programId?: string,
    @Query('materialId') materialId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listLots(me, { programId, materialId, supplierId, type, status, search });
  }

  @Post('lots')
  @RequirePermissions('fsms:create')
  createLot(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createLot(me, body);
  }

  @Patch('lots/:id')
  @RequirePermissions('fsms:update')
  updateLot(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateLot(me, id, body);
  }

  @Delete('lots/:id')
  @RequirePermissions('fsms:delete')
  removeLot(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeLot(me, id);
  }

  @Get('lots/:id/trace')
  @RequirePermissions('fsms:view')
  traceLot(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Query('depth') depth?: string) {
    return this.service.traceLot(me, id, depth);
  }

  @Get('trace-links')
  @RequirePermissions('fsms:view')
  listTraceLinks(@CurrentUser() me: AuthPayload, @Query('lotId') lotId?: string, @Query('programId') programId?: string) {
    return this.service.listTraceLinks(me, { lotId, programId });
  }

  @Post('trace-links')
  @RequirePermissions('fsms:create')
  createTraceLink(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createTraceLink(me, body);
  }

  @Get('recalls')
  @RequirePermissions('fsms:view')
  listRecalls(@CurrentUser() me: AuthPayload, @Query('programId') programId?: string, @Query('status') status?: string, @Query('search') search?: string) {
    return this.service.listRecalls(me, { programId, status, search });
  }

  @Post('recalls')
  @RequirePermissions('fsms:create')
  createRecall(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createRecall(me, body);
  }

  @Patch('recalls/:id')
  @RequirePermissions('fsms:update')
  updateRecall(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateRecall(me, id, body);
  }

  @Post('recalls/:id/items')
  @RequirePermissions('fsms:create')
  addRecallItem(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addRecallItem(me, id, body);
  }

  @Patch('recall-items/:id')
  @RequirePermissions('fsms:update')
  updateRecallItem(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateRecallItem(me, id, body);
  }

  // ----- inteligencia executiva, score e import/export -----
  @Get('intelligence-dashboard')
  @RequirePermissions('fsms:view')
  intelligenceDashboard(@CurrentUser() me: AuthPayload, @Query('programId') programId?: string) {
    return this.service.intelligenceDashboard(me, programId);
  }

  @Get('supplier-scorecard')
  @RequirePermissions('fsms:view')
  supplierScorecard(@CurrentUser() me: AuthPayload, @Query('programId') programId?: string) {
    return this.service.supplierScorecard(me, programId);
  }

  @Get('assistant-insights')
  @RequirePermissions('fsms:view')
  assistantInsights(@CurrentUser() me: AuthPayload, @Query('programId') programId?: string) {
    return this.service.assistantInsights(me, programId);
  }

  @Get('export')
  @RequirePermissions('fsms:export')
  exportData(@CurrentUser() me: AuthPayload, @Query('dataset') dataset: string, @Query('programId') programId?: string) {
    return this.service.exportData(me, dataset, programId);
  }

  @Post('import')
  @RequirePermissions('fsms:create')
  importData(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.importData(me, body);
  }
}
