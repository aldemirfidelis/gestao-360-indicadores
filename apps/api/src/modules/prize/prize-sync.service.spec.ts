import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrizeSyncService } from './prize-sync.service';

/**
 * Sync automatico Lancamentos -> Premio: indicadores vinculados recebem o
 * realizado de IndicatorResult (mesmo periodRef da competencia); nao re-grava
 * valores iguais; reporta vinculados sem lancamento e nao-vinculados.
 */
function makeEnv() {
  const competence = { id: 'C1', companyId: 'CO1', programId: 'P1', label: '2026-06', year: 2026, month: 6, status: 'FILLING' };
  const prizeIndicators = [
    { id: 'pi1', code: 'IND-001', name: 'Moagem', platformIndicatorId: 'plat1' },
    { id: 'pi2', code: 'IND-002', name: 'ART', platformIndicatorId: 'plat2' },
    { id: 'pi3', code: 'IND-003', name: 'Comportamental', platformIndicatorId: null },
    { id: 'pi4', code: 'IND-004', name: 'Sem lançamento', platformIndicatorId: 'plat4' },
  ];
  const platformResults = [
    { indicatorId: 'plat1', value: 95.5 },
    { indicatorId: 'plat2', value: 88 },
    // plat4 sem resultado no periodo
  ];
  const existingActuals = [
    { indicatorId: 'pi2', realized: 88 }, // ja sincronizado com o mesmo valor
  ];

  const prisma: any = {
    prizeCompetence: { findFirst: vi.fn(async () => competence) },
    prizeIndicator: { findMany: vi.fn(async () => prizeIndicators) },
    indicatorResult: {
      findMany: vi.fn(async ({ where }: any) => {
        expect(where.periodRef).toBe('2026-06');
        return platformResults.filter((r) => where.indicatorId.in.includes(r.indicatorId));
      }),
    },
    prizeActualResult: { findMany: vi.fn(async () => existingActuals) },
  };
  const actuals: any = { launch: vi.fn(async () => ({})) };
  const competences: any = { checklist: vi.fn(async () => ({ blockingPending: 0, warnings: 0, items: [] })) };
  const calc: any = { run: vi.fn(async () => ({ version: 2, totalEmployees: 10 })) };
  const audit: any = { log: vi.fn(async () => undefined) };
  const me: any = { companyId: 'CO1', sub: 'U1', email: 'u@x' };
  const service = new PrizeSyncService(prisma, actuals, competences, calc, audit);
  return { service, prisma, actuals, competences, calc, me };
}

describe('PrizeSyncService — sincronização automática do realizado', () => {
  let env: ReturnType<typeof makeEnv>;
  beforeEach(() => { env = makeEnv(); });

  it('grava só o que mudou, usando o periodRef da competência', async () => {
    const s = await env.service.syncActuals(env.me, 'C1');
    expect(s.periodRef).toBe('2026-06');
    expect(s.linked).toBe(3); // pi1, pi2, pi4
    expect(s.synced).toBe(1); // pi1 (95.5 novo)
    expect(s.unchanged).toBe(1); // pi2 (88 igual)
    expect(s.missingResult.map((m) => m.code)).toEqual(['IND-004']);
    expect(s.unlinked.map((u) => u.code)).toEqual(['IND-003']);
    expect(env.actuals.launch).toHaveBeenCalledTimes(1);
    expect(env.actuals.launch).toHaveBeenCalledWith(env.me, 'C1', expect.objectContaining({ indicatorId: 'pi1', realized: 95.5 }));
  });

  it('autopilot: sync + checklist + apuração quando sem pendências impeditivas', async () => {
    const r = await env.service.autopilot(env.me, 'C1', { runCalc: true });
    expect(r.sync.synced).toBe(1);
    expect(r.calcRun).toBeTruthy();
    expect(r.calcSkipped).toBeNull();
    expect(env.calc.run).toHaveBeenCalledTimes(1);
  });

  it('autopilot: NÃO apura com pendência impeditiva (explica o porquê)', async () => {
    env.competences.checklist = vi.fn(async () => ({ blockingPending: 2, warnings: 0, items: [] }));
    const r = await env.service.autopilot(env.me, 'C1', { runCalc: true });
    expect(r.calcRun).toBeNull();
    expect(r.calcSkipped).toContain('2 pendência');
    expect(env.calc.run).not.toHaveBeenCalled();
  });
});
