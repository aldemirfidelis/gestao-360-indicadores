'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Banknote, CheckCircle2, Download, Landmark, ShieldAlert, Upload } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api, getAccessToken } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

interface BankBatch {
  id: string;
  runId: string;
  periodRef: string;
  paymentDate: string;
  status: string;
  itemCount: number;
  totalCents: number;
  antifraud: Array<{ severity: string; code: string; message: string }> | null;
  createdById: string | null;
  items: Array<{ id: string; name: string; netCents: number; status: string; returnCode: string | null }>;
}
interface Competence { id: string; year: number; month: number; runs: Array<{ id: string; kind: string; status: string }> }

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700', PENDING_APPROVAL: 'bg-amber-100 text-amber-800', APPROVED: 'bg-sky-100 text-sky-800',
  EXPORTED: 'bg-violet-100 text-violet-800', RETURNED: 'bg-orange-100 text-orange-800', RECONCILED: 'bg-emerald-100 text-emerald-800', CANCELLED: 'bg-slate-100 text-slate-500',
};

export default function BankPaymentPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canBank = hasPermission(['folha:bank']);
  const [selectedRun, setSelectedRun] = useState('');
  const [cfg, setCfg] = useState({ bankCode: '', agency: '', account: '', accountDigit: '' });

  const competencesQuery = useQuery<Competence[]>({ queryKey: ['payroll-competences'], queryFn: () => api('/payroll/competences') });
  const configQuery = useQuery<{ bankCode: string; agency: string; account: string; accountDigit: string | null } | null>({
    queryKey: ['payroll-bank-config'], queryFn: () => api('/payroll/bank/config'),
  });
  const batchesQuery = useQuery<BankBatch[]>({ queryKey: ['payroll-bank-batches'], queryFn: () => api('/payroll/bank/batches') });

  const runs = useMemo(() => (competencesQuery.data ?? []).flatMap((c) => c.runs.map((r) => ({ ...r, label: `${c.year}-${String(c.month).padStart(2, '0')} · ${r.kind} · ${r.status}` }))), [competencesQuery.data]);
  const effectiveRun = selectedRun || runs.find((r) => ['APPROVED', 'CLOSED'].includes(r.status))?.id || '';

  const saveConfig = useMutation({
    mutationFn: () => api('/payroll/bank/config', { method: 'POST', json: cfg }),
    onSuccess: () => { toast.success('Conta pagadora salva.'); void qc.invalidateQueries({ queryKey: ['payroll-bank-config'] }); },
    onError: (e: any) => toast.error(e.message || 'Erro.'),
  });
  const createBatch = useMutation({
    mutationFn: () => api<{ alerts: unknown[] }>(`/payroll/runs/${effectiveRun}/bank/batch`, { method: 'POST', json: {} }),
    onSuccess: (r) => { toast.success(`Lote montado. ${r.alerts.length} alerta(s) antifraude.`); void qc.invalidateQueries({ queryKey: ['payroll-bank-batches'] }); },
    onError: (e: any) => toast.error(e.message || 'Erro ao montar lote.'),
  });
  const approve = useMutation({
    mutationFn: (id: string) => api(`/payroll/bank/batches/${id}/approve`, { method: 'POST', json: { acknowledgeAlerts: true } }),
    onSuccess: () => { toast.success('Lote aprovado.'); void qc.invalidateQueries({ queryKey: ['payroll-bank-batches'] }); },
    onError: (e: any) => toast.error(e.message || 'Erro ao aprovar.'),
  });
  const importReturn = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => api<{ paid: number; rejected: number }>(`/payroll/bank/batches/${id}/return`, { method: 'POST', json: { content } }),
    onSuccess: (r) => { toast.success(`Retorno: ${r.paid} pago(s), ${r.rejected} rejeitado(s).`); void qc.invalidateQueries({ queryKey: ['payroll-bank-batches'] }); },
    onError: (e: any) => toast.error(e.message || 'Erro no retorno.'),
  });

  async function exportRemessa(id: string, periodRef: string) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
      const res = await fetch(`${apiUrl}/payroll/bank/batches/${id}/export`, { method: 'POST', headers: { authorization: `Bearer ${getAccessToken()}` } });
      if (!res.ok) throw new Error('Falha ao exportar.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `REMESSA-${periodRef}.REM`; a.click(); URL.revokeObjectURL(url);
      toast.success('Remessa CNAB 240 gerada.'); void qc.invalidateQueries({ queryKey: ['payroll-bank-batches'] });
    } catch (e: any) { toast.error(e.message || 'Erro ao exportar.'); }
  }

  const config = configQuery.data;
  const batches = batchesQuery.data ?? [];
  const fmt = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/servico-pessoal/folha" className="flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Voltar para Folha</Link>
      </div>
      <PageHeader title="Pagamento Bancário" description="Remessa CNAB 240 com dupla aprovação e antifraude. Nada é enviado ao banco automaticamente — exporte e envie no gerenciador do banco; depois importe o retorno." />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Landmark className="h-4 w-4 text-sky-500" /> Conta pagadora da empresa</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 items-end gap-3 md:grid-cols-5">
          {config && !cfg.bankCode ? (
            <div className="col-span-2 text-sm text-muted-foreground md:col-span-4">Banco {config.bankCode} · Ag {config.agency} · Conta {config.account}-{config.accountDigit ?? ''}</div>
          ) : (
            <>
              <div><Label className="text-xs">Banco</Label><Input value={cfg.bankCode} onChange={(e) => setCfg({ ...cfg, bankCode: e.target.value.replace(/\D/g, '') })} placeholder={config?.bankCode ?? '341'} /></div>
              <div><Label className="text-xs">Agência</Label><Input value={cfg.agency} onChange={(e) => setCfg({ ...cfg, agency: e.target.value })} placeholder={config?.agency} /></div>
              <div><Label className="text-xs">Conta</Label><Input value={cfg.account} onChange={(e) => setCfg({ ...cfg, account: e.target.value })} placeholder={config?.account} /></div>
              <div><Label className="text-xs">Dígito</Label><Input value={cfg.accountDigit} onChange={(e) => setCfg({ ...cfg, accountDigit: e.target.value })} /></div>
            </>
          )}
          {canBank && <Button variant="outline" onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>Salvar conta</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Montar lote de pagamento</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <NativeSelect className="max-w-sm" value={effectiveRun} onChange={(e) => setSelectedRun(e.target.value)}>
            {runs.length === 0 && <option value="">Nenhum processamento</option>}
            {runs.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </NativeSelect>
          {canBank && <Button onClick={() => createBatch.mutate()} disabled={!effectiveRun || createBatch.isPending}><Banknote className="mr-2 h-4 w-4" /> Montar lote</Button>}
          <span className="text-xs text-muted-foreground">A folha precisa estar aprovada/fechada.</span>
        </CardContent>
      </Card>

      {batches.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum lote de pagamento.</CardContent></Card>
      ) : batches.map((b) => {
        const high = (b.antifraud ?? []).filter((a) => a.severity === 'HIGH');
        return (
          <Card key={b.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
              <div>
                <CardTitle className="text-sm">Lote {b.periodRef} · {b.itemCount} colaborador(es) · {fmt(b.totalCents)}</CardTitle>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className={cn('text-[10px]', STATUS_TONE[b.status])}>{b.status}</Badge>
                  <span>Pagamento: {new Date(b.paymentDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                </div>
              </div>
              {canBank && (
                <div className="flex flex-wrap gap-2">
                  {b.status === 'PENDING_APPROVAL' && <Button size="sm" variant="outline" onClick={() => approve.mutate(b.id)}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aprovar</Button>}
                  {(b.status === 'APPROVED' || b.status === 'EXPORTED') && <Button size="sm" variant="outline" onClick={() => exportRemessa(b.id, b.periodRef)}><Download className="mr-1 h-3.5 w-3.5" /> Remessa CNAB</Button>}
                  {['EXPORTED', 'RETURNED'].includes(b.status) && <Button size="sm" variant="ghost" onClick={() => { const c = prompt('Cole o retorno CNAB 240:'); if (c) importReturn.mutate({ id: b.id, content: c }); }}><Upload className="mr-1 h-3.5 w-3.5" /> Importar retorno</Button>}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {(b.antifraud ?? []).length > 0 && (
                <div className="space-y-1 rounded-md border border-amber-400/30 bg-amber-500/5 p-2">
                  <div className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300"><ShieldAlert className="h-3.5 w-3.5" /> Antifraude ({high.length} alta, {(b.antifraud ?? []).length - high.length} média)</div>
                  {(b.antifraud ?? []).slice(0, 8).map((a, i) => (
                    <div key={i} className={cn('flex items-start gap-1', a.severity === 'HIGH' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400')}>
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{a.message}
                    </div>
                  ))}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-1">Colaborador</th><th>Líquido</th><th>Status</th><th>Retorno</th></tr></thead>
                  <tbody className="divide-y">
                    {b.items.slice(0, 100).map((it) => (
                      <tr key={it.id}><td className="py-1">{it.name}</td><td>{fmt(it.netCents)}</td><td>{it.status}</td><td>{it.returnCode ?? '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
