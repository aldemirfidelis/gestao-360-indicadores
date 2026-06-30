'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import {
  Clock,
  AlertTriangle,
  TrendingUp,
  Search,
  ShieldAlert,
  Sliders,
  BellRing,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlaPolicy {
  id: string;
  name: string;
  module: string;
  limitLabel: string;
  active: boolean;
  escalationSteps: string[];
  activeCount: number;
}

interface EscalationEvent {
  id: string;
  workflowName: string;
  taskTitle: string;
  responsibleName: string;
  dueAt: string;
  overdueDays: number;
  level: number;
  status: 'PENDING' | 'ESCALATED' | 'RESOLVED';
}

interface EscalationsPayload {
  events: EscalationEvent[];
  metrics: { onTimeRate: number | null; activeAlarms: number; level2plus: number; policiesCount: number };
}

export default function SlaMonitoringPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', module: '', limitLabel: '', steps: '' });

  const policiesQ = useQuery<SlaPolicy[]>({ queryKey: ['automations', 'sla-policies'], queryFn: () => api('/automations/sla-policies') });
  const escQ = useQuery<EscalationsPayload>({ queryKey: ['automations', 'escalations'], queryFn: () => api('/automations/escalations') });

  const createPolicy = useMutation({
    mutationFn: (body: any) => api('/automations/sla-policies', { method: 'POST', json: body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['automations', 'sla-policies'] });
      setCreateOpen(false);
      setForm({ name: '', module: '', limitLabel: '', steps: '' });
      toast.success('Política de SLA criada');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao criar política'),
  });
  const deletePolicy = useMutation({
    mutationFn: (id: string) => api(`/automations/sla-policies/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['automations', 'sla-policies'] }); toast.success('Política removida'); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao remover política'),
  });
  const extendDeadline = useMutation({
    mutationFn: (taskId: string) => api(`/automations/escalations/${taskId}/extend`, { method: 'POST', json: { days: 3 } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['automations', 'escalations'] });
      setSelectedEventId(null);
      toast.success('Prazo prorrogado em 3 dias');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao prorrogar prazo'),
  });

  const policies = policiesQ.data ?? [];
  const events = escQ.data?.events ?? [];
  const metrics = escQ.data?.metrics;

  const filteredEvents = events.filter(
    (e) =>
      e.workflowName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.taskTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.responsibleName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function submitPolicy() {
    if (!form.name.trim() || !form.module.trim() || !form.limitLabel.trim()) {
      toast.error('Preencha nome, módulo e prazo.');
      return;
    }
    createPolicy.mutate({
      name: form.name,
      module: form.module,
      limitLabel: form.limitLabel,
      escalationSteps: form.steps.split('\n').map((s) => s.trim()).filter(Boolean),
    });
  }

  return (
    <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
      <PageHeader
        eyebrow="Central de Automações"
        title="Prazos & SLAs de Processo"
        description="Monitore prazos de resposta corporativos, o cumprimento de SLAs e os níveis de escalonamento ativos para desvios e planos de ação."
      />

      {/* SLA Metric Cards (dados reais) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <MetricCard
          title="Taxa de SLA no Prazo"
          value={metrics?.onTimeRate != null ? `${metrics.onTimeRate}%` : '—'}
          description="Tarefas de fluxo concluídas dentro do prazo"
          icon={<TrendingUp className="h-4 w-4" />}
          tone="green"
        />
        <MetricCard
          title="Alarmes de Atraso Ativos"
          value={metrics?.activeAlarms ?? 0}
          description="Tarefas com prazo estourado aguardando ação"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="yellow"
        />
        <MetricCard
          title="Escalonamentos Nível 2+"
          value={metrics?.level2plus ?? 0}
          description="Casos graves com notificação à gerência"
          icon={<ShieldAlert className="h-4 w-4" />}
          tone="red"
        />
        <MetricCard
          title="Processos Monitorados"
          value={metrics?.policiesCount ?? policies.filter((p) => p.active).length}
          description="Políticas de prazo ativas"
          icon={<Clock className="h-4 w-4" />}
          tone="blue"
        />
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-6 min-h-0 w-full overflow-hidden">
        {/* Left Side: SLA Policies & Incidents */}
        <div className="flex flex-col min-h-0 gap-6 overflow-y-auto pr-1">
          {/* SLA Policies */}
          <SectionCard
            title="Políticas de SLA Cadastradas"
            description="Prazos máximos configurados para cada tipo de fluxo de trabalho."
            actions={
              <Button size="sm" className="h-8 text-xs" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Nova política
              </Button>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {policiesQ.isPending ? (
                [0, 1].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl border bg-muted/30" />)
              ) : policies.length === 0 ? (
                <div className="md:col-span-2 flex flex-col items-center justify-center py-10 text-xs text-muted-foreground border border-dashed rounded-xl">
                  <Sliders className="h-7 w-7 opacity-40 mb-2" />
                  Nenhuma política de SLA cadastrada. Crie a primeira para começar a monitorar prazos.
                </div>
              ) : (
                policies.map((policy) => (
                  <div key={policy.id} className="p-4 border rounded-xl bg-card space-y-3 group relative">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded">
                        {policy.module}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-primary">{policy.limitLabel}</span>
                        <button
                          type="button"
                          title="Remover política"
                          onClick={() => deletePolicy.mutate(policy.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-foreground">{policy.name}</h4>
                        {policy.activeCount > 0 && (
                          <span className="text-[9px] font-bold text-status-red bg-status-red/10 px-1.5 py-0.5 rounded shrink-0">
                            {policy.activeCount} em atraso
                          </span>
                        )}
                      </div>
                      {policy.escalationSteps.length > 0 && (
                        <div className="mt-2.5 space-y-1">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">
                            Fluxo de Escalonamento:
                          </span>
                          {policy.escalationSteps.map((step, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span className="h-1.5 w-1.5 bg-primary rounded-full" />
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          {/* Active Escalations List */}
          <div className="flex flex-col min-h-0 border bg-card rounded-xl overflow-hidden">
            <div className="p-4 border-b bg-muted/10 flex items-center justify-between gap-4 shrink-0">
              <div>
                <h3 className="text-xs font-bold text-foreground">Incidentes de SLAs Vencidos</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Tarefas de fluxo com prazos estourados.</p>
              </div>

              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar incidentes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div className="divide-y overflow-y-auto">
              {escQ.isPending ? (
                <div className="p-4 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/30" />)}</div>
              ) : filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-xs text-muted-foreground">
                  <Clock className="h-7 w-7 opacity-40 mb-2" />
                  {events.length === 0 ? 'Nenhuma tarefa de fluxo com prazo estourado. SLAs em dia!' : 'Nenhum incidente corresponde à busca.'}
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className={cn(
                      'p-4 hover:bg-muted/10 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden',
                      selectedEventId === event.id && 'bg-primary/5 border-l-2 border-primary'
                    )}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">
                          ID: {event.id.slice(0, 8)}
                        </span>
                        <span
                          className={cn(
                            'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                            event.status === 'ESCALATED' && 'bg-status-red/10 text-status-red',
                            event.status === 'PENDING' && 'bg-status-yellow/10 text-status-yellow',
                            event.status === 'RESOLVED' && 'bg-status-green/10 text-status-green'
                          )}
                        >
                          {event.status === 'ESCALATED' ? `Escalado Nível ${event.level}` : 'Pendente de Alerta'}
                        </span>
                        <span className="text-[10px] text-destructive font-semibold">
                          Atraso: {event.overdueDays}d
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-foreground truncate">{event.taskTitle}</h4>
                      <p className="text-[10px] text-muted-foreground truncate">
                        Fluxo de trabalho: {event.workflowName} • Responsável: {event.responsibleName}
                      </p>
                    </div>

                    <div className="text-[10px] text-muted-foreground shrink-0 text-right">
                      <span className="block font-medium">Venceu em:</span>
                      <span className="block">{new Date(event.dueAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Incident Details Context */}
        <div className="flex flex-col min-h-0 border bg-card rounded-xl overflow-hidden">
          {selectedEventId ? (
            (() => {
              const ev = events.find((e) => e.id === selectedEventId);
              if (!ev) return null;
              return (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="p-4 border-b bg-muted/10 shrink-0 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4 text-status-red" />
                        Inspecionar SLA Extrapolado
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Ref ID: {ev.id.slice(0, 8)}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Event Stats */}
                    <div className="space-y-2 border p-3 rounded-lg bg-muted/15">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Tarefa:</span>
                        <span className="font-semibold text-foreground text-right truncate ml-2">{ev.taskTitle}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Responsável Principal:</span>
                        <span className="font-semibold text-foreground">{ev.responsibleName}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Nível de Alarme Atual:</span>
                        <span className="font-bold text-status-red">Grau {ev.level}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Dias de Atraso Acumulados:</span>
                        <span className="font-semibold text-destructive">{ev.overdueDays} dias</span>
                      </div>
                    </div>

                    {/* Escalonamento details */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Situação do Escalonamento
                      </label>
                      <div className="border rounded-lg p-3 bg-destructive/5 border-destructive/15 space-y-2 text-[11px] text-foreground">
                        <div className="flex items-start gap-2">
                          <BellRing className="h-4 w-4 text-status-red mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold block text-destructive">
                              {ev.level > 0 ? `Tarefa escalada ao nível ${ev.level}` : 'Tarefa pendente de escalonamento'}
                            </span>
                            <span className="text-muted-foreground leading-relaxed mt-1 block">
                              A tarefa está {ev.overdueDays} dia(s) em atraso. Prorrogue o prazo ou abra a tarefa para tratá-la
                              junto ao responsável.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ações reais de SLA */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Ações de SLA
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px]"
                          disabled={extendDeadline.isPending}
                          onClick={() => extendDeadline.mutate(ev.id)}
                        >
                          Prorrogar +3 dias
                        </Button>
                        <Button size="sm" className="h-8 text-[11px] bg-primary" onClick={() => router.push('/central-automacoes/tarefas')}>
                          Abrir tarefa
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-xs text-muted-foreground">
              <Sliders className="h-8 w-8 opacity-40 mb-2" />
              Selecione um incidente de SLA vencido para inspecionar os canais de escalonamento.
            </div>
          )}
        </div>
      </div>

      {/* Dialog: nova política de SLA */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova política de SLA</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex.: Tratativa de Indicador Desviado" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Módulo</Label>
                <Input value={form.module} onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))} placeholder="Ex.: INDICATORS, DOCUMENTS" />
              </div>
              <div className="space-y-1">
                <Label>Prazo (rótulo)</Label>
                <Input value={form.limitLabel} onChange={(e) => setForm((f) => ({ ...f, limitLabel: e.target.value }))} placeholder="Ex.: 5 dias úteis" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Passos de escalonamento (um por linha)</Label>
              <Textarea
                rows={4}
                value={form.steps}
                onChange={(e) => setForm((f) => ({ ...f, steps: e.target.value }))}
                placeholder={'Alerta por e-mail para responsável\nEscalar para o gestor do setor (+2 dias)\nAlerta crítico para diretor (+5 dias)'}
              />
              <p className="text-[10px] text-muted-foreground">
                O módulo deve corresponder ao módulo dos fluxos para que os incidentes em atraso sejam contabilizados aqui.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={submitPolicy} disabled={createPolicy.isPending}>
              {createPolicy.isPending ? 'Salvando…' : 'Criar política'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
