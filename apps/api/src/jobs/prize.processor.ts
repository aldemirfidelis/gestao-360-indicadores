import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrizeSyncService } from '../modules/prize/prize-sync.service';
import { AuthPayload } from '../modules/auth/auth.types';
import { PRIZE_QUEUE } from './jobs.constants';

// Competências que ainda valem sincronizar (não finalizadas).
const SYNCABLE_STATUSES = ['OPEN', 'IN_CALCULATION', 'CLOSED_FOR_CALC', 'IN_REVIEW', 'IN_APPROVAL'] as const;

interface PrizeJobData {
  kind: 'sync-open' | 'sync-actuals' | 'autopilot';
  companyId?: string;
  userId?: string;
  competenceId?: string;
}

/**
 * Worker de Gestão de Prêmio (item 14).
 * - 'sync-open' (agendado, sem payload): mantém o realizado fresco em background —
 *   itera empresas ativas, escolhe um ator admin real (FK de auditoria válida) e
 *   sincroniza as competências não finalizadas. NÃO mexe na apuração síncrona.
 * - 'sync-actuals' / 'autopilot' (payload explícito com userId): para enfileirar
 *   uma operação pontual com o ator que a disparou.
 */
@Processor(PRIZE_QUEUE)
export class PrizeProcessor extends WorkerHost {
  private readonly logger = new Logger(PrizeProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prizeSync: PrizeSyncService,
  ) {
    super();
  }

  async process(job: Job<PrizeJobData>): Promise<{ companies?: number; competences: number; synced: number }> {
    const data = job.data ?? ({} as PrizeJobData);

    if (data.kind === 'sync-open') {
      return this.syncAllOpen();
    }

    if (!data.companyId || !data.userId || !data.competenceId) {
      throw new Error('Job de prize requer companyId, userId e competenceId.');
    }
    const me = this.actor(data.userId, data.companyId, UserRoleEnum.COMPANY_ADMIN);
    if (data.kind === 'autopilot') {
      await this.prizeSync.autopilot(me, data.competenceId, { runCalc: true });
    } else {
      await this.prizeSync.syncActuals(me, data.competenceId);
    }
    return { competences: 1, synced: 1 };
  }

  private actor(sub: string, companyId: string, role: UserRoleEnum): AuthPayload {
    return {
      sub,
      companyId,
      homeCompanyId: companyId,
      role,
      email: 'jobs@system',
      name: 'Jobs',
    } as AuthPayload;
  }

  private async syncAllOpen(): Promise<{ companies: number; competences: number; synced: number }> {
    const companies = await this.prisma.company.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true },
    });

    let competences = 0;
    let synced = 0;
    for (const company of companies) {
      const actor = await this.prisma.user.findFirst({
        where: {
          companyId: company.id,
          deletedAt: null,
          active: true,
          role: { in: [UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN] },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true },
      });
      if (!actor) continue;
      const me = this.actor(actor.id, company.id, actor.role);

      const comps = await this.prisma.prizeCompetence.findMany({
        where: { companyId: company.id, status: { in: SYNCABLE_STATUSES as unknown as any } },
        select: { id: true },
      });
      for (const comp of comps) {
        try {
          const result = await this.prizeSync.syncActuals(me, comp.id);
          competences++;
          synced += result?.synced ?? 0;
        } catch (err) {
          this.logger.error(`Falha ao sincronizar competência ${comp.id} (empresa ${company.id}): ${(err as Error).message}`);
        }
      }
    }

    this.logger.log(`Prize sync-open: ${synced} realizado(s) sincronizado(s) em ${competences} competência(s).`);
    return { companies: companies.length, competences, synced };
  }
}
