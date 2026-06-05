import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FormApprovalDecision,
  FormExecutionStatus,
  FormFieldType,
  FormIssueStatus,
  FormOperationalRecordStatus,
  FormSubmissionStatus,
  FormTemplateStatus,
  FormTemplateType,
  Prisma,
  TraceEntityType,
  TraceEventType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { AccessService } from '../access/access.service';
import type { AreaAction } from '../access/access.logic';
import { AuthPayload } from '../auth/auth.types';
import { FormCodeService } from './form-code.service';
import { FormStorageService } from './form-storage.service';

const MODULE = 'forms';
const EXECUTABLE_TEMPLATE_STATUSES = new Set<FormTemplateStatus>([
  FormTemplateStatus.ACTIVE,
  FormTemplateStatus.PUBLISHED,
  FormTemplateStatus.APPROVED,
]);
const COMPLETED_SUBMISSION_STATUSES = new Set<FormSubmissionStatus>([
  FormSubmissionStatus.SUBMITTED,
  FormSubmissionStatus.REVIEWED,
  FormSubmissionStatus.APPROVED,
  FormSubmissionStatus.CLOSED,
]);

type TemplateFilters = {
  status?: string;
  type?: string;
  search?: string;
  orgNodeId?: string;
  processId?: string;
  indicatorId?: string;
};

type ExecutionFilters = {
  status?: string;
  templateId?: string;
  assignedToId?: string;
  search?: string;
};

type LinkInput = {
  orgNodeId?: string | null;
  processId?: string | null;
  indicatorId?: string | null;
  ownerUserId?: string | null;
};

type CatalogInput = {
  typeConfigId?: string | null;
  categoryId?: string | null;
  folderId?: string | null;
};

type Tx = Prisma.TransactionClient;

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly access: AccessService,
    private readonly codes: FormCodeService,
    private readonly storage: FormStorageService,
  ) {}

  private templateInclude() {
    return {
      typeConfig: { select: { id: true, name: true, code: true, color: true, icon: true, category: true } },
      category: { select: { id: true, name: true, color: true, icon: true } },
      folder: { select: { id: true, name: true, path: true } },
      orgNode: { select: { id: true, name: true, type: true } },
      process: { select: { id: true, number: true, code: true, name: true, orgNodeId: true, indicator: { select: { ownerNodeId: true } } } },
      indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } },
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      versions: { where: { deletedAt: null }, orderBy: { versionNumber: 'desc' as const }, take: 6 },
      sections: { where: { deletedAt: null }, orderBy: { position: 'asc' as const } },
      fields: { where: { deletedAt: null }, orderBy: { order: 'asc' as const }, include: { optionsV2: { where: { active: true }, orderBy: { position: 'asc' as const } } } },
      _count: { select: { submissions: true, versions: true, executions: true, issues: true } },
    };
  }

  private submissionInclude() {
    return {
      template: {
        include: {
          fields: { where: { deletedAt: null }, orderBy: { order: 'asc' as const } },
          orgNode: { select: { id: true } },
          process: { select: { orgNodeId: true, indicator: { select: { ownerNodeId: true } } } },
          indicator: { select: { ownerNodeId: true } },
        },
      },
      templateVersion: { select: { id: true, versionNumber: true, versionLabel: true, status: true } },
      execution: { select: { id: true, code: true, title: true, status: true, dueDate: true } },
      orgNode: { select: { id: true, name: true, type: true } },
      process: { select: { id: true, number: true, code: true, name: true, orgNodeId: true, indicator: { select: { ownerNodeId: true } } } },
      indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } },
      submittedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      answers: { orderBy: [{ fieldOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
      evidence: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' as const } },
      signatures: { orderBy: { signedAt: 'desc' as const } },
      approvals: { orderBy: { createdAt: 'desc' as const } },
      operationalRecord: true,
      issues: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' as const } },
    };
  }

  private executionInclude() {
    return {
      template: { select: { id: true, number: true, code: true, title: true, type: true, status: true, orgNodeId: true, processId: true, indicatorId: true } },
      templateVersion: { select: { id: true, versionNumber: true, versionLabel: true, status: true } },
      schedule: { select: { id: true, name: true, status: true, frequency: true } },
      assignments: { orderBy: { assignedAt: 'asc' as const } },
      responseItems: { orderBy: { createdAt: 'asc' as const } },
      submissions: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' as const }, take: 3 },
      operationalRecords: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' as const }, take: 3 },
      issues: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' as const } },
    };
  }

  private areaOfTemplate(template: any): string | null {
    return template.orgNodeId ?? template.orgNode?.id ?? template.process?.orgNodeId ?? template.process?.indicator?.ownerNodeId ?? template.indicator?.ownerNodeId ?? null;
  }

  private areaOfSubmission(submission: any): string | null {
    return (
      submission.orgNodeId ??
      submission.orgNode?.id ??
      submission.process?.orgNodeId ??
      submission.process?.indicator?.ownerNodeId ??
      submission.indicator?.ownerNodeId ??
      this.areaOfTemplate(submission.template)
    );
  }

  private areaOfExecution(execution: any): string | null {
    return execution.orgNodeId ?? execution.template?.orgNodeId ?? null;
  }

  private async assertWriteArea(me: AuthPayload, area: string | null, action: AreaAction) {
    if (area) await this.access.assertCanWrite(me.sub, area, MODULE, action);
  }

  private async assertViewArea(me: AuthPayload, record: any, kind: 'template' | 'submission' | 'execution' = 'template') {
    const area = kind === 'submission' ? this.areaOfSubmission(record) : kind === 'execution' ? this.areaOfExecution(record) : this.areaOfTemplate(record);
    if (!area) return;
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    if (permitted && !permitted.includes(area)) {
      throw new ForbiddenException('Voce nao tem acesso aos formularios desta area.');
    }
  }

  private enrichTemplate(template: any) {
    const fields = template.fields ?? [];
    const versions = template.versions ?? [];
    return {
      ...template,
      fieldsCount: fields.length,
      requiredFieldsCount: fields.filter((field: any) => field.required).length,
      submissionsCount: template._count?.submissions ?? template.submissions?.length ?? 0,
      versionsCount: template._count?.versions ?? versions.length,
      executionsCount: template._count?.executions ?? 0,
      issuesCount: template._count?.issues ?? 0,
      areaId: this.areaOfTemplate(template),
      currentVersion: versions.find((version: any) => version.id === template.currentVersionId) ?? versions[0] ?? null,
    };
  }

  private enrichSubmission(submission: any) {
    const answers = submission.answers ?? [];
    const issues = submission.issues ?? [];
    return {
      ...submission,
      answersCount: answers.length,
      evidenceCount: submission.evidence?.length ?? 0,
      signaturesCount: submission.signatures?.length ?? 0,
      approvalsCount: submission.approvals?.length ?? 0,
      openIssues: issues.filter((issue: any) => issue.status !== FormIssueStatus.RESOLVED && issue.status !== FormIssueStatus.CANCELLED).length,
      areaId: this.areaOfSubmission(submission),
    };
  }

  private enrichExecution(execution: any) {
    const responses = execution.responseItems ?? [];
    const issues = execution.issues ?? [];
    return {
      ...execution,
      responsesCount: responses.length,
      submissionsCount: execution.submissions?.length ?? 0,
      recordsCount: execution.operationalRecords?.length ?? 0,
      openIssues: issues.filter((issue: any) => issue.status !== FormIssueStatus.RESOLVED && issue.status !== FormIssueStatus.CANCELLED).length,
      areaId: this.areaOfExecution(execution),
    };
  }

  private requiredText(value: unknown, field: string) {
    const text = String(value ?? '').trim();
    if (!text) throw new BadRequestException(`${field} e obrigatorio.`);
    return text;
  }

  private nullableText(value: unknown) {
    if (value === undefined) return undefined;
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private optionalDate(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Data invalida.');
    return date;
  }

  private int(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private float(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private id(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private idArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((item) => this.id(item)).filter(Boolean) as string[]));
  }

  private stringArray(value: unknown): string[] {
    if (Array.isArray(value)) return Array.from(new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean)));
    const text = String(value ?? '').trim();
    if (!text) return [];
    return Array.from(new Set(text.split(/\r?\n|,|;/).map((item) => item.trim()).filter(Boolean)));
  }

  private json(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'object') return value as Prisma.InputJsonValue;
    return { value: String(value) };
  }

  private parseTemplateType(value?: string): FormTemplateType | undefined {
    if (!value) return undefined;
    if (!Object.values(FormTemplateType).includes(value as FormTemplateType)) throw new BadRequestException('Tipo de formulario invalido.');
    return value as FormTemplateType;
  }

  private parseTemplateStatus(value?: string): FormTemplateStatus | undefined {
    if (!value) return undefined;
    if (!Object.values(FormTemplateStatus).includes(value as FormTemplateStatus)) throw new BadRequestException('Status de formulario invalido.');
    return value as FormTemplateStatus;
  }

  private parseFieldType(value?: string): FormFieldType | undefined {
    if (!value) return undefined;
    if (!Object.values(FormFieldType).includes(value as FormFieldType)) throw new BadRequestException('Tipo de campo invalido.');
    return value as FormFieldType;
  }

  private parseSubmissionStatus(value?: string): FormSubmissionStatus | undefined {
    if (!value) return undefined;
    if (!Object.values(FormSubmissionStatus).includes(value as FormSubmissionStatus)) throw new BadRequestException('Status de preenchimento invalido.');
    return value as FormSubmissionStatus;
  }

  private parseExecutionStatus(value?: string): FormExecutionStatus | undefined {
    if (!value) return undefined;
    if (!Object.values(FormExecutionStatus).includes(value as FormExecutionStatus)) throw new BadRequestException('Status de execucao invalido.');
    return value as FormExecutionStatus;
  }

  private parseApprovalDecision(value?: string): FormApprovalDecision {
    if (!value) return FormApprovalDecision.PENDING;
    if (!Object.values(FormApprovalDecision).includes(value as FormApprovalDecision)) throw new BadRequestException('Decisao de aprovacao invalida.');
    return value as FormApprovalDecision;
  }

  private visibilityWhere(permitted: string[] | null) {
    if (!permitted) return undefined;
    return {
      OR: [
        { orgNodeId: null, processId: null, indicatorId: null },
        { orgNodeId: { in: permitted } },
        { process: { orgNodeId: { in: permitted } } },
        { process: { indicator: { ownerNodeId: { in: permitted } } } },
        { indicator: { ownerNodeId: { in: permitted } } },
      ],
    };
  }

  private executionVisibilityWhere(permitted: string[] | null) {
    if (!permitted) return undefined;
    return {
      OR: [
        { orgNodeId: null, processId: null, indicatorId: null },
        { orgNodeId: { in: permitted } },
        { template: this.visibilityWhere(permitted) as Prisma.FormTemplateWhereInput },
      ],
    };
  }

  private async loadTemplate(id: string, companyId: string) {
    const template = await this.prisma.formTemplate.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.templateInclude(),
    });
    if (!template) throw new NotFoundException('Formulario nao encontrado');
    return template;
  }

  private async loadSubmission(id: string, companyId: string) {
    const submission = await this.prisma.formSubmission.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.submissionInclude(),
    });
    if (!submission) throw new NotFoundException('Preenchimento nao encontrado');
    return submission;
  }

  private async loadExecution(id: string, companyId: string) {
    const execution = await this.prisma.formExecution.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.executionInclude(),
    });
    if (!execution) throw new NotFoundException('Execucao nao encontrada');
    return execution;
  }

  private async validateLinks(companyId: string, input: LinkInput) {
    const ids = {
      orgNodeId: input.orgNodeId ?? null,
      processId: input.processId ?? null,
      indicatorId: input.indicatorId ?? null,
      ownerUserId: input.ownerUserId ?? null,
    };
    const areas: string[] = [];

    if (ids.orgNodeId) {
      const orgNode = await this.prisma.orgNode.findFirst({ where: { id: ids.orgNodeId, companyId, deletedAt: null }, select: { id: true } });
      if (!orgNode) throw new NotFoundException('Area ou processo nao encontrado');
      areas.push(orgNode.id);
    }
    if (ids.processId) {
      const process = await this.prisma.process.findFirst({
        where: { id: ids.processId, companyId, deletedAt: null },
        select: { orgNodeId: true, indicator: { select: { ownerNodeId: true } } },
      });
      if (!process) throw new NotFoundException('Processo nao encontrado');
      if (process.orgNodeId) areas.push(process.orgNodeId);
      if (process.indicator?.ownerNodeId) areas.push(process.indicator.ownerNodeId);
    }
    if (ids.indicatorId) {
      const indicator = await this.prisma.indicator.findFirst({ where: { id: ids.indicatorId, companyId, deletedAt: null }, select: { ownerNodeId: true } });
      if (!indicator) throw new NotFoundException('Indicador nao encontrado');
      if (indicator.ownerNodeId) areas.push(indicator.ownerNodeId);
    }
    if (ids.ownerUserId) {
      const user = await this.prisma.user.findFirst({ where: { id: ids.ownerUserId, companyId, deletedAt: null, active: true }, select: { id: true } });
      if (!user) throw new NotFoundException('Responsavel nao encontrado');
    }

    const uniqueAreas = Array.from(new Set(areas.filter(Boolean)));
    if (uniqueAreas.length > 1) throw new ConflictException('Vinculos do formulario pertencem a areas diferentes.');
    return { ids, area: uniqueAreas[0] ?? null };
  }

  private async validateCatalog(companyId: string, input: CatalogInput) {
    const ids = {
      typeConfigId: input.typeConfigId ?? null,
      categoryId: input.categoryId ?? null,
      folderId: input.folderId ?? null,
    };
    if (ids.typeConfigId) {
      const item = await this.prisma.formTypeConfig.findFirst({ where: { id: ids.typeConfigId, companyId, deletedAt: null }, select: { id: true } });
      if (!item) throw new NotFoundException('Tipo de formulario nao encontrado');
    }
    if (ids.categoryId) {
      const item = await this.prisma.formCategory.findFirst({ where: { id: ids.categoryId, companyId, deletedAt: null }, select: { id: true } });
      if (!item) throw new NotFoundException('Categoria de formulario nao encontrada');
    }
    if (ids.folderId) {
      const item = await this.prisma.formFolder.findFirst({ where: { id: ids.folderId, companyId, deletedAt: null }, select: { id: true } });
      if (!item) throw new NotFoundException('Pasta de formulario nao encontrada');
    }
    return ids;
  }

  private parseFields(raw: unknown) {
    const items = Array.isArray(raw) ? raw : [];
    return items
      .map((field: any, index) => ({
        order: Number.isFinite(Number(field?.order)) ? Math.max(1, Math.round(Number(field.order))) : index + 1,
        code: this.nullableText(field?.code) ?? null,
        sectionId: this.id(field?.sectionId),
        label: this.requiredText(field?.label, 'Rotulo do campo'),
        type: this.parseFieldType(field?.type) ?? FormFieldType.TEXT,
        required: Boolean(field?.required),
        readOnly: Boolean(field?.readOnly),
        hidden: Boolean(field?.hidden),
        repeatable: Boolean(field?.repeatable),
        evidenceRequired: Boolean(field?.evidenceRequired),
        commentRequired: Boolean(field?.commentRequired),
        options: this.nullableText(field?.options) ?? null,
        helpText: this.nullableText(field?.helpText) ?? null,
        placeholder: this.nullableText(field?.placeholder) ?? null,
        defaultValue: this.nullableText(field?.defaultValue) ?? null,
        minValue: this.float(field?.minValue),
        maxValue: this.float(field?.maxValue),
        minLength: this.int(field?.minLength),
        maxLength: this.int(field?.maxLength),
        weight: this.float(field?.weight) ?? 1,
        score: this.float(field?.score),
        criticality: this.nullableText(field?.criticality) ?? null,
        validation: this.json(field?.validation),
        conditionalRules: this.json(field?.conditionalRules),
        formula: this.nullableText(field?.formula) ?? null,
        dataSource: this.json(field?.dataSource),
        metadata: this.json(field?.metadata),
      }))
      .sort((a, b) => a.order - b.order);
  }

  private templateSnapshot(template: any) {
    return {
      template: {
        id: template.id,
        number: template.number,
        code: template.code,
        title: template.title,
        description: template.description,
        type: template.type,
        status: template.status,
        version: template.version,
        purpose: template.purpose,
        instructions: template.instructions,
        workflow: template.workflow,
        rules: template.rules,
        formulas: template.formulas,
        settings: template.settings,
      },
      sections: (template.sections ?? []).map((section: any) => ({
        id: section.id,
        code: section.code,
        title: section.title,
        position: section.position,
        repeatable: section.repeatable,
        visibleWhen: section.visibleWhen,
      })),
      fields: (template.fields ?? []).map((field: any) => ({
        id: field.id,
        code: field.code,
        sectionId: field.sectionId,
        order: field.order,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options,
        helpText: field.helpText,
        validation: field.validation,
        conditionalRules: field.conditionalRules,
        formula: field.formula,
        evidenceRequired: field.evidenceRequired,
        weight: field.weight,
      })),
    };
  }

  private async createVersionInTx(tx: Tx, template: any, userId: string, input: any = {}) {
    const versionNumber = await this.codes.nextVersionNumber(tx, template.id);
    const status = this.parseTemplateStatus(input?.status) ?? this.codes.versionStatus(template.status);
    const version = await tx.formTemplateVersion.create({
      data: {
        companyId: template.companyId,
        templateId: template.id,
        versionNumber,
        versionLabel: this.codes.versionLabel(versionNumber, input?.versionLabel ?? template.version),
        code: this.nullableText(input?.code) ?? template.code,
        status,
        changeReason: this.nullableText(input?.changeReason) ?? null,
        changeSummary: this.nullableText(input?.changeSummary) ?? null,
        builderSnapshot: this.templateSnapshot(template) as Prisma.InputJsonValue,
        fieldsSnapshot: (template.fields ?? []) as Prisma.InputJsonValue,
        workflow: this.json(input?.workflow ?? template.workflow),
        rules: this.json(input?.rules ?? template.rules),
        formulas: this.json(input?.formulas ?? template.formulas),
        approvedAt: status === FormTemplateStatus.APPROVED || status === FormTemplateStatus.PUBLISHED ? new Date() : null,
        approvedById: status === FormTemplateStatus.APPROVED || status === FormTemplateStatus.PUBLISHED ? userId : null,
        publishedAt: status === FormTemplateStatus.PUBLISHED ? new Date() : null,
        publishedById: status === FormTemplateStatus.PUBLISHED ? userId : null,
        createdById: userId,
      },
    });
    await tx.formField.updateMany({ where: { templateId: template.id, deletedAt: null }, data: { templateVersionId: version.id } });
    await tx.formTemplate.update({ where: { id: template.id }, data: { currentVersionId: version.id, version: version.versionLabel } });
    return version;
  }

  private async ensureCurrentVersion(tx: Tx, template: any, userId: string) {
    if (template.currentVersionId) {
      const current = await tx.formTemplateVersion.findFirst({ where: { id: template.currentVersionId, companyId: template.companyId, deletedAt: null } });
      if (current) return current;
    }
    const latest = await tx.formTemplateVersion.findFirst({ where: { templateId: template.id, deletedAt: null }, orderBy: { versionNumber: 'desc' } });
    if (latest) {
      await tx.formTemplate.update({ where: { id: template.id }, data: { currentVersionId: latest.id, version: latest.versionLabel } });
      await tx.formField.updateMany({ where: { templateId: template.id, deletedAt: null, templateVersionId: null }, data: { templateVersionId: latest.id } });
      return latest;
    }
    return this.createVersionInTx(tx, template, userId, { status: this.codes.versionStatus(template.status), versionLabel: template.version });
  }

  async list(me: AuthPayload, filters: TemplateFilters = {}) {
    const status = this.parseTemplateStatus(filters.status);
    const type = this.parseTemplateType(filters.type);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: Prisma.FormTemplateWhereInput[] = [];
    const areaFilter = this.visibilityWhere(permitted);
    if (areaFilter) and.push(areaFilter as Prisma.FormTemplateWhereInput);
    const term = filters.search?.trim();
    if (term) {
      and.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { code: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { purpose: { contains: term, mode: 'insensitive' } },
          { tags: { has: term } },
          { fields: { some: { label: { contains: term, mode: 'insensitive' } } } },
        ],
      });
    }

    const items = await this.prisma.formTemplate.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(filters.orgNodeId ? { orgNodeId: filters.orgNodeId } : {}),
        ...(filters.processId ? { processId: filters.processId } : {}),
        ...(filters.indicatorId ? { indicatorId: filters.indicatorId } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      include: this.templateInclude(),
      orderBy: [{ status: 'asc' }, { type: 'asc' }, { number: 'desc' }],
    });
    return items.map((item) => this.enrichTemplate(item));
  }

  async summary(me: AuthPayload) {
    const list = await this.list(me);
    const byStatus = Object.fromEntries(Object.values(FormTemplateStatus).map((status) => [status, 0])) as Record<FormTemplateStatus, number>;
    const byType = Object.fromEntries(Object.values(FormTemplateType).map((type) => [type, 0])) as Record<FormTemplateType, number>;
    let fields = 0;
    let submissions = 0;
    let versions = 0;
    let executions = 0;
    let issues = 0;
    for (const item of list as any[]) {
      byStatus[item.status as FormTemplateStatus] = (byStatus[item.status as FormTemplateStatus] ?? 0) + 1;
      byType[item.type as FormTemplateType] = (byType[item.type as FormTemplateType] ?? 0) + 1;
      fields += item.fieldsCount ?? 0;
      submissions += item.submissionsCount ?? 0;
      versions += item.versionsCount ?? 0;
      executions += item.executionsCount ?? 0;
      issues += item.issuesCount ?? 0;
    }
    return {
      total: list.length,
      active: (byStatus[FormTemplateStatus.ACTIVE] ?? 0) + (byStatus[FormTemplateStatus.PUBLISHED] ?? 0),
      draft: (byStatus[FormTemplateStatus.DRAFT] ?? 0) + (byStatus[FormTemplateStatus.IN_DEVELOPMENT] ?? 0),
      archived: byStatus[FormTemplateStatus.ARCHIVED] ?? 0,
      fields,
      submissions,
      versions,
      executions,
      issues,
      withoutFields: (list as any[]).filter((item) => (item.fieldsCount ?? 0) === 0).length,
      byStatus,
      byType,
    };
  }

  async dashboard(me: AuthPayload) {
    const summary = await this.summary(me);
    const templateIds = (await this.list(me)).map((item: any) => item.id);
    if (!templateIds.length) {
      return { ...summary, pendingApprovals: 0, openIssues: 0, overdueExecutions: 0, records: 0, recentRecords: [], recentExecutions: [] };
    }
    const now = new Date();
    const [pendingApprovals, openIssues, overdueExecutions, records, recentRecords, recentExecutions] = await Promise.all([
      this.prisma.formApproval.count({ where: { companyId: me.companyId, decision: FormApprovalDecision.PENDING, submission: { templateId: { in: templateIds } } } }),
      this.prisma.formIssue.count({ where: { companyId: me.companyId, templateId: { in: templateIds }, deletedAt: null, status: { in: [FormIssueStatus.OPEN, FormIssueStatus.IN_PROGRESS, FormIssueStatus.WAITING_ACTION] } } }),
      this.prisma.formExecution.count({ where: { companyId: me.companyId, templateId: { in: templateIds }, deletedAt: null, dueDate: { lt: now }, status: { in: [FormExecutionStatus.PLANNED, FormExecutionStatus.ASSIGNED, FormExecutionStatus.IN_PROGRESS] } } }),
      this.prisma.formOperationalRecord.count({ where: { companyId: me.companyId, templateId: { in: templateIds }, deletedAt: null } }),
      this.prisma.formOperationalRecord.findMany({ where: { companyId: me.companyId, templateId: { in: templateIds }, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 6 }),
      this.prisma.formExecution.findMany({ where: { companyId: me.companyId, templateId: { in: templateIds }, deletedAt: null }, include: this.executionInclude(), orderBy: { createdAt: 'desc' }, take: 6 }),
    ]);
    return {
      ...summary,
      pendingApprovals,
      openIssues,
      overdueExecutions,
      records,
      recentRecords,
      recentExecutions: recentExecutions.map((item) => this.enrichExecution(item)),
    };
  }

  async getById(me: AuthPayload, id: string) {
    const template = await this.loadTemplate(id, me.companyId);
    await this.assertViewArea(me, template);
    return this.enrichTemplate(template);
  }

  async options(me: AuthPayload) {
    await this.codes.ensureDefaults(this.prisma as any, me.companyId, me.sub);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const areaWhere = permitted ? { id: { in: permitted } } : {};
    const indicatorWhere = permitted ? { ownerNodeId: { in: permitted } } : {};
    const processWhere = permitted
      ? { OR: [{ orgNodeId: { in: permitted } }, { indicator: { ownerNodeId: { in: permitted } } }, { orgNodeId: null, indicatorId: null }] }
      : {};
    const [orgNodes, indicators, processes, users, typeConfigs, categories, folders, tags, reusableBlocks] = await Promise.all([
      this.prisma.orgNode.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true, ...areaWhere }, select: { id: true, name: true, type: true }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
      this.prisma.indicator.findMany({ where: { companyId: me.companyId, deletedAt: null, ...indicatorWhere }, select: { id: true, name: true, code: true, ownerNodeId: true }, orderBy: { name: 'asc' } }),
      this.prisma.process.findMany({ where: { companyId: me.companyId, deletedAt: null, ...processWhere }, select: { id: true, number: true, code: true, name: true, orgNodeId: true, indicatorId: true }, orderBy: { name: 'asc' } }),
      this.prisma.user.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, select: { id: true, name: true, email: true, defaultNodeId: true }, orderBy: { name: 'asc' } }),
      this.prisma.formTypeConfig.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, orderBy: { name: 'asc' } }),
      this.prisma.formCategory.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, orderBy: { name: 'asc' } }),
      this.prisma.formFolder.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, orderBy: { name: 'asc' } }),
      this.prisma.formTag.findMany({ where: { companyId: me.companyId }, orderBy: { name: 'asc' } }),
      this.prisma.formReusableBlock.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, orderBy: { name: 'asc' }, take: 50 }),
    ]);
    return {
      orgNodes,
      indicators,
      processes,
      users,
      typeConfigs,
      categories,
      folders,
      tags,
      reusableBlocks,
      types: Object.values(FormTemplateType),
      statuses: Object.values(FormTemplateStatus),
      fieldTypes: Object.values(FormFieldType),
      submissionStatuses: Object.values(FormSubmissionStatus),
      executionStatuses: Object.values(FormExecutionStatus),
      approvalDecisions: Object.values(FormApprovalDecision),
    };
  }

  async library(me: AuthPayload) {
    const options = await this.options(me);
    const templates = await this.list(me);
    const workflows = await this.prisma.formWorkflow.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, orderBy: { name: 'asc' }, take: 100 });
    const printLayouts = await this.prisma.formPrintLayout.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    return { ...options, workflows, printLayouts, templates };
  }

  async builder(me: AuthPayload, id: string) {
    const template = await this.loadTemplate(id, me.companyId);
    await this.assertViewArea(me, template);
    const [rules, formulas, workflows, printLayouts, schedules, links, qrCodes, aiSuggestions] = await Promise.all([
      this.prisma.formTemplateRule.findMany({ where: { companyId: me.companyId, templateId: id, deletedAt: null }, orderBy: { priority: 'asc' } }),
      this.prisma.formTemplateFormula.findMany({ where: { companyId: me.companyId, templateId: id, deletedAt: null }, orderBy: { name: 'asc' } }),
      this.prisma.formWorkflow.findMany({ where: { companyId: me.companyId, templateId: id, deletedAt: null }, orderBy: { name: 'asc' } }),
      this.prisma.formPrintLayout.findMany({ where: { companyId: me.companyId, templateId: id, deletedAt: null }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
      this.prisma.formSchedule.findMany({ where: { companyId: me.companyId, templateId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      this.prisma.formExternalLink.findMany({ where: { companyId: me.companyId, templateId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.formQrCode.findMany({ where: { companyId: me.companyId, templateId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      this.prisma.formAiSuggestion.findMany({ where: { companyId: me.companyId, templateId: id }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    return { template: this.enrichTemplate(template), rules, formulas, workflows, printLayouts, schedules, externalLinks: links, qrCodes, aiSuggestions };
  }

  async create(me: AuthPayload, body: any) {
    const title = this.requiredText(body?.title, 'Titulo');
    const type = this.parseTemplateType(body?.type) ?? FormTemplateType.FORM;
    const status = this.parseTemplateStatus(body?.status) ?? FormTemplateStatus.DRAFT;
    const links = await this.validateLinks(me.companyId, {
      orgNodeId: this.id(body?.orgNodeId),
      processId: this.id(body?.processId),
      indicatorId: this.id(body?.indicatorId),
      ownerUserId: this.id(body?.ownerUserId),
    });
    await this.assertWriteArea(me, links.area, 'create');
    const catalog = await this.validateCatalog(me.companyId, {
      typeConfigId: this.id(body?.typeConfigId),
      categoryId: this.id(body?.categoryId),
      folderId: this.id(body?.folderId),
    });
    const fields = this.parseFields(body?.fields);

    const template = await this.prisma.$transaction(async (tx) => {
      const defaults = await this.codes.ensureDefaults(tx as any, me.companyId, me.sub);
      const typeConfigId = catalog.typeConfigId ?? defaults.types.find((item: any) => item.category === type)?.id ?? null;
      const created = await tx.formTemplate.create({
        data: {
          companyId: me.companyId,
          number: await this.codes.nextTemplateNumber(tx as any, me.companyId),
          code: this.nullableText(body?.code) ?? null,
          title,
          description: this.nullableText(body?.description) ?? null,
          purpose: this.nullableText(body?.purpose) ?? null,
          instructions: this.nullableText(body?.instructions) ?? null,
          type,
          status,
          version: this.nullableText(body?.version) ?? '1.0',
          typeConfigId,
          categoryId: catalog.categoryId,
          folderId: catalog.folderId,
          createdById: me.sub,
          updatedById: me.sub,
          globalTemplate: Boolean(body?.globalTemplate),
          reusable: body?.reusable === undefined ? true : Boolean(body.reusable),
          favorite: Boolean(body?.favorite),
          confidentiality: this.nullableText(body?.confidentiality) ?? 'INTERNAL',
          retentionDays: this.int(body?.retentionDays),
          estimatedMinutes: this.int(body?.estimatedMinutes),
          reviewPeriodDays: this.int(body?.reviewPeriodDays),
          validFrom: this.optionalDate(body?.validFrom),
          validUntil: this.optionalDate(body?.validUntil),
          workflow: this.json(body?.workflow),
          rules: this.json(body?.rules),
          formulas: this.json(body?.formulas),
          permissions: this.json(body?.permissions),
          settings: this.json(body?.settings),
          integrations: this.json(body?.integrations),
          tags: this.stringArray(body?.tags),
          ...links.ids,
          fields: fields.length ? { create: fields.map(({ sectionId, ...field }) => field) } : undefined,
        },
        include: this.templateInclude(),
      });
      const version = await this.createVersionInTx(tx, created, me.sub, { status: this.codes.versionStatus(status), versionLabel: created.version });
      return tx.formTemplate.findUniqueOrThrow({ where: { id: created.id }, include: this.templateInclude() }).then((item) => ({ ...item, currentVersionId: version.id }));
    });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: template.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.CREATED,
      entityType: TraceEntityType.FORM_TEMPLATE,
      entityId: template.id,
      title: `Formulario #${template.number} criado`,
      description: template.title,
      statusTo: template.status,
      metadata: { type: template.type, fields: fields.length },
    });

    return this.enrichTemplate(template);
  }

  async update(me: AuthPayload, id: string, patch: any) {
    const before = await this.loadTemplate(id, me.companyId);
    await this.assertWriteArea(me, this.areaOfTemplate(before), 'edit');
    const links = await this.validateLinks(me.companyId, {
      orgNodeId: 'orgNodeId' in (patch ?? {}) ? this.id(patch.orgNodeId) : before.orgNodeId,
      processId: 'processId' in (patch ?? {}) ? this.id(patch.processId) : before.processId,
      indicatorId: 'indicatorId' in (patch ?? {}) ? this.id(patch.indicatorId) : before.indicatorId,
      ownerUserId: 'ownerUserId' in (patch ?? {}) ? this.id(patch.ownerUserId) : before.ownerUserId,
    });
    await this.assertWriteArea(me, links.area, 'edit');
    const catalog = await this.validateCatalog(me.companyId, {
      typeConfigId: 'typeConfigId' in (patch ?? {}) ? this.id(patch.typeConfigId) : before.typeConfigId,
      categoryId: 'categoryId' in (patch ?? {}) ? this.id(patch.categoryId) : before.categoryId,
      folderId: 'folderId' in (patch ?? {}) ? this.id(patch.folderId) : before.folderId,
    });

    const data: Prisma.FormTemplateUpdateInput = {
      ...links.ids,
      ...catalog,
      updatedById: me.sub,
    };
    if ('title' in (patch ?? {})) data.title = this.requiredText(patch.title, 'Titulo');
    if ('code' in (patch ?? {})) data.code = this.nullableText(patch.code);
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('purpose' in (patch ?? {})) data.purpose = this.nullableText(patch.purpose);
    if ('instructions' in (patch ?? {})) data.instructions = this.nullableText(patch.instructions);
    if ('type' in (patch ?? {})) data.type = this.parseTemplateType(patch.type) ?? before.type;
    if ('version' in (patch ?? {})) data.version = this.nullableText(patch.version);
    if ('confidentiality' in (patch ?? {})) data.confidentiality = this.nullableText(patch.confidentiality) ?? 'INTERNAL';
    if ('retentionDays' in (patch ?? {})) data.retentionDays = this.int(patch.retentionDays);
    if ('estimatedMinutes' in (patch ?? {})) data.estimatedMinutes = this.int(patch.estimatedMinutes);
    if ('reviewPeriodDays' in (patch ?? {})) data.reviewPeriodDays = this.int(patch.reviewPeriodDays);
    if ('validFrom' in (patch ?? {})) data.validFrom = this.optionalDate(patch.validFrom);
    if ('validUntil' in (patch ?? {})) data.validUntil = this.optionalDate(patch.validUntil);
    if ('workflow' in (patch ?? {})) data.workflow = this.json(patch.workflow) ?? Prisma.JsonNull;
    if ('rules' in (patch ?? {})) data.rules = this.json(patch.rules) ?? Prisma.JsonNull;
    if ('formulas' in (patch ?? {})) data.formulas = this.json(patch.formulas) ?? Prisma.JsonNull;
    if ('permissions' in (patch ?? {})) data.permissions = this.json(patch.permissions) ?? Prisma.JsonNull;
    if ('settings' in (patch ?? {})) data.settings = this.json(patch.settings) ?? Prisma.JsonNull;
    if ('integrations' in (patch ?? {})) data.integrations = this.json(patch.integrations) ?? Prisma.JsonNull;
    if ('tags' in (patch ?? {})) data.tags = this.stringArray(patch.tags);
    if ('reusable' in (patch ?? {})) data.reusable = Boolean(patch.reusable);
    if ('favorite' in (patch ?? {})) data.favorite = Boolean(patch.favorite);
    if ('globalTemplate' in (patch ?? {})) data.globalTemplate = Boolean(patch.globalTemplate);
    const statusChanged = 'status' in (patch ?? {});
    if (statusChanged) data.status = this.parseTemplateStatus(patch.status) ?? before.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.formTemplate.update({ where: { id }, data });
      if (Array.isArray(patch?.fields)) {
        const fields = this.parseFields(patch.fields);
        await tx.formField.deleteMany({ where: { templateId: id } });
        if (fields.length) await tx.formField.createMany({ data: fields.map((field) => ({ ...field, templateId: id })) });
      }
      const latest = await tx.formTemplate.findUniqueOrThrow({ where: { id }, include: this.templateInclude() });
      if (Array.isArray(patch?.fields) || patch?.createVersion) {
        await this.createVersionInTx(tx, latest, me.sub, {
          changeReason: patch?.changeReason ?? 'Atualizacao do formulario',
          changeSummary: patch?.changeSummary,
          status: this.codes.versionStatus((data.status as FormTemplateStatus | undefined) ?? latest.status),
          versionLabel: patch?.version,
        });
      }
      return tx.formTemplate.findUniqueOrThrow({ where: { id }, include: this.templateInclude() });
    });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: updated.indicatorId,
      userId: me.sub,
      eventType: statusChanged && before.status !== updated.status ? TraceEventType.STATUS_CHANGED : TraceEventType.UPDATED,
      entityType: TraceEntityType.FORM_TEMPLATE,
      entityId: updated.id,
      title: statusChanged && before.status !== updated.status ? `Status do formulario #${updated.number} alterado` : `Formulario #${updated.number} atualizado`,
      description: updated.title,
      statusFrom: before.status,
      statusTo: updated.status,
      metadata: { type: updated.type, fields: updated.fields.length },
    });

    return this.enrichTemplate(updated);
  }

  async remove(me: AuthPayload, id: string) {
    const template = await this.loadTemplate(id, me.companyId);
    await this.assertWriteArea(me, this.areaOfTemplate(template), 'delete');
    const removed = await this.prisma.formTemplate.update({ where: { id }, data: { deletedAt: new Date(), updatedById: me.sub }, include: this.templateInclude() });
    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: template.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.FORM_TEMPLATE,
      entityId: template.id,
      title: `Formulario #${template.number} excluido`,
      description: template.title,
      statusFrom: template.status,
      statusTo: 'DELETED',
    });
    return this.enrichTemplate(removed);
  }

  async createVersion(me: AuthPayload, id: string, body: any) {
    const template = await this.loadTemplate(id, me.companyId);
    await this.assertWriteArea(me, this.areaOfTemplate(template), 'edit');
    const version = await this.prisma.$transaction((tx) => this.createVersionInTx(tx, template, me.sub, body));
    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: template.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.UPDATED,
      entityType: TraceEntityType.FORM_TEMPLATE,
      entityId: template.id,
      title: `Nova versao do formulario #${template.number}`,
      description: version.versionLabel,
      metadata: { versionNumber: version.versionNumber },
    });
    return version;
  }

  async publish(me: AuthPayload, id: string, body: any = {}) {
    const template = await this.loadTemplate(id, me.companyId);
    await this.assertWriteArea(me, this.areaOfTemplate(template), 'edit');
    if (!template.fields.length) throw new BadRequestException('Inclua ao menos um campo antes de publicar.');
    const published = await this.prisma.$transaction(async (tx) => {
      const version = await this.createVersionInTx(tx, template, me.sub, {
        ...body,
        status: FormTemplateStatus.PUBLISHED,
        changeReason: body?.changeReason ?? 'Publicacao do template',
      });
      return tx.formTemplate.update({
        where: { id },
        data: {
          status: FormTemplateStatus.PUBLISHED,
          currentVersionId: version.id,
          version: version.versionLabel,
          approvedAt: new Date(),
          approvedById: me.sub,
          publishedAt: new Date(),
          publishedById: me.sub,
          updatedById: me.sub,
        },
        include: this.templateInclude(),
      });
    });
    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: template.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.STATUS_CHANGED,
      entityType: TraceEntityType.FORM_TEMPLATE,
      entityId: template.id,
      title: `Formulario #${template.number} publicado`,
      description: template.title,
      statusFrom: template.status,
      statusTo: FormTemplateStatus.PUBLISHED,
    });
    return this.enrichTemplate(published);
  }

  async duplicate(me: AuthPayload, id: string, body: any = {}) {
    const source = await this.loadTemplate(id, me.companyId);
    await this.assertViewArea(me, source);
    await this.assertWriteArea(me, this.areaOfTemplate(source), 'create');
    const template = await this.create(me, {
      title: this.nullableText(body?.title) ?? `${source.title} - copia`,
      code: this.nullableText(body?.code) ?? null,
      description: source.description,
      purpose: source.purpose,
      instructions: source.instructions,
      type: source.type,
      status: FormTemplateStatus.DRAFT,
      version: '1.0',
      orgNodeId: source.orgNodeId,
      processId: source.processId,
      indicatorId: source.indicatorId,
      ownerUserId: source.ownerUserId,
      typeConfigId: source.typeConfigId,
      categoryId: source.categoryId,
      folderId: source.folderId,
      fields: source.fields.map((field: any) => ({
        order: field.order,
        code: field.code,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options,
        helpText: field.helpText,
        placeholder: field.placeholder,
        evidenceRequired: field.evidenceRequired,
        commentRequired: field.commentRequired,
        weight: field.weight,
      })),
      tags: source.tags,
    });
    return template;
  }

  async listSubmissions(me: AuthPayload, templateId: string) {
    const template = await this.loadTemplate(templateId, me.companyId);
    await this.assertViewArea(me, template);
    const submissions = await this.prisma.formSubmission.findMany({
      where: { companyId: me.companyId, templateId, deletedAt: null },
      include: this.submissionInclude(),
      orderBy: { createdAt: 'desc' },
    });
    return submissions.map((submission) => this.enrichSubmission(submission));
  }

  private answerValue(answer: any) {
    if (!answer) return { value: null, valueJson: undefined, valueNumber: undefined, valueDate: undefined };
    const raw = answer.valueJson ?? answer.value ?? answer.valueText ?? answer.valueNumber ?? answer.valueDate ?? null;
    const value = raw === undefined || raw === null ? null : typeof raw === 'object' ? JSON.stringify(raw) : String(raw).trim();
    const number = Number(answer.valueNumber ?? raw);
    const dateRaw = answer.valueDate ?? raw;
    const date = dateRaw ? new Date(String(dateRaw)) : null;
    return {
      value: value || null,
      valueJson: typeof raw === 'object' && raw !== null ? (raw as Prisma.InputJsonValue) : undefined,
      valueNumber: Number.isFinite(number) ? number : undefined,
      valueDate: date && !Number.isNaN(date.getTime()) ? date : undefined,
    };
  }

  private buildAnswers(template: any, rawAnswers: unknown) {
    const answers = Array.isArray(rawAnswers) ? rawAnswers : [];
    const byField = new Map(answers.map((answer: any) => [String(answer?.fieldId ?? answer?.fieldCode ?? ''), answer]));
    return (template.fields ?? []).map((field: any) => {
      const answer = byField.get(field.id) ?? byField.get(field.code ?? '');
      const parsed = this.answerValue(answer);
      if (field.required && !parsed.value) throw new BadRequestException(`Campo obrigatorio nao preenchido: ${field.label}`);
      return {
        fieldId: field.id,
        sectionId: field.sectionId,
        fieldCode: field.code,
        fieldLabel: field.label,
        fieldType: field.type,
        fieldOrder: field.order,
        value: parsed.value,
        valueJson: parsed.valueJson,
        valueNumber: parsed.valueNumber,
        valueDate: parsed.valueDate,
        score: this.float(answer?.score ?? field.score),
        critical: Boolean(answer?.critical) || String(field.criticality ?? '').toUpperCase() === 'CRITICAL',
        requiresEvidence: Boolean(field.evidenceRequired),
        rowIndex: this.int(answer?.rowIndex),
      };
    });
  }

  private async createRecordForSubmission(tx: Tx, submission: any, template: any, userId: string) {
    const code = await this.codes.nextRecordCode(tx as any, submission.companyId);
    const status = COMPLETED_SUBMISSION_STATUSES.has(submission.status) ? FormOperationalRecordStatus.COMPLETED : FormOperationalRecordStatus.OPEN;
    const record = await tx.formOperationalRecord.create({
      data: {
        companyId: submission.companyId,
        templateId: submission.templateId,
        submissionId: submission.id,
        executionId: submission.executionId,
        code,
        title: submission.title ?? template.title,
        status,
        recordDate: submission.submittedAt ?? submission.completedAt ?? submission.createdAt ?? new Date(),
        orgNodeId: submission.orgNodeId,
        processId: submission.processId,
        indicatorId: submission.indicatorId,
        targetEntityType: submission.originEntityType,
        targetEntityId: submission.originEntityId,
        score: submission.score,
        classification: submission.classification,
        data: { answers: submission.answers ?? [] } as Prisma.InputJsonValue,
        immutableSnapshot: submission.snapshot ?? this.templateSnapshot(template),
        createdById: userId,
      },
    });
    await tx.formRecordTimeline.create({
      data: {
        companyId: submission.companyId,
        recordId: record.id,
        submissionId: submission.id,
        executionId: submission.executionId,
        entityType: 'FORM_RECORD',
        entityId: record.id,
        userId,
        action: 'CREATED',
        title: 'Registro operacional criado',
        description: record.title,
      },
    });
    return record;
  }

  async createSubmission(me: AuthPayload, templateId: string, body: any) {
    const template = await this.loadTemplate(templateId, me.companyId);
    await this.assertViewArea(me, template);
    if (!EXECUTABLE_TEMPLATE_STATUSES.has(template.status)) throw new BadRequestException('Apenas formularios publicados, aprovados ou ativos podem receber preenchimentos.');

    const links = await this.validateLinks(me.companyId, {
      orgNodeId: 'orgNodeId' in (body ?? {}) ? this.id(body.orgNodeId) : template.orgNodeId,
      processId: 'processId' in (body ?? {}) ? this.id(body.processId) : template.processId,
      indicatorId: 'indicatorId' in (body ?? {}) ? this.id(body.indicatorId) : template.indicatorId,
    });
    await this.assertWriteArea(me, links.area || this.areaOfTemplate(template), 'edit');

    const status = this.parseSubmissionStatus(body?.status) ?? FormSubmissionStatus.SUBMITTED;
    const now = new Date();
    const answers = this.buildAnswers(template, body?.answers);
    const submission = await this.prisma.$transaction(async (tx) => {
      const version = await this.ensureCurrentVersion(tx, template, me.sub);
      const created = await tx.formSubmission.create({
        data: {
          companyId: me.companyId,
          templateId,
          templateVersionId: version.id,
          executionId: this.id(body?.executionId),
          code: this.nullableText(body?.code) ?? (await this.codes.nextSubmissionCode(tx as any, me.companyId)),
          title: this.nullableText(body?.title) ?? null,
          status,
          notes: this.nullableText(body?.notes) ?? null,
          submittedById: me.sub,
          assignedToId: this.id(body?.assignedToId),
          dueDate: this.optionalDate(body?.dueDate),
          scheduledAt: this.optionalDate(body?.scheduledAt),
          startedAt: status === FormSubmissionStatus.IN_PROGRESS ? now : this.optionalDate(body?.startedAt),
          submittedAt: COMPLETED_SUBMISSION_STATUSES.has(status) ? now : null,
          completedAt: COMPLETED_SUBMISSION_STATUSES.has(status) ? now : null,
          reviewedById: status === FormSubmissionStatus.REVIEWED || status === FormSubmissionStatus.APPROVED ? me.sub : null,
          reviewedAt: status === FormSubmissionStatus.REVIEWED || status === FormSubmissionStatus.APPROVED ? now : null,
          approvedAt: status === FormSubmissionStatus.APPROVED ? now : null,
          score: this.float(body?.score),
          classification: this.nullableText(body?.classification) ?? null,
          source: this.nullableText(body?.source) ?? 'WEB',
          originEntityType: this.nullableText(body?.originEntityType) ?? null,
          originEntityId: this.nullableText(body?.originEntityId) ?? null,
          deviceInfo: this.json(body?.deviceInfo),
          location: this.json(body?.location),
          snapshot: this.templateSnapshot(template) as Prisma.InputJsonValue,
          orgNodeId: links.ids.orgNodeId,
          processId: links.ids.processId,
          indicatorId: links.ids.indicatorId,
          answers: answers.length ? { create: answers } : undefined,
        },
        include: this.submissionInclude(),
      });
      if (COMPLETED_SUBMISSION_STATUSES.has(status)) await this.createRecordForSubmission(tx, created, template, me.sub);
      await tx.formRecordTimeline.create({
        data: {
          companyId: me.companyId,
          submissionId: created.id,
          executionId: created.executionId,
          entityType: 'FORM_SUBMISSION',
          entityId: created.id,
          userId: me.sub,
          action: 'CREATED',
          title: 'Preenchimento registrado',
          description: created.title ?? template.title,
        },
      });
      return tx.formSubmission.findUniqueOrThrow({ where: { id: created.id }, include: this.submissionInclude() });
    });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: submission.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.CREATED,
      entityType: TraceEntityType.FORM_SUBMISSION,
      entityId: submission.id,
      relatedType: TraceEntityType.FORM_TEMPLATE,
      relatedId: templateId,
      title: `Formulario #${template.number} preenchido`,
      description: submission.title ?? template.title,
      statusTo: submission.status,
      metadata: { templateTitle: template.title, answers: answers.length, versionId: submission.templateVersionId },
    });

    return this.enrichSubmission(submission);
  }

  async updateSubmission(me: AuthPayload, submissionId: string, patch: any) {
    const before = await this.loadSubmission(submissionId, me.companyId);
    await this.assertWriteArea(me, this.areaOfSubmission(before), 'edit');
    const links = await this.validateLinks(me.companyId, {
      orgNodeId: 'orgNodeId' in (patch ?? {}) ? this.id(patch.orgNodeId) : before.orgNodeId,
      processId: 'processId' in (patch ?? {}) ? this.id(patch.processId) : before.processId,
      indicatorId: 'indicatorId' in (patch ?? {}) ? this.id(patch.indicatorId) : before.indicatorId,
    });
    await this.assertWriteArea(me, links.area || this.areaOfSubmission(before), 'edit');

    const data: any = { ...links.ids };
    if ('title' in (patch ?? {})) data.title = this.nullableText(patch.title);
    if ('notes' in (patch ?? {})) data.notes = this.nullableText(patch.notes);
    if ('score' in (patch ?? {})) data.score = this.float(patch.score);
    if ('classification' in (patch ?? {})) data.classification = this.nullableText(patch.classification);
    if ('assignedToId' in (patch ?? {})) data.assignedToId = this.id(patch.assignedToId);
    if ('dueDate' in (patch ?? {})) data.dueDate = this.optionalDate(patch.dueDate);
    const statusChanged = 'status' in (patch ?? {});
    if (statusChanged) {
      data.status = this.parseSubmissionStatus(patch.status) ?? before.status;
      if (data.status === FormSubmissionStatus.IN_PROGRESS && !before.startedAt) data.startedAt = new Date();
      if (COMPLETED_SUBMISSION_STATUSES.has(data.status) && !before.submittedAt) data.submittedAt = new Date();
      if (COMPLETED_SUBMISSION_STATUSES.has(data.status) && !before.completedAt) data.completedAt = new Date();
      if (data.status === FormSubmissionStatus.REVIEWED || data.status === FormSubmissionStatus.APPROVED) {
        data.reviewedById = me.sub;
        data.reviewedAt = new Date();
      }
      if (data.status === FormSubmissionStatus.APPROVED) data.approvedAt = new Date();
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.formSubmission.update({ where: { id: submissionId }, data });
      if (Array.isArray(patch?.answers)) {
        const answers = this.buildAnswers(before.template, patch.answers);
        await tx.formAnswer.deleteMany({ where: { submissionId } });
        if (answers.length) await tx.formAnswer.createMany({ data: answers.map((answer: any) => ({ ...answer, submissionId })) });
      }
      const item = await tx.formSubmission.findUniqueOrThrow({ where: { id: submissionId }, include: this.submissionInclude() });
      if (COMPLETED_SUBMISSION_STATUSES.has(item.status) && !item.operationalRecord) await this.createRecordForSubmission(tx, item, item.template, me.sub);
      await tx.formRecordTimeline.create({
        data: {
          companyId: me.companyId,
          submissionId,
          executionId: item.executionId,
          recordId: item.operationalRecord?.id,
          entityType: 'FORM_SUBMISSION',
          entityId: submissionId,
          userId: me.sub,
          action: statusChanged && before.status !== item.status ? 'STATUS_CHANGED' : 'UPDATED',
          title: statusChanged && before.status !== item.status ? 'Status do preenchimento alterado' : 'Preenchimento atualizado',
          beforeValue: { status: before.status } as Prisma.InputJsonValue,
          afterValue: { status: item.status } as Prisma.InputJsonValue,
        },
      });
      return tx.formSubmission.findUniqueOrThrow({ where: { id: submissionId }, include: this.submissionInclude() });
    });

    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: updated.indicatorId,
      userId: me.sub,
      eventType: statusChanged && before.status !== updated.status ? TraceEventType.STATUS_CHANGED : TraceEventType.UPDATED,
      entityType: TraceEntityType.FORM_SUBMISSION,
      entityId: updated.id,
      relatedType: TraceEntityType.FORM_TEMPLATE,
      relatedId: updated.templateId,
      title: 'Preenchimento de formulario atualizado',
      description: updated.title ?? updated.template.title,
      statusFrom: before.status,
      statusTo: updated.status,
    });

    return this.enrichSubmission(updated);
  }

  async listExecutions(me: AuthPayload, filters: ExecutionFilters = {}) {
    const status = this.parseExecutionStatus(filters.status);
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const and: Prisma.FormExecutionWhereInput[] = [];
    const areaFilter = this.executionVisibilityWhere(permitted);
    if (areaFilter) and.push(areaFilter as Prisma.FormExecutionWhereInput);
    const term = filters.search?.trim();
    if (term) {
      and.push({ OR: [{ title: { contains: term, mode: 'insensitive' } }, { code: { contains: term, mode: 'insensitive' } }, { template: { title: { contains: term, mode: 'insensitive' } } }] });
    }
    const items = await this.prisma.formExecution.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(filters.templateId ? { templateId: filters.templateId } : {}),
        ...(filters.assignedToId ? { assignedToId: filters.assignedToId } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      include: this.executionInclude(),
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    return items.map((item) => this.enrichExecution(item));
  }

  async getExecution(me: AuthPayload, id: string) {
    const execution = await this.loadExecution(id, me.companyId);
    await this.assertViewArea(me, execution, 'execution');
    return this.enrichExecution(execution);
  }

  async createExecution(me: AuthPayload, body: any) {
    const template = await this.loadTemplate(this.requiredText(body?.templateId, 'Formulario'), me.companyId);
    await this.assertViewArea(me, template);
    if (!EXECUTABLE_TEMPLATE_STATUSES.has(template.status)) throw new BadRequestException('Publique o formulario antes de criar execucoes.');
    const links = await this.validateLinks(me.companyId, {
      orgNodeId: this.id(body?.orgNodeId) ?? template.orgNodeId,
      processId: this.id(body?.processId) ?? template.processId,
      indicatorId: this.id(body?.indicatorId) ?? template.indicatorId,
    });
    await this.assertWriteArea(me, links.area || this.areaOfTemplate(template), 'create');
    const status = this.parseExecutionStatus(body?.status) ?? (this.id(body?.assignedToId) ? FormExecutionStatus.ASSIGNED : FormExecutionStatus.PLANNED);

    const execution = await this.prisma.$transaction(async (tx) => {
      const version = await this.ensureCurrentVersion(tx, template, me.sub);
      const created = await tx.formExecution.create({
        data: {
          companyId: me.companyId,
          templateId: template.id,
          templateVersionId: version.id,
          scheduleId: this.id(body?.scheduleId),
          code: this.nullableText(body?.code) ?? (await this.codes.nextExecutionCode(tx as any, me.companyId)),
          title: this.nullableText(body?.title) ?? template.title,
          status,
          targetEntityType: this.nullableText(body?.targetEntityType) ?? null,
          targetEntityId: this.nullableText(body?.targetEntityId) ?? null,
          assignedToId: this.id(body?.assignedToId),
          assignedTeamId: this.id(body?.assignedTeamId),
          dueDate: this.optionalDate(body?.dueDate),
          scheduledAt: this.optionalDate(body?.scheduledAt),
          offlineEnabled: Boolean(body?.offlineEnabled),
          snapshot: this.templateSnapshot(template) as Prisma.InputJsonValue,
          createdById: me.sub,
          updatedById: me.sub,
          ...links.ids,
          assignments: this.id(body?.assignedToId)
            ? { create: [{ companyId: me.companyId, userId: this.id(body?.assignedToId), role: 'EXECUTOR', dueDate: this.optionalDate(body?.dueDate), createdById: me.sub }] }
            : undefined,
        },
        include: this.executionInclude(),
      });
      await tx.formRecordTimeline.create({
        data: { companyId: me.companyId, executionId: created.id, entityType: 'FORM_EXECUTION', entityId: created.id, userId: me.sub, action: 'CREATED', title: 'Execucao criada', description: created.title },
      });
      return created;
    });
    return this.enrichExecution(execution);
  }

  async saveExecutionResponses(me: AuthPayload, id: string, body: any) {
    const execution = await this.loadExecution(id, me.companyId);
    await this.assertWriteArea(me, this.areaOfExecution(execution), 'edit');
    const responses = Array.isArray(body?.responses) ? body.responses : [];
    const fieldIds = responses.map((item: any) => this.id(item?.fieldId)).filter(Boolean) as string[];
    const saved = await this.prisma.$transaction(async (tx) => {
      if (fieldIds.length) await tx.formExecutionResponseItem.deleteMany({ where: { executionId: id, fieldId: { in: fieldIds } } });
      if (responses.length) {
        await tx.formExecutionResponseItem.createMany({
          data: responses.map((item: any) => {
            const parsed = this.answerValue(item);
            return {
              companyId: me.companyId,
              executionId: id,
              fieldId: this.id(item?.fieldId),
              fieldCode: this.nullableText(item?.fieldCode) ?? null,
              fieldLabel: this.requiredText(item?.fieldLabel ?? item?.label, 'Rotulo da resposta'),
              valueText: parsed.value,
              valueJson: parsed.valueJson,
              valueNumber: parsed.valueNumber,
              valueDate: parsed.valueDate,
              score: this.float(item?.score),
              comment: this.nullableText(item?.comment) ?? null,
              attachments: this.json(item?.attachments),
              answeredById: me.sub,
              answeredAt: new Date(),
            };
          }),
        });
      }
      const totalFields = await tx.formField.count({ where: { templateId: execution.templateId, deletedAt: null, hidden: false } });
      const totalResponses = await tx.formExecutionResponseItem.count({ where: { executionId: id } });
      const progress = totalFields ? Math.min(100, Math.round((totalResponses / totalFields) * 100)) : 0;
      await tx.formExecution.update({ where: { id }, data: { status: FormExecutionStatus.IN_PROGRESS, progress, startedAt: execution.startedAt ?? new Date(), updatedById: me.sub } });
      await tx.formRecordTimeline.create({
        data: { companyId: me.companyId, executionId: id, entityType: 'FORM_EXECUTION', entityId: id, userId: me.sub, action: 'RESPONSES_SAVED', title: 'Respostas salvas', metadata: { responses: responses.length } },
      });
      return tx.formExecution.findUniqueOrThrow({ where: { id }, include: this.executionInclude() });
    });
    return this.enrichExecution(saved);
  }

  async completeExecution(me: AuthPayload, id: string, body: any = {}) {
    const execution = await this.loadExecution(id, me.companyId);
    await this.assertWriteArea(me, this.areaOfExecution(execution), 'edit');
    const template = await this.loadTemplate(execution.templateId, me.companyId);
    const completed = await this.prisma.$transaction(async (tx) => {
      const responses = await tx.formExecutionResponseItem.findMany({ where: { executionId: id }, orderBy: { createdAt: 'asc' } });
      const answers = responses.map((item) => ({
        fieldId: item.fieldId,
        fieldCode: item.fieldCode,
        fieldLabel: item.fieldLabel,
        value: item.valueText,
        valueJson: item.valueJson as Prisma.InputJsonValue | undefined,
        valueNumber: item.valueNumber,
        valueDate: item.valueDate,
        score: item.score,
      }));
      const submission = await tx.formSubmission.create({
        data: {
          companyId: me.companyId,
          templateId: execution.templateId,
          templateVersionId: execution.templateVersionId,
          executionId: id,
          code: await this.codes.nextSubmissionCode(tx as any, me.companyId),
          title: this.nullableText(body?.title) ?? execution.title,
          status: FormSubmissionStatus.SUBMITTED,
          notes: this.nullableText(body?.notes) ?? null,
          submittedById: me.sub,
          submittedAt: new Date(),
          completedAt: new Date(),
          score: this.float(body?.score) ?? execution.score,
          classification: this.nullableText(body?.classification) ?? execution.classification,
          source: 'EXECUTION',
          snapshot: execution.snapshot ?? (this.templateSnapshot(template) as Prisma.InputJsonValue),
          orgNodeId: execution.orgNodeId,
          processId: execution.processId,
          indicatorId: execution.indicatorId,
          answers: answers.length ? { create: answers } : undefined,
        },
        include: this.submissionInclude(),
      });
      await tx.formExecutionResponseItem.updateMany({ where: { executionId: id }, data: { submissionId: submission.id } });
      await this.createRecordForSubmission(tx, submission, template, me.sub);
      await tx.formExecution.update({ where: { id }, data: { status: FormExecutionStatus.COMPLETED, progress: 100, completedAt: new Date(), updatedById: me.sub } });
      await tx.formRecordTimeline.create({ data: { companyId: me.companyId, executionId: id, submissionId: submission.id, entityType: 'FORM_EXECUTION', entityId: id, userId: me.sub, action: 'COMPLETED', title: 'Execucao concluida' } });
      return tx.formExecution.findUniqueOrThrow({ where: { id }, include: this.executionInclude() });
    });
    return this.enrichExecution(completed);
  }

  async addEvidence(me: AuthPayload, submissionId: string, body: any) {
    const submission = await this.loadSubmission(submissionId, me.companyId);
    await this.assertWriteArea(me, this.areaOfSubmission(submission), 'edit');
    const evidenceInput = this.storage.normalizeEvidence(body);
    const evidence = await this.prisma.$transaction(async (tx) => {
      const created = await tx.formEvidence.create({
        data: {
          companyId: me.companyId,
          submissionId,
          executionId: submission.executionId,
          code: await this.codes.nextEvidenceCode(tx as any, me.companyId),
          authorUserId: me.sub,
          ...evidenceInput,
        },
      });
      await tx.formRecordTimeline.create({ data: { companyId: me.companyId, submissionId, recordId: submission.operationalRecord?.id, entityType: 'FORM_EVIDENCE', entityId: created.id, userId: me.sub, action: 'EVIDENCE_ADDED', title: 'Evidencia adicionada', description: created.description ?? created.fileName } });
      return created;
    });
    await this.traceability.record({
      companyId: me.companyId,
      indicatorId: submission.indicatorId,
      userId: me.sub,
      eventType: TraceEventType.EVIDENCE_ADDED,
      entityType: TraceEntityType.FORM_SUBMISSION,
      entityId: submission.id,
      title: 'Evidencia adicionada ao formulario',
      description: evidence.description ?? evidence.fileName ?? evidence.code,
    });
    return evidence;
  }

  async signSubmission(me: AuthPayload, submissionId: string, body: any = {}) {
    const submission = await this.loadSubmission(submissionId, me.companyId);
    await this.assertWriteArea(me, this.areaOfSubmission(submission), 'edit');
    const signature = await this.prisma.formSignature.create({
      data: {
        companyId: me.companyId,
        submissionId,
        signerUserId: me.sub,
        signerName: this.nullableText(body?.signerName) ?? me.name ?? me.email,
        signerEmail: this.nullableText(body?.signerEmail) ?? me.email,
        role: this.nullableText(body?.role) ?? 'RESPONSIBLE',
        method: this.nullableText(body?.method) ?? 'ELECTRONIC',
        signatureKey: this.nullableText(body?.signatureKey) ?? null,
        ip: this.nullableText(body?.ip) ?? null,
        userAgent: this.nullableText(body?.userAgent) ?? null,
        metadata: this.json(body?.metadata),
      },
    });
    return signature;
  }

  async approveSubmission(me: AuthPayload, submissionId: string, body: any) {
    const submission = await this.loadSubmission(submissionId, me.companyId);
    await this.assertWriteArea(me, this.areaOfSubmission(submission), 'edit');
    const decision = this.parseApprovalDecision(body?.decision ?? FormApprovalDecision.APPROVED);
    const statusTo =
      decision === FormApprovalDecision.APPROVED
        ? FormSubmissionStatus.APPROVED
        : decision === FormApprovalDecision.REJECTED
          ? FormSubmissionStatus.REJECTED
          : decision === FormApprovalDecision.ADJUSTMENTS_REQUESTED
            ? FormSubmissionStatus.WAITING_CORRECTION
            : submission.status;
    const result = await this.prisma.$transaction(async (tx) => {
      const approval = await tx.formApproval.create({
        data: {
          companyId: me.companyId,
          submissionId,
          templateVersionId: submission.templateVersionId,
          stage: this.nullableText(body?.stage) ?? 'FINAL',
          decision,
          approverUserId: me.sub,
          approvalOrder: this.int(body?.approvalOrder) ?? 1,
          statusFrom: submission.status,
          statusTo,
          comment: this.nullableText(body?.comment) ?? null,
          decidedAt: decision === FormApprovalDecision.PENDING ? null : new Date(),
        },
      });
      const updated = await tx.formSubmission.update({
        where: { id: submissionId },
        data: {
          status: statusTo,
          reviewedById: me.sub,
          reviewedAt: new Date(),
          approvedAt: statusTo === FormSubmissionStatus.APPROVED ? new Date() : submission.approvedAt,
        },
        include: this.submissionInclude(),
      });
      await tx.formRecordTimeline.create({ data: { companyId: me.companyId, submissionId, recordId: submission.operationalRecord?.id, entityType: 'FORM_APPROVAL', entityId: approval.id, userId: me.sub, action: 'APPROVAL_DECIDED', title: 'Aprovacao registrada', description: decision, beforeValue: { status: submission.status } as Prisma.InputJsonValue, afterValue: { status: statusTo } as Prisma.InputJsonValue } });
      return { approval, submission: updated };
    });
    return { approval: result.approval, submission: this.enrichSubmission(result.submission) };
  }

  async createIssue(me: AuthPayload, submissionId: string, body: any) {
    const submission = await this.loadSubmission(submissionId, me.companyId);
    await this.assertWriteArea(me, this.areaOfSubmission(submission), 'edit');
    const issue = await this.prisma.$transaction(async (tx) => {
      const created = await tx.formIssue.create({
        data: {
          companyId: me.companyId,
          templateId: submission.templateId,
          submissionId,
          executionId: submission.executionId,
          recordId: submission.operationalRecord?.id,
          code: this.nullableText(body?.code) ?? (await this.codes.nextIssueCode(tx as any, me.companyId)),
          title: this.requiredText(body?.title, 'Titulo da pendencia'),
          description: this.nullableText(body?.description) ?? null,
          status: FormIssueStatus.OPEN,
          severity: this.nullableText(body?.severity) ?? null,
          fieldCode: this.nullableText(body?.fieldCode) ?? null,
          responsibleUserId: this.id(body?.responsibleUserId),
          dueDate: this.optionalDate(body?.dueDate),
          actionPlanId: this.id(body?.actionPlanId),
          nonConformityId: this.id(body?.nonConformityId),
          createdById: me.sub,
        },
      });
      await tx.formRecordTimeline.create({ data: { companyId: me.companyId, submissionId, recordId: submission.operationalRecord?.id, issueId: created.id, entityType: 'FORM_ISSUE', entityId: created.id, userId: me.sub, action: 'ISSUE_CREATED', title: 'Pendencia criada', description: created.title } });
      return created;
    });
    return issue;
  }

  async createAiSuggestions(me: AuthPayload, body: any) {
    const templateId = this.id(body?.templateId);
    const submissionId = this.id(body?.submissionId);
    if (!templateId && !submissionId) throw new BadRequestException('Informe um template ou preenchimento para gerar sugestoes.');
    let template: any = null;
    let submission: any = null;
    if (submissionId) {
      submission = await this.loadSubmission(submissionId, me.companyId);
      await this.assertViewArea(me, submission, 'submission');
      template = submission.template;
    } else if (templateId) {
      template = await this.loadTemplate(templateId, me.companyId);
      await this.assertViewArea(me, template);
    }
    const suggestions = [
      {
        suggestionType: 'QUALITY_REVIEW',
        title: 'Revisar campos obrigatorios e evidencias',
        content: 'Verifique se itens criticos exigem evidencia, comentario e responsavel por pendencia.',
      },
      {
        suggestionType: 'AUTOMATION',
        title: 'Criar regra de pendencia automatica',
        content: 'Respostas nao conformes podem abrir pendencia vinculada a plano de acao sem criar nao conformidade automaticamente.',
      },
      {
        suggestionType: 'VERSIONING',
        title: 'Publicar versao controlada antes de execucoes recorrentes',
        content: 'Use uma versao publicada para preservar o desenho exato usado nos registros operacionais.',
      },
    ];
    await this.prisma.formAiSuggestion.createMany({
      data: suggestions.map((item) => ({ companyId: me.companyId, templateId: template?.id ?? null, submissionId: submission?.id ?? null, ...item, context: { generatedBy: me.sub } })),
    });
    return this.prisma.formAiSuggestion.findMany({
      where: { companyId: me.companyId, templateId: template?.id ?? undefined, submissionId: submission?.id ?? undefined },
      orderBy: { createdAt: 'desc' },
      take: suggestions.length,
    });
  }
}
