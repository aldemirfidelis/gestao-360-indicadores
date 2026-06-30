import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { IntegrationsService } from './integrations.service';

/** Catálogo de conectores internos — SOMENTE Super Admin (acessível pelo Portal Admin Global). */
@Controller('integrations')
@Roles(UserRoleEnum.SUPER_ADMIN)
@RequirePermissions('integrations:view')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get()
  list(@CurrentUser() me: AuthPayload) {
    return this.service.listForUser(me.sub);
  }

  @Put(':code/preference')
  @RequirePermissions('integrations:manage')
  preference(@CurrentUser() me: AuthPayload, @Param('code') code: string, @Body() body: { enabled?: boolean; config?: Record<string, unknown> }) {
    return this.service.setPreference(me.sub, code, body);
  }
}
