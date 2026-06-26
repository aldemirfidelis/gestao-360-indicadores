'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, Check, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Notif {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const KIND_STYLES: Record<string, string> = {
  INDICATOR_OFF_TARGET: 'bg-status-red/15 text-status-red',
  ACTION_OVERDUE: 'bg-status-red/15 text-status-red',
  ACTION_DUE_SOON: 'bg-status-yellow/15 text-status-yellow',
  DEVIATION_CRITICAL: 'bg-status-red/15 text-status-red',
  PROJECT_LATE: 'bg-status-yellow/15 text-status-yellow',
  PENDING_RESULT: 'bg-status-blue/15 text-status-blue',
  MEETING_UPCOMING: 'bg-status-purple/15 text-status-purple',
  TARGET_MISSED: 'bg-status-red/15 text-status-red',
  MENTION: 'bg-status-blue/15 text-status-blue',
};

export function NotificationsBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const count = useQuery<{ unread: number }>({
    queryKey: ['notifications', 'count'],
    queryFn: () => api<{ unread: number }>('/notifications/count'),
    refetchInterval: 60_000,
  });

  const list = useQuery<Notif[]>({
    queryKey: ['notifications', 'list'],
    queryFn: () => api<Notif[]>('/notifications'),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Notificações marcadas como lidas');
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const generate = useMutation({
    mutationFn: () => api<{ generated: number }>('/notifications/generate', { method: 'POST' }),
    onSuccess: (out) => {
      toast.success(`${out.generated} nova(s) notificação(oes) gerada(s)`);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unread = count.data?.unread ?? 0;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
        title="Notificações"
        className="relative h-9 w-9"
      >
        {unread > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid place-items-center min-w-[16px] h-4 rounded-full bg-status-red text-white text-[9px] font-semibold px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-lg sm:w-96 text-foreground text-left">
          <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground block">
                Notificações
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                {unread > 0 ? `${unread} não lida(s)` : 'Tudo em dia.'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mb-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', generate.isPending && 'animate-spin')} />
              Verificar regras
            </Button>
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => markAll.mutate()}>
                <Check className="h-3.5 w-3.5 mr-1.5" /> Marcar todas
              </Button>
            )}
          </div>

          <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {list.isLoading && (
              <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
            )}
            {!list.isLoading && list.data?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma notificação por aqui.
              </p>
            )}
            {list.data?.map((n) => {
              const Inner = (
                <div
                  className={cn(
                    'rounded-lg border p-3 flex items-start gap-3 transition-colors text-left hover:bg-muted/35',
                    n.readAt ? 'opacity-60 border-border/50' : 'border-primary/20 bg-primary/[0.02]',
                  )}
                >
                  <span
                    className={cn(
                      'grid place-items-center h-8 w-8 rounded-md shrink-0',
                      KIND_STYLES[n.kind] ?? 'bg-muted text-muted-foreground',
                    )}
                  >
                    <BellRing className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    {n.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1.5">{formatDate(n.createdAt)}</div>
                  </div>
                  {!n.readAt && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        markRead.mutate(n.id);
                      }}
                      className="text-xs text-primary hover:underline shrink-0"
                    >
                      Marcar
                    </button>
                  )}
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} onClick={() => setOpen(false)} className="block">
                  {Inner}
                </Link>
              ) : (
                <div key={n.id}>{Inner}</div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
