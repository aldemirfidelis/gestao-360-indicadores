import { describe, expect, it, vi } from 'vitest';
import { FormIndicatorService } from './form-indicator.service';
import type { AuthPayload } from '../auth/auth.types';

const me = { sub: 'user-1', companyId: 'empresa-1' } as AuthPayload;

function make(opts: { indicator?: any; submissions?: Array<{ id: string; score: number | null }> } = {}) {
  const prisma: any = {
    indicator: { findFirst: vi.fn().mockResolvedValue(opts.indicator ?? null) },
    formSubmission: { findMany: vi.fn().mockResolvedValue(opts.submissions ?? []) },
  };
  const results = { upsert: vi.fn().mockResolvedValue({ result: { id: 'r1' } }) } as any;
  return { service: new FormIndicatorService(prisma, results), prisma, results };
}

const inspecao = {
  id: 'sub-1',
  templateId: 'issma',
  orgNodeId: 'setor-colheita',
  completedAt: new Date('2026-07-26T20:59:34.000Z'),
  score: 90,
};

describe('FormIndicatorService.syncFromSubmission', () => {
  it('lança a média das 10 frentes no indicador do par (setor, formulário)', async () => {
    const { service, results } = make({
      indicator: { id: 'ind-1', name: 'CONF. ISSMA Colheita Mecanizada' },
      submissions: [100, 100, 90, 80, 100, 95, 70, 100, 85, 90].map((score, i) => ({ id: `s${i}`, score })),
    });

    const out = await service.syncFromSubmission(me, inspecao);

    expect(results.upsert).toHaveBeenCalledWith(
      me,
      expect.objectContaining({ indicatorId: 'ind-1', periodRef: '2026-07', value: 91 }),
    );
    expect(out).toMatchObject({ value: 91, count: 10, competence: '2026-07' });
  });

  it('procura o indicador pelo setor E pelo formulário — setor sozinho é ambíguo', async () => {
    const { service, prisma } = make({ indicator: { id: 'ind-1', name: 'x' }, submissions: [{ id: 's1', score: 100 }] });
    await service.syncFromSubmission(me, inspecao);

    expect(prisma.indicator.findFirst.mock.calls[0][0].where).toMatchObject({
      companyId: 'empresa-1',
      ownerNodeId: 'setor-colheita',
      formTemplateId: 'issma',
    });
  });

  it('sem indicador vinculado, não lança nada (e não quebra)', async () => {
    const { service, results } = make({ indicator: null });
    await expect(service.syncFromSubmission(me, inspecao)).resolves.toBeNull();
    expect(results.upsert).not.toHaveBeenCalled();
  });

  it('recalcula o mês inteiro, não soma incremental', async () => {
    const { service, prisma } = make({ indicator: { id: 'ind-1', name: 'x' }, submissions: [{ id: 's1', score: 100 }] });
    await service.syncFromSubmission(me, inspecao);

    const where = prisma.formSubmission.findMany.mock.calls[0][0].where;
    expect(where.templateId).toBe('issma');
    expect(where.orgNodeId).toBe('setor-colheita');
    expect(where.completedAt.gte.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(where.completedAt.lte.toISOString()).toBe('2026-07-31T23:59:59.999Z');
    expect(where.score).toEqual({ not: null });
  });

  it('inspeção sem setor não vai para indicador nenhum', async () => {
    const { service, prisma } = make({ indicator: { id: 'ind-1', name: 'x' } });
    await expect(service.syncFromSubmission(me, { ...inspecao, orgNodeId: null })).resolves.toBeNull();
    expect(prisma.indicator.findFirst).not.toHaveBeenCalled();
  });

  it('mês sem inspeção pontuável não grava valor', async () => {
    const { service, results } = make({ indicator: { id: 'ind-1', name: 'x' }, submissions: [] });
    await expect(service.syncFromSubmission(me, inspecao)).resolves.toBeNull();
    expect(results.upsert).not.toHaveBeenCalled();
  });

  it('a nota explica de onde veio o número', async () => {
    const { service, results } = make({
      indicator: { id: 'ind-1', name: 'x' },
      submissions: [{ id: 's1', score: 100 }, { id: 's2', score: 80 }],
    });
    await service.syncFromSubmission(me, inspecao);
    expect(results.upsert.mock.calls[0][1].note).toContain('2 inspeção(ões)');
  });
});
