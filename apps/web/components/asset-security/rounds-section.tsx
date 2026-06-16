'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Circle, MapPin, Play, Plus, Route } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { EmptyState } from '@/components/platform/empty-state';
import { StatusBadge } from '@/components/platform/status-badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ROUND_STATUS_LABELS, labelFor, statusTone } from '@/lib/asset-security/labels';
import { formatDateTime } from '@/lib/asset-security/format';
import type { AnyRecord } from '@/lib/asset-security/types';

type Opt = Array<{ value: string; label: string }>;

interface CheckpointDraft {
  name: string;
  location?: string;
  requiredEvidence?: boolean;
}

export function RoundsSection({ gates, users, canRounds }: { gates: Opt; users: Opt; canRounds: boolean }) {
  const qc = useQueryClient();
  const routes = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'round-routes'], queryFn: () => api('/asset-security/round-routes') });
  const executions = useQuery<AnyRecord[]>({ queryKey: ['asset-security', 'round-executions'], queryFn: () => api('/asset-security/round-executions?take=200') });
  const [routeDialog, setRouteDialog] = useState<AnyRecord | 'new' | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);

  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['asset-security', 'round-routes'] }); void qc.invalidateQueries({ queryKey: ['asset-security', 'round-executions'] }); void qc.invalidateQueries({ queryKey: ['asset-security', 'summary'] }); };

  const start = useMutation({
    mutationFn: (routeId: string) => api('/asset-security/round-executions', { method: 'POST', json: { routeId, startNow: true } }),
    onSuccess: (data: any) => { toast.success('Ronda iniciada'); invalidate(); setExecutionId(data?.id ?? null); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao iniciar ronda'),
  });

  const routeList = routes.data ?? [];
  const execList = executions.data ?? [];
  const openExecution = execList.find((e) => e.id === executionId) ?? null;
  const openExecutionRoute = openExecution ? routeList.find((r) => r.id === openExecution.routeId) ?? null : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <SectionCard
        title={`Rotas de ronda (${routeList.length})`}
        description="Roteiros e pontos de controle (checkpoints)."
        contentClassName="p-0"
        actions={canRounds && <Button size="sm" onClick={() => setRouteDialog('new')}><Plus className="mr-2 h-4 w-4" />Nova rota</Button>}
      >
        {routes.isPending ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : routeList.length === 0 ? (
          <EmptyState title="Nenhuma rota" description="Crie uma rota e adicione pontos de controle." className="border-0" />
        ) : (
          <div className="divide-y">
            {routeList.map((route) => (
              <div key={route.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Route className="h-4 w-4 text-muted-foreground" />{route.name}
                    <StatusBadge value={route.status} label={labelFor(route.status)} tone={statusTone(route.status)} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {(route.checkpoints ?? []).length} ponto(s){route.frequencyMinutes ? ` · a cada ${route.frequencyMinutes} min` : ''}
                  </div>
                </div>
                {canRounds && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setRouteDialog(route)}>Pontos</Button>
                    <Button size="sm" variant="outline" disabled={start.isPending} onClick={() => start.mutate(route.id)}><Play className="mr-1 h-3.5 w-3.5" />Iniciar</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title={`Execuções recentes (${execList.length})`} description="Acompanhamento das rondas realizadas." contentClassName="p-0">
        {executions.isPending ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : execList.length === 0 ? (
          <EmptyState title="Nenhuma ronda executada" className="border-0" />
        ) : (
          <div className="divide-y">
            {execList.map((ex) => {
              const route = routeList.find((r) => r.id === ex.routeId);
              return (
                <button key={ex.id} type="button" onClick={() => setExecutionId(ex.id)} className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-muted/40">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{route?.name ?? 'Rota'}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(ex.startedAt ?? ex.scheduledAt)} · {(ex.visitedCheckpointIds ?? []).length} visitado(s){(ex.missedCheckpointIds ?? []).length ? ` · ${(ex.missedCheckpointIds ?? []).length} pendente(s)` : ''}
                    </div>
                  </div>
                  <StatusBadge value={ex.status} label={labelFor(ex.status, ROUND_STATUS_LABELS)} tone={statusTone(ex.status)} />
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>

      {routeDialog && (
        <RouteBuilderDialog
          route={routeDialog === 'new' ? null : routeDialog}
          gates={gates}
          users={users}
          onClose={() => setRouteDialog(null)}
          onSaved={() => { invalidate(); setRouteDialog(null); }}
          onCheckpointAdded={invalidate}
        />
      )}

      {openExecution && (
        <ExecutionPanelDialog
          execution={openExecution}
          route={openExecutionRoute}
          canRounds={canRounds}
          onClose={() => setExecutionId(null)}
          onChanged={invalidate}
        />
      )}
    </div>
  );
}

function RouteBuilderDialog({
  route,
  gates,
  users,
  onClose,
  onSaved,
  onCheckpointAdded,
}: {
  route: AnyRecord | null;
  gates: Opt;
  users: Opt;
  onClose: () => void;
  onSaved: () => void;
  onCheckpointAdded: () => void;
}) {
  const editing = Boolean(route?.id);
  const [form, setForm] = useState<AnyRecord>(() => ({
    name: route?.name ?? '',
    code: route?.code ?? '',
    gateId: route?.gateId ?? '',
    responsibleUserId: route?.responsibleUserId ?? '',
    frequencyMinutes: route?.frequencyMinutes ?? '',
    toleranceMinutes: route?.toleranceMinutes ?? '',
    instructions: route?.instructions ?? '',
  }));
  const [drafts, setDrafts] = useState<CheckpointDraft[]>([]);
  const [newCp, setNewCp] = useState<CheckpointDraft>({ name: '', location: '', requiredEvidence: false });

  function buildPayload() {
    return {
      name: form.name,
      code: form.code || null,
      gateId: form.gateId || null,
      responsibleUserId: form.responsibleUserId || null,
      frequencyMinutes: form.frequencyMinutes === '' ? null : Number(form.frequencyMinutes),
      toleranceMinutes: form.toleranceMinutes === '' ? null : Number(form.toleranceMinutes),
      instructions: form.instructions || null,
    };
  }

  const saveRoute = useMutation({
    mutationFn: () =>
      editing
        ? api(`/asset-security/round-routes/${route!.id}`, { method: 'PATCH', json: buildPayload() })
        : api('/asset-security/round-routes', { method: 'POST', json: { ...buildPayload(), checkpoints: drafts.map((d, i) => ({ name: d.name, location: d.location || null, requiredEvidence: Boolean(d.requiredEvidence), position: i + 1 })) } }),
    onSuccess: () => { toast.success(editing ? 'Rota atualizada' : 'Rota criada'); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar rota'),
  });

  const addCheckpoint = useMutation({
    mutationFn: (cp: CheckpointDraft) => api(`/asset-security/round-routes/${route!.id}/checkpoints`, { method: 'POST', json: { name: cp.name, location: cp.location || null, requiredEvidence: Boolean(cp.requiredEvidence) } }),
    onSuccess: () => { toast.success('Ponto adicionado'); setNewCp({ name: '', location: '', requiredEvidence: false }); onCheckpointAdded(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao adicionar ponto'),
  });

  const existing = (route?.checkpoints ?? []) as AnyRecord[];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Editar rota e pontos' : 'Nova rota de ronda'}</DialogTitle></DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><Label className="field-required">Nome</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></div>
          <div><Label>Portaria</Label><NativeSelect value={form.gateId} onChange={(e) => setForm((f) => ({ ...f, gateId: e.target.value }))}><option value="">—</option>{gates.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</NativeSelect></div>
          <div><Label>Responsável</Label><NativeSelect value={form.responsibleUserId} onChange={(e) => setForm((f) => ({ ...f, responsibleUserId: e.target.value }))}><option value="">—</option>{users.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}</NativeSelect></div>
          <div><Label>Frequência (min)</Label><Input type="number" value={form.frequencyMinutes} onChange={(e) => setForm((f) => ({ ...f, frequencyMinutes: e.target.value }))} /></div>
          <div><Label>Tolerância (min)</Label><Input type="number" value={form.toleranceMinutes} onChange={(e) => setForm((f) => ({ ...f, toleranceMinutes: e.target.value }))} /></div>
          <div className="md:col-span-2"><Label>Instruções</Label><Textarea rows={2} value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} /></div>
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-2 text-[13px] font-semibold uppercase tracking-[0.06em]">Pontos de controle</div>
          {editing ? (
            existing.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum ponto cadastrado.</p> : (
              <ol className="mb-3 space-y-1">
                {existing.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((cp, i) => (
                  <li key={cp.id} className="flex items-center gap-2 text-sm">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[11px]">{i + 1}</span>
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{cp.name}</span>
                    {cp.location && <span className="text-xs text-muted-foreground">· {cp.location}</span>}
                    {cp.requiredEvidence && <span className="text-xs text-status-yellow">· evidência</span>}
                  </li>
                ))}
              </ol>
            )
          ) : (
            drafts.length === 0 ? <p className="mb-3 text-sm text-muted-foreground">Adicione os pontos abaixo (salvos junto com a rota).</p> : (
              <ol className="mb-3 space-y-1">
                {drafts.map((cp, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[11px]">{i + 1}</span><MapPin className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium">{cp.name}</span>{cp.location && <span className="text-xs text-muted-foreground">· {cp.location}</span>}</span>
                    <Button size="sm" variant="ghost" onClick={() => setDrafts((d) => d.filter((_, idx) => idx !== i))}>Remover</Button>
                  </li>
                ))}
              </ol>
            )
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="grow"><Label>Nome do ponto</Label><Input value={newCp.name} placeholder="Ex.: Doca 2" onChange={(e) => setNewCp((c) => ({ ...c, name: e.target.value }))} /></div>
            <div className="grow"><Label>Local</Label><Input value={newCp.location} onChange={(e) => setNewCp((c) => ({ ...c, location: e.target.value }))} /></div>
            <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(newCp.requiredEvidence)} onChange={(e) => setNewCp((c) => ({ ...c, requiredEvidence: e.target.checked }))} />Evidência</label>
            <Button
              size="sm"
              variant="outline"
              disabled={!newCp.name.trim() || (editing && addCheckpoint.isPending)}
              onClick={() => {
                if (!newCp.name.trim()) return;
                if (editing) addCheckpoint.mutate(newCp);
                else { setDrafts((d) => [...d, newCp]); setNewCp({ name: '', location: '', requiredEvidence: false }); }
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />Adicionar ponto
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={!form.name.trim() || saveRoute.isPending} onClick={() => saveRoute.mutate()}>{saveRoute.isPending ? 'Salvando…' : 'Salvar rota'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExecutionPanelDialog({
  execution,
  route,
  canRounds,
  onClose,
  onChanged,
}: {
  execution: AnyRecord;
  route: AnyRecord | null;
  canRounds: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const visited = useMemo(() => new Set<string>(execution.visitedCheckpointIds ?? []), [execution.visitedCheckpointIds]);
  const checkpoints = ((route?.checkpoints ?? []) as AnyRecord[]).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const finished = ['DONE', 'MISSED', 'CANCELLED'].includes(execution.status);

  const visit = useMutation({
    mutationFn: (checkpointId: string) => api(`/asset-security/round-executions/${execution.id}/visit`, { method: 'POST', json: { checkpointId } }),
    onSuccess: () => { toast.success('Ponto registrado'); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao registrar ponto'),
  });
  const finish = useMutation({
    mutationFn: () => api(`/asset-security/round-executions/${execution.id}/finish`, { method: 'POST', json: {} }),
    onSuccess: () => { toast.success('Ronda finalizada'); onChanged(); onClose(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao finalizar'),
  });

  const visitedCount = checkpoints.filter((c) => visited.has(c.id)).length;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{route?.name ?? 'Ronda'}</span>
            <StatusBadge value={execution.status} label={labelFor(execution.status, ROUND_STATUS_LABELS)} tone={statusTone(execution.status)} />
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Início {formatDateTime(execution.startedAt ?? execution.scheduledAt)} · {visitedCount}/{checkpoints.length} pontos visitados
        </p>

        {checkpoints.length === 0 ? (
          <EmptyState title="Rota sem pontos" description="Adicione pontos de controle à rota para registrar a ronda." />
        ) : (
          <ul className="divide-y rounded-md border">
            {checkpoints.map((cp, i) => {
              const done = visited.has(cp.id);
              return (
                <li key={cp.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-status-green" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0">
                      <div className={cn('truncate text-sm font-medium', done && 'text-muted-foreground')}>{i + 1}. {cp.name}</div>
                      {cp.location && <div className="truncate text-xs text-muted-foreground">{cp.location}</div>}
                    </div>
                  </div>
                  {!finished && canRounds && !done && (
                    <Button size="sm" variant="outline" disabled={visit.isPending} onClick={() => visit.mutate(cp.id)}>Registrar</Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {!finished && canRounds && <Button disabled={finish.isPending} onClick={() => finish.mutate()}>{finish.isPending ? 'Finalizando…' : 'Finalizar ronda'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
