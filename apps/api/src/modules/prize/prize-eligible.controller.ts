import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { FileImportPayload, ImportEligibleDto, PrizeEligibleService } from './prize-eligible.service';
import { PrizeConnectorsService, UpsertConnectorDto } from './prize-connectors.service';

@Controller('prize/eligible')
export class PrizeEligibleController {
  constructor(
    private readonly service: PrizeEligibleService,
    private readonly connectors: PrizeConnectorsService,
  ) {}

  // ----- base elegivel -----
  @Get('competence/:competenceId')
  @RequirePermissions('prize:view')
  snapshot(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.service.listSnapshot(me, competenceId);
  }

  @Get('competence/:competenceId/reconciliation')
  @RequirePermissions('prize:view')
  reconciliation(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.service.lastReconciliation(me.companyId, competenceId);
  }

  @Get('competence/:competenceId/events')
  @RequirePermissions('prize:view')
  events(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Query('registration') registration?: string) {
    return this.service.listEvents(me.companyId, competenceId, registration);
  }

  @Post('competence/:competenceId/import')
  @RequirePermissions('prize:eligible:manage')
  import(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Body() dto: ImportEligibleDto) {
    return this.service.import(me, competenceId, dto);
  }

  // ----- importacao manual por arquivo (CSV/XLSX) — contingencia do Apdata -----

  /** Valida e simula (dry-run): nada e gravado. */
  @Post('competence/:competenceId/import/preview')
  @RequirePermissions('prize:eligible:manage')
  importPreview(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Body() payload: FileImportPayload) {
    return this.service.previewImport(me, competenceId, payload);
  }

  /** Commit: revalida no servidor; rejeita o arquivo inteiro se houver erro. */
  @Post('competence/:competenceId/import/file')
  @RequirePermissions('prize:eligible:manage')
  importFile(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Body() payload: FileImportPayload) {
    return this.service.importFromFile(me, competenceId, payload);
  }

  /** Modelo XLSX (abas Colaboradores + Eventos + Instrucoes). */
  @Get('template')
  @RequirePermissions('prize:eligible:manage')
  async template(@Res() res: Response) {
    const buffer = await this.service.buildTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=modelo-base-elegivel.xlsx');
    res.send(buffer);
  }

  @Patch('employee/:snapshotId/eligibility')
  @RequirePermissions('prize:eligible:manage')
  setEligibility(@CurrentUser() me: AuthPayload, @Param('snapshotId') snapshotId: string, @Body() body: { eligible: boolean; justification: string }) {
    return this.service.setEligibility(me, snapshotId, body.eligible, body?.justification ?? '');
  }

  // ----- conectores -----
  @Get('connectors')
  @RequirePermissions('prize:view')
  listConnectors(@CurrentUser() me: AuthPayload) {
    return this.connectors.list(me.companyId);
  }

  @Post('connectors')
  @RequirePermissions('prize:admin')
  createConnector(@CurrentUser() me: AuthPayload, @Body() dto: UpsertConnectorDto) {
    return this.connectors.upsert(me, null, dto);
  }

  @Patch('connectors/:id')
  @RequirePermissions('prize:admin')
  updateConnector(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: UpsertConnectorDto) {
    return this.connectors.upsert(me, id, dto);
  }

  @Post('connectors/:id/test')
  @RequirePermissions('prize:admin')
  testConnector(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.connectors.test(me, id);
  }

  @Get('jobs')
  @RequirePermissions('prize:view')
  jobs(@CurrentUser() me: AuthPayload, @Query('kind') kind?: string, @Query('competenceId') competenceId?: string) {
    return this.connectors.listJobs(me.companyId, kind, competenceId);
  }
}
