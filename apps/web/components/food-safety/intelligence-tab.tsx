'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Brain, Download, Lightbulb, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type Dataset = 'suppliers' | 'materials' | 'lots';

interface IntelligenceDashboard {
  overview: {
    processes: number;
    hazards: number;
    hazardsCritical: number;
    hazardsHigh: number;
    ccp: number;
    oprp: number;
  };
  chain: {
    suppliers: number;
    suppliersBlocked: number;
    materials: number;
    lots: number;
    lotsBlocked: number;
    activeRecalls: number;
    expiringLots: number;
  };
  compliance: {
    requirements: number;
    applicable: number;
    compliancePct: number;
    notMet: number;
    partial: number;
    pending: number;
  };
  monitoring: {
    total: number;
    ok: number;
    alert: number;
    out: number;
    lotBlocked: number;
    recentOut: Array<{
      id: string;
      measuredAt: string;
      valueNum: number | null;
      valueText: string | null;
      controlPlan: { parameter: string | null; controlType: string; hazard: { name: string; process: { name: string } | null } | null } | null;
    }>;
  };
  supplierAverageScore: number;
  supplierRiskCount: number;
  riskScore: number;
  activeRecalls: Array<{ id: string; title: string; status: string; severity: Severity; initiatedAt: string }>;
  generatedAt: string;
}

interface ScorecardRow {
  id: string;
  code: string | null;
  name: string;
  status: string;
  criticality: Severity;
  score: number;
  riskLevel: Severity;
  materials: number;
  lots: number;
  blockedLots: number;
  blockedMaterials: number;
  reviewOverdue: boolean;
  drivers: string[];
}

interface AssistantResult {
  generatedAt: string;
  insights: Array<{ severity: Severity; title: string; description: string; action: string; area: string }>;
}

interface ExportPayload {
  filename: string;
  mimeType: string;
  encoding: string;
  content: string;
  rowCount: number;
}

const SEVERITY_CLASS: Record<Severity, string> = {
  LOW: 'bg-emerald-100 text-emerald-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-rose-100 text-rose-700',
};
const SEVERITY_LABEL: Record<Severity, string> = { LOW: 'Baixa', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Critica' };
const DATASET_LABEL: Record<Dataset, string> = { suppliers: 'Fornecedores', materials: 'Materiais', lots: 'Lotes' };

export function IntelligenceTab({ programId, canManage }: { programId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [dataset, setDataset] = useState<Dataset>('suppliers');
  const [importOpen, setImportOpen] = useState(false);
  const suffix = programId ? `?programId=${encodeURIComponent(programId)}` : '';
  const dashboard = useQuery<IntelligenceDashboard>({ queryKey: ['fsms', 'intelligence-dashboard', programId], queryFn: () => api(`/food-safety/intelligence-dashboard${suffix}`), enabled: !!programId });
  const scorecard = useQuery<ScorecardRow[]>({ queryKey: ['fsms', 'supplier-scorecard', programId], queryFn: () => api(`/food-safety/supplier-scorecard${suffix}`), enabled: !!programId });
  const assistant = useQuery<AssistantResult>({ queryKey: ['fsms', 'assistant-insights', programId], queryFn: () => api(`/food-safety/assistant-insights${suffix}`), enabled: !!programId });

  const exportMut = useMutation({
    mutationFn: () => api<ExportPayload>(`/food-safety/export?dataset=${dataset}&programId=${encodeURIComponent(programId)}`),
    onSuccess: downloadPayload,
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao exportar'),
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['fsms'] });
  }

  const data = dashboard.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <HealthCard label="Saude FSMS" value={data?.riskScore ?? 0} />
        <Metric label="Conformidade" value={`${data?.compliance.compliancePct ?? 0}%`} />
        <Metric label="Score fornecedores" value={data?.supplierAverageScore ?? 0} />
        <Metric label="Desvios recentes" value={data?.monitoring.out ?? 0} risk={(data?.monitoring.out ?? 0) > 0} />
        <Metric label="Recalls ativos" value={data?.chain.activeRecalls ?? 0} risk={(data?.chain.activeRecalls ?? 0) > 0} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <Brain className="h-5 w-5 text-primary" />
          <div className="mr-auto">
            <div className="text-sm font-semibold">Inteligencia operacional</div>
            <div className="text-xs text-muted-foreground">Dashboard calculado, score de fornecedores, recomendacoes e import/export.</div>
          </div>
          <div>
            <Label>Dataset</Label>
            <NativeSelect className="w-44" value={dataset} onChange={(e) => setDataset(e.target.value as Dataset)}>
              {Object.entries(DATASET_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </NativeSelect>
          </div>
          <Button variant="outline" onClick={() => exportMut.mutate()} disabled={exportMut.isPending}>
            <Download className="mr-2 h-4 w-4" />
            {exportMut.isPending ? 'Exportando...' : 'Exportar CSV'}
          </Button>
          {canManage && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar JSON
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="border-b p-3 text-sm font-semibold">Assistente de recomendacoes</div>
            <div className="space-y-2 p-3">
              {(assistant.data?.insights ?? []).map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-md border p-3">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="mt-0.5 h-4 w-4 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.title}</span>
                        <span className={cn('rounded px-2 py-0.5 text-xs font-medium', SEVERITY_CLASS[item.severity])}>{SEVERITY_LABEL[item.severity]}</span>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>
                      <div className="mt-2 text-xs font-medium">{item.action}</div>
                      <Badge variant="outline" className="mt-2">{item.area}</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {assistant.isPending && <div className="p-3 text-sm text-muted-foreground">Calculando recomendacoes...</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="border-b p-3 text-sm font-semibold">Sinais executivos</div>
            <div className="grid grid-cols-2 gap-3 p-3">
              <Signal label="Perigos criticos" value={data?.overview.hazardsCritical ?? 0} />
              <Signal label="Perigos altos" value={data?.overview.hazardsHigh ?? 0} />
              <Signal label="PCC" value={data?.overview.ccp ?? 0} />
              <Signal label="PPRO" value={data?.overview.oprp ?? 0} />
              <Signal label="Fornecedores risco" value={data?.supplierRiskCount ?? 0} />
              <Signal label="Lotes vencendo" value={data?.chain.expiringLots ?? 0} />
            </div>
            <div className="border-t p-3 text-xs text-muted-foreground">
              Atualizado em {data?.generatedAt ? formatDate(data.generatedAt) : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b p-3 text-sm font-semibold">Scorecard de fornecedores</div>
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th className="text-left">Fornecedor</th>
                  <th className="text-left">Score</th>
                  <th className="text-left">Risco</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Sinais</th>
                </tr>
              </thead>
              <tbody>
                {(scorecard.data ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">Sem fornecedores para pontuar.</td></tr>
                ) : (
                  (scorecard.data ?? []).map((row) => (
                    <tr key={row.id}>
                      <td><div className="font-medium">{row.name}</div><div className="text-xs text-muted-foreground">{row.code ?? '-'}</div></td>
                      <td><div className="w-28"><Progress value={row.score} /><div className="mt-1 text-xs">{row.score}/100</div></div></td>
                      <td><span className={cn('rounded px-2 py-0.5 text-xs font-medium', SEVERITY_CLASS[row.riskLevel])}>{SEVERITY_LABEL[row.riskLevel]}</span></td>
                      <td className="text-xs">{row.status} / {row.criticality}</td>
                      <td className="max-w-lg text-xs text-muted-foreground">{row.drivers.join(' | ') || 'Sem alertas'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b p-3 text-sm font-semibold">Monitoramentos fora do limite</div>
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead><tr><th className="text-left">Quando</th><th className="text-left">Controle</th><th className="text-left">Processo</th><th className="text-left">Valor</th></tr></thead>
              <tbody>
                {(data?.monitoring.recentOut ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center text-sm text-muted-foreground">Sem registros OUT recentes.</td></tr>
                ) : (
                  (data?.monitoring.recentOut ?? []).map((row) => (
                    <tr key={row.id}>
                      <td className="text-xs">{formatDate(row.measuredAt)}</td>
                      <td>{row.controlPlan?.parameter ?? row.controlPlan?.hazard?.name ?? '-'}</td>
                      <td>{row.controlPlan?.hazard?.process?.name ?? '-'}</td>
                      <td>{row.valueNum ?? row.valueText ?? '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {importOpen && <ImportDialog dataset={dataset} programId={programId} onClose={() => setImportOpen(false)} onImported={() => { setImportOpen(false); invalidate(); }} />}
    </div>
  );
}

function HealthCard({ label, value }: { label: string; value: number }) {
  const tone = value < 50 ? 'text-rose-700' : value < 75 ? 'text-amber-700' : 'text-emerald-700';
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold', tone)}>{value}</div>
      <Progress value={value} className="mt-2" />
    </div>
  );
}

function Metric({ label, value, risk }: { label: string; value: string | number; risk?: boolean }) {
  return (
    <div className={cn('rounded-lg border bg-card p-3', risk && 'border-rose-200 bg-rose-50')}>
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold', risk && 'text-rose-700')}>{typeof value === 'number' ? formatNumber(value) : value}</div>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{formatNumber(value)}</div>
    </div>
  );
}

function downloadPayload(payload: ExportPayload) {
  const blob = new Blob(['\ufeff' + payload.content], { type: payload.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = payload.filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${payload.rowCount} linha(s) exportada(s)`);
}

function ImportDialog({ dataset, programId, onClose, onImported }: { dataset: Dataset; programId: string; onClose: () => void; onImported: () => void }) {
  const [content, setContent] = useState('[\\n  { \"name\": \"Fornecedor Exemplo\" }\\n]');
  const importMut = useMutation({
    mutationFn: () => {
      let rows: unknown;
      try {
        rows = JSON.parse(content);
      } catch {
        throw new Error('JSON invalido.');
      }
      return api<{ created: number; errors: Array<{ row: number; message: string }>; total: number }>('/food-safety/import', { method: 'POST', json: { dataset, programId, rows } });
    },
    onSuccess: (result) => {
      toast.success(`${result.created}/${result.total} linha(s) importada(s)`);
      if (result.errors.length) toast.error(`${result.errors.length} linha(s) com erro`);
      onImported();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao importar'),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Importar {DATASET_LABEL[dataset]} por JSON</DialogTitle></DialogHeader>
        <Label>Linhas</Label>
        <Textarea rows={12} value={content} onChange={(e) => setContent(e.target.value)} />
        <p className="text-xs text-muted-foreground">Informe um array JSON. Os campos seguem os mesmos nomes usados nos cadastros da aba Cadeia e Recall.</p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button onClick={() => importMut.mutate()} disabled={importMut.isPending}>{importMut.isPending ? 'Importando...' : 'Importar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
