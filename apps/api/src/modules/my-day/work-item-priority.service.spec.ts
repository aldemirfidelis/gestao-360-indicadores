import { describe, it, expect } from 'vitest';
import { WorkItemPriorityService } from './work-item-priority.service';

const svc = new WorkItemPriorityService();
const now = new Date('2026-06-09T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe('WorkItemPriorityService', () => {
  it('marca atraso (OVERDUE) e justifica com "atrasado"', () => {
    const r = svc.compute({ itemType: 'TASK', criticality: 'MEDIUM', dueAt: daysAgo(8), now });
    expect(r.overdueDays).toBe(8);
    expect(r.slaStatus).toBe('OVERDUE');
    expect(r.priority).not.toBe('INFO');
    expect(r.priorityReason).toContain('atrasado');
  });

  it('criticidade crítica + muito atrasado => CRITICAL', () => {
    const r = svc.compute({ itemType: 'RISK_CRITICAL', criticality: 'CRITICAL', dueAt: daysAgo(10), now });
    expect(r.priority).toBe('CRITICAL');
    expect(r.priorityScore).toBeGreaterThanOrEqual(80);
  });

  it('sem prazo e baixa criticidade => baixa/informativa, SLA NONE', () => {
    const r = svc.compute({ itemType: 'TASK', criticality: 'LOW', dueAt: null, now });
    expect(['LOW', 'INFO']).toContain(r.priority);
    expect(r.slaStatus).toBe('NONE');
  });

  it('item que aguarda decisão soma peso e justifica', () => {
    const r = svc.compute({ itemType: 'APPROVAL', criticality: 'HIGH', requiresDecision: true, dueAt: null, now });
    expect(r.priorityReason).toContain('decisão');
  });
});
