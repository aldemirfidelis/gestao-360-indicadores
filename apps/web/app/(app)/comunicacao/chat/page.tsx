'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { ConversationList } from '@/components/communication/chat/conversation-list';
import { ChatPanel } from '@/components/communication/chat/chat-panel';
import { ContactDetails } from '@/components/communication/chat/contact-details';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import type { ConversationSummary } from '@/lib/communication/types';

/**
 * Chat corporativo. Fica fora do menu de Comunicação (que agora trata só de
 * publicações internas) — o acesso é pelo botão de mensagens do cabeçalho e
 * pelos links diretos de conversa.
 */
export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const requestedConversation = searchParams.get('c');
  const requestedUser = searchParams.get('to');
  const startedFor = useRef<string | null>(null);

  const conversations = useQuery<ConversationSummary[]>({
    queryKey: ['conversations', user?.companyId],
    queryFn: () => api('/communication/conversations'),
    refetchInterval: 30_000,
  });

  const startDirect = useMutation({
    mutationFn: (userId: string) =>
      api<ConversationSummary>('/communication/conversations/direct', { method: 'POST', json: { userId } }),
    onSuccess: (conversation) => {
      void qc.invalidateQueries({ queryKey: ['conversations'] });
      router.replace(`/comunicacao/chat?c=${conversation.id}`);
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Não foi possível iniciar a conversa');
      router.replace('/comunicacao/chat');
    },
  });

  useEffect(() => {
    if (!requestedUser || startedFor.current === requestedUser) return;
    startedFor.current = requestedUser;
    startDirect.mutate(requestedUser);
  }, [requestedUser, startDirect]);

  const selectedId = useMemo(() => {
    const list = conversations.data ?? [];
    if (requestedConversation && list.some((item) => item.id === requestedConversation)) return requestedConversation;
    return list[0]?.id ?? null;
  }, [conversations.data, requestedConversation]);

  const selected = useMemo(
    () => (conversations.data ?? []).find((item) => item.id === selectedId) ?? null,
    [conversations.data, selectedId],
  );
  const isLoading = conversations.isLoading || startDirect.isPending;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Comunicação"
        tone="view"
        title="Chat corporativo"
        description="Conversas diretas e em grupo com as pessoas da empresa."
      />
      <div className="grid h-[calc(100vh-14rem)] min-h-[560px] overflow-hidden rounded-lg border border-border/60 bg-card lg:grid-cols-[320px_minmax(0,1fr)_310px]">
        <aside className="min-h-0 border-b border-border/60 lg:border-b-0 lg:border-r">
          <ConversationList
            conversations={conversations.data ?? []}
            selectedId={selectedId}
            onSelect={(id) => router.replace(`/comunicacao/chat?c=${id}`)}
            isLoading={isLoading}
          />
        </aside>
        <section className="min-h-0 border-b border-border/60 lg:border-b-0 lg:border-r">
          {isLoading ? (
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
