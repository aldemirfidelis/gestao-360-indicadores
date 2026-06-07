import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { PlatformAdminAuthGuard } from '../guards/platform-admin-auth.guard';

export const PLATFORM_PERMISSIONS_KEY = 'platform-admin:permissions';

export function PlatformAdminRequired(...permissions: string[]) {
  return applyDecorators(SetMetadata(PLATFORM_PERMISSIONS_KEY, permissions), UseGuards(PlatformAdminAuthGuard));
}
