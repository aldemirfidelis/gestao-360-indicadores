'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CalendarClock, Download, ExternalLink, FileCheck, Paperclip, RefreshCw, Upload } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { api, getAccessToken } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

interface Obligation {
  id: string;
  kind: string;
  periodRef: string;
  title: string;
  dueDate: string | null;
  status: string;
  amountCents: number | null;
  protocol: string | null;
  officialUrl: string | null;
  checklist: Array<{ label: string; done: boolean }> | null;
  attachments: Array<{ name: string; note?: string; uploadedAt: string }> | null;
  resultJson: any;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente', IN_PROGRESS: 'Em andamento', SUBMITTED: 'Transmitida', PAID: 'Paga', DONE: 'Concluída', NA: 'Não aplicável',
};
const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  SUBMITTED: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  DONE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  NA: 'bg-slate-100 text-slate-500',
};

export default function ObligationsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canOperate = hasPermission(['folha:operate']);
  const [periodRef, setPeriodRef] = useState(() => new Date().toISOString().slice(0, 7));

  const obligationsQuery = useQuery<Obligation[]>({
    queryKey: ['payroll-obligations', periodRef],
    queryFn: () => api<Obligation[]>(`/payroll/obligations?periodRef=${periodRef}`),
  });

  const generate = useMutation({
    mutationFn: () => api('/payroll/obligations/generate', { method: 'POST', json: { periodRef } }),
    onSuccess: (r: any) => { toast.success(`${r.created} obrigação(ões) gerada(s).`); void qc.invalidateQueries({ queryKey: ['payroll-obligations', periodRef] }); },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar.'),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/payroll/obligations/${id}`, { method: 'POST', json: { status } }),
    onSuccess: () => { toast.success('Status atualizado.'); void qc.invalidateQueries({ queryKey: ['payroll-obligations', periodRef] }); },
    onError: (e: any) => toast.error(e.message || 'Erro.'),
  });

  const toggleCheck = useMutation({
    mutationFn: ({ id, checklist }: { id: string; checklist: Obligation['checklist'] }) => api(`/payroll/obligations/${id}`, { method: 'POST', json: { checklist } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payroll-obligations', periodRef] }),
  });

  const attach = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api(`/payroll/obligations/${id}/attachment`, { method: 'POST', json: { name } }),
    onSuccess: () => { toast.success('Comprovante registrado.'); void qc.invalidateQueries({ queryKey: ['payroll-obligations', periodRef] }); },
    onError: (e: any) => toast.error(e.message || 'Erro.'),
  });

  const importReturn = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => api<{ divergent: number; checked: number }>(`/payroll/obligations/${id}/qualif-cad-return`, { method: 'POST', json: { content } }),
    onSuccess: (r) => { toast.success(`Retorno: ${r.divergent} divergência(s) em ${r.checked}.`); void qc.invalidateQueries({ queryKey: ['payroll-obligations', periodRef] }); },
    onError: (e: any) => toast.error(e.message || 'Erro.'),
  });

  const obligations = obligationsQuery.data ?? [];
  const overdue = obligations.filter((o) => o.dueDate && new Date(o.dueDate) < new Date() && !['PAID', 'DONE', 'NA'].includes(o.status)).length;

  const fmtMoney = (c: number | null) => (c == null ? '—' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');

  async function downloadQualifCad() {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
      const res = await fetch(`${apiUrl}/payroll/obligations/qualif-cad/${periodRef}`, { method: 'POST', headers: { authorization: `Bearer ${getAccessToken()}` } });
      if (!res.ok) throw new Error('Falha ao gerar o lote.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `QualificacaoCadastral-${periodRef}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Lote de Qualificação Cadastral gerado.');
      void qc.invalidateQueries({ queryKey: ['payroll-obligations', periodRef] });
    } catch (e: any) { toast.error(e.message || 'Erro ao gerar o lote.'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/servico-pessoal/folha" className="flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Voltar para Folha</Link>
      </div>
      <PageHeader
        title="Obrigações Trabalhistas"
        description="Calendário legal, checklists e comprovantes (modo assistido). A transmissão e o pagamento são feitos nos portais oficiais."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input type="month" className="h-9 w-40" value={periodRef} onChange={(e) => setPeriodRef(e.target.value)} />
            {canOperate && <Button onClick={() => generate.mutate()} disabled={generate.isPending}><CalendarClock className="mr-2 h-4 w-4" /> Gerar calendário</Button>}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Obrigações</div><div className="text-2xl font-bold">{obligations.length}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Vencidas em aberto</div><div className={cn('text-2xl font-bold', overdue > 0 ? 'text-rose-500' : '')}>{overdue}</div></CardContent></Card>
        <Card><CardContent className="p-3 flex items-center justify-between"><div><div className="text-[10px] uppercase text-muted-foreground">Qualificação Cadastral</div><div className="text-xs text-muted-foreground">Lote CPF/NIS/nome/nascimento</div></div>{canOperate && <Button size="sm" variant="outline" onClick={downloadQualifCad}><Download className="mr-1 h-3.5 w-3.5" /> Gerar lote</Button>}</CardContent></Card>
      </div>

      {obligations.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma obrigação nesta competência. Clique em “Gerar calendário”.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {obligations.map((o) => {
            const isOverdue = o.dueDate && new Date(o.dueDate) < new Date() && !['PAID', 'DONE', 'NA'].includes(o.status);
            return (
              <Card key={o.id} className={cn('border', isOverdue && 'border-rose-400/50')}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <div>
                    <CardTitle className="text-sm">{o.title}</CardTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className={cn('text-[10px]', STATUS_TONE[o.status])}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                      <span className={cn(isOverdue && 'font-semibold text-rose-500')}>Vence: {fmtDate(o.dueDate)}</span>
                      {o.amountCents != null && <span>Valor: {fmtMoney(o.amountCents)}</span>}
                      {o.protocol && <span>Protocolo: {o.protocol}</span>}
                      {o.officialUrl && <a href={o.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-600 hover:underline"><ExternalLink className="h-3 w-3" /> portal</a>}
                    </div>
                  </div>
                  {canOperate && (
                    <NativeSelect className="h-8 w-40 text-xs" value={o.status} onChange={(e) => setStatus.mutate({ id: o.id, status: e.target.value })}>
                      {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </NativeSelect>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {Array.isArray(o.checklist) && o.checklist.length > 0 && (
                    <div className="space-y-1">
                      {o.checklist.map((item, i) => (
                        <label key={i} className="flex items-center gap-2">
                          <input type="checkbox" checked={item.done} disabled={!canOperate} onChange={(e) => {
                            const next = o.checklist!.map((c, j) => (j === i ? { ...c, done: e.target.checked } : c));
                            toggleCheck.mutate({ id: o.id, checklist: next });
                          }} className="h-3.5 w-3.5" />
                          <span className={cn(item.done && 'text-muted-foreground line-through')}>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {o.resultJson?.divergent != null && (
                    <div className="rounded-md border border-amber-400/30 bg-amber-500/5 p-2 text-amber-700 dark:text-amber-300">
                      Qualificação Cadastral: {o.resultJson.divergent} divergência(s) em {o.resultJson.checked ?? o.resultJson.generatedRows ?? '—'} colaborador(es).
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {Array.isArray(o.attachments) && o.attachments.map((a, i) => (
                      <Badge key={i} variant="outline" className="gap-1 text-[10px]"><Paperclip className="h-3 w-3" /> {a.name}</Badge>
                    ))}
                    {canOperate && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const name = prompt('Nome do comprovante (guia/DARF/protocolo):'); if (name) attach.mutate({ id: o.id, name }); }}>
                        <Paperclip className="mr-1 h-3 w-3" /> Anexar comprovante
                      </Button>
                    )}
                    {canOperate && o.kind === 'QUALIF_CADASTRAL' && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const content = prompt('Cole o CSV de retorno da Qualificação Cadastral:'); if (content) importReturn.mutate({ id: o.id, content }); }}>
                        <Upload className="mr-1 h-3 w-3" /> Importar retorno
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
