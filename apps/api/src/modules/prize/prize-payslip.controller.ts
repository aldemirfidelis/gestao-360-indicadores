import { Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PrizePayslipService } from './prize-payslip.service';

@Controller('prize/payslips')
export class PrizePayslipController {
  constructor(private readonly service: PrizePayslipService) {}

  // --- Autoatendimento do colaborador (sem prize:view; escopo por matrícula) ---
  // Declaradas antes de @Get(':id') para não serem capturadas pela rota curinga.

  @Get('mine')
  myPayslips(@CurrentUser() me: AuthPayload) {
    return this.service.myPayslips(me);
  }

  @Get('mine/:id')
  myPayslip(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.myPayslip(me, id);
  }

  @Post('mine/:id/acknowledge')
  acknowledgeMine(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.acknowledgeMine(me, id);
  }

  @Get('competence/:competenceId')
  @RequirePermissions('prize:view')
  list(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.service.list(me.companyId, competenceId);
  }

  @Get(':id')
  @RequirePermissions('prize:view')
  get(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.get(me.companyId, id);
  }

  @Post('competence/:competenceId/generate')
  @RequirePermissions('prize:payslip:publish')
  generate(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.service.generate(me, competenceId);
  }

  @Post('competence/:competenceId/publish')
  @RequirePermissions('prize:payslip:publish')
  publishBatch(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.service.publishBatch(me, competenceId);
  }

  @Post(':id/publish')
  @RequirePermissions('prize:payslip:publish')
  publish(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.publish(me, id);
  }

  @Post(':id/acknowledge')
  @RequirePermissions('prize:view')
  acknowledge(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.acknowledge(me, id);
  }
}
