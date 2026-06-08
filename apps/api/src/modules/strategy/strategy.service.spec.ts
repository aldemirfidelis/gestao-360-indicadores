import { describe, expect, it, vi } from 'vitest';
import { ActionStatus, TrafficLight } from '@prisma/client';
import { StrategyService } from './strategy.service';

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

describe('StrategyService — mapa executivo enriquecido', () => {
  it('getMap: agrega ações abertas/atrasadas e projetos por objetivo', async () => {
    const prisma = {
      strategicMap: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'map-1',
          companyId: 'companyA',
          perspectives: [],
          versions: [],
          objectives: [
            {
              id: 'obj-1',
              responsibleUser: null,
              ownerNode: null,
              orgNodeLinks: [],
              indicatorLinks: [],
              indicators: [
                {
                  id: 'ind-1',
                  companyId: 'companyA',
                  results: [{ light: TrafficLight.RED, attainment: 0.4, value: 40, periodRef: '2026-06' }],
                  targets: [{ target: 100, periodRef: '2026-06' }],
                },
              ],
              outRelations: [],
              inRelations: [],
            },
          ],
        }),
      },
      actionPlan: {
        groupBy: vi.fn().mockResolvedValue([{ indicatorId: 'ind-1', _count: { _all: 3 } }]),
        findMany: vi.fn().mockResolvedValue([
          { id: 'a1', indicatorId: 'ind-1', title: 'Atrasada', status: ActionStatus.IN_PROGRESS, dueDate: daysFromNow(-2) },
          { id: 'a2', indicatorId: 'ind-1', title: 'Aberta', status: ActionStatus.WAITING_VALIDATION, dueDate: daysFromNow(3) },
          { id: 'a3', indicatorId: 'ind-1', title: 'Finalizada', status: ActionStatus.DONE, dueDate: daysFromNow(-5) },
        ]),
      },
      treatmentCase: {
        groupBy: vi.fn().mockResolvedValue([{ indicatorId: 'ind-1', _count: { _all: 1 } }]),
      },
      deviation: {
        groupBy: vi.fn().mockResolvedValue([{ indicatorId: 'ind-1', _count: { _all: 2 } }]),
      },
      project: {
        groupBy: vi.fn().mockResolvedValue([{ indicatorId: 'ind-1', _count: { _all: 4 } }]),
      },
    } as any;

    const service = new StrategyService(prisma);
    const result = await service.getMap('companyA', 'map-1');
    const objective = result.objectives[0] as any;

    expect(prisma.project.groupBy.mock.calls[0][0].where.companyId).toBe('companyA');
    expect(prisma.actionPlan.groupBy.mock.calls[0][0].where.companyId).toBe('companyA');
    expect(prisma.actionPlan.findMany.mock.calls[0][0].where.companyId).toBe('companyA');
    expect(prisma.treatmentCase.groupBy.mock.calls[0][0].where.companyId).toBe('companyA');
    expect(prisma.deviation.groupBy.mock.calls[0][0].where.companyId).toBe('companyA');
    expect(objective.actionCount).toBe(3);
    expect(objective.openActionCount).toBe(2);
    expect(objective.lateActionCount).toBe(1);
    expect(objective.treatmentCount).toBe(1);
    expect(objective.deviationCount).toBe(2);
    expect(objective.projectCount).toBe(4);
    expect(objective.aggregateLight).toBe(TrafficLight.RED);
  });
});
