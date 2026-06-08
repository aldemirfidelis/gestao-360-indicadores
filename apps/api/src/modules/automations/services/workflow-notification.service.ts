import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationKind } from '@prisma/client';

@Injectable()
export class WorkflowNotificationService {
  private readonly logger = new Logger(WorkflowNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendNotification(
    companyId: string,
    userId: string,
    title: string,
    body: string,
    kind: NotificationKind = 'ACTION_DUE_SOON',
    link?: string
  ): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          companyId,
          userId,
          title,
          body,
          kind,
          link: link || null,
        },
      });
      this.logger.log(`Notification sent to user ${userId} in company ${companyId}`);
    } catch (error: any) {
      this.logger.error(`Failed to send notification to user ${userId}: ${error.message}`, error.stack);
    }
  }

  async notifyFailure(instance: any, nodeKey: string, errorMessage: string): Promise<void> {
    // Notify company administrators about critical workflow failure
    const companyId = instance.companyId;
    const admins = await this.prisma.user.findMany({
      where: {
        companyId,
        role: 'COMPANY_ADMIN',
        active: true,
      },
      select: { id: true },
    });

    const body = `O workflow "${instance.id}" falhou criticamente no nó "${nodeKey}". Erro: ${errorMessage}`;

    for (const admin of admins) {
      await this.sendNotification(
        companyId,
        admin.id,
        `Falha Crítica no Workflow`,
        body,
        'DEVIATION_CRITICAL'
      );
    }
  }
}
