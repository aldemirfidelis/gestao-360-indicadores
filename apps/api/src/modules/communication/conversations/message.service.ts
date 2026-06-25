import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationKind, Prisma, PresenceStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { swallow } from '../../../common/logging/swallow';
import { ConversationService } from './conversation.service';
import { PresenceService } from '../presence/presence.service';
import { RealtimeEmitter } from '../realtime.emitter';
import { NotificationsService } from '../../notifications/notifications.service';
import { WS } from '../communication.events';

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, name: true, avatarUrl: true } },
  reactions: { select: { userId: true, emoji: true } },
  attachments: { select: { id: true, fileName: true, fileUrl: true, mimeType: true, sizeBytes: true } },
  replyTo: {
    select: { id: true, body: true, deletedAt: true, sender: { select: { id: true, name: true } } },
  },
} satisfies Prisma.MessageInclude;

type MessagePayload = Prisma.MessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

interface MessageAttachmentInput {
  fileName: string;
  mimeType?: string | null;
  sizeBytes: number;
  dataBase64: string;
}

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
]);

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationService,
    private readonly presence: PresenceService,
    private readonly emitter: RealtimeEmitter,
    private readonly notifications: NotificationsService,
  ) {}

  /** Histórico paginado por cursor (carregamento progressivo para cima). */
  async list(conversationId: string, meId: string, cursor?: string, limit = 30) {
    await this.conversations.assertMember(conversationId, meId);
    const take = Math.min(Math.max(limit, 1), 60);
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      include: MESSAGE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      items: page.reverse().map(serialize),
      nextCursor: hasMore ? page[0]?.id ?? null : null,
    };
  }

  async send(
    conversationId: string,
    meId: string,
    body = '',
    replyToId?: string,
    attachments: MessageAttachmentInput[] = [],
  ) {
    await this.conversations.assertMember(conversationId, meId);
    const text = body.trim();
    if (!text && attachments.length === 0) throw new BadRequestException('Informe uma mensagem ou anexe um arquivo.');
    if (attachments.length > MAX_ATTACHMENTS) throw new BadRequestException(`Envie no mÃ¡ximo ${MAX_ATTACHMENTS} anexos por mensagem.`);
    if (replyToId) {
      const reply = await this.prisma.message.findFirst({ where: { id: replyToId, conversationId }, select: { id: true } });
      if (!reply) throw new BadRequestException('Mensagem respondida nÃ£o pertence a esta conversa.');
    }
    const preparedAttachments = attachments.map((attachment) => this.prepareAttachment(attachment, meId));
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: meId,
        body: text,
        replyToId: replyToId || null,
        attachments: preparedAttachments.length ? { create: preparedAttachments } : undefined,
      },
      include: MESSAGE_INCLUDE,
    });
    const previewSource = text || `Anexo: ${preparedAttachments[0]?.fileName ?? 'arquivo'}`;
    const preview = previewSource.length > 120 ? `${previewSource.slice(0, 117)}...` : previewSource;
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt, lastMessagePreview: preview },
    });
    await this.fanOut(conversationId, message);
    return serialize(message);
  }

  async getAttachment(attachmentId: string, meId: string) {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      include: { message: { select: { conversationId: true, deletedAt: true } } },
    });
    if (!attachment || attachment.deletedAt || attachment.message.deletedAt) throw new NotFoundException('Anexo nÃ£o encontrado.');
    await this.conversations.assertMember(attachment.message.conversationId, meId);
    return {
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      fileUrl: attachment.fileUrl,
      dataBase64: attachment.data ? Buffer.from(attachment.data).toString('base64') : null,
    };
  }

  async edit(messageId: string, meId: string, body: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Mensagem não encontrada.');
    if (msg.senderId !== meId) throw new ForbiddenException('Você só pode editar suas mensagens.');
    if (msg.deletedAt) throw new ForbiddenException('Mensagem excluída não pode ser editada.');
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { body, editedAt: new Date() },
      include: MESSAGE_INCLUDE,
    });
    await this.broadcast(updated.conversationId, WS.MESSAGE_UPDATED, {
      conversationId: updated.conversationId,
      message: serialize(updated),
    });
    return serialize(updated);
  }

  async remove(messageId: string, meId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Mensagem não encontrada.');
    if (msg.senderId !== meId) throw new ForbiddenException('Você só pode excluir suas mensagens.');
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), body: '' },
      include: MESSAGE_INCLUDE,
    });
    await this.broadcast(updated.conversationId, WS.MESSAGE_DELETED, {
      conversationId: updated.conversationId,
      messageId,
    });
    return { ok: true };
  }

  async react(messageId: string, meId: string, emoji: string, add: boolean) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true },
    });
    if (!msg) throw new NotFoundException('Mensagem não encontrada.');
    await this.conversations.assertMember(msg.conversationId, meId);
    if (add) {
      await this.prisma.messageReaction.upsert({
        where: { messageId_userId_emoji: { messageId, userId: meId, emoji } },
        create: { messageId, userId: meId, emoji },
        update: {},
      });
    } else {
      await this.prisma.messageReaction
        .delete({ where: { messageId_userId_emoji: { messageId, userId: meId, emoji } } })
        .catch(swallow(undefined, 'message.removeReaction', 'debug'));
    }
    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      select: { userId: true, emoji: true },
    });
    await this.broadcast(msg.conversationId, WS.REACTION_UPDATED, {
      conversationId: msg.conversationId,
      messageId,
      reactions,
    });
    return { reactions };
  }

  /** Entrega a mensagem nova e gera notificações para participantes offline. */
  private async fanOut(conversationId: string, message: MessagePayload) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true, muted: true, user: { select: { companyId: true } } },
    });
    const payload = { conversationId, message: serialize(message) };
    this.emitter.toUsers(
      participants.map((p) => p.userId),
      WS.MESSAGE_CREATED,
      payload,
    );

    for (const p of participants) {
      if (p.userId === message.senderId || p.muted) continue;
      const online = this.presence.status(p.userId) !== PresenceStatus.OFFLINE;
      if (online) continue; // online recebe via evento ao vivo
      try {
        const notif = await this.notifications.create(
          p.user.companyId,
          p.userId,
          NotificationKind.MESSAGE,
          `Nova mensagem de ${message.sender.name}`,
          message.body.slice(0, 140),
          `/comunicacao?c=${conversationId}`,
        );
        this.emitter.toUser(p.userId, WS.NOTIFICATION_CREATED, notif);
      } catch {
        /* notificação é best-effort */
      }
    }
  }

  private async broadcast(conversationId: string, event: string, payload: unknown) {
    const ids = await this.conversations.participantIds(conversationId);
    this.emitter.toUsers(ids, event, payload);
  }

  private prepareAttachment(input: MessageAttachmentInput, meId: string): Prisma.MessageAttachmentCreateWithoutMessageInput {
    const fileName = input.fileName.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 180);
    if (!fileName) throw new BadRequestException('Nome do anexo invÃ¡lido.');
    if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException('Cada anexo deve ter atÃ© 5 MB.');
    }
    const mimeType = input.mimeType?.trim().toLowerCase() || null;
    if (mimeType && !mimeType.startsWith('image/') && !ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException('Tipo de arquivo nÃ£o permitido para anexo.');
    }
    let data: Buffer;
    try {
      data = Buffer.from(input.dataBase64, 'base64');
    } catch {
      throw new BadRequestException('Arquivo anexado invÃ¡lido.');
    }
    if (!data.length || data.length > MAX_ATTACHMENT_BYTES || data.length !== input.sizeBytes) {
      throw new BadRequestException('Tamanho do anexo invÃ¡lido.');
    }
    return {
      uploadedBy: { connect: { id: meId } },
      fileName,
      fileUrl: null,
      mimeType,
      sizeBytes: data.length,
      data,
    };
  }
}

function serialize(m: MessagePayload) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    sender: m.sender,
    body: m.deletedAt ? '' : m.body,
    deleted: !!m.deletedAt,
    editedAt: m.editedAt,
    createdAt: m.createdAt,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          body: m.replyTo.deletedAt ? '' : m.replyTo.body,
          deleted: !!m.replyTo.deletedAt,
          senderName: m.replyTo.sender?.name ?? '',
        }
      : null,
    attachments: m.attachments,
    reactions: m.reactions,
  };
}
