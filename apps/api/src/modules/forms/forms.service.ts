import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FormFieldType,
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

const MODULE = 'forms';

type TemplateFilters = {
  status?: string;
  type?: string;
  search?: string;
  orgNodeId?: string;
  processId?: string;
  indicatorId?: string;
};

type LinkInput = {
  orgNodeId?: string | null;
  processId?: string | null;
  indicatorId?: string | null;
  ownerUserId?: string | null;
};

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly access: AccessService,
  ) {}

  private templateInclude() {
    return {
      orgNode: { select: { id: true, name: true, type: true } },
      process: { select: { id: true, number: true, code: true, name: true, orgNodeId: true, indicator: { select: { ownerNodeId: true } } } },
      indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } },
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      fields: { orderBy: { order: 'asc' as const } },
      _count: { select: { submissions: true } },
    };
  }

  private submissionInclude() {
    return {
      template: { include: { fields: { orderBy: { order: 'asc' as const } }, orgNode: { select: { id: true } }, process: { select: { orgNodeId: true, indicator: { select: { ownerNodeId: true } } } }, indicator: { select: { ownerNodeId: true } } } },
      orgNode: { select: { id: true, name: true, type: true } },
      process: { select: { id: true, number: true, code: true, name: true, orgNodeId: true, indicator: { select: { ownerNodeId: true } } } },
      indicator: { select: { id: true, name: true, code: true, ownerNodeId: true } },
      submittedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      answers: { orderBy: { createdAt: 'asc' as const } },
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

  private async assertWriteArea(me: AuthPayload, area: string | null, action: AreaAction) {
    if (area) await this.access.assertCanWrite(me.sub, area, MODULE, action);
  }

  private async assertViewArea(me: AuthPayload, record: any, kind: 'template' | 'submission' = 'template') {
    const area = kind === 'template' ? this.areaOfTemplate(record) : this.areaOfSubmission(record);
    if (!area) return;
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    if (permitted && !permitted.includes(area)) {
      throw new ForbiddenException('Voce nao tem acesso aos formularios desta area.');
    }
  }

  private enrichTemplate(template: any) {
    const fields = template.fields ?? [];
    return {
      ...template,
      fieldsCount: fields.length,
      submissionsCount: template._count?.submissions ?? template.submissions?.length ?? 0,
      areaId: this.areaOfTemplate(template),
    };
  }

  private enrichSubmission(submission: any) {
    return {
      ...submission,
      answersCount: submission.answers?.length ?? 0,
      areaId: this.areaOfSubmission(submission),
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

  private id(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text ? text : null;
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

  private parseFields(raw: unknown) {
    const items = Array.isArray(raw) ? raw : [];
    return items
      .map((field: any, index) => ({
        order: Number.isFinite(Number(field?.order)) ? Math.max(1, Math.round(Number(field.order))) : index + 1,
        label: this.requiredText(field?.label, 'Rotulo do campo'),
        type: this.parseFieldType(field?.type) ?? FormFieldType.TEXT,
        required: Boolean(field?.required),
        options: this.nullableText(field?.options) ?? null,
        helpText: this.nullableText(field?.helpText) ?? null,
      }))
      .sort((a, b) => a.order - b.order);
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
    for (const item of list as any[]) {
      byStatus[item.status as FormTemplateStatus]++;
      byType[item.type as FormTemplateType]++;
      fields += item.fieldsCount ?? 0;
      submissions += item.submissionsCount ?? 0;
    }
    return {
      total: list.length,
      active: byStatus[FormTemplateStatus.ACTIVE] ?? 0,
      draft: byStatus[FormTemplateStatus.DRAFT] ?? 0,
      archived: byStatus[FormTemplateStatus.ARCHIVED] ?? 0,
      fields,
      submissions,
      withoutFields: (list as any[]).filter((item) => (item.fieldsCount ?? 0) === 0).length,
      byStatus,
      byType,
    };
  }

  async getById(me: AuthPayload, id: string) {
    const template = await this.loadTemplate(id, me.companyId);
    await this.assertViewArea(me, template);
    return this.enrichTemplate(template);
  }

  async options(me: AuthPayload) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const areaWhere = permitted ? { id: { in: permitted } } : {};
    const indicatorWhere = permitted ? { ownerNodeId: { in: permitted } } : {};
    const processWhere = permitted
      ? { OR: [{ orgNodeId: { in: permitted } }, { indicator: { ownerNodeId: { in: permitted } } }, { orgNodeId: null, indicatorId: null }] }
      : {};
    const [orgNodes, indicators, processes, users] = await Promise.all([
      this.prisma.orgNode.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true, ...areaWhere }, select: { id: true, name: true, type: true }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
      this.prisma.indicator.findMany({ where: { companyId: me.companyId, deletedAt: null, ...indicatorWhere }, select: { id: true, name: true, code: true, ownerNodeId: true }, orderBy: { name: 'asc' } }),
      this.prisma.process.findMany({ where: { companyId: me.companyId, deletedAt: null, ...processWhere }, select: { id: true, number: true, code: true, name: true, orgNodeId: true, indicatorId: true }, orderBy: { name: 'asc' } }),
      this.prisma.user.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, select: { id: true, name: true, email: true, defaultNodeId: true }, orderBy: { name: 'asc' } }),
    ]);
    return {
      orgNodes,
      indicators,
      processes,
      users,
      types: Object.values(FormTemplateType),
      statuses: Object.values(FormTemplateStatus),
      fieldTypes: Object.values(FormFieldType),
      submissionStatuses: Object.values(FormSubmissionStatus),
    };
  }

  async create(me: AuthPayload, body: any) {
    const title = this.requiredText(body?.title, 'Titulo');
    const links = await this.validateLinks(me.companyId, {
      orgNodeId: this.id(body?.orgNodeId),
      processId: this.id(body?.processId),
      indicatorId: this.id(body?.indicatorId),
      ownerUserId: this.id(body?.ownerUserId),
    });
    await this.assertWriteArea(me, links.area, 'create');
    const fields = this.parseFields(body?.fields);

    const template = await this.prisma.$transaction(async (tx) => {
      const last = await tx.formTemplate.findFirst({ where: { companyId: me.companyId }, orderBy: { number: 'desc' }, select: { number: true } });
      const created = await tx.formTemplate.create({
        data: {
          companyId: me.companyId,
          number: (last?.number ?? 0) + 1,
          code: this.nullableText(body?.code) ?? null,
          title,
          description: this.nullableText(body?.description) ?? null,
          type: this.parseTemplateType(body?.type) ?? FormTemplateType.FORM,
          status: this.parseTemplateStatus(body?.status) ?? FormTemplateStatus.DRAFT,
          version: this.nullableText(body?.version) ?? null,
          createdById: me.sub,
          ...links.ids,
          fields: fields.length ? { create: fields } : undefined,
        },
        include: this.templateInclude(),
      });
      return created;
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

    const data: any = { ...links.ids };
    if ('title' in (patch ?? {})) data.title = this.requiredText(patch.title, 'Titulo');
    if ('code' in (patch ?? {})) data.code = this.nullableText(patch.code);
    if ('description' in (patch ?? {})) data.description = this.nullableText(patch.description);
    if ('type' in (patch ?? {})) data.type = this.parseTemplateType(patch.type) ?? before.type;
    if ('version' in (patch ?? {})) data.version = this.nullableText(patch.version);
    const statusChanged = 'status' in (patch ?? {});
    if (statusChanged) data.status = this.parseTemplateStatus(patch.status) ?? before.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.formTemplate.update({ where: { id }, data });
      if (Array.isArray(patch?.fields)) {
        const fields = this.parseFields(patch.fields);
        await tx.formField.deleteMany({ where: { templateId: id } });
        if (fields.length) await tx.formField.createMany({ data: fields.map((field) => ({ ...field, templateId: id })) });
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
    const removed = await this.prisma.formTemplate.update({ where: { id }, data: { deletedAt: new Date() }, include: this.templateInclude() });
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

  private buildAnswers(template: any, rawAnswers: unknown) {
    const answers = Array.isArray(rawAnswers) ? rawAnswers : [];
    const byField = new Map(answers.map((answer: any) => [String(answer?.fieldId ?? ''), answer]));
    return template.fields.map((field: any) => {
      const answer = byField.get(field.id);
      const value = answer?.value === undefined || answer?.value === null ? null : String(answer.value).trim();
      if (field.required && !value) throw new BadRequestException(`Campo obrigatorio nao preenchido: ${field.label}`);
      return {
        fieldId: field.id,
        fieldLabel: field.label,
        value: value || null,
      };
    });
  }

  async createSubmission(me: AuthPayload, templateId: string, body: any) {
    const template = await this.loadTemplate(templateId, me.companyId);
    await this.assertViewArea(me, template);
    if (template.status !== FormTemplateStatus.ACTIVE) throw new BadRequestException('Apenas formularios ativos podem receber preenchimentos.');

    const links = await this.validateLinks(me.companyId, {
      orgNodeId: 'orgNodeId' in (body ?? {}) ? this.id(body.orgNodeId) : template.orgNodeId,
      processId: 'processId' in (body ?? {}) ? this.id(body.processId) : template.processId,
      indicatorId: 'indicatorId' in (body ?? {}) ? this.id(body.indicatorId) : template.indicatorId,
    });
    await this.assertWriteArea(me, links.area || this.areaOfTemplate(template), 'edit');

    const status = this.parseSubmissionStatus(body?.status) ?? FormSubmissionStatus.SUBMITTED;
    const now = new Date();
    const answers = this.buildAnswers(template, body?.answers);
    const submission = await this.prisma.formSubmission.create({
      data: {
        companyId: me.companyId,
        templateId,
        title: this.nullableText(body?.title) ?? null,
        status,
        notes: this.nullableText(body?.notes) ?? null,
        submittedById: me.sub,
        submittedAt: status === FormSubmissionStatus.SUBMITTED || status === FormSubmissionStatus.REVIEWED ? now : null,
        reviewedById: status === FormSubmissionStatus.REVIEWED ? me.sub : null,
        reviewedAt: status === FormSubmissionStatus.REVIEWED ? now : null,
        orgNodeId: links.ids.orgNodeId,
        processId: links.ids.processId,
        indicatorId: links.ids.indicatorId,
        answers: answers.length ? { create: answers } : undefined,
      },
      include: this.submissionInclude(),
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
      metadata: { templateTitle: template.title, answers: answers.length },
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
    const statusChanged = 'status' in (patch ?? {});
    if (statusChanged) {
      data.status = this.parseSubmissionStatus(patch.status) ?? before.status;
      if (data.status === FormSubmissionStatus.SUBMITTED && !before.submittedAt) data.submittedAt = new Date();
      if (data.status === FormSubmissionStatus.REVIEWED) {
        data.reviewedById = me.sub;
        data.reviewedAt = new Date();
        if (!before.submittedAt) data.submittedAt = new Date();
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.formSubmission.update({ where: { id: submissionId }, data });
      if (Array.isArray(patch?.answers)) {
        const answers = this.buildAnswers(before.template, patch.answers);
        await tx.formAnswer.deleteMany({ where: { submissionId } });
        if (answers.length) await tx.formAnswer.createMany({ data: answers.map((answer: any) => ({ ...answer, submissionId })) });
      }
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
}
