import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';
import { swallow } from '../../common/logging/swallow';

function n(v: any): number | null {
  if (v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isNaN(x) ? null : x;
}

/**
 * Espelho do Premio (demonstrativo individual). O snapshot (data) e congelado
 * na emissao; publicar nunca sobrescreve um espelho ja publicado — gera nova
 * versao (a anterior vira SUPERSEDED). O PDF e renderizado no cliente (jsPDF).
 */
@Injectable()
export class PrizePayslipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
  ) {}

  async generate(me: AuthPayload, competenceId: string) {
    const competence = await this.prisma.prizeCompetence.findFirst({ where: { id: competenceId, companyId: me.companyId } });
    if (!competence) throw new NotFoundException('Competência não encontrada');
    const run = await this.prisma.prizeCalculationRun.findFirst({
      where: { companyId: me.companyId, competenceId, status: { in: ['SUCCESS', 'PARTIAL'] } },
      orderBy: { version: 'desc' },
    });
    if (!run) throw new BadRequestException('Rode a apuração antes de emitir os espelhos');

    const [results, program, company, snapshots, existing] = await Promise.all([
      this.prisma.prizeCalculationResult.findMany({ where: { runId: run.id }, include: { lines: { orderBy: [{ step: 'asc' }, { createdAt: 'asc' }] } } }),
      this.prisma.prizeProgram.findFirst({ where: { id: competence.programId } }),
      this.prisma.company.findFirst({ where: { id: me.companyId }, select: { name: true, tradeName: true } }),
      this.prisma.prizeEmployeeSnapshot.findMany({ where: { companyId: me.companyId, competenceId, current: true } }),
      this.prisma.prizePayslip.findMany({ where: { competenceId }, select: { registration: true, version: true } }),
    ]);
    const empByReg = new Map(snapshots.map((s) => [s.registration, s]));
    const maxVer = new Map<string, number>();
    for (const p of existing) maxVer.set(p.registration, Math.max(maxVer.get(p.registration) ?? 0, p.version));

    let created = 0;
    for (const r of results) {
      const emp = empByReg.get(r.registration);
      const version = (maxVer.get(r.registration) ?? 0) + 1;
      const data = {
        company: { name: company?.tradeName || company?.name || '' },
        competence: { label: competence.label, year: competence.year, month: competence.month },
        program: { code: program?.code ?? '', name: program?.name ?? '', currency: program?.currency ?? 'BRL' },
        employee: {
          registration: r.registration, name: r.name, cpfMasked: emp?.cpfMasked ?? null,
          area: emp?.areaRef ?? null, position: emp?.positionRef ?? null, costCenter: emp?.costCenterRef ?? null,
          unit: emp?.unitRef ?? null, baseSalary: n(emp?.baseSalary), workedDays: emp?.workedDays ?? null,
        },
        prize: {
          potential: n(r.potential), weightedGain: n(r.weightedGain), proportionality: n(r.proportionality),
          grossValue: n(r.grossValue), totalReductions: n(r.totalReductions), adjustments: n(r.adjustments),
          gratification: n(r.gratification), finalValue: n(r.finalValue), blocked: r.blocked,
          blockReason: r.blockReason, exceptionType: r.exceptionType,
        },
        memory: r.lines.map((l) => ({ step: l.step, code: l.code, label: l.label, detail: l.detail, value: n(l.value) })),
        meta: { calcVersion: run.version, engineVersion: run.engineVersion, hash: r.hash, emittedAt: new Date().toISOString() },
        channel: 'Em caso de dúvidas, procure o RH / Gestão de Resultados.',
      };
      await this.prisma.prizePayslip.create({
        data: {
          companyId: me.companyId, competenceId, calcRunId: run.id, calcResultId: r.id,
          registration: r.registration, name: r.name, version, status: 'GENERATED',
          data: data as unknown as Prisma.InputJsonValue, finalValue: r.finalValue, createdById: me.sub,
        },
      });
      maxVer.set(r.registration, version);
      created++;
    }
    await this.audit.log(me, { action: 'GENERATE', entityType: 'PAYSLIP_BATCH', entityId: competenceId, competenceId, after: { created } });
    return { created };
  }

  /** Lista a versao mais recente por colaborador. */
  async list(companyId: string, competenceId: string) {
    const all = await this.prisma.prizePayslip.findMany({
      where: { companyId, competenceId },
      orderBy: [{ registration: 'asc' }, { version: 'desc' }],
      select: { id: true, registration: true, name: true, version: true, status: true, finalValue: true, publishedAt: true, acknowledgedAt: true },
    });
    const seen = new Set<string>();
    const latest = all.filter((p) => { if (seen.has(p.registration)) return false; seen.add(p.registration); return true; });
    return latest;
  }

  async get(companyId: string, id: string) {
    const p = await this.prisma.prizePayslip.findFirst({ where: { id, companyId } });
    if (!p) throw new NotFoundException('Espelho não encontrado');
    return p;
  }

  async publish(me: AuthPayload, id: string) {
    const p = await this.get(me.companyId, id);
    await this.prisma.prizePayslip.updateMany({
      where: { competenceId: p.competenceId, registration: p.registration, status: 'PUBLISHED', id: { not: id } },
      data: { status: 'SUPERSEDED' },
    });
    const updated = await this.prisma.prizePayslip.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date(), publishedById: me.sub } });
    await this.audit.log(me, { action: 'PUBLISH', entityType: 'PAYSLIP', entityId: id, competenceId: p.competenceId, after: { version: p.version } });
    return updated;
  }

  async publishBatch(me: AuthPayload, competenceId: string) {
    const latest = await this.list(me.companyId, competenceId);
    let published = 0;
    for (const p of latest) {
      if (p.status === 'GENERATED') { await this.publish(me, p.id); published++; }
    }
    await this.prisma.prizeCompetence
      .update({ where: { id: competenceId }, data: { status: 'PAYSLIPS_PUBLISHED' } })
      .catch(swallow(undefined, `prize.payslip.markPublished(competenceId=${competenceId})`));
    return { published };
  }

  /** Ciencia do colaborador (ou de quem consulta em seu nome). */
  async acknowledge(me: AuthPayload, id: string) {
    const p = await this.get(me.companyId, id);
    if (p.status !== 'PUBLISHED') throw new BadRequestException('Só é possível dar ciência em espelho publicado');
    if (p.acknowledgedAt) return p;
    const updated = await this.prisma.prizePayslip.update({ where: { id }, data: { acknowledgedAt: new Date(), acknowledgedById: me.sub } });
    await this.audit.log(me, { action: 'ACKNOWLEDGE', entityType: 'PAYSLIP', entityId: id, competenceId: p.competenceId });
    return updated;
  }
}
