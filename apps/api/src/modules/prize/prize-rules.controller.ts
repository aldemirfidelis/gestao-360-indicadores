import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PrizeRuleAliasKind } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import {
  CatalogActualDto,
  PrizeRulesService,
  RuleAliasDto,
  RuleBandDto,
  RuleParameterDto,
  UpsertCatalogDto,
  UpsertRuleGroupDto,
  UpsertRuleIndicatorDto,
} from './prize-rules.service';

@Controller('prize/rules')
export class PrizeRulesController {
  constructor(private readonly service: PrizeRulesService) {}

  @Get('catalog')
  @RequirePermissions('prize:view')
  listCatalog(@CurrentUser() me: AuthPayload, @Query('q') q?: string, @Query('active') active?: string) {
    return this.service.listCatalog(me.companyId, { q, active });
  }

  @Post('catalog')
  @RequirePermissions('prize:indicators:manage')
  createCatalog(@CurrentUser() me: AuthPayload, @Body() dto: UpsertCatalogDto) {
    return this.service.createCatalog(me, dto);
  }

  @Patch('catalog/:id')
  @RequirePermissions('prize:indicators:manage')
  updateCatalog(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: UpsertCatalogDto) {
    return this.service.updateCatalog(me, id, dto);
  }

  @Get('groups')
  @RequirePermissions('prize:view')
  listGroups(
    @CurrentUser() me: AuthPayload,
    @Query('annexVersionId') annexVersionId?: string,
    @Query('programId') programId?: string,
  ) {
    return this.service.listGroups(me.companyId, { annexVersionId, programId });
  }

  @Post('groups')
  @RequirePermissions('prize:annex:manage')
  createGroup(@CurrentUser() me: AuthPayload, @Body() dto: UpsertRuleGroupDto) {
    return this.service.createGroup(me, dto);
  }

  @Patch('groups/:id')
  @RequirePermissions('prize:annex:manage')
  updateGroup(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: UpsertRuleGroupDto) {
    return this.service.updateGroup(me, id, dto);
  }

  @Delete('groups/:id')
  @RequirePermissions('prize:annex:manage')
  removeGroup(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeGroup(me, id);
  }

  @Post('groups/:groupId/indicators')
  @RequirePermissions('prize:indicators:manage')
  addRuleIndicator(@CurrentUser() me: AuthPayload, @Param('groupId') groupId: string, @Body() dto: UpsertRuleIndicatorDto) {
    return this.service.addRuleIndicator(me, groupId, dto);
  }

  @Patch('indicators/:id')
  @RequirePermissions('prize:indicators:manage')
  updateRuleIndicator(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: UpsertRuleIndicatorDto) {
    return this.service.updateRuleIndicator(me, id, dto);
  }

  @Delete('indicators/:id')
  @RequirePermissions('prize:indicators:manage')
  removeRuleIndicator(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.removeRuleIndicator(me, id);
  }

  @Post('indicators/:id/parameters')
  @RequirePermissions('prize:indicators:manage')
  setParameter(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: RuleParameterDto) {
    return this.service.setParameter(me, id, dto);
  }

  @Post('parameters/:id/bands/suggest')
  @RequirePermissions('prize:indicators:manage')
  suggestBands(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: { count?: number; decimals?: number }) {
    return this.service.suggestBands(me.companyId, id, dto ?? {});
  }

  @Post('parameters/:id/bands/bulk')
  @RequirePermissions('prize:indicators:manage')
  replaceBands(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { bands: RuleBandDto[] }) {
    return this.service.replaceBands(me, id, body?.bands ?? []);
  }

  @Get('competence/:competenceId/catalog-actuals')
  @RequirePermissions('prize:view')
  listCatalogActuals(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.service.listCatalogActuals(me.companyId, competenceId);
  }

  @Post('competence/:competenceId/catalog-actuals')
  @RequirePermissions('prize:actuals:manage')
  launchCatalogActual(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string, @Body() dto: CatalogActualDto) {
    return this.service.launchCatalogActual(me, competenceId, dto);
  }

  @Get('competence/:competenceId/cells')
  @RequirePermissions('prize:view')
  listCells(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.service.listCellResults(me.companyId, competenceId);
  }

  @Get('competence/:competenceId/unmatched')
  @RequirePermissions('prize:view')
  listUnmatched(@CurrentUser() me: AuthPayload, @Param('competenceId') competenceId: string) {
    return this.service.listUnmatched(me.companyId, competenceId);
  }

  @Get('aliases')
  @RequirePermissions('prize:view')
  listAliases(@CurrentUser() me: AuthPayload, @Query('kind') kind?: PrizeRuleAliasKind) {
    return this.service.listAliases(me.companyId, kind);
  }

  @Post('aliases')
  @RequirePermissions('prize:admin')
  upsertAlias(@CurrentUser() me: AuthPayload, @Body() dto: RuleAliasDto) {
    return this.service.upsertAlias(me, dto);
  }
}
