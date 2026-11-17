import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DocumentWorkflowService } from './document-workflow.service';
import type { AuthPayload } from '../auth/auth.types';

const PASSWORD_HASH = bcrypt.hashSync('senha-certa', 4);

const user = (sub: string): AuthPayload => ({ sub, email: `${sub}@x.com`, name: sub.toUpperCase(), role: UserRoleEnum.ANALYST, companyId: 'companyA' });

function makeWorkflow(opts: { reviewers?: string[]; approvers?: string[]; mode?: string; steps?: any[]; version?: any } = {}) {
  let steps: any[] = opts.steps ?? [];
  let currentDoc = doc({ status: steps.some((item) => item.role === 'APPROVAL') ? 'WAITING_APPROVAL' : steps.length ? 'WAITING_REVIEW' : 'DRAFT' });
  const prisma: any = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    documentWorkflow: {
      findFirst: vi.fn().mockResolvedValue({ id: 'wf1', mode: opts.mode ?? 'SEQUENTIAL', steps: { reviewers: opts.reviewers ?? ['r1', 'r2'], approvers: opts.approvers ?? ['a1'], reviewDays: 3, approvalDays: 2 } }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    documentTypeConfig: { findFirst: vi.fn().mockResolvedValue(null) },
    user: {
      findMany: vi.fn(async ({ where }: any) => (where?.id?.in ?? []).map((id: string) => ({ id, name: id }))),
      findUnique: vi.fn().mockResolvedValue({ passwordHash: PASSWORD_HASH, active: true }),
    },
    documentVersion: {
      findFirst: vi.fn().mockResolvedValue(opts.version ?? { id: 'v1', revisionNumber: 0, versionLabel: 'Rev. 00', changeSummary: null, contentHash: 'hash-conteudo', docxFileId: null }),
      update: vi.fn().mockResolvedValue({}),
    },
    documentWorkflowStep: {
      findMany: vi.fn(async () => steps.map((item) => ({ ...item }))),
      createMany: vi.fn(async ({ data }: any) => {
        steps = [...steps, ...data.map((item: any, index: number) => ({ id: `new-${index}-${item.userId}`, ...item }))];
        return { count: data.length };
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        for (const item of steps) if (!where.decision || item.decision === where.decision) Object.assign(item, data);
        return { count: 0 };
      }),
      update: vi.fn(async ({ where, data }: any) => Object.assign(steps.find((item) => item.id === where.id), data)),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    documentApproval: { create: vi.fn().mockResolvedValue({ id: 'ap1' }) },
    document: {
      findFirst: vi.fn(async () => ({ ...currentDoc })),
      update: vi.fn(async ({ data }: any) => (currentDoc = { ...currentDoc, ...data })),
    },
    documentStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    documentAuditLog: { create: vi.fn().mockResolvedValue({}) },
    documentReviewRequest: { create: vi.fn().mockResolvedValue({}) },
    documentFile: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  let previous: Promise<unknown> = Promise.resolve();
  prisma.$transaction = vi.fn((fn: any) => {
    const result = previous.then(() => fn(prisma));
    previous = result.catch(() => {});
    return result;
  });
  const accessPolicy = { isManager: vi.fn().mockResolvedValue(false) } as any;
  const notifications = { create: vi.fn().mockResolvedValue({}) } as any;
  const workItems = { markDirty: vi.fn() } as any;
  const content = { currentBodyText: vi.fn().mockResolvedValue('texto') } as any;
  const render = { latestDocx: vi.fn().mockResolvedValue(null) } as any;
  const service = new DocumentWorkflowService(prisma, accessPolicy, notifications, workItems, content, render);
  return { service, prisma, notifications, getSteps: () => steps };
}

const doc = (overrides: Record<string, unknown> = {}) => ({
  id: 'd1',
  companyId: 'companyA',
  code: 'POP-001',
  number: 1,
  title: 'Higienização',
  status: 'DRAFT',
  ownerUserId: 'autor',
  createdById: 'autor',
  approverUserId: 'a1',
  typeConfigId: null,
  contentFormat: 'STRUCTURED',
  contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Lavar as mãos' }] }] },
  changeNote: null,
  ...overrides,
});

const step = (id: string, role: string, userId: string, order: number, decision = 'PENDING') => ({ id, role, userId, stepOrder: order, decision, versionId: 'v1', documentId: 'd1', delegatedFromUserId: null });

describe('DocumentWorkflowService - fluxo assinado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('participantes: elaborador não revisa nem aprova; sem sobreposição de papéis', async () => {
    const { service } = makeWorkflow();
    await expect(service.setParticipants(user('autor'), doc(), { reviewerIds: ['autor'], approverIds: ['a1'] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setParticipants(user('autor'), doc(), { reviewerIds: ['r1'], approverIds: ['r1'] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('envio: exige aprovador e cria a revisão sequencial com prazos encadeados', async () => {
    const empty = makeWorkflow({ approvers: [] });
    empty.prisma.documentWorkflow.findFirst = vi.fn().mockResolvedValue({ id: 'wf1', mode: 'SEQUENTIAL', steps: { reviewers: [], approvers: [] } });
    await expect(empty.service.submit(user('autor'), doc({ approverUserId: null }))).rejects.toBeInstanceOf(BadRequestException);

    const { service, prisma, notifications } = makeWorkflow();
    const result = await service.submit(user('autor'), doc());
    expect(result.status).toBe('WAITING_REVIEW');
    const created = prisma.documentWorkflowStep.createMany.mock.calls[0][0].data;
    expect(created.map((item: any) => [item.role, item.userId, item.stepOrder])).toEqual([['REVIEW', 'r1', 1], ['REVIEW', 'r2', 2]]);
    expect(created[1].dueAt.getTime()).toBeGreaterThan(created[0].dueAt.getTime());
    // Conteúdo congelado com código de integridade.
    const frozen = prisma.documentVersion.update.mock.calls[0][0].data;
    expect(frozen.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(frozen.bodyText).toContain('Lavar as mãos');
    // Só o primeiro revisor é avisado no modo sequencial.
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create.mock.calls[0][1]).toBe('r1');
  });

  it('envio sem revisores vai direto para aprovação', async () => {
    const { service, prisma } = makeWorkflow({ reviewers: [] });
    const result = await service.submit(user('autor'), doc());
    expect(result.status).toBe('WAITING_APPROVAL');
    expect(prisma.documentWorkflowStep.createMany.mock.calls[0][0].data[0]).toMatchObject({ role: 'APPROVAL', userId: 'a1' });
  });

  it('nova revisão exige o resumo do que mudou', async () => {
    const { service } = makeWorkflow({ version: { id: 'v2', revisionNumber: 1, versionLabel: 'Rev. 01', changeSummary: null } });
    await expect(service.submit(user('autor'), doc())).rejects.toThrow('Descreva o que mudou');
  });

  it('decisão: só o designado da etapa ativa decide; elaborador nunca', async () => {
    const steps = [step('s1', 'REVIEW', 'r1', 1), step('s2', 'REVIEW', 'r2', 2)];
    const { service } = makeWorkflow({ steps });
    const inReview = doc({ status: 'WAITING_REVIEW' });
    await expect(service.decide(user('autor'), inReview, { decision: 'APPROVE', password: 'senha-certa' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.decide(user('x9'), inReview, { decision: 'APPROVE', password: 'senha-certa' })).rejects.toThrow('não está atribuída');
    await expect(service.decide(user('r2'), inReview, { decision: 'APPROVE', password: 'senha-certa' })).rejects.toThrow('ainda não começou');
  });

  it('senha errada não registra decisão; 5 erros bloqueiam a assinatura', async () => {
    const { service, prisma } = makeWorkflow({ steps: [step('s1', 'REVIEW', 'r1', 1)] });
    const inReview = doc({ status: 'WAITING_REVIEW' });
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(service.decide(user('r1'), inReview, { decision: 'APPROVE', password: 'errada' })).rejects.toThrow('Senha incorreta');
    }
    expect(prisma.documentWorkflowStep.update).not.toHaveBeenCalled();
    await expect(service.decide(user('r1'), inReview, { decision: 'APPROVE', password: 'senha-certa' })).rejects.toThrow('Muitas tentativas');
  });

  it('último revisor aprova: abre a aprovação e grava a assinatura', async () => {
    const steps = [step('s1', 'REVIEW', 'r1', 1, 'APPROVED'), step('s2', 'REVIEW', 'r2', 2)];
    const { service, prisma, notifications } = makeWorkflow({ steps });
    const result = await service.decide(user('r2'), doc({ status: 'IN_REVIEW' }), { decision: 'APPROVE', password: 'senha-certa' }, { ip: '10.0.0.1', userAgent: 'vitest' });
    expect(result.status).toBe('WAITING_APPROVAL');
    const approval = prisma.documentApproval.create.mock.calls[0][0].data;
    expect(approval).toMatchObject({ approverUserId: 'r2', approverRole: 'REVIEWER', decision: 'APPROVED', signatureMethod: 'PASSWORD', contentHash: 'hash-conteudo', ip: '10.0.0.1' });
    expect(approval.signatureHash).toMatch(/^[0-9a-f]{64}$/);
    expect(prisma.documentWorkflowStep.createMany.mock.calls[0][0].data[0]).toMatchObject({ role: 'APPROVAL', userId: 'a1' });
    expect(notifications.create.mock.calls.some((call: any[]) => call[1] === 'a1')).toBe(true);
  });

  it('aprovador final aprova: documento aprovado e elaborador avisado', async () => {
    const { service, prisma, notifications } = makeWorkflow({ steps: [step('s3', 'APPROVAL', 'a1', 1)] });
    const result = await service.decide(user('a1'), doc({ status: 'WAITING_APPROVAL' }), { decision: 'APPROVE', password: 'senha-certa' });
    expect(result.status).toBe('APPROVED');
    expect(result.approved).toBe(true);
    expect(prisma.document.update.mock.calls[0][0].data).toMatchObject({ status: 'APPROVED' });
    expect(notifications.create.mock.calls.some((call: any[]) => call[1] === 'autor' && String(call[3]).includes('aprovado'))).toBe(true);
  });

  it('pedido de ajustes exige motivo, cancela as etapas pendentes e volta ao elaborador', async () => {
    const { service, prisma } = makeWorkflow({ steps: [step('s1', 'REVIEW', 'r1', 1), step('s2', 'REVIEW', 'r2', 2)] });
    const inReview = doc({ status: 'WAITING_REVIEW' });
    await expect(service.decide(user('r1'), inReview, { decision: 'ADJUST', password: 'senha-certa' })).rejects.toBeInstanceOf(BadRequestException);
    const result = await service.decide(user('r1'), inReview, { decision: 'ADJUST', password: 'senha-certa', comment: 'Faltam os EPIs' });
    expect(result.status).toBe('ADJUSTMENTS_REQUESTED');
    expect(prisma.documentWorkflowStep.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { decision: 'CANCELLED' } }));
    expect(prisma.documentReviewRequest.create).toHaveBeenCalled();
  });

  it('reprovar é decisão do aprovador, não do revisor', async () => {
    const { service } = makeWorkflow({ steps: [step('s1', 'REVIEW', 'r1', 1)] });
    await expect(service.decide(user('r1'), doc({ status: 'WAITING_REVIEW' }), { decision: 'REJECT', password: 'senha-certa', comment: 'não' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('etapas ativas: paralelo libera todos; sequencial só a menor ordem pendente', () => {
    const { service } = makeWorkflow();
    const rows = [step('a', 'REVIEW', 'r1', 1, 'APPROVED'), step('b', 'REVIEW', 'r2', 2), step('c', 'REVIEW', 'r3', 3)];
    expect([...service.activeStepIds(rows, 'SEQUENTIAL', 'IN_REVIEW' as any)]).toEqual(['b']);
    expect([...service.activeStepIds(rows, 'PARALLEL', 'IN_REVIEW' as any)].sort()).toEqual(['b', 'c']);
    expect(service.activeStepIds(rows, 'SEQUENTIAL', 'DRAFT' as any).size).toBe(0);
  });

  it('duas aprovações paralelas usam o estado atual e concluem a revisão', async () => {
    const { service, prisma } = makeWorkflow({ reviewers: [], approvers: ['a1', 'a2'], mode: 'PARALLEL', steps: [step('s1', 'APPROVAL', 'a1', 1), step('s2', 'APPROVAL', 'a2', 1)] });
    const stale = doc({ status: 'WAITING_APPROVAL' });
    const results = await Promise.all(['a1', 'a2'].map((id) => service.decide(user(id), stale, { decision: 'APPROVE', password: 'senha-certa' })));
    expect(results.map((result) => result.status)).toEqual(['IN_APPROVAL', 'APPROVED']);
    expect(prisma.documentApproval.create).toHaveBeenCalledTimes(2);
  });

  it('clique repetido não registra duas assinaturas da mesma etapa', async () => {
    const { service, prisma } = makeWorkflow({ steps: [step('s1', 'APPROVAL', 'a1', 1)] });
    const stale = doc({ status: 'WAITING_APPROVAL' });
    const results = await Promise.allSettled([1, 2].map(() => service.decide(user('a1'), stale, { decision: 'APPROVE', password: 'senha-certa' })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(prisma.documentApproval.create).toHaveBeenCalledTimes(1);
  });

  it('envio não congela uma cópia antiga quando o conteúdo mudou', async () => {
    const { service, prisma } = makeWorkflow();
    prisma.document.findFirst.mockResolvedValue(doc({ updatedAt: new Date('2026-11-16T12:00:01Z') }));
    await expect(service.submit(user('autor'), doc({ updatedAt: new Date('2026-11-16T12:00:00Z') }))).rejects.toThrow('mudou durante');
    expect(prisma.documentWorkflowStep.createMany).not.toHaveBeenCalled();
  });
});
