import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ProfileService } from './profile/profile.service';
import { UpdateProfileDto } from './profile/profile.dto';

// Perfil próprio é infraestrutura de autenticação, não depende do módulo de chat.
@Controller('profile')
export class ProfileInfrastructureController {
  constructor(private readonly service: ProfileService) {}
  @Get('me')
  me(@CurrentUser() me: AuthPayload) {
    return this.service.getProfile(me.companyId, me.sub, me.sub);
  }
  @Patch('me')
  update(@CurrentUser() me: AuthPayload, @Body() dto: UpdateProfileDto) {
    return this.service.updateMyProfile(me.sub, dto);
  }
}
