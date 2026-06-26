'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { UserAvatar } from '@/components/communication/user-avatar';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { shortTime } from '@/lib/communication/format';
import type { ConversationSummary } from '@/lib/communication/types';
import { useCommunication } from '@/components/communication/communication-provider';

export function MessagesButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { openChat } = useCommunication();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const conversations = useQuery<ConversationSummary[]>({
    queryKey: ['conversations'],
    queryFn: () => api('/communication/conversations'),
    refetchInterval: 30_000,
  });

  const items = useMemo(() => conversations.data ?? [], [conversations.data]);
  const unread = useMemo(() => items.reduce((sum, c) => sum + c.unread, 0), [items]);
  const latest = items.slice(0, 6);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setOpen((v) => !v)}
        aria-label="Mensagens"
        title="Mensagens"
      >
        <MessageSquare className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-status-red px-1 text-[9px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-lg sm:w-96">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Mensagens
            </span>
            <Link href="/comunicacao" onClick={() => setOpen(false)} className="text-xs text-foreground underline-offset-2 hover:underline">
              Abrir central
            </Link>
          </div>
          <div className="max-h-[390px] overflow-y-auto p-1">
            {conversations.isLoading && <div className="px-3 py-6 text-center text-sm text-muted-foreground">Carregando...</div>}
            {!conversations.isLoading && latest.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhuma conversa ainda.
              </div>
            )}
            {latest.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  openChat(c.id, { name: c.title, avatarUrl: c.avatarUrl, presence: c.presence });
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-muted transition-colors"
              >
                <UserAvatar name={c.title} avatarUrl={c.avatarUrl} status={c.presence} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.title}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{shortTime(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">{c.lastMessagePreview ?? 'Conversa iniciada'}</span>
                    {c.unread > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-semibold text-white">
                        {c.unread > 99 ? '99+' : c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
