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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import type { DbAdminAuditRow } from '@/components/database-admin/types';

interface AuditResponse { rows: DbAdminAuditRow[]; total: number; skip: number; take: number }

const ACTIONS = ['', 'ACCESS', 'DENIED', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DDL', 'EXPORT', 'IMPORT', 'BACKUP', 'RESTORE'];
const SUBMENUS = ['', 'overview', 'tables', 'records', 'query', 'structure', 'indexes', 'import-export', 'backup', 'audit', 'diagnostics', 'settings'];

export default function DbAuditPage() {
  const [filters, setFilters] = useState({ q: '', action: '', submenu: '', result: '', from: '', to: '', targetTable: '' });
  const [page, setPage] = useState(0);
  const take = 50;
  const [detail, setDetail] = useState<DbAdminAuditRow | null>(null);

  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
  params.set('skip', String(page * take));
  params.set('take', String(take));

  const audit = useQuery<AuditResponse>({
    queryKey: ['db-admin', 'audit', filters, page],
    queryFn: () => api<AuditResponse>(`/admin/database/audit?${params.toString()}`),
    refetchOnWindowFocus: false,
  });
  const data = audit.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / take)) : 1;
  const upd = (patch: Partial<typeof filters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(0); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Auditoria administrativa</h2>
          <p className="text-sm text-muted-foreground">Todas as ações do módulo (incluindo acessos negados). Sem exclusão silenciosa.</p>
        </div>
        <Button variant="outline" onClick={() => audit.refetch()} disabled={audit.isFetching}>
          <RefreshCcw className={cn('mr-2 h-4 w-4', audit.isFetching && 'animate-spin')} /> Atualizar
        </Button>
      </div>

      <SectionCard title="Filtros" description="Refine por período, ação, submenu e resultado.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Label>Busca</Label>
            <Search className="pointer-events-none absolute left-3 top-9 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={filters.q} onChange={(e) => upd({ q: e.target.value })} placeholder="mensagem, SQL, tabela, e-mail..." />
          </div>
          <div><Label>Ação</Label><NativeSelect value={filters.action} onChange={(e) => upd({ action: e.target.value })}>{ACTIONS.map((a) => <option key={a} value={a}>{a || 'Todas'}</option>)}</NativeSelect></div>
          <div><Label>Submenu</Label><NativeSelect value={filters.submenu} onChange={(e) => upd({ submenu: e.target.value })}>{SUBMENUS.map((s) => <option key={s} value={s}>{s || 'Todos'}</option>)}</NativeSelect></div>
          <div><Label>Resultado</Label><NativeSelect value={filters.result} onChange={(e) => upd({ result: e.target.value })}><option value="">Todos</option><option value="SUCCESS">SUCCESS</option><option value="ERROR">ERROR</option><option value="DENIED">DENIED</option></NativeSelect></div>
          <div><Label>De</Label><Input type="date" value={filters.from} onChange={(e) => upd({ from: e.target.value })} /></div>
          <div><Label>Até</Label><Input type="date" value={filters.to} onChange={(e) => upd({ to: e.target.value })} /></div>
          <div><Label>Tabela</Label><Input value={filters.targetTable} onChange={(e) => upd({ targetTable: e.target.value })} /></div>
        </div>
      </SectionCard>

      <SectionCard title="Eventos" description={data ? `${formatNumber(data.total)} evento(s).` : ''} contentClassName="p-0">
        {audit.isLoading && <LoadingState label="Lendo auditoria..." />}
        {data && (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th className="text-left">Quando</th><th className="text-left">Usuário</th><th className="text-left">Submenu</th>
                  <th className="text-left">Ação</th><th className="text-left">Tabela</th><th className="text-left">Linhas</th>
                  <th className="text-left">Resultado</th><th className="text-left">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                    <td className="whitespace-nowrap text-xs">{formatDate(r.createdAt)}</td>
                    <td className="text-xs">{r.userEmail ?? '-'}</td>
                    <td className="text-xs">{r.submenu}</td>
                    <td><span className="font-mono text-xs">{r.action}</span>{r.mode && <span className="ml-1 text-[10px] text-muted-foreground">{r.mode}</span>}</td>
                    <td className="text-xs">{r.targetTable ?? '-'}</td>
                    <td className="text-xs">{r.rowsAffected ?? '-'}</td>
                    <td><span className={cn('pill', r.result === 'SUCCESS' ? 'pill-green' : r.result === 'DENIED' ? 'pill-yellow' : 'pill-red')}>{r.result}</span></td>
                    <td className="max-w-[280px] truncate text-xs text-muted-foreground">{r.message ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <div className="flex items-center justify-between gap-2 border-t p-3 text-sm">
            <span className="text-muted-foreground">Página {page + 1} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </SectionCard>

      {detail && (
        <Dialog open onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>Evento de auditoria</DialogTitle></DialogHeader>
            <div className="space-y-2 text-xs">
              <Row k="Quando" v={formatDate(detail.createdAt)} />
              <Row k="Usuário" v={`${detail.userEmail ?? '-'} (${detail.userRole ?? '-'})`} />
              <Row k="Submenu / Ação" v={`${detail.submenu} / ${detail.action}${detail.mode ? ` (${detail.mode})` : ''}`} />
              <Row k="Tabela / Registro" v={`${detail.targetTable ?? '-'} / ${detail.targetRecordId ?? '-'}`} />
              <Row k="Resultado" v={`${detail.result}${detail.rowsAffected != null ? ` · ${detail.rowsAffected} linha(s)` : ''}`} />
              <Row k="Transação / Backup" v={`${detail.transactionId ?? '-'} / ${detail.backupId ?? '-'}`} />
              <Row k="IP" v={detail.ip ?? '-'} />
              {detail.message && <Row k="Mensagem" v={detail.message} />}
              {detail.sqlText && <Block k="SQL" v={detail.sqlText} />}
              {detail.beforeValue && <Block k="Antes" v={detail.beforeValue} />}
              {detail.afterValue && <Block k="Depois" v={detail.afterValue} />}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-2"><span className="w-40 shrink-0 font-medium text-muted-foreground">{k}</span><span className="break-all">{v}</span></div>;
}
function Block({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="font-medium text-muted-foreground">{k}</div>
      <pre className="mt-1 max-h-40 overflow-auto rounded border bg-muted/30 p-2">{v}</pre>
    </div>
  );
}
