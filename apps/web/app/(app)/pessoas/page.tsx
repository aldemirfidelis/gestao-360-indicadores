'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LayoutGrid, List, MessageSquare, Search, UserCircle2, Users, Wifi } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { useRealtime } from '@/components/communication/realtime-provider';
import { UserAvatar } from '@/components/communication/user-avatar';
import { PRESENCE_LABEL, type PresenceStatus } from '@/lib/communication/events';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/platform/empty-state';
import { cn } from '@/lib/utils';

interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  customStatus: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
  branch: { id: string; name: string } | null;
  defaultNode: { id: string; name: string; type: string } | null;
  company: { id: string; name: string } | null;
  presence: { status: PresenceStatus; lastSeenAt: string | null };
}

interface DirectoryPage {
  items: DirectoryUser[];
  nextCursor: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'superadministrador',
  COMPANY_ADMIN: 'Admin',
  DIRECTOR: 'Diretor',
  MANAGER: 'Gestor',
  ANALYST: 'Analista',
  COLLABORATOR: 'Colaborador',
  VIEWER: 'Visualizador',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'PENDING', label: 'Convidados' },
  { value: 'BLOCKED', label: 'Bloqueados' },
  { value: 'INACTIVE', label: 'Inativos' },
];

export default function PessoasPage() {
  const { user } = useAuth();
  const { onlineCount, presenceOf } = useRealtime();
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [orgNodeId, setOrgNodeId] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const orgNodes = useQuery<Array<{ id: string; name: string; type: string }>>({
    queryKey: ['orgnodes-min'],
    queryFn: () => api('/orgnodes'),
    staleTime: 5 * 60_000,
  });

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (search) p.set('q', search);
    if (role) p.set('role', role);
    if (status) p.set('status', status);
    if (orgNodeId) p.set('orgNodeId', orgNodeId);
    p.set('limit', '30');
    return p;
  }, [search, role, status, orgNodeId]);

  const directory = useInfiniteQuery({
    queryKey: ['directory', params.toString()],
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams(params);
      if (pageParam) p.set('cursor', pageParam);
      return api<DirectoryPage>(`/communication/directory?${p.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !onlineOnly,
  });

  const online = useQuery<{ count: number; items: DirectoryUser[] }>({
    queryKey: ['directory-online', search],
    queryFn: () => api(`/communication/directory/online${search ? `?q=${encodeURIComponent(search)}` : ''}`),
    enabled: onlineOnly,
    refetchInterval: onlineOnly ? 20_000 : false,
  });

  const items: DirectoryUser[] = onlineOnly
    ? online.data?.items ?? []
    : directory.data?.pages.flatMap((p) => p.items) ?? [];

  const isLoading = onlineOnly ? online.isLoading : directory.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Users className="h-5 w-5" /> Pessoas
          </h1>
          <p className="text-sm text-muted-foreground">
            Diretório corporativo — todos os usuários ativos da plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <Wifi className="h-3.5 w-3.5 text-emerald-500" /> {onlineCount} conectados
          </Badge>
          <div className="flex overflow-hidden rounded-md border border-border/60">
            <button
              onClick={() => setView('cards')}
              className={cn('px-2.5 py-1.5', view === 'cards' ? 'bg-foreground text-background' : 'text-muted-foreground')}
              aria-label="Visualizar em cards"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn('px-2.5 py-1.5', view === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground')}
              aria-label="Visualizar em lista"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome, e-mail ou cargo..."
            className="h-9 pl-9"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
        >
          <option value="">Todos os papéis</option>
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={orgNodeId}
          onChange={(e) => setOrgNodeId(e.target.value)}
          className="h-9 max-w-[200px] rounded-md border border-border/60 bg-background px-2 text-sm"
        >
          <option value="">Todas as áreas/setores</option>
          {orgNodes.data?.map((n) => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>
        <Button
          variant={onlineOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOnlineOnly((v) => !v)}
          className="h-9"
        >
          <Wifi className="mr-1.5 h-4 w-4" /> Somente conectados
        </Button>
      </div>

      {isLoading && <div className="py-12 text-center text-sm text-muted-foreground">Carregando pessoas...</div>}

      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Nenhuma pessoa encontrada"
          description="Ajuste os filtros ou a busca para encontrar colaboradores."
        />
      )}

      {!isLoading && items.length > 0 && view === 'cards' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((u) => (
            <PersonCard key={u.id} user={u} liveStatus={presenceOf(u.id, u.presence.status)} isMe={u.id === user?.id} />
          ))}
        </div>
      )}

      {!isLoading && items.length > 0 && view === 'list' && (
        <div className="overflow-hidden rounded-lg border border-border/60">
          {items.map((u) => (
            <PersonRow key={u.id} user={u} liveStatus={presenceOf(u.id, u.presence.status)} isMe={u.id === user?.id} />
          ))}
        </div>
      )}

      {!onlineOnly && directory.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => directory.fetchNextPage()} disabled={directory.isFetchingNextPage}>
            {directory.isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
          </Button>
        </div>
      )}
    </div>
  );
}

function lastSeenLabel(user: DirectoryUser, status: PresenceStatus) {
  if (status === 'ONLINE') return 'Conectado agora';
  const ref = user.presence.lastSeenAt ?? user.lastLoginAt;
  if (!ref) return 'Sem acesso recente';
  try {
    return `Visto ${formatDistanceToNow(new Date(ref), { addSuffix: true, locale: ptBR })}`;
  } catch {
    return 'Sem acesso recente';
  }
}

function PersonCard({ user, liveStatus, isMe }: { user: DirectoryUser; liveStatus: PresenceStatus; isMe: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 transition-colors hover:border-border">
      <div className="flex items-start gap-3">
        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} status={liveStatus} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{user.name}{isMe && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}</div>
          <div className="truncate text-xs text-muted-foreground">{user.jobTitle ?? ROLE_LABEL[user.role] ?? user.role}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
            {user.defaultNode?.name ?? user.branch?.name ?? user.company?.name ?? ''}
          </div>
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground">{lastSeenLabel(user, liveStatus)}</div>
      <div className="mt-auto flex gap-2">
        <Button asChild size="sm" variant="outline" className="h-8 flex-1">
          <Link href={`/perfil/${user.id}`}>
            <UserCircle2 className="mr-1 h-3.5 w-3.5" /> Perfil
          </Link>
        </Button>
        {!isMe && (
          <Button asChild size="sm" className="h-8 flex-1">
            <Link href={`/comunicacao?to=${user.id}`}>
              <MessageSquare className="mr-1 h-3.5 w-3.5" /> Mensagem
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function PersonRow({ user, liveStatus, isMe }: { user: DirectoryUser; liveStatus: PresenceStatus; isMe: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/50 px-3 py-2.5 last:border-0 hover:bg-muted/40">
      <UserAvatar name={user.name} avatarUrl={user.avatarUrl} status={liveStatus} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{user.name}</span>
          {isMe && <span className="text-xs text-muted-foreground">(você)</span>}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {user.jobTitle ?? ROLE_LABEL[user.role] ?? user.role}
          {user.defaultNode?.name ? ` · ${user.defaultNode.name}` : ''}
        </div>
      </div>
      <div className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground md:block">{user.email}</div>
      <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">{PRESENCE_LABEL[liveStatus]}</Badge>
      <div className="flex shrink-0 gap-1.5">
        <Button asChild size="sm" variant="ghost" className="h-8">
          <Link href={`/perfil/${user.id}`}>Perfil</Link>
        </Button>
        {!isMe && (
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link href={`/comunicacao?to=${user.id}`}>
              <MessageSquare className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
