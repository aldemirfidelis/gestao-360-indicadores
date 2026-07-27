import { UserRoleEnum } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CommunicationGateway } from './communication.gateway';
import { accountRoom, companyRoom, userRoom } from './communication.events';

describe('CommunicationGateway tenant isolation', () => {
  it('recomputes the effective company from the database instead of trusting a stale JWT', async () => {
    const jwt: any = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: 'admin',
        email: 'admin@platform.test',
        name: 'Admin',
        role: UserRoleEnum.SUPER_ADMIN,
        companyId: 'company-from-old-token',
      }),
    };
    const prisma: any = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          active: true,
          status: 'ACTIVE',
          deletedAt: null,
          role: UserRoleEnum.SUPER_ADMIN,
          companyId: 'home-company',
          activeCompanyId: 'active-company',
        }),
      },
    };
    const presence: any = { connect: vi.fn(), onlineCount: vi.fn().mockReturnValue(1) };
    const gateway = new CommunicationGateway(jwt, prisma, presence, {} as any, {} as any);
    const client: any = {
      id: 'socket-1',
      data: {},
      handshake: { auth: { token: 'jwt' }, headers: {} },
      join: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    await gateway.handleConnection(client);

    expect(client.data.user.companyId).toBe('active-company');
    expect(client.join).toHaveBeenCalledWith(accountRoom('admin'));
    expect(client.join).toHaveBeenCalledWith(companyRoom('active-company'));
    expect(client.join).toHaveBeenCalledWith(userRoom('active-company', 'admin'));
    expect(presence.connect).toHaveBeenCalledWith('admin', 'socket-1', 'active-company');
  });

  it('does not emit typing events without tenant-scoped membership', async () => {
    const conversations: any = { assertMember: vi.fn().mockRejectedValue(new Error('cross-tenant')) };
    const gateway = new CommunicationGateway({} as any, {} as any, {} as any, {} as any, conversations);
    const target = { emit: vi.fn() };
    const client: any = {
      data: { user: { sub: 'admin', name: 'Admin', companyId: 'company-b' } },
      to: vi.fn().mockReturnValue(target),
    };

    await gateway.onTypingStart(client, { conversationId: 'conversation-a' });

    expect(conversations.assertMember).toHaveBeenCalledWith('conversation-a', 'admin', 'company-b');
    expect(client.to).not.toHaveBeenCalled();
    expect(target.emit).not.toHaveBeenCalled();
  });

  it('generates distinct personal rooms for the same admin in different companies', () => {
    expect(userRoom('company-a', 'admin')).not.toBe(userRoom('company-b', 'admin'));
  });
});
