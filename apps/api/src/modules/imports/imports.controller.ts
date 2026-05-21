import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ImportTargetKind } from '@prisma/client';

@Controller('imports')
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Get('jobs')
  jobs(@CurrentUser() me: AuthPayload) {
    return this.service.listJobs(me.companyId);
  }

  @Get('jobs/:id/errors')
  errors(@Param('id') id: string) {
    return this.service.jobErrors(id);
  }

  @Post('preview')
  preview(
    @CurrentUser() me: AuthPayload,
    @Body() body: { target: ImportTargetKind; rows: { rowIndex: number; data: any }[] },
  ) {
    return this.service.preview(me.companyId, body.target, body.rows);
  }

  @Post('commit')
  commit(
    @CurrentUser() me: AuthPayload,
    @Body() body: { target: ImportTargetKind; fileName: string; rows: { rowIndex: number; data: any }[] },
  ) {
    return this.service.commit(me.companyId, body.target, body.fileName, body.rows);
  }
}
