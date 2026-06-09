import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
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

  @Get('assistant')
  assistant(@CurrentUser() me: AuthPayload) {
    return this.service.getAssistantSummary(me);
  }

  @Post('assistant/:key/hide')
  hideAssistant(@CurrentUser() me: AuthPayload, @Param('key') key: string) {
    return this.service.hideAssistantRecommendation(me, key);
  }

  @Post('assistant/:key/feedback')
  feedbackAssistant(@CurrentUser() me: AuthPayload, @Param('key') key: string, @Body() body: Record<string, any>) {
    return this.service.feedbackAssistantRecommendation(me, key, body);
  }

  @Get('items/:id')
  item(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getItem(me, id);
  }

  @Post('items/:id/action')
  action(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { action: string; justification?: string }) {
    return this.service.executeAction(me, id, body);
  }

  @Post('items/:id/follow')
  followItem(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.followItem(me, id, body);
  }

  @Delete('items/:id/follow')
  unfollowItem(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.unfollowItem(me, id);
  }

  @Get('follows')
  follows(@CurrentUser() me: AuthPayload) {
    return this.service.listFollows(me);
  }

  @Get('delegations')
  delegations(@CurrentUser() me: AuthPayload) {
    return this.service.listDelegations(me);
  }

  @Post('delegations')
  createDelegation(@CurrentUser() me: AuthPayload, @Body() body: Record<string, any>) {
    return this.service.createDelegation(me, body);
  }

  @Delete('delegations/:id')
  revokeDelegation(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.revokeDelegation(me, id);
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

  @Get('saved-filters')
  savedFilters(@CurrentUser() me: AuthPayload) {
    return this.service.listSavedFilters(me);
  }

  @Post('saved-filters')
  addSavedFilter(@CurrentUser() me: AuthPayload, @Body() body: Record<string, any>) {
    return this.service.addSavedFilter(me, body);
  }

  @Delete('saved-filters/:id')
  removeSavedFilter(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeSavedFilter(me, id);
  }
}
