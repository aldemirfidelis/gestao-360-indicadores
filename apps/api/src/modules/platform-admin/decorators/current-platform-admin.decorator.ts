import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { PlatformAdminIdentity, PlatformAdminRequest } from '../platform-admin.types';

export const CurrentPlatformAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformAdminIdentity => {
    const req = ctx.switchToHttp().getRequest<Request & PlatformAdminRequest>();
    if (!req.platformAdmin) throw new Error('Platform admin identity missing from request');
    return req.platformAdmin;
  },
);
