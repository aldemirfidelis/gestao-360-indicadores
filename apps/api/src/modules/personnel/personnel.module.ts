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
import { VacationService } from './vacation.service';
import { VacationsController } from './vacations.controller';

@Module({
  imports: [DocumentsModule],
  controllers: [PersonnelController, EmployeesController, VacationsController, LifecycleController, ReportsController],
  providers: [PersonnelService, EmployeesService, VacationService, LifecycleService, ReportsService],
  exports: [PersonnelService, EmployeesService, VacationService, LifecycleService, ReportsService],
})
export class PersonnelModule {}
