import { Module } from '@nestjs/common';
import { PersonnelModule } from '../personnel/personnel.module';
import { PayrollController } from './payroll.controller';
import { PayrollEsocialService } from './payroll-esocial.service';
import { PayrollLegalTablesService } from './legal-tables.service';
import { PayrollRunService } from './payroll-run.service';
import { PayrollObligationsService } from './payroll-obligations.service';

/**
 * Folha de Pagamento (docs/diagnostico-folha-pagamento.md). Reusa o colaborador
 * (OrgEmployee), o salário vigente (CompensationSalarySnapshot) e a apuração do
 * Controle de Ponto — nenhum cadastro paralelo.
 */
@Module({
  imports: [PersonnelModule],
  controllers: [PayrollController],
  providers: [PayrollLegalTablesService, PayrollRunService, PayrollEsocialService, PayrollObligationsService],
  exports: [PayrollRunService, PayrollLegalTablesService, PayrollEsocialService, PayrollObligationsService],
})
export class PayrollModule {}
