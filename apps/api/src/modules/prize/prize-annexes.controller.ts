import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { CreateAnnexDto, PrizeAnnexesService, VersionDto } from './prize-annexes.service';

@Controller('prize/annexes')
export class PrizeAnnexesController {
  constructor(private readonly service: PrizeAnnexesService) {}

  @Get()
  @RequirePermissions('prize:view')
  list(@CurrentUser() me: AuthPayload, @Query('programId') programId?: string, @Query('q') q?: string) {
    return this.service.list(me.companyId, { programId, q });
  }

  @Get('compare')
  @RequirePermissions('prize:view')
  compare(@CurrentUser() me: AuthPayload, @Query('a') a: string, @Query('b') b: string) {
    return this.service.compareVersions(me.companyId, a, b);
  }

  @Get(':id')
  @RequirePermissions('prize:view')
  get(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.get(me.companyId, id);
  }

  @Post()
  @RequirePermissions('prize:annex:manage')
  create(@CurrentUser() me: AuthPayload, @Body() dto: CreateAnnexDto) {
    return this.service.create(me, dto);
  }

  @Post(':id/versions')
  @RequirePermissions('prize:annex:manage')
  createVersion(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { copyFromVersionId?: string }) {
    return this.service.createVersion(me, id, body?.copyFromVersionId);
  }

  @Patch('versions/:versionId')
  @RequirePermissions('prize:annex:manage')
  updateVersion(@CurrentUser() me: AuthPayload, @Param('versionId') versionId: string, @Body() dto: VersionDto) {
    return this.service.updateVersion(me, versionId, dto);
  }

  @Post('versions/:versionId/submit')
  @RequirePermissions('prize:annex:submit')
  submit(@CurrentUser() me: AuthPayload, @Param('versionId') versionId: string) {
    return this.service.submit(me, versionId);
  }

  @Post('versions/:versionId/send-approval')
  @RequirePermissions('prize:annex:submit')
  sendToApproval(
    @CurrentUser() me: AuthPayload,
    @Param('versionId') versionId: string,
    @Body() body: { approverUserId?: string | null; approverRole?: string | null },
  ) {
    return this.service.sendToApproval(me, versionId, body?.approverUserId, body?.approverRole);
  }

  @Post('versions/:versionId/decide')
  @RequirePermissions('prize:annex:approve')
  decide(
    @CurrentUser() me: AuthPayload,
    @Param('versionId') versionId: string,
    @Body() body: { decision: 'APPROVE' | 'REJECT' | 'RETURN'; comment?: string },
  ) {
    return this.service.decide(me, versionId, body.decision, body.comment);
  }

  @Post('versions/:versionId/publish')
  @RequirePermissions('prize:annex:approve')
  publish(@CurrentUser() me: AuthPayload, @Param('versionId') versionId: string) {
    return this.service.publish(me, versionId);
  }

  @Post('versions/:versionId/archive')
  @RequirePermissions('prize:annex:manage')
  archive(@CurrentUser() me: AuthPayload, @Param('versionId') versionId: string) {
    return this.service.archive(me, versionId);
  }
}
