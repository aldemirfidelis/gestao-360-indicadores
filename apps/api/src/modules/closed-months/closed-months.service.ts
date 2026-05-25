import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';

@Injectable()
export class ClosedMonthsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    const items = await this.prisma.closedMonth.findMany({
      where: { companyId },
      orderBy: [{ periodRef: 'desc' }],
      include: {
        closedBy: { select: { id: true, name: true } },
        reopenedBy: { select: { id: true, name: true } },
      },
    });
    return items.map((item) => ({
      ...item,
      isClosed: !item.reopenedAt && !item.deletedAt,
    }));
  }

  async isMonthClosed(companyId: string, periodRef: string): Promise<boolean> {
    const item = await this.prisma.closedMonth.findUnique({
      where: { companyId_periodRef: { companyId, periodRef } },
    });
    if (!item) return false;
    if (item.deletedAt) return false;
    if (item.reopenedAt) return false;
    return true;
  }

  async close(me: AuthPayload, periodRef: string, reason?: string | null) {
    const ref = sanitizePeriodRef(periodRef);
    const existing = await this.prisma.closedMonth.findUnique({
      where: { companyId_periodRef: { companyId: me.companyId, periodRef: ref } },
    });
    if (existing && !existing.reopenedAt && !existing.deletedAt) {
      throw new ConflictException(`O mes ${ref} ja esta fechado.`);
    }
    const data = {
      companyId: me.companyId,
      periodRef: ref,
      reason: reason ?? null,
      closedAt: new Date(),
      closedById: me.sub,
      reopenedAt: null,
      reopenedById: null,
      deletedAt: null,
    };
    if (existing) {
      return this.prisma.closedMonth.update({
        where: { id: existing.id },
        data,
      });
    }
    return this.prisma.closedMonth.create({ data });
  }

  async reopen(me: AuthPayload, id: string) {
    const existing = await this.prisma.closedMonth.findFirst({
      where: { id, companyId: me.companyId },
    });
    if (!existing) throw new NotFoundException('Mês fechado nao encontrado.');
    if (existing.reopenedAt || existing.deletedAt) {
      throw new ConflictException(`O mes ${existing.periodRef} ja esta aberto.`);
    }
    return this.prisma.closedMonth.update({
      where: { id },
      data: { reopenedAt: new Date(), reopenedById: me.sub },
    });
  }
}

function sanitizePeriodRef(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}(-(\d{2}|Q[1-4]|S[1-2]|W\d{2}|BW\d+)|-\d{2}-\d{2})?$/.test(value.trim())) {
    throw new BadRequestException('Período inválido. Use o formato YYYY-MM (ou trimestre/semestre).');
  }
  return value.trim();
}
