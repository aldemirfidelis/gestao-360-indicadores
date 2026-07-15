import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PayrollEsocialService } from './payroll-esocial.service';
import { PayrollLegalTablesService } from './legal-tables.service';
import { PayrollRunService } from './payroll-run.service';

/**
 * Folha de Pagamento (Fase 1 — fundação). Segregação de funções por permissão:
 * folha:operate (importar/calcular) ≠ folha:approve (aprovar) ≠ folha:close
 * (fechar/reabrir) ≠ folha:params (rubricas e tabelas legais). Nenhuma rota
 * transmite nada a governo/banco — isso é fase 4/6, sempre com aprovação humana.
 */
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly runs: PayrollRunService,
    private readonly legalTables: PayrollLegalTablesService,
    private readonly esocial: PayrollEsocialService,
  ) {}

  // ------------------------------ competências ------------------------------

  @Get('competences')
  @RequirePermissions('folha:view')
  listCompetences(@CurrentUser() me: AuthPayload) {
    return this.runs.listCompetences(me);
  }

  @Post('competences')
  @RequirePermissions('folha:operate')
  createCompetence(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.runs.createCompetence(me, body);
  }

  // ------------------------------ processamentos ------------------------------

  @Post('runs')
  @RequirePermissions('folha:operate')
  createRun(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.runs.createRun(me, body);
  }

  @Get('runs/:id')
  @RequirePermissions('folha:operate')
  getRun(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.runs.getRun(me, id);
  }

  @Post('runs/:id/import-timekeeping')
  @RequirePermissions('folha:operate')
  importTimekeeping(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.runs.importTimekeeping(me, id);
  }

  @Post('runs/:id/calculate')
  @RequirePermissions('folha:operate')
  calculate(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.runs.calculate(me, id);
  }

  @Post('runs/:id/approve')
  @RequirePermissions('folha:approve')
  approve(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.runs.approve(me, id);
  }

  @Post('runs/:id/close')
  @RequirePermissions('folha:close')
  close(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.runs.close(me, id);
  }

  @Post('runs/:id/reopen')
  @RequirePermissions('folha:close')
  reopen(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.runs.reopen(me, id, body);
  }

  @Get('workers/:id/memory')
  @RequirePermissions('folha:operate')
  workerMemory(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.runs.workerMemory(me, id);
  }

  // ------------------------------ portal do colaborador ------------------------------

  @Get('my-payslips')
  listMyPayslips(@CurrentUser() me: AuthPayload) {
    return this.runs.listMyPayslips(me);
  }

  @Get('my-payslips/:id')
  getMyPayslipMemory(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.runs.getMyPayslipMemory(me, id);
  }

  // ------------------------------ rubricas e parâmetros legais ------------------------------

  @Get('rubrics')
  @RequirePermissions('folha:params')
  listRubrics(@CurrentUser() me: AuthPayload) {
    return this.runs.listRubrics(me);
  }

  @Get('legal-tables')
  @RequirePermissions('folha:params')
  listLegalTables(@CurrentUser() me: AuthPayload, @Query('kind') kind?: string) {
    return this.legalTables.list(me, kind);
  }

  @Post('legal-tables')
  @RequirePermissions('folha:params')
  createLegalTable(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.legalTables.createVersion(me, body);
  }

  // ------------------------------ Férias (fonte: Serviço Pessoal) ------------------------------

  @Get('vacations')
  @RequirePermissions('folha:view')
  listVacations(@CurrentUser() me: AuthPayload) {
    return this.runs.listVacations(me);
  }

  /** Ajusta abono pecuniário / antecipação de 13º de uma férias já aprovada no DP. */
  @Post('vacations/payroll-inputs')
  @RequirePermissions('folha:operate')
  setVacationPayrollInputs(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.runs.setVacationPayrollInputs(me, body);
  }

  // ------------------------------ Rescisões ------------------------------

  @Get('terminations')
  @RequirePermissions('folha:view')
  listTerminations(@CurrentUser() me: AuthPayload) {
    return this.runs.listTerminations(me);
  }

  @Post('terminations')
  @RequirePermissions('folha:operate')
  createTermination(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.runs.createTermination(me, body);
  }

  // ------------------------------ Benefícios e Descontos ------------------------------

  @Get('benefits')
  @RequirePermissions('folha:view')
  listBenefits(@CurrentUser() me: AuthPayload) {
    return this.runs.listBenefits(me);
  }

  @Post('benefits')
  @RequirePermissions('folha:params')
  createBenefit(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.runs.createBenefit(me, body);
  }

  @Post('benefits/enroll')
  @RequirePermissions('folha:operate')
  enrollBenefit(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.runs.enrollBenefit(me, body);
  }

  @Get('loans')
  @RequirePermissions('folha:view')
  listLoans(@CurrentUser() me: AuthPayload) {
    return this.runs.listLoans(me);
  }

  @Post('loans')
  @RequirePermissions('folha:operate')
  createLoan(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.runs.createLoan(me, body);
  }

  @Get('pensions')
  @RequirePermissions('folha:view')
  listPensions(@CurrentUser() me: AuthPayload) {
    return this.runs.listPensions(me);
  }

  @Post('pensions')
  @RequirePermissions('folha:operate')
  createPension(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.runs.createPension(me, body);
  }

  // ------------------------------ Fase 4: eSocial + certificados ------------------------------

  @Get('digital-certificates')
  @RequirePermissions('folha:esocial')
  listDigitalCertificates(@CurrentUser() me: AuthPayload) {
    return this.esocial.listCertificates(me);
  }

  @Post('digital-certificates')
  @RequirePermissions('folha:esocial')
  createDigitalCertificate(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.esocial.createCertificate(me, body);
  }

  /** Upload do .pfx com custódia cifrada (AES-256-GCM). O segredo é enviado via TLS e nunca volta. */
  @Post('digital-certificates/upload')
  @RequirePermissions('folha:esocial')
  uploadDigitalCertificate(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.esocial.uploadCertificate(me, body);
  }

  @Post('digital-certificates/:id/test')
  @RequirePermissions('folha:esocial')
  testDigitalCertificate(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.esocial.testCertificate(me, id);
  }

  @Get('esocial/events')
  @RequirePermissions('folha:esocial')
  listEsocialEvents(@CurrentUser() me: AuthPayload, @Query('runId') runId?: string) {
    return this.esocial.listEvents(me, runId);
  }

  @Post('runs/:id/esocial/events')
  @RequirePermissions('folha:esocial')
  generateEsocialEvents(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.esocial.generateRunEvents(me, id, body);
  }

  @Post('runs/:id/esocial/rubric-table')
  @RequirePermissions('folha:esocial')
  generateEsocialRubricTable(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.esocial.generateRubricTableEvent(me, id, body);
  }

  @Post('runs/:id/esocial/closing')
  @RequirePermissions('folha:esocial')
  generateEsocialClosing(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.esocial.generateClosingEvent(me, id, body);
  }

  @Post('runs/:id/esocial/admission')
  @RequirePermissions('folha:esocial')
  generateEsocialAdmission(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.esocial.generateAdmissionEvents(me, id, body);
  }

  @Post('runs/:id/esocial/payments')
  @RequirePermissions('folha:esocial')
  generateEsocialPayments(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.esocial.generatePaymentEvents(me, id, body);
  }

  @Post('runs/:id/esocial/reconcile')
  @RequirePermissions('folha:esocial')
  reconcileEsocialTotalizers(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.esocial.reconcileTotalizers(me, id, body);
  }

  /** Valida os eventos do processamento contra os XSDs oficiais (pasta configurada). */
  @Post('runs/:id/esocial/validate-xsd')
  @RequirePermissions('folha:esocial')
  validateEsocialXsd(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.esocial.validateRunEventsXsd(me, id);
  }

  @Get('esocial/batches')
  @RequirePermissions('folha:esocial')
  listEsocialBatches(@CurrentUser() me: AuthPayload, @Query('runId') runId?: string) {
    return this.esocial.listBatches(me, runId);
  }

  @Post('esocial/batches')
  @RequirePermissions('folha:esocial')
  createEsocialBatch(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.esocial.createBatch(me, body);
  }

  @Post('esocial/batches/:id/sign')
  @RequirePermissions('folha:esocial')
  signEsocialBatch(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.esocial.signBatch(me, id);
  }

  /** Transmite o lote assinado (dry-run por padrão; envio real atrás de flag + confirm). */
  @Post('esocial/batches/:id/transmit')
  @RequirePermissions('folha:esocial')
  transmitEsocialBatch(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.esocial.transmitBatch(me, id, body);
  }

  @Post('esocial/batches/:id/query')
  @RequirePermissions('folha:esocial')
  queryEsocialBatch(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.esocial.queryBatch(me, id, body);
  }

  @Get('esocial/batches/:id/xml')
  @RequirePermissions('folha:esocial')
  esocialBatchXml(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.esocial.batchXml(me, id);
  }
}
