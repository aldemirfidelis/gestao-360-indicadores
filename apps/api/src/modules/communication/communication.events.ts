/**
 * Catálogo central de eventos WebSocket da Comunicação.
 * Mantido em sincronia com o frontend (apps/web/lib/communication/events.ts)
 * e documentado em docs/websocket-events.md.
 */
export const WS = {
  // cliente -> servidor
  PRESENCE_HEARTBEAT: 'presence:heartbeat',
  PRESENCE_SET_STATUS: 'presence:set-status',
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',
  MESSAGE_SEND: 'message:send',
  MESSAGE_EDIT: 'message:edit',
  MESSAGE_DELETE: 'message:delete',
  MESSAGE_READ: 'message:read',
  MESSAGE_TYPING_START: 'message:typing-start',
  MESSAGE_TYPING_STOP: 'message:typing-stop',
  REACTION_ADD: 'reaction:add',
  REACTION_REMOVE: 'reaction:remove',

  // servidor -> cliente
  PRESENCE_UPDATED: 'presence:updated',
  PRESENCE_ONLINE_COUNT: 'presence:online-count',
  CONVERSATION_CREATED: 'conversation:created',
  MESSAGE_CREATED: 'message:created',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGE_READ_RECEIPT: 'message:read',
  MESSAGE_TYPING: 'message:typing',
  REACTION_UPDATED: 'reaction:updated',
  NOTIFICATION_CREATED: 'notification:created',
  ERROR: 'comm:error',
} as const;

/** Sala de uma conversa (todos os participantes conectados entram nela). */
export const conversationRoom = (conversationId: string) => `conv:${conversationId}`;
/** Sala pessoal do usuário (todas as abas/dispositivos dele). */
export const userRoom = (userId: string) => `user:${userId}`;
