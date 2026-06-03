'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { useRealtime } from '@/components/communication/realtime-provider';
import { WS } from '@/lib/communication/events';
import type { ChatMessage } from '@/lib/communication/types';

interface CommunicationCtx {
  setActiveConversation: (id: string | null) => void;
  typingNames: (conversationId: string) => string[];
  lastReadOf: (conversationId: string, userId: string) => string | undefined;
}

const Ctx = createContext<CommunicationCtx | null>(null);

type TypingMap = Record<string, Record<string, { name: string; at: number }>>;
type ReceiptMap = Record<string, Record<string, string>>;

export function CommunicationProvider({ children }: { children: ReactNode }) {
  const { socket } = useRealtime();
  const { user } = useAuth();
  const qc = useQueryClient();
  const activeConv = useRef<string | null>(null);
  const [typing, setTyping] = useState<TypingMap>({});
  const [receipts, setReceipts] = useState<ReceiptMap>({});
  const invalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleConversationsRefresh = useCallback(() => {
    if (invalidateTimer.current) return;
    invalidateTimer.current = setTimeout(() => {
      invalidateTimer.current = null;
      qc.invalidateQueries({ queryKey: ['conversations'] });
    }, 350);
  }, [qc]);

  useEffect(() => {
    if (!socket || !user?.id) return;

    const onMessage = (p: { conversationId: string; message: ChatMessage }) => {
      scheduleConversationsRefresh();
      const fromMe = p.message.senderId === user.id;
      if (!fromMe && activeConv.current !== p.conversationId) {
        toast.message(p.message.sender.name, {
          description: p.message.body?.slice(0, 120) || 'Enviou uma mensagem',
        });
      }
    };
    const onDeletedOrUpdated = () => scheduleConversationsRefresh();
    const onReceipt = (p: { conversationId: string; userId: string; readAt: string }) => {
      setReceipts((prev) => ({
        ...prev,
        [p.conversationId]: { ...(prev[p.conversationId] ?? {}), [p.userId]: p.readAt },
      }));
    };
    const onTyping = (p: { conversationId: string; userId: string; name: string; typing: boolean }) => {
      if (p.userId === user.id) return;
      setTyping((prev) => {
        const conv = { ...(prev[p.conversationId] ?? {}) };
        if (p.typing) conv[p.userId] = { name: p.name, at: Date.now() };
        else delete conv[p.userId];
        return { ...prev, [p.conversationId]: conv };
      });
    };
    const onNotification = () => qc.invalidateQueries({ queryKey: ['notifications'] });

    socket.on(WS.MESSAGE_CREATED, onMessage);
    socket.on(WS.MESSAGE_UPDATED, onDeletedOrUpdated);
    socket.on(WS.MESSAGE_DELETED, onDeletedOrUpdated);
    socket.on(WS.MESSAGE_READ_RECEIPT, onReceipt);
    socket.on(WS.MESSAGE_TYPING, onTyping);
    socket.on(WS.NOTIFICATION_CREATED, onNotification);

    return () => {
      socket.off(WS.MESSAGE_CREATED, onMessage);
      socket.off(WS.MESSAGE_UPDATED, onDeletedOrUpdated);
      socket.off(WS.MESSAGE_DELETED, onDeletedOrUpdated);
      socket.off(WS.MESSAGE_READ_RECEIPT, onReceipt);
      socket.off(WS.MESSAGE_TYPING, onTyping);
      socket.off(WS.NOTIFICATION_CREATED, onNotification);
    };
  }, [socket, user?.id, qc, scheduleConversationsRefresh]);

  // Expira indicadores de digitação obsoletos.
  useEffect(() => {
    const t = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        let changed = false;
        const next: TypingMap = {};
        for (const [cid, users] of Object.entries(prev)) {
          const kept: Record<string, { name: string; at: number }> = {};
          for (const [uid, v] of Object.entries(users)) {
            if (now - v.at < 6000) kept[uid] = v;
            else changed = true;
          }
          next[cid] = kept;
        }
        return changed ? next : prev;
      });
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const setActiveConversation = useCallback((id: string | null) => {
    activeConv.current = id;
  }, []);

  const typingNames = useCallback(
    (conversationId: string) => Object.values(typing[conversationId] ?? {}).map((v) => v.name),
    [typing],
  );

  const lastReadOf = useCallback(
    (conversationId: string, userId: string) => receipts[conversationId]?.[userId],
    [receipts],
  );

  return (
    <Ctx.Provider value={{ setActiveConversation, typingNames, lastReadOf }}>{children}</Ctx.Provider>
  );
}

export function useCommunication(): CommunicationCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      setActiveConversation: () => undefined,
      typingNames: () => [],
      lastReadOf: () => undefined,
    };
  }
  return ctx;
}
