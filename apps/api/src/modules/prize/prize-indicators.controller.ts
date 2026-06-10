import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { ParameterDto, PrizeIndicatorsService, RangeDto, UpsertIndicatorDto } from './prize-indicators.service';

@Controller('prize/indicators')
export class PrizeIndicatorsController {
  constructor(private readonly service: PrizeIndicatorsService) {}

  @Get()
  @RequirePermissions('prize:view')
  list(
    @CurrentUser() me: AuthPayload,
    @Query('programId') programId?: string,
    @Query('annexVersionId') annexVersionId?: string,
    @Query('kind') kind?: string,
    @Query('q') q?: string,
  ) {
    return this.service.list(me.companyId, { programId, annexVersionId, kind, q });
  }

  // Catalogo nativo p/ vinculo (reuso do modulo Indicadores). Antes de :id.
  @Get('platform-options')
  @RequirePermissions('prize:view')
  platformOptions(@CurrentUser() me: AuthPayload) {
    return this.service.listPlatformOptions(me.companyId);
  }

  @Get(':id')
  @RequirePermissions('prize:view')
  get(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.get(me.companyId, id);
  }

  @Post()
  @RequirePermissions('prize:indicators:manage')
  create(@CurrentUser() me: AuthPayload, @Body() dto: UpsertIndicatorDto) {
    return this.service.create(me, dto);
  }

  @Patch(':id')
  @RequirePermissions('prize:indicators:manage')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: UpsertIndicatorDto) {
    return this.service.update(me, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('prize:indicators:manage')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }

  @Post(':id/parameters')
  @RequirePermissions('prize:indicators:manage')
  setParameter(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: ParameterDto) {
    return this.service.setParameter(me, id, dto);
  }

  @Delete(':id/parameters/:parameterId')
  @RequirePermissions('prize:indicators:manage')
  removeParameter(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('parameterId') parameterId: string) {
    return this.service.removeParameter(me, id, parameterId);
  }

  @Post(':id/ranges')
  @RequirePermissions('prize:indicators:manage')
  setRange(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() dto: RangeDto) {
    return this.service.setRange(me, id, dto);
  }

  @Delete(':id/ranges/:rangeId')
  @RequirePermissions('prize:indicators:manage')
  removeRange(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('rangeId') rangeId: string) {
    return this.service.removeRange(me, id, rangeId);
  }
}
