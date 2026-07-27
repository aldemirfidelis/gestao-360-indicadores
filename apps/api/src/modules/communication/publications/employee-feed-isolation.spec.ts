import { describe, expect, it, vi } from 'vitest';
import { EmployeeFeedService } from './employee-feed.service';

const me = { sub: 'user-1', companyId: 'empresa-1', name: 'Fulano', role: 'VIEWER' } as any;

function serviceWith(overrides: Record<string, any> = {}) {
  const prisma = {
    communicationPost: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    communicationCategory: { findMany: vi.fn().mockResolvedValue([]) },
    communicationPostRead: { upsert: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
    ...overrides,
  };
  return { service: new EmployeeFeedService(prisma as any), prisma };
}

describe('EmployeeFeedService — isolamento e visibilidade', () => {
  it('só lista publicações da empresa do usuário e destinadas a ele', async () => {
    const { service, prisma } = serviceWith();
    await service.feed(me, {});

    const where = prisma.communicationPost.findMany.mock.calls[0]![0].where;
    expect(where.companyId).toBe('empresa-1');
    expect(where.deletedAt).toBeNull();
    expect(where.showInEmployeeFeed).toBe(true);
    expect(where.recipients).toEqual({ some: { userId: 'user-1' } });
  });

  it('rascunhos e arquivadas nunca aparecem no feed', async () => {
    const { service, prisma } = serviceWith();
    await service.feed(me, {});

    const status = prisma.communicationPost.findMany.mock.calls[0]![0].where.status;
    expect(status).toBe('PUBLISHED');
  });

  it('o histórico inclui encerradas, mas continua sem rascunho/arquivada', async () => {
    const { service, prisma } = serviceWith();
    await service.feed(me, { filter: 'historico' });

    const status = prisma.communicationPost.findMany.mock.calls[0]![0].where.status;
    expect(status).toEqual({ in: ['PUBLISHED', 'EXPIRED'] });
  });

  it('o filtro de pendências busca quem ainda não confirmou', async () => {
    const { service, prisma } = serviceWith();
    await service.feed(me, { filter: 'confirmacao' });

    const where = prisma.communicationPost.findMany.mock.calls[0]![0].where;
    expect(where.requiresReadConfirmation).toBe(true);
    expect(where.reads).toEqual({ none: { userId: 'user-1', confirmedAt: { not: null } } });
  });

  it('abrir publicação de outra empresa/não destinada resulta em não encontrada', async () => {
    const { service } = serviceWith();
    await expect(service.open(me, 'post-de-outra-empresa', {})).rejects.toThrow(/não encontrado/i);
  });

  it('não permite confirmar duas vezes o mesmo comunicado', async () => {
    const { service } = serviceWith({
      communicationPost: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({ id: 'post-1', requiresReadConfirmation: true }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      communicationPostRead: {
        upsert: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ confirmedAt: new Date() }),
      },
    });

    await expect(service.confirm(me, 'post-1', {})).rejects.toThrow(/já confirmou/i);
  });

  it('não aceita ciência em comunicado que não exige confirmação', async () => {
    const { service } = serviceWith({
      communicationPost: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({ id: 'post-1', requiresReadConfirmation: false }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(service.confirm(me, 'post-1', {})).rejects.toThrow(/não exige confirmação/i);
  });
});
