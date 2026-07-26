import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { Request } from 'express';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthPayload } from '../../auth/auth.types';

@Controller('admin/database/structure')
@Roles(UserRoleEnum.SUPER_ADMIN)
@UseGuards(SuperAdminDbGuard)
@DbAdminSubmenuTag('structure')
export class StructureController {
  /** Gera o SQL e a análise de risco SEM executar. */
  @Post('preview')
  preview(@Body() body: { operation: string; params: Record<string, unknown> }) {
    void body;
    throw new ForbiddenException('Alteracoes estruturais desativadas no escopo empresarial.');
  }

  @Post('execute')
  execute(
    @Body() body: { operation: string; params: Record<string, unknown>; confirmationPhrase?: string },
    @CurrentUser() user: AuthPayload,
    @Req() req: Request,
  ) {
    void body;
    void user;
    void req;
    throw new ForbiddenException('Alteracoes estruturais desativadas no escopo empresarial.');
  }
}
