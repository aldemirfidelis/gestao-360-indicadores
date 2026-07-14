import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { LifecycleController } from './lifecycle.controller';
import { LifecycleService } from './lifecycle.service';
import { PersonnelController } from './personnel.controller';
import { PersonnelService } from './personnel.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { BiometricController } from './biometric.controller';
import { BiometricService } from './biometric.service';
import { VacationService } from './vacation.service';
import { VacationsController } from './vacations.controller';
import { KioskController } from './kiosk.controller';
import { KioskService } from './kiosk.service';
import { TimeBankService } from './time-bank.service';
import { PayrollService } from './payroll.service';

@Module({
  imports: [DocumentsModule],
  controllers: [PersonnelController, EmployeesController, VacationsController, LifecycleController, ReportsController, BiometricController, KioskController],
  providers: [PersonnelService, EmployeesService, VacationService, LifecycleService, ReportsService, BiometricService, KioskService, TimeBankService, PayrollService],
  exports: [PersonnelService, EmployeesService, VacationService, LifecycleService, ReportsService, TimeBankService],
})
export class PersonnelModule {}
