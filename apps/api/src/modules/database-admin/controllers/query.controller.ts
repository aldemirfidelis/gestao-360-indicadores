import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { Request } from 'express';
import { SuperAdminDbGuard } from '../guards/super-admin-db.guard';
import { DbAdminSubmenuTag } from '../decorators/db-admin-submenu.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { QueryExecutionService } from '../services/query-execution.service';

@Controller('admin/database/query')
@Roles(UserRoleEnum.SUPER_ADMIN)
@UseGuards(SuperAdminDbGuard)
@DbAdminSubmenuTag('query')
export class QueryController {
  constructor(private readonly query: QueryExecutionService) {}

  @Post('validate')
  validate(@Body() body: { sql: string }) {
    return this.query.validate(body?.sql ?? '');
  }

  @Post('execute')
  execute(
    @Body() body: { sql: string; mode?: 'safe' | 'advanced'; confirmationPhrase?: string },
    @CurrentUser() user: AuthPayload,
    @Req() req: Request,
  ) {
    void body;
    void user;
    void req;
    throw new ForbiddenException('Editor SQL livre desativado para garantir o escopo por empresa.');
  }

  @Post('explain')
  explain(@Body() body: { sql: string }) {
    void body;
    throw new ForbiddenException('Editor SQL livre desativado para garantir o escopo por empresa.');
  }

  @Get('history')
  history(@CurrentUser() user: AuthPayload) {
    void user;
    throw new ForbiddenException('Historico SQL indisponivel no escopo empresarial.');
  }

  @Get('favorites')
  favorites(@CurrentUser() user: AuthPayload) {
    void user;
    throw new ForbiddenException('Consultas SQL indisponiveis no escopo empresarial.');
  }

  @Post('favorites')
  saveFavorite(@Body() body: { name: string; sql: string }, @CurrentUser() user: AuthPayload) {
    void body;
    void user;
    throw new ForbiddenException('Consultas SQL indisponiveis no escopo empresarial.');
  }

  @Delete('favorites/:id')
  deleteFavorite(@Param('id') id: string, @CurrentUser() user: AuthPayload) {
    void id;
    void user;
    throw new ForbiddenException('Consultas SQL indisponiveis no escopo empresarial.');
  }
}
