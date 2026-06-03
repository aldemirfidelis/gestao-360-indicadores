'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/page-header';
import { ConversationList } from '@/components/communication/chat/conversation-list';
import { ChatPanel } from '@/components/communication/chat/chat-panel';
import { ContactDetails } from '@/components/communication/chat/contact-details';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import type { ConversationSummary } from '@/lib/communication/types';

export default function ComunicacaoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const requestedConversation = searchParams.get('c');
  const requestedUser = searchParams.get('to');
  const startedFor = useRef<string | null>(null);

  const conversations = useQuery<ConversationSummary[]>({
    queryKey: ['conversations'],
    queryFn: () => api('/communication/conversations'),
    refetchInterval: 30_000,
  });

  const startDirect = useMutation({
    mutationFn: (userId: string) =>
      api<ConversationSummary>('/communication/conversations/direct', {
        method: 'POST',
        json: { userId },
      }),
    onSuccess: (conversation) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      router.replace(`/comunicacao?c=${conversation.id}`);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? 'Não foi possível iniciar a conversa');
      router.replace('/comunicacao');
    },
  });

  useEffect(() => {
    if (!requestedUser || startedFor.current === requestedUser) return;
    startedFor.current = requestedUser;
    startDirect.mutate(requestedUser);
  }, [requestedUser, startDirect]);

  const selectedId = useMemo(() => {
    const list = conversations.data ?? [];
    if (requestedConversation && list.some((c) => c.id === requestedConversation)) return requestedConversation;
    return list[0]?.id ?? null;
  }, [conversations.data, requestedConversation]);

  const selected = useMemo(
    () => (conversations.data ?? []).find((c) => c.id === selectedId) ?? null,
    [conversations.data, selectedId],
  );

  const unread = (conversations.data ?? []).reduce((sum, c) => sum + c.unread, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Comunicação"
        tone="view"
        title="Comunicação"
        description="Conversas corporativas, presença e mensagens em tempo real."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{unread} não lida(s)</Badge>
            <Button asChild variant="outline">
              <Link href="/pessoas">
                <Users className="mr-2 h-4 w-4" />
                Pessoas
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid h-[calc(100vh-11.5rem)] min-h-[560px] overflow-hidden rounded-lg border border-border/60 bg-card lg:grid-cols-[320px_minmax(0,1fr)_310px]">
        <aside className="min-h-0 border-b border-border/60 lg:border-b-0 lg:border-r">
          <ConversationList
            conversations={conversations.data ?? []}
            selectedId={selectedId}
            onSelect={(id) => router.replace(`/comunicacao?c=${id}`)}
            isLoading={conversations.isLoading || startDirect.isPending}
          />
        </aside>
        <section className="min-h-0 border-b border-border/60 lg:border-b-0 lg:border-r">
          {startDirect.isPending ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              <MessageSquare className="mr-2 h-4 w-4" />
              Iniciando conversa...
            </div>
          ) : (
            <ChatPanel conversation={selected} />
          )}
        </section>
        <aside className="hidden min-h-0 lg:block">
          <ContactDetails conversation={selected} />
        </aside>
      </div>
    </div>
  );
}
