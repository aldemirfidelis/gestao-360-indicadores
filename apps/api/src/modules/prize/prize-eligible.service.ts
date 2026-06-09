import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrizeConnectorType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';
import { EligibleRow, generateMockEligible, maskCpf, reconcile, SnapshotLike } from './prize-eligible.util';

export interface ImportEligibleDto {
  source?: PrizeConnectorType;
  configId?: string | null;
  rows?: EligibleRow[];
  useMock?: boolean;
  mockCount?: number;
  events?: Array<{ registration: string; type: string; date?: string; days?: number; value?: number; description?: string }>;
}

@Injectable()
export class PrizeEligibleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
  ) {}

  async canSeeSalary(me: AuthPayload): Promise<boolean> {
    if (me.role === 'SUPER_ADMIN' || me.role === 'COMPANY_ADMIN') return true;
    const user = await this.prisma.user.findUnique({
      where: { id: me.sub },
      select: {
        permissions: { select: { permission: { select: { key: true } } } },
        accessProfile: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
      },
    });
    const keys = new Set<string>();
    user?.permissions.forEach((i) => keys.add(i.permission.key));
    user?.accessProfile?.permissions.forEach((i) => keys.add(i.permission.key));
    return keys.has('prize:salary:view');
  }

  private async getCompetence(companyId: string, competenceId: string) {
    const c = await this.prisma.prizeCompetence.findFirst({ where: { id: competenceId, companyId } });
    if (!c) throw new NotFoundException('Competência não encontrada');
    return c;
  }

  /**
   * Importa a base elegivel de uma competencia (snapshot imutavel por lote).
   * Aceita linhas ja parseadas (arquivo CSV/XLSX/JSON) ou base ficticia (mock)
   * para homologacao. Marca o lote anterior como nao-corrente e concilia.
   */
  async import(me: AuthPayload, competenceId: string, dto: ImportEligibleDto) {
    await this.getCompetence(me.companyId, competenceId);
    const source = dto.source ?? 'MANUAL';
    const rows: EligibleRow[] = dto.rows?.length ? dto.rows : dto.useMock ? generateMockEligible(dto.mockCount ?? 12) : [];
    if (!rows.length) throw new BadRequestException('Nenhuma linha para importar (envie rows ou useMock=true)');

    const lastLot = await this.prisma.prizeEmployeeSnapshot.aggregate({
      where: { competenceId },
      _max: { lotVersion: true },
    });
    const lotVersion = (lastLot._max.lotVersion ?? 0) + 1;

    // snapshot atual (lote corrente) para conciliacao
    const previous = await this.prisma.prizeEmployeeSnapshot.findMany({
      where: { competenceId, current: true },
      select: { registration: true, positionRef: true, areaRef: true, costCenterRef: true, situation: true, baseSalary: true },
    });
    const prevLike: SnapshotLike[] = previous.map((p) => ({ ...p, baseSalary: p.baseSalary ? Number(p.baseSalary) : null }));
    const recon = reconcile(prevLike, rows.map((r) => ({
      registration: r.registration, positionRef: r.positionRef ?? null, areaRef: r.areaRef ?? null,
      costCenterRef: r.costCenterRef ?? null, situation: r.situation ?? null, baseSalary: r.baseSalary ?? null,
    })));

    const job = await this.prisma.prizeIntegrationJob.create({
      data: {
        companyId: me.companyId, configId: dto.configId ?? null, kind: 'APDATA_ELIGIBLE', competenceId,
        type: source, status: 'RUNNING', lotVersion, startedAt: new Date(), createdById: me.sub,
      },
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.prizeEmployeeSnapshot.updateMany({ where: { competenceId, current: true }, data: { current: false } });
        for (const r of rows) {
          await tx.prizeEmployeeSnapshot.create({
            data: {
              companyId: me.companyId, competenceId, batchId: job.id, lotVersion, current: true,
              registration: r.registration, name: r.name, cpfMasked: maskCpf(r.cpf), bond: r.bond ?? null,
              branchRef: r.branchRef ?? null, unitRef: r.unitRef ?? null, positionRef: r.positionRef ?? null,
              functionRef: r.functionRef ?? null, areaRef: r.areaRef ?? null, sectorRef: r.sectorRef ?? null,
              costCenterRef: r.costCenterRef ?? null, baseSalary: r.baseSalary ?? null,
              admissionDate: r.admissionDate ? new Date(r.admissionDate) : null,
              terminationDate: r.terminationDate ? new Date(r.terminationDate) : null,
              situation: r.situation ?? 'ACTIVE', workedDays: r.workedDays ?? null, source,
            },
          });
        }
        for (const ev of dto.events ?? []) {
          const snap = await tx.prizeEmployeeSnapshot.findFirst({ where: { competenceId, registration: ev.registration, lotVersion } });
          await tx.prizeEmployeeEvent.create({
            data: {
              companyId: me.companyId, competenceId, snapshotId: snap?.id ?? null, registration: ev.registration,
              type: ev.type, date: ev.date ? new Date(ev.date) : null, days: ev.days ?? null, value: ev.value ?? null,
              description: ev.description ?? null, source, batchId: job.id,
            },
          });
        }
      });

      const updatedJob = await this.prisma.prizeIntegrationJob.update({
        where: { id: job.id },
        data: { status: 'SUCCESS', processed: rows.length, finishedAt: new Date(), summary: recon as unknown as Prisma.InputJsonValue },
      });
      await this.audit.log(me, { action: 'IMPORT_ELIGIBLE', entityType: 'ELIGIBLE_BATCH', entityId: job.id, competenceId, after: { lotVersion, processed: rows.length } });
      return { job: updatedJob, reconciliation: recon };
    } catch (e: any) {
      await this.prisma.prizeIntegrationJob.update({ where: { id: job.id }, data: { status: 'ERROR', errorsCount: 1, finishedAt: new Date(), log: String(e?.message ?? e) } });
      throw e;
    }
  }

  async listSnapshot(me: AuthPayload, competenceId: string) {
    await this.getCompetence(me.companyId, competenceId);
    const canSalary = await this.canSeeSalary(me);
    const rows = await this.prisma.prizeEmployeeSnapshot.findMany({
      where: { companyId: me.companyId, competenceId, current: true },
      orderBy: [{ name: 'asc' }],
      include: { _count: { select: { events: true } } },
    });
    return {
      canSeeSalary: canSalary,
      total: rows.length,
      employees: rows.map((r) => ({
        id: r.id, registration: r.registration, name: r.name, cpfMasked: r.cpfMasked,
        positionRef: r.positionRef, areaRef: r.areaRef, costCenterRef: r.costCenterRef,
        situation: r.situation, workedDays: r.workedDays, eligible: r.eligible, blocked: r.blocked,
        lotVersion: r.lotVersion, events: r._count.events,
        baseSalary: canSalary ? (r.baseSalary ? Number(r.baseSalary) : null) : null,
      })),
    };
  }

  async lastReconciliation(companyId: string, competenceId: string) {
    await this.getCompetence(companyId, competenceId);
    const job = await this.prisma.prizeIntegrationJob.findFirst({
      where: { companyId, competenceId, kind: 'APDATA_ELIGIBLE', status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
    });
    return { job, reconciliation: job?.summary ?? null };
  }

  async listEvents(companyId: string, competenceId: string, registration?: string) {
    await this.getCompetence(companyId, competenceId);
    return this.prisma.prizeEmployeeEvent.findMany({
      where: { companyId, competenceId, ...(registration ? { registration } : {}) },
      orderBy: [{ registration: 'asc' }, { date: 'asc' }],
    });
  }

  async setEligibility(me: AuthPayload, snapshotId: string, eligible: boolean, justification: string) {
    const snap = await this.prisma.prizeEmployeeSnapshot.findFirst({ where: { id: snapshotId, companyId: me.companyId } });
    if (!snap) throw new NotFoundException('Colaborador não encontrado no snapshot');
    if (!justification?.trim()) throw new BadRequestException('Justificativa é obrigatória');
    const updated = await this.prisma.prizeEmployeeSnapshot.update({ where: { id: snapshotId }, data: { eligible, blocked: !eligible } });
    await this.audit.log(me, {
      action: 'SET_ELIGIBILITY', entityType: 'ELIGIBLE_EMPLOYEE', entityId: snapshotId, competenceId: snap.competenceId,
      before: { eligible: snap.eligible }, after: { eligible }, justification,
    });
    return updated;
  }
}
