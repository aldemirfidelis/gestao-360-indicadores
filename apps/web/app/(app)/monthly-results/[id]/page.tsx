'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileDown,
  Gauge,
  ListChecks,
  Maximize2,
  Play,
  Plus,
  Presentation,
  RefreshCw,
  Route,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/shell/page-header';
import { useAuth } from '@/components/auth/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn, formatDate, formatPercent, periodRefLabel } from '@/lib/utils';
import {
  ENTRY_KIND_LABEL,
  FOLLOWUP_LEVEL_LABEL,
  ITEM_STATUS_LABEL,
  LIGHT_COLORS,
  LIGHT_LABEL,
  LIGHT_STYLES,
  READINESS_STYLES,
  STANDARDIZATION_TYPES,
  STATUS_STYLES,
  formatValue,
  type AgendaItem,
  type DecisionEntry,
  type Light,
  type MeetingArea,
  type MeetingDetail,
  type MonthlyOptions,
  type SnapshotIndicator,
} from '../shared';
import { exportAtaPdf, exportAcoesXlsx, exportFarolXlsx, exportResumoPdf } from '../exports';

export default function MeetingWorkspace() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const can = {
    update: hasPermission(['monthly:update', 'monthly:manage']),
    prepare: hasPermission(['monthly:prepare', 'monthly:update', 'monthly:manage']),
    validate: hasPermission(['monthly:validate', 'monthly:manage']),
    present: hasPermission(['monthly:present', 'monthly:update', 'monthly:manage']),
    decide: hasPermission(['monthly:decide', 'monthly:update', 'monthly:manage']),
  };

  const meetingQuery = useQuery<MeetingDetail>({
    queryKey: ['monthly-meeting', id],
    queryFn: () => api<MeetingDetail>(`/monthly-results/meetings/${id}`),
    enabled: Boolean(id),
  });
  const optionsQuery = useQuery<MonthlyOptions>({ queryKey: ['monthly-options'], queryFn: () => api<MonthlyOptions>('/monthly-results/options') });

  const meeting = meetingQuery.data;
  const options = optionsQuery.data;

  const write = useMutation({
    mutationFn: (args: { url: string; method?: string; json?: unknown }) =>
      api<MeetingDetail>(args.url, { method: args.method ?? 'POST', json: args.json }),
    onSuccess: (data) => qc.setQueryData(['monthly-meeting', id], data),
    onError: (error: Error) => toast.error(error.message),
  });
  const run = (url: string, method: string | undefined, json: unknown, ok?: string) =>
    write.mutate({ url, method, json }, { onSuccess: () => ok && toast.success(ok) });

  if (meetingQuery.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando reunião…</div>;
  }
  if (meetingQuery.isError || !meeting) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-red-700">{(meetingQuery.error as Error)?.message ?? 'Reunião não encontrada.'}</p>
        <Button variant="outline" onClick={() => router.push('/monthly-results')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={meeting.title}
        description={`${periodRefLabel(meeting.periodRef)} · ${formatDate(meeting.startsAt)}${meeting.location ? ` · ${meeting.location}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/monthly-results">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Link>
            </Button>
            <Badge variant="outline" className={cn(STATUS_STYLES[meeting.status])}>
              {meeting.statusLabel}
            </Badge>
            <StatusActions meeting={meeting} can={can} run={run} pending={write.isPending} />
          </div>
        }
      />

      <Tabs defaultValue="preparar" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="preparar"><ListChecks className="mr-2 h-4 w-4" />Preparar</TabsTrigger>
          <TabsTrigger value="conduzir"><Presentation className="mr-2 h-4 w-4" />Conduzir</TabsTrigger>
          <TabsTrigger value="registrar"><ClipboardList className="mr-2 h-4 w-4" />Registrar</TabsTrigger>
          <TabsTrigger value="acompanhar"><Route className="mr-2 h-4 w-4" />Acompanhar</TabsTrigger>
          <TabsTrigger value="farol"><Gauge className="mr-2 h-4 w-4" />Farol</TabsTrigger>
          <TabsTrigger value="config"><RefreshCw className="mr-2 h-4 w-4" />Configurar</TabsTrigger>
        </TabsList>

        <TabsContent value="preparar" className="space-y-4">
          <PrepareTab meeting={meeting} options={options} can={can} run={run} pending={write.isPending} />
        </TabsContent>
        <TabsContent value="conduzir" className="space-y-4">
          <ConductTab meeting={meeting} options={options} can={can} run={run} />
        </TabsContent>
        <TabsContent value="registrar" className="space-y-4">
          <RegisterTab meeting={meeting} options={options} can={can} run={run} />
        </TabsContent>
        <TabsContent value="acompanhar" className="space-y-4">
          <FollowTab meeting={meeting} options={options} can={can} run={run} />
        </TabsContent>
        <TabsContent value="farol" className="space-y-4">
          <FarolTab meeting={meeting} />
        </TabsContent>
        <TabsContent value="config" className="space-y-4">
          <ConfigTab meeting={meeting} options={options} can={can} run={run} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Can = { update: boolean; prepare: boolean; validate: boolean; present: boolean; decide: boolean };
type Run = (url: string, method: string | undefined, json: unknown, ok?: string) => void;

function StatusActions({ meeting, can, run, pending }: { meeting: MeetingDetail; can: Can; run: Run; pending: boolean }) {
  if (!can.present && !can.update) return null;
  const change = (status: string, ok: string) => run(`/monthly-results/meetings/${meeting.id}/status`, 'POST', { status }, ok);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {meeting.status === 'PREPARING' && (
        <Button size="sm" disabled={pending} onClick={() => change('READY', 'Reunião liberada')}>
          <CheckCircle2 className="mr-2 h-4 w-4" /> Liberar para reunião
        </Button>
      )}
      {meeting.status === 'READY' && (
        <Button size="sm" disabled={pending} onClick={() => change('IN_PROGRESS', 'Reunião iniciada')}>
          <Play className="mr-2 h-4 w-4" /> Iniciar reunião
        </Button>
      )}
      {meeting.status === 'IN_PROGRESS' && (
        <Button size="sm" disabled={pending} onClick={() => change('CLOSED', 'Reunião encerrada')}>
          <Square className="mr-2 h-4 w-4" /> Encerrar e gerar ata
        </Button>
      )}
      {(meeting.status === 'CLOSED' || meeting.status === 'CANCELLED') && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => change('REOPENED', 'Reunião reaberta')}>
          <RefreshCw className="mr-2 h-4 w-4" /> Reabrir
        </Button>
      )}
      {meeting.status === 'REOPENED' && (
        <Button size="sm" disabled={pending} onClick={() => change('IN_PROGRESS', 'Reunião retomada')}>
          <Play className="mr-2 h-4 w-4" /> Retomar
        </Button>
      )}
    </div>
  );
}

// =====================================================================
// PREPARAR
// =====================================================================

function PrepareTab({ meeting, options, can, run, pending }: { meeting: MeetingDetail; options?: MonthlyOptions; can: Can; run: Run; pending: boolean }) {
  const [selectedAreaId, setSelectedAreaId] = useState(meeting.areas[0]?.id ?? '');
  const selectedArea = meeting.areas.find((a) => a.id === selectedAreaId) ?? meeting.areas[0] ?? null;

  return (
    <div className="space-y-4">
      <AreaReadinessTable meeting={meeting} can={can} run={run} pending={pending} onSelect={setSelectedAreaId} selectedId={selectedArea?.id ?? ''} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_0.8fr]">
        {selectedArea ? (
          <AreaPreparation meeting={meeting} area={selectedArea} options={options} can={can} run={run} pending={pending} />
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Nenhuma área nesta reunião.</CardContent>
          </Card>
        )}
        <div className="space-y-4">
          <ChecklistCard meeting={meeting} can={can} run={run} />
          <AgendaCard meeting={meeting} options={options} can={can} run={run} />
        </div>
      </div>
    </div>
  );
}

function AreaReadinessTable({ meeting, can, run, pending, onSelect, selectedId }: { meeting: MeetingDetail; can: Can; run: Run; pending: boolean; onSelect: (id: string) => void; selectedId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prontidão por área</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3">Área</th>
              <th className="py-2 pr-3">Apresentador</th>
              <th className="py-2 pr-3">Farol</th>
              <th className="py-2 pr-3">Pendências</th>
              <th className="py-2 pr-3">Prontidão</th>
              <th className="py-2 pr-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {meeting.areas.map((area) => (
              <tr key={area.id} className={cn('border-b last:border-0', area.id === selectedId && 'bg-muted/40')}>
                <td className="max-w-64 py-2.5 pr-3">
                  <button className="text-left font-medium hover:underline" onClick={() => onSelect(area.id)}>
                    <span className="break-words">{area.name}</span>
                  </button>
                </td>
                <td className="py-2.5 pr-3 text-muted-foreground">{area.presenter?.name ?? '—'}</td>
                <td className="py-2.5 pr-3">
                  <div className="flex flex-wrap gap-1">
                    <Counter light="GREEN" value={area.green} />
                    <Counter light="YELLOW" value={area.yellow} />
                    <Counter light="RED" value={area.red} />
                    <Counter light="GRAY" value={area.gray} />
                  </div>
                </td>
                <td className="py-2.5 pr-3">{area.blockingIssues.length || '—'}</td>
                <td className="py-2.5 pr-3">
                  <Badge variant="outline" className={cn('whitespace-normal', READINESS_STYLES[area.readiness])}>
                    {area.readinessLabel}
                  </Badge>
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex flex-wrap gap-1">
                    {can.prepare && (
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(`/monthly-results/areas/${area.id}/seed`, 'POST', {}, 'Indicadores atualizados')}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {can.validate && area.readiness !== 'VALIDATED' && area.readiness !== 'RELEASED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending || !area.canValidate}
                        title={area.canValidate ? 'Validar área' : 'Resolva as pendências bloqueadoras'}
                        onClick={() => run(`/monthly-results/areas/${area.id}`, 'PATCH', { readiness: 'VALIDATED' }, 'Área validada')}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Validar
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function AreaPreparation({ meeting, area, options, can, run, pending }: { meeting: MeetingDetail; area: MeetingArea; options?: MonthlyOptions; can: Can; run: Run; pending: boolean }) {
  const [actionFor, setActionFor] = useState<SnapshotIndicator | null>(null);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="min-w-0 break-words">Preparação · {area.name}</CardTitle>
        <Badge variant="outline" className={cn(READINESS_STYLES[area.readiness])}>{area.readinessLabel}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {area.blockingIssues.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-medium">Pendências que bloqueiam a validação:</p>
            <ul className="mt-1 list-disc pl-4">
              {area.blockingIssues.slice(0, 6).map((b, idx) => (
                <li key={idx}>{b.issue}</li>
              ))}
            </ul>
          </div>
        )}
        {area.indicators.length === 0 && <p className="text-sm text-muted-foreground">Sem indicadores. Use o botão atualizar para puxar os indicadores da área.</p>}
        {area.indicators.map((ind) => (
          <SnapshotRow key={ind.id} ind={ind} can={can} run={run} pending={pending} onCreateAction={() => setActionFor(ind)} />
        ))}
      </CardContent>
      {actionFor && (
        <ActionDialog
          meeting={meeting}
          options={options}
          snapshot={actionFor}
          areaNodeId={area.orgNodeId}
          onClose={() => setActionFor(null)}
          run={run}
        />
      )}
    </Card>
  );
}

function SnapshotRow({ ind, can, run, pending, onCreateAction }: { ind: SnapshotIndicator; can: Can; run: Run; pending: boolean; onCreateAction: () => void }) {
  const [comment, setComment] = useState(ind.managerComment ?? '');
  const [trend, setTrend] = useState(ind.trendNote ?? '');
  const dirty = comment !== (ind.managerComment ?? '') || trend !== (ind.trendNote ?? '');
  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold">{ind.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Real: {formatValue(ind.current, ind.unitLabel)}</span>
            <span>Meta: {formatValue(ind.target, ind.unitLabel)}</span>
            <span>Ating.: {formatPercent(ind.attainment)}</span>
            {ind.trend && <span>Tend.: {ind.trend}</span>}
          </div>
        </div>
        <Badge variant="outline" className={cn('shrink-0', LIGHT_STYLES[ind.light])}>{LIGHT_LABEL[ind.light]}</Badge>
      </div>

      {ind.blockingIssues.length > 0 && <p className="mt-2 text-xs font-medium text-amber-700">{ind.blockingIssues.join(' · ')}</p>}

      {can.prepare && (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <Textarea rows={2} placeholder="Comentário do gestor" value={comment} onChange={(e) => setComment(e.target.value)} className="text-xs" />
          <Textarea rows={2} placeholder="Tendência / risco" value={trend} onChange={(e) => setTrend(e.target.value)} className="text-xs" />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {can.prepare && dirty && (
          <Button size="sm" disabled={pending} onClick={() => run(`/monthly-results/meeting-indicators/${ind.id}`, 'PATCH', { managerComment: comment, trendNote: trend }, 'Salvo')}>
            Salvar
          </Button>
        )}
        {can.prepare && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={ind.showInPresentation}
              onChange={(e) => run(`/monthly-results/meeting-indicators/${ind.id}`, 'PATCH', { showInPresentation: e.target.checked }, undefined)}
            />
            Exibir na reunião
          </label>
        )}
        <Button size="sm" variant="outline" asChild>
          <Link href={ind.links.indicator}>Ficha</Link>
        </Button>
        {ind.links.deviation ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={ind.links.deviation}>Causa raiz</Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/deviations?indicatorId=${ind.indicatorId}`}>Abrir desvio</Link>
          </Button>
        )}
        {ind.links.action ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={ind.links.action}>Plano de ação</Link>
          </Button>
        ) : (
          can.decide && (
            <Button size="sm" variant="outline" onClick={onCreateAction}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Criar ação
            </Button>
          )
        )}
      </div>
    </div>
  );
}

function ChecklistCard({ meeting, can, run }: { meeting: MeetingDetail; can: Can; run: Run }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Checklist de preparação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {meeting.checklist.map((item) => (
          <label key={item.id} className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={item.done}
              disabled={!can.prepare}
              onChange={(e) => run(`/monthly-results/checklist/${item.id}`, 'PATCH', { done: e.target.checked }, undefined)}
            />
            <span className={cn('break-words', item.done && 'text-muted-foreground line-through')}>{item.label}</span>
          </label>
        ))}
        {meeting.checklist.length === 0 && <p className="text-sm text-muted-foreground">Sem itens de checklist.</p>}
      </CardContent>
    </Card>
  );
}

function AgendaCard({ meeting, options, can, run }: { meeting: MeetingDetail; options?: MonthlyOptions; can: Can; run: Run }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Roteiro da reunião</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {meeting.agendaItems.map((item, index) => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
              <div className="min-w-0">
                <p className="min-w-0 break-words text-sm font-medium">{item.topic}</p>
                {item.presenter && <p className="text-xs text-muted-foreground">{item.presenter.name}</p>}
              </div>
            </div>
            {can.update ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  defaultValue={item.plannedMinutes}
                  className="h-8 w-16"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v !== item.plannedMinutes) run(`/monthly-results/agenda/${item.id}`, 'PATCH', { plannedMinutes: v }, undefined);
                  }}
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            ) : (
              <Badge variant="secondary" className="shrink-0">{item.plannedMinutes} min</Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// =====================================================================
// CONDUZIR (apresentação)
// =====================================================================

function ConductTab({ meeting, options, can, run }: { meeting: MeetingDetail; options?: MonthlyOptions; can: Can; run: Run }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [areaIdx, setAreaIdx] = useState(0);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const area = meeting.areas[areaIdx] ?? null;
  const agendaForArea = meeting.agendaItems.find((a) => a.orgNodeId === area?.orgNodeId) ?? null;

  async function toggleFullscreen() {
    const node = containerRef.current;
    if (!node) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await node.requestFullscreen().catch(() => null);
  }

  const presentIndicators = (area?.indicators ?? []).filter((i) => i.showInPresentation);

  return (
    <div ref={containerRef} className="space-y-4 bg-background p-0 fullscreen:overflow-auto fullscreen:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAreaIdx((i) => Math.max(0, i - 1))} disabled={areaIdx === 0}>
            Anterior
          </Button>
          <NativeSelect value={String(areaIdx)} onChange={(e) => setAreaIdx(Number(e.target.value))} className="h-9 w-56">
            {meeting.areas.map((a, idx) => (
              <option key={a.id} value={idx}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
          <Button variant="outline" size="sm" onClick={() => setAreaIdx((i) => Math.min(meeting.areas.length - 1, i + 1))} disabled={areaIdx >= meeting.areas.length - 1}>
            Próxima
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {agendaForArea && can.present && <Timer item={agendaForArea} run={run} />}
          {can.decide && (
            <Button variant="outline" size="sm" onClick={() => setDecisionOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Registrar decisão
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            <Maximize2 className="mr-2 h-4 w-4" /> Tela cheia
          </Button>
        </div>
      </div>

      {!area ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Nenhuma área para apresentar.</CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">{area.name}</h2>
              {area.areaKeyMessage && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{area.areaKeyMessage}</p>}
            </div>
            <div className="flex gap-2">
              <Counter light="GREEN" value={area.green} />
              <Counter light="YELLOW" value={area.yellow} />
              <Counter light="RED" value={area.red} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {presentIndicators.map((ind) => (
              <PresentationCard key={ind.id} ind={ind} />
            ))}
            {presentIndicators.length === 0 && <p className="text-sm text-muted-foreground">Nenhum indicador marcado para exibição nesta área.</p>}
          </div>

          <ResultVsTarget indicators={presentIndicators.filter((i) => i.light === 'RED' || i.light === 'YELLOW').slice(0, 6)} />
        </>
      )}

      {decisionOpen && <DecisionDialog meeting={meeting} options={options} area={area} onClose={() => setDecisionOpen(false)} run={run} />}
    </div>
  );
}

function Timer({ item, run }: { item: AgendaItem; run: Run }) {
  const presenting = item.presentationStatus === 'PRESENTING' && Boolean(item.startedAt);
  const [, force] = useState(0);
  useEffect(() => {
    if (!presenting) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [presenting]);
  const elapsed = presenting && item.startedAt ? Math.floor((Date.now() - new Date(item.startedAt).getTime()) / 1000) : (item.actualMinutes ?? 0) * 60;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const over = elapsed > item.plannedMinutes * 60;
  return (
    <div className="flex items-center gap-2">
      <span className={cn('font-mono text-sm tabular-nums', over ? 'text-red-600' : 'text-foreground')}>
        {mm}:{ss} / {item.plannedMinutes}min
      </span>
      {presenting ? (
        <Button size="sm" variant="outline" onClick={() => run(`/monthly-results/agenda/${item.id}/timer`, 'POST', { action: 'stop' }, undefined)}>
          <Square className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => run(`/monthly-results/agenda/${item.id}/timer`, 'POST', { action: 'start' }, undefined)}>
          <Clock3 className="mr-1 h-3.5 w-3.5" /> Iniciar
        </Button>
      )}
    </div>
  );
}

function PresentationCard({ ind }: { ind: SnapshotIndicator }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 break-words text-base font-semibold">{ind.name}</p>
        <span className={cn('h-3 w-3 shrink-0 rounded-full')} style={{ background: LIGHT_COLORS[ind.light] }} />
      </div>
      <div className="mt-3 flex items-end gap-3">
        <span className="text-3xl font-bold tabular-nums">{formatValue(ind.current, ind.unitLabel)}</span>
        <span className="pb-1 text-sm text-muted-foreground">meta {formatValue(ind.target, ind.unitLabel)}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{ind.executiveStatus ?? LIGHT_LABEL[ind.light]} · Atingimento {formatPercent(ind.attainment)}</p>
      {(ind.managerComment || ind.rootCause) && <p className="mt-2 line-clamp-3 break-words text-xs text-muted-foreground">{ind.managerComment ?? ind.rootCause}</p>}
      {ind.actionTitle && <p className="mt-2 text-xs"><span className="font-medium">Ação:</span> {ind.actionTitle}</p>}
    </div>
  );
}

function ResultVsTarget({ indicators }: { indicators: SnapshotIndicator[] }) {
  if (!indicators.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resultado x meta (críticos)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {indicators.map((ind) => {
            const data = [
              { name: 'Realizado', value: ind.current ?? 0, color: LIGHT_COLORS[ind.light] },
              { name: 'Meta', value: ind.target ?? 0, color: '#64748b' },
            ];
            return (
              <div key={ind.id} className="rounded-md border p-3">
                <p className="mb-2 break-words text-sm font-medium">{ind.name}</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => formatValue(Number(value), ind.unitLabel)} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {data.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================================
// REGISTRAR (ata, decisões, padronização, aprendizado)
// =====================================================================

function RegisterTab({ meeting, options, can, run }: { meeting: MeetingDetail; options?: MonthlyOptions; can: Can; run: Run }) {
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [summary, setSummary] = useState('');
  const ai = useMutation({
    mutationFn: (kind: 'minutes' | 'executive-summary') => api<{ minutes?: string; summary?: string }>(`/monthly-results/meetings/${meeting.id}/ai/${kind}`, { method: 'POST' }),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Decisões, riscos e escalonamentos</CardTitle>
            {can.decide && (
              <Button size="sm" onClick={() => setDecisionOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Novo
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {meeting.decisions.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>}
            {meeting.decisions.map((d) => (
              <DecisionRow key={d.id} d={d} can={can} run={run} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ata integrada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!meeting.ai.enabled || ai.isPending} onClick={() => ai.mutate('minutes', { onSuccess: (d) => setMinutes(d.minutes ?? '') })}>
                <Sparkles className="mr-2 h-4 w-4" /> Gerar ata (IA)
              </Button>
              <Button size="sm" variant="outline" disabled={!meeting.ai.enabled || ai.isPending} onClick={() => ai.mutate('executive-summary', { onSuccess: (d) => setSummary(d.summary ?? '') })}>
                <Sparkles className="mr-2 h-4 w-4" /> Resumo executivo (IA)
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportAtaPdf(meeting)}>
                <FileDown className="mr-2 h-4 w-4" /> Ata PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportResumoPdf(meeting, summary)}>
                <FileDown className="mr-2 h-4 w-4" /> Resumo PDF
              </Button>
            </div>
            <Textarea rows={8} value={minutes} placeholder="A ata gerada pela IA aparece aqui (editável). A exportação usa os registros da reunião." onChange={(e) => setMinutes(e.target.value)} />
            {summary && <div className="rounded-md border bg-muted/30 p-3 text-sm"><p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Resumo executivo</p>{summary}</div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StandardizationCard meeting={meeting} options={options} can={can} run={run} />
        <LearningCard meeting={meeting} options={options} can={can} run={run} />
      </div>

      {decisionOpen && <DecisionDialog meeting={meeting} options={options} area={null} onClose={() => setDecisionOpen(false)} run={run} />}
    </div>
  );
}

function DecisionRow({ d, can, run }: { d: DecisionEntry; can: Can; run: Run }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{ENTRY_KIND_LABEL[d.kind] ?? d.kind}</Badge>
            {d.topic && <span className="text-xs font-medium">{d.topic}</span>}
          </div>
          <p className="mt-1 break-words text-sm">{d.description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {d.owner && <span>{d.owner}</span>}
            {d.dueDate && <span>· prazo {formatDate(d.dueDate)}</span>}
            {d.action && <Link href={`/actions/${d.action.id}`} className="text-primary hover:underline">· ação vinculada</Link>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {can.decide && (
            <NativeSelect value={d.status} className="h-8 w-36" onChange={(e) => run(`/monthly-results/decisions/${d.id}`, 'PATCH', { status: e.target.value }, undefined)}>
              {Object.entries(ITEM_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          )}
          {can.decide && (
            <Button size="sm" variant="ghost" onClick={() => run(`/monthly-results/decisions/${d.id}`, 'DELETE', undefined, 'Removido')}>
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StandardizationCard({ meeting, options, can, run }: { meeting: MeetingDetail; options?: MonthlyOptions; can: Can; run: Run }) {
  const [type, setType] = useState('POP');
  const [description, setDescription] = useState('');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Padronização e boas práticas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {can.update && (
          <div className="space-y-2 rounded-md border p-3">
            <NativeSelect value={type} onChange={(e) => setType(e.target.value)}>
              {STANDARDIZATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
            <Textarea rows={2} placeholder="O que será padronizado / replicado" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Button
              size="sm"
              disabled={!description.trim()}
              onClick={() => {
                run(`/monthly-results/meetings/${meeting.id}/standardizations`, 'POST', { type, description }, 'Padronização registrada');
                setDescription('');
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Adicionar
            </Button>
          </div>
        )}
        {meeting.standardizations.map((s) => (
          <div key={s.id} className="flex items-start justify-between gap-2 rounded-md border p-2.5 text-sm">
            <div className="min-w-0">
              <Badge variant="secondary" className="mb-1">{STANDARDIZATION_TYPES.find((t) => t.value === s.type)?.label ?? s.type}</Badge>
              <p className="break-words">{s.description}</p>
            </div>
            {can.update && (
              <Button size="sm" variant="ghost" onClick={() => run(`/monthly-results/standardizations/${s.id}`, 'DELETE', undefined, 'Removido')}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        ))}
        {meeting.standardizations.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma padronização registrada.</p>}
      </CardContent>
    </Card>
  );
}

function LearningCard({ meeting, options, can, run }: { meeting: MeetingDetail; options?: MonthlyOptions; can: Can; run: Run }) {
  const [learning, setLearning] = useState('');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aprendizados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {can.update && (
          <div className="space-y-2 rounded-md border p-3">
            <Textarea rows={2} placeholder="Aprendizado da reunião" value={learning} onChange={(e) => setLearning(e.target.value)} />
            <Button
              size="sm"
              disabled={!learning.trim()}
              onClick={() => {
                run(`/monthly-results/meetings/${meeting.id}/learnings`, 'POST', { learning }, 'Aprendizado registrado');
                setLearning('');
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Adicionar
            </Button>
          </div>
        )}
        {meeting.learnings.map((l) => (
          <div key={l.id} className="flex items-start justify-between gap-2 rounded-md border p-2.5 text-sm">
            <p className="min-w-0 break-words">{l.learning}</p>
            {can.update && (
              <Button size="sm" variant="ghost" onClick={() => run(`/monthly-results/learnings/${l.id}`, 'DELETE', undefined, 'Removido')}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        ))}
        {meeting.learnings.length === 0 && <p className="text-sm text-muted-foreground">Nenhum aprendizado registrado.</p>}
      </CardContent>
    </Card>
  );
}

// =====================================================================
// ACOMPANHAR (semanal)
// =====================================================================

function FollowTab({ meeting, options, can, run }: { meeting: MeetingDetail; options?: MonthlyOptions; can: Can; run: Run }) {
  const [level, setLevel] = useState('WEEKLY');
  const [title, setTitle] = useState('');
  const levels = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'];
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.7fr]">
      <Card>
        <CardHeader>
          <CardTitle>Acompanhamento da rotina</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {can.update && (
            <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
              <div className="flex-1">
                <Label className="text-xs">Item</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: cobrar plano de ação X" />
              </div>
              <NativeSelect value={level} onChange={(e) => setLevel(e.target.value)} className="w-40">
                {levels.map((lv) => (
                  <option key={lv} value={lv}>
                    {FOLLOWUP_LEVEL_LABEL[lv]}
                  </option>
                ))}
              </NativeSelect>
              <Button
                disabled={!title.trim()}
                onClick={() => {
                  run(`/monthly-results/meetings/${meeting.id}/follow-ups`, 'POST', { title, level }, 'Item adicionado');
                  setTitle('');
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar
              </Button>
            </div>
          )}
          {levels.map((lv) => {
            const items = meeting.followUps.filter((f) => f.level === lv);
            if (!items.length) return null;
            return (
              <div key={lv}>
                <p className="mb-2 text-sm font-semibold">{FOLLOWUP_LEVEL_LABEL[lv]}</p>
                <div className="space-y-2">
                  {items.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="break-words">{f.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.owner?.name ?? 'Sem responsável'}
                          {f.dueDate ? ` · ${formatDate(f.dueDate)}` : ''}
                          {f.action ? ' · ação vinculada' : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {can.update && (
                          <NativeSelect value={f.status} className="h-8 w-32" onChange={(e) => run(`/monthly-results/follow-ups/${f.id}`, 'PATCH', { status: e.target.value }, undefined)}>
                            {Object.entries(ITEM_STATUS_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </NativeSelect>
                        )}
                        {can.update && (
                          <Button size="sm" variant="ghost" onClick={() => run(`/monthly-results/follow-ups/${f.id}`, 'DELETE', undefined, 'Removido')}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {meeting.followUps.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item de acompanhamento.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Níveis e governança</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {meeting.weeklyRoutine.map((r) => (
            <div key={r.level} className="rounded-md border p-3">
              <p className="text-sm font-semibold">{r.level}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.focus.map((item) => (
                  <Badge key={item} variant="secondary">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="mb-2 text-sm font-medium">Governança sugerida</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {meeting.governance.map((g) => (
                <li key={g}>• {g}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =====================================================================
// FAROL
// =====================================================================

function FarolTab({ meeting }: { meeting: MeetingDetail }) {
  const rows = meeting.areas.flatMap((a) => a.indicators.map((i) => ({ area: a.name, ind: i })));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Farol por área e indicador</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportFarolXlsx(meeting)}>
            <FileDown className="mr-2 h-4 w-4" /> Farol Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportAcoesXlsx(meeting)}>
            <FileDown className="mr-2 h-4 w-4" /> Ações Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3">Área</th>
              <th className="py-2 pr-3">Indicador</th>
              <th className="py-2 pr-3">Meta</th>
              <th className="py-2 pr-3">Realizado</th>
              <th className="py-2 pr-3">Farol</th>
              <th className="py-2 pr-3">Tendência</th>
              <th className="py-2 pr-3">Causa</th>
              <th className="py-2 pr-3">Plano</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ area, ind }) => (
              <tr key={ind.id} className="border-b align-top last:border-0">
                <td className="max-w-48 py-2.5 pr-3"><span className="break-words">{area}</span></td>
                <td className="max-w-64 py-2.5 pr-3 font-medium">
                  <Link href={ind.links.indicator} className="break-words hover:underline">
                    {ind.name}
                  </Link>
                </td>
                <td className="py-2.5 pr-3">{formatValue(ind.target, ind.unitLabel)}</td>
                <td className="py-2.5 pr-3">{formatValue(ind.current, ind.unitLabel)}</td>
                <td className="py-2.5 pr-3">
                  <Badge variant="outline" className={cn(LIGHT_STYLES[ind.light])}>{LIGHT_LABEL[ind.light]}</Badge>
                </td>
                <td className="py-2.5 pr-3">{ind.trend ?? '—'}</td>
                <td className="py-2.5 pr-3">{ind.links.deviation ? <Link href={ind.links.deviation} className="text-primary hover:underline">Sim</Link> : 'Não'}</td>
                <td className="py-2.5 pr-3">{ind.links.action ? <Link href={ind.links.action} className="text-primary hover:underline">Sim</Link> : 'Não'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// =====================================================================
// CONFIG
// =====================================================================

function ConfigTab({ meeting, options, can, run }: { meeting: MeetingDetail; options?: MonthlyOptions; can: Can; run: Run }) {
  const [form, setForm] = useState({
    title: meeting.title,
    location: meeting.location ?? '',
    objective: meeting.objective ?? '',
    assumptions: meeting.assumptions ?? '',
    criticalRisks: meeting.criticalRisks ?? '',
    boardDirections: meeting.boardDirections ?? '',
    responsibleUserId: meeting.responsible?.id ?? '',
    secretaryUserId: meeting.secretary?.id ?? '',
    nextMonthlyAt: meeting.nextMonthlyAt ? meeting.nextMonthlyAt.slice(0, 16) : '',
    nextWeeklyAt: meeting.nextWeeklyAt ? meeting.nextWeeklyAt.slice(0, 16) : '',
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração da reunião</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Título</Label>
            <Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={!can.update} />
          </div>
          <div>
            <Label>Local ou link</Label>
            <Input className="mt-1" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} disabled={!can.update} />
          </div>
          <div>
            <Label>Responsável</Label>
            <NativeSelect className="mt-1" value={form.responsibleUserId} onChange={(e) => setForm({ ...form, responsibleUserId: e.target.value })} disabled={!can.update}>
              <option value="">Selecione</option>
              {options?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Secretário / ata</Label>
            <NativeSelect className="mt-1" value={form.secretaryUserId} onChange={(e) => setForm({ ...form, secretaryUserId: e.target.value })} disabled={!can.update}>
              <option value="">Selecione</option>
              {options?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>Próxima reunião mensal</Label>
            <Input type="datetime-local" className="mt-1" value={form.nextMonthlyAt} onChange={(e) => setForm({ ...form, nextMonthlyAt: e.target.value })} disabled={!can.update} />
          </div>
          <div>
            <Label>Próxima checagem semanal</Label>
            <Input type="datetime-local" className="mt-1" value={form.nextWeeklyAt} onChange={(e) => setForm({ ...form, nextWeeklyAt: e.target.value })} disabled={!can.update} />
          </div>
          <div className="md:col-span-2">
            <Label>Objetivo</Label>
            <Textarea rows={2} className="mt-1" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} disabled={!can.update} />
          </div>
          <div>
            <Label>Premissas do mês</Label>
            <Textarea rows={3} className="mt-1" value={form.assumptions} onChange={(e) => setForm({ ...form, assumptions: e.target.value })} disabled={!can.update} />
          </div>
          <div>
            <Label>Riscos críticos</Label>
            <Textarea rows={3} className="mt-1" value={form.criticalRisks} onChange={(e) => setForm({ ...form, criticalRisks: e.target.value })} disabled={!can.update} />
          </div>
          <div className="md:col-span-2">
            <Label>Direcionadores da diretoria</Label>
            <Textarea rows={2} className="mt-1" value={form.boardDirections} onChange={(e) => setForm({ ...form, boardDirections: e.target.value })} disabled={!can.update} />
          </div>
        </div>
        {can.update && (
          <Button onClick={() => run(`/monthly-results/meetings/${meeting.id}`, 'PATCH', form, 'Configuração salva')}>Salvar configuração</Button>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================================
// Dialogs compartilhados
// =====================================================================

function ActionDialog({
  meeting,
  options,
  snapshot,
  areaNodeId,
  onClose,
  run,
}: {
  meeting: MeetingDetail;
  options?: MonthlyOptions;
  snapshot: SnapshotIndicator;
  areaNodeId: string;
  onClose: () => void;
  run: Run;
}) {
  const [form, setForm] = useState({
    title: `Tratar desvio: ${snapshot.name}`,
    description: '',
    responsibleUserId: snapshot.responsibleUserId ?? '',
    dueDate: '',
    priority: 'HIGH',
    expectedResult: '',
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar plano de ação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>O que será feito</Label>
            <Textarea rows={2} className="mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Resultado esperado</Label>
            <Textarea rows={2} className="mt-1" value={form.expectedResult} onChange={(e) => setForm({ ...form, expectedResult: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Responsável</Label>
              <NativeSelect className="mt-1" value={form.responsibleUserId} onChange={(e) => setForm({ ...form, responsibleUserId: e.target.value })}>
                <option value="">Selecione</option>
                {options?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" className="mt-1" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Prioridade</Label>
            <NativeSelect className="mt-1" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="CRITICAL">Crítica</option>
              <option value="HIGH">Alta</option>
              <option value="MEDIUM">Média</option>
              <option value="LOW">Baixa</option>
            </NativeSelect>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!form.title.trim()}
            onClick={() => {
              run(
                `/monthly-results/meetings/${meeting.id}/actions`,
                'POST',
                { ...form, orgNodeId: areaNodeId, indicatorId: snapshot.indicatorId, deviationId: snapshot.deviationId, snapshotId: snapshot.id },
                'Ação criada e vinculada',
              );
              onClose();
            }}
          >
            Criar ação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DecisionDialog({
  meeting,
  options,
  area,
  onClose,
  run,
}: {
  meeting: MeetingDetail;
  options?: MonthlyOptions;
  area: MeetingArea | null;
  onClose: () => void;
  run: Run;
}) {
  const [form, setForm] = useState({
    kind: 'DECISION',
    topic: '',
    description: '',
    ownerUserId: '',
    dueDate: '',
    impactIfNotDecided: '',
    boardInvolved: '',
    createAction: false,
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar decisão / risco / escalonamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <NativeSelect className="mt-1" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="DECISION">Decisão</option>
                <option value="RISK">Risco</option>
                <option value="ESCALATION">Escalonamento</option>
                <option value="PENDING">Pendência</option>
              </NativeSelect>
            </div>
            <div>
              <Label>Tema</Label>
              <Input className="mt-1" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Registro</Label>
            <Textarea rows={3} className="mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Responsável</Label>
              <NativeSelect className="mt-1" value={form.ownerUserId} onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}>
                <option value="">Selecione</option>
                {options?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" className="mt-1" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Impacto se não decidir</Label>
            <Textarea rows={2} className="mt-1" value={form.impactIfNotDecided} onChange={(e) => setForm({ ...form, impactIfNotDecided: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={form.createAction} onChange={(e) => setForm({ ...form, createAction: e.target.checked })} />
            Criar plano de ação vinculado a esta decisão
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!form.description.trim()}
            onClick={() => {
              run(`/monthly-results/meetings/${meeting.id}/decisions`, 'POST', { ...form, orgNodeId: area?.orgNodeId }, 'Registrado na ata');
              onClose();
            }}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Counter({ light, value }: { light: Light; value: number }) {
  return <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', LIGHT_STYLES[light])}>{LIGHT_LABEL[light]} {value}</span>;
}
