import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { UserRoleEnum } from '@prisma/client';
import { SetStatusDto, UpdatePreferencesDto, UpdateProfileDto } from './profile.dto';

@Controller('communication')
export class ProfileController {
  constructor(private readonly service: ProfileService) {}

  @Get('users/:id/profile')
  getProfile(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getProfile(me.companyId, me.role === UserRoleEnum.SUPER_ADMIN, id);
  }

  @Get('me/preferences')
  getPreferences(@CurrentUser() me: AuthPayload) {
    return this.service.getPreferences(me.sub);
  }

  @Patch('me/profile')
  updateMyProfile(@CurrentUser() me: AuthPayload, @Body() dto: UpdateProfileDto) {
    return this.service.updateMyProfile(me.sub, dto);
  }

  @Patch('me/status')
  setMyStatus(@CurrentUser() me: AuthPayload, @Body() dto: SetStatusDto) {
    return this.service.setMyStatus(me.sub, dto.status);
  }

  @Patch('me/preferences')
  updatePreferences(@CurrentUser() me: AuthPayload, @Body() dto: UpdatePreferencesDto) {
    return this.service.updatePreferences(me.sub, dto);
  }
}
