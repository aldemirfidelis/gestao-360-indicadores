import { Module } from '@nestjs/common';
import { PersonnelModule } from '../personnel/personnel.module';
import { PayrollController } from './payroll.controller';
import { PayrollLegalTablesService } from './legal-tables.service';
import { PayrollRunService } from './payroll-run.service';

/**
 * Folha de Pagamento (docs/diagnostico-folha-pagamento.md). Reusa o colaborador
 * (OrgEmployee), o salário vigente (CompensationSalarySnapshot) e a apuração do
 * Controle de Ponto — nenhum cadastro paralelo.
 */
@Module({
  imports: [PersonnelModule],
  controllers: [PayrollController],
  providers: [PayrollLegalTablesService, PayrollRunService],
  exports: [PayrollRunService, PayrollLegalTablesService],
})
export class PayrollModule {}
