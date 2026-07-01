import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { LgpdService } from './lgpd.service';
import { UpsertDataIncidentDto, UpsertProcessingRecordDto, UpsertSubprocessorDto } from './lgpd.dto';

/**
 * Endpoints de privacidade/LGPD. Restrito ao SUPER_ADMIN (portal administrativo
 * global) — não deve ficar acessível ao usuário final da empresa. O isolamento
 * por empresa continua sendo feito no service (Super Admin opera na empresa ativa).
 */
@Controller('lgpd')
@Roles(UserRoleEnum.SUPER_ADMIN)
export class LgpdController {
  constructor(private readonly service: LgpdService) {}

  @Get('overview')
  overview(@CurrentUser() me: AuthPayload) {
    return this.service.overview(me);
  }

  // ----- RoPA -----
  @Get('processing-records')
  listRecords(@CurrentUser() me: AuthPayload) {
    return this.service.listProcessingRecords(me);
  }

  @Post('processing-records')
  createRecord(@CurrentUser() me: AuthPayload, @Body() dto: UpsertProcessingRecordDto) {
    return this.service.createProcessingRecord(me, dto);
  }

  @Patch('processing-records/:id')
  updateRecord(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: UpsertProcessingRecordDto) {
    return this.service.updateProcessingRecord(me, id, dto);
  }

  @Delete('processing-records/:id')
  removeRecord(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeProcessingRecord(me, id);
  }

  // ----- Suboperadores -----
  @Get('subprocessors')
  listSubprocessors(@CurrentUser() me: AuthPayload) {
    return this.service.listSubprocessors(me);
  }

  @Post('subprocessors')
  createSubprocessor(@CurrentUser() me: AuthPayload, @Body() dto: UpsertSubprocessorDto) {
    return this.service.createSubprocessor(me, dto);
  }

  @Patch('subprocessors/:id')
  updateSubprocessor(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: UpsertSubprocessorDto) {
    return this.service.updateSubprocessor(me, id, dto);
  }

  @Delete('subprocessors/:id')
  removeSubprocessor(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeSubprocessor(me, id);
  }

  // ----- Incidentes de dados -----
  @Get('incidents')
  listIncidents(@CurrentUser() me: AuthPayload) {
    return this.service.listIncidents(me);
  }

  @Post('incidents')
  createIncident(@CurrentUser() me: AuthPayload, @Body() dto: UpsertDataIncidentDto) {
    return this.service.createIncident(me, dto);
  }

  @Patch('incidents/:id')
  updateIncident(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: UpsertDataIncidentDto) {
    return this.service.updateIncident(me, id, dto);
  }

  @Delete('incidents/:id')
  removeIncident(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeIncident(me, id);
  }
}
