import { Controller, Get, Query } from '@nestjs/common';
import { DirectoryService } from './directory.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { AuthPayload } from '../../auth/auth.types';

/**
 * Diretório Global de Usuários. Disponível a qualquer usuário autenticado
 * (sem permissão específica) — todo usuário ativo aparece automaticamente.
 * O Super Admin pode ocultar/colocar em manutenção o módulo via Central do Portal.
 */
@Controller('communication/directory')
@RequirePermissions('directory:view')
export class DirectoryController {
  constructor(private readonly service: DirectoryService) {}

  @Get()
  list(
    @CurrentUser() me: AuthPayload,
    @Query('q') q?: string,
    @Query('branchId') branchId?: string,
    @Query('orgNodeId') orgNodeId?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(me.companyId, {
      q: q?.trim() || undefined,
      branchId: branchId || undefined,
      orgNodeId: orgNodeId || undefined,
      role: role || undefined,
      status: status || undefined,
      cursor: cursor || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('online')
  online(@CurrentUser() me: AuthPayload, @Query('q') q?: string) {
    return this.service.online(me.companyId, q?.trim() || undefined);
  }
}
