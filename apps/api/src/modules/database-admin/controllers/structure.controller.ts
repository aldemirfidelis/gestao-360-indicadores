import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { Request } from 'express';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { StructureService } from '../services/structure.service';

@Controller('admin/database/structure')
@Roles(UserRoleEnum.SUPER_ADMIN)
@UseGuards(SuperAdminDbGuard)
@DbAdminSubmenuTag('structure')
export class StructureController {
  constructor(private readonly structure: StructureService) {}

  /** Gera o SQL e a análise de risco SEM executar. */
  @Post('preview')
  preview(@Body() body: { operation: string; params: Record<string, unknown> }) {
    return this.structure.plan(body?.operation, body?.params ?? {});
  }

  @Post('execute')
  execute(
    @Body() body: { operation: string; params: Record<string, unknown>; confirmationPhrase?: string },
    @CurrentUser() user: AuthPayload,
    @Req() req: Request,
  ) {
    return this.structure.execute(body?.operation, body?.params ?? {}, body?.confirmationPhrase, user, {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }
}
