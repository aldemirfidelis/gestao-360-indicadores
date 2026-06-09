import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PrizeProgramsService, UpsertProgramDto } from './prize-programs.service';

@Controller('prize/programs')
export class PrizeProgramsController {
  constructor(private readonly service: PrizeProgramsService) {}

  @Get()
  @RequirePermissions('prize:view')
  list(@CurrentUser() me: AuthPayload, @Query('status') status?: string, @Query('q') q?: string) {
    return this.service.list(me.companyId, { status, q });
  }

  @Get(':id')
  @RequirePermissions('prize:view')
  get(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.get(me.companyId, id);
  }

  @Post()
  @RequirePermissions('prize:programs:manage')
  create(@CurrentUser() me: AuthPayload, @Body() dto: UpsertProgramDto) {
    return this.service.create(me, dto);
  }

  @Patch(':id')
  @RequirePermissions('prize:programs:manage')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: UpsertProgramDto) {
    return this.service.update(me, id, dto);
  }

  @Post(':id/duplicate')
  @RequirePermissions('prize:programs:manage')
  duplicate(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.duplicate(me, id);
  }

  @Patch(':id/status')
  @RequirePermissions('prize:programs:manage')
  setStatus(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { status: any }) {
    return this.service.setStatus(me, id, body.status);
  }

  @Delete(':id')
  @RequirePermissions('prize:programs:manage')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }
}
