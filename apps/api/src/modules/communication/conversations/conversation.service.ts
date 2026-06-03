import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PresenceStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';

/** Chave determinística de uma conversa individual (par ordenado de userIds). */
export function directKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

const PARTICIPANT_USER = {
  select: { id: true, name: true, avatarUrl: true, jobTitle: true },
} satisfies Prisma.UserDefaultArgs;

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
  ) {}

  /** Garante membership; lança ForbiddenException caso contrário. Retorna o participante. */
  async assertMember(conversationId: string, userId: string) {
    const part = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!part || part.leftAt) throw new ForbiddenException('Você não participa desta conversa.');
    return part;
  }

  /**
   * Cria (ou retorna) a conversa individual entre dois usuários — idempotente.
   * O índice único em `dmKey` impede duplicatas mesmo sob concorrência.
   */
  async getOrCreateDirect(meId: string, otherId: string, companyId: string) {
    if (meId === otherId) throw new BadRequestException('Não é possível conversar consigo mesmo.');
    const other = await this.prisma.user.findFirst({
      where: { id: otherId, deletedAt: null, companyId },
      select: { id: true },
    });
    if (!other) throw new NotFoundException('Usuário não encontrado.');

    const dmKey = directKey(meId, otherId);
    const existing = await this.prisma.conversation.findUnique({ where: { dmKey } });
    if (existing) return this.summaryById(existing.id, meId);

    try {
      const created = await this.prisma.conversation.create({
        data: {
          companyId,
          kind: 'DIRECT',
          dmKey,
          createdById: meId,
          participants: {
            create: [
              { userId: meId, role: 'OWNER' },
              { userId: otherId, role: 'MEMBER' },
            ],
          },
        },
      });
      return this.summaryById(created.id, meId);
    } catch (err) {
      // Corrida: outra requisição criou a mesma DM — reaproveita.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const again = await this.prisma.conversation.findUnique({ where: { dmKey } });
        if (again) return this.summaryById(again.id, meId);
      }
      throw err;
    }
  }

  /** Lista as conversas do usuário, ordenadas pela atividade mais recente. */
  async listForUser(meId: string) {
    const convs = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId: meId, leftAt: null } } },
      include: { participants: { include: { user: PARTICIPANT_USER } } },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
      take: 200,
    });

    const summaries = await Promise.all(convs.map((c) => this.decorate(c, meId)));
    return summaries;
  }

  async summaryById(conversationId: string, meId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { include: { user: PARTICIPANT_USER } } },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada.');
    if (!conv.participants.some((p) => p.userId === meId && !p.leftAt)) {
      throw new ForbiddenException('Você não participa desta conversa.');
    }
    return this.decorate(conv, meId);
  }

  async markRead(conversationId: string, meId: string) {
    await this.assertMember(conversationId, meId);
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: meId } },
      data: { lastReadAt: new Date() },
    });
    return { ok: true };
  }

  async setMuted(conversationId: string, meId: string, muted: boolean) {
    await this.assertMember(conversationId, meId);
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: meId } },
      data: { muted },
    });
    return { ok: true, muted };
  }

  async setPinned(conversationId: string, meId: string, pinned: boolean) {
    await this.assertMember(conversationId, meId);
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: meId } },
      data: { pinnedAt: pinned ? new Date() : null },
    });
    return { ok: true, pinned };
  }

  /** userIds de todos os participantes ativos (usado para broadcast/notificações). */
  async participantIds(conversationId: string): Promise<string[]> {
    const parts = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });
    return parts.map((p) => p.userId);
  }

  private async decorate(
    conv: Prisma.ConversationGetPayload<{ include: { participants: { include: { user: typeof PARTICIPANT_USER } } } }>,
    meId: string,
  ) {
    const mine = conv.participants.find((p) => p.userId === meId);
    const others = conv.participants.filter((p) => p.userId !== meId);
    const counterpart = conv.kind === 'DIRECT' ? others[0]?.user : null;

    const unread = await this.prisma.message.count({
      where: {
        conversationId: conv.id,
        senderId: { not: meId },
        deletedAt: null,
        ...(mine?.lastReadAt ? { createdAt: { gt: mine.lastReadAt } } : {}),
      },
    });

    const liveStatus = counterpart ? this.presence.status(counterpart.id) : PresenceStatus.OFFLINE;

    return {
      id: conv.id,
      kind: conv.kind,
      title: conv.kind === 'DIRECT' ? counterpart?.name ?? 'Conversa' : conv.title ?? 'Grupo',
      avatarUrl: counterpart?.avatarUrl ?? null,
      counterpart: counterpart
        ? { id: counterpart.id, name: counterpart.name, avatarUrl: counterpart.avatarUrl, jobTitle: counterpart.jobTitle }
        : null,
      participants: conv.participants.map((p) => ({
        userId: p.userId,
        name: p.user.name,
        avatarUrl: p.user.avatarUrl,
      })),
      lastMessageAt: conv.lastMessageAt,
      lastMessagePreview: conv.lastMessagePreview,
      unread,
      muted: mine?.muted ?? false,
      pinned: !!mine?.pinnedAt,
      presence: liveStatus,
    };
  }
}
