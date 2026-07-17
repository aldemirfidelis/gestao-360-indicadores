import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PersonnelSettingsService } from './personnel-settings.service';

@Controller('personnel/settings')
export class PersonnelSettingsController {
  constructor(private readonly service: PersonnelSettingsService) {}

  @Get()
  @RequirePermissions('pessoal:view')
  get(@CurrentUser() me: AuthPayload) {
    return this.service.get(me.companyId);
  }

  @Get('registration-preview')
  @RequirePermissions('pessoal:view')
  preview(@CurrentUser() me: AuthPayload) {
    return this.service.previewNextRegistration(me.companyId);
  }

  @Patch()
  @RequirePermissions('pessoal:settings')
  update(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.update(me, body);
  }
}
