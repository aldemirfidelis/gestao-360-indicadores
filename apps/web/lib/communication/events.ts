// Espelho dos eventos WebSocket do backend
// (apps/api/src/modules/communication/communication.events.ts).
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

export type PresenceStatus = 'ONLINE' | 'AWAY' | 'BUSY' | 'DND' | 'OFFLINE';

export const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  ONLINE: 'Conectado',
  AWAY: 'Ausente',
  BUSY: 'Ocupado',
  DND: 'Não perturbe',
  OFFLINE: 'Sem conexão',
};

// Classes Tailwind para o "dot" de presença.
export const PRESENCE_DOT: Record<PresenceStatus, string> = {
  ONLINE: 'bg-emerald-500',
  AWAY: 'bg-amber-500',
  BUSY: 'bg-rose-500',
  DND: 'bg-rose-600',
  OFFLINE: 'bg-muted-foreground/40',
};

export const MANUAL_STATUSES: PresenceStatus[] = ['ONLINE', 'AWAY', 'BUSY', 'DND'];
