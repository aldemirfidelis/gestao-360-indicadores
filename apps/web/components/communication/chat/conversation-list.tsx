'use client';

import { useMemo, useState } from 'react';
import { BellOff, Pin, Search } from 'lucide-react';
import { useRealtime } from '@/components/communication/realtime-provider';
import { UserAvatar } from '@/components/communication/user-avatar';
import { Input } from '@/components/ui/input';
import { shortTime } from '@/lib/communication/format';
import type { ConversationSummary } from '@/lib/communication/types';
import { cn } from '@/lib/utils';

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
}: {
  conversations: ConversationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
}) {
  const { presenceOf } = useRealtime();
  const [q, setQ] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = conversations;
    if (unreadOnly) list = list.filter((c) => c.unread > 0);
    if (q.trim()) {
      const term = q.trim().toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(term));
    }
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bt - at;
    });
  }, [conversations, q, unreadOnly]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border/60 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversa..." className="h-9 pl-9" />
        </div>
        <button
          onClick={() => setUnreadOnly((v) => !v)}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs transition-colors',
            unreadOnly ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          Não lidas
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && <div className="p-4 text-center text-sm text-muted-foreground">Carregando conversas...</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma conversa. Inicie uma a partir de <span className="font-medium">Pessoas</span>.
          </div>
        )}
        {filtered.map((c) => {
          const status = c.counterpart ? presenceOf(c.counterpart.id, c.presence) : c.presence;
          const active = c.id === selectedId;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                'flex w-full items-center gap-3 border-b border-border/40 px-3 py-2.5 text-left transition-colors',
                active ? 'bg-foreground/[0.06]' : 'hover:bg-muted/50',
              )}
            >
              <UserAvatar name={c.title} avatarUrl={c.avatarUrl} status={status} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1 truncate font-medium">
                    {c.pinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
                    {c.muted && <BellOff className="h-3 w-3 shrink-0 text-muted-foreground" />}
                    {c.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{shortTime(c.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('truncate text-xs', c.unread > 0 ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                    {c.lastMessagePreview ?? 'Conversa iniciada'}
                  </span>
                  {c.unread > 0 && (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-semibold text-white">
                      {c.unread > 99 ? '99+' : c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
