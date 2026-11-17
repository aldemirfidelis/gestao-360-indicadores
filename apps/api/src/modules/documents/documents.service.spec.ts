import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentType, UserRoleEnum } from '@prisma/client';
import { docToPlainText } from '@g360/shared';
import { DocumentsService } from './documents.service';
import { DocumentAccessService } from './document-access.service';
import { DocumentContentService } from './document-content.service';
import { buildDocx, extractDocxText, isDocxBuffer } from './docx.util';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = {
  sub: 'user-1',
  email: 'u@x.com',
  name: 'User',
  role: UserRoleEnum.ANALYST,
  companyId: 'companyA',
};

function makeService(opts?: {
  docs?: unknown[];
  doc?: unknown;
  listAreaFilter?: unknown;
  orgNode?: unknown;
  indicator?: unknown;
  user?: unknown;
  permissions?: string[];
}) {
  const hasDocOverride = Object.prototype.hasOwnProperty.call(opts ?? {}, 'doc');
  const scopedDoc = hasDocOverride ? opts?.doc : baseDoc();
  const prisma: any = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    document: {
      findMany: vi.fn().mockResolvedValue(opts?.docs ?? []),
      findFirst: vi.fn(async (args: any) => {
        if (args?.where?.id) return scopedDoc;
        if (args?.orderBy?.number) return null;
        if (args?.where?.code) return null;
        return scopedDoc;
      }),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }: any) => baseDoc({ ...data, id: 'd1', number: data.number ?? 1, indicatorId: opts?.indicator ? 'i1' : null })),
      update: vi.fn(async ({ data }: any) => baseDoc({ ...(scopedDoc as object), ...data })),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    documentTypeConfig: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'dt1', category: DocumentType.PROCEDURE, prefix: 'PRO', defaultValidityDays: 365, alertDays: 30 }),
      update: vi.fn().mockResolvedValue({ id: 'dt1' }),
    },
    documentTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'tpl1' }),
      update: vi.fn().mockResolvedValue({ id: 'tpl1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    company: { findUnique: vi.fn().mockResolvedValue({ name: 'Empresa A' }) },
    documentVersion: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'v1', revisionNumber: 0, versionLabel: 'Rev. 00', docxFileId: null, status: 'DRAFT' }),
      update: vi.fn().mockResolvedValue({ id: 'v1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    documentFile: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'f1', kind: 'DOCX', versionId: 'v1', fileName: 'doc.docx', mimeType: null, contentText: 'x', storageKey: 'k' }),
      update: vi.fn().mockResolvedValue({ id: 'f1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    documentStatusHistory: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'h1' }) },
    documentWorkflow: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'wf1' }) },
    documentWorkflowStep: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    documentApproval: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'a1' }) },
    documentReviewRequest: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'rr1' }) },
    documentEditRequest: {
      create: vi.fn().mockResolvedValue({ id: 'er1' }),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: 'er1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    documentComment: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'c1', body: 'x' }) },
    documentCommentMention: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    documentAuditLog: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'al1' }) },
    documentExternalMetadata: { findUnique: vi.fn().mockResolvedValue(null) },
    documentTagRelation: { findMany: vi.fn().mockResolvedValue([]) },
    documentReadConfirmation: {
      create: vi.fn().mockResolvedValue({ id: 'rc1' }),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    documentChangeRequest: { count: vi.fn().mockResolvedValue(0), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    documentRelation: { findMany: vi.fn().mockResolvedValue([]) },
    documentEditorSession: { create: vi.fn().mockResolvedValue({ id: 'es1' }) },
    documentAutosaveCheckpoint: { create: vi.fn().mockResolvedValue({ id: 'cp1' }) },
    documentDownloadLog: { create: vi.fn().mockResolvedValue({ id: 'dl1' }) },
    documentViewLog: { create: vi.fn().mockResolvedValue({ id: 'vl1' }) },
    documentAccessGroup: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    documentAccessGroupUser: { findMany: vi.fn().mockResolvedValue([]) },
    documentPermission: { findFirst: vi.fn().mockResolvedValue(null) },
    processIntegration: { findMany: vi.fn().mockResolvedValue([]) },
    process: { findMany: vi.fn().mockResolvedValue([]) },
    orgNode: { findFirst: vi.fn().mockResolvedValue(opts?.orgNode ?? null), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    indicator: { findFirst: vi.fn().mockResolvedValue(opts?.indicator ?? null), findMany: vi.fn().mockResolvedValue([]) },
    user: {
      findFirst: vi.fn().mockResolvedValue(opts?.user ?? null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn(async ({ where }: any) => (Array.isArray(where?.id?.in) ? where.id.in.length : 0)),
      findUnique: vi.fn().mockResolvedValue({ permissions: (opts?.permissions ?? ['doc:view', 'doc:create', 'doc:update', 'doc:publish', 'doc:delete']).map((key) => ({ permission: { key } })), accessProfile: null }),
    },
  };
  prisma.$transaction = vi.fn(async (fn: any) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn)));
  prisma.$queryRaw = vi.fn().mockResolvedValue([{ id: 'd1', rank: 1 }]);

  const traceability = { record: vi.fn().mockResolvedValue(undefined) } as any;
  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
    canWriteArea: vi.fn().mockResolvedValue(true),
    getContext: vi.fn().mockResolvedValue({ companyId: 'companyA', ownAreaIds: [] }),
    expandWithDescendants: vi.fn(async (_c: string, ids: string[]) => ids),
  } as any;
  const codes = {
    ensureDefaultTypes: vi.fn().mockResolvedValue(undefined),
    listTypes: vi.fn().mockResolvedValue([]),
    createType: vi.fn(),
    updateType: vi.fn(),
    resolveType: vi.fn().mockResolvedValue({ id: 'dt1', category: DocumentType.PROCEDURE, prefix: 'PRO', defaultValidityDays: 365, alertDays: 30 }),
    nextCode: vi.fn().mockResolvedValue({ code: 'PRO-001', typeConfig: { id: 'dt1', name: 'Procedimento', category: DocumentType.PROCEDURE, prefix: 'PRO', defaultValidityDays: 365, alertDays: 30 } }),
  } as any;
  const editor = {
    provider: 'manual',
    status: vi.fn().mockReturnValue({ configured: false, provider: 'manual', mode: 'MANUAL', url: null, autosave: false, concurrentEditing: false }),
    openPayload: vi.fn().mockReturnValue({ configured: false, provider: 'manual', mode: 'MANUAL', url: null, autosave: false, concurrentEditing: false }),
    isOnline: vi.fn().mockReturnValue(false),
  } as any;
  const storage = {
    provider: 'DATABASE',
    putText: vi.fn().mockResolvedValue({ storageProvider: 'DATABASE', storageKey: 'db:k', fileName: 'doc.docx', mimeType: 'text/plain', sizeBytes: 10, hashSha256: 'hash' }),
    readText: vi.fn().mockResolvedValue('conteudo'),
    putBinary: vi.fn().mockResolvedValue({ storageProvider: 'DATABASE', storageKey: 'db:kbin', fileName: 'doc.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 123, hashSha256: 'hbin' }),
    readBinary: vi.fn().mockResolvedValue(Buffer.from('BINARY-DOCX')),
    usage: vi.fn().mockResolvedValue({ provider: 'DATABASE', files: 0, bytes: 0 }),
  } as any;
  const workItems = { markDirty: vi.fn() } as any;
  const notifications = { create: vi.fn().mockResolvedValue({ id: 'n1' }) } as any;
  const accessPolicy = new DocumentAccessService(prisma, access);
  const render = {
    converterUrl: vi.fn().mockReturnValue(null),
    latestDocx: vi.fn().mockResolvedValue(null),
    signatures: vi.fn().mockResolvedValue([]),
    officialPdf: vi.fn().mockResolvedValue({ buffer: Buffer.from('%PDF-1.7 oficial'), source: 'NATIVE' }),
    downloadCopy: vi.fn(async (pdf: Buffer) => pdf),
    exportDocx: vi.fn().mockResolvedValue({ buffer: Buffer.from('PK'), fileName: 'x.docx' }),
  } as any;
  const content = new DocumentContentService(prisma, accessPolicy, render);
  const workflow = {
    config: vi.fn().mockResolvedValue({ workflowId: null, mode: 'SEQUENTIAL', reviewDays: 5, approvalDays: 5, reviewers: [], approvers: [] }),
    state: vi.fn().mockResolvedValue({ steps: [] }),
    setParticipants: vi.fn().mockResolvedValue({}),
    submit: vi.fn().mockResolvedValue({ status: 'WAITING_REVIEW' }),
    decide: vi.fn().mockResolvedValue({ status: 'APPROVED', approved: true, signature: 'ABC' }),
    verifySignature: vi.fn().mockResolvedValue(undefined),
    signatureHash: vi.fn().mockReturnValue('f'.repeat(64)),
  } as any;
  const distribution = {
    summary: vi.fn().mockResolvedValue({ mine: null }),
    syncAssignments: vi.fn().mockResolvedValue(0),
    setDistribution: vi.fn().mockResolvedValue({}),
    confirm: vi.fn().mockResolvedValue({ id: 'rc1' }),
    currentPublishedVersion: vi.fn().mockResolvedValue(null),
  } as any;
  const changeRequests = { list: vi.fn().mockResolvedValue([]), markImplemented: vi.fn().mockResolvedValue(0) } as any;
  const governance = { retentionUntil: vi.fn().mockResolvedValue(new Date('2031-01-01')), setAccess: vi.fn().mockResolvedValue({}) } as any;
  const ai = {} as any;

  const service = new DocumentsService(
    prisma, traceability, access, codes, editor, storage, workItems, notifications,
    accessPolicy, content, render, workflow, distribution, changeRequests, governance, ai,
  );
  return { service, prisma, traceability, access, codes, storage, notifications, workflow, distribution, changeRequests, governance, render };
}

describe('DocumentsService - GED', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list: escopo de empresa + filtro de área e de confidencialidade', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'], permissions: ['doc:view'] });
    await service.list(me);
    const where = prisma.document.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.deletedAt).toBeNull();
    const visibility = where.AND[0].AND;
    expect(visibility[0].OR).toContainEqual({ orgNodeId: { in: ['areaA'] } });
    expect(visibility[0].OR).toContainEqual({ orgNodeId: null, indicatorId: null });
    // Restritos/confidenciais só para participantes e autorizados.
    expect(visibility[1].OR).toContainEqual({ confidentiality: 'INTERNAL' });
    expect(visibility[1].OR).toContainEqual({ workflowSteps: { some: { userId: 'user-1' } } });
  });

  it('list: gestor do GED (doc:manage) vê todas as classificações da área', async () => {
    const { service, prisma } = makeService({ listAreaFilter: null, permissions: ['doc:manage'] });
    await service.list(me);
    const where = prisma.document.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({});
  });

  it('list: busca usa o texto completo (sem acento) e mantém a empresa', async () => {
    const { service, prisma } = makeService();
    await service.list(me, { status: 'PUBLISHED', type: 'POLICY', search: 'higienização' });
    const where = prisma.document.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.status).toBe('PUBLISHED');
    expect(where.type).toBe('POLICY');
    expect(where.AND).toContainEqual({ id: { in: ['d1'] } });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('summary: contagens vêm do banco (sem teto de lista) e agrupam situações', async () => {
    const { service, prisma } = makeService();
    prisma.document.groupBy = vi.fn(async ({ by }: any) =>
      by[0] === 'status'
        ? [{ status: 'PUBLISHED', _count: { _all: 2 } }, { status: 'DRAFT', _count: { _all: 1 } }, { status: 'IN_REVIEW', _count: { _all: 1 } }, { status: 'IN_APPROVAL', _count: { _all: 3 } }]
        : [{ type: 'PROCEDURE', _count: { _all: 7 } }],
    );
    prisma.document.count = vi.fn().mockResolvedValue(1);
    const res = await service.summary(me);
    expect(res.total).toBe(7);
    expect(res.published).toBe(2);
    expect(res.draft).toBe(2);
    expect(res.waitingApproval).toBe(3);
    expect(res.expired).toBe(1);
    expect(res.byType).toEqual({ PROCEDURE: 7 });
  });

  it('getById: documento de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ doc: null });
    await expect(service.getById(me, 'd-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.document.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('getById: área não permitida -> Forbidden', async () => {
    const { service } = makeService({ doc: baseDoc({ orgNodeId: 'areaB' }), listAreaFilter: ['areaA'] });
    await expect(service.getById(me, 'd1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getById: confidencial sem autorização -> Forbidden', async () => {
    const { service } = makeService({ doc: baseDoc({ confidentiality: 'CONFIDENTIAL', createdById: 'outro', ownerUserId: 'outro' }), permissions: ['doc:view'] });
    await expect(service.getById(me, 'd1')).rejects.toThrow('acesso restrito');
  });

  it('create: editor visual por padrão, código por empresa e revisão inicial sem arquivo Word', async () => {
    const { service, prisma, access, codes, storage } = makeService({ indicator: { ownerNodeId: 'areaA' }, user: { id: 'u2' } });
    await service.create(me, { title: 'Procedimento de Segurança', indicatorId: 'i1', ownerUserId: 'u2', type: 'PROCEDURE', content: '# Objetivo\nTexto' });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'documents', 'create');
    expect(codes.nextCode).toHaveBeenCalled();
    const data = prisma.document.create.mock.calls[0][0].data;
    expect(data.companyId).toBe('companyA');
    expect(data.code).toBe('PRO-001');
    expect(data.typeConfigId).toBe('dt1');
    expect(data.status).toBe('DRAFT');
    expect(data.contentFormat).toBe('STRUCTURED');
    expect(docToPlainText(data.contentJson)).toContain('Objetivo');
    expect(data.confidentiality).toBe('INTERNAL');
    expect(prisma.documentVersion.create).toHaveBeenCalled();
    expect(storage.putText).not.toHaveBeenCalled();
    expect(prisma.documentFile.create).not.toHaveBeenCalled();
  });

  it('create: formato Word cria o .docx inicial da revisão', async () => {
    const { service, prisma, storage } = makeService();
    await service.create(me, { title: 'Manual', contentFormat: 'DOCX' });
    expect(storage.putText).toHaveBeenCalled();
    expect(prisma.documentFile.create.mock.calls[0][0].data.kind).toBe('DOCX');
  });

  it('create: elaborador não pode ser aprovador (nada é gravado)', async () => {
    const { service, prisma } = makeService();
    await expect(service.create(me, { title: 'Doc', approverIds: ['user-1'] })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('create: participantes e público vão para o fluxo e a distribuição', async () => {
    const { service, workflow, distribution } = makeService();
    await service.create(me, { title: 'POP', reviewerIds: ['r1'], approverIds: ['a1'], distribution: { readRequired: true, userIds: ['u9'] } });
    expect(workflow.setParticipants).toHaveBeenCalledWith(me, expect.objectContaining({ id: 'd1' }), expect.objectContaining({ reviewerIds: ['r1'], approverIds: ['a1'] }));
    expect(distribution.setDistribution).toHaveBeenCalledWith(me, expect.objectContaining({ id: 'd1' }), { readRequired: true, userIds: ['u9'] });
  });

  it('create: indicador de outra empresa -> NotFound e não grava', async () => {
    const { service, prisma } = makeService({ indicator: null });
    await expect(service.create(me, { title: 'Doc', indicatorId: 'i-outra' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('create: vínculos em áreas diferentes -> Conflict', async () => {
    const { service, prisma } = makeService({ orgNode: { id: 'areaA' }, indicator: { ownerNodeId: 'areaB' } });
    await expect(service.create(me, { title: 'Doc', orgNodeId: 'areaA', indicatorId: 'i1' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('create com modelo: placeholders resolvidos no editor visual', async () => {
    const { service, prisma } = makeService();
    prisma.documentTemplate.findFirst = vi.fn().mockResolvedValue({
      id: 'tpl1',
      companyId: 'companyA',
      typeConfigId: 'dt1',
      name: 'Modelo',
      content: 'Documento {{document_code}} - {{document_title}} da {{company_name}}',
      storageKey: null,
      active: true,
    });
    await service.create(me, { title: 'POP de Limpeza', type: 'PROCEDURE', templateId: 'tpl1' });
    const data = prisma.document.create.mock.calls[0][0].data;
    expect(docToPlainText(data.contentJson)).toBe('Documento PRO-001 - POP de Limpeza da Empresa A');
  });

  it('create com modelo binário em Word: semeia DOCX real com placeholders aplicados', async () => {
    const { service, prisma, storage } = makeService();
    prisma.documentTemplate.findFirst = vi.fn().mockResolvedValue({
      id: 'tpl1',
      companyId: 'companyA',
      typeConfigId: 'dt1',
      name: 'Modelo',
      content: '{{document_code}}',
      storageKey: 'db:k1',
      active: true,
    });
    storage.readBinary = vi.fn().mockResolvedValue(buildDocx('Código: {{document_code}}'));
    await service.create(me, { title: 'Doc com modelo', templateId: 'tpl1', contentFormat: 'DOCX' });
    const seeded: Buffer = storage.putBinary.mock.calls[0][3];
    expect(isDocxBuffer(seeded)).toBe(true);
    expect(extractDocxText(seeded)).toContain('Código: PRO-001');
    expect(prisma.documentFile.create.mock.calls[0][0].data.contentText).toBeNull();
  });

  it('create com modelo inexistente -> NotFound e não grava', async () => {
    const { service, prisma } = makeService();
    await expect(service.create(me, { title: 'Doc', templateId: 'tpl-outra' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('update: não persiste id/companyId forjados em metadados', async () => {
    const { service, prisma } = makeService({ doc: baseDoc({ orgNodeId: null }) });
    await service.update(me, 'd1', { id: 'hack', companyId: 'companyB', title: 'Rev2' });
    const data = prisma.document.update.mock.calls[0][0].data;
    expect(data.id).toBeUndefined();
    expect(data.companyId).toBeUndefined();
    expect(data.title).toBe('Rev2');
  });

  it('update: documento publicado aceita reenvio dos mesmos valores (só troca o responsável)', async () => {
    const { service, prisma } = makeService({ doc: baseDoc({ status: 'PUBLISHED', title: 'Doc', description: null }), user: { id: 'u2' } });
    await service.update(me, 'd1', { title: 'Doc', description: '', ownerUserId: 'u2' });
    const data = prisma.document.update.mock.calls[0][0].data;
    expect(data.ownerUserId).toBe('u2');
  });

  it('update: documento publicado rejeita mudança real de título', async () => {
    const { service, prisma } = makeService({ doc: baseDoc({ status: 'PUBLISHED', title: 'Doc' }) });
    await expect(service.update(me, 'd1', { title: 'Outro título' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('update: bloqueia alteração direta de status', async () => {
    const { service, prisma } = makeService({ doc: baseDoc({ orgNodeId: null }) });
    await expect(service.update(me, 'd1', { status: 'APPROVED' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  // ---- Modelos (templates) ----

  it('importTemplate: arquivo que não é DOCX -> BadRequest e não grava', async () => {
    const { service, prisma, storage } = makeService();
    const fake = Buffer.from('apenas texto').toString('base64');
    await expect(service.importTemplate(me, { name: 'Modelo X', fileName: 'x.docx', contentBase64: fake })).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.putBinary).not.toHaveBeenCalled();
    expect(prisma.documentTemplate.create).not.toHaveBeenCalled();
  });

  it('importTemplate: DOCX válido -> extrai texto, detecta placeholders e grava binário', async () => {
    const { service, prisma, storage } = makeService();
    const docx = buildDocx('Título: {{document_title}}\nCódigo: {{document_code}}');
    prisma.documentTemplate.create = vi.fn(async ({ data }: any) => ({ id: 'tpl1', ...data }));
    const template = await service.importTemplate(me, { name: 'Modelo POP', fileName: 'pop.docx', contentBase64: docx.toString('base64') });
    expect(storage.putBinary).toHaveBeenCalled();
    expect(template.companyId).toBe('companyA');
    expect(template.placeholders).toEqual(['{{document_title}}', '{{document_code}}']);
    const data = prisma.documentTemplate.create.mock.calls[0][0].data;
    expect(data.storageProvider).toBeUndefined();
    expect(data.storageKey).toBeTruthy();
  });

  it('downloadTemplate: sem binário válido -> gera DOCX do texto', async () => {
    const { service, prisma, storage } = makeService();
    prisma.documentTemplate.findFirst = vi.fn().mockResolvedValue({ id: 'tpl1', companyId: 'companyA', name: 'Modelo Legado', content: 'Conteúdo legado', storageKey: 'templates/legacy', fileName: 'Modelo-Legado.docx' });
    storage.readBinary = vi.fn().mockResolvedValue(Buffer.from('texto puro legado'));
    const result = await service.downloadTemplate(me, 'tpl1');
    expect(isDocxBuffer(result.content)).toBe(true);
    expect(result.fileName).toBe('Modelo-Legado.docx');
  });

  // ---- Conteúdo e arquivos ----

  it('saveContent: grava o JSON do editor e reindexa o texto', async () => {
    const { service, prisma } = makeService({ doc: baseDoc({ status: 'DRAFT', ownerUserId: 'user-1' }) });
    prisma.documentVersion.findFirst = vi.fn().mockResolvedValue({ id: 'v1', revisionNumber: 0 });
    const contentJson = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Lavar as mãos' }] }] };
    const result = await service.saveContent(me, 'd1', { contentJson });
    expect(result.status).toBe('IN_DEVELOPMENT');
    expect(prisma.document.update.mock.calls[0][0].data.contentJson).toEqual(contentJson);
    expect(prisma.documentAutosaveCheckpoint.create).toHaveBeenCalled();
  });

  it('saveContent: documento em aprovação fica bloqueado', async () => {
    const { service } = makeService({ doc: baseDoc({ status: 'IN_APPROVAL' }) });
    await expect(service.saveContent(me, 'd1', { contentJson: { type: 'doc', content: [] } })).rejects.toBeInstanceOf(ConflictException);
  });

  it('uploadFile: DOCX em base64 inválido -> BadRequest e não grava', async () => {
    const { service, storage } = makeService({ doc: baseDoc({ status: 'DRAFT' }) });
    const fake = Buffer.from('nao é um docx').toString('base64');
    await expect(service.uploadFile(me, 'd1', { kind: 'DOCX', fileName: 'x.docx', contentBase64: fake })).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.putBinary).not.toHaveBeenCalled();
  });

  it('uploadFile: DOCX válido vira o Word principal da revisão', async () => {
    const { service, prisma, storage } = makeService({ doc: baseDoc({ status: 'DRAFT' }) });
    prisma.documentVersion.findFirst = vi.fn().mockResolvedValue({ id: 'v1', revisionNumber: 0 });
    const docx = buildDocx('conteúdo editado no Word');
    await service.uploadFile(me, 'd1', { kind: 'DOCX', fileName: 'editado.docx', contentBase64: docx.toString('base64') });
    expect(storage.putBinary).toHaveBeenCalled();
    expect(prisma.documentFile.create.mock.calls[0][0].data.contentText).toBeNull();
    expect(prisma.document.update).toHaveBeenCalledWith(expect.objectContaining({ data: { contentFormat: 'DOCX' } }));
  });

  it('downloadFile: Word editável restrito a quem trabalha no documento', async () => {
    const { service, prisma } = makeService({ doc: baseDoc({ status: 'PUBLISHED', createdById: 'outro' }), permissions: ['doc:view'] });
    prisma.documentFile.findFirst = vi.fn().mockResolvedValue({ id: 'F1', kind: 'DOCX', contentText: null, storageKey: 'db:x', fileName: 'x.docx' });
    await expect(service.downloadFile(me, 'd1', 'F1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('downloadFile: PDF baixado recebe marca d’água; visualização só registra', async () => {
    const { service, prisma, render } = makeService({ doc: baseDoc({ status: 'PUBLISHED' }) });
    prisma.documentFile.findFirst = vi.fn().mockResolvedValue({ id: 'P1', kind: 'PDF', mimeType: 'application/pdf', contentText: null, storageKey: 'db:p', fileName: 'x.pdf', versionId: 'v1' });
    await service.downloadFile(me, 'd1', 'P1');
    expect(render.downloadCopy).toHaveBeenCalledTimes(1);
    expect(prisma.documentDownloadLog.create).toHaveBeenCalled();
    await service.downloadFile(me, 'd1', 'P1', {}, { inline: true });
    expect(render.downloadCopy).toHaveBeenCalledTimes(1);
    expect(prisma.documentViewLog.create).toHaveBeenCalled();
  });

  // ---- Fluxo e status ----

  it('transition: publicado não volta direto para revisão (só pelo fluxo)', async () => {
    const { service, prisma } = makeService({ doc: baseDoc({ status: 'PUBLISHED' }) });
    await expect(service.transition(me, 'd1', 'WAITING_REVIEW' as any, {})).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('transition: tornar obsoleto exige motivo e define a temporalidade', async () => {
    const { service, prisma, governance } = makeService({ doc: baseDoc({ status: 'PUBLISHED', ownerUserId: 'user-1', typeConfigId: 'dt1' }) });
    prisma.documentVersion.findFirst = vi.fn().mockResolvedValue({ id: 'v1', revisionNumber: 0, status: 'PUBLISHED' });
    await expect(service.transition(me, 'd1', 'OBSOLETE' as any, {})).rejects.toBeInstanceOf(BadRequestException);
    await service.transition(me, 'd1', 'OBSOLETE' as any, { comment: 'Substituído pelo novo processo' });
    expect(governance.retentionUntil).toHaveBeenCalledWith('companyA', 'dt1');
    expect(prisma.document.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'OBSOLETE', retentionUntil: new Date('2031-01-01') } }));
    expect(prisma.documentReadConfirmation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'CANCELLED' } }));
  });

  it('decide: aprovação final com "publicar agora" publica com a assinatura já dada', async () => {
    const { service, prisma, workflow, render } = makeService({ doc: baseDoc({ status: 'APPROVED' }) });
    prisma.documentVersion.findFirst = vi.fn().mockResolvedValue({ id: 'v1', revisionNumber: 0, versionLabel: 'Rev. 00', contentHash: 'h' });
    await service.decide(me, 'd1', { decision: 'APPROVE', password: 'x', publishNow: true });
    expect(workflow.decide).toHaveBeenCalled();
    expect(workflow.verifySignature).not.toHaveBeenCalled();
    expect(render.officialPdf).toHaveBeenCalled();
  });

  it('publish: exige senha, gera PDF oficial no banco, substitui a vigente e distribui leitura', async () => {
    const { service, prisma, workflow, storage, distribution, changeRequests } = makeService({ doc: baseDoc({ status: 'APPROVED', typeConfig: { defaultValidityDays: 365, alertDays: 30 } }) });
    prisma.documentVersion.findFirst = vi.fn().mockResolvedValue({ id: 'v1', revisionNumber: 1, versionLabel: 'Rev. 01', contentHash: 'h', publishedById: null });
    await service.publish(me, 'd1', { password: 'segredo' });
    expect(workflow.verifySignature).toHaveBeenCalledWith(me, 'segredo');
    expect(prisma.documentApproval.create.mock.calls[0][0].data).toMatchObject({ approverRole: 'PUBLISHER', signatureMethod: 'PASSWORD' });
    expect(storage.putBinary.mock.calls[0][4]).toBe('application/pdf');
    expect(prisma.documentVersion.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'REPLACED' } }));
    const published = prisma.document.update.mock.calls.find((call: any) => call[0].data.status === 'PUBLISHED')[0].data;
    expect(published.validUntil).toBeInstanceOf(Date);
    expect(distribution.syncAssignments).toHaveBeenCalledWith('companyA', 'd1');
    expect(changeRequests.markImplemented).toHaveBeenCalled();
  });

  it('publish: data futura apenas agenda', async () => {
    const { service, prisma, render } = makeService({ doc: baseDoc({ status: 'APPROVED' }) });
    prisma.documentVersion.findFirst = vi.fn().mockResolvedValue({ id: 'v1', revisionNumber: 0, versionLabel: 'Rev. 00' });
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
    await service.publish(me, 'd1', { password: 'x', publishAt: future });
    expect(prisma.document.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'SCHEDULED_PUBLICATION' } }));
    expect(render.officialPdf).not.toHaveBeenCalled();
  });

  it('publish: rascunho não pode ser publicado', async () => {
    const { service } = makeService({ doc: baseDoc({ status: 'DRAFT' }) });
    await expect(service.publish(me, 'd1', { password: 'x' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('createRevision: copia o conteúdo do editor sem poluir o texto e exige motivo', async () => {
    const contentJson = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Passo 1' }] }] };
    const { service, prisma } = makeService({ doc: baseDoc({ status: 'PUBLISHED', contentFormat: 'STRUCTURED', contentJson }) });
    prisma.documentVersion.findFirst = vi.fn().mockResolvedValue({ id: 'v0', revisionNumber: 0, versionLabel: 'Rev. 00' });
    await expect(service.createRevision(me, 'd1', {})).rejects.toBeInstanceOf(BadRequestException);
    await service.createRevision(me, 'd1', { reason: 'Nova máquina na linha' });
    const version = prisma.documentVersion.create.mock.calls[0][0].data;
    expect(version.versionLabel).toBe('Rev. 01');
    expect(version.changeReason).toBe('Nova máquina na linha');
    const update = prisma.document.update.mock.calls[0][0].data;
    expect(update.contentJson).toEqual(contentJson);
    expect(update.status).toBe('IN_DEVELOPMENT');
    expect(prisma.documentFile.create).not.toHaveBeenCalled();
  });

  it('createRevision: só a partir de documento vigente', async () => {
    const { service } = makeService({ doc: baseDoc({ status: 'DRAFT' }) });
    await expect(service.createRevision(me, 'd1', { reason: 'x' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('confirmRead: delega para a distribuição (revisão vigente)', async () => {
    const { service, distribution } = makeService({ doc: baseDoc({ status: 'PUBLISHED' }) });
    await service.confirmRead(me, 'd1');
    expect(distribution.confirm).toHaveBeenCalledWith(me, expect.objectContaining({ id: 'd1' }), {});
  });

  // ---- Rotina de vencimento ----

  it('expirationSweep: vencido -> EXPIRED e avisa responsável, autor e aprovador', async () => {
    const { service, prisma, notifications } = makeService();
    const yesterday = new Date(Date.now() - 86_400_000);
    prisma.document.findMany = vi.fn().mockResolvedValue([
      baseDoc({ id: 'd1', code: 'PRO-001', status: 'PUBLISHED', validUntil: yesterday, ownerUserId: 'u-owner', approverUserId: 'u-approver' }),
    ]);
    const result = await service.expirationSweep('companyA');
    expect(result.processed).toBe(1);
    expect(prisma.document.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'EXPIRED' } }));
    expect(prisma.documentStatusHistory.create.mock.calls[0][0].data.userId).toBeNull();
    expect(notifications.create).toHaveBeenCalledTimes(3);
    expect(notifications.create.mock.calls[0][3]).toContain('Documento vencido');
    expect(notifications.create.mock.calls[0][5]).toBe('/documents/d1');
  });

  it('expirationSweep: usa o prazo de alerta do tipo; falha de aviso não interrompe', async () => {
    const { service, prisma, notifications } = makeService();
    const in50days = new Date(Date.now() + 50 * 86_400_000);
    prisma.document.findMany = vi.fn().mockResolvedValue([
      baseDoc({ id: 'd2', status: 'PUBLISHED', validUntil: in50days, ownerUserId: 'u-owner', typeConfig: { alertDays: 60 } }),
      baseDoc({ id: 'd3', status: 'PUBLISHED', validUntil: in50days, ownerUserId: 'u-owner', typeConfig: { alertDays: 30 } }),
    ]);
    notifications.create = vi.fn().mockRejectedValue(new Error('smtp down'));
    const result = await service.expirationSweep('companyA', 'user-1');
    expect(result.processed).toBe(1);
    expect(prisma.document.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'd2' }, data: { status: 'NEAR_EXPIRATION' } }));
  });

  // ---- Host WOPI (editor online) ----

  const wopiToken = (over: Partial<Record<string, unknown>> = {}) => ({
    fileId: 'F1',
    documentId: 'd1',
    companyId: 'companyA',
    userId: 'user-1',
    userName: 'Ana',
    canWrite: true,
    exp: Date.now() + 60_000,
    ...over,
  }) as any;

  it('wopiGetFile: arquivo binário -> lê do armazenamento', async () => {
    const { service, prisma, storage } = makeService();
    prisma.documentFile.findFirst = vi.fn().mockResolvedValue({ id: 'F1', documentId: 'd1', companyId: 'companyA', contentText: null, storageKey: 'db:k1', fileName: 'PRO-001.docx', sizeBytes: 100, hashSha256: 'h', createdAt: new Date() });
    const buf = await service.wopiGetFile(wopiToken());
    expect(storage.readBinary).toHaveBeenCalledWith('db:k1');
    expect(buf.toString()).toBe('BINARY-DOCX');
  });

  it('wopiGetFile: conteúdo legado textual -> gera DOCX (assinatura PK)', async () => {
    const { service, prisma, storage } = makeService();
    prisma.documentFile.findFirst = vi.fn().mockResolvedValue({ id: 'F1', documentId: 'd1', companyId: 'companyA', contentText: 'texto legado', storageKey: 'k', fileName: 'x.docx', createdAt: new Date() });
    const buf = await service.wopiGetFile(wopiToken());
    expect(storage.readBinary).not.toHaveBeenCalled();
    expect(buf.subarray(0, 2).toString()).toBe('PK');
  });

  it('wopiPutFile: Word válido em documento editável -> nova versão binária + auditoria', async () => {
    const { service, prisma, storage } = makeService({ doc: baseDoc({ status: 'DRAFT' }) });
    prisma.documentFile.findFirst = vi.fn().mockResolvedValue({ id: 'F1', documentId: 'd1', companyId: 'companyA', contentText: null, storageKey: 'old', versionId: 'v1', fileName: 'x.docx', createdAt: new Date() });
    await service.wopiPutFile(wopiToken(), buildDocx('novo conteúdo'));
    expect(storage.putBinary).toHaveBeenCalled();
    expect(prisma.documentFile.update.mock.calls[0][0].data.storageKey).toBe('db:kbin');
    expect(prisma.documentAutosaveCheckpoint.create).toHaveBeenCalled();
    expect(prisma.documentAuditLog.create.mock.calls[0][0].data.action).toBe('EDITOR_SAVE');
  });

  it('wopiPutFile: conteúdo que não é Word ou documento travado -> Conflict', async () => {
    const editable = makeService({ doc: baseDoc({ status: 'DRAFT' }) });
    editable.prisma.documentFile.findFirst = vi.fn().mockResolvedValue({ id: 'F1', documentId: 'd1', companyId: 'companyA', contentText: null, storageKey: 'old', versionId: 'v1', fileName: 'x.docx', createdAt: new Date() });
    await expect(editable.service.wopiPutFile(wopiToken(), Buffer.from('lixo'))).rejects.toBeInstanceOf(ConflictException);
    const locked = makeService({ doc: baseDoc({ status: 'PUBLISHED' }) });
    locked.prisma.documentFile.findFirst = editable.prisma.documentFile.findFirst;
    await expect(locked.service.wopiPutFile(wopiToken(), buildDocx('x'))).rejects.toBeInstanceOf(ConflictException);
    expect(locked.storage.putBinary).not.toHaveBeenCalled();
  });

  it('wopiCheckFileInfo: UserCanWrite reflete status editável + escopo do token', async () => {
    const { service, prisma } = makeService({ doc: baseDoc({ status: 'DRAFT' }) });
    prisma.documentFile.findFirst = vi.fn().mockResolvedValue({ id: 'F1', documentId: 'd1', companyId: 'companyA', contentText: null, storageKey: 'k', fileName: 'PRO-001.docx', sizeBytes: 42, hashSha256: 'h9', createdAt: new Date() });
    const writable = await service.wopiCheckFileInfo(wopiToken({ canWrite: true }));
    expect(writable.UserCanWrite).toBe(true);
    const readonly = await service.wopiCheckFileInfo(wopiToken({ canWrite: false }));
    expect(readonly.UserCanWrite).toBe(false);
  });
});

function baseDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    companyId: 'companyA',
    number: 1,
    code: null,
    orgNodeId: null,
    indicatorId: null,
    ownerUserId: null,
    approverUserId: null,
    createdById: 'user-1',
    typeConfigId: null,
    typeConfig: null,
    title: 'Doc',
    description: null,
    type: 'PROCEDURE',
    status: 'DRAFT',
    confidentiality: 'INTERNAL',
    contentFormat: 'STRUCTURED',
    contentJson: null,
    bodyText: null,
    version: 1,
    content: null,
    externalUrl: null,
    changeNote: null,
    validFrom: null,
    validUntil: null,
    reviewIntervalMonths: null,
    retentionUntil: null,
    readRequired: false,
    readDueDays: null,
    approvedAt: null,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    orgNode: null,
    indicator: null,
    owner: null,
    approver: null,
    createdBy: null,
    ...overrides,
  };
}
