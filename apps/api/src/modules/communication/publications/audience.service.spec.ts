import { describe, expect, it, vi } from 'vitest';
import { CommunicationAudienceService } from './audience.service';

function service(prisma: any = {}) {
  return new CommunicationAudienceService(prisma as any);
}

describe('CommunicationAudienceService.normalize', () => {
  it('descarta regras sem referência (exceto "todos")', () => {
    const result = service().normalize([
      { kind: 'ORG_NODE', refId: '' },
      { kind: 'USER', refId: null },
      { kind: 'JOB', refId: 'job-1' },
    ] as any);
    expect(result).toEqual([{ kind: 'JOB', refId: 'job-1' }]);
  });

  it('remove duplicidades da mesma referência', () => {
    const result = service().normalize([
      { kind: 'ORG_NODE', refId: 'node-1' },
      { kind: 'ORG_NODE', refId: 'node-1' },
      { kind: 'ORG_NODE', refId: 'node-2' },
    ] as any);
    expect(result).toHaveLength(2);
  });

  it('"todos" absorve qualquer outra regra', () => {
    const result = service().normalize([
      { kind: 'ORG_NODE', refId: 'node-1' },
      { kind: 'ALL', refId: null },
      { kind: 'USER', refId: 'user-1' },
    ] as any);
    expect(result).toEqual([{ kind: 'ALL', refId: null }]);
  });

  it('ignora tipos desconhecidos vindos do cliente', () => {
    const result = service().normalize([{ kind: 'EVERYONE_HACK', refId: 'x' }] as any);
    expect(result).toEqual([]);
  });
});

describe('CommunicationAudienceService.resolveUserIds', () => {
  it('sem regra nenhuma, não alcança ninguém', async () => {
    const findMany = vi.fn();
    const result = await service({ user: { findMany } }).resolveUserIds('empresa-1', []);
    expect(result).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('"todos" busca apenas usuários ativos da empresa informada', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    const result = await service({ user: { findMany } }).resolveUserIds('empresa-1', [{ kind: 'ALL' } as any]);

    expect(result).toEqual(['u1', 'u2']);
    expect(findMany).toHaveBeenCalledWith({
      where: { companyId: 'empresa-1', deletedAt: null, active: true },
      select: { id: true },
    });
  });

  it('um nó da estrutura alcança também os descendentes', async () => {
    const prisma = {
      orgNode: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'diretoria', parentId: null },
          { id: 'setor-a', parentId: 'diretoria' },
          { id: 'equipe-a1', parentId: 'setor-a' },
          { id: 'outra-area', parentId: null },
        ]),
      },
      user: { findMany: vi.fn().mockResolvedValue([{ id: 'u1' }]) },
    };

    await service(prisma).resolveUserIds('empresa-1', [{ kind: 'ORG_NODE', refId: 'diretoria' } as any]);

    const call = prisma.user.findMany.mock.calls[0]![0];
    expect(call.where.defaultNodeId.in.sort()).toEqual(['diretoria', 'equipe-a1', 'setor-a']);
    expect(call.where.companyId).toBe('empresa-1');
  });

  it('descarta usuário informado diretamente que não pertence à empresa', async () => {
    const prisma = {
      user: { findMany: vi.fn().mockResolvedValue([{ id: 'da-empresa' }]) },
    };
    const result = await service(prisma).resolveUserIds('empresa-1', [
      { kind: 'USER', refId: 'da-empresa' } as any,
      { kind: 'USER', refId: 'de-outra-empresa' } as any,
    ]);
    expect(result).toEqual(['da-empresa']);
  });
});

describe('CommunicationAudienceService.describeMany', () => {
  it('resolve os nomes de todas as publicações em uma única consulta por tipo', async () => {
    const prisma = {
      orgNode: { findMany: vi.fn().mockResolvedValue([{ id: 'n1', name: 'Produção' }, { id: 'n2', name: 'Logística' }]) },
      orgJob: { findMany: vi.fn().mockResolvedValue([{ id: 'j1', name: 'Operador' }]) },
    };

    const labels = await service(prisma).describeMany('empresa-1', [
      { id: 'post-a', rules: [{ kind: 'ALL', refId: null } as any] },
      { id: 'post-b', rules: [{ kind: 'ORG_NODE', refId: 'n1' } as any] },
      { id: 'post-c', rules: [{ kind: 'ORG_NODE', refId: 'n1' }, { kind: 'ORG_NODE', refId: 'n2' }] as any },
      { id: 'post-d', rules: [{ kind: 'JOB', refId: 'j1' } as any] },
      { id: 'post-e', rules: [] },
    ]);

    expect(prisma.orgNode.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.orgJob.findMany).toHaveBeenCalledTimes(1);
    expect(labels.get('post-a')).toBe('Todos os colaboradores');
    expect(labels.get('post-b')).toBe('Produção');
    expect(labels.get('post-c')).toBe('2 áreas');
    expect(labels.get('post-d')).toBe('Operador');
    expect(labels.get('post-e')).toBe('Sem público definido');
  });
});
