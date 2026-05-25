import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calcStatus } from '@g360/shared';
import {
  Direction,
  ImportRowStatus,
  ImportTargetKind,
  Periodicity,
  TrafficLight,
} from '@prisma/client';
import { periodRefToDate } from '../indicators/period.util';

export interface ImportRowInput<T = Record<string, unknown>> {
  rowIndex: number;
  data: T;
}

interface IndicatorRow {
  code: string;
  name: string;
  type?: string;
  unit?: string;
  periodicity?: string;
  direction?: string;
  ownerCode?: string;
  description?: string;
}

interface TargetRow {
  code: string;
  periodRef: string;
  target: number;
  lowerBound?: number;
  upperBound?: number;
}

interface ResultRow {
  code: string;
  periodRef: string;
  value: number;
  note?: string;
}

interface PreviewResult<T> {
  totalRows: number;
  okRows: number;
  errorRows: number;
  rows: Array<{ rowIndex: number; status: 'OK' | 'ERROR' | 'SKIPPED'; message?: string; data: T }>;
}

interface CommitResult {
  jobId: string;
  totalRows: number;
  okRows: number;
  errorRows: number;
}

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(
    companyId: string,
    target: ImportTargetKind,
    rows: ImportRowInput<any>[],
  ): Promise<PreviewResult<any>> {
    const out: PreviewResult<any> = { totalRows: rows.length, okRows: 0, errorRows: 0, rows: [] };
    for (const r of rows) {
      try {
        await this.validateRow(companyId, target, r.data);
        out.rows.push({ rowIndex: r.rowIndex, status: 'OK', data: r.data });
        out.okRows++;
      } catch (e: any) {
        out.rows.push({
          rowIndex: r.rowIndex,
          status: 'ERROR',
          message: e?.message ?? 'erro',
          data: r.data,
        });
        out.errorRows++;
      }
    }
    return out;
  }

  async commit(
    companyId: string,
    target: ImportTargetKind,
    fileName: string,
    rows: ImportRowInput<any>[],
  ): Promise<CommitResult> {
    const job = await this.prisma.importJob.create({
      data: { companyId, target, fileName, totalRows: rows.length },
    });
    let ok = 0;
    let err = 0;
    for (const r of rows) {
      try {
        await this.processRow(companyId, target, r.data);
        ok++;
      } catch (e: any) {
        err++;
        await this.prisma.importError.create({
          data: {
            jobId: job.id,
            rowIndex: r.rowIndex,
            message: e?.message ?? 'erro',
            status: ImportRowStatus.ERROR,
            payload: JSON.stringify(r.data),
          },
        });
      }
    }
    await this.prisma.importJob.update({
      where: { id: job.id },
      data: { okRows: ok, errorRows: err, finishedAt: new Date() },
    });
    return { jobId: job.id, totalRows: rows.length, okRows: ok, errorRows: err };
  }

  async listJobs(companyId: string) {
    return this.prisma.importJob.findMany({
      where: { companyId },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { _count: { select: { errors: true } } },
    });
  }

  async jobErrors(jobId: string) {
    return this.prisma.importError.findMany({ where: { jobId }, orderBy: { rowIndex: 'asc' } });
  }

  // ------- internals -------

  private async validateRow(companyId: string, target: ImportTargetKind, data: any) {
    if (target === ImportTargetKind.INDICATORS) {
      const d = data as IndicatorRow;
      if (!d.code || !d.name) throw new Error('code e name sao obrigatorios');
    }
    if (target === ImportTargetKind.TARGETS || target === ImportTargetKind.RESULTS) {
      const d = data as TargetRow | ResultRow;
      if (!d.code || !d.periodRef) throw new Error('code e periodRef sao obrigatorios');
      const ind = await this.prisma.indicator.findUnique({
        where: { companyId_code: { companyId, code: d.code } },
      });
      if (!ind) throw new Error(`Indicador "${d.code}" nao encontrado nesta empresa`);
      const val = target === ImportTargetKind.TARGETS ? (d as TargetRow).target : (d as ResultRow).value;
      if (typeof val !== 'number' || Number.isNaN(val)) throw new Error('valor numerico inválido');
    }
  }

  private async processRow(companyId: string, target: ImportTargetKind, data: any) {
    if (target === ImportTargetKind.INDICATORS) {
      const d = data as IndicatorRow;
      const ownerNode = d.ownerCode
        ? await this.prisma.orgNode.findFirst({ where: { companyId, code: d.ownerCode } })
        : null;
      if (!ownerNode) throw new Error('ownerCode inválido (area nao encontrada)');
      await this.prisma.indicator.upsert({
        where: { companyId_code: { companyId, code: d.code } },
        create: {
          companyId,
          code: d.code,
          name: d.name,
          description: d.description ?? null,
          type: (d.type as any) ?? 'OPERATIONAL',
          unit: (d.unit as any) ?? 'PERCENT',
          periodicity: (d.periodicity as any) ?? 'MONTHLY',
          direction: (d.direction as any) ?? 'HIGHER_BETTER',
          ownerNodeId: ownerNode.id,
        },
        update: {
          name: d.name,
          description: d.description ?? null,
          type: (d.type as any) ?? undefined,
          unit: (d.unit as any) ?? undefined,
          periodicity: (d.periodicity as any) ?? undefined,
          direction: (d.direction as any) ?? undefined,
          ownerNodeId: ownerNode.id,
        },
      });
      return;
    }

    if (target === ImportTargetKind.TARGETS) {
      const d = data as TargetRow;
      const ind = await this.prisma.indicator.findUniqueOrThrow({
        where: { companyId_code: { companyId, code: d.code } },
      });
      await this.prisma.indicatorTarget.upsert({
        where: { indicatorId_periodRef: { indicatorId: ind.id, periodRef: d.periodRef } },
        create: {
          indicatorId: ind.id,
          periodRef: d.periodRef,
          target: d.target,
          lowerBound: d.lowerBound ?? null,
          upperBound: d.upperBound ?? null,
        },
        update: { target: d.target, lowerBound: d.lowerBound ?? null, upperBound: d.upperBound ?? null },
      });
      return;
    }

    if (target === ImportTargetKind.RESULTS) {
      const d = data as ResultRow;
      const ind = await this.prisma.indicator.findUniqueOrThrow({
        where: { companyId_code: { companyId, code: d.code } },
      });
      const t = await this.prisma.indicatorTarget.findUnique({
        where: { indicatorId_periodRef: { indicatorId: ind.id, periodRef: d.periodRef } },
      });
      const status = calcStatus({
        value: d.value,
        target: t?.target ?? null,
        direction: ind.direction as Direction,
        lowerBound: t?.lowerBound ?? null,
        upperBound: t?.upperBound ?? null,
        yellowToleranceP: ind.yellowToleranceP,
      });
      await this.prisma.indicatorResult.upsert({
        where: { indicatorId_periodRef: { indicatorId: ind.id, periodRef: d.periodRef } },
        create: {
          indicatorId: ind.id,
          periodRef: d.periodRef,
          periodDate: periodRefToDate(d.periodRef, ind.periodicity as Periodicity),
          value: d.value,
          note: d.note ?? null,
          status: 'FILLED',
          light: status.light as TrafficLight,
          attainment: status.attainment,
          deviationAbs: status.deviationAbs,
          deviationPct: status.deviationPct,
        },
        update: {
          value: d.value,
          note: d.note ?? null,
          light: status.light as TrafficLight,
          attainment: status.attainment,
          deviationAbs: status.deviationAbs,
          deviationPct: status.deviationPct,
        },
      });
    }
  }
}
