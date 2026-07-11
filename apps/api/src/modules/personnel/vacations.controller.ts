import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { VacationService } from './vacation.service';

@Controller('personnel')
export class VacationsController {
  constructor(private readonly service: VacationService) {}

  // ---------------- Autoatendimento (qualquer usuário autenticado) ----------------

  @Get('vacations/me')
  myOverview(@CurrentUser() me: AuthPayload) {
    return this.service.myOverview(me);
  }

  @Post('vacations/me')
  createMyRequest(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createMyRequest(me, body);
  }

  @Post('vacations/me/:id/cancel')
  cancelMyRequest(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.cancelMyRequest(me, id);
  }

  // ---------------- Gestão (DP) ----------------

  @Get('vacations/balances')
  @RequirePermissions('pessoal:view')
  balances(@CurrentUser() me: AuthPayload) {
    return this.service.balances(me);
  }

  @Get('vacations')
  @RequirePermissions('pessoal:view')
  listRequests(@CurrentUser() me: AuthPayload, @Query('status') status?: string) {
    return this.service.listRequests(me, { status });
  }

  @Post('vacations')
  @RequirePermissions('pessoal:update')
  createRequest(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createRequest(me, body);
  }

  @Post('vacations/:id/approve')
  @RequirePermissions('pessoal:update')
  approveRequest(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.approveRequest(me, id, body);
  }

  @Post('vacations/:id/reject')
  @RequirePermissions('pessoal:update')
  rejectRequest(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.rejectRequest(me, id, body);
  }

  @Post('vacations/:id/cancel')
  @RequirePermissions('pessoal:update')
  cancelRequest(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.cancelRequest(me, id);
  }

  // ---------------- Afastamentos ----------------

  @Get('leaves')
  @RequirePermissions('pessoal:view')
  listLeaves(@CurrentUser() me: AuthPayload, @Query('employeeId') employeeId?: string, @Query('active') active?: string) {
    return this.service.listLeaves(me, { employeeId, active });
  }

  @Post('leaves')
  @RequirePermissions('pessoal:update')
  createLeave(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.createLeave(me, body);
  }

  @Post('leaves/:id/close')
  @RequirePermissions('pessoal:update')
  closeLeave(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.closeLeave(me, id, body);
  }

  @Delete('leaves/:id')
  @RequirePermissions('pessoal:update')
  removeLeave(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeLeave(me, id);
  }
}
