'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Briefcase, CheckCircle2, Megaphone, Plus, Send, ShieldAlert, UserPlus, X } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

interface Requisition {
  id: string; code: string; status: string; vacancyType: string; priority: string;
  openingsRequested: number; orgNodeId: string | null; orgJobId: string | null;
  recruiterId: string | null; confidential: boolean;
  _count?: { openings: number; approvals: number };
}
interface RequisitionDetail extends Requisition {
  requesterId: string; reason: string | null; notes: string | null;
  gateExceptions: Array<{ kind: string; reason: string; at: string }> | null;
  approvals: Array<{ id: string; order: number; role: string; decision: string | null; comment: string | null }>;
  openings: Array<{ id: string; status: string }>;
  snapshots: Array<{ version: number; jobData: any }>;
}
interface Gate { ready: boolean; blocks: string[]; warnings: string[]; exceptionsRequired: string[]; availability: { headcountAvailable: number | null; budgetAvailableCents: number | null } }
interface Options { orgNodes: Array<{ id: string; name: string }>; jobs: Array<{ id: string; name: string }>; users: Array<{ id: string; name: string }> }

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700', SUBMITTED: 'bg-amber-100 text-amber-800', APPROVED: 'bg-sky-100 text-sky-800',
  REJECTED: 'bg-rose-100 text-rose-800', RETURNED: 'bg-orange-100 text-orange-800', FROZEN: 'bg-slate-100 text-slate-500',
  CANCELLED: 'bg-slate-100 text-slate-500', SENT_TO_RECRUITMENT: 'bg-violet-100 text-violet-800', IN_RECRUITMENT: 'bg-indigo-100 text-indigo-800',
  FILLED: 'bg-emerald-100 text-emerald-800', CLOSED: 'bg-slate-100 text-slate-600',
};
const VACANCY_TYPES = ['AUMENTO', 'SUBSTITUICAO', 'TEMPORARIA', 'SAZONAL', 'APRENDIZ', 'ESTAGIO', 'TERCEIRIZACAO', 'CONFIDENCIAL', 'BANCO_TALENTOS'];

const EMPTY = { orgJobId: '', orgNodeId: '', openingsRequested: 1, vacancyType: 'AUMENTO', priority: 'NORMAL', reason: '', recruiterId: '', monthlyBudgetCents: '', confidential: false };

export default function RecruitmentPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['recruit:requisition:create']);
  const canApprove = hasPermission(['recruit:requisition:approve']);
  const canManage = hasPermission(['recruit:manage']);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [detailId, setDetailId] = useState<string | null>(null);

  const listQuery = useQuery<Requisition[]>({ queryKey: ['recruit-requisitions'], queryFn: () => api('/recruitment/requisitions') });
  const optionsQuery = useQuery<Options>({ queryKey: ['personnel-employees', 'options'], queryFn: () => api('/personnel/employees/options'), staleTime: 60_000 });
  const detailQuery = useQuery<RequisitionDetail>({ queryKey: ['recruit-req', detailId], queryFn: () => api(`/recruitment/requisitions/${detailId}`), enabled: Boolean(detailId) });
  const gateQuery = useQuery<Gate>({ queryKey: ['recruit-gate', detailId], queryFn: () => api(`/recruitment/requisitions/${detailId}/gate`), enabled: Boolean(detailId) });

  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['recruit-requisitions'] }); void qc.invalidateQueries({ queryKey: ['recruit-req', detailId] }); void qc.invalidateQueries({ queryKey: ['recruit-gate', detailId] }); };

  const create = useMutation({
    mutationFn: () => api<Requisition>('/recruitment/requisitions', { method: 'POST', json: { ...form, monthlyBudgetCents: form.monthlyBudgetCents ? Math.round(Number(form.monthlyBudgetCents) * 100) : null } }),
    onSuccess: () => { toast.success('Requisição criada.'); setFormOpen(false); setForm({ ...EMPTY }); invalidate(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar.'),
  });
  const act = useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: any }) => api(`/recruitment/requisitions/${id}/${action}`, { method: 'POST', json: body ?? {} }),
    onSuccess: () => { toast.success('Feito.'); invalidate(); },
    onError: (e: any) => toast.error(e.message || 'Erro.'),
  });
  const createPosting = useMutation({
    mutationFn: (id: string) => api<{ id: string }>(`/recruitment/requisitions/${id}/posting`, { method: 'POST' }),
    onSuccess: () => { toast.success('Vaga criada como rascunho. Ajuste o texto e publique.'); setDetailId(null); router.push('/servico-pessoal/recrutamento/vagas'); },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar vaga.'),
  });

  const requisitions = listQuery.data ?? [];
  const options = optionsQuery.data;
  const jobName = (id: string | null) => options?.jobs.find((j) => j.id === id)?.name ?? '—';
  const nodeName = (id: string | null) => options?.orgNodes.find((n) => n.id === id)?.name ?? '—';
  const detail = detailQuery.data;
  const gate = gateQuery.data;
  const money = (c: number | null) => (c == null ? '—' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recrutamento e Seleção"
        description="Requisições de vaga a partir do organograma/Cargos e Salários, com travas de quadro/orçamento e aprovação."
        actions={
          <div className="flex gap-2">
            <Link href="/servico-pessoal/recrutamento/vagas"><Button variant="outline"><Briefcase className="mr-2 h-4 w-4" /> Vagas</Button></Link>
            {canCreate && <Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nova requisição</Button>}
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          {requisitions.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma requisição. Crie a primeira.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <tr><th className="p-3">Código</th><th className="p-3">Cargo / Área</th><th className="p-3">Tipo</th><th className="p-3 text-center">Vagas</th><th className="p-3">Status</th><th className="p-3"></th></tr>
                </thead>
                <tbody className="divide-y">
                  {requisitions.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="p-3 font-mono text-xs">{r.code}</td>
                      <td className="p-3"><div className="font-medium">{jobName(r.orgJobId)}</div><div className="text-[10px] text-muted-foreground">{nodeName(r.orgNodeId)}</div></td>
                      <td className="p-3 text-xs">{r.vacancyType}{r.confidential && <Badge variant="outline" className="ml-1 text-[8px]">confid.</Badge>}</td>
                      <td className="p-3 text-center">{r.openingsRequested}</td>
                      <td className="p-3"><Badge variant="outline" className={cn('text-[10px]', STATUS_TONE[r.status])}>{r.status}</Badge></td>
                      <td className="p-3 text-right"><Button variant="ghost" size="sm" onClick={() => setDetailId(r.id)}>Abrir</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: nova requisição */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader><DialogTitle>Nova requisição de vaga</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Cargo</Label>
              <NativeSelect value={form.orgJobId} onChange={(e) => setForm((f) => ({ ...f, orgJobId: e.target.value }))}>
                <option value="">Selecionar cargo…</option>
                {(options?.jobs ?? []).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </NativeSelect>
            </div>
            <div className="col-span-2"><Label>Área</Label>
              <NativeSelect value={form.orgNodeId} onChange={(e) => setForm((f) => ({ ...f, orgNodeId: e.target.value }))}>
                <option value="">Selecionar área…</option>
                {(options?.orgNodes ?? []).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </NativeSelect>
            </div>
            <div><Label>Tipo</Label>
              <NativeSelect value={form.vacancyType} onChange={(e) => setForm((f) => ({ ...f, vacancyType: e.target.value }))}>
                {VACANCY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </NativeSelect>
            </div>
            <div><Label>Prioridade</Label>
              <NativeSelect value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                {['BAIXA', 'NORMAL', 'ALTA', 'URGENTE'].map((p) => <option key={p} value={p}>{p}</option>)}
              </NativeSelect>
            </div>
            <div><Label>Quantidade de vagas</Label><Input type="number" min={1} value={form.openingsRequested} onChange={(e) => setForm((f) => ({ ...f, openingsRequested: Number(e.target.value) }))} /></div>
            <div><Label>Orçamento mensal (R$)</Label><Input type="number" value={form.monthlyBudgetCents} onChange={(e) => setForm((f) => ({ ...f, monthlyBudgetCents: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Recrutador responsável</Label>
              <NativeSelect value={form.recruiterId} onChange={(e) => setForm((f) => ({ ...f, recruiterId: e.target.value }))}>
                <option value="">Definir depois…</option>
                {(options?.users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </NativeSelect>
            </div>
            <div className="col-span-2"><Label>Motivo / justificativa</Label><Textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></div>
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.confidential} onChange={(e) => setForm((f) => ({ ...f, confidential: e.target.checked }))} /> Vaga confidencial</label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={!form.orgJobId || create.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: detalhe */}
      <Dialog open={Boolean(detailId)} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader><DialogTitle>{detail?.code} — {jobName(detail?.orgJobId ?? null)}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn('text-[10px]', STATUS_TONE[detail.status])}>{detail.status}</Badge>
                <span className="text-muted-foreground">{detail.vacancyType} · {detail.openingsRequested} vaga(s) · {nodeName(detail.orgNodeId)}</span>
              </div>

              {/* Travas / gate */}
              {gate && (
                <div className="rounded-md border p-3 text-xs">
                  <div className="mb-1 flex items-center gap-2 font-semibold">
                    {gate.ready ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    Travas de quadro/orçamento
                  </div>
                  <div className="text-muted-foreground">Saldo de quadro: {gate.availability.headcountAvailable ?? 'não cadastrado'} · Orçamento: {money(gate.availability.budgetAvailableCents)}</div>
                  {gate.blocks.map((b, i) => <div key={i} className="text-rose-600">• {b}</div>)}
                  {gate.warnings.map((w, i) => <div key={i} className="text-amber-600">• {w}</div>)}
                  {gate.exceptionsRequired.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                      <span>Exceções pendentes: {gate.exceptionsRequired.join(', ')}</span>
                      {canApprove && gate.exceptionsRequired.map((k) => (
                        <Button key={k} size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { const reason = prompt(`Justificativa da exceção de ${k}:`); if (reason) act.mutate({ id: detail.id, action: 'gate-exception', body: { kind: k, reason } }); }}>Aprovar {k}</Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Aprovações */}
              <div className="rounded-md border p-3 text-xs">
                <div className="mb-1 font-semibold">Workflow de aprovação</div>
                {detail.approvals.length === 0 ? <div className="text-muted-foreground">Sem passos.</div> : detail.approvals.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-0.5">
                    <span>{a.order}. {a.role}</span>
                    <Badge variant="outline" className={cn('text-[9px]', a.decision === 'APPROVED' ? 'text-emerald-600' : a.decision === 'REJECTED' ? 'text-rose-600' : 'text-muted-foreground')}>{a.decision ?? 'pendente'}</Badge>
                  </div>
                ))}
              </div>

              {/* Ações */}
              <div className="flex flex-wrap gap-2">
                {canCreate && detail.status === 'DRAFT' && <Button size="sm" onClick={() => act.mutate({ id: detail.id, action: 'submit' })}><Send className="mr-1 h-3.5 w-3.5" /> Enviar p/ aprovação</Button>}
                {canApprove && detail.status === 'SUBMITTED' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => act.mutate({ id: detail.id, action: 'decide', body: { decision: 'APPROVED' } })}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aprovar passo</Button>
                    <Button size="sm" variant="outline" onClick={() => { const comment = prompt('Motivo da reprovação:'); act.mutate({ id: detail.id, action: 'decide', body: { decision: 'REJECTED', comment } }); }}><X className="mr-1 h-3.5 w-3.5" /> Reprovar</Button>
                  </>
                )}
                {canApprove && detail.status === 'APPROVED' && <Button size="sm" onClick={() => act.mutate({ id: detail.id, action: 'send-to-recruitment' })}><UserPlus className="mr-1 h-3.5 w-3.5" /> Encaminhar ao recrutamento</Button>}
                {canManage && ['SENT_TO_RECRUITMENT', 'IN_RECRUITMENT'].includes(detail.status) && <Button size="sm" onClick={() => createPosting.mutate(detail.id)} disabled={createPosting.isPending}><Megaphone className="mr-1 h-3.5 w-3.5" /> Criar vaga</Button>}
                {canCreate && !['CANCELLED', 'CLOSED', 'FILLED'].includes(detail.status) && <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => { const reason = prompt('Motivo do cancelamento:'); if (reason) act.mutate({ id: detail.id, action: 'cancel', body: { reason } }); }}>Cancelar</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
