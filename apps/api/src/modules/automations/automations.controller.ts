import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowValidationService } from './services/workflow-validation.service';
import { WorkflowSimulationService } from './services/workflow-simulation.service';
import { WorkflowExecutionEngine } from './services/workflow-engine.service';
import { WorkflowApprovalService } from './services/workflow-approval.service';
import { WorkflowTaskService } from './services/workflow-task.service';
import { WorkflowTemplateService } from './services/workflow-template.service';

@Controller('automations')
export class AutomationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validationService: WorkflowValidationService,
    private readonly simulationService: WorkflowSimulationService,
    private readonly executionEngine: WorkflowExecutionEngine,
    private readonly approvalService: WorkflowApprovalService,
    private readonly taskService: WorkflowTaskService,
    private readonly templateService: WorkflowTemplateService
  ) {}

  // =====================================================
  // WORKFLOW DEFINITIONS
  // =====================================================

  @Get('workflows')
  @RequirePermissions('automations:view')
  async getWorkflows(@CurrentUser() me: AuthPayload, @Query('module') module?: string) {
    // Seed templates for the company if empty, to ensure out-of-the-box availability
    await this.templateService.seedInitialTemplates(me.companyId);

    return this.prisma.workflowDefinition.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(module ? { module } : {}),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Get('workflows/:id')
  @RequirePermissions('automations:view')
  async getWorkflow(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.prisma.workflowDefinition.findFirstOrThrow({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
  }

  @Post('workflows')
  @RequirePermissions('automations:manage')
  async createWorkflow(
    @CurrentUser() me: AuthPayload,
    @Body() body: { name: string; description?: string; module: string; category: string }
  ) {
    return this.prisma.workflowDefinition.create({
      data: {
        companyId: me.companyId,
        name: body.name,
        description: body.description,
        module: body.module,
        category: body.category,
        status: 'DRAFT',
        createdById: me.sub,
        updatedById: me.sub,
      },
    });
  }

  @Put('workflows/:id')
  @RequirePermissions('automations:manage')
  async updateWorkflow(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { name: string; description?: string; status?: string }
  ) {
    return this.prisma.workflowDefinition.update({
      where: { id, companyId: me.companyId },
      data: {
        name: body.name,
        description: body.description,
        ...(body.status ? { status: body.status } : {}),
        updatedById: me.sub,
      },
    });
  }

  @Delete('workflows/:id')
  @RequirePermissions('automations:manage')
  async deleteWorkflow(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.prisma.workflowDefinition.update({
      where: { id, companyId: me.companyId },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  @Post('workflows/:id/duplicate')
  @RequirePermissions('automations:manage')
  async duplicateWorkflow(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const origin = await this.prisma.workflowDefinition.findFirstOrThrow({
      where: { id, companyId: me.companyId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    const copy = await this.prisma.workflowDefinition.create({
      data: {
        companyId: me.companyId,
        name: `${origin.name} (Cópia)`,
        description: origin.description,
        module: origin.module,
        category: origin.category,
        status: 'DRAFT',
        createdById: me.sub,
        updatedById: me.sub,
      },
    });

    if (origin.versions.length > 0) {
      const v = origin.versions[0];
      await this.prisma.workflowVersion.create({
        data: {
          companyId: me.companyId,
          workflowDefinitionId: copy.id,
          versionNumber: 1,
          status: 'DRAFT',
          canvasData: v.canvasData,
          configurationSnapshot: v.configurationSnapshot,
          changeSummary: 'Duplicado do fluxo original',
          createdById: me.sub,
        },
      });
    }

    return copy;
  }

  // =====================================================
  // WORKFLOW VERSIONS
  // =====================================================

  @Get('workflows/:id/versions')
  @RequirePermissions('automations:view')
  async getVersions(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.prisma.workflowVersion.findMany({
      where: { workflowDefinitionId: id, companyId: me.companyId },
      include: {
        createdBy: { select: { id: true, name: true } },
        publishedBy: { select: { id: true, name: true } },
      },
      orderBy: { versionNumber: 'desc' },
    });
  }

  @Post('workflows/:id/versions')
  @RequirePermissions('automations:manage')
  async createVersion(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { canvasData: string; configurationSnapshot: string; changeSummary?: string }
  ) {
    const lastVersion = await this.prisma.workflowVersion.findFirst({
      where: { workflowDefinitionId: id, companyId: me.companyId },
      orderBy: { versionNumber: 'desc' },
    });

    const nextNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    return this.prisma.workflowVersion.create({
      data: {
        companyId: me.companyId,
        workflowDefinitionId: id,
        versionNumber: nextNumber,
        status: 'DRAFT',
        canvasData: body.canvasData,
        configurationSnapshot: body.configurationSnapshot,
        changeSummary: body.changeSummary || `Versão ${nextNumber}`,
        createdById: me.sub,
      },
    });
  }

  @Get('workflow-versions/:id')
  @RequirePermissions('automations:view')
  async getVersionDetails(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.prisma.workflowVersion.findFirstOrThrow({
      where: { id, companyId: me.companyId },
      include: { workflowDefinition: true },
    });
  }

  @Post('workflow-versions/:id/validate')
  @RequirePermissions('automations:manage')
  async validateVersion(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const version = await this.prisma.workflowVersion.findFirstOrThrow({
      where: { id, companyId: me.companyId },
    });

    const { nodes, edges } = JSON.parse(version.canvasData || '{"nodes":[],"edges":[]}');
    const errors = this.validationService.validateGraph(nodes, edges);

    return { valid: errors.filter(e => e.severity === 'ERROR').length === 0, errors };
  }

  @Post('workflow-versions/:id/simulate')
  @RequirePermissions('automations:manage')
  async simulateVersion(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { initialContext?: any }
  ) {
    const version = await this.prisma.workflowVersion.findFirstOrThrow({
      where: { id, companyId: me.companyId },
    });

    const { nodes, edges } = JSON.parse(version.canvasData || '{"nodes":[],"edges":[]}');
    const initialContext = body.initialContext || {};
    initialContext.companyId = me.companyId;
    initialContext.userId = me.sub;

    return this.simulationService.simulate(nodes, edges, initialContext);
  }

  @Post('workflow-versions/:id/publish')
  @RequirePermissions('automations:publish')
  async publishVersion(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const version = await this.prisma.workflowVersion.findFirstOrThrow({
      where: { id, companyId: me.companyId },
    });

    const { nodes, edges } = JSON.parse(version.canvasData || '{"nodes":[],"edges":[]}');
    const validationErrors = this.validationService.validateGraph(nodes, edges);

    if (validationErrors.some((e) => e.severity === 'ERROR')) {
      throw new Error('Não é possível publicar um fluxo com erros de validação críticos.');
    }

    // Unpublish previous versions
    await this.prisma.workflowVersion.updateMany({
      where: { workflowDefinitionId: version.workflowDefinitionId, companyId: me.companyId, status: 'PUBLISHED' },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });

    // Publish this version
    const published = await this.prisma.workflowVersion.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedById: me.sub,
      },
    });

    // Update parent definition
    await this.prisma.workflowDefinition.update({
      where: { id: version.workflowDefinitionId },
      data: {
        status: 'ACTIVE',
        activeVersionId: published.id,
      },
    });

    // Save snapshot nodes in table for trace mappings
    await this.prisma.workflowNode.deleteMany({ where: { workflowVersionId: id } });
    await this.prisma.workflowEdge.deleteMany({ where: { workflowVersionId: id } });

    for (const node of nodes) {
      await this.prisma.workflowNode.create({
        data: {
          companyId: me.companyId,
          workflowVersionId: id,
          nodeKey: node.id,
          nodeType: node.type || 'ACTION',
          blockType: node.data?.blockType || node.type || '',
          name: node.data?.label || node.name || 'Nó',
          positionX: node.position?.x || 0,
          positionY: node.position?.y || 0,
          configuration: JSON.stringify(node.data?.config || {}),
        },
      });
    }

    for (const edge of edges) {
      await this.prisma.workflowEdge.create({
        data: {
          companyId: me.companyId,
          workflowVersionId: id,
          sourceNodeKey: edge.source,
          targetNodeKey: edge.target,
          sourceHandle: edge.sourceHandle || null,
          targetHandle: edge.targetHandle || null,
          conditionLabel: edge.label || null,
        },
      });
    }

    return published;
  }

  // =====================================================
  // WORKFLOW INSTANCES & EXECUTIONS
  // =====================================================

  @Get('workflow-instances')
  @RequirePermissions('automations:view')
  async getInstances(
    @CurrentUser() me: AuthPayload,
    @Query('status') status?: string,
    @Query('definitionId') definitionId?: string
  ) {
    return this.prisma.workflowInstance.findMany({
      where: {
        companyId: me.companyId,
        ...(status ? { status } : {}),
        ...(definitionId ? { workflowDefinitionId: definitionId } : {}),
      },
      include: {
        workflowDefinition: { select: { name: true, module: true } },
        workflowVersion: { select: { versionNumber: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  @Get('workflow-instances/:id')
  @RequirePermissions('automations:view')
  async getInstanceDetails(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.prisma.workflowInstance.findFirstOrThrow({
      where: { id, companyId: me.companyId },
      include: {
        workflowDefinition: true,
        workflowVersion: true,
        nodeExecutions: { orderBy: { startedAt: 'asc' } },
        logs: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  @Post('workflow-instances/:id/retry')
  @RequirePermissions('automations:execute')
  async retryInstance(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const instance = await this.prisma.workflowInstance.findFirstOrThrow({
      where: { id, companyId: me.companyId },
      include: { nodeExecutions: { where: { status: 'FAILED' } } },
    });

    if (instance.status !== 'FAILED') {
      throw new Error('Apenas instâncias em estado falho podem ser reprocessadas.');
    }

    // Set instance state to running
    await this.prisma.workflowInstance.update({
      where: { id },
      data: { status: 'RUNNING', failedAt: null },
    });

    // Re-trigger execution of failed nodes
    for (const failedExec of instance.nodeExecutions) {
      await this.executionEngine.processNode(id, failedExec.nodeKey, failedExec.attemptNumber, me.companyId);
    }

    return { status: 'RELAUNCHED' };
  }

  @Post('workflow-instances/:id/cancel')
  @RequirePermissions('automations:execute')
  async cancelInstance(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.prisma.workflowInstance.update({
      where: { id, companyId: me.companyId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  // =====================================================
  // WORKFLOW APPROVALS
  // =====================================================

  @Get('workflow-approvals')
  @RequirePermissions('automations:view')
  async getApprovals(@CurrentUser() me: AuthPayload, @Query('status') status?: string) {
    return this.prisma.workflowApproval.findMany({
      where: {
        companyId: me.companyId,
        ...(status ? { status } : {}),
        approverId: me.sub, // Show approvals assigned to me
      },
      include: {
        workflowInstance: {
          include: { workflowDefinition: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('workflow-approvals/:id/approve')
  @RequirePermissions('automations:approve')
  async approveApproval(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { comments?: string }
  ) {
    const result = await this.approvalService.submitDecision(
      me.companyId,
      id,
      'APPROVED',
      body.comments || 'Aprovado via Central',
      me.sub
    );

    // Resume execution
    await this.executionEngine.resumeInstance(
      result.workflowInstanceId,
      result.nodeKey,
      {
        approved: true,
        approverId: me.sub,
        respondedAt: new Date(),
      },
      me.companyId,
    );

    return result;
  }

  @Post('workflow-approvals/:id/reject')
  @RequirePermissions('automations:approve')
  async rejectApproval(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { comments?: string }
  ) {
    const result = await this.approvalService.submitDecision(
      me.companyId,
      id,
      'REJECTED',
      body.comments || 'Reprovado via Central',
      me.sub
    );

    // Resume execution with negative outcome
    await this.executionEngine.resumeInstance(
      result.workflowInstanceId,
      result.nodeKey,
      {
        approved: false,
        approverId: me.sub,
        respondedAt: new Date(),
      },
      me.companyId,
    );

    return result;
  }

  // =====================================================
  // WORKFLOW HUMAN TASKS
  // =====================================================

  @Get('workflow-tasks')
  @RequirePermissions('automations:view')
  async getWorkflowTasks(@CurrentUser() me: AuthPayload, @Query('status') status?: string) {
    return this.prisma.workflowTask.findMany({
      where: {
        companyId: me.companyId,
        ...(status ? { status } : {}),
        responsibleId: me.sub,
      },
      include: {
        workflowInstance: {
          include: { workflowDefinition: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('workflow-tasks/:id/complete')
  @RequirePermissions('automations:execute')
  async completeWorkflowTask(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { evidenceNotes?: string }
  ) {
    const task = await this.prisma.workflowTask.findFirstOrThrow({
      where: { id, companyId: me.companyId, status: 'PENDING' },
    });

    const updatedTask = await this.prisma.workflowTask.update({
      where: { id },
      data: {
        status: 'DONE',
        completedAt: new Date(),
      },
    });

    // Resume execution
    await this.executionEngine.resumeInstance(
      task.workflowInstanceId,
      task.nodeKey,
      {
        completed: true,
        taskCompletedById: me.sub,
        evidenceNotes: body.evidenceNotes || '',
      },
      me.companyId,
    );

    return updatedTask;
  }

  // =====================================================
  // QUEUE FAILURES & DEAD LETTERS
  // =====================================================

  @Get('dead-letters')
  @RequirePermissions('automations:admin')
  async getDeadLetters(@CurrentUser() me: AuthPayload) {
    return this.prisma.workflowDeadLetter.findMany({
      where: { companyId: me.companyId },
      include: {
        workflowInstance: {
          include: { workflowDefinition: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('dead-letters/:id/resolve')
  @RequirePermissions('automations:admin')
  async resolveDeadLetter(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const dl = await this.prisma.workflowDeadLetter.findFirstOrThrow({
      where: { id, companyId: me.companyId, status: 'UNRESOLVED' },
    });

    await this.prisma.workflowDeadLetter.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedById: me.sub,
        resolvedAt: new Date(),
      },
    });

    // Force relaunch the failed instance
    await this.prisma.workflowInstance.update({
      where: { id: dl.workflowInstanceId },
      data: { status: 'RUNNING', failedAt: null },
    });

    const nodeExec = await this.prisma.workflowNodeExecution.findFirstOrThrow({
      where: { id: dl.nodeExecutionId!, workflowInstanceId: dl.workflowInstanceId, companyId: me.companyId },
    });

    await this.executionEngine.processNode(dl.workflowInstanceId, nodeExec.nodeKey, 1, me.companyId);

    return { resolved: true };
  }

  // =====================================================
  // CATALOG & TEMPLATES
  // =====================================================

  @Get('workflow-templates')
  @RequirePermissions('automations:view')
  async getTemplates(@CurrentUser() me: AuthPayload) {
    await this.templateService.seedInitialTemplates(me.companyId);

    return this.prisma.workflowTemplate.findMany({
      where: {
        OR: [
          { companyId: me.companyId },
          { isGlobal: true },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post('workflow-templates/:id/use')
  @RequirePermissions('automations:manage')
  async useTemplate(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    const template = await this.prisma.workflowTemplate.findFirstOrThrow({
      where: {
        id,
        OR: [
          { companyId: me.companyId },
          { isGlobal: true },
        ],
      },
    });

    const copy = await this.prisma.workflowDefinition.create({
      data: {
        companyId: me.companyId,
        name: template.name,
        description: template.description,
        module: template.module,
        category: template.category,
        status: 'DRAFT',
        createdById: me.sub,
        updatedById: me.sub,
      },
    });

    await this.prisma.workflowVersion.create({
      data: {
        companyId: me.companyId,
        workflowDefinitionId: copy.id,
        versionNumber: 1,
        status: 'DRAFT',
        canvasData: template.templateData,
        configurationSnapshot: '{}',
        changeSummary: 'Criado a partir do modelo',
        createdById: me.sub,
      },
    });

    return copy;
  }
}
