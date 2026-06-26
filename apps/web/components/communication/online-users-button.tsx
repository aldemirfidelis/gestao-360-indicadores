'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { useRealtime } from '@/components/communication/realtime-provider';
import { useCommunication } from '@/components/communication/communication-provider';
import { UserAvatar } from '@/components/communication/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type PresenceStatus } from '@/lib/communication/events';

interface OnlineUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  defaultNode: { name: string } | null;
  presence: { status: PresenceStatus };
}

export function OnlineUsersButton() {
  const { user } = useAuth();
  const { onlineCount, presenceOf } = useRealtime();
  const { openChatWithUser } = useCommunication();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Carregar todos os usuários do diretório
  const directory = useQuery<{ items: OnlineUser[] }>({
    queryKey: ['contacts-panel', q],
    queryFn: () => api(`/communication/directory?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`),
    enabled: open,
    refetchInterval: open ? 30_000 : false,
  });

  // Ordenar usuários ativos (ONLINE, BUSY, etc.) no topo, seguidos por OFFLINE
  const sortedItems = useMemo(() => {
    const raw = (directory.data?.items ?? []).filter((u) => u.id !== user?.id);
    return [...raw].sort((a, b) => {
      const statusA = presenceOf(a.id, a.presence.status);
      const statusB = presenceOf(b.id, b.presence.status);
      const onlineA = statusA !== 'OFFLINE' ? 1 : 0;
      const onlineB = statusB !== 'OFFLINE' ? 1 : 0;
      if (onlineA !== onlineB) return onlineB - onlineA;
      return a.name.localeCompare(b.name);
    });
  }, [directory.data, presenceOf, user?.id]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setOpen((v) => !v)}
        aria-label="Contatos"
        title="Contatos"
      >
        <Users className="h-4 w-4" />
        {onlineCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-500 px-1 text-[9px] font-semibold text-white">
            {onlineCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Contatos ({onlineCount} online)
            </span>
            <Link href="/pessoas" onClick={() => setOpen(false)} className="text-xs text-foreground underline-offset-2 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="p-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar contato..." className="h-8 text-sm" />
          </div>
          <div className="max-h-[360px] overflow-y-auto p-1">
            {directory.isLoading && <div className="px-3 py-6 text-center text-sm text-muted-foreground">Carregando...</div>}
            {!directory.isLoading && sortedItems.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum contato encontrado.</div>
            )}
            {sortedItems.map((u) => {
              const liveStatus = presenceOf(u.id, u.presence.status);
              return (
                <div
                  key={u.id}
                  onClick={() => {
                    void openChatWithUser(u.id);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
                  title={`Conversar com ${u.name}`}
                >
                  <UserAvatar name={u.name} avatarUrl={u.avatarUrl} status={liveStatus} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.jobTitle ?? u.defaultNode?.name ?? ''}</div>
                  </div>
                  <div className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground">
                    {liveStatus !== 'OFFLINE' ? (
                      <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    ) : (
                      <span className="flex h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
