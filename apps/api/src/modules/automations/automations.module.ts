import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AutomationsController } from './automations.controller';
import { WorkflowEventDispatcher } from './services/workflow-dispatcher.service';
import { WorkflowExecutionEngine } from './services/workflow-engine.service';
import { WorkflowScheduler } from './services/workflow-scheduler.service';
import { WorkflowQueueAdapter } from './services/workflow-queue.adapter';
import { WorkflowValidationService } from './services/workflow-validation.service';
import { WorkflowSimulationService } from './services/workflow-simulation.service';
import { WorkflowTaskService } from './services/workflow-task.service';
import { WorkflowApprovalService } from './services/workflow-approval.service';
import { WorkflowNotificationService } from './services/workflow-notification.service';
import { WorkflowAuditService } from './services/workflow-audit.service';
import { WorkflowTemplateService } from './services/workflow-template.service';
import { WorkflowIntegrationService } from './services/workflow-integration.service';

@Module({
  imports: [PrismaModule],
  controllers: [AutomationsController],
  providers: [
    WorkflowEventDispatcher,
    WorkflowExecutionEngine,
    WorkflowScheduler,
    WorkflowQueueAdapter,
    WorkflowValidationService,
    WorkflowSimulationService,
    WorkflowTaskService,
    WorkflowApprovalService,
    WorkflowNotificationService,
    WorkflowAuditService,
    WorkflowTemplateService,
    WorkflowIntegrationService,
  ],
  exports: [
    WorkflowEventDispatcher,
    WorkflowTaskService,
    WorkflowApprovalService,
  ],
})
export class AutomationsModule {}
