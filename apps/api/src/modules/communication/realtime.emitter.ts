import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import { WS, accountRoom, companyRoom, conversationRoom, userRoom } from './communication.events';

/**
 * Detentor único do servidor Socket.IO (ligado pelo gateway em afterInit).
 * Centraliza o broadcast para que serviços REST e o gateway emitam eventos
 * de tempo real pelos mesmos canais (salas de conversa e salas pessoais).
 */
@Injectable()
export class RealtimeEmitter {
  private server: Server | null = null;

  bindServer(server: Server) {
    this.server = server;
  }

  get ready() {
    return this.server !== null;
  }

  emitAll(event: string, payload: unknown) {
    this.server?.emit(event, payload);
  }

  toCompany(companyId: string, event: string, payload: unknown) {
    this.server?.to(companyRoom(companyId)).emit(event, payload);
  }

  toConversation(conversationId: string, event: string, payload: unknown) {
    this.server?.to(conversationRoom(conversationId)).emit(event, payload);
  }

  toUser(companyId: string, userId: string, event: string, payload: unknown) {
    this.server?.to(userRoom(companyId, userId)).emit(event, payload);
  }

  toUsers(companyId: string, userIds: string[], event: string, payload: unknown) {
    for (const id of userIds) this.toUser(companyId, id, event, payload);
  }

  changeCompanyContext(userId: string, companyId: string) {
    const room = accountRoom(userId);
    this.server?.to(room).emit(WS.COMPANY_CONTEXT_CHANGED, { companyId });
    this.server?.in(room).disconnectSockets(true);
  }
}
