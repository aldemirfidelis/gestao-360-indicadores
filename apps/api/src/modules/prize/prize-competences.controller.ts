import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PrizeCompetencesService, UpsertCompetenceDto } from './prize-competences.service';
import { PrizeSyncService } from './prize-sync.service';

@Controller('prize/competences')
export class PrizeCompetencesController {
  constructor(
    private readonly service: PrizeCompetencesService,
    private readonly sync: PrizeSyncService,
  ) {}

  /** Autopilot: sincroniza realizado da plataforma + checklist + (opcional) apuração. */
  @Post(':id/autopilot')
  @RequirePermissions('prize:calc:run')
  autopilot(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { runCalc?: boolean }) {
    return this.sync.autopilot(me, id, { runCalc: body?.runCalc ?? true });
  }

  @Get()
  @RequirePermissions('prize:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('programId') programId?: string,
    @Query('status') status?: string,
    @Query('year') year?: string,
  ) {
    return this.service.list(me.companyId, { programId, status, year: year ? Number(year) : undefined });
  }

  @Get(':id')
  @RequirePermissions('prize:view')
  get(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.get(me.companyId, id);
  }

  @Get(':id/checklist')
  @RequirePermissions('prize:view')
  checklist(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.checklist(me.companyId, id);
  }

  @Post()
  @RequirePermissions('prize:competences:manage')
  create(@CurrentUser() me: AuthPayload, @Body() dto: UpsertCompetenceDto) {
    return this.service.create(me, dto);
  }

  @Patch(':id')
  @RequirePermissions('prize:competences:manage')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: UpsertCompetenceDto) {
    return this.service.update(me, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('prize:competences:manage')
  transition(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { status: any }) {
    return this.service.transition(me, id, body.status);
  }

  @Post(':id/close')
  @RequirePermissions('prize:competences:close')
  close(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.close(me, id);
  }

  @Post(':id/reopen')
  @RequirePermissions('prize:competences:reopen')
  reopen(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { justification: string }) {
    return this.service.reopen(me, id, body?.justification ?? '');
  }
}
