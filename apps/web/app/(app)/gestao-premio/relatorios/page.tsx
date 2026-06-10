'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { FileBarChart, FileDown, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, ApiError, getAccessToken } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

interface CompetenceRef { id: string; label: string; program: { code: string; name: string } }
interface ApuracaoRow { registration: string; name: string; area: string | null; position: string | null; costCenter: string | null; gross: number; reductions: number; final: number; blocked: boolean; exceptionType: string | null }
interface Group { key: string; count: number; final: number; gross: number; reductions: number }
interface Apuracao { run: any; rows: ApuracaoRow[]; groups: { byArea: Group[]; byPosition: Group[]; byCostCenter: Group[] }; totals: { gross: number; reductions: number; final: number; blocked: number } }
interface Operational { items: Array<{ key: string; label: string; value: number }> }
interface AuditRow { id: string; action: string; entityType: string; entityId: string; userEmail: string | null; justification: string | null; createdAt: string }

const money = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const AUDIT_ENTITY_TYPES = ['', 'PROGRAM', 'COMPETENCE', 'ANNEX', 'ANNEX_VERSION', 'INDICATOR', 'ACTUAL', 'ELIGIBLE_BATCH', 'CALC_RUN', 'MODERATOR_RULE', 'ADJUSTMENT', 'EXCEPTION', 'PAYROLL_BATCH', 'PAYSLIP'];
const AUDIT_ENTITY_LABEL: Record<string, string> = {
  PROGRAM: 'Programa', COMPETENCE: 'Competência', ANNEX: 'Anexo', ANNEX_VERSION: 'Versão de anexo', INDICATOR: 'Indicador',
  ACTUAL: 'Realizado', ELIGIBLE_BATCH: 'Base elegível', CALC_RUN: 'Apuração', MODERATOR_RULE: 'Moderador', ADJUSTMENT: 'Ajuste',
  EXCEPTION: 'Exceção', PAYROLL_BATCH: 'Lote folha', PAYSLIP: 'Espelho', ALLOCATION: 'Transitoriedade', CONNECTOR: 'Conector',
};
const AUDIT_ACTION_LABEL: Record<string, string> = {
  CREATE: 'criou', UPDATE: 'editou', DELETE: 'excluiu', SUBMIT: 'enviou', APPROVE: 'aprovou', REJECT: 'reprovou', RETURN: 'devolveu',
  PUBLISH: 'publicou', CLOSE: 'fechou', REOPEN: 'reabriu', CALC_RUN: 'apurou', GENERATE: 'gerou', SENT: 'enviou à folha',
  RETURN_PAYROLL: 'conciliou retorno', ACKNOWLEDGE: 'deu ciência', IMPORT_ELIGIBLE: 'importou base', SET_ELIGIBILITY: 'ajustou elegibilidade',
  SUBMIT_REVIEW: 'enviou p/ conferência', CANCEL: 'cancelou', TRANSITION: 'mudou status', SYNC_ACTUALS: 'sincronizou realizado',
};

export default function PrizeReportsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission(['prize:reports:view']);
  const [competenceId, setCompetenceId] = useState('');
  const [tab, setTab] = useState('apuracao');
  const [aiText, setAiText] = useState<{ source: string; text: string } | null>(null);
  const [auditEntity, setAuditEntity] = useState('');

  const { data: competences = [] } = useQuery({ queryKey: ['prize-competences-ref'], queryFn: () => api<CompetenceRef[]>('/prize/competences') });
  const { data: apuracao } = useQuery({ queryKey: ['prize-rep-apuracao', competenceId], queryFn: () => api<Apuracao>(`/prize/reports/apuracao/${competenceId}`), enabled: !!competenceId });
  const { data: operational } = useQuery({ queryKey: ['prize-rep-op', competenceId], queryFn: () => api<Operational>(`/prize/reports/operational${competenceId ? `?competenceId=${competenceId}` : ''}`), enabled: canView });
  const { data: auditRows = [] } = useQuery({
    queryKey: ['prize-audit', auditEntity],
    queryFn: () => api<AuditRow[]>(`/prize/audit${auditEntity ? `?entityType=${auditEntity}` : ''}`),
    enabled: tab === 'auditoria',
  });

  const summarize = useMutation({
    mutationFn: () => api<{ source: string; text: string }>(`/prize/reports/ai/competence/${competenceId}`, { method: 'POST' }),
    onSuccess: (r) => setAiText(r), onError: (e: ApiError) => toast.error(e.message),
  });

  async function exportCsv() {
    const token = getAccessToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
    const res = await fetch(`${apiUrl}/prize/reports/apuracao/${competenceId}/export`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!res.ok) { toast.error('Erro ao exportar'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `apuracao.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Relatórios e Auditoria"
        eyebrow="Gestão de Prêmio"
        description="Apuração por área/cargo/centro de custo, pendências operacionais, trilha de auditoria e resumo executivo assistido por IA."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Relatórios' }]}
      />

      <div className="mb-4 flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Competência:</Label>
        <NativeSelect value={competenceId} onChange={(e) => { setCompetenceId(e.target.value); setAiText(null); }} className="max-w-sm">
          <option value="">Selecione…</option>
          {competences.map((c) => <option key={c.id} value={c.id}>{c.program.code} — {c.label}</option>)}
        </NativeSelect>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="apuracao">Apuração</TabsTrigger>
          <TabsTrigger value="operacional">Operacionais</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="apuracao" className="mt-3">
          {!competenceId ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Selecione uma competência.</CardContent></Card>
          ) : !apuracao?.run ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma apuração para esta competência.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
                  <Card><CardContent className="p-3"><div className="text-lg font-semibold">{apuracao.rows.length}</div><div className="text-xs text-muted-foreground">Colaboradores</div></CardContent></Card>
                  <Card><CardContent className="p-3"><div className="text-lg font-semibold">{money(apuracao.totals.gross)}</div><div className="text-xs text-muted-foreground">Bruto</div></CardContent></Card>
                  <Card><CardContent className="p-3"><div className="text-lg font-semibold text-amber-600">−{money(apuracao.totals.reductions)}</div><div className="text-xs text-muted-foreground">Reduções</div></CardContent></Card>
                  <Card><CardContent className="p-3"><div className="text-lg font-semibold text-emerald-600">{money(apuracao.totals.final)}</div><div className="text-xs text-muted-foreground">Final</div></CardContent></Card>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={exportCsv}><FileDown className="mr-1 h-4 w-4" />CSV</Button>
                  <Button variant="outline" onClick={() => summarize.mutate()} disabled={summarize.isPending}><Sparkles className="mr-1 h-4 w-4" />Resumo IA</Button>
                </div>
              </div>

              {aiText && (
                <Card><CardContent className="p-4">
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5" />Recomendação assistida ({aiText.source === 'IA' ? 'IA' : 'regras'}) — não altera valores</div>
                  <p className="text-sm">{aiText.text}</p>
                </CardContent></Card>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                {(['byArea', 'byPosition', 'byCostCenter'] as const).map((g) => (
                  <Card key={g}><CardContent className="p-3">
                    <h3 className="mb-2 text-xs font-medium text-muted-foreground">{g === 'byArea' ? 'Por área' : g === 'byPosition' ? 'Por cargo' : 'Por centro de custo'}</h3>
                    <ul className="space-y-1 text-xs">
                      {apuracao.groups[g].slice(0, 8).map((row) => (
                        <li key={row.key} className="flex justify-between"><span className="truncate">{row.key} ({row.count})</span><span className="font-medium">{money(row.final)}</span></li>
                      ))}
                    </ul>
                  </CardContent></Card>
                ))}
              </div>

              <Card><CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-left">Colaborador</th><th className="px-3 py-2 text-left">Área</th><th className="px-3 py-2 text-left">Cargo</th><th className="px-3 py-2 text-right">Bruto</th><th className="px-3 py-2 text-right">Reduções</th><th className="px-3 py-2 text-right">Final</th></tr></thead>
                  <tbody>
                    {apuracao.rows.map((r) => (
                      <tr key={r.registration} className={`border-b border-border/40 ${r.blocked ? 'bg-red-50/40' : ''}`}>
                        <td className="px-3 py-2"><div className="font-medium">{r.name}</div><div className="font-mono text-xs text-muted-foreground">{r.registration}{r.exceptionType ? ` · ${r.exceptionType}` : ''}</div></td>
                        <td className="px-3 py-2">{r.area ?? '—'}</td>
                        <td className="px-3 py-2">{r.position ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{money(r.gross)}</td>
                        <td className="px-3 py-2 text-right text-amber-600">{r.reductions > 0 ? `−${money(r.reductions)}` : '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold">{money(r.final)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent></Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="operacional" className="mt-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {operational?.items.map((it) => (
              <Card key={it.key}><CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${it.value > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {it.value > 0 ? <AlertTriangle className="h-4 w-4" /> : <FileBarChart className="h-4 w-4" />}
                </div>
                <div><div className="text-xl font-semibold">{it.value}</div><div className="text-xs text-muted-foreground">{it.label}</div></div>
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>

        {/* Trilha imutável das ações do prêmio (quem, o quê, quando e por quê) */}
        <TabsContent value="auditoria" className="mt-3">
          <div className="mb-3 flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Entidade:</Label>
            <NativeSelect value={auditEntity} onChange={(e) => setAuditEntity(e.target.value)} className="max-w-xs">
              {AUDIT_ENTITY_TYPES.map((t) => <option key={t} value={t}>{t ? AUDIT_ENTITY_LABEL[t] ?? t : 'Todas'}</option>)}
            </NativeSelect>
          </div>
          {auditRows.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum registro de auditoria.</p>
            </CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-border/60">
                  {auditRows.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">{a.userEmail ?? 'Sistema'}</span>{' '}
                        {AUDIT_ACTION_LABEL[a.action] ?? a.action.toLowerCase()}{' '}
                        <Badge variant="secondary">{AUDIT_ENTITY_LABEL[a.entityType] ?? a.entityType}</Badge>
                        {a.justification && <span className="block text-xs text-muted-foreground">“{a.justification}”</span>}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString('pt-BR')}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
