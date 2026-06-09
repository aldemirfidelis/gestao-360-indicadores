'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, CalendarDays, Lock, Unlock, ListChecks, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface ProgramRef { id: string; code: string; name: string }
interface Competence {
  id: string; programId: string; year: number; month: number; label: string; status: string;
  closedAt: string | null; program: ProgramRef;
}
interface ChecklistItem { key: string; label: string; status: 'OK' | 'PENDING' | 'NOT_APPLICABLE'; blocking: boolean; detail?: string }
interface Checklist { competenceId: string; blockingPending: number; warnings: number; items: ChecklistItem[] }

const STATUS: Record<string, { label: string; variant: any; locked?: boolean }> = {
  PLANNED: { label: 'Planejada', variant: 'secondary' },
  OPEN: { label: 'Aberta', variant: 'default' },
  FILLING: { label: 'Em preenchimento', variant: 'default' },
  IN_VALIDATION: { label: 'Em validação', variant: 'default' },
  PRE_CLOSE: { label: 'Pré-fechamento', variant: 'default' },
  CLOSED_FOR_CALC: { label: 'Fechada p/ cálculo', variant: 'outline', locked: true },
  IN_CALCULATION: { label: 'Em apuração', variant: 'outline', locked: true },
  IN_REVIEW: { label: 'Em conferência', variant: 'outline', locked: true },
  IN_APPROVAL: { label: 'Em aprovação', variant: 'outline', locked: true },
  APPROVED: { label: 'Aprovada', variant: 'outline', locked: true },
  SENT_TO_PAYROLL: { label: 'Enviada à folha', variant: 'outline', locked: true },
  PAYSLIPS_PUBLISHED: { label: 'Espelhos publicados', variant: 'outline', locked: true },
  CLOSED: { label: 'Encerrada', variant: 'outline', locked: true },
};
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function PrizeCompetencesPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['prize:competences:manage']);
  const canClose = hasPermission(['prize:competences:close']);
  const canReopen = hasPermission(['prize:competences:reopen']);

  const [programFilter, setProgramFilter] = useState('');
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({ programId: '', year: now.getFullYear(), month: now.getMonth() + 1 });
  const [checklistFor, setChecklistFor] = useState<Competence | null>(null);

  const { data: programs = [] } = useQuery({ queryKey: ['prize-programs-ref'], queryFn: () => api<any[]>('/prize/programs') });
  const { data: competences = [], isLoading } = useQuery({
    queryKey: ['prize-competences', programFilter],
    queryFn: () => api<Competence[]>(`/prize/competences${programFilter ? `?programId=${programFilter}` : ''}`),
  });
  const { data: checklist } = useQuery({
    queryKey: ['prize-checklist', checklistFor?.id],
    queryFn: () => api<Checklist>(`/prize/competences/${checklistFor!.id}/checklist`),
    enabled: !!checklistFor,
  });

  const create = useMutation({
    mutationFn: () => api('/prize/competences', { method: 'POST', json: form }),
    onSuccess: () => { toast.success('Competência criada'); qc.invalidateQueries({ queryKey: ['prize-competences'] }); setOpen(false); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/prize/competences/${id}/status`, { method: 'PATCH', json: { status } }),
    onSuccess: () => { toast.success('Status atualizado'); qc.invalidateQueries({ queryKey: ['prize-competences'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const close = useMutation({
    mutationFn: (id: string) => api(`/prize/competences/${id}/close`, { method: 'POST' }),
    onSuccess: () => { toast.success('Competência fechada para cálculo'); qc.invalidateQueries({ queryKey: ['prize-competences'] }); setChecklistFor(null); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const reopen = useMutation({
    mutationFn: ({ id, justification }: { id: string; justification: string }) => api(`/prize/competences/${id}/reopen`, { method: 'POST', json: { justification } }),
    onSuccess: () => { toast.success('Competência reaberta'); qc.invalidateQueries({ queryKey: ['prize-competences'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  function handleReopen(c: Competence) {
    const justification = window.prompt('Justificativa para reabertura (obrigatória):');
    if (justification?.trim()) reopen.mutate({ id: c.id, justification });
  }

  const StatusIcon = ({ s }: { s: ChecklistItem['status'] }) =>
    s === 'OK' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
    s === 'PENDING' ? <XCircle className="h-4 w-4 text-amber-600" /> :
    <MinusCircle className="h-4 w-4 text-muted-foreground" />;

  return (
    <div>
      <PageHeader
        title="Competências"
        eyebrow="Gestão de Prêmio"
        description="Ciclo mensal do prêmio: planejamento, validação, checklist e fechamento controlado."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Competências' }]}
        actions={canManage ? <Button onClick={() => { setForm({ ...form, programId: programFilter || programs[0]?.id || '' }); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />Nova competência</Button> : undefined}
      />

      <div className="mb-4 flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Programa:</Label>
        <NativeSelect value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="max-w-xs">
          <option value="">Todos</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </NativeSelect>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : competences.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhuma competência cadastrada.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {competences.map((c) => {
            const st = STATUS[c.status] ?? { label: c.status, variant: 'secondary' };
            return (
              <Card key={c.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">{MONTHS[c.month - 1]}/{c.year}</span>
                        {st.locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{c.program.code} — {c.program.name}</p>
                    </div>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setChecklistFor(c)}><ListChecks className="mr-1 h-3.5 w-3.5" />Checklist</Button>
                    {canManage && !st.locked && c.status !== 'PLANNED' && (
                      <Button size="sm" variant="ghost" onClick={() => transition.mutate({ id: c.id, status: 'IN_VALIDATION' })}>Validar</Button>
                    )}
                    {canManage && c.status === 'PLANNED' && (
                      <Button size="sm" variant="ghost" onClick={() => transition.mutate({ id: c.id, status: 'FILLING' })}>Abrir</Button>
                    )}
                    {canClose && !st.locked && (
                      <Button size="sm" variant="outline" onClick={() => close.mutate(c.id)}><Lock className="mr-1 h-3.5 w-3.5" />Fechar</Button>
                    )}
                    {canReopen && st.locked && (
                      <Button size="sm" variant="outline" onClick={() => handleReopen(c)}><Unlock className="mr-1 h-3.5 w-3.5" />Reabrir</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova competência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Programa *</Label>
              <NativeSelect value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
                <option value="">Selecione…</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ano *</Label><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} /></div>
              <div><Label>Mês *</Label>
                <NativeSelect value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </NativeSelect>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.programId}>{create.isPending ? 'Criando…' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checklist dialog */}
      <Dialog open={!!checklistFor} onOpenChange={(o) => !o && setChecklistFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Checklist de fechamento — {checklistFor && `${MONTHS[checklistFor.month - 1]}/${checklistFor.year}`}</DialogTitle></DialogHeader>
          {!checklist ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-3 text-xs">
                <span className="text-amber-600">{checklist.blockingPending} pendência(s) impeditiva(s)</span>
                <span className="text-muted-foreground">{checklist.warnings} alerta(s)</span>
              </div>
              <ul className="divide-y divide-border/60">
                {checklist.items.map((it) => (
                  <li key={it.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <StatusIcon s={it.status} />
                      <span>{it.label}{it.blocking && it.status === 'PENDING' && <span className="ml-1 text-xs text-amber-600">(impeditiva)</span>}</span>
                    </span>
                    {it.detail && <span className="shrink-0 text-xs text-muted-foreground">{it.detail}</span>}
                  </li>
                ))}
              </ul>
              {canClose && checklistFor && !STATUS[checklistFor.status]?.locked && (
                <div className="pt-2">
                  <Button className="w-full" disabled={checklist.blockingPending > 0 || close.isPending} onClick={() => close.mutate(checklistFor.id)}>
                    <Lock className="mr-1 h-4 w-4" />{checklist.blockingPending > 0 ? 'Resolva as pendências para fechar' : 'Fechar competência para cálculo'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
