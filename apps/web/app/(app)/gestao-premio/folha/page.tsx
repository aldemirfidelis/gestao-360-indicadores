'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Banknote, Plus, Download, Send, Upload, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api, ApiError, getAccessToken } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface CompetenceRef { id: string; label: string; program: { code: string; name: string } }
interface Batch { id: string; code: string; status: string; rubric: string | null; protocol: string | null; totalItems: number; totalValue: string | null; rejectedCount: number; createdAt: string; _count?: { items: number } }
interface Item { id: string; registration: string; name: string; rubric: string | null; value: string; status: string; blockReason: string | null; returnCode: string | null; returnMessage: string | null }
interface BatchDetail extends Batch { items: Item[] }

const money = (v: string | null) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const BATCH_STATUS: Record<string, any> = { DRAFT: 'secondary', GENERATED: 'default', SENT: 'default', RETURNED: 'default', RECONCILED: 'default', CANCELLED: 'outline' };
const ITEM_STATUS: Record<string, { label: string; variant: any }> = {
  PENDING: { label: 'Pendente', variant: 'secondary' }, SENT: { label: 'Enviado', variant: 'default' },
  ACCEPTED: { label: 'Aceito', variant: 'default' }, REJECTED: { label: 'Rejeitado', variant: 'destructive' }, BLOCKED: { label: 'Bloqueado', variant: 'outline' },
};

export default function PrizePayrollPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['prize:payroll:manage']);

  const [competenceId, setCompetenceId] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnText, setReturnText] = useState('');

  const { data: competences = [] } = useQuery({ queryKey: ['prize-competences-ref'], queryFn: () => api<CompetenceRef[]>('/prize/competences') });
  const { data: batches = [] } = useQuery({ queryKey: ['prize-batches', competenceId], queryFn: () => api<Batch[]>(`/prize/payroll/batches${competenceId ? `?competenceId=${competenceId}` : ''}`) });
  const { data: detail } = useQuery({ queryKey: ['prize-batch', selected], queryFn: () => api<BatchDetail>(`/prize/payroll/batches/${selected}`), enabled: !!selected });

  const inval = () => { qc.invalidateQueries({ queryKey: ['prize-batches'] }); qc.invalidateQueries({ queryKey: ['prize-batch'] }); };
  const onErr = (e: ApiError) => toast.error(e.message);

  const generate = useMutation({
    mutationFn: () => api(`/prize/payroll/competence/${competenceId}/generate`, { method: 'POST', json: {} }),
    onSuccess: (b: any) => { toast.success(`Lote ${b.code} gerado: ${money(String(b.totalValue))}`); inval(); }, onError: onErr,
  });
  const markSent = useMutation({
    mutationFn: (id: string) => { const p = window.prompt('Protocolo de envio (opcional):') ?? undefined; return api(`/prize/payroll/batches/${id}/sent`, { method: 'POST', json: { protocol: p } }); },
    onSuccess: () => { toast.success('Lote marcado como enviado'); inval(); }, onError: onErr,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api(`/prize/payroll/batches/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => { toast.success('Lote cancelado'); inval(); }, onError: onErr,
  });
  const importReturn = useMutation({
    mutationFn: () => {
      // formato: matricula;status;codigo;mensagem (uma linha por colaborador)
      const rows = returnText.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const [registration, status, returnCode, returnMessage] = l.split(/[;,\t]/).map((s) => s?.trim());
        return { registration, status, returnCode: returnCode || undefined, returnMessage: returnMessage || undefined };
      });
      return api(`/prize/payroll/batches/${selected}/return`, { method: 'POST', json: { rows } });
    },
    onSuccess: (r: any) => { toast.success(`Retorno conciliado: ${r.reconciliation.matched} ok, ${r.reconciliation.rejected} rejeitado(s)`); inval(); setReturnOpen(false); setReturnText(''); }, onError: onErr,
  });

  async function downloadCsv(id: string, code: string) {
    const token = getAccessToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
    const res = await fetch(`${apiUrl}/prize/payroll/batches/${id}/export`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!res.ok) { toast.error('Erro ao exportar'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${code}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Integração com a Folha"
        eyebrow="Gestão de Prêmio"
        description="Geração de lote (rubrica/verba) a partir da apuração, exportação, envio com protocolo e conciliação do retorno."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Integração com a Folha' }]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground">Competência:</Label>
        <NativeSelect value={competenceId} onChange={(e) => { setCompetenceId(e.target.value); setSelected(null); }} className="max-w-sm">
          <option value="">Todas</option>
          {competences.map((c) => <option key={c.id} value={c.id}>{c.program.code} — {c.label}</option>)}
        </NativeSelect>
        {canManage && competenceId && <Button className="ml-auto" onClick={() => generate.mutate()} disabled={generate.isPending}><Plus className="mr-1 h-4 w-4" />Gerar lote</Button>}
      </div>

      {batches.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Banknote className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhum lote gerado. Selecione a competência e gere o lote a partir da apuração.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {batches.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="cursor-pointer" onClick={() => setSelected(selected === b.id ? null : b.id)}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium font-mono text-sm">{b.code}</span>
                      <Badge variant={BATCH_STATUS[b.status]}>{b.status}</Badge>
                      {b.rejectedCount > 0 && <Badge variant="destructive">{b.rejectedCount} rejeitado(s)</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{b.totalItems} item(ns) · {money(b.totalValue)}{b.rubric ? ` · rubrica ${b.rubric}` : ''}{b.protocol ? ` · protocolo ${b.protocol}` : ''}</p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => downloadCsv(b.id, b.code)}><Download className="mr-1 h-3.5 w-3.5" />CSV</Button>
                      {(b.status === 'GENERATED') && <Button size="sm" variant="outline" onClick={() => markSent.mutate(b.id)}><Send className="mr-1 h-3.5 w-3.5" />Enviar</Button>}
                      {(b.status === 'SENT') && <Button size="sm" variant="outline" onClick={() => { setSelected(b.id); setReturnOpen(true); }}><Upload className="mr-1 h-3.5 w-3.5" />Importar retorno</Button>}
                      {b.status !== 'CANCELLED' && b.status !== 'RETURNED' && <Button size="sm" variant="ghost" onClick={() => cancel.mutate(b.id)}><XCircle className="h-3.5 w-3.5" /></Button>}
                    </div>
                  )}
                </div>

                {selected === b.id && detail && (
                  <div className="mt-3 overflow-x-auto border-t border-border/60 pt-3">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground"><tr><th className="px-2 py-1 text-left">Matrícula</th><th className="px-2 py-1 text-left">Nome</th><th className="px-2 py-1 text-right">Valor</th><th className="px-2 py-1 text-left">Status</th><th className="px-2 py-1 text-left">Retorno</th></tr></thead>
                      <tbody>
                        {detail.items.map((it) => (
                          <tr key={it.id} className="border-t border-border/40">
                            <td className="px-2 py-1 font-mono text-xs">{it.registration}</td>
                            <td className="px-2 py-1">{it.name}</td>
                            <td className="px-2 py-1 text-right">{money(it.value)}</td>
                            <td className="px-2 py-1"><Badge variant={ITEM_STATUS[it.status]?.variant}>{ITEM_STATUS[it.status]?.label ?? it.status}</Badge>{it.blockReason && <span className="ml-1 text-xs text-muted-foreground">{it.blockReason}</span>}</td>
                            <td className="px-2 py-1 text-xs text-muted-foreground">{it.returnCode ? `${it.returnCode} ${it.returnMessage ?? ''}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Importar retorno da folha</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Cole uma linha por colaborador no formato: <code>matrícula;status;código;mensagem</code> (status REJEITADO/ACCEPTED).</p>
            <Textarea rows={8} value={returnText} onChange={(e) => setReturnText(e.target.value)} placeholder={'1001;ACCEPTED\n1002;REJEITADO;E12;Conta inválida'} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancelar</Button>
            <Button onClick={() => importReturn.mutate()} disabled={importReturn.isPending || !returnText.trim()}>Conciliar retorno</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
