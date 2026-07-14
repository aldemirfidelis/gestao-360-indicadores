import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
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
}
