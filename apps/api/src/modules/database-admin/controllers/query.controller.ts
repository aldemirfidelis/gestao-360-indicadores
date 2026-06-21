import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
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
    return this.query.execute(
      body?.sql ?? '',
      body?.mode === 'advanced' ? 'advanced' : 'safe',
      body?.confirmationPhrase,
      user,
      { ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null },
    );
  }

  @Post('explain')
  explain(@Body() body: { sql: string }) {
    return this.query.explain(body?.sql ?? '');
  }

  @Get('history')
  history(@CurrentUser() user: AuthPayload) {
    return this.query.listHistory(user.sub);
  }

  @Get('favorites')
  favorites(@CurrentUser() user: AuthPayload) {
    return this.query.listFavorites(user.sub);
  }

  @Post('favorites')
  saveFavorite(@Body() body: { name: string; sql: string }, @CurrentUser() user: AuthPayload) {
    return this.query.saveFavorite(user.sub, body?.name ?? 'Consulta', body?.sql ?? '');
  }

  @Delete('favorites/:id')
  deleteFavorite(@Param('id') id: string, @CurrentUser() user: AuthPayload) {
    return this.query.deleteFavorite(user.sub, id);
  }
}
