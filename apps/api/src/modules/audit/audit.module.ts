import { Controller, Get, Module, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';

@Controller('audit')
class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() me: AuthPayload,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        companyId: me.companyId,
        ...(entity ? { entity } : {}),
        ...(action ? { action } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 200,
    });
  }
}

@Module({ controllers: [AuditController] })
export class AuditModule {}
