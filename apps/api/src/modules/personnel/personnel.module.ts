import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { PersonnelController } from './personnel.controller';
import { PersonnelService } from './personnel.service';
import { VacationService } from './vacation.service';
import { VacationsController } from './vacations.controller';

@Module({
  imports: [DocumentsModule],
  controllers: [PersonnelController, EmployeesController, VacationsController],
  providers: [PersonnelService, EmployeesService, VacationService],
  exports: [PersonnelService, EmployeesService, VacationService],
})
export class PersonnelModule {}
