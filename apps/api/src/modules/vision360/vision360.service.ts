import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { logSwallowed } from '../../common/logging/swallow';
import { Workbook } from 'exceljs';

export interface EntitySummary {
  id: string;
  type: string;
  name: string;
  code: string | null;
  status: string;
  responsibleName: string | null;
  responsibleId: string | null;
  orgNodeName: string | null;
  orgNodeId: string | null;
  updatedAt: Date | null;
}

export interface RelationshipInfo {
  id: string; // link ID for manual links, or virtual ID for automatic links
  targetId: string;
  targetType: string;
  targetName: string;
  targetCode: string | null;
  targetStatus: string;
  targetResponsible: string | null;
  relationshipType: string;
  direction: 'DIRECT' | 'INDIRECT';
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  isMandatory: boolean;
  originType: 'AUTOMATIC' | 'MANUAL';
  path?: string; // used for indirect relationships
}

@Injectable()
export class Vision360Service {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Cabecalho do Registro e Detalhes
  async getEntitySummary(companyId: string, type: string, id: string): Promise<EntitySummary> {
    const t = type.toUpperCase();
    let name = '';
    let code: string | null = null;
    let status = 'ACTIVE';
    let responsibleName: string | null = null;
    let responsibleId: string | null = null;
    let orgNodeName: string | null = null;
    let orgNodeId: string | null = null;
    let updatedAt: Date | null = null;

    if (t === 'INDICATOR') {
      const ind = await this.prisma.indicator.findFirst({
        where: { id, companyId, deletedAt: null },
        include: { responsibleUser: true, ownerNode: true },
      });
      if (!ind) throw new NotFoundException('Indicador não encontrado');
      name = ind.name;
      code = ind.code;
      status = ind.status;
      responsibleName = ind.responsibleUser?.name ?? null;
      responsibleId = ind.responsibleUserId;
      orgNodeName = ind.ownerNode?.name ?? null;
      orgNodeId = ind.ownerNodeId;
      updatedAt = ind.updatedAt;
    } else if (t === 'PROCESS') {
      const pr = await this.prisma.process.findFirst({
        where: { id, companyId, deletedAt: null },
        include: { owner: true, orgNode: true },
      });
      if (!pr) throw new NotFoundException('Processo não encontrado');
      name = pr.name;
      code = pr.code ?? String(pr.number);
      status = pr.status;
      responsibleName = pr.owner?.name ?? null;
      responsibleId = pr.ownerUserId;
      orgNodeName = pr.orgNode?.name ?? null;
      orgNodeId = pr.orgNodeId;
      updatedAt = pr.updatedAt;
    } else if (t === 'DOCUMENT') {
      const doc = await this.prisma.document.findFirst({
        where: { id, companyId, deletedAt: null },
        include: { owner: true, orgNode: true },
      });
      if (!doc) throw new NotFoundException('Documento não encontrado');
      name = doc.title;
      code = doc.code ?? String(doc.number);
      status = doc.status;
      responsibleName = doc.owner?.name ?? null;
      responsibleId = doc.ownerUserId;
      orgNodeName = doc.orgNode?.name ?? null;
      orgNodeId = doc.orgNodeId;
      updatedAt = doc.updatedAt;
    } else if (t === 'RISK' || t === 'RISK_REGISTER') {
      const r = await this.prisma.riskRegister.findFirst({
        where: { id, companyId, deletedAt: null },
        include: { responsibleUser: true, orgNode: true },
      });
      if (!r) throw new NotFoundException('Risco não encontrado');
      name = r.title;
      code = `RISCO-${r.id.slice(0, 6)}`;
      status = r.status;
      responsibleName = r.responsibleUser?.name ?? null;
      responsibleId = r.responsibleUserId;
      orgNodeName = r.orgNode?.name ?? null;
      orgNodeId = r.orgNodeId;
      updatedAt = r.updatedAt;
    } else if (t === 'NON_CONFORMITY') {
      const nc = await this.prisma.nonConformity.findFirst({
        where: { id, companyId, deletedAt: null },
        include: { responsibleUser: true, orgNode: true },
      });
      if (!nc) throw new NotFoundException('Não conformidade não encontrada');
      name = nc.title;
      code = `NC-${nc.id.slice(0, 6)}`;
      status = nc.status;
      responsibleName = nc.responsibleUser?.name ?? null;
      responsibleId = nc.responsibleUserId;
      orgNodeName = nc.orgNode?.name ?? null;
      orgNodeId = nc.orgNodeId;
      updatedAt = nc.updatedAt;
    } else if (t === 'ACTION_PLAN') {
      const act = await this.prisma.actionPlan.findFirst({
        where: { id, companyId, deletedAt: null },
        include: { responsibleUser: true, ownerNode: true },
      });
      if (!act) throw new NotFoundException('Plano de ação não encontrado');
      name = act.title;
      code = act.originRefId ? `ACAO-${act.originRefId.slice(0,6)}` : 'AÇÃO';
      status = act.status;
      responsibleName = act.responsibleUser?.name ?? null;
      responsibleId = act.responsibleUserId;
      orgNodeName = act.ownerNode?.name ?? null;
      orgNodeId = act.ownerNodeId;
      updatedAt = act.updatedAt;
    } else if (t === 'MEETING') {
      const mt = await this.prisma.meeting.findFirst({
        where: { id, companyId, deletedAt: null },
        include: { responsibleUser: true },
      });
      if (!mt) throw new NotFoundException('Reunião não encontrada');
      name = mt.title;
      code = 'REUNIÃO';
      status = mt.status;
      responsibleName = mt.responsibleUser?.name ?? null;
      responsibleId = mt.responsibleUserId;
      updatedAt = mt.updatedAt;
    } else if (t === 'PROJECT') {
      const proj = await this.prisma.project.findFirst({
        where: { id, companyId, deletedAt: null },
        include: { company: true },
      });
      if (!proj) throw new NotFoundException('Projeto não encontrado');
      name = proj.name;
      code = 'PROJ';
      status = proj.status;
      updatedAt = proj.updatedAt;
    } else if (t === 'DEVIATION') {
      const dev = await this.prisma.deviation.findFirst({
        where: { id, companyId, deletedAt: null },
        include: { responsibleUser: true },
      });
      if (!dev) throw new NotFoundException('Desvio não encontrado');
      name = dev.title;
      code = `DESV-${dev.number}`;
      status = dev.status;
      responsibleName = dev.responsibleUser?.name ?? null;
      responsibleId = dev.responsibleUserId;
      updatedAt = dev.updatedAt;
    } else if (t === 'AUDIT') {
      const aud = await this.prisma.audit.findFirst({
        where: { id, companyId, deletedAt: null },
        include: { leadAuditor: true, orgNode: true },
      });
      if (!aud) throw new NotFoundException('Auditoria não encontrada');
      name = aud.title;
      code = aud.code ?? `AUD-${aud.number}`;
      status = aud.status;
      responsibleName = aud.leadAuditor?.name ?? null;
      responsibleId = aud.leadAuditorUserId;
      orgNodeName = aud.orgNode?.name ?? null;
      orgNodeId = aud.orgNodeId;
      updatedAt = aud.updatedAt;
    } else if (t === 'ORG_NODE' || t === 'SECTOR' || t === 'AREA') {
      const node = await this.prisma.orgNode.findFirst({
        where: { id, companyId, deletedAt: null },
        include: { responsibleUser: true },
      });
      if (!node) throw new NotFoundException('Unidade/Setor não encontrado');
      name = node.name;
      code = node.code ?? String(node.type);
      status = node.active ? 'ACTIVE' : 'INACTIVE';
      responsibleName = node.responsibleUser?.name ?? null;
      responsibleId = node.responsibleUserId;
      updatedAt = node.updatedAt;
    } else {
      // Entidade genérica
      throw new NotFoundException(`Tipo de entidade '${type}' não mapeado ou desconhecido`);
    }

    return {
      id,
      type: t,
      name,
      code,
      status,
      responsibleName,
      responsibleId,
      orgNodeName,
      orgNodeId,
      updatedAt,
    };
  }

  // 2. Breadcrumbs organizacionais (Origem e Contexto)
  async getBreadcrumbs(companyId: string, type: string, id: string): Promise<any[]> {
    const crumbs: any[] = [];
    const t = type.toUpperCase();

    // Adiciona a propria entidade primeiro
    const self = await this.getEntitySummary(companyId, type, id);

    let currentOrgNodeId = self.orgNodeId;

    // Se a propria entidade for um OrgNode, subimos a partir dela
    if (t === 'ORG_NODE' || t === 'SECTOR' || t === 'AREA') {
      currentOrgNodeId = id;
    }

    // Resolvendo hierarquia de OrgNode
    if (currentOrgNodeId) {
      let node = await this.prisma.orgNode.findUnique({
        where: { id: currentOrgNodeId },
        include: { parent: true },
      });
      while (node) {
        crumbs.unshift({
          entityType: 'ORG_NODE',
          entityId: node.id,
          label: node.name,
          type: node.type,
        });
        node = node.parentId
          ? await this.prisma.orgNode.findUnique({
              where: { id: node.parentId },
              include: { parent: true },
            })
          : null;
      }
    }

    // Adiciona o nó raiz (Empresa)
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    if (company) {
      crumbs.unshift({
        entityType: 'COMPANY',
        entityId: companyId,
        label: company.name,
      });
    }

    // Se o proprio item não for um OrgNode, coloca-o no fim do breadcrumb
    if (t !== 'ORG_NODE' && t !== 'SECTOR' && t !== 'AREA' && t !== 'COMPANY') {
      crumbs.push({
        entityType: t,
        entityId: id,
        label: self.name,
      });
    }

    return crumbs;
  }

  // 3. Obter todos os vínculos contextuais (Diretos e Indiretos)
  /** Resolve as chaves de permissao efetivas do usuario (mesma logica do RolesGuard). */
  async getUserPermissionKeys(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        permissions: { select: { permission: { select: { key: true } } } },
        accessProfile: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
      },
    });
    const keys = new Set<string>();
    user?.permissions.forEach((item) => keys.add(item.permission.key));
    user?.accessProfile?.permissions.forEach((item) => keys.add(item.permission.key));
    return [...keys];
  }

  async getRelationships(
    companyId: string,
    type: string,
    id: string,
    userPermissions: string[],
    role: string,
  ): Promise<RelationshipInfo[]> {
    const list: RelationshipInfo[] = [];

    // --- RELACIONAMENTOS AUTOMÁTICOS ---
    const autoLinks = await this.resolveAutomaticLinks(companyId, type, id);
    list.push(...autoLinks);

    // --- RELACIONAMENTOS MANUAIS ---
    const manualLinks = await this.prisma.relationshipLink.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { sourceEntityType: type, sourceEntityId: id },
          { targetEntityType: type, targetEntityId: id },
        ],
      },
      include: {
        company: true,
      },
    });

    for (const link of manualLinks) {
      const isSource = link.sourceEntityId === id && link.sourceEntityType === type;
      const tType = isSource ? link.targetEntityType : link.sourceEntityType;
      const tId = isSource ? link.targetEntityId : link.sourceEntityId;

      try {
        const summary = await this.getEntitySummary(companyId, tType, tId);
        list.push({
          id: link.id,
          targetId: tId,
          targetType: tType,
          targetName: summary.name,
          targetCode: summary.code,
          targetStatus: summary.status,
          targetResponsible: summary.responsibleName,
          relationshipType: link.relationshipType,
          direction: link.direction as 'DIRECT' | 'INDIRECT',
          criticality: link.criticality as any,
          isMandatory: link.isMandatory,
          originType: 'MANUAL',
        });
      } catch (err) {
        // Ignora vínculos manuais órfãos ou inativos temporariamente (apenas registra em debug).
        logSwallowed('vision360.resolveManualLink', err, 'debug');
      }
    }

    // --- FILTRAR POR PERMISSÕES (Segurança e Governança) ---
    // O usuário somente pode visualizar informações às quais já possua acesso no módulo original.
    // Se não tiver permissão, mostramos "Registro relacionado com acesso restrito" sem dados confidenciais.
    const isSuperAdmin = role === 'SUPER_ADMIN';
    return list.map((item) => {
      const moduleKey = this.getPermissionModule(item.targetType);
      const viewPermission = `${moduleKey}:view`;

      const hasAccess =
        isSuperAdmin ||
        userPermissions.includes(viewPermission) ||
        userPermissions.includes(`${moduleKey}:manage`) ||
        moduleKey === 'org'; // Nós organizacionais são públicos por padrão

      if (!hasAccess) {
        return {
          id: item.id,
          targetId: item.targetId,
          targetType: item.targetType,
          targetName: 'Registro relacionado com acesso restrito',
          targetCode: null,
          targetStatus: 'RESTRICTED',
          targetResponsible: null,
          relationshipType: item.relationshipType,
          direction: item.direction,
          criticality: item.criticality,
          isMandatory: item.isMandatory,
          originType: item.originType,
        };
      }
      return item;
    });
  }

  // Helper para resolver relações automáticas em tempo de execução
  private async resolveAutomaticLinks(companyId: string, type: string, id: string): Promise<RelationshipInfo[]> {
    const list: RelationshipInfo[] = [];
    const t = type.toUpperCase();

    if (t === 'INDICATOR') {
      // Planos de Ação vinculados
      const actions = await this.prisma.actionPlan.findMany({
        where: { companyId, indicatorId: id, deletedAt: null },
        include: { responsibleUser: true },
      });
      actions.forEach((a) => {
        list.push(this.mapAuto('ACTION_PLAN', a.id, a.title, null, a.status, a.responsibleUser?.name, 'monitorado_por', 'HIGH', false));
      });

      // Desvios vinculados
      const deviations = await this.prisma.deviation.findMany({
        where: { companyId, indicatorId: id, deletedAt: null },
        include: { responsibleUser: true },
      });
      deviations.forEach((d) => {
        list.push(this.mapAuto('DEVIATION', d.id, d.title, `DESV-${d.number}`, d.status, d.responsibleUser?.name, 'originou_desvio', 'CRITICAL', true));
      });

      // Reuniões vinculadas
      const meetings = await this.prisma.meeting.findMany({
        where: { companyId, indicatorId: id, deletedAt: null },
        include: { responsibleUser: true },
      });
      meetings.forEach((m) => {
        list.push(this.mapAuto('MEETING', m.id, m.title, null, m.status, m.responsibleUser?.name, 'discutido_em', 'MEDIUM', false));
      });

      // Processos vinculados
      const processes = await this.prisma.process.findMany({
        where: { companyId, indicatorId: id, deletedAt: null },
        include: { owner: true },
      });
      processes.forEach((p) => {
        list.push(this.mapAuto('PROCESS', p.id, p.name, p.code ?? String(p.number), p.status, p.owner?.name, 'calculado_em', 'HIGH', false));
      });
    }

    if (t === 'PROCESS') {
      // Documentos vinculados (Geralmente no GED ou manual, mas podemos ter FKs ou relações do prisma)
      const documents = await this.prisma.document.findMany({
        where: { companyId, indicator: { processes: { some: { id } } }, deletedAt: null },
        include: { owner: true },
      });
      documents.forEach((d) => {
        list.push(this.mapAuto('DOCUMENT', d.id, d.title, d.code ?? String(d.number), d.status, d.owner?.name, 'utiliza_documento', 'HIGH', true));
      });

      // Riscos: nao ha relacao automatica Processo<->Risco no schema atual.
      // Vinculos processo-risco sao cobertos pelos RelationshipLink manuais (getRelationships).
    }

    if (t === 'ACTION_PLAN') {
      const act = await this.prisma.actionPlan.findFirst({
        where: { id, companyId },
        include: { indicator: true, meeting: true, deviation: true },
      });
      if (act) {
        if (act.indicator) {
          list.push(this.mapAuto('INDICATOR', act.indicator.id, act.indicator.name, act.indicator.code, act.indicator.status, null, 'originado_por', 'HIGH', false));
        }
        if (act.meeting) {
          list.push(this.mapAuto('MEETING', act.meeting.id, act.meeting.title, null, act.meeting.status, null, 'definido_em', 'MEDIUM', false));
        }
        if (act.deviation) {
          list.push(this.mapAuto('DEVIATION', act.deviation.id, act.deviation.title, `DESV-${act.deviation.number}`, act.deviation.status, null, 'trata_desvio', 'CRITICAL', true));
        }
      }
    }

    return list;
  }

  private mapAuto(
    targetType: string,
    targetId: string,
    name: string,
    code: string | null,
    status: string,
    resp: string | null | undefined,
    relType: string,
    criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO',
    isMandatory: boolean,
  ): RelationshipInfo {
    return {
      id: `auto-${relType}-${targetId}`,
      targetId,
      targetType,
      targetName: name,
      targetCode: code,
      targetStatus: status,
      targetResponsible: resp ?? null,
      relationshipType: relType,
      direction: 'DIRECT',
      criticality,
      isMandatory,
      originType: 'AUTOMATIC',
    };
  }

  private getPermissionModule(type: string): string {
    const mapping: Record<string, string> = {
      INDICATOR: 'indicators',
      PROCESS: 'processes',
      DOCUMENT: 'doc',
      RISK: 'risks',
      RISK_REGISTER: 'risks',
      NON_CONFORMITY: 'nc',
      ACTION_PLAN: 'actions',
      MEETING: 'meetings',
      PROJECT: 'projects',
      DEVIATION: 'deviations',
      AUDIT: 'audits',
      ORG_NODE: 'org',
    };
    return mapping[type.toUpperCase()] ?? 'settings';
  }

  // 4. Criar vínculo manual
  async addLink(companyId: string, createdById: string, dto: {
    sourceEntityType: string;
    sourceEntityId: string;
    targetEntityType: string;
    targetEntityId: string;
    relationshipType: string;
    criticality: string;
    isMandatory: boolean;
    notes?: string;
  }) {
    // Evita vínculos duplicados ou contraditórios
    const existing = await this.prisma.relationshipLink.findFirst({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          {
            sourceEntityType: dto.sourceEntityType,
            sourceEntityId: dto.sourceEntityId,
            targetEntityType: dto.targetEntityType,
            targetEntityId: dto.targetEntityId,
          },
          {
            sourceEntityType: dto.targetEntityType,
            sourceEntityId: dto.targetEntityId,
            targetEntityType: dto.sourceEntityType,
            targetEntityId: dto.sourceEntityId,
          },
        ],
      },
    });

    if (existing) {
      throw new Error('Já existe um relacionamento entre estes registros.');
    }

    const link = await this.prisma.relationshipLink.create({
      data: {
        companyId,
        sourceEntityType: dto.sourceEntityType.toUpperCase(),
        sourceEntityId: dto.sourceEntityId,
        targetEntityType: dto.targetEntityType.toUpperCase(),
        targetEntityId: dto.targetEntityId,
        relationshipType: dto.relationshipType,
        criticality: dto.criticality,
        isMandatory: dto.isMandatory,
        originType: 'MANUAL',
        notes: dto.notes,
        createdById,
      },
    });

    // Registra trilha de auditoria
    await this.prisma.relationshipAuditLog.create({
      data: {
        companyId,
        entityType: dto.sourceEntityType,
        entityId: dto.sourceEntityId,
        eventType: 'LINK_CREATED',
        newValues: JSON.stringify(link),
        performedById: createdById,
        notes: `Criou vínculo manual com ${dto.targetEntityType} (${dto.targetEntityId})`,
      },
    });

    return link;
  }

  // 5. Remover vínculo manual
  async removeLink(companyId: string, performedById: string, linkId: string) {
    const link = await this.prisma.relationshipLink.findFirst({
      where: { id: linkId, companyId, deletedAt: null },
    });

    if (!link) {
      throw new NotFoundException('Vínculo não encontrado ou já excluído');
    }

    const updated = await this.prisma.relationshipLink.update({
      where: { id: linkId },
      data: { deletedAt: new Date() },
    });

    // Registra trilha de auditoria
    await this.prisma.relationshipAuditLog.create({
      data: {
        companyId,
        entityType: link.sourceEntityType,
        entityId: link.sourceEntityId,
        eventType: 'LINK_REMOVED',
        previousValues: JSON.stringify(link),
        performedById,
        notes: `Removeu vínculo manual com ${link.targetEntityType} (${link.targetEntityId})`,
      },
    });

    return updated;
  }

  // 6. Motor de Análise de Impacto (Simulação com BFS recursivo limitado a Profundidade 3)
  async simulateImpact(companyId: string, entityType: string, entityId: string, maxDepth = 3): Promise<any[]> {
    const visited = new Set<string>();
    const queue: { type: string; id: string; depth: number; path: string }[] = [];
    const impacts: any[] = [];

    // Adiciona o nó inicial
    queue.push({ type: entityType, id: entityId, depth: 0, path: '' });
    visited.add(`${entityType}-${entityId}`);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      if (current.depth >= maxDepth) continue;

      // Busca relacionamentos diretos para a entidade atual
      const relations = await this.getRelationships(companyId, current.type, current.id, [], 'SUPER_ADMIN');

      for (const rel of relations) {
        const key = `${rel.targetType}-${rel.targetId}`;
        if (!visited.has(key)) {
          visited.add(key);

          const path = current.path ? `${current.path} ➔ ${rel.targetType}` : `${current.type} ➔ ${rel.targetType}`;
          const depth = current.depth + 1;

          // Adiciona ao resultado final de impactos
          impacts.push({
            affectedEntityType: rel.targetType,
            affectedEntityId: rel.targetId,
            affectedName: rel.targetName,
            affectedCode: rel.targetCode,
            affectedStatus: rel.targetStatus,
            affectedResponsible: rel.targetResponsible,
            relationshipPath: path,
            impactLevel: rel.criticality,
            isMandatory: rel.isMandatory,
            impactReason: `Vínculo com ${current.type} via '${rel.relationshipType}' no nível ${depth}`,
          });

          // Enfileira para varrer o próximo nível
          queue.push({ type: rel.targetType, id: rel.targetId, depth, path });
        }
      }
    }

    return impacts;
  }

  // 7. Salvar Análise de Impacto oficial em banco e criar tarefas associadas
  async saveImpactAnalysis(companyId: string, createdById: string, dto: {
    sourceEntityType: string;
    sourceEntityId: string;
    operationType: string;
    changeSummary: string;
    previousValues?: string;
    newValues?: string;
    impactLevel: string;
    justification?: string;
    affectedItems: {
      affectedEntityType: string;
      affectedEntityId: string;
      relationshipPath: string;
      impactReason: string;
      impactLevel: string;
      recommendedAction?: string;
      requiresReview: boolean;
      requiresTask: boolean;
      responsibleUserId?: string;
      dueDate?: string;
    }[];
  }) {
    // Cria a analise mestre
    const analysis = await this.prisma.impactAnalysis.create({
      data: {
        companyId,
        sourceEntityType: dto.sourceEntityType.toUpperCase(),
        sourceEntityId: dto.sourceEntityId,
        operationType: dto.operationType,
        changeSummary: dto.changeSummary,
        previousValues: dto.previousValues,
        newValues: dto.newValues,
        impactLevel: dto.impactLevel,
        affectedRecordsCount: dto.affectedItems.length,
        justification: dto.justification,
        createdById,
        status: 'COMPLETED',
      },
    });

    // Cria os itens e tarefas correspondentes
    for (const item of dto.affectedItems) {
      const dbItem = await this.prisma.impactAnalysisItem.create({
        data: {
          companyId,
          impactAnalysisId: analysis.id,
          affectedEntityType: item.affectedEntityType,
          affectedEntityId: item.affectedEntityId,
          relationshipPath: item.relationshipPath,
          impactReason: item.impactReason,
          impactLevel: item.impactLevel,
          recommendedAction: item.recommendedAction,
          requiresReview: item.requiresReview,
          requiresTask: item.requiresTask,
          responsibleUserId: item.responsibleUserId,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          status: 'PENDING',
        },
      });

      // Se exigir criação de tarefa / plano de ação de adequação
      if (item.requiresTask && item.responsibleUserId) {
        await this.prisma.actionPlan.create({
          data: {
            companyId,
            title: `Revisão de Impacto: Adequar ${item.affectedEntityType}`,
            description: `Tarefa gerada automaticamente pelo Motor de Impacto.\nOrigem: Alteração em ${dto.sourceEntityType} (${dto.sourceEntityId})\nCausa: ${item.impactReason}\nAção recomendada: ${item.recommendedAction ?? 'Ajustar o registro afetado'}`,
            status: 'NOT_STARTED',
            priority: item.impactLevel === 'CRITICAL' || item.impactLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
            criticality: item.impactLevel === 'CRITICAL' || item.impactLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
            responsibleUserId: item.responsibleUserId,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            origin: 'MANUAL', // ou criar tipo específico se enums apoiarem
          },
        });
      }

      // Envia notificação interna para o responsável pelo registro impactado
      if (item.responsibleUserId) {
        await this.prisma.notification.create({
          data: {
            companyId,
            userId: item.responsibleUserId,
            title: `Seu registro de ${item.affectedEntityType} foi impactado`,
            body: `A alteração (${dto.operationType}) em ${dto.sourceEntityType} gerou um impacto de nível ${item.impactLevel}.\nMotivo: ${item.impactReason}.\nAdequação necessária: ${item.recommendedAction ?? 'Nenhuma cadastrada'}`,
            kind: 'MENTION', // ou notificação customizada
          },
        });
      }
    }

    return analysis;
  }

  // 8. Obter pendências para a Central de Impactos
  async getPendingImpacts(companyId: string) {
    const items = await this.prisma.impactAnalysisItem.findMany({
      where: {
        companyId,
        status: 'PENDING',
      },
      include: {
        impactAnalysis: {
          include: {
            createdBy: { select: { name: true } },
          },
        },
        responsibleUser: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((i) => ({
      id: i.id,
      impactAnalysisId: i.impactAnalysisId,
      sourceType: i.impactAnalysis.sourceEntityType,
      sourceId: i.impactAnalysis.sourceEntityId,
      operation: i.impactAnalysis.operationType,
      changeSummary: i.impactAnalysis.changeSummary,
      affectedType: i.affectedEntityType,
      affectedId: i.affectedEntityId,
      relationshipPath: i.relationshipPath,
      reason: i.impactReason,
      criticality: i.impactLevel,
      responsible: i.responsibleUser?.name ?? 'Sem responsável',
      responsibleId: i.responsibleUserId,
      dueDate: i.dueDate,
      createdAt: i.createdAt,
      createdBy: i.impactAnalysis.createdBy?.name ?? 'Sistema',
    }));
  }

  // 9. Exportar a analise de impactos para planilha Excel (XLSX)
  async exportXlsx(companyId: string, entityType: string, entityId: string): Promise<Buffer> {
    const summary = await this.getEntitySummary(companyId, entityType, entityId);
    const impacts = await this.simulateImpact(companyId, entityType, entityId);

    const wb = new Workbook();
    const sheet = wb.addWorksheet('Visão 360 - Relatório');

    // Estilo e Cabeçalho Geral
    sheet.mergeCells('A1:G1');
    sheet.getCell('A1').value = `Gestão 360 - Relatório de Impacto & Rastreabilidade`;
    sheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.addRow([]);
    sheet.addRow(['Registro Base:', summary.name, '', 'Tipo:', summary.type]);
    sheet.addRow(['Código:', summary.code ?? '-', '', 'Status:', summary.status]);
    sheet.addRow(['Responsável:', summary.responsibleName ?? '-', '', 'Última Atualização:', summary.updatedAt ? new Date(summary.updatedAt).toLocaleDateString('pt-BR') : '-']);
    sheet.addRow([]);

    // Tabela de Impactos
    sheet.addRow(['Registros Impactados / Rastreáveis', '', '', '', '', '', '']);
    sheet.mergeCells('A7:G7');
    sheet.getCell('A7').font = { name: 'Arial', size: 12, bold: true };
    sheet.getCell('A7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    const header = ['Tipo Registro', 'Código', 'Título', 'Caminho Relação', 'Criticidade', 'Obrigatório?', 'Responsável'];
    sheet.addRow(header);

    const headerRow = sheet.getRow(8);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF94A3B8' } };
    });

    for (const imp of impacts) {
      sheet.addRow([
        imp.affectedEntityType,
        imp.affectedCode ?? '-',
        imp.affectedName,
        imp.relationshipPath,
        imp.impactLevel,
        imp.isMandatory ? 'Sim' : 'Não',
        imp.affectedResponsible ?? '-',
      ]);
    }

    // Ajusta largura de colunas
    sheet.columns.forEach((col) => {
      col.width = 24;
    });

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async searchEntities(
    companyId: string,
    type: string,
    q: string,
  ): Promise<{ id: string; name: string; code: string | null; status: string }[]> {
    const t = type.toUpperCase();
    const search = q.trim();
    const TAKE = 20;

    const textWhere = (nameField: string, codeField?: string) => {
      if (!search) return {};
      const conditions: any[] = [{ [nameField]: { contains: search, mode: 'insensitive' as const } }];
      if (codeField) conditions.push({ [codeField]: { contains: search, mode: 'insensitive' as const } });
      return { OR: conditions };
    };

    if (t === 'INDICATOR') {
      const rows = await this.prisma.indicator.findMany({
        where: { companyId, deletedAt: null, ...textWhere('name', 'code') },
        take: TAKE,
        select: { id: true, name: true, code: true, status: true },
        orderBy: { name: 'asc' },
      });
      return rows.map((r) => ({ id: r.id, name: r.name, code: r.code ?? null, status: r.status }));
    }

    if (t === 'PROCESS') {
      const rows = await this.prisma.process.findMany({
        where: { companyId, deletedAt: null, ...textWhere('name', 'code') },
        take: TAKE,
        select: { id: true, name: true, code: true, status: true },
        orderBy: { name: 'asc' },
      });
      return rows.map((r) => ({ id: r.id, name: r.name, code: r.code ?? null, status: r.status }));
    }

    if (t === 'DOCUMENT') {
      const rows = await this.prisma.document.findMany({
        where: { companyId, deletedAt: null, ...textWhere('title', 'code') },
        take: TAKE,
        select: { id: true, title: true, code: true, status: true },
        orderBy: { title: 'asc' },
      });
      return rows.map((r) => ({ id: r.id, name: r.title, code: r.code ?? null, status: r.status }));
    }

    if (t === 'RISK' || t === 'RISK_REGISTER') {
      const rows = await this.prisma.riskRegister.findMany({
        where: { companyId, deletedAt: null, ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}) },
        take: TAKE,
        select: { id: true, title: true, status: true },
        orderBy: { title: 'asc' },
      });
      return rows.map((r) => ({ id: r.id, name: r.title, code: null, status: r.status }));
    }

    if (t === 'NON_CONFORMITY') {
      const rows = await this.prisma.nonConformity.findMany({
        where: { companyId, deletedAt: null, ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}) },
        take: TAKE,
        select: { id: true, title: true, status: true },
        orderBy: { title: 'asc' },
      });
      return rows.map((r) => ({ id: r.id, name: r.title, code: null, status: r.status }));
    }

    if (t === 'ACTION_PLAN') {
      const rows = await this.prisma.actionPlan.findMany({
        where: { companyId, deletedAt: null, ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}) },
        take: TAKE,
        select: { id: true, title: true, status: true },
        orderBy: { title: 'asc' },
      });
      return rows.map((r) => ({ id: r.id, name: r.title, code: null, status: r.status }));
    }

    if (t === 'MEETING') {
      const rows = await this.prisma.meeting.findMany({
        where: { companyId, deletedAt: null, ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}) },
        take: TAKE,
        select: { id: true, title: true, status: true },
        orderBy: { title: 'asc' },
      });
      return rows.map((r) => ({ id: r.id, name: r.title, code: null, status: r.status }));
    }

    if (t === 'PROJECT') {
      const rows = await this.prisma.project.findMany({
        where: { companyId, deletedAt: null, ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}) },
        take: TAKE,
        select: { id: true, name: true, status: true },
        orderBy: { name: 'asc' },
      });
      return rows.map((r) => ({ id: r.id, name: r.name, code: null, status: r.status }));
    }

    if (t === 'DEVIATION') {
      const rows = await this.prisma.deviation.findMany({
        where: { companyId, deletedAt: null, ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}) },
        take: TAKE,
        select: { id: true, title: true, number: true, status: true },
        orderBy: { title: 'asc' },
      });
      return rows.map((r) => ({ id: r.id, name: r.title, code: `DESV-${r.number}`, status: r.status }));
    }

    if (t === 'AUDIT') {
      const rows = await this.prisma.audit.findMany({
        where: { companyId, deletedAt: null, ...textWhere('title', 'code') },
        take: TAKE,
        select: { id: true, title: true, code: true, number: true, status: true },
        orderBy: { title: 'asc' },
      });
      return rows.map((r) => ({ id: r.id, name: r.title, code: r.code ?? `AUD-${r.number}`, status: r.status }));
    }

    return [];
  }

  async resolvePendingImpact(companyId: string, itemId: string, resolvedById: string) {
    const item = await this.prisma.impactAnalysisItem.findFirst({
      where: { id: itemId, companyId, status: 'PENDING' },
    });

    if (!item) {
      throw new NotFoundException('Item de impacto não encontrado ou já resolvido');
    }

    const updated = await this.prisma.impactAnalysisItem.update({
      where: { id: itemId },
      data: { status: 'DONE' },
    });

    // Registra trilha de auditoria
    await this.prisma.relationshipAuditLog.create({
      data: {
        companyId,
        entityType: item.affectedEntityType,
        entityId: item.affectedEntityId,
        eventType: 'IMPACT_RESOLVED',
        performedById: resolvedById,
        notes: `Resolveu impacto pendente associado à análise ${item.impactAnalysisId}`,
      },
    });

    return updated;
  }
}
