'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { useRealtime } from '@/components/communication/realtime-provider';
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

  const online = useQuery<{ count: number; items: OnlineUser[] }>({
    queryKey: ['online-panel', q],
    queryFn: () => api(`/communication/directory/online${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });

  const items = (online.data?.items ?? []).filter((u) => u.id !== user?.id);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setOpen((v) => !v)}
        aria-label="Pessoas conectadas"
        title="Pessoas conectadas"
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
              {onlineCount} {onlineCount === 1 ? 'pessoa conectada' : 'pessoas conectadas'}
            </span>
            <Link href="/pessoas" onClick={() => setOpen(false)} className="text-xs text-foreground underline-offset-2 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="p-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa conectada..." className="h-8 text-sm" />
          </div>
          <div className="max-h-[360px] overflow-y-auto p-1">
            {online.isLoading && <div className="px-3 py-6 text-center text-sm text-muted-foreground">Carregando...</div>}
            {!online.isLoading && items.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Ninguém conectado no momento.</div>
            )}
            {items.map((u) => (
              <div key={u.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted">
                <UserAvatar name={u.name} avatarUrl={u.avatarUrl} status={presenceOf(u.id, u.presence.status)} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{u.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{u.jobTitle ?? u.defaultNode?.name ?? ''}</div>
                </div>
                <Link
                  href={`/perfil/${u.id}`}
                  onClick={() => setOpen(false)}
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  Perfil
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
