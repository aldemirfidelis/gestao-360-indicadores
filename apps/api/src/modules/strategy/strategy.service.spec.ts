import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
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

    const service = new StrategyService(prisma, { record: vi.fn().mockResolvedValue(undefined) } as any);
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

describe('StrategyService — layout do mapa', () => {
  const me = { sub: 'user-1', companyId: 'companyA' } as any;

  function layoutPrisma(perspectivesFound: number) {
    return {
      strategicMap: { findFirst: vi.fn().mockResolvedValue({ id: 'map-1', companyId: 'companyA' }) },
      strategicObjective: {
        findMany: vi.fn().mockResolvedValue([{ id: 'obj-1', perspectiveId: 'p-1', positionX: 40, positionY: 40, position: 0, width: 260, height: 150 }]),
        update: vi.fn((args) => args),
      },
      perspective: {
        count: vi.fn().mockResolvedValue(perspectivesFound),
        update: vi.fn((args) => args),
      },
      $transaction: vi.fn().mockResolvedValue([]),
    } as any;
  }

  it('saveLayout: grava objetivos e faixas das perspectivas na mesma transação', async () => {
    const prisma = layoutPrisma(1);
    const service = new StrategyService(prisma, { record: vi.fn().mockResolvedValue(undefined) } as any);

    await service.saveLayout(
      me,
      'map-1',
      [{ id: 'obj-1', perspectiveId: 'p-2', positionX: 190, positionY: 280, width: 260, height: 150 }],
      [{ id: 'p-2', positionX: 0, positionY: 240, width: 1200, height: 220 }],
    );

    expect(prisma.perspective.count.mock.calls[0][0].where).toEqual({ mapId: 'map-1', id: { in: ['p-2'] }, deletedAt: null });
    const operations = prisma.$transaction.mock.calls[0][0];
    expect(operations).toHaveLength(2);
    expect(prisma.strategicObjective.update.mock.calls[0][0].data).toMatchObject({ perspectiveId: 'p-2', positionX: 190, positionY: 280 });
    expect(prisma.perspective.update.mock.calls[0][0]).toMatchObject({ where: { id: 'p-2' }, data: { positionY: 240, height: 220, width: 1200 } });
  });

  it('saveLayout: recusa mover objetivo para perspectiva de outro mapa', async () => {
    const prisma = layoutPrisma(1);
    const service = new StrategyService(prisma, { record: vi.fn().mockResolvedValue(undefined) } as any);

    await expect(
      service.saveLayout(
        me,
        'map-1',
        [{ id: 'obj-1', perspectiveId: 'p-outro-mapa', positionX: 190, positionY: 40 }],
        [{ id: 'p-1', positionX: 0, positionY: 0 }],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
