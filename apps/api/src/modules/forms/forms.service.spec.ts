import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { FormsService } from './forms.service';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: {
  templates?: unknown[];
  template?: unknown;
  submission?: unknown;
  listAreaFilter?: unknown;
  orgNode?: unknown;
  process?: unknown;
  indicator?: unknown;
  user?: unknown;
  last?: unknown;
}) {
  const prisma: any = {
    formTemplate: {
      findMany: vi.fn().mockResolvedValue(opts?.templates ?? []),
      findFirst: vi.fn().mockImplementation((args: any) => {
        if (args?.orderBy?.number) return Promise.resolve(opts?.last ?? null);
        return Promise.resolve(opts?.template ?? null);
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(opts?.template ?? baseTemplate({ status: 'ACTIVE' })),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve(baseTemplate({ id: 'f1', number: 1, title: args.data.title, status: args.data.status, fields: args.data.fields?.create ?? [] }))),
      update: vi.fn().mockResolvedValue(baseTemplate({ id: 'f1', number: 1, title: 'Checklist revisado', status: 'ACTIVE' })),
    },
    formField: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    formSubmission: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(opts?.submission ?? null),
      findUniqueOrThrow: vi.fn().mockResolvedValue(opts?.submission ?? baseSubmission()),
      create: vi.fn().mockImplementation((args: any) => Promise.resolve(baseSubmission({ status: args.data.status, answers: args.data.answers?.create ?? [] }))),
      update: vi.fn().mockResolvedValue(baseSubmission({ status: 'REVIEWED' })),
    },
    formAnswer: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orgNode: { findFirst: vi.fn().mockResolvedValue(opts?.orgNode ?? null), findMany: vi.fn().mockResolvedValue([]) },
    process: { findFirst: vi.fn().mockResolvedValue(opts?.process ?? null), findMany: vi.fn().mockResolvedValue([]) },
    indicator: { findFirst: vi.fn().mockResolvedValue(opts?.indicator ?? null), findMany: vi.fn().mockResolvedValue([]) },
    user: { findFirst: vi.fn().mockResolvedValue(opts?.user ?? null), findMany: vi.fn().mockResolvedValue([]) },
  };
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));

  const traceability = { record: vi.fn().mockResolvedValue(undefined) } as any;
  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
  } as any;

  const service = new FormsService(prisma, traceability, access);
  return { service, prisma, traceability, access };
}

describe('FormsService - formularios e checklists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list: escopo de empresa + filtro de area incluindo formularios gerais', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.list(me);
    const where = prisma.formTemplate.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.deletedAt).toBeNull();
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: { in: ['areaA'] } });
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: null, processId: null, indicatorId: null });
  });

  it('list: status/tipo/busca sem trocar empresa', async () => {
    const { service, prisma } = makeService();
    await service.list(me, { status: 'ACTIVE', type: 'CHECKLIST', search: 'seguranca' });
    const where = prisma.formTemplate.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.status).toBe('ACTIVE');
    expect(where.type).toBe('CHECKLIST');
    expect(where.AND[0].OR[0].title).toEqual({ contains: 'seguranca', mode: 'insensitive' });
  });

  it('summary: calcula ativos, campos e preenchimentos pela listagem visivel', async () => {
    const { service } = makeService({
      templates: [
        baseTemplate({ id: 'f1', status: 'ACTIVE', type: 'CHECKLIST', fields: [baseField()], _count: { submissions: 2 } }),
        baseTemplate({ id: 'f2', status: 'DRAFT', type: 'FORM', fields: [], _count: { submissions: 0 } }),
      ],
    });
    const res = await service.summary(me);
    expect(res.total).toBe(2);
    expect(res.active).toBe(1);
    expect(res.draft).toBe(1);
    expect(res.fields).toBe(1);
    expect(res.submissions).toBe(2);
    expect(res.withoutFields).toBe(1);
  });

  it('getById: formulario de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ template: null });
    await expect(service.getById(me, 'f-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.formTemplate.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('getById: area nao permitida -> Forbidden', async () => {
    const { service } = makeService({ template: baseTemplate({ orgNodeId: 'areaB' }), listAreaFilter: ['areaA'] });
    await expect(service.getById(me, 'f1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create: valida vinculos, campos e registra rastreabilidade', async () => {
    const { service, prisma, traceability, access } = makeService({ indicator: { ownerNodeId: 'areaA' }, user: { id: 'u2' } });
    await service.create(me, { title: 'Checklist de seguranca', indicatorId: 'i1', ownerUserId: 'u2', status: 'ACTIVE', type: 'CHECKLIST', fields: [{ label: 'Extintor OK?', type: 'BOOLEAN', required: true }] });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'forms', 'create');
    const data = prisma.formTemplate.create.mock.calls[0][0].data;
    expect(data.companyId).toBe('companyA');
    expect(data.number).toBe(1);
    expect(data.fields.create[0].label).toBe('Extintor OK?');
    expect(traceability.record).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'FORM_TEMPLATE', eventType: 'CREATED' }));
  });

  it('create: vinculos em areas diferentes -> Conflict', async () => {
    const { service, prisma } = makeService({ orgNode: { id: 'areaA' }, indicator: { ownerNodeId: 'areaB' } });
    await expect(service.create(me, { title: 'Checklist', orgNodeId: 'areaA', indicatorId: 'i1' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.formTemplate.create).not.toHaveBeenCalled();
  });

  it('update: substitui campos quando fields vem no patch', async () => {
    const { service, prisma } = makeService({ template: baseTemplate({ fields: [baseField()] }) });
    await service.update(me, 'f1', { title: 'Checklist v2', fields: [{ label: 'Novo campo', type: 'TEXT' }] });
    expect(prisma.formField.deleteMany).toHaveBeenCalledWith({ where: { templateId: 'f1' } });
    expect(prisma.formField.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ templateId: 'f1', label: 'Novo campo' })] });
  });

  it('createSubmission: bloqueia template nao ativo', async () => {
    const { service, prisma } = makeService({ template: baseTemplate({ status: 'DRAFT' }) });
    await expect(service.createSubmission(me, 'f1', { answers: [] })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.formSubmission.create).not.toHaveBeenCalled();
  });

  it('createSubmission: exige campos obrigatorios e grava respostas', async () => {
    const template = baseTemplate({ status: 'ACTIVE', fields: [baseField({ id: 'field-1', label: 'Extintor OK?', required: true })] });
    const { service, prisma, traceability } = makeService({ template });
    await expect(service.createSubmission(me, 'f1', { answers: [] })).rejects.toBeInstanceOf(BadRequestException);
    await service.createSubmission(me, 'f1', { title: 'Ronda 01', answers: [{ fieldId: 'field-1', value: 'Sim' }] });
    const data = prisma.formSubmission.create.mock.calls[0][0].data;
    expect(data.companyId).toBe('companyA');
    expect(data.status).toBe('SUBMITTED');
    expect(data.answers.create[0]).toEqual(expect.objectContaining({ fieldId: 'field-1', fieldLabel: 'Extintor OK?', value: 'Sim' }));
    expect(traceability.record).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'FORM_SUBMISSION', relatedType: 'FORM_TEMPLATE' }));
  });
});

function baseTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    companyId: 'companyA',
    number: 1,
    code: null,
    orgNodeId: null,
    processId: null,
    indicatorId: null,
    ownerUserId: null,
    createdById: 'user-1',
    title: 'Checklist',
    description: null,
    type: 'CHECKLIST',
    status: 'DRAFT',
    version: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    orgNode: null,
    process: null,
    indicator: null,
    owner: null,
    createdBy: null,
    fields: [],
    _count: { submissions: 0 },
    ...overrides,
  };
}

function baseField(overrides: Record<string, unknown> = {}) {
  return {
    id: 'field-1',
    templateId: 'f1',
    order: 1,
    label: 'Campo',
    type: 'TEXT',
    required: false,
    options: null,
    helpText: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function baseSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    companyId: 'companyA',
    templateId: 'f1',
    orgNodeId: null,
    processId: null,
    indicatorId: null,
    submittedById: 'user-1',
    reviewedById: null,
    title: 'Ronda 01',
    status: 'SUBMITTED',
    notes: null,
    submittedAt: new Date(),
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    template: baseTemplate({ status: 'ACTIVE', fields: [baseField()] }),
    orgNode: null,
    process: null,
    indicator: null,
    submittedBy: null,
    reviewedBy: null,
    answers: [],
    ...overrides,
  };
}
