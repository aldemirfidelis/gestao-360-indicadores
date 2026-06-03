import type { PresenceStatus } from './events';

export interface ConversationSummary {
  id: string;
  kind: 'DIRECT' | 'GROUP';
  title: string;
  avatarUrl: string | null;
  counterpart: { id: string; name: string; avatarUrl: string | null; jobTitle: string | null } | null;
  participants: { userId: string; name: string; avatarUrl: string | null }[];
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unread: number;
  muted: boolean;
  pinned: boolean;
  presence: PresenceStatus;
}

export interface MessageReaction {
  userId: string;
  emoji: string;
}

export interface MessageAttachment {
  id: string;
  fileName: string;
  fileUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
}

export interface MessageAttachmentDownload extends MessageAttachment {
  dataBase64: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender: { id: string; name: string; avatarUrl: string | null };
  body: string;
  deleted: boolean;
  editedAt: string | null;
  createdAt: string;
  replyTo: { id: string; body: string; deleted: boolean; senderName: string } | null;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  // estados locais (otimistas)
  pending?: boolean;
  failed?: boolean;
  tempId?: string;
}

export interface MessagesPage {
  items: ChatMessage[];
  nextCursor: string | null;
}
