import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { NOTIFICATIONS_QUEUE } from './jobs.constants';

/**
 * Worker de notificações: roda as regras de alerta (indicador vermelho sem
 * notificação prévia, ação atrasada com responsável) para todas as empresas
 * ativas. Mesma lógica do POST /notifications/generate, agora agendável.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job): Promise<{ companies: number; generated: number }> {
    const companies = await this.prisma.company.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true },
    });

    let generated = 0;
    for (const company of companies) {
      try {
        const result = await this.notifications.generateAlerts(company.id);
        generated += result?.generated ?? 0;
      } catch (err) {
        // Não derruba o job inteiro por causa de uma empresa; loga e segue.
        this.logger.error(`Falha ao gerar alertas (empresa ${company.id}): ${(err as Error).message}`);
      }
    }

    this.logger.log(`[${job.name}] alertas gerados: ${generated} em ${companies.length} empresa(s)`);
    return { companies: companies.length, generated };
  }
}
