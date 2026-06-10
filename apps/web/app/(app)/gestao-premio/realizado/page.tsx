'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Save, Lock, Unlock, RefreshCw, Link2, TrendingUp, AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface CompetenceRef { id: string; label: string; status: string; program: { code: string; name: string } }
interface PxrRow {
  indicatorId: string; code: string; name: string; unit: string | null; kind: string; weight: number | null;
  platformIndicatorId: string | null; actualId: string | null; actualStatus: string | null;
  hasActual: boolean; realized: number | null; target: number | null; zero: number | null;
  deviation: number | null; deviationPercent: number | null; achievementPercent: number | null;
  gainPercent: number | null; rangeLabel: string | null; onTarget: boolean | null;
}
interface Pxr {
  competenceId: string;
  summary: { indicators: number; withActual: number; missingActual: number; offTarget: number };
  rows: PxrRow[];
}

const ASTATUS: Record<string, { label: string; variant: any }> = {
  IN_FILLING: { label: 'Em preenchimento', variant: 'secondary' },
  PENDING: { label: 'Pendente', variant: 'default' },
  IN_VALIDATION: { label: 'Em validação', variant: 'default' },
  PRE_CLOSE: { label: 'Pré-fechamento', variant: 'default' },
  CLOSED: { label: 'Fechado', variant: 'outline' },
  REOPENED: { label: 'Reaberto', variant: 'destructive' },
  CORRECTED: { label: 'Corrigido', variant: 'default' },
};
const LOCKED_COMP = ['CLOSED_FOR_CALC', 'IN_CALCULATION', 'IN_REVIEW', 'IN_APPROVAL', 'APPROVED', 'SENT_TO_PAYROLL', 'PAYSLIPS_PUBLISHED', 'CLOSED'];

function fmt(n: number | null) { return n === null || n === undefined ? '—' : String(n); }

export default function PrizeActualsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['prize:actuals:manage']);
  const canClose = hasPermission(['prize:actuals:close']);

  const [competenceId, setCompetenceId] = useState('');
  const [tab, setTab] = useState('lancamento');
  const [draft, setDraft] = useState<Record<string, string>>({});

  const { data: competences = [] } = useQuery({ queryKey: ['prize-competences-ref'], queryFn: () => api<CompetenceRef[]>('/prize/competences') });
  const competence = competences.find((c) => c.id === competenceId);
  const locked = competence ? LOCKED_COMP.includes(competence.status) : false;

  const { data: pxr, isLoading } = useQuery({
    queryKey: ['prize-pxr', competenceId],
    queryFn: () => api<Pxr>(`/prize/actuals/previsto-realizado/${competenceId}`),
    enabled: !!competenceId,
  });

  useEffect(() => { setDraft({}); }, [competenceId]);

  const saveGrid = useMutation({
    mutationFn: () => {
      const rows = Object.entries(draft)
        .filter(([, v]) => v !== '')
        .map(([indicatorId, v]) => ({ indicatorId, realized: Number(v) }));
      if (rows.length === 0) throw new ApiError(400, 'Nada para salvar', null);
      return api(`/prize/actuals/competence/${competenceId}/grid`, { method: 'POST', json: { rows } });
    },
    onSuccess: (r: any) => { toast.success(`${r.saved} lançamento(s) salvo(s)`); setDraft({}); qc.invalidateQueries({ queryKey: ['prize-pxr'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const closeActuals = useMutation({
    mutationFn: () => api(`/prize/actuals/competence/${competenceId}/close`, { method: 'POST' }),
    onSuccess: (r: any) => { toast.success(`Realizado fechado (${r.closed})`); qc.invalidateQueries({ queryKey: ['prize-pxr'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const reopen = useMutation({
    mutationFn: ({ actualId, justification }: { actualId: string; justification: string }) => api(`/prize/actuals/${actualId}/reopen`, { method: 'POST', json: { justification } }),
    onSuccess: () => { toast.success('Realizado reaberto'); qc.invalidateQueries({ queryKey: ['prize-pxr'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const syncFromPlatform = useMutation({
    mutationFn: () => api<{ synced: number; unchanged: number; linked: number; missingResult: any[]; unlinked: any[] }>(`/prize/actuals/competence/${competenceId}/sync`, { method: 'POST' }),
    onSuccess: (s) => {
      toast.success(`Sincronizado: ${s.synced} atualizado(s), ${s.unchanged} já em dia${s.missingResult.length ? ` · ${s.missingResult.length} sem lançamento no período` : ''}${s.unlinked.length ? ` · ${s.unlinked.length} sem vínculo` : ''}`);
      qc.invalidateQueries({ queryKey: ['prize-pxr'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const StatusIcon = ({ r }: { r: PxrRow }) =>
    !r.hasActual ? <MinusCircle className="h-4 w-4 text-muted-foreground" /> :
    r.onTarget ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
    <AlertTriangle className="h-4 w-4 text-amber-600" />;

  return (
    <div>
      <PageHeader
        title="Realizado"
        eyebrow="Gestão de Prêmio"
        description="O realizado dos indicadores vinculados sincroniza automaticamente do módulo Lançamentos. Lançamento manual apenas para indicadores exclusivos do prêmio."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Realizado' }]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground">Competência:</Label>
        <NativeSelect value={competenceId} onChange={(e) => setCompetenceId(e.target.value)} className="max-w-sm">
          <option value="">Selecione…</option>
          {competences.map((c) => <option key={c.id} value={c.id}>{c.program.code} — {c.label}</option>)}
        </NativeSelect>
        {competence && locked && <Badge variant="outline"><Lock className="mr-1 h-3 w-3" />Competência travada</Badge>}
        <div className="ml-auto flex gap-2">
          {canManage && competenceId && !locked && (
            <Button onClick={() => syncFromPlatform.mutate()} disabled={syncFromPlatform.isPending}>
              <RefreshCw className="mr-1 h-4 w-4" />{syncFromPlatform.isPending ? 'Sincronizando…' : 'Sincronizar da plataforma'}
            </Button>
          )}
          {canManage && competenceId && !locked && (
            <Button variant="outline" onClick={() => saveGrid.mutate()} disabled={saveGrid.isPending || Object.keys(draft).length === 0}>
              <Save className="mr-1 h-4 w-4" />Salvar manuais
            </Button>
          )}
          {canClose && competenceId && !locked && (
            <Button variant="outline" onClick={() => closeActuals.mutate()} disabled={closeActuals.isPending}>
              <Lock className="mr-1 h-4 w-4" />Fechar realizado
            </Button>
          )}
        </div>
      </div>

      {!competenceId ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Selecione uma competência.</p>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : !pxr?.rows.length ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum indicador no programa desta competência.</CardContent></Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="lancamento">Lançamento</TabsTrigger>
            <TabsTrigger value="pxr">Previsto × Realizado</TabsTrigger>
          </TabsList>

          <TabsContent value="lancamento" className="mt-3">
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Indicador</th>
                      <th className="px-3 py-2 text-left">Origem</th>
                      <th className="px-3 py-2 text-right">Zero</th>
                      <th className="px-3 py-2 text-right">Meta</th>
                      <th className="px-3 py-2 text-right">Realizado</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pxr.rows.map((r) => {
                      const st = r.actualStatus ? ASTATUS[r.actualStatus] : null;
                      const synced = !!r.platformIndicatorId;
                      const rowLocked = r.actualStatus === 'CLOSED' || locked || synced;
                      return (
                        <tr key={r.indicatorId} className="border-b border-border/40">
                          <td className="px-3 py-2">
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground">{r.code}{r.unit ? ` · ${r.unit}` : ''}</div>
                          </td>
                          <td className="px-3 py-2">
                            {synced
                              ? <Badge variant="outline" className="border-emerald-300 text-emerald-700"><Link2 className="mr-1 h-3 w-3" />Plataforma</Badge>
                              : <Badge variant="outline">Manual</Badge>}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{fmt(r.zero)}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{fmt(r.target)}</td>
                          <td className="px-3 py-2 text-right">
                            {canManage && !rowLocked ? (
                              <Input
                                type="number"
                                className="ml-auto h-8 w-28 text-right"
                                value={draft[r.indicatorId] ?? (r.realized ?? '')}
                                onChange={(e) => setDraft({ ...draft, [r.indicatorId]: e.target.value })}
                              />
                            ) : (
                              <span className="font-medium" title={synced ? 'Sincronizado do módulo Lançamentos — edite lá e sincronize' : undefined}>{fmt(r.realized)}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{st ? <Badge variant={st.variant}>{st.label}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</td>
                          <td className="px-3 py-2 text-right">
                            {canClose && r.actualStatus === 'CLOSED' && r.actualId && (
                              <Button size="sm" variant="ghost" onClick={() => {
                                const j = window.prompt('Justificativa para reabrir (obrigatória):');
                                if (j?.trim()) reopen.mutate({ actualId: r.actualId as string, justification: j });
                              }}><Unlock className="h-3.5 w-3.5" /></Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <p className="mt-2 text-xs text-muted-foreground">
              Indicadores com origem “Plataforma” recebem o realizado do módulo Lançamentos (ou da API externa) via
              sincronização — para corrigir um valor, corrija na origem e sincronize novamente.
            </p>
          </TabsContent>

          <TabsContent value="pxr" className="mt-3">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Card><CardContent className="p-4"><div className="text-2xl font-semibold">{pxr.summary.indicators}</div><div className="text-xs text-muted-foreground">Indicadores</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-2xl font-semibold text-emerald-600">{pxr.summary.withActual}</div><div className="text-xs text-muted-foreground">Com realizado</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-2xl font-semibold text-muted-foreground">{pxr.summary.missingActual}</div><div className="text-xs text-muted-foreground">Sem realizado</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-2xl font-semibold text-amber-600">{pxr.summary.offTarget}</div><div className="text-xs text-muted-foreground">Fora da meta</div></CardContent></Card>
              </div>

              <Card>
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left"></th>
                        <th className="px-3 py-2 text-left">Indicador</th>
                        <th className="px-3 py-2 text-right">Meta</th>
                        <th className="px-3 py-2 text-right">Realizado</th>
                        <th className="px-3 py-2 text-right">Desvio</th>
                        <th className="px-3 py-2 text-right">Atingimento</th>
                        <th className="px-3 py-2 text-left">Faixa</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pxr.rows.map((r) => (
                        <tr key={r.indicatorId} className={`border-b border-border/40 ${r.onTarget === false ? 'bg-amber-50/50' : ''}`}>
                          <td className="px-3 py-2"><StatusIcon r={r} /></td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground">{r.code}{r.weight ? ` · peso ${r.weight}` : ''}</div>
                          </td>
                          <td className="px-3 py-2 text-right">{fmt(r.target)}</td>
                          <td className="px-3 py-2 text-right font-medium">{fmt(r.realized)}</td>
                          <td className={`px-3 py-2 text-right ${(r.deviation ?? 0) < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {r.deviation === null ? '—' : `${r.deviation > 0 ? '+' : ''}${r.deviation}`}
                            {r.deviationPercent !== null && <span className="ml-1 text-xs text-muted-foreground">({r.deviationPercent}%)</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{r.achievementPercent === null ? '—' : `${r.achievementPercent}%`}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{r.rangeLabel ?? '—'}</td>
                          <td className="px-3 py-2 text-right">
                            {r.onTarget === false && (
                              <div className="flex justify-end gap-1">
                                <Link href={`/deviations`}><Button size="sm" variant="ghost" title="Abrir análise de causa"><AlertTriangle className="h-3.5 w-3.5" /></Button></Link>
                                <Link href={`/actions`}><Button size="sm" variant="ghost" title="Abrir plano de ação"><ClipboardList className="h-3.5 w-3.5" /></Button></Link>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
                Indicadores fora da meta podem ser tratados via Análise de Causa e Plano de Ação (módulos da plataforma).
              </p>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
