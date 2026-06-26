import { describe, expect, it, vi } from 'vitest';
import { TrafficLight } from '@prisma/client';
import { MonthlyResultsService } from './monthly-results.service';

// Regression guard: a meeting that belongs to another company must never be
// reachable by id alone. assertMeeting() scopes by companyId, so a cross-company
// id resolves to null and the mutation must be refused before any write.
const me: any = { sub: 'user-1', companyId: 'company-1', email: 'user@company.test', role: 'USER' };
const stub: any = {};

describe('Monthly results tenant isolation', () => {
  it('does not delete a meeting from another company', async () => {
    const prisma: any = {
      monthlyMeeting: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    };
    const service = new MonthlyResultsService(prisma, stub, stub, stub, stub);

    await expect(service.deleteMeeting(me, 'meeting-from-other-company')).rejects.toThrow();

    expect(prisma.monthlyMeeting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'meeting-from-other-company', companyId: 'company-1' }),
      }),
    );
    expect(prisma.monthlyMeeting.update).not.toHaveBeenCalled();
  });
});

describe('Monthly results live indicator light', () => {
  it('uses the latest indicator result for meeting card lights', () => {
    const service = new MonthlyResultsService({} as any, stub, stub, stub, stub);
    const snap = (service as any).computeSnapshot(
      {
        targets: [
          { periodRef: '2026-05', target: 100, lowerBound: null, upperBound: null },
          { periodRef: '2026-06', target: 200, lowerBound: null, upperBound: null },
        ],
        results: [
          { periodRef: '2026-05', periodDate: new Date('2026-05-01T00:00:00.000Z'), value: 95, light: TrafficLight.YELLOW, attainment: 0.95, deviationPct: -5 },
          { periodRef: '2026-06', periodDate: new Date('2026-06-01T00:00:00.000Z'), value: 120, light: TrafficLight.RED, attainment: 0.6, deviationPct: -40 },
        ],
      },
      '2026-05',
      'latest',
    );

    expect(snap).toMatchObject({
      target: 200,
      current: 120,
      light: TrafficLight.RED,
      attainment: 0.6,
    });
  });

  it('overlays stale meeting snapshots with the latest indicator light', () => {
    const service = new MonthlyResultsService({} as any, stub, stub, stub, stub);
    const shaped = (service as any).shapeSnapshot(
      {
        id: 'snapshot-1',
        indicatorId: 'indicator-1',
        indicator: { name: 'Indicador', code: null, unit: 'PERCENT', unitLabel: '%', source: null, responsibleUserId: 'user-1' },
        target: 100,
        lowerBound: null,
        upperBound: null,
        current: 95,
        accumulated: 95,
        attainment: 0.95,
        deviationPct: -5,
        light: TrafficLight.YELLOW,
        trend: null,
        managerComment: null,
        trendNote: null,
        executiveStatus: null,
        showInPresentation: true,
        isCritical: false,
        financialImpact: null,
        deviationId: null,
        actionPlanId: null,
      },
      new Map(),
      new Map(),
      {
        target: 200,
        lowerBound: null,
        upperBound: null,
        current: 120,
        accumulated: 120,
        attainment: 0.6,
        deviationPct: -40,
        light: TrafficLight.RED,
        trend: 'Alta',
      },
    );

    expect(shaped.light).toBe(TrafficLight.RED);
    expect(shaped.current).toBe(120);
    expect(shaped.target).toBe(200);
    expect(shaped.isCritical).toBe(true);
  });
});
