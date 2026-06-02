'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format as formatSql } from 'sql-formatter';
import { AlertTriangle, Check, Download, Eraser, History, Play, Save, ShieldCheck, Sparkles, Star, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import type { ExecuteResult, SqlAnalysis, SavedQuery, QueryHistoryRow } from '@/components/database-admin/types';

const CodeEditor = dynamic(() => import('@/components/database-admin/code-editor').then((m) => m.CodeEditor), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-lg border bg-muted/30" />,
});

const RISK_LABEL: Record<string, { label: string; cls: string }> = {
  none: { label: 'Leitura', cls: 'pill-green' },
  low: { label: 'Baixo', cls: 'pill-green' },
  medium: { label: 'Médio', cls: 'pill-yellow' },
  high: { label: 'Alto', cls: 'pill-red' },
};

export default function SqlEditorPage() {
  const qc = useQueryClient();
  const [sqlText, setSqlText] = useState('SELECT * FROM "Indicator" LIMIT 50;');
  const [mode, setMode] = useState<'safe' | 'advanced'>('safe');
  const [analysis, setAnalysis] = useState<SqlAnalysis | null>(null);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [confirm, setConfirm] = useState<{ phrase: string } | null>(null);

  const history = useQuery<QueryHistoryRow[]>({
    queryKey: ['db-admin', 'query-history'],
    queryFn: () => api<QueryHistoryRow[]>('/admin/database/query/history'),
    refetchOnWindowFocus: false,
  });
  const favorites = useQuery<SavedQuery[]>({
    queryKey: ['db-admin', 'query-favorites'],
    queryFn: () => api<SavedQuery[]>('/admin/database/query/favorites'),
    refetchOnWindowFocus: false,
  });

  const validateMut = useMutation({
    mutationFn: () => api<SqlAnalysis>('/admin/database/query/validate', { method: 'POST', json: { sql: sqlText } }),
    onSuccess: (a) => {
      setAnalysis(a);
      toast.success(`Validado: ${a.statementType} · ${a.isReadOnly ? 'leitura' : 'escrita'} · risco ${a.risk}.`);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const executeMut = useMutation({
    mutationFn: (phrase?: string) =>
      api<ExecuteResult>('/admin/database/query/execute', { method: 'POST', json: { sql: sqlText, mode, confirmationPhrase: phrase } }),
    onSuccess: (res) => {
      setResult(res);
      setAnalysis(res.analysis);
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ['db-admin', 'query-history'] });
      toast.success(
        res.isReadOnly
          ? `${res.rowCount} linha(s) em ${res.durationMs} ms${res.truncated ? ' (truncado)' : ''}.`
          : `OK · ${res.rowsAffected ?? 0} linha(s) afetada(s) em ${res.durationMs} ms.`,
      );
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const saveFav = useMutation({
    mutationFn: (name: string) => api('/admin/database/query/favorites', { method: 'POST', json: { name, sql: sqlText } }),
    onSuccess: () => {
      toast.success('Consulta salva.');
      qc.invalidateQueries({ queryKey: ['db-admin', 'query-favorites'] });
    },
  });
  const delFav = useMutation({
    mutationFn: (id: string) => api(`/admin/database/query/favorites/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['db-admin', 'query-favorites'] }),
  });

  async function onExecute() {
    if (mode === 'advanced') {
      const a = await validateMut.mutateAsync().catch(() => null);
      if (a && a.requiresConfirmationPhrase) {
        setConfirm({ phrase: '' });
        return;
      }
    }
    executeMut.mutate(undefined);
  }

  function doFormat() {
    try {
      setSqlText(formatSql(sqlText, { language: 'postgresql' }));
    } catch {
      toast.error('Não foi possível formatar (SQL inválido?).');
    }
  }

  function exportCsv() {
    if (!result || result.rows.length === 0) return;
    const cols = result.columns;
    const header = cols.join(';');
    const lines = result.rows.map((r) =>
      cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(';'),
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resultado.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Editor SQL</h2>
          <p className="text-sm text-muted-foreground">Modo Seguro (somente leitura) por padrão. Modo Avançado exige confirmação reforçada.</p>
        </div>
        <div className="inline-flex rounded-md border bg-card/60 p-0.5">
          <button
            type="button"
            onClick={() => setMode('safe')}
            className={cn('inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium', mode === 'safe' ? 'bg-status-green text-white' : 'text-muted-foreground')}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Seguro
          </button>
          <button
            type="button"
            onClick={() => setMode('advanced')}
            className={cn('inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium', mode === 'advanced' ? 'bg-status-red text-white' : 'text-muted-foreground')}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Avançado
          </button>
        </div>
      </div>

      {mode === 'advanced' && (
        <div className="flex items-center gap-2 rounded-lg border border-status-red/40 bg-status-red/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-status-red" />
          <span><strong>Modo Avançado ativo.</strong> Comandos de escrita/estrutura (INSERT/UPDATE/DELETE/ALTER/DROP) rodam em transação e são auditados. Operações de alto risco exigem a frase de confirmação.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr,300px]">
        <div className="space-y-3">
          <CodeEditor value={sqlText} onChange={setSqlText} height="240px" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={onExecute} disabled={executeMut.isPending || validateMut.isPending}>
              <Play className="mr-2 h-4 w-4" /> Executar
            </Button>
            <Button variant="outline" onClick={() => validateMut.mutate()} disabled={validateMut.isPending}>
              <Check className="mr-2 h-4 w-4" /> Validar
            </Button>
            <Button variant="outline" onClick={doFormat}><Sparkles className="mr-2 h-4 w-4" /> Formatar</Button>
            <Button variant="outline" onClick={() => { setSqlText(''); setResult(null); setAnalysis(null); }}>
              <Eraser className="mr-2 h-4 w-4" /> Limpar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const name = window.prompt('Nome da consulta favorita:');
                if (name) saveFav.mutate(name);
              }}
            >
              <Save className="mr-2 h-4 w-4" /> Salvar
            </Button>
          </div>

          {analysis && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs">
              <span className={cn('pill', RISK_LABEL[analysis.risk]?.cls)}>Risco {RISK_LABEL[analysis.risk]?.label}</span>
              <span className="font-mono">{analysis.statementType}</span>
              <span className="text-muted-foreground">{analysis.isReadOnly ? 'somente-leitura' : 'escrita'}</span>
              {analysis.statementCount > 1 && <span className="text-status-red">{analysis.statementCount} comandos</span>}
              <span className="text-muted-foreground">· {analysis.reasons.join(' ')}</span>
            </div>
          )}

          {result && (
            <SectionCard
              title={`Resultado${result.truncated ? ' (truncado)' : ''}`}
              description={result.isReadOnly ? `${formatNumber(result.rowCount)} linha(s) · ${result.durationMs} ms` : `${result.rowsAffected ?? 0} linha(s) afetada(s) · ${result.durationMs} ms`}
              contentClassName="p-0"
              actions={
                result.rows.length > 0 ? (
                  <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>
                ) : null
              }
            >
              {result.rows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Sem linhas para exibir.</div>
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <table className="table-modern">
                    <thead>
                      <tr>{result.columns.map((c) => <th key={c} className="text-left">{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {result.rows.map((r, i) => (
                        <tr key={i}>
                          {result.columns.map((c) => (
                            <td key={c} className="max-w-[280px] truncate font-mono text-xs">
                              {r[c] === null || r[c] === undefined ? <span className="italic text-muted-foreground/60">NULL</span> : typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}
        </div>

        <div className="space-y-4">
          <SectionCard title="Favoritas" description="Consultas salvas." contentClassName="p-0">
            <div className="max-h-56 divide-y overflow-auto">
              {(favorites.data ?? []).length === 0 && <div className="p-3 text-xs text-muted-foreground">Nenhuma consulta salva.</div>}
              {(favorites.data ?? []).map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 p-2 text-xs">
                  <button type="button" className="flex min-w-0 items-center gap-1.5 text-left hover:text-primary" onClick={() => setSqlText(f.sql)}>
                    <Star className="h-3 w-3 shrink-0 text-status-yellow" />
                    <span className="truncate">{f.name}</span>
                  </button>
                  <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => delFav.mutate(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Histórico" description="Últimas execuções." contentClassName="p-0">
            <div className="max-h-72 divide-y overflow-auto">
              {(history.data ?? []).length === 0 && <div className="p-3 text-xs text-muted-foreground">Sem histórico.</div>}
              {(history.data ?? []).map((h) => (
                <button key={h.id} type="button" className="flex w-full items-start gap-2 p-2 text-left text-xs hover:bg-accent/35" onClick={() => setSqlText(h.sql)}>
                  <History className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate font-mono">{h.sql}</span>
                    <span className={cn('text-[10px]', h.success ? 'text-muted-foreground' : 'text-status-red')}>
                      {h.mode} · {h.success ? `${h.rowCount ?? 0} linhas · ${h.durationMs ?? 0}ms` : (h.message ?? 'erro')}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {confirm && analysis && (
        <Dialog open onOpenChange={(o) => !o && setConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-status-red"><AlertTriangle className="h-5 w-5" /> Confirmação reforçada</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>Esta é uma operação de <strong>alto risco</strong>:</p>
              <ul className="list-inside list-disc text-xs text-muted-foreground">{analysis.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
              <div>
                <Label>Digite exatamente: <span className="font-mono text-foreground">{analysis.confirmationPhrase}</span></Label>
                <Input value={confirm.phrase} onChange={(e) => setConfirm({ phrase: e.target.value })} autoFocus />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Button>
              <Button
                className="bg-status-red text-white hover:bg-status-red/90"
                disabled={confirm.phrase !== analysis.confirmationPhrase || executeMut.isPending}
                onClick={() => executeMut.mutate(confirm.phrase)}
              >
                Confirmar e executar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
