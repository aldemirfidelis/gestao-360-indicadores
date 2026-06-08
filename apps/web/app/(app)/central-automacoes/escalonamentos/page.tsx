'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/platform/metric-card';
import { SectionCard } from '@/components/platform/section-card';
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Search,
  ShieldAlert,
  Sliders,
  BellRing,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlaPolicy {
  id: string;
  name: string;
  module: string;
  limitTime: string;
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

const SLA_POLICIES_MOCK: SlaPolicy[] = [
  {
    id: 'sla-1',
    name: 'Tratativa de Indicador Desviado',
    module: 'INDICADORES',
    limitTime: '5 dias úteis',
    escalationSteps: ['Alerta por e-mail para responsável', 'Escala para Gestor do Setor (+2 dias)', 'Alerta crítico para Diretor (+5 dias)'],
    activeCount: 3,
  },
  {
    id: 'sla-2',
    name: 'Revisão de Documento Vencido',
    module: 'DOCUMENTOS',
    limitTime: '15 dias',
    escalationSteps: ['Notificação no app para revisor', 'Escalar tarefa para Gerente de Qualidade (+5 dias)'],
    activeCount: 1,
  },
  {
    id: 'sla-3',
    name: 'Aprovação de Não Conformidade Crítica',
    module: 'AUDITORIAS',
    limitTime: '24 horas',
    escalationSteps: ['Alerta push para Gestor da Área', 'Remeter aprovação para Comitê Executivo (+12h)'],
    activeCount: 0,
  },
];

const ESCALATION_EVENTS_MOCK: EscalationEvent[] = [
  {
    id: 'esc-1',
    workflowName: 'Indicador fora da meta por dois meses',
    taskTitle: 'Elaborar FCA para Indicador de Faturamento',
    responsibleName: 'Aldemir Fidelis',
    dueAt: '2026-06-03T18:00:00Z',
    overdueDays: 5,
    level: 1,
    status: 'ESCALATED',
  },
  {
    id: 'esc-2',
    workflowName: 'Documento próximo do vencimento',
    taskTitle: 'Aprovar Revisão do POP de Higiene',
    responsibleName: 'Maria Silva',
    dueAt: '2026-06-07T12:00:00Z',
    overdueDays: 1,
    level: 0,
    status: 'PENDING',
  },
  {
    id: 'esc-3',
    workflowName: 'Checklist reprovado',
    taskTitle: 'Investigar bloqueio do lote de fabricação #451',
    responsibleName: 'João Santos',
    dueAt: '2026-05-28T09:00:00Z',
    overdueDays: 11,
    level: 2,
    status: 'ESCALATED',
  },
];

export default function SlaMonitoringPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const filteredEvents = ESCALATION_EVENTS_MOCK.filter(
    (e) =>
      e.workflowName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.taskTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.responsibleName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
      <PageHeader
        eyebrow="Central de Automações"
        title="Prazos & SLAs de Processo"
        description="Monitore prazos de resposta corporativos, o cumprimento de SLAs e os níveis de escalonamento ativos para desvios e planos de ação."
      />

      {/* SLA Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <MetricCard
          title="Taxa de SLA no Prazo"
          value="88.7%"
          description="+1.2% comparado ao mês passado"
          icon={<TrendingUp className="h-4 w-4" />}
          tone="green"
        />
        <MetricCard
          title="Alarmes de Atraso Ativos"
          value={ESCALATION_EVENTS_MOCK.filter(e => e.status !== 'RESOLVED').length}
          description="Aguardando ação remediadora"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="yellow"
        />
        <MetricCard
          title="Escalonamentos Nível 2+"
          value={ESCALATION_EVENTS_MOCK.filter(e => e.level >= 2).length}
          description="Casos graves com notificação à gerência"
          icon={<ShieldAlert className="h-4 w-4" />}
          tone="red"
        />
        <MetricCard
          title="Processos Monitorados"
          value={SLA_POLICIES_MOCK.length}
          description="Políticas de prazo ativas"
          icon={<Clock className="h-4 w-4" />}
          tone="blue"
        />
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-6 min-h-0 w-full overflow-hidden">
        {/* Left Side: SLA Policies & Incidents */}
        <div className="flex flex-col min-h-0 gap-6 overflow-y-auto pr-1">
          {/* SLA Policies */}
          <SectionCard title="Políticas de SLA Cadastradas" description="Prazos máximos configurados para cada tipo de fluxo de trabalho.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {SLA_POLICIES_MOCK.map((policy) => (
                <div key={policy.id} className="p-4 border rounded-xl bg-card space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded">
                      {policy.module}
                    </span>
                    <span className="text-xs font-semibold text-primary">{policy.limitTime}</span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-foreground">{policy.name}</h4>
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
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Active Escalations List */}
          <div className="flex flex-col min-h-0 border bg-card rounded-xl overflow-hidden">
            <div className="p-4 border-b bg-muted/10 flex items-center justify-between gap-4 shrink-0">
              <div>
                <h3 className="text-xs font-bold text-foreground">Incidentes de SLAs Vencidos</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Fila de atividades com prazos estourados.</p>
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
              {filteredEvents.map((event) => (
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
                        ID: {event.id}
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
                      Workflow: {event.workflowName} • Responsável: {event.responsibleName}
                    </p>
                  </div>

                  <div className="text-[10px] text-muted-foreground shrink-0 text-right">
                    <span className="block font-medium">Venceria em:</span>
                    <span className="block">{new Date(event.dueAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Incident Details Context */}
        <div className="flex flex-col min-h-0 border bg-card rounded-xl overflow-hidden">
          {selectedEventId ? (
            (() => {
              const ev = ESCALATION_EVENTS_MOCK.find(e => e.id === selectedEventId);
              if (!ev) return null;
              return (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="p-4 border-b bg-muted/10 shrink-0 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4 text-status-red" />
                        Inspecionar SLA Extrapolado
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Ref ID: {ev.id}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Event Stats */}
                    <div className="space-y-2 border p-3 rounded-lg bg-muted/15">
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
                        Medida de Contingência Disparada
                      </label>
                      <div className="border rounded-lg p-3 bg-destructive/5 border-destructive/15 space-y-2 text-[11px] text-foreground">
                        <div className="flex items-start gap-2">
                          <BellRing className="h-4 w-4 text-status-red mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold block text-destructive">Notificação de Alerta Superior Enviada</span>
                            <span className="text-muted-foreground leading-relaxed mt-1 block">
                              Como a tarefa não foi concluída em {ev.overdueDays} dias, um e-mail de alerta automático contendo o payload e a justificativa foi remetido para a gerência imediata do colaborador.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Simulation parameters */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Ações Manuais de SLA
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-[11px]">
                          Prorrogar Prazo
                        </Button>
                        <Button size="sm" className="h-8 text-[11px] bg-primary">
                          Remanejar Etapa
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
    </div>
  );
}
