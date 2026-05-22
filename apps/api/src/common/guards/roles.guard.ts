import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRoleEnum } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthPayload } from '../../modules/auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../../modules/auth/jwt-auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<UserRoleEnum[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const permissions = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest<{ user?: AuthPayload }>();
    const role = req.user?.role;
    const userId = req.user?.sub;
    if (!role || !userId) return false;

    if (required && required.length > 0 && !required.includes(role)) return false;
    if (!permissions || permissions.length === 0) return true;
    if (role === UserRoleEnum.SUPER_ADMIN) return true;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        permissions: { select: { permission: { select: { key: true } } } },
        accessProfile: {
          select: {
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    });
    const keys = new Set<string>();
    user?.permissions.forEach((item) => keys.add(item.permission.key));
    user?.accessProfile?.permissions.forEach((item) => keys.add(item.permission.key));
    if (role === UserRoleEnum.COMPANY_ADMIN && keys.size === 0) return true;
    return permissions.every((key) => keys.has(key));
  }
}
