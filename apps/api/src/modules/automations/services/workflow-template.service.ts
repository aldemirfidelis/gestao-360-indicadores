import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActionPriority, AnalysisMethod, DeviationSeverity, MeetingFormat, MeetingKind } from '@prisma/client';

@Injectable()
export class WorkflowTemplateService {
  private readonly logger = new Logger(WorkflowTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async executeActionBlock(
    instance: any,
    blockType: string,
    config: any,
    context: any
  ): Promise<any> {
    const companyId = instance.companyId;

    switch (blockType) {
      case 'action.deviation.create': {
        // Find max deviation number to auto-increment
        const aggregate = await this.prisma.deviation.aggregate({
          where: { companyId },
          _max: { number: true },
        });
        const number = (aggregate._max.number || 0) + 1;

        const deviation = await this.prisma.deviation.create({
          data: {
            companyId,
            indicatorId: context.indicatorId || instance.sourceEntityId || '',
            periodRef: context.periodRef || '2026-06',
            number,
            title: this.interpolate(config.title || 'Desvio Automático de Fluxo', context),
            severity: (config.severity as DeviationSeverity) || 'MODERATE',
            status: 'OPEN',
            method: (config.method as AnalysisMethod) || 'FCA',
            responsibleUserId: config.responsibleUserId || instance.createdByUserId || null,
          },
        });
        return { deviationId: deviation.id, deviationNumber: deviation.number };
      }

      case 'action.plan.create': {
        const plan = await this.prisma.actionPlan.create({
          data: {
            companyId,
            title: this.interpolate(config.title || 'Plano de Ação Automático', context),
            description: this.interpolate(config.description || '', context),
            origin: 'MANUAL',
            priority: (config.priority as ActionPriority) || 'MEDIUM',
            criticality: (config.criticality as ActionPriority) || 'MEDIUM',
            status: 'NOT_STARTED',
            responsibleUserId: config.responsibleUserId || null,
            indicatorId: context.indicatorId || (instance.sourceEntityType === 'INDICATOR' ? instance.sourceEntityId : null),
            deviationId: context.deviationId || (instance.sourceEntityType === 'DEVIATION' ? instance.sourceEntityId : null),
          },
        });
        return { actionPlanId: plan.id };
      }

      case 'action.meeting.create': {
        const startsAt = config.startsAtOffsetDays
          ? new Date(Date.now() + Number(config.startsAtOffsetDays) * 86400000)
          : new Date();

        const meeting = await this.prisma.meeting.create({
          data: {
            companyId,
            title: this.interpolate(config.title || 'Reunião de Alinhamento', context),
            kind: (config.kind as MeetingKind) || 'DEVIATION',
            format: (config.format as MeetingFormat) || 'ONLINE',
            status: 'SCHEDULED',
            startsAt,
            endsAt: new Date(startsAt.getTime() + 3600000), // 1 hour duration
            location: config.location || 'Online Microsoft Teams',
            objective: config.objective || 'Tratar desvio crítico detectado por automação.',
            indicatorId: context.indicatorId || (instance.sourceEntityType === 'INDICATOR' ? instance.sourceEntityId : null),
            deviationId: context.deviationId || (instance.sourceEntityType === 'DEVIATION' ? instance.sourceEntityId : null),
          },
        });
        return { meetingId: meeting.id };
      }

      case 'action.status.update': {
        const entityType = config.entityType || instance.sourceEntityType;
        const entityId = config.entityId || instance.sourceEntityId;
        const newStatus = config.status;

        if (entityType === 'INDICATOR') {
          await this.prisma.indicator.update({
            where: { id: entityId },
            data: { status: newStatus },
          });
        } else if (entityType === 'DOCUMENT') {
          await this.prisma.document.update({
            where: { id: entityId },
            data: { status: newStatus },
          });
        } else if (entityType === 'DEVIATION') {
          await this.prisma.deviation.update({
            where: { id: entityId },
            data: { status: newStatus },
          });
        }
        return { statusUpdated: true, newStatus };
      }

      case 'action.field.update': {
        const entityType = config.entityType || instance.sourceEntityType;
        const entityId = config.entityId || instance.sourceEntityId;
        const fieldName = config.fieldName;
        const fieldValue = config.fieldValue;

        if (entityType === 'INDICATOR') {
          await this.prisma.indicator.update({
            where: { id: entityId },
            data: { [fieldName]: fieldValue },
          });
        }
        return { fieldUpdated: true, fieldName, fieldValue };
      }

      case 'action.comment.create': {
        const entityType = config.entityType || instance.sourceEntityType;
        const entityId = config.entityId || instance.sourceEntityId;
        const content = this.interpolate(config.content || '', context);

        await this.prisma.comment.create({
          data: {
            refTable: entityType || 'INDICATOR',
            refId: entityId || '',
            body: content,
            userId: instance.createdById,
          },
        });
        return { commentCreated: true };
      }

      default:
        this.logger.warn(`Action block type ${blockType} not implemented.`);
        return {};
    }
  }

  async seedInitialTemplates(companyId: string): Promise<void> {
    const templatesCount = await this.prisma.workflowTemplate.count({
      where: { companyId },
    });

    if (templatesCount > 0) return;

    this.logger.log(`Seeding initial workflow templates for company ${companyId}`);

    const templates = [
      {
        name: 'Indicador fora da meta por dois meses',
        description: 'Quando um indicador ficar fora da meta por 2 meses seguidos, cria um desvio e solicita um plano de ação.',
        module: 'INDICATORS',
        category: 'TASK',
        isGlobal: false,
        templateData: JSON.stringify({
          nodes: [
            { id: '1', type: 'TRIGGER', data: { label: 'Indicador fora da meta' }, position: { x: 100, y: 100 } },
            { id: '2', type: 'CONDITION', data: { label: '2 Períodos Consecutivos?' }, position: { x: 300, y: 100 } },
            { id: '3', type: 'ACTION', data: { label: 'Criar Desvio (FCA)' }, position: { x: 500, y: 50 } },
            { id: '4', type: 'HUMAN_TASK', data: { label: 'Solicitar Plano de Ação' }, position: { x: 700, y: 50 } },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3', sourceHandle: 'true' },
            { id: 'e3', source: '3', target: '4' },
          ],
        }),
      },
      {
        name: 'Documento próximo do vencimento',
        description: 'Alerta o responsável e cria uma tarefa de revisão 30 dias antes do vencimento do documento.',
        module: 'DOCUMENTS',
        category: 'NOTIFICATION',
        isGlobal: false,
        templateData: JSON.stringify({
          nodes: [
            { id: '1', type: 'TRIGGER', data: { label: 'Documento vence em 30 dias' }, position: { x: 100, y: 100 } },
            { id: '2', type: 'HUMAN_TASK', data: { label: 'Revisar Documento' }, position: { x: 300, y: 100 } },
            { id: '3', type: 'APPROVAL', data: { label: 'Aprovação de Gestor' }, position: { x: 500, y: 100 } },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
          ],
        }),
      },
      {
        name: 'Não conformidade crítica em auditoria',
        description: 'Registra contenção imediata e notifica a diretoria quando uma NC crítica for aberta em auditoria.',
        module: 'AUDITS',
        category: 'INTEGRATION',
        isGlobal: false,
        templateData: JSON.stringify({
          nodes: [
            { id: '1', type: 'TRIGGER', data: { label: 'NC Crítica Registrada' }, position: { x: 100, y: 100 } },
            { id: '2', type: 'ACTION', data: { label: 'Criar Contenção Imediata' }, position: { x: 300, y: 100 } },
            { id: '3', type: 'INTEGRATION', data: { label: 'Enviar e-mail para Diretoria' }, position: { x: 550, y: 100 } },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
          ],
        }),
      },
      {
        name: 'Checklist reprovado',
        description: 'Bloqueia o lote do processo e exige justificativa caso o preenchimento de checklist falhe.',
        module: 'FORMS',
        category: 'APPROVAL',
        isGlobal: false,
        templateData: JSON.stringify({
          nodes: [
            { id: '1', type: 'TRIGGER', data: { label: 'Checklist Reprovado' }, position: { x: 100, y: 100 } },
            { id: '2', type: 'ACTION', data: { label: 'Bloquear Lote/Processo' }, position: { x: 300, y: 100 } },
            { id: '3', type: 'APPROVAL', data: { label: 'Aprovação da Liberação' }, position: { x: 500, y: 100 } },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
          ],
        }),
      },
      {
        name: 'Plano de ação atrasado com escalonamento',
        description: 'Escala a notificação para gerentes e diretores conforme o plano atrasa por mais períodos.',
        module: 'ACTIONS',
        category: 'NOTIFICATION',
        isGlobal: false,
        templateData: JSON.stringify({
          nodes: [
            { id: '1', type: 'TRIGGER', data: { label: 'Tarefa Vencida' }, position: { x: 100, y: 100 } },
            { id: '2', type: 'INTEGRATION', data: { label: 'Notificar Responsável' }, position: { x: 300, y: 100 } },
            { id: '3', type: 'TIMER', data: { label: 'Aguardar 3 dias' }, position: { x: 500, y: 100 } },
            { id: '4', type: 'INTEGRATION', data: { label: 'Notificar Gestor da Área' }, position: { x: 700, y: 100 } },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
            { id: 'e3', source: '3', target: '4' },
          ],
        }),
      },
    ];

    for (const t of templates) {
      await this.prisma.workflowTemplate.create({
        data: {
          companyId,
          name: t.name,
          description: t.description,
          module: t.module,
          category: t.category,
          templateData: t.templateData,
          isGlobal: false,
          status: 'ACTIVE',
        },
      });
    }
  }

  private interpolate(str: string, context: any): string {
    return str.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const parts = key.trim().split('.');
      let val = context;
      for (const p of parts) {
        if (val === null || val === undefined) return '';
        val = val[p];
      }
      return val !== undefined ? String(val) : '';
    });
  }
}
