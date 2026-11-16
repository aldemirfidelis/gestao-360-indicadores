import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthPayload } from '../auth/auth.types';
import { ProcessPmoService } from './process-pmo.service';

/** Rotas com dois segmentos para não colidir com GET /processes/:id. */
@Controller('processes')
export class ProcessPmoController {
  constructor(private readonly service: ProcessPmoService) {}

  @Get('governance/pmo')
  @RequirePermissions('processes:view')
  overview(@CurrentUser() me: AuthPayload) {
    return this.service.overview(me);
  }

  @Post(':id/projects')
  @RequirePermissions('processes:update')
  createImprovementProject(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: unknown) {
    return this.service.createImprovementProject(me, id, body);
  }
}
