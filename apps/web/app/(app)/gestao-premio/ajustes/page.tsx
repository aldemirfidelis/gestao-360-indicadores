'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { SlidersHorizontal, Plus, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface CompetenceRef { id: string; label: string; program: { code: string; name: string } }
interface Adjustment { id: string; registration: string; field: string; amount: string | null; reason: string; status: string }
interface Exception { id: string; registration: string | null; type: string; avgMonths: number | null; gratificationValue: string | null; reason: string; status: string }
interface Allocation { id: string; registration: string; originArea: string | null; destArea: string | null; destPosition: string | null; days: number; ruleApplied: string | null; hasRight: boolean }
interface Moderator {
  id: string; name: string; eventType: string; criterion: string | null; reductionPercent: string | null;
  reductionValue: string | null; cap: string | null; cumulative: boolean; priority: number; active: boolean;
}

const ADJ_STATUS: Record<string, any> = { REQUESTED: 'secondary', APPROVED: 'default', REJECTED: 'destructive', APPLIED: 'default', CANCELLED: 'outline' };
const EXC_TYPE: Record<string, string> = { IMPOSSIBILITY: 'Impossibilidade de apuração', TRAINING: 'Treinamento', TERMINATION: 'Desligamento', OTHER: 'Outra' };
const MOD_EVENT_TYPES = ['FALTA', 'ATESTADO', 'MEDIDA_DISCIPLINAR', 'SUSPENSAO', 'ACIDENTE'];
const MOD_EVENT_LABEL: Record<string, string> = { FALTA: 'Falta', ATESTADO: 'Atestado', MEDIDA_DISCIPLINAR: 'Medida disciplinar', SUSPENSAO: 'Suspensão', ACIDENTE: 'Acidente (ato inseguro)' };
const MOD_CRITERIA: Record<string, string> = { ANY: 'Por ocorrência', PER_DAY: 'Por dia', PER_OCCURRENCE: 'Por evento', PER_DAY_AFTER_FIRST: 'Por dia (1ª ocorrência abonada)' };
const emptyModForm = { name: '', eventType: 'FALTA', criterion: 'PER_DAY', reductionPercent: '', reductionValue: '', cap: '', cumulative: true, priority: 0, active: true };

export default function PrizeAdjustmentsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['prize:adjustments:manage']);
  const canApprove = hasPermission(['prize:adjustments:approve']);
  const canAdmin = hasPermission(['prize:admin']);

  const [competenceId, setCompetenceId] = useState('');
  const [tab, setTab] = useState('adjustments');
  const [dialog, setDialog] = useState<null | 'adj' | 'exc' | 'alloc' | 'mod'>(null);
  const [adjForm, setAdjForm] = useState({ registration: '', field: 'FINAL_VALUE', amount: '', reason: '' });
  const [excForm, setExcForm] = useState({ type: 'IMPOSSIBILITY', registration: '', avgMonths: 6, gratificationValue: '', reason: '' });
  const [allocForm, setAllocForm] = useState({ registration: '', originArea: '', destArea: '', destPosition: '', days: 0, ruleApplied: 'APPLY_DEST', hasRight: true, reason: '' });
  const [editingMod, setEditingMod] = useState<Moderator | null>(null);
  const [modForm, setModForm] = useState(emptyModForm);

  const { data: competences = [] } = useQuery({ queryKey: ['prize-competences-ref'], queryFn: () => api<CompetenceRef[]>('/prize/competences') });
  const { data: adjustments = [] } = useQuery({ queryKey: ['prize-adj', competenceId], queryFn: () => api<Adjustment[]>(`/prize/calc/competence/${competenceId}/adjustments`), enabled: !!competenceId });
  const { data: exceptions = [] } = useQuery({ queryKey: ['prize-exc', competenceId], queryFn: () => api<Exception[]>(`/prize/calc/competence/${competenceId}/exceptions`), enabled: !!competenceId });
  const { data: allocations = [] } = useQuery({ queryKey: ['prize-alloc', competenceId], queryFn: () => api<Allocation[]>(`/prize/calc/competence/${competenceId}/allocations`), enabled: !!competenceId });
  // Regras de moderador valem para a empresa toda (não dependem de competência).
  const { data: moderators = [] } = useQuery({ queryKey: ['prize-moderators'], queryFn: () => api<Moderator[]>('/prize/calc/moderators') });

  const inval = (k: string) => qc.invalidateQueries({ queryKey: [k] });
  const onErr = (e: ApiError) => toast.error(e.message);

  const createAdj = useMutation({ mutationFn: () => api(`/prize/calc/competence/${competenceId}/adjustments`, { method: 'POST', json: { ...adjForm, amount: adjForm.amount ? Number(adjForm.amount) : null } }), onSuccess: () => { toast.success('Ajuste solicitado'); inval('prize-adj'); setDialog(null); }, onError: onErr });
  const decideAdj = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: string }) => { const comment = decision === 'REJECT' ? (window.prompt('Comentário:') ?? '') : undefined; return api(`/prize/calc/adjustments/${id}/decide`, { method: 'PATCH', json: { decision, comment } }); }, onSuccess: () => { toast.success('Decisão registrada'); inval('prize-adj'); }, onError: onErr });
  const createExc = useMutation({ mutationFn: () => api(`/prize/calc/competence/${competenceId}/exceptions`, { method: 'POST', json: { ...excForm, registration: excForm.registration || null, gratificationValue: excForm.gratificationValue ? Number(excForm.gratificationValue) : null } }), onSuccess: () => { toast.success('Exceção solicitada'); inval('prize-exc'); setDialog(null); }, onError: onErr });
  const decideExc = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: string }) => api(`/prize/calc/exceptions/${id}/decide`, { method: 'PATCH', json: { decision } }), onSuccess: () => { toast.success('Decisão registrada'); inval('prize-exc'); }, onError: onErr });
  const createAlloc = useMutation({ mutationFn: () => api(`/prize/calc/competence/${competenceId}/allocations`, { method: 'POST', json: { ...allocForm, days: Number(allocForm.days) || 0 } }), onSuccess: () => { toast.success('Transitoriedade registrada'); inval('prize-alloc'); setDialog(null); }, onError: onErr });
  const saveMod = useMutation({
    mutationFn: () => {
      const payload = {
        name: modForm.name, eventType: modForm.eventType, criterion: modForm.criterion,
        reductionPercent: modForm.reductionPercent ? Number(modForm.reductionPercent) : null,
        reductionValue: modForm.reductionValue ? Number(modForm.reductionValue) : null,
        cap: modForm.cap ? Number(modForm.cap) : null, cumulative: modForm.cumulative, priority: Number(modForm.priority) || 0, active: modForm.active,
      };
      return editingMod ? api(`/prize/calc/moderators/${editingMod.id}`, { method: 'PATCH', json: payload }) : api('/prize/calc/moderators', { method: 'POST', json: payload });
    },
    onSuccess: () => { toast.success(editingMod ? 'Regra atualizada' : 'Regra criada'); inval('prize-moderators'); setDialog(null); }, onError: onErr,
  });
  const removeMod = useMutation({ mutationFn: (id: string) => api(`/prize/calc/moderators/${id}`, { method: 'DELETE' }), onSuccess: () => { toast.success('Regra removida'); inval('prize-moderators'); }, onError: onErr });
  const seedMods = useMutation({
    mutationFn: () => api<{ created: number; skipped: number }>('/prize/calc/moderators/seed-defaults', { method: 'POST' }),
    onSuccess: (r) => { toast.success(`Modelo oficial carregado: ${r.created} regra(s) criada(s)${r.skipped ? `, ${r.skipped} já existiam` : ''}`); inval('prize-moderators'); },
    onError: onErr,
  });

  return (
    <div>
      <PageHeader
        title="Ajustes, Exceções e Moderadores"
        eyebrow="Gestão de Prêmio"
        description="Insumos governados do cálculo: ajustes manuais e exceções com aprovação/segregação, alocações temporárias e regras de moderador (perdas individuais)."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Ajustes e Exceções' }]}
      />

      <div className="mb-4 flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Competência:</Label>
        <NativeSelect value={competenceId} onChange={(e) => setCompetenceId(e.target.value)} className="max-w-sm">
          <option value="">Selecione…</option>
          {competences.map((c) => <option key={c.id} value={c.id}>{c.program.code} — {c.label}</option>)}
        </NativeSelect>
      </div>

      {!competenceId && tab !== 'moderators' ? (
        <div className="space-y-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="adjustments">Ajustes</TabsTrigger>
              <TabsTrigger value="exceptions">Exceções</TabsTrigger>
              <TabsTrigger value="allocations">Transitoriedade</TabsTrigger>
              <TabsTrigger value="moderators">Moderadores ({moderators.length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <SlidersHorizontal className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Selecione uma competência (regras de moderador não precisam de competência).</p>
          </CardContent></Card>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="adjustments">Ajustes{competenceId ? ` (${adjustments.length})` : ''}</TabsTrigger>
            <TabsTrigger value="exceptions">Exceções{competenceId ? ` (${exceptions.length})` : ''}</TabsTrigger>
            <TabsTrigger value="allocations">Transitoriedade{competenceId ? ` (${allocations.length})` : ''}</TabsTrigger>
            <TabsTrigger value="moderators">Moderadores ({moderators.length})</TabsTrigger>
          </TabsList>

          {/* AJUSTES */}
          <TabsContent value="adjustments" className="mt-3">
            {canManage && <div className="mb-3"><Button size="sm" onClick={() => setDialog('adj')}><Plus className="mr-1 h-4 w-4" />Novo ajuste</Button></div>}
            <Card><CardContent className="p-0">
              {adjustments.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum ajuste.</p> : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-left">Matrícula</th><th className="px-3 py-2 text-left">Campo</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2 text-left">Motivo</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2"></th></tr></thead>
                  <tbody>{adjustments.map((a) => (
                    <tr key={a.id} className="border-b border-border/40">
                      <td className="px-3 py-2 font-mono text-xs">{a.registration}</td>
                      <td className="px-3 py-2">{a.field}</td>
                      <td className="px-3 py-2 text-right">{a.amount ? Number(a.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{a.reason}</td>
                      <td className="px-3 py-2"><Badge variant={ADJ_STATUS[a.status]}>{a.status}</Badge></td>
                      <td className="px-3 py-2 text-right">{canApprove && a.status === 'REQUESTED' && <>
                        <Button size="sm" variant="ghost" onClick={() => decideAdj.mutate({ id: a.id, decision: 'APPROVE' })}><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => decideAdj.mutate({ id: a.id, decision: 'REJECT' })}><XCircle className="h-3.5 w-3.5 text-red-600" /></Button>
                      </>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* EXCEÇÕES */}
          <TabsContent value="exceptions" className="mt-3">
            {canManage && <div className="mb-3"><Button size="sm" onClick={() => setDialog('exc')}><Plus className="mr-1 h-4 w-4" />Nova exceção</Button></div>}
            <Card><CardContent className="p-0">
              {exceptions.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma exceção.</p> : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2 text-left">Matrícula</th><th className="px-3 py-2 text-left">Parâmetro</th><th className="px-3 py-2 text-left">Motivo</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2"></th></tr></thead>
                  <tbody>{exceptions.map((x) => (
                    <tr key={x.id} className="border-b border-border/40">
                      <td className="px-3 py-2">{EXC_TYPE[x.type] ?? x.type}</td>
                      <td className="px-3 py-2 font-mono text-xs">{x.registration ?? 'todos'}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{x.type === 'IMPOSSIBILITY' ? `média ${x.avgMonths}m` : x.gratificationValue ? `gratif. R$ ${x.gratificationValue}` : '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{x.reason}</td>
                      <td className="px-3 py-2"><Badge variant={ADJ_STATUS[x.status]}>{x.status}</Badge></td>
                      <td className="px-3 py-2 text-right">{canApprove && x.status === 'REQUESTED' && <>
                        <Button size="sm" variant="ghost" onClick={() => decideExc.mutate({ id: x.id, decision: 'APPROVE' })}><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => decideExc.mutate({ id: x.id, decision: 'REJECT' })}><XCircle className="h-3.5 w-3.5 text-red-600" /></Button>
                      </>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* TRANSITORIEDADE */}
          <TabsContent value="allocations" className="mt-3">
            {canManage && <div className="mb-3"><Button size="sm" onClick={() => setDialog('alloc')}><Plus className="mr-1 h-4 w-4" />Nova alocação</Button></div>}
            <Card><CardContent className="p-0">
              {allocations.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma transitoriedade.</p> : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-left">Matrícula</th><th className="px-3 py-2 text-left">Origem→Destino</th><th className="px-3 py-2 text-right">Dias</th><th className="px-3 py-2 text-left">Regra</th><th className="px-3 py-2 text-left">Direito</th></tr></thead>
                  <tbody>{allocations.map((al) => (
                    <tr key={al.id} className="border-b border-border/40">
                      <td className="px-3 py-2 font-mono text-xs">{al.registration}</td>
                      <td className="px-3 py-2">{al.originArea ?? '—'} → {al.destArea ?? '—'}{al.destPosition ? ` (${al.destPosition})` : ''}</td>
                      <td className="px-3 py-2 text-right">{al.days}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{al.ruleApplied}</td>
                      <td className="px-3 py-2">{al.hasRight ? <Badge variant="default">Sim</Badge> : <Badge variant="outline">Não</Badge>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* MODERADORES (regras por empresa — aplicadas pelo motor após o resultado-base) */}
          <TabsContent value="moderators" className="mt-3">
            {canAdmin && (
              <div className="mb-3 flex gap-2">
                <Button size="sm" onClick={() => { setEditingMod(null); setModForm(emptyModForm); setDialog('mod'); }}><Plus className="mr-1 h-4 w-4" />Nova regra</Button>
                <Button size="sm" variant="outline" onClick={() => seedMods.mutate()} disabled={seedMods.isPending}>
                  {seedMods.isPending ? 'Carregando…' : 'Carregar modelo oficial (planilha)'}
                </Button>
              </div>
            )}
            <Card><CardContent className="overflow-x-auto p-0">
              {moderators.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma regra de moderador. Sem regras, o motor não aplica reduções.</p> : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">Regra</th><th className="px-3 py-2 text-left">Evento</th><th className="px-3 py-2 text-left">Critério</th><th className="px-3 py-2 text-right">Redução</th><th className="px-3 py-2 text-right">Teto</th><th className="px-3 py-2 text-left">Cumul.</th><th className="px-3 py-2"></th></tr>
                  </thead>
                  <tbody>
                    {moderators.map((m) => (
                      <tr key={m.id} className="border-b border-border/40">
                        <td className="px-3 py-2 font-medium">{m.name}{!m.active && <Badge variant="outline" className="ml-2">inativa</Badge>}</td>
                        <td className="px-3 py-2">{MOD_EVENT_LABEL[m.eventType] ?? m.eventType}</td>
                        <td className="px-3 py-2 text-muted-foreground">{MOD_CRITERIA[m.criterion ?? 'ANY'] ?? m.criterion}</td>
                        <td className="px-3 py-2 text-right">{m.reductionPercent ? `${m.reductionPercent}%` : m.reductionValue ? `R$ ${m.reductionValue}` : '—'}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{m.cap ? `${m.cap}%` : '—'}</td>
                        <td className="px-3 py-2">{m.cumulative ? 'Sim' : 'Não'}</td>
                        <td className="px-3 py-2 text-right">
                          {canAdmin && <>
                            <Button size="sm" variant="ghost" onClick={() => { setEditingMod(m); setModForm({ name: m.name, eventType: m.eventType, criterion: m.criterion ?? 'PER_DAY', reductionPercent: m.reductionPercent ?? '', reductionValue: m.reductionValue ?? '', cap: m.cap ?? '', cumulative: m.cumulative, priority: m.priority, active: m.active }); setDialog('mod'); }}>Editar</Button>
                            <Button size="sm" variant="ghost" onClick={() => removeMod.mutate(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Dialog Moderador */}
      <Dialog open={dialog === 'mod'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingMod ? 'Editar regra' : 'Nova regra de moderador'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={modForm.name} onChange={(e) => setModForm({ ...modForm, name: e.target.value })} placeholder="Ex.: Falta injustificada" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Evento</Label>
                <NativeSelect value={modForm.eventType} onChange={(e) => setModForm({ ...modForm, eventType: e.target.value })}>
                  {MOD_EVENT_TYPES.map((t) => <option key={t} value={t}>{MOD_EVENT_LABEL[t]}</option>)}
                </NativeSelect>
              </div>
              <div><Label>Critério</Label>
                <NativeSelect value={modForm.criterion} onChange={(e) => setModForm({ ...modForm, criterion: e.target.value })}>
                  {Object.entries(MOD_CRITERIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Redução (%)</Label><Input type="number" value={modForm.reductionPercent} onChange={(e) => setModForm({ ...modForm, reductionPercent: e.target.value })} /></div>
              <div><Label>Redução (R$)</Label><Input type="number" value={modForm.reductionValue} onChange={(e) => setModForm({ ...modForm, reductionValue: e.target.value })} /></div>
              <div><Label>Teto (%)</Label><Input type="number" value={modForm.cap} onChange={(e) => setModForm({ ...modForm, cap: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prioridade</Label><Input type="number" value={modForm.priority} onChange={(e) => setModForm({ ...modForm, priority: Number(e.target.value) })} /></div>
              <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={modForm.cumulative} onChange={(e) => setModForm({ ...modForm, cumulative: e.target.checked })} />Cumulativa</label>
            </div>
            <p className="text-xs text-muted-foreground">Informe % OU valor fixo. O motor aplica a regra para cada evento do colaborador na competência.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={() => saveMod.mutate()} disabled={saveMod.isPending || !modForm.name.trim()}>{saveMod.isPending ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Ajuste */}
      <Dialog open={dialog === 'adj'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo ajuste manual</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Matrícula *</Label><Input value={adjForm.registration} onChange={(e) => setAdjForm({ ...adjForm, registration: e.target.value })} /></div>
              <div><Label>Campo</Label>
                <NativeSelect value={adjForm.field} onChange={(e) => setAdjForm({ ...adjForm, field: e.target.value })}>
                  {['FINAL_VALUE', 'POTENTIAL', 'DAYS', 'AREA', 'POSITION', 'ELIGIBILITY', 'SALARY'].map((f) => <option key={f} value={f}>{f}</option>)}
                </NativeSelect>
              </div>
            </div>
            <div><Label>Valor (R$, quando aplicável)</Label><Input type="number" value={adjForm.amount} onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })} /></div>
            <div><Label>Justificativa *</Label><Textarea rows={2} value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button><Button onClick={() => createAdj.mutate()} disabled={createAdj.isPending || !adjForm.registration || !adjForm.reason.trim()}>Solicitar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Exceção */}
      <Dialog open={dialog === 'exc'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova exceção</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tipo</Label>
              <NativeSelect value={excForm.type} onChange={(e) => setExcForm({ ...excForm, type: e.target.value })}>
                {Object.entries(EXC_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Matrícula (vazio = todos)</Label><Input value={excForm.registration} onChange={(e) => setExcForm({ ...excForm, registration: e.target.value })} /></div>
              {excForm.type === 'IMPOSSIBILITY'
                ? <div><Label>Média (meses)</Label><Input type="number" value={excForm.avgMonths} onChange={(e) => setExcForm({ ...excForm, avgMonths: Number(e.target.value) })} /></div>
                : <div><Label>Gratificação (R$)</Label><Input type="number" value={excForm.gratificationValue} onChange={(e) => setExcForm({ ...excForm, gratificationValue: e.target.value })} /></div>}
            </div>
            <div><Label>Justificativa *</Label><Textarea rows={2} value={excForm.reason} onChange={(e) => setExcForm({ ...excForm, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button><Button onClick={() => createExc.mutate()} disabled={createExc.isPending || !excForm.reason.trim()}>Solicitar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Transitoriedade */}
      <Dialog open={dialog === 'alloc'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova alocação temporária</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Matrícula *</Label><Input value={allocForm.registration} onChange={(e) => setAllocForm({ ...allocForm, registration: e.target.value })} /></div>
              <div><Label>Dias na área destino</Label><Input type="number" value={allocForm.days} onChange={(e) => setAllocForm({ ...allocForm, days: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Área origem</Label><Input value={allocForm.originArea} onChange={(e) => setAllocForm({ ...allocForm, originArea: e.target.value })} /></div>
              <div><Label>Área destino</Label><Input value={allocForm.destArea} onChange={(e) => setAllocForm({ ...allocForm, destArea: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cargo destino</Label><Input value={allocForm.destPosition} onChange={(e) => setAllocForm({ ...allocForm, destPosition: e.target.value })} /></div>
              <div><Label>Regra</Label>
                <NativeSelect value={allocForm.ruleApplied} onChange={(e) => setAllocForm({ ...allocForm, ruleApplied: e.target.value })}>
                  <option value="APPLY_DEST">Aplicar destino</option>
                  <option value="KEEP_ORIGIN">Manter origem</option>
                  <option value="PROPORTIONAL">Proporcional por dias</option>
                </NativeSelect>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allocForm.hasRight} onChange={(e) => setAllocForm({ ...allocForm, hasRight: e.target.checked })} />Tem direito ao prêmio</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button><Button onClick={() => createAlloc.mutate()} disabled={createAlloc.isPending || !allocForm.registration}>Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
