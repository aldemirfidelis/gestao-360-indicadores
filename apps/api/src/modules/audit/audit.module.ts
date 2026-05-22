import { Controller, Get, Header, Module, Param, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('audit')
@RequirePermissions('audit:view')
class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() me: AuthPayload,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('module') module?: string,
    @Query('userId') userId?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        companyId: me.companyId,
        ...(entity ? { entity } : {}),
        ...(action ? { action } : {}),
        ...(module ? { module } : {}),
        ...(userId ? { userId } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { entity: { contains: q, mode: 'insensitive' } },
                { module: { contains: q, mode: 'insensitive' } },
                { action: { contains: q, mode: 'insensitive' } },
                { recordLabel: { contains: q, mode: 'insensitive' } },
                { payload: { contains: q, mode: 'insensitive' } },
                { beforeValue: { contains: q, mode: 'insensitive' } },
                { afterValue: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 200,
    });
  }

  @Get('entries/:id')
  async detail(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.prisma.auditLog.findFirst({
      where: { id, companyId: me.companyId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  @Get('exports/csv')
  @RequirePermissions('audit:export')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="auditoria.csv"')
  async exportCsv(@CurrentUser() me: AuthPayload, @Query('limit') limit?: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { companyId: me.companyId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 1000,
    });
    const header = ['data_hora', 'usuario', 'email', 'acao', 'modulo', 'entidade', 'registro', 'resultado', 'ip'];
    return [
      header.join(';'),
      ...rows.map((row) =>
        [
          row.createdAt.toISOString(),
          row.user?.name ?? '',
          row.user?.email ?? '',
          row.action,
          row.module ?? '',
          row.entity,
          row.entityId ?? '',
          row.result ?? '',
          row.ip ?? '',
        ].map(csv).join(';'),
      ),
    ].join('\n');
  }
}

@Module({ controllers: [AuditController] })
export class AuditModule {}

function csv(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
