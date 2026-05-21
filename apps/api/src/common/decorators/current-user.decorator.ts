import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthPayload } from '../../modules/auth/auth.types';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthPayload }>();
    return data ? request.user?.[data] : request.user;
  },
);
