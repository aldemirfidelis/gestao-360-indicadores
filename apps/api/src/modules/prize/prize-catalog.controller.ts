import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { PrizeCatalogService } from './prize-catalog.service';

@Controller('prize/catalog')
export class PrizeCatalogController {
  constructor(private readonly service: PrizeCatalogService) {}

  @Get('areas')
  @RequirePermissions('prize:view')
  listAreas(@CurrentUser() me: AuthPayload) {
    return this.service.listAreas(me.companyId);
  }

  @Get('cargos')
  @RequirePermissions('prize:view')
  listCargos(@CurrentUser() me: AuthPayload) {
    return this.service.listCargos(me.companyId);
  }

  @Patch('areas/:id')
  @RequirePermissions('prize:eligible:manage')
  renameArea(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { name: string }) {
    return this.service.renameArea(me, id, body?.name);
  }

  @Patch('cargos/:id')
  @RequirePermissions('prize:eligible:manage')
  renameCargo(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: { name: string }) {
    return this.service.renameCargo(me, id, body?.name);
  }

  @Post('areas/merge')
  @RequirePermissions('prize:eligible:manage')
  mergeArea(@CurrentUser() me: AuthPayload, @Body() body: { targetId: string; sourceId: string }) {
    return this.service.mergeArea(me, body.targetId, body.sourceId);
  }

  @Post('cargos/merge')
  @RequirePermissions('prize:eligible:manage')
  mergeCargo(@CurrentUser() me: AuthPayload, @Body() body: { targetId: string; sourceId: string }) {
    return this.service.mergeCargo(me, body.targetId, body.sourceId);
  }

  @Post('import')
  @RequirePermissions('prize:eligible:manage')
  importCatalog(@CurrentUser() me: AuthPayload, @Body() body: { areas?: string[]; sectors?: string[]; cargos?: string[] }) {
    return this.service.importCatalog(me, body ?? {});
  }

  @Post('rebuild')
  @RequirePermissions('prize:eligible:manage')
  rebuild(@CurrentUser() me: AuthPayload) {
    return this.service.rebuildFromHistory(me);
  }
}
