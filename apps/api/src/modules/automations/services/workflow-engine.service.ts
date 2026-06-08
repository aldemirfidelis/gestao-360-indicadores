import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkflowQueueAdapter } from './workflow-queue.adapter';
import { ExpressionEvaluator } from './expression-evaluator';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class WorkflowExecutionEngine {
  private readonly logger = new Logger(WorkflowExecutionEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueAdapter: WorkflowQueueAdapter,
    private readonly moduleRef: ModuleRef
  ) {}

  async processNode(instanceId: string, nodeKey: string, attemptNumber = 1): Promise<void> {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: {
        workflowVersion: {
          include: {
            nodes: { where: { nodeKey } },
          },
        },
      },
    });

    if (!instance || instance.status !== 'RUNNING') {
      return;
    }

    const version = instance.workflowVersion;
    const node = version.nodes[0];
    if (!node) {
      this.logger.error(`Node ${nodeKey} not found in version ${version.id}`);
      return;
    }

    // Check if node is already completed or running in this attempt
    const existingExecution = await this.prisma.workflowNodeExecution.findFirst({
      where: { workflowInstanceId: instanceId, nodeKey },
    });

    if (existingExecution && existingExecution.status === 'COMPLETED') {
      return;
    }

    this.logger.log(`Executing node ${nodeKey} (${node.nodeType}/${node.blockType}) for instance ${instanceId}. Attempt: ${attemptNumber}`);

    let nodeExec = existingExecution;
    if (!nodeExec) {
      nodeExec = await this.prisma.workflowNodeExecution.create({
        data: {
          companyId: instance.companyId,
          workflowInstanceId: instanceId,
          nodeKey,
          nodeType: node.nodeType,
          status: 'RUNNING',
          attemptNumber,
          inputData: instance.currentState,
          startedAt: new Date(),
        },
      });
    } else {
      nodeExec = await this.prisma.workflowNodeExecution.update({
        where: { id: nodeExec.id },
        data: {
          status: 'RUNNING',
          attemptNumber,
          startedAt: new Date(),
        },
      });
    }

    // Log the step initiation
    await this.logExecution(instanceId, nodeExec.id, 'INFO', 'NODE_STARTED', `Iniciando execução do nó: ${node.name}`);

    const context = JSON.parse(instance.currentState);
    const nodeConfig = JSON.parse(node.configuration);

    try {
      let outputData: any = {};
      let isHalted = false;

      switch (node.nodeType) {
        case 'TRIGGER':
          outputData = context;
          break;

        case 'CONDITION':
          const evaluation = ExpressionEvaluator.evaluate(nodeConfig.condition, context);
          outputData = { result: evaluation };
          await this.logExecution(instanceId, nodeExec.id, 'INFO', 'CONDITION_EVALUATED', `Condição [${node.name}] avaliada como ${evaluation}`);
          break;

        case 'LOGIC':
          if (node.blockType === 'logic.if_else') {
            const ifEvaluation = ExpressionEvaluator.evaluate(nodeConfig.condition, context);
            outputData = { result: ifEvaluation };
            await this.logExecution(instanceId, nodeExec.id, 'INFO', 'IF_ELSE_EVALUATED', `Desvio lógico se/senão avaliado como ${ifEvaluation}`);
          } else if (node.blockType === 'logic.end_success') {
            await this.prisma.workflowInstance.update({
              where: { id: instanceId },
              data: { status: 'COMPLETED', completedAt: new Date() },
            });
            await this.logExecution(instanceId, nodeExec.id, 'INFO', 'INSTANCE_COMPLETED_SUCCESS', 'Workflow finalizado com sucesso.');
          } else if (node.blockType === 'logic.end_fail') {
            await this.prisma.workflowInstance.update({
              where: { id: instanceId },
              data: { status: 'FAILED', failedAt: new Date() },
            });
            await this.logExecution(instanceId, nodeExec.id, 'ERROR', 'INSTANCE_COMPLETED_FAILED', `Workflow encerrado com erro configurado: ${nodeConfig.errorMessage || 'Falha programada'}`);
          }
          break;

        case 'HUMAN_TASK':
          const { WorkflowTaskService } = await import('./workflow-task.service');
          const taskService = this.moduleRef.get(WorkflowTaskService, { strict: false });
          const task = await taskService.createTask(instance, nodeKey, nodeConfig, context);
          await this.prisma.workflowNodeExecution.update({
            where: { id: nodeExec.id },
            data: { status: 'RUNNING' }, // Halted, waiting for task response
          });
          await this.logExecution(instanceId, nodeExec.id, 'INFO', 'TASK_CREATED', `Tarefa humana criada: "${task.title}". Execução pausada aguardando conclusão.`);
          isHalted = true;
          break;

        case 'APPROVAL':
          const { WorkflowApprovalService } = await import('./workflow-approval.service');
          const approvalService = this.moduleRef.get(WorkflowApprovalService, { strict: false });
          const approval = await approvalService.createApproval(instance, nodeKey, nodeConfig, context);
          await this.prisma.workflowNodeExecution.update({
            where: { id: nodeExec.id },
            data: { status: 'RUNNING' }, // Halted, waiting for approval response
          });
          await this.logExecution(instanceId, nodeExec.id, 'INFO', 'APPROVAL_CREATED', `Solicitação de aprovação criada. Tipo: ${approval.approvalType}. Execução pausada.`);
          isHalted = true;
          break;

        case 'TIMER':
          let delayMs = 0;
          if (nodeConfig.delayType === 'DURATION') {
            const amount = Number(nodeConfig.delayAmount || 0);
            const unit = nodeConfig.delayUnit || 'MINUTES'; // MINUTES, HOURS, DAYS
            const factor = unit === 'DAYS' ? 86400000 : unit === 'HOURS' ? 3600000 : 60000;
            delayMs = amount * factor;
          } else if (nodeConfig.delayType === 'DATE') {
            const targetDate = new Date(nodeConfig.delayDate);
            delayMs = Math.max(0, targetDate.getTime() - Date.now());
          }

          if (delayMs > 0) {
            await this.queueAdapter.enqueue('timer_trigger', { workflowInstanceId: instanceId, nodeKey }, delayMs);
            await this.prisma.workflowNodeExecution.update({
              where: { id: nodeExec.id },
              data: { status: 'RUNNING' }, // Halted, waiting for timer
            });
            await this.logExecution(instanceId, nodeExec.id, 'INFO', 'TIMER_SCHEDULED', `Timer agendado para rodar em ${new Date(Date.now() + delayMs).toISOString()}. Execução pausada.`);
            isHalted = true;
          }
          break;

        case 'ACTION':
          const { WorkflowTemplateService } = await import('./workflow-template.service');
          const templateService = this.moduleRef.get(WorkflowTemplateService, { strict: false });
          outputData = await templateService.executeActionBlock(instance, node.blockType, nodeConfig, context);
          await this.logExecution(instanceId, nodeExec.id, 'INFO', 'ACTION_EXECUTED', `Ação automática [${node.blockType}] executada com sucesso.`);
          break;

        case 'INTEGRATION':
          const { WorkflowIntegrationService } = await import('./workflow-integration.service');
          const integrationService = this.moduleRef.get(WorkflowIntegrationService, { strict: false });
          outputData = await integrationService.executeIntegrationBlock(instance, node.blockType, nodeConfig, context);
          await this.logExecution(instanceId, nodeExec.id, 'INFO', 'INTEGRATION_EXECUTED', `Integração externa [${node.blockType}] executada com sucesso.`);
          break;
      }

      if (!isHalted) {
        // Mark node execution as COMPLETED
        await this.prisma.workflowNodeExecution.update({
          where: { id: nodeExec.id },
          data: {
            status: 'COMPLETED',
            outputData: JSON.stringify(outputData),
            completedAt: new Date(),
          },
        });

        // Merge node output into context variables
        const updatedContext = { ...context, ...outputData };
        await this.prisma.workflowInstance.update({
          where: { id: instanceId },
          data: { currentState: JSON.stringify(updatedContext) },
        });

        // Trigger next connected nodes
        await this.triggerNextNodes(instanceId, nodeKey, updatedContext);
      }
    } catch (error: any) {
      this.logger.error(`Error executing node ${nodeKey} for instance ${instanceId}: ${error.message}`, error.stack);
      await this.logExecution(instanceId, nodeExec.id, 'ERROR', 'NODE_FAILED', `Falha na execução: ${error.message}`);

      // Handle Retry Policy
      const maxAttempts = Number(nodeConfig.retryPolicy?.maxAttempts ?? 1);
      const delaySeconds = Number(nodeConfig.retryPolicy?.delaySeconds ?? 10);

      if (attemptNumber < maxAttempts) {
        await this.prisma.workflowNodeExecution.update({
          where: { id: nodeExec.id },
          data: {
            status: 'PENDING',
            errorMessage: error.message,
            nextRetryAt: new Date(Date.now() + delaySeconds * 1000),
          },
        });
        await this.logExecution(instanceId, nodeExec.id, 'WARNING', 'RETRY_SCHEDULED', `Re-execução agendada (tentativa ${attemptNumber + 1}/${maxAttempts}) em ${delaySeconds}s.`);
        await this.queueAdapter.enqueue('retry_node', { workflowInstanceId: instanceId, nodeKey, attemptNumber: attemptNumber + 1 }, delaySeconds * 1000);
      } else {
        // Permanent failure
        await this.prisma.workflowNodeExecution.update({
          where: { id: nodeExec.id },
          data: {
            status: 'FAILED',
            errorMessage: error.message,
            completedAt: new Date(),
          },
        });

        // Move to dead letters and halt instance
        await this.prisma.workflowDeadLetter.create({
          data: {
            companyId: instance.companyId,
            workflowInstanceId: instanceId,
            nodeExecutionId: nodeExec.id,
            errorType: 'NODE_EXECUTION_ERROR',
            errorMessage: error.message,
            payload: JSON.stringify({ context, nodeConfig, nodeKey }),
            attempts: attemptNumber,
            status: 'UNRESOLVED',
          },
        });

        await this.prisma.workflowInstance.update({
          where: { id: instanceId },
          data: { status: 'FAILED', failedAt: new Date() },
        });

        // Notify admins about workflow failure
        const { WorkflowNotificationService } = await import('./workflow-notification.service');
        const notifService = this.moduleRef.get(WorkflowNotificationService, { strict: false });
        await notifService.notifyFailure(instance, nodeKey, error.message);
      }
    }
  }

  async resumeInstance(instanceId: string, nodeKey: string, outputData: any): Promise<void> {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance || instance.status !== 'RUNNING') {
      return;
    }

    const nodeExec = await this.prisma.workflowNodeExecution.findFirst({
      where: { workflowInstanceId: instanceId, nodeKey },
    });

    if (!nodeExec) {
      this.logger.error(`Node execution not found to resume: ${nodeKey} in instance ${instanceId}`);
      return;
    }

    this.logger.log(`Resuming execution of node ${nodeKey} for instance ${instanceId}`);

    // Update node execution to completed
    await this.prisma.workflowNodeExecution.update({
      where: { id: nodeExec.id },
      data: {
        status: 'COMPLETED',
        outputData: JSON.stringify(outputData),
        completedAt: new Date(),
      },
    });

    // Merge outputs
    const context = JSON.parse(instance.currentState);
    const updatedContext = { ...context, ...outputData };

    await this.prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { currentState: JSON.stringify(updatedContext) },
    });

    await this.logExecution(instanceId, nodeExec.id, 'INFO', 'NODE_RESUMED', `Nó retomado com sucesso.`);

    // Trigger next nodes
    await this.triggerNextNodes(instanceId, nodeKey, updatedContext);
  }

  async triggerNextNodes(instanceId: string, nodeKey: string, variables: any): Promise<void> {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: {
        workflowVersion: {
          include: {
            edges: { where: { sourceNodeKey: nodeKey } },
          },
        },
      },
    });

    if (!instance || instance.status !== 'RUNNING') {
      return;
    }

    const edges = instance.workflowVersion.edges;
    if (edges.length === 0) {
      // Check if there are other nodes executing. If no nodes are in RUNNING/PENDING status,
      // and we reached the end of all paths without hitting an End node, auto-complete the workflow
      const activeExecutions = await this.prisma.workflowNodeExecution.findMany({
        where: {
          workflowInstanceId: instanceId,
          status: { in: ['PENDING', 'RUNNING'] },
        },
      });

      if (activeExecutions.length === 0) {
        await this.prisma.workflowInstance.update({
          where: { id: instanceId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        this.logger.log(`Workflow instance ${instanceId} completed automatically (no remaining active nodes).`);
      }
      return;
    }

    for (const edge of edges) {
      let shouldFollow = true;

      // Handle conditional edge routing (from Logic / Condition nodes)
      if (edge.sourceHandle === 'true' || edge.sourceHandle === 'false') {
        const branchCondition = edge.sourceHandle === 'true';
        // The condition node execution output has { result: boolean }
        const sourceExecution = await this.prisma.workflowNodeExecution.findFirst({
          where: { workflowInstanceId: instanceId, nodeKey: edge.sourceNodeKey },
          orderBy: { startedAt: 'desc' },
        });

        if (sourceExecution && sourceExecution.outputData) {
          const output = JSON.parse(sourceExecution.outputData);
          shouldFollow = output.result === branchCondition;
        } else {
          shouldFollow = false;
        }
      }

      if (shouldFollow) {
        this.logger.log(`Following edge: ${edge.sourceNodeKey} -> ${edge.targetNodeKey} (Handle: ${edge.sourceHandle})`);
        await this.queueAdapter.enqueue('execute_node', { workflowInstanceId: instanceId, nodeKey: edge.targetNodeKey });
      }
    }
  }

  private async logExecution(
    instanceId: string,
    nodeExecutionId: string | null,
    level: 'INFO' | 'WARNING' | 'ERROR',
    eventType: string,
    message: string
  ): Promise<void> {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) return;

    await this.prisma.workflowExecutionLog.create({
      data: {
        companyId: instance.companyId,
        workflowInstanceId: instanceId,
        nodeExecutionId,
        level,
        eventType,
        message,
        details: JSON.stringify(instance.currentState),
      },
    });
  }
}
