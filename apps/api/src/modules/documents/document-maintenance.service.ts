import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentContentService } from './document-content.service';
import { DocumentDistributionService } from './document-distribution.service';
import { DocumentWorkflowService } from './document-workflow.service';
import { DocumentsService } from './documents.service';

/**
 * Rotina do GED, chamada pela manutenção da plataforma (a cada hora):
 * vencimentos, publicações agendadas, lembretes de etapas e de leituras e a
 * distribuição para quem entrou depois na área (uma vez por dia por empresa).
 */
@Injectable()
export class DocumentMaintenanceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DocumentMaintenanceService.name);
  private readonly dailyRun = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly workflow: DocumentWorkflowService,
    private readonly distribution: DocumentDistributionService,
    private readonly content: DocumentContentService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.MAINTENANCE_JOBS_ENABLED === 'false' || process.env.NODE_ENV === 'test') return;
    // Documentos migrados sem texto de busca são indexados logo após subir.
    const timer = setTimeout(() => {
      this.content.reindexMissing(undefined, 500).then(
        (count) => count && this.logger.log(`Texto de busca gerado para ${count} documento(s).`),
        (error) => this.logger.warn(`Reindexação inicial do GED falhou: ${(error as Error).message}`),
      );
    }, 20_000);
    timer.unref?.();
  }

  async tick(companyId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const summary = { expired: 0, published: 0, stepReminders: 0, readReminders: 0, assigned: 0, reindexed: 0 };
    const run = async <T>(name: string, task: () => Promise<T>): Promise<T | null> => {
      try {
        return await task();
      } catch (error) {
        this.logger.warn(`GED/${name} falhou (empresa ${companyId}): ${(error as Error).message}`);
        return null;
      }
    };
    summary.expired = (await run('vencimento', () => this.documents.expirationSweep(companyId)))?.processed ?? 0;
    summary.published = (await run('publicacao-agendada', () => this.documents.publishScheduled(companyId))) ?? 0;
    summary.reindexed = (await run('reindexacao', () => this.content.reindexMissing(companyId))) ?? 0;
    if (this.dailyRun.get(companyId) !== today) {
      this.dailyRun.set(companyId, today);
      summary.assigned = (await run('distribuicao', () => this.distribution.syncAll(companyId))) ?? 0;
      summary.stepReminders = (await run('lembretes-etapas', () => this.workflow.reminders(companyId))) ?? 0;
      summary.readReminders = (await run('lembretes-leitura', () => this.distribution.reminders(companyId))) ?? 0;
    }
    return summary;
  }

  /** Execução manual (gestor do GED), útil para conferir a rotina. */
  async runForCompany(companyId: string) {
    this.dailyRun.delete(companyId);
    return this.tick(companyId);
  }

  async companiesWithDocuments(): Promise<string[]> {
    const rows = await this.prisma.document.groupBy({ by: ['companyId'], where: { deletedAt: null }, _count: { _all: true } });
    return rows.map((row) => row.companyId);
  }
}
