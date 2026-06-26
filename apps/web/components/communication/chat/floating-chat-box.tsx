'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Minus, Send, X, Smile, Paperclip } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCommunication } from '@/components/communication/communication-provider';
import { useRealtime } from '@/components/communication/realtime-provider';
import { UserAvatar } from '@/components/communication/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { WS } from '@/lib/communication/events';
import { messageTime } from '@/lib/communication/format';
import type { ChatMessage, MessagesPage } from '@/lib/communication/types';

interface FloatingChatBoxProps {
  conversationId: string;
  title: string;
  avatarUrl: string | null;
  minimized: boolean;
  presence: any;
  hasUnread: boolean;
  onClose: () => void;
  onMinimize: () => void;
}

type MessagesInfiniteData = {
  pages: MessagesPage[];
  pageParams: any[];
};

export function FloatingChatBox({
  conversationId,
  title,
  avatarUrl,
  minimized,
  presence,
  hasUnread,
  onClose,
  onMinimize,
}: FloatingChatBoxProps) {
  const { user } = useAuth();
  const { socket, presenceOf } = useRealtime();
  const { typingNames, markAsReadLocal } = useCommunication();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Status dinâmico de presença do outro usuário
  const userPresence = presenceOf(conversationId, presence || 'OFFLINE');

  // Buscar mensagens da conversa
  const messages = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) =>
      api<MessagesPage>(
        `/communication/conversations/${conversationId}/messages?limit=30${pageParam ? `&cursor=${pageParam}` : ''}`
      ),
    enabled: !minimized,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const allMessages = useMemo(() => {
    const pages = messages.data?.pages ?? [];
    const rows = pages.flatMap((p) => p.items) ?? [];
    const map = new Map<string, ChatMessage>();
    for (const row of rows) map.set(row.id, row);
    return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages.data]);

  // Marcar como lida e join na conversa
  useEffect(() => {
    if (minimized) return;
    markAsReadLocal(conversationId);
    if (!socket) return;

    socket.emit(WS.CONVERSATION_JOIN, { conversationId });
    socket.emit(WS.MESSAGE_READ, { conversationId });
    void qc.invalidateQueries({ queryKey: ['conversations'] });

    return () => {
      socket.emit(WS.MESSAGE_TYPING_STOP, { conversationId });
      socket.emit(WS.CONVERSATION_LEAVE, { conversationId });
    };
  }, [conversationId, socket, minimized, markAsReadLocal, qc]);

  // Rolar para baixo ao receber mensagens
  const lastMsgId = allMessages[allMessages.length - 1]?.id;
  useEffect(() => {
    if (!minimized) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [lastMsgId, minimized]);

  const send = useMutation({
    mutationFn: () =>
      api<ChatMessage>(`/communication/conversations/${conversationId}/messages`, {
        method: 'POST',
        json: { body: draft.trim() },
      }),
    onSuccess: (message) => {
      setDraft('');
      socket?.emit(WS.MESSAGE_TYPING_STOP, { conversationId });
      qc.setQueryData<MessagesInfiniteData>(['messages', conversationId], (old) => {
        if (!old?.pages?.length) return old;
        const exists = old.pages.some((page) => page.items.some((item) => item.id === message.id));
        if (exists) return old;
        const pages = [...old.pages];
        pages[0] = { ...pages[0], items: [...pages[0].items, message] };
        return { ...old, pages };
      });
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || send.isPending) return;
    send.mutate();
  };

  const handleKeyDown = () => {
    if (!socket) return;
    socket.emit(WS.MESSAGE_TYPING_START, { conversationId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit(WS.MESSAGE_TYPING_STOP, { conversationId });
    }, 3000);
  };

  const currentTyping = typingNames(conversationId);

  return (
    <div
      className={cn(
        'flex w-[290px] flex-col rounded-t-lg border border-border shadow-2xl transition-all duration-300 ease-in-out bg-card/95 backdrop-blur-md',
        minimized ? 'h-10' : 'h-[380px]',
        hasUnread && minimized && 'animate-pulse border-blue-500 bg-blue-500/10'
      )}
    >
      {/* Cabeçalho do Chat */}
      <div
        className={cn(
          'flex h-10 cursor-pointer items-center justify-between border-b border-border/60 px-3 py-1.5',
          hasUnread && 'bg-blue-600/15'
        )}
        onClick={onMinimize}
      >
        <div className="flex min-w-0 items-center gap-2">
          <UserAvatar name={title} avatarUrl={avatarUrl} status={userPresence} size="sm" className="h-6 w-6" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-foreground leading-tight">{title}</div>
            {!minimized && (
              <div className="text-[9px] text-muted-foreground leading-none">
                {userPresence === 'ONLINE' ? 'online' : 'offline'}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onMinimize}
            title={minimized ? 'Maximizar' : 'Minimizar'}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:bg-destructive hover:text-white"
            onClick={onClose}
            title="Fechar chat"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Corpo do Chat (histórico de mensagens) */}
      {!minimized && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.isLoading && (
              <div className="py-8 text-center text-xs text-muted-foreground">Carregando mensagens...</div>
            )}
            {allMessages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] break-words rounded-2xl px-3 py-1.5 text-xs shadow-sm',
                      isMe
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-muted text-foreground rounded-bl-none'
                    )}
                  >
                    <div>{msg.body}</div>
                    <div
                      className={cn(
                        'mt-1 text-[8px] text-right leading-none',
                        isMe ? 'text-blue-200' : 'text-muted-foreground'
                      )}
                    >
                      {messageTime(msg.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {/* Indicador de digitação e Formulário */}
          <div className="border-t border-border/60 bg-muted/20 p-2 space-y-1.5">
            {currentTyping.length > 0 && (
              <div className="px-1 text-[9px] text-muted-foreground italic leading-none animate-pulse">
                digitando...
              </div>
            )}
            <form onSubmit={handleSend} className="flex gap-1.5">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enviar mensagem..."
                className="h-8 flex-1 text-xs border-border/80 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-0"
              />
              <Button type="submit" size="icon" className="h-8 w-8 shrink-0 bg-blue-600 text-white hover:bg-blue-700" disabled={!draft.trim() || send.isPending}>
                <Send className="h-3 w-3" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
