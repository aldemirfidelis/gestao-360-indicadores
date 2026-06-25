import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditFindingType,
  AuditModality,
  AuditType,
  NonConformitySeverity,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';

type Tx = Prisma.TransactionClient;

const DEFAULT_TYPES = [
  { name: 'Auditoria interna', code: 'INT', prefix: 'AUD-INT', category: AuditType.INTERNAL, color: '#2563eb' },
  { name: 'Auditoria externa', code: 'EXT', prefix: 'AUD-EXT', category: AuditType.EXTERNAL, color: '#7c3aed' },
  { name: 'Auditoria de processo', code: 'PROC', prefix: 'AUD-PROC', category: AuditType.PROCESS, color: '#0891b2' },
  { name: 'Auditoria de fornecedor', code: 'FORN', prefix: 'AUD-FORN', category: AuditType.SUPPLIER, color: '#d97706' },
  { name: 'Auditoria de compliance', code: 'COMP', prefix: 'AUD-COMP', category: AuditType.COMPLIANCE, color: '#be123c' },
  { name: 'Auditoria integrada', code: 'INTG', prefix: 'AUD-INTG', category: AuditType.INTEGRATED, color: '#16a34a' },
  { name: 'Follow-up de auditoria', code: 'FUP', prefix: 'AUD-FUP', category: AuditType.FOLLOW_UP, color: '#0f766e' },
];

const DEFAULT_CRITERIA = [
  { name: 'Impacto', key: 'impact', description: 'Impacto potencial caso o item falhe.', weight: 1.6 },
  { name: 'Probabilidade', key: 'probability', description: 'Chance de ocorrência ou exposição.', weight: 1.4 },
  { name: 'Recorrência', key: 'recurrence', description: 'Histórico de problemas, NCs ou reincidências.', weight: 1.2 },
  { name: 'Tempo desde a última auditoria', key: 'time_since_last_audit', description: 'Quanto maior o intervalo, maior a prioridade.', weight: 1 },
  { name: 'Exigência normativa/legal', key: 'regulatory_requirement', description: 'Obrigação normativa, legal ou contratual.', weight: 1.3 },
  { name: 'Relevância estratégica', key: 'strategic_relevance', description: 'Vínculo com objetivos e riscos críticos.', weight: 1.1 },
];

const DEFAULT_CLASSIFICATIONS = [
  { name: 'Conformidade', code: 'CONF', findingType: AuditFindingType.CONFORMITY, color: '#16a34a', level: 1 },
  { name: 'Ponto forte', code: 'STRENGTH', findingType: AuditFindingType.STRENGTH, color: '#0f766e', level: 1 },
  { name: 'Boa prática', code: 'GOOD', findingType: AuditFindingType.GOOD_PRACTICE, color: '#2563eb', level: 1 },
  { name: 'Observação', code: 'OBS', findingType: AuditFindingType.OBSERVATION, color: '#64748b', level: 2 },
  { name: 'Oportunidade de melhoria', code: 'OM', findingType: AuditFindingType.OPPORTUNITY, color: '#7c3aed', level: 2, requiresAction: true },
  { name: 'Risco identificado', code: 'RISK', findingType: AuditFindingType.IDENTIFIED_RISK, color: '#d97706', level: 3, requiresAction: true },
  { name: 'Não conformidade menor', code: 'NC-MIN', findingType: AuditFindingType.MINOR_NONCONFORMITY, severity: NonConformitySeverity.MINOR, color: '#f59e0b', level: 3, requiresNc: true },
  { name: 'Não conformidade maior', code: 'NC-MAJ', findingType: AuditFindingType.MAJOR_NONCONFORMITY, severity: NonConformitySeverity.MAJOR, color: '#dc2626', level: 4, requiresNc: true },
  { name: 'Não conformidade crítica', code: 'NC-CRI', findingType: AuditFindingType.CRITICAL_NONCONFORMITY, severity: NonConformitySeverity.CRITICAL, color: '#991b1b', level: 5, requiresNc: true },
  { name: 'Evidência insuficiente', code: 'EVID', findingType: AuditFindingType.INSUFFICIENT_EVIDENCE, color: '#ea580c', level: 3 },
];

@Injectable()
export class AuditCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaults(companyId: string, userId?: string) {
    const [types, criteria, classifications, workflow] = await Promise.all([
      this.prisma.auditTypeConfig.count({ where: { companyId, deletedAt: null } }),
      this.prisma.auditRiskCriterion.count({ where: { companyId, deletedAt: null } }),
      this.prisma.auditFindingClassification.count({ where: { companyId, deletedAt: null } }),
      this.prisma.auditWorkflow.count({ where: { companyId, deletedAt: null } }),
    ]);

    const writes: Prisma.PrismaPromise<unknown>[] = [];
    if (types === 0) {
      writes.push(
        ...DEFAULT_TYPES.map((item) =>
          this.prisma.auditTypeConfig.create({
            data: {
              companyId,
              name: item.name,
              code: item.code,
              prefix: item.prefix,
              category: item.category,
              color: item.color,
              defaultModality: AuditModality.PRESENTIAL,
              requiresChecklist: false,
              createdById: userId ?? null,
            },
          }),
        ),
      );
    }
    if (criteria === 0) {
      writes.push(
        ...DEFAULT_CRITERIA.map((item) =>
          this.prisma.auditRiskCriterion.create({
            data: { companyId, ...item, createdById: userId ?? null },
          }),
        ),
      );
    }
    if (classifications === 0) {
      writes.push(
        ...DEFAULT_CLASSIFICATIONS.map((item) =>
          this.prisma.auditFindingClassification.create({
            data: { companyId, ...item, createdById: userId ?? null },
          }),
        ),
      );
    }
    if (workflow === 0) {
      writes.push(
        this.prisma.auditWorkflow.create({
          data: {
            companyId,
            name: 'Workflow padrão de auditorias',
            description: 'Fluxo base: planejamento, execução, relatório, follow-up e encerramento.',
            steps: [
              'DRAFT',
              'WAITING_APPROVAL',
              'PLANNED',
              'SCHEDULED',
              'PREPARATION',
              'READY_EXECUTION',
              'IN_PROGRESS',
              'LEAD_REVIEW',
              'REPORT_ISSUED',
              'FOLLOW_UP',
              'COMPLETED',
              'CLOSED',
            ],
            transitions: defaultTransitions(),
            rules: { closedRequiresReopenReason: true, cancelledRequiresReason: true },
            createdById: userId ?? null,
          },
        }),
      );
    }
    if (writes.length > 0) await this.prisma.$transaction(writes);
  }

  async listTypes(me: AuthPayload) {
    await this.ensureDefaults(me.companyId, me.sub);
    return this.prisma.auditTypeConfig.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async createType(me: AuthPayload, body: any) {
    const name = requiredText(body?.name, 'Nome');
    const code = requiredText(body?.code, 'Código').toUpperCase();
    const prefix = requiredText(body?.prefix ?? code, 'Prefixo').toUpperCase();
    try {
      return await this.prisma.auditTypeConfig.create({
        data: {
          companyId: me.companyId,
          name,
          code,
          prefix,
          description: nullableText(body?.description),
          category: parseAuditType(body?.category) ?? AuditType.INTERNAL,
          defaultModality: parseModality(body?.defaultModality) ?? AuditModality.PRESENTIAL,
          color: nullableText(body?.color),
          icon: nullableText(body?.icon),
          codePattern: nullableText(body?.codePattern) ?? '{{PREFIX}}-{{YEAR}}-{{SEQ}}',
          digits: positiveInt(body?.digits, 4),
          nextNumber: positiveInt(body?.nextNumber, 1),
          active: body?.active ?? true,
          requiresChecklist: Boolean(body?.requiresChecklist),
          requiresLeadAuditor: body?.requiresLeadAuditor ?? true,
          allowsRemote: body?.allowsRemote ?? true,
          allowsMultipleStandards: body?.allowsMultipleStandards ?? true,
          workflow: jsonOrUndefined(body?.workflow),
          rules: jsonOrUndefined(body?.rules),
          createdById: me.sub,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Já existe tipo de auditoria com este código nesta empresa.');
      throw error;
    }
  }

  async updateType(me: AuthPayload, id: string, patch: any) {
    const before = await this.prisma.auditTypeConfig.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!before) throw new NotFoundException('Tipo de auditoria não encontrado.');
    const data: Prisma.AuditTypeConfigUpdateInput = {};
    if ('name' in (patch ?? {})) data.name = requiredText(patch.name, 'Nome');
    if ('code' in (patch ?? {})) data.code = requiredText(patch.code, 'Código').toUpperCase();
    if ('prefix' in (patch ?? {})) data.prefix = requiredText(patch.prefix, 'Prefixo').toUpperCase();
    if ('description' in (patch ?? {})) data.description = nullableText(patch.description);
    if ('category' in (patch ?? {})) data.category = parseAuditType(patch.category) ?? before.category;
    if ('defaultModality' in (patch ?? {})) data.defaultModality = parseModality(patch.defaultModality) ?? before.defaultModality;
    if ('color' in (patch ?? {})) data.color = nullableText(patch.color);
    if ('icon' in (patch ?? {})) data.icon = nullableText(patch.icon);
    if ('codePattern' in (patch ?? {})) data.codePattern = nullableText(patch.codePattern) ?? before.codePattern;
    if ('digits' in (patch ?? {})) data.digits = positiveInt(patch.digits, before.digits);
    if ('nextNumber' in (patch ?? {})) data.nextNumber = positiveInt(patch.nextNumber, before.nextNumber);
    if ('active' in (patch ?? {})) data.active = Boolean(patch.active);
    if ('requiresChecklist' in (patch ?? {})) data.requiresChecklist = Boolean(patch.requiresChecklist);
    if ('requiresLeadAuditor' in (patch ?? {})) data.requiresLeadAuditor = Boolean(patch.requiresLeadAuditor);
    if ('allowsRemote' in (patch ?? {})) data.allowsRemote = Boolean(patch.allowsRemote);
    if ('allowsMultipleStandards' in (patch ?? {})) data.allowsMultipleStandards = Boolean(patch.allowsMultipleStandards);
    if ('workflow' in (patch ?? {})) data.workflow = jsonOrNull(patch.workflow);
    if ('rules' in (patch ?? {})) data.rules = jsonOrNull(patch.rules);
    data.updatedById = me.sub;
    return this.prisma.auditTypeConfig.update({ where: { id }, data });
  }

  async resolveType(companyId: string, typeConfigId: string | null | undefined, type: AuditType, tx: Tx = this.prisma) {
    if (typeConfigId) {
      const config = await tx.auditTypeConfig.findFirst({ where: { id: typeConfigId, companyId, deletedAt: null, active: true } });
      if (!config) throw new NotFoundException('Tipo de auditoria configurado não encontrado.');
      return config;
    }
    const config = await tx.auditTypeConfig.findFirst({
      where: { companyId, category: type, deletedAt: null, active: true },
      orderBy: { createdAt: 'asc' },
    });
    return config;
  }

  async nextAuditCode(tx: Tx, companyId: string, typeConfigId: string | null | undefined, type: AuditType) {
    const last = await tx.audit.findFirst({ where: { companyId }, orderBy: { number: 'desc' }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;
    const config = await this.resolveType(companyId, typeConfigId, type, tx);
    if (!config) return { number, code: `AUD-${new Date().getFullYear()}-${String(number).padStart(4, '0')}` };
    const year = new Date().getFullYear();
    const startsAt = config.nextNumber;
    for (let offset = 0; offset < 200; offset++) {
      const next = startsAt + offset;
      const code = formatCode(config.codePattern, config.prefix, config.digits, next, year);
      const duplicate = await tx.audit.findFirst({ where: { companyId, code, deletedAt: null }, select: { id: true } });
      if (!duplicate) {
        await tx.auditTypeConfig.update({ where: { id: config.id }, data: { nextNumber: next + 1 } });
        return { number, code };
      }
    }
    throw new ConflictException('Não foi possível gerar um código único para a auditoria.');
  }

  async nextProgramCode(tx: Tx, companyId: string) {
    const last = await tx.auditProgram.findFirst({ where: { companyId }, orderBy: { number: 'desc' }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;
    return { number, code: `PROG-${new Date().getFullYear()}-${String(number).padStart(3, '0')}` };
  }

  async nextCode(tx: Tx, companyId: string, table: 'universe' | 'template' | 'execution' | 'finding' | 'evidence' | 'report') {
    const config: Record<typeof table, { prefix: string; model: keyof Tx }> = {
      universe: { prefix: 'UNI', model: 'auditUniverseItem' },
      template: { prefix: 'CHK', model: 'auditChecklistTemplate' },
      execution: { prefix: 'EXEC', model: 'auditChecklistExecution' },
      finding: { prefix: 'CONST', model: 'auditFinding' },
      evidence: { prefix: 'EVID', model: 'auditEvidence' },
      report: { prefix: 'RPT', model: 'auditReport' },
    };
    const item = config[table];
    const model = tx[item.model] as any;
    const prefix = `${item.prefix}-${new Date().getFullYear()}`;
    for (let seq = 1; seq <= 9999; seq++) {
      const code = `${prefix}-${String(seq).padStart(4, '0')}`;
      const duplicate = await model.findFirst({ where: { companyId, code }, select: { id: true } });
      if (!duplicate) return code;
    }
    throw new ConflictException('Não foi possível gerar um código único.');
  }
}

function formatCode(pattern: string, prefix: string, digits: number, next: number, year: number) {
  const seq = String(next).padStart(Math.max(1, digits), '0');
  return (pattern || '{{PREFIX}}-{{YEAR}}-{{SEQ}}')
    .replaceAll('{{PREFIX}}', prefix)
    .replaceAll('{{YEAR}}', String(year))
    .replaceAll('{{SEQ}}', seq);
}

function defaultTransitions() {
  return {
    DRAFT: ['WAITING_APPROVAL', 'PLANNED', 'CANCELLED'],
    WAITING_APPROVAL: ['PLANNED', 'CANCELLED'],
    PLANNED: ['SCHEDULED', 'PREPARATION', 'IN_PROGRESS', 'RESCHEDULED', 'CANCELLED'],
    SCHEDULED: ['PREPARATION', 'READY_EXECUTION', 'IN_PROGRESS', 'RESCHEDULED', 'CANCELLED'],
    PREPARATION: ['READY_EXECUTION', 'IN_PROGRESS', 'CANCELLED'],
    READY_EXECUTION: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['WAITING_COMPLEMENT', 'LEAD_REVIEW', 'COMPLETED', 'CANCELLED'],
    LEAD_REVIEW: ['WAITING_AUDITED_RESPONSE', 'REPORT_ISSUED', 'COMPLETED'],
    WAITING_AUDITED_RESPONSE: ['REPORT_ISSUED', 'FOLLOW_UP'],
    REPORT_ISSUED: ['FOLLOW_UP', 'COMPLETED', 'CLOSED'],
    FOLLOW_UP: ['COMPLETED', 'CLOSED'],
    COMPLETED: ['CLOSED', 'FOLLOW_UP'],
    SUSPENDED: ['PLANNED', 'RESCHEDULED', 'CANCELLED'],
    RESCHEDULED: ['PLANNED', 'SCHEDULED', 'CANCELLED'],
  };
}

function requiredText(value: unknown, field: string) {
  const text = String(value ?? '').trim();
  if (!text) throw new BadRequestException(`${field} é obrigatório.`);
  return text;
}

function nullableText(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || null;
}

function positiveInt(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) throw new BadRequestException('Valor numérico inválido.');
  return Math.round(n);
}

function parseAuditType(value: unknown): AuditType | undefined {
  if (!value) return undefined;
  if (!Object.values(AuditType).includes(value as AuditType)) throw new BadRequestException('Tipo de auditoria inválido.');
  return value as AuditType;
}

function parseModality(value: unknown): AuditModality | undefined {
  if (!value) return undefined;
  if (!Object.values(AuditModality).includes(value as AuditModality)) throw new BadRequestException('Modalidade inválida.');
  return value as AuditModality;
}

function jsonOrUndefined(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function jsonOrNull(value: unknown) {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
