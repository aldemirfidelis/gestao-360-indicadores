'use client';

// Extraido de app/(app)/comunicacao/page.tsx (decomposicao Fase 4).
import { MessageSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ConversationList } from '@/components/communication/chat/conversation-list';
import { ChatPanel } from '@/components/communication/chat/chat-panel';
import { ContactDetails } from '@/components/communication/chat/contact-details';
import type { ConversationSummary } from '@/lib/communication/types';

export function ChatWorkspace({ conversations, selectedId, selected, isLoading, onSelect }: { conversations: ConversationSummary[]; selectedId: string | null; selected: ConversationSummary | null; isLoading: boolean; onSelect: (id: string) => void }) {
  return (
    <div className="grid h-[calc(100vh-14rem)] min-h-[560px] overflow-hidden rounded-lg border border-border/60 bg-card lg:grid-cols-[320px_minmax(0,1fr)_310px]">
      <aside className="min-h-0 border-b border-border/60 lg:border-b-0 lg:border-r">
        <ConversationList conversations={conversations} selectedId={selectedId} onSelect={onSelect} isLoading={isLoading} />
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
  );
}

