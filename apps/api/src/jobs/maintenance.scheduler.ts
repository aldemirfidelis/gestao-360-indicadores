import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from '../modules/documents/documents.service';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { OrganizationalCommunicationService } from '../modules/communication/organizational/organizational-communication.service';

/**
 * Rotinas de manutenção que precisam rodar SEM depender de Redis/BullMQ
 * (produção roda sem workers): mesmo padrão in-process do WorkflowScheduler.
 *
 * A cada ciclo (1h por padrão), para cada empresa ativa:
 *  - vencimento de documentos (PUBLISHED -> NEAR_EXPIRATION -> EXPIRED, com
 *    notificação ao responsável/aprovador) — antes só rodava por botão;
 *  - alertas de ação atrasada/indicador vermelho (generateAlerts, idempotente)
 *    — antes só rodava quando alguém clicava no sino de notificações;
 *  - publicação/expiração de comunicados agendados (publicationSweep) —
 *    antes o agendamento não publicava sozinho.
 *
 * Controles por env: MAINTENANCE_JOBS_ENABLED=false desliga;
 * MAINTENANCE_INTERVAL_MS ajusta o ciclo (mínimo 5 min).
 */
@Injectable()
export class MaintenanceScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MaintenanceScheduler.name);
  private intervalId: NodeJS.Timeout | null = null;
  private bootTimeoutId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
    private readonly orgCommunication: OrganizationalCommunicationService,
  ) {}

  onApplicationBootstrap() {
    if (String(process.env.MAINTENANCE_JOBS_ENABLED ?? 'true').toLowerCase() === 'false') {
      this.logger.log('MaintenanceScheduler desativado por MAINTENANCE_JOBS_ENABLED=false.');
      return;
    }
    const configured = Number(process.env.MAINTENANCE_INTERVAL_MS);
    const interval = Number.isFinite(configured) && configured >= 300_000 ? configured : 3_600_000;
    // Primeiro ciclo logo após o boot (90s) para não competir com o start;
    // depois no intervalo configurado.
    this.bootTimeoutId = setTimeout(() => void this.tick(), 90_000);
    this.intervalId = setInterval(() => void this.tick(), interval);
    this.logger.log(`MaintenanceScheduler ativo (ciclo de ${Math.round(interval / 60_000)} min).`);
  }

  onApplicationShutdown() {
    if (this.bootTimeoutId) clearTimeout(this.bootTimeoutId);
    if (this.intervalId) clearInterval(this.intervalId);
  }

  async tick(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    const startedAt = Date.now();
    let documentsProcessed = 0;
    let alertsGenerated = 0;
    let postsPublished = 0;
    let postsExpired = 0;
    let failures = 0;
    try {
      const companies = await this.prisma.company.findMany({
        where: { deletedAt: null, active: true },
        select: { id: true },
      });
      for (const company of companies) {
        // Falha em uma empresa não interrompe as demais.
        try {
          const sweep = await this.documents.expirationSweep(company.id);
          documentsProcessed += sweep.processed;
        } catch (error) {
          failures += 1;
          this.logger.error(`Vencimento de documentos falhou (empresa ${company.id}): ${(error as Error).message}`);
        }
        try {
          const alerts = await this.notifications.generateAlerts(company.id);
          alertsGenerated += alerts?.generated ?? 0;
        } catch (error) {
          failures += 1;
          this.logger.error(`Geração de alertas falhou (empresa ${company.id}): ${(error as Error).message}`);
        }
        try {
          const sweep = await this.orgCommunication.publicationSweep(company.id);
          postsPublished += sweep.published;
          postsExpired += sweep.expired;
        } catch (error) {
          failures += 1;
          this.logger.error(`Publicação de comunicados falhou (empresa ${company.id}): ${(error as Error).message}`);
        }
      }
      if (documentsProcessed || alertsGenerated || postsPublished || postsExpired || failures) {
        this.logger.log(
          `Ciclo de manutenção: ${companies.length} empresas, ${documentsProcessed} documentos transicionados, ` +
            `${alertsGenerated} alertas gerados, ${postsPublished} comunicados publicados, ${postsExpired} expirados, ` +
            `${failures} falhas, ${Date.now() - startedAt}ms.`,
        );
      }
    } catch (error) {
      this.logger.error(`Ciclo de manutenção abortado: ${(error as Error).message}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
