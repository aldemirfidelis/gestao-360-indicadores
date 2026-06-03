'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  Check,
  Download,
  Edit3,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pin,
  PinOff,
  Reply,
  Send,
  Smile,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { useCommunication } from '@/components/communication/communication-provider';
import { useRealtime } from '@/components/communication/realtime-provider';
import { UserAvatar } from '@/components/communication/user-avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/platform/empty-state';
import { WS } from '@/lib/communication/events';
import { dayKey, dayLabel, messageTime } from '@/lib/communication/format';
import type { ChatMessage, ConversationSummary, MessageAttachment, MessageAttachmentDownload, MessagesPage } from '@/lib/communication/types';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const QUICK_REACTIONS = ['👍', '✅', '👏', '💡'];
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
type MessagesInfiniteData = InfiniteData<MessagesPage, string | undefined>;

interface PendingAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
}

export function ChatPanel({ conversation }: { conversation: ConversationSummary | null }) {
  const { user } = useAuth();
  const { socket } = useRealtime();
  const { typingNames, setActiveConversation } = useCommunication();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const conversationId = conversation?.id ?? null;
  const canSend = !!draft.trim() || pendingAttachments.length > 0;

  const messages = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) =>
      api<MessagesPage>(
        `/communication/conversations/${conversationId}/messages?limit=40${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    enabled: !!conversationId,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const allMessages = useMemo(() => {
    const rows = messages.data?.pages.flatMap((p) => p.items) ?? [];
    const map = new Map<string, ChatMessage>();
    for (const row of rows) map.set(row.id, row);
    return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages.data]);

  useEffect(() => {
    setActiveConversation(conversationId);
    if (!socket || !conversationId) return () => setActiveConversation(null);
    socket.emit(WS.CONVERSATION_JOIN, { conversationId });
    socket.emit(WS.MESSAGE_READ, { conversationId });
    qc.invalidateQueries({ queryKey: ['conversations'] });
    return () => {
      socket.emit(WS.MESSAGE_TYPING_STOP, { conversationId });
      socket.emit(WS.CONVERSATION_LEAVE, { conversationId });
      setActiveConversation(null);
    };
  }, [conversationId, socket, setActiveConversation, qc]);

  useEffect(() => {
    if (!socket || !conversationId) return;
    const upsert = (message: ChatMessage) => {
      qc.setQueryData<MessagesInfiniteData>(['messages', conversationId], (old) => {
        if (!old?.pages?.length) return old;
        const exists = old.pages.some((page: MessagesPage) => page.items.some((item) => item.id === message.id));
        if (exists) {
          return {
            ...old,
            pages: old.pages.map((page: MessagesPage) => ({
              ...page,
              items: page.items.map((item) => (item.id === message.id ? message : item)),
            })),
          };
        }
        const pages = [...old.pages];
        pages[0] = { ...pages[0], items: [...pages[0].items, message] };
        return { ...old, pages };
      });
      if (message.senderId !== user?.id) socket.emit(WS.MESSAGE_READ, { conversationId });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };
    const onCreated = (p: { conversationId: string; message: ChatMessage }) => {
      if (p.conversationId === conversationId) upsert(p.message);
    };
    const onUpdated = (p: { conversationId: string; message: ChatMessage }) => {
      if (p.conversationId === conversationId) upsert(p.message);
    };
    const onDeleted = (p: { conversationId: string; messageId: string }) => {
      if (p.conversationId !== conversationId) return;
      qc.setQueryData<MessagesInfiniteData>(['messages', conversationId], (old) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: old.pages.map((page: MessagesPage) => ({
            ...page,
            items: page.items.map((item) => (item.id === p.messageId ? { ...item, body: '', deleted: true } : item)),
          })),
        };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };
    const onReaction = (p: { conversationId: string; messageId: string; reactions: ChatMessage['reactions'] }) => {
      if (p.conversationId !== conversationId) return;
      qc.setQueryData<MessagesInfiniteData>(['messages', conversationId], (old) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: old.pages.map((page: MessagesPage) => ({
            ...page,
            items: page.items.map((item) => (item.id === p.messageId ? { ...item, reactions: p.reactions } : item)),
          })),
        };
      });
    };
    socket.on(WS.MESSAGE_CREATED, onCreated);
    socket.on(WS.MESSAGE_UPDATED, onUpdated);
    socket.on(WS.MESSAGE_DELETED, onDeleted);
    socket.on(WS.REACTION_UPDATED, onReaction);
    return () => {
      socket.off(WS.MESSAGE_CREATED, onCreated);
      socket.off(WS.MESSAGE_UPDATED, onUpdated);
      socket.off(WS.MESSAGE_DELETED, onDeleted);
      socket.off(WS.REACTION_UPDATED, onReaction);
    };
  }, [socket, conversationId, qc, user?.id]);

  // Rola para o fim quando troca de conversa ou quando chega/envia a mensagem
  // MAIS RECENTE — mas NÃO quando carregamos mensagens antigas (que entram no topo),
  // para preservar a posição de leitura ao clicar em "Carregar anteriores".
  const lastMessageId = allMessages[allMessages.length - 1]?.id;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversationId, lastMessageId]);

  const sendMessage = useMutation({
    mutationFn: () =>
      api<ChatMessage>(`/communication/conversations/${conversationId}/messages`, {
        method: 'POST',
        json: {
          body: draft.trim(),
          replyToId: replyTo?.id,
          attachments: pendingAttachments.map(({ fileName, mimeType, sizeBytes, dataBase64 }) => ({
            fileName,
            mimeType,
            sizeBytes,
            dataBase64,
          })),
        },
      }),
    onSuccess: (message) => {
      setDraft('');
      setPendingAttachments([]);
      setReplyTo(null);
      socket?.emit(WS.MESSAGE_TYPING_STOP, { conversationId });
      qc.setQueryData<MessagesInfiniteData>(['messages', conversationId], (old) => {
        if (!old?.pages?.length) return old;
        if (old.pages.some((page: MessagesPage) => page.items.some((item) => item.id === message.id))) return old;
        const pages = [...old.pages];
        pages[0] = { ...pages[0], items: [...pages[0].items, message] };
        return { ...old, pages };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível enviar a mensagem'),
  });

  const pinConversation = useMutation({
    mutationFn: (pinned: boolean) =>
      api(`/communication/conversations/${conversationId}/pin`, {
        method: 'POST',
        json: { pinned },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel atualizar a fixacao'),
  });

  const muteConversation = useMutation({
    mutationFn: (muted: boolean) =>
      api(`/communication/conversations/${conversationId}/mute`, {
        method: 'POST',
        json: { muted },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel atualizar as notificacoes'),
  });

  const editMessage = useMutation({
    mutationFn: () =>
      api<ChatMessage>(`/communication/messages/${editing?.id}`, {
        method: 'PATCH',
        json: { body: editing?.body.trim() },
      }),
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível editar a mensagem'),
  });

  const deleteMessage = useMutation({
    mutationFn: (id: string) => api(`/communication/messages/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível excluir a mensagem'),
  });

  const react = useMutation({
    mutationFn: ({ id, emoji, add }: { id: string; emoji: string; add: boolean }) =>
      api(`/communication/messages/${id}/reactions${add ? '' : `/${encodeURIComponent(emoji)}`}`, {
        method: add ? 'POST' : 'DELETE',
        ...(add ? { json: { emoji } } : {}),
      }),
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível registrar a reação'),
  });

  const notifyTyping = (value: string) => {
    setDraft(value);
    if (!socket || !conversationId) return;
    socket.emit(WS.MESSAGE_TYPING_START, { conversationId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit(WS.MESSAGE_TYPING_STOP, { conversationId }), 1500);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const slots = MAX_ATTACHMENTS - pendingAttachments.length;
    if (slots <= 0) {
      toast.warning(`Limite de ${MAX_ATTACHMENTS} anexos por mensagem.`);
      return;
    }
    const next: PendingAttachment[] = [];
    for (const file of Array.from(files).slice(0, slots)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.warning(`${file.name} ultrapassa 5 MB.`);
        continue;
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        dataBase64: await fileToBase64(file),
      });
    }
    if (next.length) setPendingAttachments((current) => [...current, ...next].slice(0, MAX_ATTACHMENTS));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!conversation) {
    return (
      <div className="grid h-full place-items-center">
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" />}
          title="Selecione uma conversa"
          description="Escolha uma conversa à esquerda ou inicie uma mensagem pelo diretório de pessoas."
          className="w-full border-0 bg-transparent"
        />
      </div>
    );
  }

  const names = typingNames(conversation.id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <UserAvatar name={conversation.title} avatarUrl={conversation.avatarUrl} status={conversation.presence} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{conversation.title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {names.length > 0 ? `${names.join(', ')} digitando...` : conversation.counterpart?.jobTitle ?? 'Conversa corporativa'}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 w-9 p-0"
          title={conversation.pinned ? 'Desafixar conversa' : 'Fixar conversa'}
          onClick={() => pinConversation.mutate(!conversation.pinned)}
          disabled={pinConversation.isPending}
        >
          {conversation.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 w-9 p-0"
          title={conversation.muted ? 'Ativar notificacoes' : 'Silenciar conversa'}
          onClick={() => muteConversation.mutate(!conversation.muted)}
          disabled={muteConversation.isPending}
        >
          {conversation.muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.hasNextPage && (
          <div className="mb-3 flex justify-center">
            <Button size="sm" variant="outline" onClick={() => messages.fetchNextPage()} disabled={messages.isFetchingNextPage}>
              {messages.isFetchingNextPage ? 'Carregando...' : 'Carregar anteriores'}
            </Button>
          </div>
        )}
        {messages.isLoading && (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando mensagens...
          </div>
        )}
        {!messages.isLoading && allMessages.length === 0 && (
          <EmptyState
            title="Conversa sem mensagens"
            description="Envie a primeira mensagem para iniciar o histórico."
            className="border-0 bg-transparent"
          />
        )}
        <div className="space-y-3">
          {allMessages.map((message, index) => {
            const prev = allMessages[index - 1];
            const showDay = !prev || dayKey(prev.createdAt) !== dayKey(message.createdAt);
            return (
              <div key={message.id}>
                {showDay && (
                  <div className="my-4 flex justify-center">
                    <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">{dayLabel(message.createdAt)}</span>
                  </div>
                )}
                <MessageBubble
                  message={message}
                  mine={message.senderId === user?.id}
                  editing={editing?.id === message.id ? editing.body : null}
                  onEditBody={(body) => setEditing({ id: message.id, body })}
                  onStartEdit={() => setEditing({ id: message.id, body: message.body })}
                  onCancelEdit={() => setEditing(null)}
                  onSaveEdit={() => editMessage.mutate()}
                  onDelete={() => deleteMessage.mutate(message.id)}
                  onReply={() => setReplyTo(message)}
                  onReact={(emoji, add) => react.mutate({ id: message.id, emoji, add })}
                  myUserId={user?.id ?? ''}
                />
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-border/60 p-3">
        {replyTo && (
          <div className="mb-2 flex items-start justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <div className="min-w-0">
              <div className="font-medium">Respondendo {replyTo.sender.name}</div>
              <div className="truncate text-muted-foreground">{replyTo.deleted ? 'Mensagem excluída' : replyTo.body}</div>
            </div>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setReplyTo(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {pendingAttachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingAttachments.map((attachment) => (
              <span key={attachment.id} className="inline-flex max-w-full items-center gap-2 rounded-md border bg-muted/30 px-2 py-1 text-xs">
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-48 truncate">{attachment.fileName}</span>
                <span className="text-muted-foreground">{formatBytes(attachment.sizeBytes)}</span>
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-muted"
                  onClick={() => setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                  aria-label={`Remover ${attachment.fileName}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <Button type="button" variant="outline" className="h-10 w-10 p-0" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={draft}
            onChange={(e) => notifyTyping(e.target.value)}
            rows={2}
            placeholder="Escreva uma mensagem..."
            className="max-h-32 min-h-10 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSend && !sendMessage.isPending) sendMessage.mutate();
              }
            }}
          />
          <Button onClick={() => sendMessage.mutate()} disabled={!canSend || sendMessage.isPending} className="h-10">
            {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  editing,
  onEditBody,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReply,
  onReact,
  myUserId,
}: {
  message: ChatMessage;
  mine: boolean;
  editing: string | null;
  onEditBody: (body: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onReply: () => void;
  onReact: (emoji: string, add: boolean) => void;
  myUserId: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mineReaction = (emoji: string) => message.reactions.some((r) => r.userId === myUserId && r.emoji === emoji);
  const groupedReactions = message.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className={cn('flex gap-2', mine ? 'justify-end' : 'justify-start')}>
      {!mine && <UserAvatar name={message.sender.name} avatarUrl={message.sender.avatarUrl} size="sm" />}
      <div className={cn('max-w-[82%] md:max-w-[72%]', mine && 'items-end')}>
        {!mine && <div className="mb-1 text-xs font-medium text-muted-foreground">{message.sender.name}</div>}
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-sm shadow-sm',
            mine ? 'border-foreground bg-foreground text-background' : 'border-border/60 bg-card',
            message.deleted && 'italic opacity-70',
          )}
        >
          {message.replyTo && (
            <div className={cn('mb-2 rounded border-l-2 px-2 py-1 text-xs', mine ? 'border-background/60 bg-background/10' : 'bg-muted/60')}>
              <div className="font-medium">{message.replyTo.senderName}</div>
              <div className="line-clamp-2 opacity-80">{message.replyTo.deleted ? 'Mensagem excluída' : message.replyTo.body}</div>
            </div>
          )}
          {editing !== null ? (
            <div className="space-y-2">
              <Textarea value={editing} onChange={(e) => onEditBody(e.target.value)} rows={2} className="bg-background text-foreground" />
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" className="h-7" onClick={onCancelEdit}>
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" className="h-7" onClick={onSaveEdit} disabled={!editing.trim()}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              {message.deleted ? (
                <div className="whitespace-pre-wrap break-words">Mensagem excluída</div>
              ) : (
                <>
                  {message.body && <div className="whitespace-pre-wrap break-words">{message.body}</div>}
                  {message.attachments.length > 0 && <AttachmentList attachments={message.attachments} mine={mine} />}
                </>
              )}
            </>
          )}
          <div className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-background/70' : 'text-muted-foreground')}>
            <span>{messageTime(message.createdAt)}</span>
            {message.editedAt && !message.deleted && <span>editada</span>}
          </div>
        </div>
        {!message.deleted && (
          <div className={cn('mt-1 flex flex-wrap items-center gap-1', mine ? 'justify-end' : 'justify-start')}>
            {Object.entries(groupedReactions).map(([emoji, count]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji, !mineReaction(emoji))}
                className={cn(
                  'rounded-full border px-1.5 py-0.5 text-xs',
                  mineReaction(emoji) ? 'border-foreground bg-foreground text-background' : 'border-border bg-background',
                )}
              >
                {emoji} {count}
              </button>
            ))}
            <div className="relative">
              <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => setMenuOpen((v) => !v)}>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
              {menuOpen && (
                <div className={cn('absolute bottom-7 z-20 w-44 rounded-md border bg-card p-1 shadow-lg', mine ? 'right-0' : 'left-0')}>
                  <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => { onReply(); setMenuOpen(false); }}>
                    <Reply className="h-3.5 w-3.5" /> Responder
                  </button>
                  <div className="flex gap-1 px-2 py-1">
                    <Smile className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    {QUICK_REACTIONS.map((emoji) => (
                      <button key={emoji} type="button" className="text-sm" onClick={() => { onReact(emoji, !mineReaction(emoji)); setMenuOpen(false); }}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                  {mine && (
                    <>
                      <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => { onStartEdit(); setMenuOpen(false); }}>
                        <Edit3 className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-status-red hover:bg-status-red/10" onClick={() => { onDelete(); setMenuOpen(false); }}>
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentList({ attachments, mine }: { attachments: MessageAttachment[]; mine: boolean }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const download = async (attachment: MessageAttachment) => {
    setLoadingId(attachment.id);
    try {
      const payload = await api<MessageAttachmentDownload>(`/communication/message-attachments/${attachment.id}`);
      if (payload.dataBase64) {
        downloadBase64(payload.dataBase64, payload.fileName, payload.mimeType ?? 'application/octet-stream');
      } else if (payload.fileUrl) {
        window.open(payload.fileUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Arquivo indisponivel.');
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Nao foi possivel baixar o anexo');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className={cn('mt-2 space-y-1', !attachments.some((attachment) => attachment.fileName) && 'hidden')}>
      {attachments.map((attachment) => {
        const isImage = attachment.mimeType?.startsWith('image/');
        return (
          <button
            key={attachment.id}
            type="button"
            onClick={() => void download(attachment)}
            className={cn(
              'flex w-full max-w-sm items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition hover:opacity-85',
              mine ? 'border-background/25 bg-background/10 text-background' : 'border-border bg-muted/40 text-foreground',
            )}
          >
            {isImage ? <ImageIcon className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{attachment.fileName}</span>
              <span className={cn('block text-[10px]', mine ? 'text-background/70' : 'text-muted-foreground')}>
                {formatBytes(attachment.sizeBytes)}
              </span>
            </span>
            {loadingId === attachment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </button>
        );
      })}
    </div>
  );
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function downloadBase64(base64: string, fileName: string, mimeType: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
