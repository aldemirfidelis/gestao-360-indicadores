import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PrizeEligibleService } from './prize-eligible.service';

describe('integração com módulo suspenso', () => {
  it('não consulta colaboradores nem substitui elegíveis quando Serviço Pessoal está suspenso', async () => {
    const prisma = { orgEmployee: { findMany: vi.fn() }, prizeCompetence: { findFirst: vi.fn() } };
    const service = new PrizeEligibleService(prisma as never, {} as never, {} as never);
    await expect(service.importFromInternal({ companyId: 'company' } as never, 'competence')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.orgEmployee.findMany).not.toHaveBeenCalled();
    expect(prisma.prizeCompetence.findFirst).not.toHaveBeenCalled();
  });
});
