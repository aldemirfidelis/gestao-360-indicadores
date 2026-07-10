import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { PersonnelController } from './personnel.controller';
import { PersonnelService } from './personnel.service';

@Module({
  imports: [DocumentsModule],
  controllers: [PersonnelController, EmployeesController],
  providers: [PersonnelService, EmployeesService],
  exports: [PersonnelService, EmployeesService],
})
export class PersonnelModule {}
