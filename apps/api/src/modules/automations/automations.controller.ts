import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
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

  // =====================================================
  // CHANGE HISTORY (auditoria real de design dos fluxos)
  // =====================================================

  @Get('history')
  @RequirePermissions('automations:view')
  async getHistory(@CurrentUser() me: AuthPayload) {
    const [definitions, versions] = await Promise.all([
      this.prisma.workflowDefinition.findMany({
        where: { companyId: me.companyId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          deletedAt: true,
          updatedAt: true,
          createdBy: { select: { name: true } },
          updatedBy: { select: { name: true } },
        },
      }),
      this.prisma.workflowVersion.findMany({
        where: { companyId: me.companyId },
        select: {
          id: true,
          versionNumber: true,
          changeSummary: true,
          createdAt: true,
          publishedAt: true,
          archivedAt: true,
          workflowDefinition: { select: { name: true } },
          createdBy: { select: { name: true } },
          publishedBy: { select: { name: true } },
        },
      }),
    ]);

    type HistoryEvent = {
      id: string;
      workflowName: string;
      versionNumber: number | null;
      action: 'CREATE' | 'UPDATE' | 'PUBLISH' | 'ARCHIVE' | 'DUPLICATE';
      actorName: string;
      changeSummary: string;
      createdAt: Date;
    };
    const events: HistoryEvent[] = [];

    for (const d of definitions) {
      events.push({
        id: `def-create-${d.id}`,
        workflowName: d.name,
        versionNumber: null,
        action: 'CREATE',
        actorName: d.createdBy?.name ?? 'Sistema',
        changeSummary: 'Criação inicial da definição de fluxo.',
        createdAt: d.createdAt,
      });
      if (d.deletedAt) {
        events.push({
          id: `def-archive-${d.id}`,
          workflowName: d.name,
          versionNumber: null,
          action: 'ARCHIVE',
          actorName: d.updatedBy?.name ?? d.createdBy?.name ?? 'Sistema',
          changeSummary: 'Definição de fluxo arquivada/desativada.',
          createdAt: d.deletedAt,
        });
      }
    }

    for (const v of versions) {
      const wfName = v.workflowDefinition?.name ?? '—';
      events.push({
        id: `ver-create-${v.id}`,
        workflowName: wfName,
        versionNumber: v.versionNumber,
        action: v.versionNumber > 1 ? 'UPDATE' : 'CREATE',
        actorName: v.createdBy?.name ?? 'Sistema',
        changeSummary: v.changeSummary ?? `Versão v${v.versionNumber} criada.`,
        createdAt: v.createdAt,
      });
      if (v.publishedAt) {
        events.push({
          id: `ver-publish-${v.id}`,
          workflowName: wfName,
          versionNumber: v.versionNumber,
          action: 'PUBLISH',
          actorName: v.publishedBy?.name ?? v.createdBy?.name ?? 'Sistema',
          changeSummary: `Versão v${v.versionNumber} publicada e ativada.`,
          createdAt: v.publishedAt,
        });
      }
      if (v.archivedAt) {
        events.push({
          id: `ver-archive-${v.id}`,
          workflowName: wfName,
          versionNumber: v.versionNumber,
          action: 'ARCHIVE',
          actorName: v.publishedBy?.name ?? v.createdBy?.name ?? 'Sistema',
          changeSummary: `Versão v${v.versionNumber} arquivada.`,
          createdAt: v.archivedAt,
        });
      }
    }

    events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return events;
  }

  // =====================================================
  // SLA POLICIES & ESCALATIONS (prazos reais)
  // Incidentes derivados das WorkflowTask atrasadas (dado real, sem mock).
  // =====================================================

  @Get('sla-policies')
  @RequirePermissions('automations:view')
  async getSlaPolicies(@CurrentUser() me: AuthPayload) {
    const [policies, overdue] = await Promise.all([
      this.prisma.slaPolicy.findMany({ where: { companyId: me.companyId }, orderBy: { createdAt: 'asc' } }),
      this.getOverdueTasks(me.companyId),
    ]);
    const byModule = new Map<string, number>();
    for (const t of overdue) {
      const mod = t.workflowInstance?.workflowDefinition?.module ?? 'OUTROS';
      byModule.set(mod, (byModule.get(mod) ?? 0) + 1);
    }
    return policies.map((p) => ({
      id: p.id,
      name: p.name,
      module: p.module,
      limitLabel: p.limitLabel,
      active: p.active,
      escalationSteps: this.parseSteps(p.escalationSteps),
      activeCount: byModule.get(p.module) ?? 0,
    }));
  }

  @Post('sla-policies')
  @RequirePermissions('automations:manage')
  async createSlaPolicy(
    @CurrentUser() me: AuthPayload,
    @Body() body: { name: string; module: string; limitLabel: string; escalationSteps?: string[]; active?: boolean }
  ) {
    if (!body?.name?.trim() || !body?.module?.trim() || !body?.limitLabel?.trim()) {
      throw new Error('Nome, módulo e prazo são obrigatórios.');
    }
    return this.prisma.slaPolicy.create({
      data: {
        companyId: me.companyId,
        name: body.name.trim(),
        module: body.module.trim(),
        limitLabel: body.limitLabel.trim(),
        escalationSteps: JSON.stringify(Array.isArray(body.escalationSteps) ? body.escalationSteps.filter((s) => s?.trim()) : []),
        active: body.active ?? true,
        createdById: me.sub,
      },
    });
  }

  @Put('sla-policies/:id')
  @RequirePermissions('automations:manage')
  async updateSlaPolicy(
    @CurrentUser() me: AuthPayload,
    @Param('id') id: string,
    @Body() body: { name?: string; module?: string; limitLabel?: string; escalationSteps?: string[]; active?: boolean }
  ) {
    const existing = await this.prisma.slaPolicy.findFirst({ where: { id, companyId: me.companyId } });
    if (!existing) throw new Error('Política de SLA não encontrada.');
    return this.prisma.slaPolicy.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.module !== undefined ? { module: body.module.trim() } : {}),
        ...(body.limitLabel !== undefined ? { limitLabel: body.limitLabel.trim() } : {}),
        ...(body.escalationSteps !== undefined ? { escalationSteps: JSON.stringify(body.escalationSteps.filter((s) => s?.trim())) } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    });
  }

  @Delete('sla-policies/:id')
  @RequirePermissions('automations:manage')
  async deleteSlaPolicy(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    await this.prisma.slaPolicy.deleteMany({ where: { id, companyId: me.companyId } });
    return { deleted: true };
  }

  @Get('escalations')
  @RequirePermissions('automations:view')
  async getEscalations(@CurrentUser() me: AuthPayload) {
    const now = new Date();
    const [overdue, completed, policiesCount] = await Promise.all([
      this.getOverdueTasks(me.companyId),
      this.prisma.workflowTask.findMany({
        where: { companyId: me.companyId, status: 'DONE', dueAt: { not: null }, completedAt: { not: null } },
        select: { dueAt: true, completedAt: true },
      }),
      this.prisma.slaPolicy.count({ where: { companyId: me.companyId, active: true } }),
    ]);

    const events = overdue.map((t) => {
      const due = t.dueAt as Date;
      const overdueDays = Math.max(0, Math.ceil((now.getTime() - due.getTime()) / 86400000));
      const level = t.escalationLevel ?? 0;
      const status: 'PENDING' | 'ESCALATED' = level > 0 ? 'ESCALATED' : 'PENDING';
      return {
        id: t.id,
        workflowName: t.workflowInstance?.workflowDefinition?.name ?? '—',
        taskTitle: t.title,
        responsibleName: t.responsible?.name ?? 'Não atribuído',
        dueAt: due,
        overdueDays,
        level,
        status,
      };
    });

    const onTimeCount = completed.filter((t) => t.completedAt && t.dueAt && t.completedAt <= t.dueAt).length;
    const onTimeRate = completed.length > 0 ? Math.round((onTimeCount / completed.length) * 1000) / 10 : null;

    return {
      events,
      metrics: {
        onTimeRate,
        activeAlarms: events.length,
        level2plus: events.filter((e) => e.level >= 2).length,
        policiesCount,
      },
    };
  }

  @Post('escalations/:taskId/extend')
  @RequirePermissions('automations:manage')
  async extendTaskDeadline(
    @CurrentUser() me: AuthPayload,
    @Param('taskId') taskId: string,
    @Body() body: { days?: number }
  ) {
    const task = await this.prisma.workflowTask.findFirst({ where: { id: taskId, companyId: me.companyId } });
    if (!task) throw new Error('Tarefa não encontrada.');
    const days = Math.max(1, Math.min(60, Number(body?.days) || 3));
    const base = task.dueAt && task.dueAt > new Date() ? task.dueAt : new Date();
    const newDue = new Date(base.getTime() + days * 86400000);
    return this.prisma.workflowTask.update({ where: { id: taskId }, data: { dueAt: newDue } });
  }

  private async getOverdueTasks(companyId: string) {
    return this.prisma.workflowTask.findMany({
      where: {
        companyId,
        status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] },
        dueAt: { lt: new Date() },
      },
      include: {
        responsible: { select: { name: true } },
        workflowInstance: { include: { workflowDefinition: { select: { name: true, module: true } } } },
      },
      orderBy: { dueAt: 'asc' },
    });
  }

  private parseSteps(raw: string): string[] {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
    } catch {
      return [];
    }
  }
}
