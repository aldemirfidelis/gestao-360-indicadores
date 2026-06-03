'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, Mail, UserCircle2 } from 'lucide-react';
import { UserAvatar } from '@/components/communication/user-avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PRESENCE_LABEL, type PresenceStatus } from '@/lib/communication/events';
import type { ConversationSummary } from '@/lib/communication/types';
import { api } from '@/lib/api';

interface ProfileData {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  phone: string | null;
  avatarUrl: string | null;
  customStatus: string | null;
  company: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
  defaultNode: { id: string; name: string; type: string; parent: { id: string; name: string } | null } | null;
  presence: { status: PresenceStatus; lastSeenAt: string | null };
}

export function ContactDetails({ conversation }: { conversation: ConversationSummary | null }) {
  const contactId = conversation?.counterpart?.id ?? null;
  const profile = useQuery<ProfileData>({
    queryKey: ['profile', contactId],
    queryFn: () => api(`/communication/users/${contactId}/profile`),
    enabled: !!contactId,
    staleTime: 60_000,
  });

  if (!conversation) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Os detalhes aparecem quando uma conversa estiver selecionada.
      </div>
    );
  }

  if (!conversation.counterpart) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Conversa em grupo. Os participantes aparecem na lista da conversa.
      </div>
    );
  }

  const p = profile.data;
  const area = [p?.defaultNode?.parent?.name, p?.defaultNode?.name].filter(Boolean).join(' > ');
  const status = p?.presence.status ?? conversation.presence;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex flex-col items-center text-center">
        <UserAvatar
          name={p?.name ?? conversation.title}
          avatarUrl={p?.avatarUrl ?? conversation.avatarUrl}
          status={status}
          size="xl"
        />
        <h2 className="mt-3 text-lg font-semibold">{p?.name ?? conversation.title}</h2>
        <p className="text-sm text-muted-foreground">{p?.jobTitle ?? conversation.counterpart.jobTitle ?? 'Sem cargo informado'}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Badge variant="secondary">{PRESENCE_LABEL[status]}</Badge>
          {p?.customStatus && <Badge variant="outline">{p.customStatus}</Badge>}
        </div>
      </div>

      <div className="mt-5 grid gap-2 text-sm">
        <Info label="E-mail" value={p?.email ?? '-'} />
        <Info label="Empresa" value={p?.company?.name ?? '-'} />
        <Info label="Filial" value={p?.branch?.name ?? '-'} />
        <Info label="Área / Setor" value={area || '-'} />
        <Info label="Telefone" value={p?.phone ?? '-'} />
      </div>

      <div className="mt-5 grid gap-2">
        <Button asChild>
          <Link href={`/perfil/${conversation.counterpart.id}`}>
            <UserCircle2 className="mr-2 h-4 w-4" />
            Ver perfil
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/meetings?participantId=${conversation.counterpart.id}`}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            Agendar reunião
          </Link>
        </Button>
        <Button asChild variant="outline">
          <a href={`mailto:${p?.email ?? ''}`}>
            <Mail className="mr-2 h-4 w-4" />
            Enviar e-mail
          </a>
        </Button>
      </div>

      <div className="mt-5 rounded-md border bg-muted/25 p-3 text-xs text-muted-foreground">
        Links internos e reuniões criadas a partir desta conversa continuam respeitando as permissões de acesso de cada usuário.
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-medium">{value}</div>
    </div>
  );
}
