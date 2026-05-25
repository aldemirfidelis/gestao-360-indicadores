import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkPeriodStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';

const BASE_YEAR = 2026;

@Injectable()
export class PeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(me: AuthPayload) {
    await this.ensureCurrentPeriod(me.companyId, me.sub);
    const periods = await this.prisma.workPeriod.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      orderBy: { year: 'asc' },
    });
    const current = periods.find((period) => period.isCurrent) ?? null;
    return { baseYear: BASE_YEAR, current, periods };
  }

  async current(companyId: string) {
    return this.ensureCurrentPeriod(companyId);
  }

  async create(me: AuthPayload, year: number) {
    this.validateYear(year);
    const existing = await this.prisma.workPeriod.findUnique({
      where: { companyId_year: { companyId: me.companyId, year } },
    });
    if (existing && !existing.deletedAt) return existing;
    const current = await this.prisma.workPeriod.findFirst({
      where: { companyId: me.companyId, isCurrent: true, deletedAt: null },
      select: { id: true },
    });
    return this.prisma.workPeriod.upsert({
      where: { companyId_year: { companyId: me.companyId, year } },
      create: {
        companyId: me.companyId,
        year,
        name: `Exercício ${year}`,
        ...periodDates(year),
        isCurrent: !current,
        createdById: me.sub,
      },
      update: {
        name: `Exercício ${year}`,
        ...periodDates(year),
        status: WorkPeriodStatus.OPEN,
        deletedAt: null,
        updatedById: me.sub,
      },
    });
  }

  async setCurrent(me: AuthPayload, id: string) {
    const period = await this.findCompanyPeriodOrThrow(me.companyId, id);
    if (period.status !== WorkPeriodStatus.OPEN) {
      throw new ConflictException('Somente períodos abertos podem ser definidos como ano de trabalho.');
    }
    await this.prisma.$transaction([
      this.prisma.workPeriod.updateMany({
        where: { companyId: me.companyId, deletedAt: null, isCurrent: true },
        data: { isCurrent: false, updatedById: me.sub },
      }),
      this.prisma.workPeriod.update({
        where: { id },
        data: { isCurrent: true, updatedById: me.sub },
      }),
    ]);
    return this.findCompanyPeriodOrThrow(me.companyId, id);
  }

  async close(me: AuthPayload, id: string) {
    const period = await this.findCompanyPeriodOrThrow(me.companyId, id);
    if (period.status === WorkPeriodStatus.CLOSED) {
      return this.ensureNextPeriod(me, period.year);
    }
    if (period.status !== WorkPeriodStatus.OPEN) {
      throw new ConflictException('Somente períodos abertos podem ser fechados.');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.workPeriod.updateMany({
        where: { companyId: me.companyId, deletedAt: null, isCurrent: true },
        data: { isCurrent: false, updatedById: me.sub },
      });
      await tx.workPeriod.update({
        where: { id },
        data: {
          status: WorkPeriodStatus.CLOSED,
          isCurrent: false,
          closedAt: new Date(),
          closedById: me.sub,
          updatedById: me.sub,
        },
      });
      const nextYear = period.year + 1;
      const existingNext = await tx.workPeriod.findUnique({
        where: { companyId_year: { companyId: me.companyId, year: nextYear } },
      });
      if (existingNext?.status === WorkPeriodStatus.CLOSED && !existingNext.deletedAt) {
        throw new ConflictException(`O período ${nextYear} ja esta fechado.`);
      }
      const next = await tx.workPeriod.upsert({
        where: { companyId_year: { companyId: me.companyId, year: nextYear } },
        create: {
          companyId: me.companyId,
          year: nextYear,
          name: `Exercício ${nextYear}`,
          ...periodDates(nextYear),
          status: WorkPeriodStatus.OPEN,
          isCurrent: true,
          createdById: me.sub,
        },
        update: {
          status: WorkPeriodStatus.OPEN,
          isCurrent: true,
          deletedAt: null,
          ...periodDates(nextYear),
          updatedById: me.sub,
        },
      });
      return next;
    });
  }

  async currentAnchorDate(companyId: string) {
    const current = await this.current(companyId);
    return anchorDate(current.year);
  }

  async currentMonthlyRef(companyId: string) {
    const current = await this.current(companyId);
    const now = new Date();
    const currentCalendarYear = now.getUTCFullYear();
    const month = currentCalendarYear === current.year ? now.getUTCMonth() + 1 : currentCalendarYear < current.year ? 1 : 12;
    return `${current.year}-${String(month).padStart(2, '0')}`;
  }

  private async ensureCurrentPeriod(companyId: string, userId?: string) {
    const current = await this.prisma.workPeriod.findFirst({
      where: { companyId, deletedAt: null, isCurrent: true },
      orderBy: { year: 'desc' },
    });
    if (current) return current;

    const open = await this.prisma.workPeriod.findFirst({
      where: { companyId, deletedAt: null, status: WorkPeriodStatus.OPEN },
      orderBy: { year: 'desc' },
    });
    if (open) {
      await this.prisma.workPeriod.updateMany({
        where: { companyId, deletedAt: null, isCurrent: true },
        data: { isCurrent: false, updatedById: userId ?? null },
      });
      return this.prisma.workPeriod.update({
        where: { id: open.id },
        data: { isCurrent: true, updatedById: userId ?? null },
      });
    }

    const last = await this.prisma.workPeriod.findFirst({
      where: { companyId, deletedAt: null },
      orderBy: { year: 'desc' },
    });
    const year = last ? last.year + 1 : BASE_YEAR;
    return this.prisma.workPeriod.create({
      data: {
        companyId,
        year,
        name: `Exercício ${year}`,
        ...periodDates(year),
        status: WorkPeriodStatus.OPEN,
        isCurrent: true,
        createdById: userId ?? null,
      },
    });
  }

  private async ensureNextPeriod(me: AuthPayload, year: number) {
    const nextYear = year + 1;
    const existing = await this.prisma.workPeriod.findUnique({
      where: { companyId_year: { companyId: me.companyId, year: nextYear } },
    });
    if (existing && !existing.deletedAt) {
      if (existing.status !== WorkPeriodStatus.OPEN) throw new ConflictException(`O período ${nextYear} nao esta aberto.`);
      return this.setCurrent(me, existing.id);
    }
    const next = await this.create(me, nextYear);
    return this.setCurrent(me, next.id);
  }

  private async findCompanyPeriodOrThrow(companyId: string, id: string) {
    const period = await this.prisma.workPeriod.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!period) throw new NotFoundException('Período nao encontrado.');
    return period;
  }

  private validateYear(year: number) {
    if (!Number.isInteger(year) || year < BASE_YEAR || year > 2100) {
      throw new BadRequestException(`Informe um ano válido a partir de ${BASE_YEAR}.`);
    }
  }
}

function periodDates(year: number) {
  return {
    startsAt: new Date(Date.UTC(year, 0, 1, 12, 0, 0, 0)),
    endsAt: new Date(Date.UTC(year, 11, 31, 12, 0, 0, 0)),
  };
}

function anchorDate(year: number) {
  return new Date(Date.UTC(year, 11, 31, 12, 0, 0, 0));
}
