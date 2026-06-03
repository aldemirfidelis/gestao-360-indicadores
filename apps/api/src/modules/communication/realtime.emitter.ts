import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import { conversationRoom, userRoom } from './communication.events';

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

  toConversation(conversationId: string, event: string, payload: unknown) {
    this.server?.to(conversationRoom(conversationId)).emit(event, payload);
  }

  toUser(userId: string, event: string, payload: unknown) {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }

  toUsers(userIds: string[], event: string, payload: unknown) {
    for (const id of userIds) this.toUser(id, event, payload);
  }
}
