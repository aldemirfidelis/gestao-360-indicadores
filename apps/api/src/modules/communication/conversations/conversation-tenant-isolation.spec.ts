import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PresenceStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ProfileService } from '../profile/profile.service';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';

const COMPANY_A = 'company-a';
const COMPANY_B = 'company-b';
const ADMIN = 'platform-admin';

describe('Communication tenant isolation', () => {
  it('lists conversations only from the effective company', async () => {
    const prisma: any = {
      conversation: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new ConversationService(prisma, { status: vi.fn() } as any);

    await service.listForUser(ADMIN, COMPANY_B);

    expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        companyId: COMPANY_B,
        participants: { some: { userId: ADMIN, leftAt: null } },
      },
    }));
  });

  it('does not accept membership from a conversation in another company', async () => {
    const prisma: any = {
      conversationParticipant: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new ConversationService(prisma, { status: vi.fn() } as any);

    await expect(service.assertMember('conversation-a', ADMIN, COMPANY_B)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.conversationParticipant.findFirst).toHaveBeenCalledWith({
      where: {
        conversationId: 'conversation-a',
        userId: ADMIN,
        leftAt: null,
        conversation: { companyId: COMPANY_B },
      },
    });
  });

  it('scopes direct-conversation reuse to the effective company', async () => {
    const prisma: any = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'user-b' }) },
      conversation: { findFirst: vi.fn().mockResolvedValue({ id: 'conversation-b' }) },
    };
    const service = new ConversationService(prisma, { status: vi.fn() } as any);
    vi.spyOn(service, 'summaryById').mockResolvedValue({ id: 'conversation-b' } as any);

    await service.getOrCreateDirect(ADMIN, 'user-b', COMPANY_B);

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { dmKey: [ADMIN, 'user-b'].sort().join(':'), companyId: COMPANY_B },
    });
    expect(service.summaryById).toHaveBeenCalledWith('conversation-b', ADMIN, COMPANY_B);
  });

  it('does not edit a message resolved outside the effective company', async () => {
    const prisma: any = {
      message: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    };
    const conversations: any = { assertMember: vi.fn(), participantIds: vi.fn() };
    const service = new MessageService(
      prisma,
      conversations,
      { status: vi.fn() } as any,
      { toUsers: vi.fn(), toUser: vi.fn() } as any,
      { create: vi.fn() } as any,
    );

    await expect(service.edit('message-a', ADMIN, COMPANY_B, 'alterada')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.message.findFirst).toHaveBeenCalledWith({
      where: { id: 'message-a', conversation: { companyId: COMPANY_B } },
    });
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it('fans out a new message only through tenant-scoped rooms and notifications', async () => {
    const createdAt = new Date('2026-07-26T12:00:00.000Z');
    const message = {
      id: 'message-b',
      conversationId: 'conversation-b',
      senderId: ADMIN,
      sender: { id: ADMIN, name: 'Admin', avatarUrl: null },
      body: 'Mensagem da empresa B',
      replyToId: null,
      replyTo: null,
      editedAt: null,
      deletedAt: null,
      createdAt,
      attachments: [],
      reactions: [],
    };
    const prisma: any = {
      message: { create: vi.fn().mockResolvedValue(message) },
      conversation: { update: vi.fn().mockResolvedValue({}) },
      conversationParticipant: {
        findMany: vi.fn().mockResolvedValue([
          { userId: ADMIN, muted: false },
          { userId: 'user-b', muted: false },
        ]),
      },
    };
    const conversations: any = { assertMember: vi.fn().mockResolvedValue({}) };
    const emitter: any = { toUsers: vi.fn(), toUser: vi.fn() };
    const notifications: any = { create: vi.fn().mockResolvedValue({ id: 'notification-b' }) };
    const service = new MessageService(
      prisma,
      conversations,
      { status: vi.fn().mockReturnValue(PresenceStatus.OFFLINE) } as any,
      emitter,
      notifications,
    );

    await service.send('conversation-b', ADMIN, COMPANY_B, message.body);

    expect(prisma.conversationParticipant.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { conversationId: 'conversation-b', leftAt: null, conversation: { companyId: COMPANY_B } },
    }));
    expect(emitter.toUsers).toHaveBeenCalledWith(
      COMPANY_B,
      [ADMIN, 'user-b'],
      'message:created',
      expect.any(Object),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      COMPANY_B,
      'user-b',
      expect.anything(),
      expect.any(String),
      expect.any(String),
      '/comunicacao?c=conversation-b',
    );
    expect(emitter.toUser).toHaveBeenCalledWith(
      COMPANY_B,
      'user-b',
      'notification:created',
      { id: 'notification-b' },
    );
  });

  it('never lets SUPER_ADMIN bypass the company filter on corporate profiles', async () => {
    const prisma: any = { user: { findFirst: vi.fn().mockResolvedValue(null) } };
    const service = new ProfileService(prisma, { status: vi.fn() } as any);

    await expect(service.getProfile(COMPANY_B, ADMIN, 'user-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-a', companyId: COMPANY_B, deletedAt: null },
    }));
  });
});
