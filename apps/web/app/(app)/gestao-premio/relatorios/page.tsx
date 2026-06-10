'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { FileBarChart, FileDown, Sparkles, AlertTriangle } from 'lucide-react';
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

const money = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PrizeReportsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission(['prize:reports:view']);
  const [competenceId, setCompetenceId] = useState('');
  const [tab, setTab] = useState('apuracao');
  const [aiText, setAiText] = useState<{ source: string; text: string } | null>(null);

  const { data: competences = [] } = useQuery({ queryKey: ['prize-competences-ref'], queryFn: () => api<CompetenceRef[]>('/prize/competences') });
  const { data: apuracao } = useQuery({ queryKey: ['prize-rep-apuracao', competenceId], queryFn: () => api<Apuracao>(`/prize/reports/apuracao/${competenceId}`), enabled: !!competenceId });
  const { data: operational } = useQuery({ queryKey: ['prize-rep-op', competenceId], queryFn: () => api<Operational>(`/prize/reports/operational${competenceId ? `?competenceId=${competenceId}` : ''}`), enabled: canView });

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
        title="Relatórios do Prêmio"
        eyebrow="Gestão de Prêmio"
        description="Apuração por área/cargo/centro de custo, pendências operacionais e resumo executivo assistido por IA."
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
      </Tabs>
    </div>
  );
}
