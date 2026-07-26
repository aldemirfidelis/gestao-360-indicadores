import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { CompanyDataQueryDto } from './company-admin.dto';

type DatasetId =
  | 'users'
  | 'org-structure'
  | 'employees'
  | 'indicators'
  | 'action-plans'
  | 'risks'
  | 'non-conformities'
  | 'documents'
  | 'audit'
  | 'imports'
  | 'integration-logs';

interface DatasetDefinition {
  id: DatasetId;
  label: string;
  description: string;
  columns: Array<{ key: string; label: string }>;
}

const DATASETS: DatasetDefinition[] = [
  { id: 'users', label: 'Usuarios', description: 'Contas humanas, papeis, status e ultimo acesso.', columns: columns(['id', 'ID'], ['name', 'Nome'], ['email', 'E-mail'], ['jobTitle', 'Cargo'], ['role', 'Papel'], ['status', 'Status'], ['active', 'Ativo'], ['lastLoginAt', 'Ultimo acesso'], ['createdAt', 'Criado em']) },
  { id: 'org-structure', label: 'Estrutura organizacional', description: 'Filiais, areas, setores e hierarquia da empresa.', columns: columns(['id', 'ID'], ['parentId', 'Pai'], ['branchId', 'Filial'], ['name', 'Nome'], ['code', 'Codigo'], ['type', 'Tipo'], ['active', 'Ativo'], ['createdAt', 'Criado em'], ['updatedAt', 'Atualizado em']) },
  { id: 'employees', label: 'Colaboradores', description: 'Cadastro corporativo minimo, sem dados pessoais ou salariais sensiveis.', columns: columns(['id', 'ID'], ['registrationId', 'Matricula'], ['name', 'Nome'], ['orgNodeId', 'Area'], ['jobId', 'Cargo'], ['band', 'Faixa'], ['shift', 'Turno'], ['status', 'Status'], ['approvalStatus', 'Aprovacao'], ['createdAt', 'Criado em']) },
  { id: 'indicators', label: 'Indicadores', description: 'Catalogo de indicadores e seus responsaveis.', columns: columns(['id', 'ID'], ['code', 'Codigo'], ['name', 'Nome'], ['ownerNodeId', 'Area'], ['responsibleUserId', 'Responsavel'], ['type', 'Tipo'], ['category', 'Categoria'], ['unit', 'Unidade'], ['periodicity', 'Periodicidade'], ['direction', 'Direcao'], ['status', 'Status'], ['feedKind', 'Alimentacao'], ['updatedAt', 'Atualizado em']) },
  { id: 'action-plans', label: 'Planos de acao', description: 'Acoes, prazos, responsaveis e andamento.', columns: columns(['id', 'ID'], ['title', 'Titulo'], ['ownerNodeId', 'Area'], ['responsibleUserId', 'Responsavel'], ['origin', 'Origem'], ['priority', 'Prioridade'], ['status', 'Status'], ['startDate', 'Inicio'], ['dueDate', 'Prazo'], ['progress', 'Progresso'], ['completedAt', 'Conclusao'], ['updatedAt', 'Atualizado em']) },
  { id: 'risks', label: 'Riscos', description: 'Registro corporativo de riscos e avaliacao residual.', columns: columns(['id', 'ID'], ['title', 'Titulo'], ['orgNodeId', 'Area'], ['responsibleUserId', 'Responsavel'], ['category', 'Categoria'], ['status', 'Status'], ['probability', 'Probabilidade'], ['impact', 'Impacto'], ['residualProbability', 'Prob. residual'], ['residualImpact', 'Impacto residual'], ['dueDate', 'Prazo'], ['updatedAt', 'Atualizado em']) },
  { id: 'non-conformities', label: 'Nao conformidades', description: 'Nao conformidades, severidade, origem e situacao.', columns: columns(['id', 'ID'], ['number', 'Numero'], ['title', 'Titulo'], ['orgNodeId', 'Area'], ['responsibleUserId', 'Responsavel'], ['source', 'Origem'], ['severity', 'Severidade'], ['status', 'Status'], ['dueDate', 'Prazo'], ['identifiedAt', 'Identificada em'], ['closedAt', 'Encerrada em']) },
  { id: 'documents', label: 'Documentos', description: 'Metadados de documentos; conteudo e arquivos nao sao expostos.', columns: columns(['id', 'ID'], ['number', 'Numero'], ['code', 'Codigo'], ['title', 'Titulo'], ['orgNodeId', 'Area'], ['type', 'Tipo'], ['status', 'Status'], ['version', 'Versao'], ['validFrom', 'Vigencia inicial'], ['validUntil', 'Vigencia final'], ['publishedAt', 'Publicado em'], ['updatedAt', 'Atualizado em']) },
  { id: 'audit', label: 'Auditoria', description: 'Trilha resumida de eventos, sem payloads ou identificadores de rede.', columns: columns(['id', 'ID'], ['userId', 'Usuario'], ['action', 'Acao'], ['module', 'Modulo'], ['entity', 'Entidade'], ['entityId', 'Registro'], ['recordLabel', 'Descricao'], ['result', 'Resultado'], ['createdAt', 'Data/hora']) },
  { id: 'imports', label: 'Importacoes', description: 'Historico e resultado de cargas em lote.', columns: columns(['id', 'ID'], ['target', 'Destino'], ['fileName', 'Arquivo'], ['totalRows', 'Linhas'], ['okRows', 'Sucesso'], ['errorRows', 'Erros'], ['startedAt', 'Inicio'], ['finishedAt', 'Fim']) },
  { id: 'integration-logs', label: 'Logs de integracao', description: 'Execucoes de conectores e tempos de resposta, sem credenciais.', columns: columns(['id', 'ID'], ['integrationId', 'Integracao'], ['direction', 'Direcao'], ['operation', 'Operacao'], ['status', 'Status'], ['httpStatus', 'HTTP'], ['message', 'Mensagem'], ['latencyMs', 'Latencia (ms)'], ['createdAt', 'Data/hora']) },
];

@Injectable()
export class CompanyAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  async overview(me: AuthPayload) {
    const companyId = me.companyId;
    const [company, users, profiles, branches, areas, indicators, connectors, apiKeys, auditEvents] = await Promise.all([
      this.prisma.company.findFirst({
        where: { id: companyId, deletedAt: null },
        select: { id: true, name: true, tradeName: true, cnpj: true, status: true, active: true, maxUsers: true, slug: true, customDomain: true },
      }),
      this.prisma.user.count({ where: { companyId, deletedAt: null, serviceAccount: false } }),
      this.prisma.accessProfile.count({ where: { companyId, deletedAt: null } }),
      this.prisma.branch.count({ where: { companyId, deletedAt: null } }),
      this.prisma.orgNode.count({ where: { companyId, deletedAt: null } }),
      this.prisma.indicator.count({ where: { companyId, deletedAt: null } }),
      this.prisma.externalIntegration.count({ where: { companyId, deletedAt: null } }),
      this.prisma.inboundApiKey.count({ where: { companyId, status: 'active' } }),
      this.prisma.auditLog.count({ where: { companyId } }),
    ]);
    if (!company) throw new BadRequestException('Empresa ativa nao encontrada.');
    return { company, counts: { users, profiles, branches, areas, indicators, connectors, apiKeys, auditEvents } };
  }

  catalog() {
    return DATASETS;
  }

  async list(me: AuthPayload, datasetId: string, query: CompanyDataQueryDto) {
    const definition = this.definition(datasetId);
    const page = query.page || 1;
    const pageSize = query.pageSize || 25;
    const { rows, total } = await this.queryDataset(me.companyId, definition.id, query.search?.trim(), (page - 1) * pageSize, pageSize);
    return { dataset: definition, rows, total, page, pageSize };
  }

  async exportCsv(me: AuthPayload, datasetId: string, search?: string) {
    const definition = this.definition(datasetId);
    const { rows } = await this.queryDataset(me.companyId, definition.id, search?.trim(), 0, 5000);
    await this.auditWriter.record(me, {
      action: 'EXPORT', module: 'Dados da Empresa', entity: 'CompanyDataset', entityId: definition.id,
      message: `Exportacao da visao ${definition.label}`, payload: { dataset: definition.id, rows: rows.length },
    });
    const header = definition.columns.map((column) => csvCell(column.label)).join(';');
    const lines = rows.map((row) => definition.columns.map((column) => csvCell(formatCsvValue(row[column.key]))).join(';'));
    return `\uFEFF${[header, ...lines].join('\n')}`;
  }

  private definition(datasetId: string) {
    const definition = DATASETS.find((item) => item.id === datasetId);
    if (!definition) throw new BadRequestException('Conjunto de dados nao permitido.');
    return definition;
  }

  private async queryDataset(companyId: string, dataset: DatasetId, search: string | undefined, skip: number, take: number): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
    const contains = search ? { contains: search, mode: Prisma.QueryMode.insensitive } : undefined;
    switch (dataset) {
      case 'users': {
        const where: Prisma.UserWhereInput = { companyId, deletedAt: null, serviceAccount: false, ...(contains ? { OR: [{ name: contains }, { email: contains }, { jobTitle: contains }] } : {}) };
        const [rows, total] = await Promise.all([
          this.prisma.user.findMany({ where, select: { id: true, name: true, email: true, jobTitle: true, role: true, status: true, active: true, lastLoginAt: true, createdAt: true }, orderBy: { name: 'asc' }, skip, take }),
          this.prisma.user.count({ where }),
        ]);
        return { rows, total };
      }
      case 'org-structure': {
        const where: Prisma.OrgNodeWhereInput = { companyId, deletedAt: null, ...(contains ? { OR: [{ name: contains }, { code: contains }, { description: contains }] } : {}) };
        const [rows, total] = await Promise.all([
          this.prisma.orgNode.findMany({ where, select: { id: true, parentId: true, branchId: true, name: true, code: true, type: true, active: true, createdAt: true, updatedAt: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }], skip, take }),
          this.prisma.orgNode.count({ where }),
        ]);
        return { rows, total };
      }
      case 'employees': {
        const where: Prisma.OrgEmployeeWhereInput = { companyId, ...(contains ? { OR: [{ name: contains }, { registrationId: contains }, { status: contains }] } : {}) };
        const [rows, total] = await Promise.all([
          this.prisma.orgEmployee.findMany({ where, select: { id: true, registrationId: true, name: true, orgNodeId: true, jobId: true, band: true, shift: true, status: true, approvalStatus: true, createdAt: true }, orderBy: { name: 'asc' }, skip, take }),
          this.prisma.orgEmployee.count({ where }),
        ]);
        return { rows, total };
      }
      case 'indicators': {
        const where: Prisma.IndicatorWhereInput = { companyId, deletedAt: null, ...(contains ? { OR: [{ name: contains }, { code: contains }, { category: contains }] } : {}) };
        const [rows, total] = await Promise.all([
          this.prisma.indicator.findMany({ where, select: { id: true, code: true, name: true, ownerNodeId: true, responsibleUserId: true, type: true, category: true, unit: true, periodicity: true, direction: true, status: true, feedKind: true, updatedAt: true }, orderBy: { name: 'asc' }, skip, take }),
          this.prisma.indicator.count({ where }),
        ]);
        return { rows, total };
      }
      case 'action-plans': {
        const where: Prisma.ActionPlanWhereInput = { companyId, deletedAt: null, ...(contains ? { OR: [{ title: contains }, { description: contains }, { responsibleEmail: contains }] } : {}) };
        const [rows, total] = await Promise.all([
          this.prisma.actionPlan.findMany({ where, select: { id: true, title: true, ownerNodeId: true, responsibleUserId: true, origin: true, priority: true, status: true, startDate: true, dueDate: true, progress: true, completedAt: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, skip, take }),
          this.prisma.actionPlan.count({ where }),
        ]);
        return { rows, total };
      }
      case 'risks': {
        const where: Prisma.RiskRegisterWhereInput = { companyId, deletedAt: null, ...(contains ? { OR: [{ title: contains }, { description: contains }, { mitigationPlan: contains }] } : {}) };
        const [rows, total] = await Promise.all([
          this.prisma.riskRegister.findMany({ where, select: { id: true, title: true, orgNodeId: true, responsibleUserId: true, category: true, status: true, probability: true, impact: true, residualProbability: true, residualImpact: true, dueDate: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, skip, take }),
          this.prisma.riskRegister.count({ where }),
        ]);
        return { rows, total };
      }
      case 'non-conformities': {
        const where: Prisma.NonConformityWhereInput = { companyId, deletedAt: null, ...(contains ? { OR: [{ title: contains }, { description: contains }, { correctivePlan: contains }] } : {}) };
        const [rows, total] = await Promise.all([
          this.prisma.nonConformity.findMany({ where, select: { id: true, number: true, title: true, orgNodeId: true, responsibleUserId: true, source: true, severity: true, status: true, dueDate: true, identifiedAt: true, closedAt: true }, orderBy: { identifiedAt: 'desc' }, skip, take }),
          this.prisma.nonConformity.count({ where }),
        ]);
        return { rows, total };
      }
      case 'documents': {
        const where: Prisma.DocumentWhereInput = { companyId, deletedAt: null, ...(contains ? { OR: [{ title: contains }, { code: contains }, { description: contains }] } : {}) };
        const [rows, total] = await Promise.all([
          this.prisma.document.findMany({ where, select: { id: true, number: true, code: true, title: true, orgNodeId: true, type: true, status: true, version: true, validFrom: true, validUntil: true, publishedAt: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, skip, take }),
          this.prisma.document.count({ where }),
        ]);
        return { rows, total };
      }
      case 'audit': {
        const where: Prisma.AuditLogWhereInput = { companyId, ...(contains ? { OR: [{ action: contains }, { module: contains }, { entity: contains }, { recordLabel: contains }] } : {}) };
        const [rows, total] = await Promise.all([
          this.prisma.auditLog.findMany({ where, select: { id: true, userId: true, action: true, module: true, entity: true, entityId: true, recordLabel: true, result: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip, take }),
          this.prisma.auditLog.count({ where }),
        ]);
        return { rows, total };
      }
      case 'imports': {
        const where: Prisma.ImportJobWhereInput = { companyId, ...(contains ? { OR: [{ fileName: contains }] } : {}) };
        const [rows, total] = await Promise.all([
          this.prisma.importJob.findMany({ where, select: { id: true, target: true, fileName: true, totalRows: true, okRows: true, errorRows: true, startedAt: true, finishedAt: true }, orderBy: { startedAt: 'desc' }, skip, take }),
          this.prisma.importJob.count({ where }),
        ]);
        return { rows, total };
      }
      case 'integration-logs': {
        const where: Prisma.ExternalIntegrationLogWhereInput = { companyId, ...(contains ? { OR: [{ operation: contains }, { status: contains }, { message: contains }] } : {}) };
        const [rows, total] = await Promise.all([
          this.prisma.externalIntegrationLog.findMany({ where, select: { id: true, integrationId: true, direction: true, operation: true, status: true, httpStatus: true, message: true, latencyMs: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip, take }),
          this.prisma.externalIntegrationLog.count({ where }),
        ]);
        return { rows, total };
      }
    }
  }
}

function columns(...pairs: Array<[string, string]>) {
  return pairs.map(([key, label]) => ({ key, label }));
}

function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
