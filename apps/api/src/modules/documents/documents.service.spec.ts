import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentType, UserRoleEnum } from '@prisma/client';
import { DocumentsService } from './documents.service';
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
}) {
  const hasDocOverride = Object.prototype.hasOwnProperty.call(opts ?? {}, 'doc');
  const scopedDoc = hasDocOverride ? opts?.doc : baseDoc();
  const prisma: any = {
    document: {
      findMany: vi.fn().mockResolvedValue(opts?.docs ?? []),
      findFirst: vi.fn(async (args: any) => {
        if (args?.where?.id) return scopedDoc;
        if (args?.orderBy?.number) return null;
        if (args?.where?.code) return null;
        return scopedDoc;
      }),
      create: vi.fn(async ({ data }: any) => baseDoc({ ...data, id: 'd1', number: data.number ?? 1, indicatorId: opts?.indicator ? 'i1' : null })),
      update: vi.fn().mockResolvedValue({ id: 'd1', number: 1, companyId: 'companyA', title: 'Doc', status: 'APPROVED', type: 'PROCEDURE', version: 1, indicatorId: null }),
      count: vi.fn().mockResolvedValue(0),
    },
    documentTypeConfig: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'dt1', category: DocumentType.PROCEDURE, prefix: 'PRO', defaultValidityDays: 365, alertDays: 30 }),
      update: vi.fn().mockResolvedValue({ id: 'dt1' }),
    },
    documentTemplate: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'tpl1' }) },
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
      count: vi.fn().mockResolvedValue(0),
    },
    documentStatusHistory: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'h1' }) },
    documentWorkflow: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'wf1' }) },
    documentWorkflowStep: { create: vi.fn().mockResolvedValue({ id: 'wfs1' }) },
    documentApproval: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'a1' }) },
    documentReviewRequest: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'rr1' }) },
    documentEditRequest: {
      create: vi.fn().mockResolvedValue({ id: 'er1' }),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: 'er1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    documentComment: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'c1' }) },
    documentAuditLog: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'al1' }) },
    documentExternalMetadata: { findUnique: vi.fn().mockResolvedValue(null) },
    documentTagRelation: { findMany: vi.fn().mockResolvedValue([]) },
    documentReadConfirmation: { create: vi.fn().mockResolvedValue({ id: 'rc1' }) },
    documentEditorSession: { create: vi.fn().mockResolvedValue({ id: 'es1' }) },
    documentAutosaveCheckpoint: { create: vi.fn().mockResolvedValue({ id: 'cp1' }) },
    orgNode: { findFirst: vi.fn().mockResolvedValue(opts?.orgNode ?? null), findMany: vi.fn().mockResolvedValue([]) },
    indicator: { findFirst: vi.fn().mockResolvedValue(opts?.indicator ?? null), findMany: vi.fn().mockResolvedValue([]) },
    user: { findFirst: vi.fn().mockResolvedValue(opts?.user ?? null), findMany: vi.fn().mockResolvedValue([]) },
  };
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));

  const traceability = { record: vi.fn().mockResolvedValue(undefined) } as any;
  const access = {
    listAreaFilter: vi.fn().mockResolvedValue(opts?.listAreaFilter ?? null),
    assertCanWrite: vi.fn().mockResolvedValue(undefined),
  } as any;
  const codes = {
    ensureDefaultTypes: vi.fn().mockResolvedValue(undefined),
    listTypes: vi.fn().mockResolvedValue([]),
    createType: vi.fn(),
    updateType: vi.fn(),
    resolveType: vi.fn().mockResolvedValue({ id: 'dt1', category: DocumentType.PROCEDURE, prefix: 'PRO', defaultValidityDays: 365, alertDays: 30 }),
    nextCode: vi.fn().mockResolvedValue({ code: 'PRO-001', typeConfig: { id: 'dt1', category: DocumentType.PROCEDURE, prefix: 'PRO', defaultValidityDays: 365, alertDays: 30 } }),
  } as any;
  const editor = {
    status: vi.fn().mockReturnValue({ configured: false, provider: 'manual', mode: 'MANUAL', url: null, autosave: false, concurrentEditing: false }),
    openPayload: vi.fn().mockReturnValue({ configured: false, provider: 'manual', mode: 'MANUAL', url: null, autosave: false, concurrentEditing: false }),
  } as any;
  const storage = {
    putText: vi.fn().mockResolvedValue({ storageProvider: 'LOCAL', storageKey: 'k', fileName: 'doc.docx', mimeType: 'text/plain', sizeBytes: 10, hashSha256: 'hash' }),
    readText: vi.fn().mockResolvedValue('conteudo'),
    putBinary: vi.fn().mockResolvedValue({ storageProvider: 'LOCAL', storageKey: 'kbin', fileName: 'doc.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 123, hashSha256: 'hbin' }),
    readBinary: vi.fn().mockResolvedValue(Buffer.from('BINARY-DOCX')),
  } as any;
  const workItems = { markDirty: vi.fn() } as any;

  const service = new DocumentsService(prisma, traceability, access, codes, editor, storage, workItems);
  return { service, prisma, traceability, access, codes, storage };
}

describe('DocumentsService - gestao documental', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list: escopo de empresa + filtro de area (documentos gerais visiveis)', async () => {
    const { service, prisma } = makeService({ listAreaFilter: ['areaA'] });
    await service.list(me);
    const where = prisma.document.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.deletedAt).toBeNull();
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: { in: ['areaA'] } });
    expect(where.AND[0].OR).toContainEqual({ orgNodeId: null, indicatorId: null });
  });

  it('list: status/tipo/busca sem trocar empresa', async () => {
    const { service, prisma } = makeService();
    await service.list(me, { status: 'PUBLISHED', type: 'POLICY', search: 'lgpd' });
    const where = prisma.document.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('companyA');
    expect(where.status).toBe('PUBLISHED');
    expect(where.type).toBe('POLICY');
    expect(where.AND[0].OR[0].title).toEqual({ contains: 'lgpd', mode: 'insensitive' });
  });

  it('summary: vencidos e a vencer a partir da listagem visivel', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const soon = new Date(Date.now() + 86400000 * 20).toISOString();
    const { service } = makeService({
      docs: [
        baseDoc({ id: 'd1', status: 'PUBLISHED', validUntil: past }),
        baseDoc({ id: 'd2', status: 'PUBLISHED', validUntil: soon }),
        baseDoc({ id: 'd3', status: 'DRAFT' }),
      ],
    });
    const res = await service.summary(me);
    expect(res.total).toBe(3);
    expect(res.published).toBe(2);
    expect(res.draft).toBe(1);
    expect(res.expired).toBe(1);
    expect(res.needsReview).toBe(1);
    expect(res.expiringSoon[0].id).toBe('d1');
  });

  it('getById: documento de outra empresa -> NotFound', async () => {
    const { service, prisma } = makeService({ doc: null });
    await expect(service.getById(me, 'd-outra')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.document.findFirst.mock.calls[0][0].where.companyId).toBe('companyA');
  });

  it('getById: area nao permitida -> Forbidden', async () => {
    const { service } = makeService({ doc: baseDoc({ orgNodeId: 'areaB' }), listAreaFilter: ['areaA'] });
    await expect(service.getById(me, 'd1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create: valida vinculos, gera codigo por empresa e cria versao/arquivo inicial', async () => {
    const { service, prisma, access, codes, storage } = makeService({ indicator: { ownerNodeId: 'areaA' }, user: { id: 'u2' } });
    await service.create(me, { title: 'Procedimento de Seguranca', indicatorId: 'i1', ownerUserId: 'u2', type: 'PROCEDURE' });
    expect(access.assertCanWrite).toHaveBeenCalledWith('user-1', 'areaA', 'documents', 'create');
    expect(codes.nextCode).toHaveBeenCalled();
    expect(storage.putText).toHaveBeenCalled();
    const data = prisma.document.create.mock.calls[0][0].data;
    expect(data.companyId).toBe('companyA');
    expect(data.number).toBe(1);
    expect(data.code).toBe('PRO-001');
    expect(data.status).toBe('DRAFT');
    expect(data.createdById).toBe('user-1');
    expect(data.publishedAt).toBeNull();
    expect(data.approvedAt).toBeNull();
    expect(prisma.documentVersion.create).toHaveBeenCalled();
    expect(prisma.documentFile.create).toHaveBeenCalled();
  });

  it('create: indicador de outra empresa -> NotFound e nao grava', async () => {
    const { service, prisma } = makeService({ indicator: null });
    await expect(service.create(me, { title: 'Doc', indicatorId: 'i-outra' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('create: vinculos em areas diferentes -> Conflict', async () => {
    const { service, prisma } = makeService({ orgNode: { id: 'areaA' }, indicator: { ownerNodeId: 'areaB' } });
    await expect(service.create(me, { title: 'Doc', orgNodeId: 'areaA', indicatorId: 'i1' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('update: nao persiste id/companyId forjados em metadados', async () => {
    const { service, prisma } = makeService({ doc: baseDoc({ orgNodeId: null, approvedAt: null, publishedAt: null }) });
    await service.update(me, 'd1', { id: 'hack', companyId: 'companyB', title: 'Rev2' });
    const data = prisma.document.update.mock.calls[0][0].data;
    expect(data.id).toBeUndefined();
    expect(data.companyId).toBeUndefined();
    expect(data.title).toBe('Rev2');
  });

  it('update: bloqueia alteracao direta de status', async () => {
    const { service, prisma } = makeService({ doc: baseDoc({ orgNodeId: null }) });
    await expect(service.update(me, 'd1', { status: 'APPROVED' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.document.update).not.toHaveBeenCalled();
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

  it('wopiGetFile: arquivo binario -> le do storage (sem corromper)', async () => {
    const { service, prisma, storage } = makeService();
    prisma.documentFile.findFirst = vi.fn().mockResolvedValue({ id: 'F1', documentId: 'd1', companyId: 'companyA', contentText: null, storageKey: 'k1', fileName: 'PRO-001.docx', sizeBytes: 100, hashSha256: 'h', createdAt: new Date() });
    const buf = await service.wopiGetFile(wopiToken());
    expect(storage.readBinary).toHaveBeenCalledWith('k1');
    expect(buf.toString()).toBe('BINARY-DOCX');
  });

  it('wopiGetFile: conteudo legado textual -> gera DOCX (assinatura PK)', async () => {
    const { service, prisma, storage } = makeService();
    prisma.documentFile.findFirst = vi.fn().mockResolvedValue({ id: 'F1', documentId: 'd1', companyId: 'companyA', contentText: 'texto legado', storageKey: 'k', fileName: 'x.docx', createdAt: new Date() });
    const buf = await service.wopiGetFile(wopiToken());
    expect(storage.readBinary).not.toHaveBeenCalled();
    expect(buf.subarray(0, 2).toString()).toBe('PK'); // ZIP/OOXML
  });

  it('wopiPutFile: doc editavel -> grava versao binaria + checkpoint + auditoria', async () => {
    const { service, prisma, storage } = makeService({ doc: baseDoc({ status: 'DRAFT' }) });
    prisma.documentFile.findFirst = vi.fn().mockResolvedValue({ id: 'F1', documentId: 'd1', companyId: 'companyA', contentText: null, storageKey: 'old', versionId: 'v1', fileName: 'x.docx', createdAt: new Date() });
    await service.wopiPutFile(wopiToken(), Buffer.from('NOVO-DOCX'));
    expect(storage.putBinary).toHaveBeenCalled();
    expect(prisma.documentFile.update.mock.calls[0][0].data.storageKey).toBe('kbin');
    expect(prisma.documentAutosaveCheckpoint.create).toHaveBeenCalled();
    expect(prisma.documentAuditLog.create.mock.calls[0][0].data.action).toBe('EDITOR_SAVE');
  });

  it('wopiPutFile: doc nao editavel -> Conflict e nao grava', async () => {
    const { service, prisma, storage } = makeService({ doc: baseDoc({ status: 'PUBLISHED' }) });
    prisma.documentFile.findFirst = vi.fn().mockResolvedValue({ id: 'F1', documentId: 'd1', companyId: 'companyA', contentText: null, storageKey: 'old', versionId: 'v1', fileName: 'x.docx', createdAt: new Date() });
    await expect(service.wopiPutFile(wopiToken(), Buffer.from('x'))).rejects.toBeInstanceOf(ConflictException);
    expect(storage.putBinary).not.toHaveBeenCalled();
  });

  it('wopiCheckFileInfo: UserCanWrite reflete status editavel + escopo do token', async () => {
    const { service, prisma } = makeService({ doc: baseDoc({ status: 'DRAFT' }) });
    prisma.documentFile.findFirst = vi.fn().mockResolvedValue({ id: 'F1', documentId: 'd1', companyId: 'companyA', contentText: null, storageKey: 'k', fileName: 'PRO-001.docx', sizeBytes: 42, hashSha256: 'h9', createdAt: new Date() });
    const writable = await service.wopiCheckFileInfo(wopiToken({ canWrite: true }));
    expect(writable.BaseFileName).toBe('PRO-001.docx');
    expect(writable.Size).toBe(42);
    expect(writable.UserCanWrite).toBe(true);
    expect(writable.SupportsLocks).toBe(true);
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
    title: 'Doc',
    description: null,
    type: 'PROCEDURE',
    status: 'DRAFT',
    version: 1,
    content: null,
    externalUrl: null,
    changeNote: null,
    validFrom: null,
    validUntil: null,
    reviewIntervalMonths: null,
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
