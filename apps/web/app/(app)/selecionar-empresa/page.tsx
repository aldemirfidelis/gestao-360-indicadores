'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, CheckCircle2, Home } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type CompanyStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

interface Company {
  id: string;
  name: string;
  tradeName: string | null;
  cnpj: string | null;
  segment: string | null;
  status: CompanyStatus;
  usage: { users: number; indicators: number; openActions: number };
}

const STATUS_BADGE: Record<CompanyStatus, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-600 border-transparent',
  SUSPENDED: 'bg-amber-500/10 text-amber-600 border-transparent',
  INACTIVE: 'bg-muted text-muted-foreground border-transparent',
};
const STATUS_LABEL: Record<CompanyStatus, string> = {
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  INACTIVE: 'Inativa',
};

export default function SelecionarEmpresaPage() {
  const router = useRouter();
  const { user, switchCompany } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Somente Super Admin escolhe empresa; os demais vão direto à operação.
  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') router.replace('/meu-dia');
  }, [user, router]);

  const companies = useQuery<Company[]>({
    queryKey: ['platform-companies'],
    queryFn: () => api('/platform/companies'),
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const enter = async (companyId: string | null, key: string) => {
    setBusy(key);
    try {
      await switchCompany(companyId);
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível entrar nesta empresa.');
      setBusy(null);
    }
  };

  const list = (companies.data ?? []).filter((c) =>
    [c.name, c.tradeName, c.cnpj, c.segment].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      <div className="space-y-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Administração Geral</div>
        <h1 className="text-2xl font-semibold">Selecione a empresa que deseja administrar</h1>
        <p className="text-sm text-muted-foreground">
          Como superadministrador, você entra no contexto de uma empresa para gerenciar todos os seus dados.
          Pode trocar de empresa a qualquer momento pelo seletor no topo.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empresa..." className="h-10" />
        </div>
        <Button variant="outline" disabled={busy !== null} onClick={() => enter(null, '__home__')}>
          <Home className="mr-2 h-4 w-4" />
          {busy === '__home__' ? 'Entrando...' : 'Minha empresa de origem'}
        </Button>
      </div>

      {companies.isLoading && (
        <div className="grid place-items-center py-16 text-sm text-muted-foreground">Carregando empresas...</div>
      )}

      {!companies.isLoading && list.length === 0 && (
        <div className="grid place-items-center rounded-lg border border-dashed py-16 text-sm text-muted-foreground">
          Nenhuma empresa encontrada.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => {
          const isCurrent = user?.companyId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              disabled={busy !== null}
              onClick={() => enter(c.id, c.id)}
              className={cn(
                'group flex h-full flex-col rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/35 disabled:opacity-60',
                isCurrent && 'border-primary/50 bg-primary/5',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-status-blue/10 text-status-blue">
                  <Building2 className="h-5 w-5" />
                </div>
                <Badge className={cn('text-[10px]', STATUS_BADGE[c.status])}>{STATUS_LABEL[c.status]}</Badge>
              </div>
              <div className="mt-3 min-w-0">
                <div className="flex items-center gap-1.5 truncate font-semibold">
                  {c.name}
                  {isCurrent && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                </div>
                <div className="truncate text-xs text-muted-foreground">{c.tradeName ?? c.cnpj ?? c.segment ?? '—'}</div>
              </div>
              <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
                <span>{c.usage.users} usuários</span>
                <span>{c.usage.indicators} indicadores</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm font-medium text-primary">
                <span>{isCurrent ? 'Empresa atual' : busy === c.id ? 'Entrando...' : 'Administrar'}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
