import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AnalysisMethod,
  DeviationSeverity,
  DeviationStatus,
  Prisma,
} from '@prisma/client';

export interface OpenDeviationInput {
  companyId: string;
  indicatorId: string;
  periodRef: string;
  title?: string;
  severity?: DeviationSeverity;
  responsibleUserId?: string | null;
  dueDate?: Date | null;
  method?: AnalysisMethod;
  fact?: string;
}

@Injectable()
export class DeviationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, status?: DeviationStatus, indicatorId?: string) {
    return this.prisma.deviation.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(indicatorId ? { indicatorId } : {}),
      },
      include: {
        indicator: { select: { id: true, name: true, code: true } },
        responsibleUser: { select: { id: true, name: true } },
        _count: { select: { causes: true, actions: true, analyses: true } },
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async getById(id: string) {
    const d = await this.prisma.deviation.findFirst({
      where: { id, deletedAt: null },
      include: {
        indicator: true,
        responsibleUser: true,
        causes: true,
        analyses: true,
        actions: { include: { responsibleUser: { select: { id: true, name: true } } } },
      },
    });
    if (!d) throw new NotFoundException('Desvio nao encontrado');
    return d;
  }

  async open(input: OpenDeviationInput): Promise<{ id: string; number: number }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const last = await tx.deviation.findFirst({
        where: { companyId: input.companyId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const number = (last?.number ?? 0) + 1;

      const indicator = await tx.indicator.findUnique({
        where: { id: input.indicatorId },
        select: { name: true },
      });

      const title =
        input.title ?? `Desvio #${number} - ${indicator?.name ?? 'Indicador'} (${input.periodRef})`;

      const deviation = await tx.deviation.create({
        data: {
          companyId: input.companyId,
          indicatorId: input.indicatorId,
          periodRef: input.periodRef,
          number,
          title,
          severity: input.severity ?? DeviationSeverity.MODERATE,
          status: DeviationStatus.OPEN,
          method: input.method ?? AnalysisMethod.FCA,
          fact: input.fact,
          responsibleUserId: input.responsibleUserId ?? null,
          dueDate: input.dueDate ?? null,
        },
      });

      return { id: deviation.id, number: deviation.number };
    });
    return result;
  }

  async update(id: string, patch: Prisma.DeviationUpdateInput) {
    return this.prisma.deviation.update({ where: { id }, data: patch });
  }

  async addCause(deviationId: string, description: string, category?: string, weight = 1) {
    return this.prisma.deviationCause.create({
      data: { deviationId, description, category: category ?? null, weight },
    });
  }

  async removeCause(causeId: string) {
    return this.prisma.deviationCause.delete({ where: { id: causeId } });
  }

  async addAnalysis(deviationId: string, method: AnalysisMethod, content: string) {
    return this.prisma.deviationAnalysis.create({
      data: { deviationId, method, content },
    });
  }

  async close(id: string) {
    const dev = await this.getById(id);
    const open = dev.actions.filter((a) => a.status !== 'DONE' && a.status !== 'DONE_LATE');
    if (open.length > 0) {
      throw new NotFoundException(
        `Existem ${open.length} acao(oes) abertas. Conclua-as antes de fechar o desvio.`,
      );
    }
    const lateClose = dev.dueDate && dev.dueDate < new Date();
    return this.prisma.deviation.update({
      where: { id },
      data: {
        status: lateClose ? DeviationStatus.CLOSED_LATE : DeviationStatus.CLOSED,
        closedAt: new Date(),
      },
    });
  }
}
