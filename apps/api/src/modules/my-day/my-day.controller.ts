import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { MyDayService, MyDayItemsQuery } from './my-day.service';
import { MyDayTeamService, TeamItemsQuery } from './my-day-team.service';

/**
 * Central de Trabalho "Meu Dia". Landing universal: qualquer usuario autenticado
 * ve a propria caixa de entrada (itens ja atribuidos a ele). Acoes de servidor
 * sao validadas pela posse do item + servico do modulo de origem.
 */
@Controller('my-day')
export class MyDayController {
  constructor(
    private readonly service: MyDayService,
    private readonly team: MyDayTeamService,
  ) {}

  // ----- Meu Dia da Equipe (gestores) -----
  @Get('team')
  teamOverview(@CurrentUser() me: AuthPayload) {
    return this.team.getOverview(me);
  }

  @Get('team/summary')
  teamSummary(@CurrentUser() me: AuthPayload) {
    return this.team.getSummary(me);
  }

  @Get('team/items')
  teamItems(@CurrentUser() me: AuthPayload, @Query() query: TeamItemsQuery) {
    return this.team.getItems(me, query);
  }

  @Get('team/workload')
  teamWorkload(@CurrentUser() me: AuthPayload) {
    return this.team.getWorkload(me);
  }

  @Get('team/bottlenecks')
  teamBottlenecks(@CurrentUser() me: AuthPayload) {
    return this.team.getBottlenecks(me);
  }

  @Get()
  overview(@CurrentUser() me: AuthPayload) {
    return this.service.getOverview(me);
  }

  @Get('summary')
  summary(@CurrentUser() me: AuthPayload) {
    return this.service.getSummary(me);
  }

  @Get('items')
  items(@CurrentUser() me: AuthPayload, @Query() query: MyDayItemsQuery) {
    return this.service.getItems(me, query);
  }

  @Get('items/:id')
  item(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getItem(me, id);
  }

  @Post('items/:id/action')
  action(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { action: string; justification?: string }) {
    return this.service.executeAction(me, id, body);
  }

  @Post('refresh')
  async refresh(@CurrentUser() me: AuthPayload) {
    await this.service.ensureFresh(me, true);
    return { ok: true };
  }

  @Get('preferences')
  preferences(@CurrentUser() me: AuthPayload) {
    return this.service.getPreferences(me);
  }

  @Put('preferences')
  setPreferences(@CurrentUser() me: AuthPayload, @Body() body: Record<string, any>) {
    return this.service.setPreferences(me, body);
  }
}
