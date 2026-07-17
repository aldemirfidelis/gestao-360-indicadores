import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { UsersModule } from '../users/users.module';
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
import { LegalFilesService } from './legal-files.service';
import { PersonnelSettingsController } from './personnel-settings.controller';
import { PersonnelSettingsService } from './personnel-settings.service';

@Module({
  imports: [DocumentsModule, UsersModule],
  controllers: [PersonnelController, EmployeesController, VacationsController, LifecycleController, ReportsController, BiometricController, KioskController, PersonnelSettingsController],
  providers: [PersonnelService, EmployeesService, VacationService, LifecycleService, ReportsService, BiometricService, KioskService, TimeBankService, PayrollService, LegalFilesService, PersonnelSettingsService],
  exports: [PersonnelService, EmployeesService, VacationService, LifecycleService, ReportsService, TimeBankService, PersonnelSettingsService],
})
export class PersonnelModule {}
