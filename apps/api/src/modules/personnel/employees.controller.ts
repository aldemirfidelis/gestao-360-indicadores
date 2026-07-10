import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { EmployeesService } from './employees.service';

@Controller('personnel/employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  @RequirePermissions('pessoal:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('search') search?: string,
    @Query('orgNodeId') orgNodeId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list(me, { search, orgNodeId, status });
  }

  @Get('options')
  @RequirePermissions('pessoal:view')
  options(@CurrentUser() me: AuthPayload) {
    return this.service.options(me);
  }

  @Post('import')
  @RequirePermissions('pessoal:manage')
  importEmployees(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.importEmployees(me, body);
  }

  @Post()
  @RequirePermissions('pessoal:create')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.create(me, body);
  }

  @Get(':id')
  @RequirePermissions('pessoal:view')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(me, id);
  }

  @Patch(':id')
  @RequirePermissions('pessoal:update')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.update(me, id, body);
  }

  @Post(':id/dependents')
  @RequirePermissions('pessoal:update')
  addDependent(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addDependent(me, id, body);
  }

  @Delete(':id/dependents/:dependentId')
  @RequirePermissions('pessoal:update')
  removeDependent(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('dependentId') dependentId: string) {
    return this.service.removeDependent(me, id, dependentId);
  }

  @Post(':id/events')
  @RequirePermissions('pessoal:update')
  addEvent(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addEvent(me, id, body);
  }

  @Post(':id/files')
  @RequirePermissions('pessoal:update')
  uploadFile(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.uploadDossierFile(me, id, body);
  }

  @Get(':id/files/:fileId/download')
  @RequirePermissions('pessoal:view')
  async downloadFile(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.downloadDossierFile(me, id, fileId);
    res.setHeader('content-type', result.mimeType);
    res.setHeader('content-disposition', `attachment; filename="${result.fileName}"`);
    return new StreamableFile(result.content);
  }

  @Delete(':id/files/:fileId')
  @RequirePermissions('pessoal:update')
  removeFile(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('fileId') fileId: string) {
    return this.service.removeDossierFile(me, id, fileId);
  }
}
