import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class WorkflowAuditService {
  private readonly logger = new Logger(WorkflowAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(
    companyId: string,
    workflowInstanceId: string,
    nodeExecutionId: string | null,
    level: 'INFO' | 'WARNING' | 'ERROR',
    eventType: string,
    message: string,
    details?: string
  ): Promise<any> {
    try {
      return await this.prisma.workflowExecutionLog.create({
        data: {
          companyId,
          workflowInstanceId,
          nodeExecutionId,
          level,
          eventType,
          message,
          details: details || null,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to write execution log: ${error.message}`, error.stack);
    }
  }

  async getLogs(companyId: string, instanceId: string): Promise<any[]> {
    return this.prisma.workflowExecutionLog.findMany({
      where: { companyId, workflowInstanceId: instanceId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
