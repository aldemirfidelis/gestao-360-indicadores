'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, Check, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Notificações"
        className="relative"
      >
        {unread > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid place-items-center min-w-[18px] h-[18px] rounded-full bg-status-red text-white text-[10px] font-semibold px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Notificações</DialogTitle>
            <DialogDescription>
              {unread > 0 ? `${unread} não lida(s)` : 'Tudo em dia.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', generate.isPending && 'animate-spin')} />
              Verificar regras
            </Button>
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={() => markAll.mutate()}>
                <Check className="h-4 w-4 mr-2" /> Marcar todas
              </Button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6 space-y-2">
            {list.isLoading && (
              <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
            )}
            {list.data?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma notificação por aqui.
              </p>
            )}
            {list.data?.map((n) => {
              const Inner = (
                <div
                  className={cn(
                    'rounded-lg border p-3 flex items-start gap-3 transition-colors',
                    n.readAt ? 'opacity-60' : 'border-primary/20',
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
                    {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1">{formatDate(n.createdAt)}</div>
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
                <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>
                  {Inner}
                </Link>
              ) : (
                <div key={n.id}>{Inner}</div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
