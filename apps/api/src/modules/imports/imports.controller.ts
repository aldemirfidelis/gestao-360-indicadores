import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ImportTargetKind } from '@prisma/client';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('imports')
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Get('jobs')
  @RequirePermissions('imports:view')
  jobs(@CurrentUser() me: AuthPayload) {
    return this.service.listJobs(me.companyId);
  }

  @Get('jobs/:id/errors')
  @RequirePermissions('imports:view')
  errors(@Param('id') id: string) {
    return this.service.jobErrors(id);
  }

  @Post('preview')
  @RequirePermissions('imports:create')
  preview(
    @CurrentUser() me: AuthPayload,
    @Body() body: { target: ImportTargetKind; rows: { rowIndex: number; data: any }[] },
  ) {
    return this.service.preview(me.companyId, body.target, body.rows);
  }

  @Post('commit')
  @RequirePermissions('imports:create')
  commit(
    @CurrentUser() me: AuthPayload,
    @Body() body: { target: ImportTargetKind; fileName: string; rows: { rowIndex: number; data: any }[] },
  ) {
    return this.service.commit(me.companyId, body.target, body.fileName, body.rows);
  }
}
