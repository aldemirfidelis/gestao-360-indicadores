'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Calculator, PlayCircle, RotateCcw, FileText, Lock, Zap } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { CatalogActualsSection } from '@/components/gestao-premio/catalog-actuals-section';

interface CompetenceRef { id: string; label: string; program: { code: string; name: string } }
interface Run { id: string; version: number; status: string; totalEmployees: number; totalGross: string | null; totalReductions: string | null; totalFinal: string | null; engineVersion: string; finishedAt: string | null }
interface Result {
  id: string; registration: string; name: string; potential: string | null; weightedGain: string | null;
  proportionality: string | null; grossValue: string | null; totalReductions: string | null; adjustments: string | null;
  gratification: string | null; finalValue: string | null; blocked: boolean; blockReason: string | null; exceptionType: string | null; hash: string | null;
}
interface MemoryLine { id: string; step: number; code: string; label: string; detail: string | null; value: string | null }
interface Memory extends Result { lines: MemoryLine[] }
interface CellResult {
  id: string; areaRef: string; positionRef: string; possibleSalaryPercent: string; achievedSalaryPercent: string;
  weightedGainPercent: string | null; status: string; group?: { name: string };
}
interface UnmatchedEmployee { id: string; registration: string; name: string; areaRef: string | null; positionRef: string | null; reason: string }

const money = (v: string | null) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const percent = (v: string | number | null | undefined) => v == null ? '-' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`;

const CELL_STATUS_LABEL: Record<string, string> = {
  CALCULATED: 'Calculado',
  PENDING_INPUT: 'Pendente',
  BLOCKED: 'Bloqueado',
};

export default function PrizeApuracaoPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canRun = hasPermission(['prize:calc:run']);
  const canApprove = hasPermission(['prize:calc:approve']);
  const canActuals = hasPermission(['prize:actuals:manage']);

  const [competenceId, setCompetenceId] = useState('');
  const [memoryFor, setMemoryFor] = useState<string | null>(null);

  const { data: competences = [] } = useQuery({ queryKey: ['prize-competences-ref'], queryFn: () => api<CompetenceRef[]>('/prize/competences') });
  const { data, isLoading } = useQuery({
    queryKey: ['prize-calc-results', competenceId],
    queryFn: () => api<{ run: Run | null; results: Result[]; competenceStatus: string | null }>(`/prize/calc/competence/${competenceId}/results`),
    enabled: !!competenceId,
  });
  const { data: cellData } = useQuery({
    queryKey: ['prize-v2-cells', competenceId],
    queryFn: () => api<{ run: Run | null; cells: CellResult[] }>(`/prize/rules/competence/${competenceId}/cells`),
    enabled: !!competenceId,
  });
  const { data: unmatchedData } = useQuery({
    queryKey: ['prize-v2-unmatched', competenceId],
    queryFn: () => api<{ run: Run | null; unmatched: UnmatchedEmployee[] }>(`/prize/rules/competence/${competenceId}/unmatched`),
    enabled: !!competenceId,
  });
  const { data: memory } = useQuery({
    queryKey: ['prize-calc-memory', memoryFor],
    queryFn: () => api<Memory>(`/prize/calc/result/${memoryFor}/memory`),
    enabled: !!memoryFor,
  });

  const run = useMutation({
    mutationFn: () => api(`/prize/calc/competence/${competenceId}/run`, { method: 'POST' }),
    onSuccess: (r: any) => { toast.success(`Apuração v${r.version} concluída: ${r.totalEmployees} colaborador(es)`); qc.invalidateQueries({ queryKey: ['prize-calc-results'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const runV2 = useMutation({
    mutationFn: () => api<any>(`/prize/calc/competence/${competenceId}/run-v2`, { method: 'POST' }),
    onSuccess: (r) => {
      if (r.blockedReason) toast.warning(`V2 bloqueada: ${r.blockedReason}`);
      else {
        const apurados = r.apurados ?? r.totalEmployees ?? 0;
        const fora = r.outOfScope ?? 0;
        toast.success(fora > 0
          ? `Setor apurado na v2: ${apurados} apurado(s); ${fora} fora do escopo (sem regra) — veja "Não casados".`
          : `Setor apurado na v2: ${apurados} colaborador(es)`);
      }
      qc.invalidateQueries({ queryKey: ['prize-calc-results'] });
      qc.invalidateQueries({ queryKey: ['prize-v2-cells'] });
      qc.invalidateQueries({ queryKey: ['prize-v2-unmatched'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const reprocess = useMutation({
    mutationFn: (reason: string) => api(`/prize/calc/competence/${competenceId}/reprocess`, { method: 'POST', json: { reason } }),
    onSuccess: (r: any) => { toast.success(`Reprocessado (v${r.version})`); qc.invalidateQueries({ queryKey: ['prize-calc-results'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const conference = useMutation({
    mutationFn: ({ action, comment }: { action: string; comment?: string }) =>
      api(`/prize/calc/competence/${competenceId}/${action}`, { method: 'POST', json: comment ? { comment } : {} }),
    onSuccess: () => { toast.success('Conferência atualizada'); qc.invalidateQueries({ queryKey: ['prize-calc-results'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const autopilot = useMutation({
    mutationFn: () => api<any>(`/prize/competences/${competenceId}/autopilot`, { method: 'POST', json: { runCalc: true } }),
    onSuccess: (r) => {
      const s = r.sync;
      if (r.calcRun) toast.success(`Automatização: ${s.synced} realizado(s) sincronizado(s) · apuração v${r.calcRun.version} concluída (${r.calcRun.totalEmployees} colab.)`);
      else toast.warning(`Automatização: ${s.synced} sincronizado(s), apuração não rodou — ${r.calcSkipped ?? 'verifique a lista de verificação'}`);
      qc.invalidateQueries({ queryKey: ['prize-calc-results'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const runData = data?.run;
  const compStatus = data?.competenceStatus ?? null;
  const COMP_STATUS: Record<string, { label: string; variant: any }> = {
    CLOSED_FOR_CALC: { label: 'Fechada p/ cálculo', variant: 'outline' },
    IN_CALCULATION: { label: 'Em apuração', variant: 'default' },
    IN_REVIEW: { label: 'Em conferência', variant: 'default' },
    IN_APPROVAL: { label: 'Em aprovação', variant: 'default' },
    APPROVED: { label: 'Aprovada', variant: 'default' },
  };

  return (
    <div>
      <PageHeader
        title="Apuração Mensal"
        eyebrow="Gestão de Prêmio"
        description="Motor de cálculo parametrizável com memória de cálculo auditável e reprocesso versionado."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Apuração Mensal' }]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground">Competência:</Label>
        <NativeSelect value={competenceId} onChange={(e) => setCompetenceId(e.target.value)} className="max-w-sm">
          <option value="">Selecione…</option>
          {competences.map((c) => <option key={c.id} value={c.id}>{c.program.code} — {c.label}</option>)}
        </NativeSelect>
        {canRun && competenceId && (
          <div className="ml-auto flex gap-2">
            <Button onClick={() => autopilot.mutate()} disabled={autopilot.isPending} title="Sincroniza o realizado da plataforma, valida a lista de verificação e apura automaticamente">
              <Zap className="mr-1 h-4 w-4" />{autopilot.isPending ? 'Executando…' : 'Automatizar'}
            </Button>
            <Button onClick={() => runV2.mutate()} disabled={runV2.isPending} title="Apura pela matriz área×cargo quem tem combinação cadastrada; quem não tem regra fica listado em 'Não casados' (fora do escopo). Bloqueia só se houver ambiguidade (2+ combinações para a mesma pessoa).">
              <PlayCircle className="mr-1 h-4 w-4" />{runV2.isPending ? 'Apurando setor...' : 'Rodar setor v2'}
            </Button>
            {!runData ? (
              <Button variant="outline" onClick={() => run.mutate()} disabled={run.isPending} title="Modelo LEGADO (plano): aplica todos os indicadores do programa, sem casar por área×cargo. Prefira 'Rodar setor v2', que usa as combinações.">
                <PlayCircle className="mr-1 h-4 w-4" />{run.isPending ? 'Apurando…' : 'Rodar apuração (legado v1)'}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => { const r = window.prompt('Justificativa para reprocessar (obrigatória):'); if (r?.trim()) reprocess.mutate(r); }} disabled={reprocess.isPending}>
                <RotateCcw className="mr-1 h-4 w-4" />Reprocessar
              </Button>
            )}
          </div>
        )}
      </div>

      {competenceId && (
        <div className="mb-4 space-y-3">
          <CatalogActualsSection competenceId={competenceId} canManage={canActuals} />
        </div>
      )}

      {!competenceId ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Calculator className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Selecione uma competência para apurar o prêmio.</p>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : !runData ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma apuração rodada. Clique em “Rodar apuração” (requer base elegível importada).</CardContent></Card>
      ) : (
        <div className="space-y-4">
          <Tabs defaultValue="cells">
            <TabsList>
              <TabsTrigger value="cells">Régua coletiva</TabsTrigger>
              <TabsTrigger value="unmatched">Não casados</TabsTrigger>
            </TabsList>
            <TabsContent value="cells">
              <Card>
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Área</th>
                        <th className="px-3 py-2 text-left">Cargo</th>
                        <th className="px-3 py-2 text-left">Combinação</th>
                        <th className="px-3 py-2 text-right">% possível</th>
                        <th className="px-3 py-2 text-right">% atingido</th>
                        <th className="px-3 py-2 text-right">Ating.</th>
                        <th className="px-3 py-2 text-left">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cellData?.cells ?? []).map((cell) => (
                        <tr key={cell.id} className={`border-b border-border/40 ${cell.status !== 'CALCULATED' ? 'bg-amber-50/50' : ''}`}>
                          <td className="px-3 py-2">{cell.areaRef}</td>
                          <td className="px-3 py-2">{cell.positionRef}</td>
                          <td className="px-3 py-2 text-muted-foreground">{cell.group?.name ?? '-'}</td>
                          <td className="px-3 py-2 text-right">{percent(cell.possibleSalaryPercent)}</td>
                          <td className="px-3 py-2 text-right font-medium">{percent(cell.achievedSalaryPercent)}</td>
                          <td className="px-3 py-2 text-right">{percent(cell.weightedGainPercent)}</td>
                          <td className="px-3 py-2"><Badge variant={cell.status === 'CALCULATED' ? 'secondary' : 'outline'}>{CELL_STATUS_LABEL[cell.status] ?? cell.status}</Badge></td>
                        </tr>
                      ))}
                      {(cellData?.cells ?? []).length === 0 && (
                        <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhuma régua v2 materializada para esta competência.</td></tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="unmatched">
              <Card>
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Colaborador</th>
                        <th className="px-3 py-2 text-left">Área</th>
                        <th className="px-3 py-2 text-left">Cargo</th>
                        <th className="px-3 py-2 text-left">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(unmatchedData?.unmatched ?? []).map((u) => (
                        <tr key={u.id} className="border-b border-border/40 bg-red-50/40">
                          <td className="px-3 py-2"><div className="font-medium">{u.name}</div><div className="font-mono text-xs text-muted-foreground">{u.registration}</div></td>
                          <td className="px-3 py-2">{u.areaRef ?? '-'}</td>
                          <td className="px-3 py-2">{u.positionRef ?? '-'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{u.reason}</td>
                        </tr>
                      ))}
                      {(unmatchedData?.unmatched ?? []).length === 0 && (
                        <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhum não casado no último processamento v2.</td></tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Conferência:</span>
                {compStatus && COMP_STATUS[compStatus] ? <Badge variant={COMP_STATUS[compStatus].variant}>{COMP_STATUS[compStatus].label}</Badge> : <span className="text-muted-foreground">—</span>}
              </div>
              <div className="flex gap-2">
                {canRun && compStatus !== 'IN_REVIEW' && compStatus !== 'APPROVED' && (
                  <Button size="sm" variant="outline" onClick={() => conference.mutate({ action: 'submit-review' })} disabled={conference.isPending}>Enviar p/ conferência</Button>
                )}
                {canApprove && (compStatus === 'IN_REVIEW' || compStatus === 'IN_APPROVAL') && (
                  <>
                    <Button size="sm" onClick={() => conference.mutate({ action: 'approve' })} disabled={conference.isPending}>Aprovar apuração</Button>
                    <Button size="sm" variant="outline" onClick={() => { const c = window.prompt('Comentário da reprovação (obrigatório):'); if (c?.trim()) conference.mutate({ action: 'reject', comment: c }); }} disabled={conference.isPending}>Reprovar</Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card><CardContent className="p-4"><div className="text-2xl font-semibold">{runData.totalEmployees}</div><div className="text-xs text-muted-foreground">Colaboradores · v{runData.version}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xl font-semibold">{money(runData.totalGross)}</div><div className="text-xs text-muted-foreground">Prêmio bruto</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xl font-semibold text-amber-600">−{money(runData.totalReductions)}</div><div className="text-xs text-muted-foreground">Reduções</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xl font-semibold text-emerald-600">{money(runData.totalFinal)}</div><div className="text-xs text-muted-foreground">Prêmio final</div></CardContent></Card>
          </div>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Colaborador</th>
                    <th className="px-3 py-2 text-right">Potencial</th>
                    <th className="px-3 py-2 text-right">Ating.</th>
                    <th className="px-3 py-2 text-right">Bruto</th>
                    <th className="px-3 py-2 text-right">Reduções</th>
                    <th className="px-3 py-2 text-right">Final</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.results.map((r) => (
                    <tr key={r.id} className={`border-b border-border/40 ${r.blocked ? 'bg-red-50/40' : ''}`}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.registration}{r.exceptionType && <span className="ml-1">· {r.exceptionType}</span>}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{money(r.potential)}</td>
                      <td className="px-3 py-2 text-right">{r.weightedGain ?? '—'}%</td>
                      <td className="px-3 py-2 text-right">{money(r.grossValue)}</td>
                      <td className="px-3 py-2 text-right text-amber-600">{Number(r.totalReductions ?? 0) > 0 ? `−${money(r.totalReductions)}` : '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {r.blocked ? <span className="flex items-center justify-end gap-1 text-muted-foreground"><Lock className="h-3 w-3" />{money(r.finalValue)}</span> : money(r.finalValue)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setMemoryFor(r.id)}><FileText className="mr-1 h-3.5 w-3.5" />Memória</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">Motor v{runData.engineVersion} · valores parametrizados pelo anexo vigente e regras de moderador. A apuração não sobrescreve versões anteriores (reprocesso gera nova versão auditável).</p>
        </div>
      )}

      {/* Memória de cálculo */}
      <Dialog open={!!memoryFor} onOpenChange={(o) => !o && setMemoryFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Memória de cálculo — {memory?.name}</DialogTitle></DialogHeader>
          {!memory ? <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p> : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>Potencial: <b>{money(memory.potential)}</b></div>
                <div>Atingimento: <b>{memory.weightedGain ?? '—'}%</b></div>
                <div>Proporcional.: <b>{memory.proportionality ?? '—'}</b></div>
                <div>Bruto: <b>{money(memory.grossValue)}</b></div>
                <div>Reduções: <b className="text-amber-600">−{money(memory.totalReductions)}</b></div>
                <div>Final: <b className="text-emerald-600">{money(memory.finalValue)}</b></div>
              </div>
              <div className="max-h-80 overflow-y-auto rounded border border-border/60">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-2 py-1 text-left">#</th><th className="px-2 py-1 text-left">Etapa</th><th className="px-2 py-1 text-left">Detalhe</th><th className="px-2 py-1 text-right">Valor</th></tr></thead>
                  <tbody>
                    {memory.lines.map((l) => (
                      <tr key={l.id} className="border-t border-border/40">
                        <td className="px-2 py-1 text-muted-foreground">{l.step}</td>
                        <td className="px-2 py-1">{l.label}</td>
                        <td className="px-2 py-1 text-muted-foreground">{l.detail ?? ''}</td>
                        <td className="px-2 py-1 text-right font-mono">{l.value == null ? '' : Number(l.value).toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {memory.hash && <p className="text-right text-xs text-muted-foreground">id do processamento: {memory.hash}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
