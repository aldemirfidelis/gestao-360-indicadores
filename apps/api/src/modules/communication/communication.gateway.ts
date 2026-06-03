import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PresenceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PresenceService } from './presence/presence.service';
import { ConversationService } from './conversations/conversation.service';
import { RealtimeEmitter } from './realtime.emitter';
import { AuthPayload } from '../auth/auth.types';
import { WS, conversationRoom, userRoom } from './communication.events';

const corsOrigin = process.env.API_CORS_ORIGIN ?? 'http://localhost:3000';
const isWildcard = corsOrigin === '*';
const wsCors = {
  origin: isWildcard ? true : corsOrigin.split(',').map((s) => s.trim()),
  credentials: !isWildcard,
};

const MANUAL = new Set<PresenceStatus>([
  PresenceStatus.ONLINE,
  PresenceStatus.AWAY,
  PresenceStatus.BUSY,
  PresenceStatus.DND,
  PresenceStatus.OFFLINE,
]);

type SocketUser = AuthPayload;

/**
 * Gateway de tempo real da Comunicação. Autentica o handshake por JWT (mesmo
 * segredo do REST) e revalida o usuário no banco (ativo/status) antes de aceitar.
 * Fase 1: presença. Fase 2 adiciona eventos de conversa/mensagem.
 */
@WebSocketGateway({ cors: wsCors })
export class CommunicationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(CommunicationGateway.name);
  private sweepTimer: NodeJS.Timeout | null = null;

  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
    private readonly emitter: RealtimeEmitter,
    private readonly conversations: ConversationService,
  ) {}

  afterInit(server: Server) {
    this.emitter.bindServer(server);
    // Varredura de ociosidade (marca AWAY quem ficou inativo).
    this.sweepTimer = setInterval(() => {
      this.presence.sweep().catch((err) => this.logger.warn(`sweep: ${err.message}`));
    }, 30_000);
    this.logger.log('CommunicationGateway inicializado (presença em tempo real).');
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  async handleConnection(client: Socket) {
    const user = await this.authenticate(client);
    if (!user) {
      client.emit(WS.ERROR, { message: 'Não autenticado.' });
      client.disconnect(true);
      return;
    }
    client.data.user = user;
    client.join(userRoom(user.sub));
    await this.presence.connect(user.sub, client.id);
    // Estado inicial para o cliente recém-conectado.
    client.emit(WS.PRESENCE_ONLINE_COUNT, { count: this.presence.onlineCount() });
  }

  async handleDisconnect(client: Socket) {
    const user = client.data.user as SocketUser | undefined;
    if (user) await this.presence.disconnect(user.sub, client.id);
  }

  @SubscribeMessage(WS.PRESENCE_HEARTBEAT)
  async onHeartbeat(client: Socket, payload?: { active?: boolean }) {
    const user = client.data.user as SocketUser | undefined;
    if (!user) return;
    await this.presence.heartbeat(user.sub, payload?.active ?? true);
  }

  @SubscribeMessage(WS.PRESENCE_SET_STATUS)
  async onSetStatus(client: Socket, payload?: { status?: PresenceStatus }) {
    const user = client.data.user as SocketUser | undefined;
    if (!user || !payload?.status || !MANUAL.has(payload.status)) return;
    await this.presence.setManualStatus(
      user.sub,
      payload.status === PresenceStatus.OFFLINE ? null : payload.status,
    );
  }

  // ---- Conversas / mensagens (entrega das mensagens é feita pelo RealtimeEmitter
  //      a partir dos serviços REST; aqui tratamos salas, digitação e leitura). ----

  @SubscribeMessage(WS.CONVERSATION_JOIN)
  async onJoin(client: Socket, payload?: { conversationId?: string }) {
    const user = client.data.user as SocketUser | undefined;
    if (!user || !payload?.conversationId) return;
    try {
      await this.conversations.assertMember(payload.conversationId, user.sub);
      client.join(conversationRoom(payload.conversationId));
    } catch {
      /* não-membro: ignora silenciosamente */
    }
  }

  @SubscribeMessage(WS.CONVERSATION_LEAVE)
  onLeave(client: Socket, payload?: { conversationId?: string }) {
    if (payload?.conversationId) client.leave(conversationRoom(payload.conversationId));
  }

  @SubscribeMessage(WS.MESSAGE_TYPING_START)
  onTypingStart(client: Socket, payload?: { conversationId?: string }) {
    this.emitTyping(client, payload?.conversationId, true);
  }

  @SubscribeMessage(WS.MESSAGE_TYPING_STOP)
  onTypingStop(client: Socket, payload?: { conversationId?: string }) {
    this.emitTyping(client, payload?.conversationId, false);
  }

  @SubscribeMessage(WS.MESSAGE_READ)
  async onRead(client: Socket, payload?: { conversationId?: string }) {
    const user = client.data.user as SocketUser | undefined;
    if (!user || !payload?.conversationId) return;
    try {
      await this.conversations.markRead(payload.conversationId, user.sub);
      const ids = await this.conversations.participantIds(payload.conversationId);
      this.emitter.toUsers(ids, WS.MESSAGE_READ_RECEIPT, {
        conversationId: payload.conversationId,
        userId: user.sub,
        readAt: new Date().toISOString(),
      });
    } catch {
      /* ignora */
    }
  }

  private emitTyping(client: Socket, conversationId: string | undefined, typing: boolean) {
    const user = client.data.user as SocketUser | undefined;
    if (!user || !conversationId) return;
    // Broadcast para a sala da conversa, exceto o próprio remetente.
    client.to(conversationRoom(conversationId)).emit(WS.MESSAGE_TYPING, {
      conversationId,
      userId: user.sub,
      name: user.name,
      typing,
    });
  }

  /** Verifica o JWT do handshake e revalida o usuário (ativo/status) no banco. */
  private async authenticate(client: Socket): Promise<SocketUser | null> {
    const raw =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!raw) return null;
    try {
      const payload = await this.jwt.verifyAsync<AuthPayload>(raw);
      const dbUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { active: true, status: true, deletedAt: true },
      });
      if (!dbUser || !dbUser.active || dbUser.status !== 'ACTIVE' || dbUser.deletedAt) return null;
      return payload;
    } catch {
      return null;
    }
  }
}
