import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get()
  list(@CurrentUser() me: AuthPayload) {
    return this.service.listForUser(me.sub);
  }

  @Put(':code/preference')
  preference(@CurrentUser() me: AuthPayload, @Param('code') code: string, @Body() body: { enabled?: boolean; config?: Record<string, unknown> }) {
    return this.service.setPreference(me.sub, code, body);
  }
}
