import { describe, expect, it } from 'vitest';
import {
  approvalOutcome,
  canTransition,
  checkApprovalSegregation,
  evaluateVacancyGate,
  nextPendingApproval,
  reservesHeadcount,
} from './recruit-requisition.logic';

describe('recruit-requisition.logic', () => {
  it('máquina de estados: transições válidas e inválidas', () => {
    expect(canTransition('DRAFT', 'SUBMITTED')).toBe(true);
    expect(canTransition('SUBMITTED', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'SENT_TO_RECRUITMENT')).toBe(true);
    expect(canTransition('DRAFT', 'APPROVED')).toBe(false); // não pula aprovação
    expect(canTransition('REJECTED', 'SUBMITTED')).toBe(false);
    expect(reservesHeadcount('APPROVED')).toBe(true);
    expect(reservesHeadcount('CANCELLED')).toBe(false);
  });

  it('trava FLEXÍVEL: posição/quadro/orçamento ausentes viram aviso + exceção (não bloqueiam)', () => {
    const r = evaluateVacancyGate({
      hasApprovedPosition: false,
      headcountAvailable: 0,
      requestedOpenings: 1,
      budgetAvailableCents: 0,
      requiredMonthlyCents: 300000,
      fullyApproved: true,
      hasDescription: true,
      hasRecruiter: true,
      hasPipeline: true,
    }, 'FLEXIBLE');
    expect(r.ready).toBe(true); // regras de processo ok
    expect(r.exceptionsRequired).toEqual(expect.arrayContaining(['POSITION', 'HEADCOUNT', 'BUDGET']));
    expect(r.blocks).toHaveLength(0);
  });

  it('trava STRICT: posição/quadro/orçamento ausentes bloqueiam', () => {
    const r = evaluateVacancyGate({
      hasApprovedPosition: false, headcountAvailable: 0, requestedOpenings: 1,
      budgetAvailableCents: 0, requiredMonthlyCents: 300000,
      fullyApproved: true, hasDescription: true, hasRecruiter: true, hasPipeline: true,
    }, 'STRICT');
    expect(r.ready).toBe(false);
    expect(r.blocks.length).toBeGreaterThanOrEqual(3);
  });

  it('regras de processo sempre bloqueiam (mesmo no flexível)', () => {
    const r = evaluateVacancyGate({
      hasApprovedPosition: true, headcountAvailable: 5, requestedOpenings: 1,
      budgetAvailableCents: 1000000, requiredMonthlyCents: 300000,
      fullyApproved: false, hasDescription: false, hasRecruiter: false, hasPipeline: false,
    }, 'FLEXIBLE');
    expect(r.ready).toBe(false);
    expect(r.blocks).toEqual(expect.arrayContaining([
      expect.stringContaining('aprovações'),
      expect.stringContaining('Descrição'),
      expect.stringContaining('recrutador'),
      expect.stringContaining('Pipeline'),
    ]));
  });

  it('quadro suficiente e orçamento ok: sem exceções', () => {
    const r = evaluateVacancyGate({
      hasApprovedPosition: true, headcountAvailable: 3, requestedOpenings: 2,
      budgetAvailableCents: 500000, requiredMonthlyCents: 300000,
      fullyApproved: true, hasDescription: true, hasRecruiter: true, hasPipeline: true,
    }, 'FLEXIBLE');
    expect(r.ready).toBe(true);
    expect(r.exceptionsRequired).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });

  it('workflow: próximo passo pendente e consolidação', () => {
    const steps = [
      { order: 1, role: 'GESTOR', decision: 'APPROVED' as const },
      { order: 2, role: 'RH', decision: null },
      { order: 3, role: 'DIRECTOR', decision: null },
    ];
    expect(nextPendingApproval(steps)?.role).toBe('RH');
    expect(approvalOutcome(steps)).toBe('PENDING');
    expect(approvalOutcome([{ order: 1, role: 'GESTOR', decision: 'APPROVED' }])).toBe('APPROVED');
    expect(approvalOutcome([{ order: 1, role: 'GESTOR', decision: 'REJECTED' }])).toBe('REJECTED');
  });

  it('segregação: solicitante não aprova a própria requisição', () => {
    expect(checkApprovalSegregation('u1', 'u1')).toContain('Segregação');
    expect(checkApprovalSegregation('u1', 'u2')).toBeNull();
  });
});
