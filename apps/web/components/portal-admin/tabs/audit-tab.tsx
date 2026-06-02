'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCcw, Search } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import type { PortalAuditRow } from '@/components/portal-admin/types';

interface Resp { rows: PortalAuditRow[]; total: number }
const RESULTS = ['', 'SUCCESS', 'ERROR', 'DENIED'];

export function AuditTab() {
  const [f, setF] = useState({ q: '', result: '', action: '', from: '', to: '' });
  const [page, setPage] = useState(0);
  const take = 50;
  const params = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v && params.set(k, v));
  params.set('skip', String(page * take));
  params.set('take', String(take));
  const q = useQuery<Resp>({ queryKey: ['portal', 'audit', f, page], queryFn: () => api(`/admin/portal/audit?${params.toString()}`), refetchOnWindowFocus: false });
  const d = q.data;
  const totalPages = d ? Math.max(1, Math.ceil(d.total / take)) : 1;
  const upd = (p: Partial<typeof f>) => { setF((x) => ({ ...x, ...p })); setPage(0); };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Toda alteração na central é auditada (inclusive acessos negados). Sem exclusão silenciosa.</p>
      <SectionCard title="Filtros" description="">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <div className="relative xl:col-span-2"><Label>Busca</Label><Search className="pointer-events-none absolute left-3 top-9 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={f.q} onChange={(e) => upd({ q: e.target.value })} /></div>
          <div><Label>Resultado</Label><NativeSelect value={f.result} onChange={(e) => upd({ result: e.target.value })}>{RESULTS.map((r) => <option key={r} value={r}>{r || 'Todos'}</option>)}</NativeSelect></div>
          <div><Label>De</Label><Input type="date" value={f.from} onChange={(e) => upd({ from: e.target.value })} /></div>
          <div><Label>Até</Label><Input type="date" value={f.to} onChange={(e) => upd({ to: e.target.value })} /></div>
        </div>
      </SectionCard>
      <SectionCard title="Eventos" description={d ? `${formatNumber(d.total)} evento(s)` : ''} contentClassName="p-0">
        {q.isLoading && <LoadingState label="Lendo auditoria..." />}
        {d && (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead><tr><th className="text-left">Quando</th><th className="text-left">Usuário</th><th className="text-left">Aba</th><th className="text-left">Ação</th><th className="text-left">Alvo</th><th className="text-left">Resultado</th><th className="text-left">Mensagem</th></tr></thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs">{formatDate(r.createdAt)}</td>
                    <td className="text-xs">{r.userEmail ?? '-'}</td>
                    <td className="text-xs">{r.tab}</td>
                    <td><span className="font-mono text-xs">{r.action}</span></td>
                    <td className="text-xs">{r.targetCode ?? '-'}</td>
                    <td><span className={cn('pill', r.result === 'SUCCESS' ? 'pill-green' : r.result === 'DENIED' ? 'pill-yellow' : 'pill-red')}>{r.result}</span></td>
                    <td className="max-w-[280px] truncate text-xs text-muted-foreground">{r.message ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d && (
          <div className="flex items-center justify-between gap-2 border-t p-3 text-sm">
            <span className="text-muted-foreground">Página {page + 1} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
