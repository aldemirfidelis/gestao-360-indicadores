import { describe, it, expect, vi } from 'vitest';
import { UserRoleEnum } from '@prisma/client';
import { WorkItemAggregationService } from './work-item-aggregation.service';
import { WorkItemPriorityService } from './work-item-priority.service';
import type { AuthPayload } from '../auth/auth.types';

const me: AuthPayload = { sub: 'u1', email: 'u@x.com', name: 'U', role: UserRoleEnum.ANALYST, companyId: 'c1' };

function makePrisma(over: { actions?: unknown[]; actionTasks?: unknown[] } = {}) {
  const empty = () => ({ findMany: vi.fn().mockResolvedValue([]) });
  return {
    actionPlan: { findMany: vi.fn().mockResolvedValue(over.actions ?? []) },
    actionTask: { findMany: vi.fn().mockResolvedValue(over.actionTasks ?? []) },
    projectTask: empty(),
    workflowTask: empty(),
    workflowApproval: empty(),
    meeting: empty(),
    document: empty(),
    documentEditRequest: empty(),
    audit: empty(),
    auditFinding: empty(),
    formSubmission: empty(),
    riskRegister: empty(),
    nonConformity: empty(),
    indicatorResult: empty(),
    notification: empty(),
    userDelegation: { findMany: vi.fn().mockResolvedValue([]) },
    workItemIndex: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    // rebuildForUser agrupa upserts + deleteMany numa unica transacao.
    $transaction: vi.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
  } as any;
}

describe('WorkItemAggregationService', () => {
  it('agrega uma ação atrasada como OVERDUE_ACTION, faz upsert e poda os obsoletos', async () => {
    const past = new Date(Date.now() - 5 * 86_400_000);
    const prisma = makePrisma({
      actions: [{
        id: 'a1', title: 'Plano X', status: 'IN_PROGRESS', criticality: 'HIGH', priority: 'HIGH',
        dueDate: past, ownerNodeId: 'n1', progress: 20, evidenceRequired: false, origin: 'MANUAL',
        createdAt: new Date(), updatedAt: new Date(),
      }],
    });
    const svc = new WorkItemAggregationService(prisma, new WorkItemPriorityService());

    const count = await svc.rebuildForUser(me);

    expect(count).toBe(1);
    expect(prisma.workItemIndex.upsert).toHaveBeenCalledTimes(1);
    const arg = prisma.workItemIndex.upsert.mock.calls[0][0];
    expect(arg.where.dedupeKey).toBe('ACTION_PLAN:a1:OVERDUE_ACTION:u1');
    expect(arg.create.itemType).toBe('OVERDUE_ACTION');
    expect(arg.create.overdueDays).toBeGreaterThan(0);
    expect(arg.create.assignedUserId).toBe('u1');
    expect(prisma.workItemIndex.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('sem itens: poda tudo do usuário', async () => {
    const prisma = makePrisma();
    const svc = new WorkItemAggregationService(prisma, new WorkItemPriorityService());
    const count = await svc.rebuildForUser(me);
    expect(count).toBe(0);
    expect(prisma.workItemIndex.upsert).not.toHaveBeenCalled();
    expect(prisma.workItemIndex.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('materializa cada tarefa de plano como item individual vinculado à origem', async () => {
    const prisma = makePrisma({
      actionTasks: [{
        id: 'task-a1',
        actionId: 'a1',
        title: 'Validar evidências',
        dueDate: new Date(Date.now() + 86_400_000),
        startDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        action: {
          title: 'Plano X',
          ownerNodeId: 'n1',
          priority: 'HIGH',
          criticality: 'HIGH',
          evidenceRequired: true,
        },
      }],
    });
    const svc = new WorkItemAggregationService(prisma, new WorkItemPriorityService());

    const count = await svc.rebuildForUser(me);

    expect(count).toBe(1);
    const arg = prisma.workItemIndex.upsert.mock.calls[0][0];
    expect(arg.where.dedupeKey).toBe('ACTION_TASK:task-a1:TASK:u1');
    expect(arg.create.requiresEvidence).toBe(true);
    expect(arg.create.availableActions[0].href).toBe('/actions/a1');
  });

  it('materializa itens delegados para o substituto sem alterar a origem', async () => {
    const future = new Date(Date.now() + 5 * 86_400_000);
    const prisma = makePrisma();
    prisma.userDelegation.findMany.mockResolvedValue([{
      id: 'del1',
      delegatorUserId: 'u2',
      reason: 'Ferias',
      delegator: { id: 'u2', name: 'Delegante', email: 'd@x.com', role: UserRoleEnum.COLLABORATOR },
    }]);
    prisma.actionPlan.findMany.mockImplementation(({ where }: any) => {
      if (where.responsibleUserId === 'u2') return Promise.resolve([{
        id: 'a2', title: 'Plano delegado', status: 'IN_PROGRESS', criticality: 'HIGH', priority: 'HIGH',
        dueDate: future, ownerNodeId: 'n1', progress: 10, evidenceRequired: false, origin: 'MANUAL',
        createdAt: new Date(), updatedAt: new Date(),
      }]);
      return Promise.resolve([]);
    });
    const svc = new WorkItemAggregationService(prisma, new WorkItemPriorityService());

    const count = await svc.rebuildForUser(me);

    expect(count).toBe(1);
    const arg = prisma.workItemIndex.upsert.mock.calls[0][0];
    expect(arg.where.dedupeKey).toBe('ACTION_PLAN:a2:TASK:u1');
    expect(arg.create.assignedUserId).toBe('u1');
    expect(arg.create.isDelegated).toBe(true);
    expect(arg.create.delegatedFromUserId).toBe('u2');
    expect(arg.create.contextData.delegatedFromName).toBe('Delegante');
  });

  // ---------- Coletores de Recrutamento e C&S ----------

  function withGrants(prisma: any, keys: string[]) {
    prisma.user = {
      findUnique: vi.fn().mockResolvedValue({
        permissions: keys.map((key) => ({ permission: { key } })),
        accessProfile: null,
      }),
    };
    return prisma;
  }

  it('recrutamento: aprovador recebe requisições SUBMITTED, exceto as próprias e as com aprovador nomeado alheio', async () => {
    const prisma = withGrants(makePrisma(), ['recruit:requisition:approve']);
    const base = { priority: 'NORMAL', orgNodeId: 'n1', openingsRequested: 1, createdAt: new Date(), updatedAt: new Date() };
    prisma.recruitRequisition = {
      findMany: vi.fn().mockImplementation(({ where }: any) => {
        if (where.status === 'SUBMITTED') {
          return Promise.resolve([
            { id: 'r1', code: 'RQ-1', requesterId: 'u2', approvals: [{ order: 1, role: 'RH', decision: null, approverId: null }], ...base },
            { id: 'r2', code: 'RQ-2', requesterId: 'u1', approvals: [{ order: 1, role: 'RH', decision: null, approverId: null }], ...base },
            { id: 'r3', code: 'RQ-3', requesterId: 'u3', approvals: [{ order: 1, role: 'RH', decision: null, approverId: 'u9' }], ...base },
          ]);
        }
        return Promise.resolve([]);
      }),
    };
    const svc = new WorkItemAggregationService(prisma, new WorkItemPriorityService());

    const count = await svc.rebuildForUser(me);

    expect(count).toBe(1);
    const arg = prisma.workItemIndex.upsert.mock.calls[0][0];
    expect(arg.where.dedupeKey).toBe('RECRUIT_REQUISITION:r1:RECRUIT_REQUISITION_APPROVAL:u1');
    expect(arg.create.requiresDecision).toBe(true);
    expect(arg.create.availableActions[0].href).toBe('/servico-pessoal/recrutamento');
  });

  it('recrutamento: proposta fora da faixa pendente vira item de decisão com link da vaga', async () => {
    const prisma = withGrants(makePrisma(), ['recruit:offer:approve']);
    prisma.recruitRequisition = { findMany: vi.fn().mockResolvedValue([]) };
    prisma.recruitOffer = {
      findMany: vi.fn().mockResolvedValue([{
        id: 'o1', revision: 2, salaryAmountCents: 700000, expiresAt: null, createdAt: new Date(), updatedAt: new Date(),
        application: { id: 'app1', candidate: { name: 'Maria' }, posting: { id: 'p1', title: 'Analista' } },
      }]),
    };
    const svc = new WorkItemAggregationService(prisma, new WorkItemPriorityService());

    const count = await svc.rebuildForUser(me);

    expect(count).toBe(1);
    const arg = prisma.workItemIndex.upsert.mock.calls[0][0];
    expect(arg.where.dedupeKey).toBe('RECRUIT_OFFER:o1:RECRUIT_OFFER_APPROVAL:u1');
    expect(arg.create.title).toContain('Maria');
    expect(arg.create.availableActions[0].href).toBe('/servico-pessoal/recrutamento/vagas/p1');
  });

  it('C&S: movimentação REQUESTED vira item para o aprovador, mas não para o próprio solicitante', async () => {
    const prisma = withGrants(makePrisma(), ['compensation:movements:approve']);
    prisma.compensationMovementRequest = {
      findMany: vi.fn().mockResolvedValue([
        { id: 'm1', protocol: 'MOV-1', type: 'MERITO', reason: 'Mérito anual', monthlyImpact: 350.5, requesterId: 'u2', effectiveAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
        { id: 'm2', protocol: 'MOV-2', type: 'PROMOCAO', reason: 'Promoção', monthlyImpact: null, requesterId: 'u1', effectiveAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ]),
    };
    const svc = new WorkItemAggregationService(prisma, new WorkItemPriorityService());

    const count = await svc.rebuildForUser(me);

    expect(count).toBe(1);
    const arg = prisma.workItemIndex.upsert.mock.calls[0][0];
    expect(arg.where.dedupeKey).toBe('COMPENSATION_MOVEMENT:m1:COMPENSATION_MOVEMENT_APPROVAL:u1');
    expect(arg.create.availableActions[0].href).toBe('/cargos-salarios/aprovacoes');
    expect(arg.create.requesterUserId).toBe('u2');
  });

  it('sem permissões de recrutamento/C&S: coletores novos não disparam consultas de fila', async () => {
    const prisma = withGrants(makePrisma(), []);
    prisma.recruitOffer = { findMany: vi.fn() };
    prisma.compensationMovementRequest = { findMany: vi.fn() };
    prisma.recruitRequisition = { findMany: vi.fn().mockResolvedValue([]) };
    const svc = new WorkItemAggregationService(prisma, new WorkItemPriorityService());

    const count = await svc.rebuildForUser(me);

    expect(count).toBe(0);
    expect(prisma.recruitOffer.findMany).not.toHaveBeenCalled();
    expect(prisma.compensationMovementRequest.findMany).not.toHaveBeenCalled();
  });
});
