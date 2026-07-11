import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { LifecycleController } from './lifecycle.controller';
import { LifecycleService } from './lifecycle.service';
import { PersonnelController } from './personnel.controller';
import { PersonnelService } from './personnel.service';
import { VacationService } from './vacation.service';
import { VacationsController } from './vacations.controller';

@Module({
  imports: [DocumentsModule],
  controllers: [PersonnelController, EmployeesController, VacationsController, LifecycleController],
  providers: [PersonnelService, EmployeesService, VacationService, LifecycleService],
  exports: [PersonnelService, EmployeesService, VacationService, LifecycleService],
})
export class PersonnelModule {}
