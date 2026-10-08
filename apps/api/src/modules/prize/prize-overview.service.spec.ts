import { describe, expect, it, vi } from 'vitest';
import { PrizeOverviewService } from './prize-overview.service';

describe('painel de prêmio preenchido por dados reais', () => {
  it('conta fases implementadas no tenant e no programa selecionado, sem placeholders', async () => {
    const count = () => ({ count: vi.fn().mockResolvedValue(3) });
    const prisma = { prizeProgram: count(), prizeCompetence: { ...count(), findMany: vi.fn().mockResolvedValue([{ id: 'demo-competence' }]) }, prizeAnnexVersion: count(), prizeIndicator: count(), prizeEmployeeSnapshot: count(), prizeCalculationRun: count(), prizePayrollBatch: count(), prizePayslip: count() };
    const service = new PrizeOverviewService(prisma as never, { list: vi.fn().mockResolvedValue([]) } as never);
    const result = await service.overview('demo-company', { programId: 'demo-program' });
    expect(result.cards.calculationsProcessed).toBe(3);
    expect(result.cards.payrollBatches).toBe(3);
    expect(result.cards.payslipsPublished).toBe(3);
    expect(result.cards.eligibleEmployees).toBe(3);
    expect(prisma.prizeCalculationRun.count).toHaveBeenCalledWith({ where: { companyId: 'demo-company', competenceId: { in: ['demo-competence'] }, status: 'SUCCESS' } });
    expect(prisma.prizeCompetence.findMany).toHaveBeenCalledWith({ where: { companyId: 'demo-company', programId: 'demo-program' }, select: { id: true } });
  });
});
