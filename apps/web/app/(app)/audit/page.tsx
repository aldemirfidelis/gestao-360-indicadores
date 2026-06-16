'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Eye, FileText, ScrollText, Search } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { TRACE_ENTITY_LABEL } from '@/lib/labels';

interface AuditEntry {
  id: string;
  action: string;
  module: string | null;
  entity: string;
  entityId: string | null;
  recordLabel: string | null;
  payload: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  result: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

const ACTION_PILL: Record<string, string> = {
  LOGIN: 'pill-blue',
  LOGOUT: 'pill-gray',
  CREATE: 'pill-green',
  UPDATE: 'pill-yellow',
  DELETE: 'pill-red',
  PERMISSION_CHANGE: 'pill-purple',
};

const ACTION_LABEL: Record<string, string> = {
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  CREATE: 'Criação',
  UPDATE: 'Atualização',
  DELETE: 'Exclusão',
  PERMISSION_CHANGE: 'Alteração de permissão',
};

const RESULT_LABEL: Record<string, string> = {
  SUCCESS: 'Sucesso',
  ERROR: 'Erro',
  WARNING: 'Alerta',
};

export default function AuditPage() {
  const [filters, setFilters] = useState({ q: '', entity: '', action: '', module: '', userId: '', from: '', to: '' });
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const query = useQuery<AuditEntry[]>({
    queryKey: ['audit', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
      params.set('limit', '500');
      return api<AuditEntry[]>(`/audit?${params.toString()}`);
    },
  });

  const users = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string }>();
    (query.data ?? []).forEach((row) => row.user && map.set(row.user.id, row.user));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [query.data]);

  const modules = useMemo(() => Array.from(new Set((query.data ?? []).map((row) => row.module).filter(Boolean))) as string[], [query.data]);

  return (
    <div>
      <PageHeader
        eyebrow="Configurações"
        tone="admin"
        title="Auditoria"
        description="Rastreabilidade automática de acessos, criacoes, edicoes, exclusoes, parâmetros e permissões."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Configurações', href: '/settings' }, { label: 'Auditoria' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadCsv}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <FileText className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>
        }
      />

      <SectionCard title="Filtros" description="Combine período, usuário, módulo, tipo de ação e busca livre.">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Pesquisar no log..." value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          </div>
          <NativeSelect value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
            <option value="">Todas as ações</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="CREATE">Criação</option>
            <option value="UPDATE">Edição</option>
            <option value="DELETE">Exclusão</option>
            <option value="PERMISSION_CHANGE">Permissão</option>
          </NativeSelect>
          <NativeSelect value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })}>
            <option value="">Todos os módulos</option>
            {modules.map((module) => <option key={module} value={module}>{module}</option>)}
          </NativeSelect>
          <NativeSelect value={filters.userId} onChange={(e) => setFilters({ ...filters, userId: e.target.value })}>
            <option value="">Todos usuários</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </NativeSelect>
          <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
      </SectionCard>

      <SectionCard title="Eventos auditados" description={`${query.data?.length ?? 0} registro(s) encontrados.`} contentClassName="p-0">
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th className="text-left">Quando</th>
                <th className="text-left">Usuário</th>
                <th className="text-left">Ação</th>
                <th className="text-left">Módulo</th>
                <th className="text-left">Registro afetado</th>
                <th className="text-left">Resultado</th>
                <th className="text-left">IP / sessão</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {query.data?.map((entry) => (
                <tr key={entry.id}>
                  <td className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</td>
                  <td>
                    {entry.user ? (
                      <div>
                        <div className="font-medium">{entry.user.name}</div>
                        <div className="text-xs text-muted-foreground">{entry.user.email}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sistema</span>
                    )}
                  </td>
                  <td><span className={cn('pill', ACTION_PILL[entry.action] ?? 'pill-gray')}>{ACTION_LABEL[entry.action] ?? entry.action}</span></td>
                  <td>{entry.module ?? '-'}</td>
                  <td>
                    <div className="flex flex-col">
                      <Badge variant="outline" className="w-fit">{TRACE_ENTITY_LABEL[entry.entity] ?? entry.entity}</Badge>
                      {entry.entityId && <span className="mt-0.5 max-w-[220px] truncate font-mono text-[10px] text-muted-foreground">{entry.entityId}</span>}
                    </div>
                  </td>
                  <td><span className={cn('pill', entry.result === 'ERROR' ? 'pill-red' : 'pill-green')}>{RESULT_LABEL[entry.result ?? 'SUCCESS'] ?? entry.result}</span></td>
                  <td className="text-xs text-muted-foreground">
                    <div>{entry.ip ?? '-'}</div>
                    <div className="max-w-[260px] truncate">{entry.userAgent ?? ''}</div>
                  </td>
                  <td className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelected(entry)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Detalhe
                    </Button>
                  </td>
                </tr>
              ))}
              {query.isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando...</td></tr>
              )}
              {!query.isLoading && (query.data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState icon={<ScrollText className="h-5 w-5" />} title="Nenhum registro encontrado" description="Ajuste os filtros ou aguarde novas ações do sistema." className="border-0 bg-transparent" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalhe da auditoria</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Detail label="Ação" value={selected.action} />
                <Detail label="Módulo" value={selected.module ?? '-'} />
                <Detail label="Entidade" value={selected.entity} />
                <Detail label="Resultado" value={selected.result ?? 'SUCCESS'} />
              </div>
              <Payload title="Valor anterior" value={selected.beforeValue} />
              <Payload title="Valor novo / dados técnicos" value={selected.afterValue ?? selected.payload} />
              <Payload title="Metadados" value={selected.payload} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  async function downloadCsv() {
    const csv = await api<string>('/audit/exports/csv');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'auditoria.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/25 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function Payload({ title, value }: { title: string; value: string | null }) {
  return (
    <div>
      <div className="mb-1 text-sm font-semibold">{title}</div>
      <pre className="max-h-56 overflow-auto rounded-lg border bg-muted/35 p-3 text-xs">
        {pretty(value)}
      </pre>
    </div>
  );
}

function pretty(value: string | null) {
  if (!value) return '-';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
