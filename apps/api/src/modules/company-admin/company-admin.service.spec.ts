import { describe, expect, it, vi } from 'vitest';
import { CompanyAdminService } from './company-admin.service';

const me: any = { sub: 'user-1', companyId: 'company-1', email: 'admin@empresa.test', role: 'ANALYST' };

describe('CompanyAdminService - isolamento e minimizacao de dados', () => {
  it('forca o companyId da sessao na consulta de usuarios', async () => {
    const prisma: any = {
      user: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    };
    const service = new CompanyAdminService(prisma, { record: vi.fn() } as any);

    await service.list(me, 'users', { page: 1, pageSize: 25, search: 'ana' });

    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId: 'company-1', deletedAt: null, serviceAccount: false }),
      select: expect.not.objectContaining({ passwordHash: true }),
    }));
    expect(prisma.user.count).toHaveBeenCalledWith({ where: expect.objectContaining({ companyId: 'company-1' }) });
  });

  it('recusa tabelas ou conjuntos fora do catalogo permitido', async () => {
    const service = new CompanyAdminService({} as any, { record: vi.fn() } as any);
    await expect(service.list(me, 'InboundApiKey', { page: 1, pageSize: 25 })).rejects.toThrow('Conjunto de dados nao permitido');
  });

  it('audita exportacao e nao inclui colunas sensiveis no CSV', async () => {
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const prisma: any = {
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: 'u1', name: 'Ana', email: 'ana@empresa.test' }]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const service = new CompanyAdminService(prisma, audit as any);

    const csv = await service.exportCsv(me, 'users');

    expect(csv).toContain('"Nome"');
    expect(csv).toContain('ana@empresa.test');
    expect(csv).not.toContain('passwordHash');
    expect(audit.record).toHaveBeenCalledWith(me, expect.objectContaining({ action: 'EXPORT', entityId: 'users' }));
  });
});
