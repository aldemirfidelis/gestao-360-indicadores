'use client';

import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { UserCheck, Download, AlertTriangle, Lock, Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api, ApiError, getAccessToken } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { CatalogManager } from '@/components/gestao-premio/catalog-manager';
import { usePrizeEligibleData, type PrizeEligibleReconciliation } from '@/hooks/gestao-premio/use-prize-eligible';

interface Issue { row: number; column?: string; message: string }
interface ImportPreview {
  fileName: string | null;
  mode: 'FULL_IMPORT' | 'EVENTS_APPEND';
  eligible: { total: number; ok: number; errors: Issue[]; warnings: Issue[]; unknownColumns: string[] };
  events: { total: number; ok: number; errors: Issue[]; warnings: Issue[]; unknownColumns: string[] };
  reconciliation: PrizeEligibleReconciliation | null;
  canCommit: boolean;
}

interface AtestadoPreview {
  fileName: string | null;
  total: number;
  ok: number;
  employeesAffected: number;
  errors: Issue[];
  warnings: Issue[];
  unknownColumns: string[];
  perEmployee: { registration: string; occurrences: number; totalDays: number }[];
  canCommit: boolean;
}

// Payload enviado p/ preview e commit (o servidor SEMPRE revalida no commit).
interface FilePayload { fileName: string; rawRows?: Record<string, unknown>[]; rawEvents?: Record<string, unknown>[]; xlsxBase64?: string }

async function parseCsvFile(file: File): Promise<Record<string, unknown>[]> {
  const Papa = (await import('papaparse')).default;

  return new Promise((resolve, reject) => {
    // dynamicTyping DESLIGADO: matrícula/CPF com zero à esquerda não podem virar número.
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => resolve(res.data ?? []),
      error: (err) => reject(new Error(err.message)),
    });
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

function IssueList({ title, issues, tone }: { title: string; issues: Issue[]; tone: 'error' | 'warn' }) {
  if (!issues.length) return null;
  return (
    <div className={`rounded border p-2 ${tone === 'error' ? 'border-red-300 bg-red-50/50' : 'border-amber-300 bg-amber-50/50'}`}>
      <p className={`mb-1 text-xs font-medium ${tone === 'error' ? 'text-red-700' : 'text-amber-700'}`}>{title} ({issues.length})</p>
      <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs">
        {issues.slice(0, 100).map((it, i) => (
          <li key={i}>Linha {it.row}{it.column ? ` · ${it.column}` : ''}: {it.message}</li>
        ))}
        {issues.length > 100 && <li className="text-muted-foreground">… e mais {issues.length - 100}</li>}
      </ul>
    </div>
  );
}

export function PrizeEligiblePage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['prize:eligible:manage']);

  const [competenceId, setCompetenceId] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [payload, setPayload] = useState<FilePayload | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const mainFileRef = useRef<HTMLInputElement>(null);
  const eventsFileRef = useRef<HTMLInputElement>(null);
  const [atestadosOpen, setAtestadosOpen] = useState(false);
  const [atePayload, setAtePayload] = useState<FilePayload | null>(null);
  const [atePreview, setAtePreview] = useState<AtestadoPreview | null>(null);
  const ateFileRef = useRef<HTMLInputElement>(null);

  const { competences, snapshot, isSnapshotLoading, recon, invalidateEligible } = usePrizeEligibleData(competenceId);

  const importMock = useMutation({
    mutationFn: () => api(`/prize/eligible/competence/${competenceId}/import`, { method: 'POST', json: { source: 'MANUAL', useMock: true, mockCount: 12 } }),
    onSuccess: (r: any) => {
      const rc = r.reconciliation;
      toast.success(`Lote ${r.job.lotVersion} importado: ${r.job.processed} colaborador(es) · +${rc.added.length}/-${rc.removed.length}/~${rc.changed.length}`);
      invalidateEligible();
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const previewMut = useMutation({
    mutationFn: (p: FilePayload) => api<ImportPreview>(`/prize/eligible/competence/${competenceId}/import/preview`, { method: 'POST', json: p }),
    onSuccess: (out) => {
      setPreview(out);
      if (out.canCommit) toast.success(`Prévia ok: ${out.eligible.ok} colaborador(es), ${out.events.ok} evento(s) — pronto para importar`);
      else toast.error(`Arquivo com ${out.eligible.errors.length + out.events.errors.length} erro(s) — corrija e reenvie`);
    },
    onError: (e: ApiError) => { setPreview(null); toast.error(e.message); },
  });

  const commitMut = useMutation({
    mutationFn: () => api(`/prize/eligible/competence/${competenceId}/import/file`, { method: 'POST', json: payload }),
    onSuccess: (r: any) => {
      toast.success(r.job ? `Lote ${r.job.lotVersion} importado (${r.job.processed} colaboradores)` : `${r.created} evento(s) registrados`);
      invalidateEligible();
      closeImport();
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  function closeImport() {
    setImportOpen(false);
    setPayload(null);
    setPreview(null);
    if (mainFileRef.current) mainFileRef.current.value = '';
    if (eventsFileRef.current) eventsFileRef.current.value = '';
  }

  const atePreviewMut = useMutation({
    mutationFn: (p: FilePayload) => api<AtestadoPreview>(`/prize/eligible/competence/${competenceId}/atestados/preview`, { method: 'POST', json: p }),
    onSuccess: (out) => {
      setAtePreview(out);
      if (out.canCommit) toast.success(`Prévia ok: ${out.ok} atestado(s) em ${out.employeesAffected} colaborador(es)`);
      else toast.error(`Arquivo com ${out.errors.length} erro(s) — corrija e reenvie`);
    },
    onError: (e: ApiError) => { setAtePreview(null); toast.error(e.message); },
  });
  const ateCommitMut = useMutation({
    mutationFn: () => api<{ created: number; deleted: number; employeesAffected: number }>(`/prize/eligible/competence/${competenceId}/atestados/file`, { method: 'POST', json: atePayload }),
    onSuccess: (r) => {
      toast.success(`${r.created} atestado(s) importados em ${r.employeesAffected} colaborador(es)${r.deleted ? ` (substituiu ${r.deleted} anterior(es))` : ''}`);
      invalidateEligible();
      closeAtestados();
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  function closeAtestados() {
    setAtestadosOpen(false);
    setAtePayload(null);
    setAtePreview(null);
    if (ateFileRef.current) ateFileRef.current.value = '';
  }

  async function handleAtestadoFile(file: File) {
    setAtePreview(null);
    try {
      const p: FilePayload = /\.xlsx$/i.test(file.name)
        ? { fileName: file.name, xlsxBase64: await fileToBase64(file) }
        : { fileName: file.name, rawRows: await parseCsvFile(file) };
      setAtePayload(p);
      atePreviewMut.mutate(p);
    } catch (err: any) {
      toast.error(`Falha ao ler arquivo: ${err.message}`);
    }
  }

  async function handleMainFile(file: File) {
    setPreview(null);
    try {
      let p: FilePayload;
      if (/\.xlsx$/i.test(file.name)) {
        p = { fileName: file.name, xlsxBase64: await fileToBase64(file) };
      } else {
        p = { fileName: file.name, rawRows: await parseCsvFile(file) };
      }
      setPayload(p);
      previewMut.mutate(p);
    } catch (err: any) {
      toast.error(`Falha ao ler arquivo: ${err.message}`);
    }
  }

  async function handleEventsFile(file: File) {
    if (!payload || payload.xlsxBase64) {
      toast.error('Eventos em arquivo separado valem apenas para CSV (no XLSX use a aba "Eventos")');
      return;
    }
    try {
      const p = { ...payload, rawEvents: await parseCsvFile(file) };
      setPayload(p);
      setPreview(null);
      previewMut.mutate(p);
    } catch (err: any) {
      toast.error(`Falha ao ler arquivo de eventos: ${err.message}`);
    }
  }

  async function downloadTemplate() {
    const token = getAccessToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
    const res = await fetch(`${apiUrl}/prize/eligible/template`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!res.ok) { toast.error('Erro ao baixar o modelo'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'modelo-base-elegivel.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  const r = recon?.reconciliation;
  const pr = preview?.reconciliation;

  return (
    <div>
      <PageHeader
        title="Colaboradores Elegíveis"
        eyebrow="Gestão de Prêmio"
        description="Base elegível por competência (Apdata). Retrato imutável por lote, CPF mascarado e conciliação de divergências."
        tone="view"
        breadcrumbs={[{ label: 'Gestão de Prêmio', href: '/gestao-premio' }, { label: 'Colaboradores Elegíveis' }]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground">Competência:</Label>
        <NativeSelect value={competenceId} onChange={(e) => setCompetenceId(e.target.value)} className="max-w-sm">
          <option value="">Selecione…</option>
          {competences.map((c) => <option key={c.id} value={c.id}>{c.program.code} — {c.label}</option>)}
        </NativeSelect>
        {canManage && competenceId && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <FileSpreadsheet className="mr-1 h-4 w-4" />Baixar modelo
            </Button>
            <Button onClick={() => setImportOpen(true)}>
              <Upload className="mr-1 h-4 w-4" />Importar arquivo
            </Button>
            <Button variant="outline" onClick={() => setAtestadosOpen(true)} title="Importa a planilha DatasAtestados (espelho de ponto) para a competência selecionada">
              <Upload className="mr-1 h-4 w-4" />Importar atestados
            </Button>
            <Button variant="ghost" onClick={() => importMock.mutate()} disabled={importMock.isPending}>
              <Download className="mr-1 h-4 w-4" />{importMock.isPending ? 'Importando…' : 'Base fictícia (homolog.)'}
            </Button>
          </div>
        )}
      </div>

      <CatalogManager canManage={canManage} />

      {!competenceId ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <UserCheck className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Selecione uma competência para ver/importar a base elegível.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {r && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4 text-amber-600" />Conciliação do último lote {recon?.job?.lotVersion ? `(v${recon.job.lotVersion})` : ''}</div>
                <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4 lg:grid-cols-7">
                  <Badge variant="secondary">+{r.added.length} novos</Badge>
                  <Badge variant="secondary">−{r.removed.length} saíram</Badge>
                  <Badge variant="secondary">~{r.changed.length} alterados</Badge>
                  <Badge variant="outline">{r.unchanged} iguais</Badge>
                  <Badge variant="outline">{r.flags.missingSalary.length} sem salário</Badge>
                  <Badge variant="outline">{r.flags.missingPosition.length} sem cargo</Badge>
                  <Badge variant="outline">{r.flags.terminated.length} desligados</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {isSnapshotLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : !snapshot?.employees.length ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma base importada para esta competência ainda.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
                  <span>{snapshot.total} colaborador(es) · lote corrente</span>
                  {!snapshot.canSeeSalary && <span className="flex items-center gap-1"><Lock className="h-3 w-3" />Salário oculto (requer permissão)</span>}
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Matrícula</th>
                      <th className="px-3 py-2 text-left">Nome</th>
                      <th className="px-3 py-2 text-left">CPF</th>
                      <th className="px-3 py-2 text-left">Cargo</th>
                      <th className="px-3 py-2 text-left">Área</th>
                      <th className="px-3 py-2 text-left">CC</th>
                      <th className="px-3 py-2 text-right">Salário</th>
                      <th className="px-3 py-2 text-left">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.employees.map((e) => (
                      <tr key={e.id} className={`border-b border-border/40 ${e.blocked ? 'bg-red-50/40' : ''}`}>
                        <td className="px-3 py-2 font-mono text-xs">{e.registration}</td>
                        <td className="px-3 py-2">{e.name}{e.events > 0 && <span className="ml-1 text-xs text-muted-foreground">({e.events} ev.)</span>}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{e.cpfMasked ?? '—'}</td>
                        <td className="px-3 py-2">{e.positionRef ?? <span className="text-amber-600">—</span>}</td>
                        <td className="px-3 py-2">{e.areaRef ?? '—'}</td>
                        <td className="px-3 py-2">{e.costCenterRef ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{e.baseSalary !== null ? e.baseSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : (snapshot.canSeeSalary ? '—' : '•••')}</td>
                        <td className="px-3 py-2">
                          {e.situation?.toUpperCase().startsWith('TERMIN')
                            ? <Badge variant="destructive">Desligado</Badge>
                            : <Badge variant="secondary">{e.situation}</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Importação manual (contingência do Apdata): prévia validada antes de gravar */}
      <Dialog open={importOpen} onOpenChange={(o) => !o && closeImport()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Importar base elegível (CSV/XLSX)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Contingência enquanto o conector Apdata não está ligado. Use o <button className="underline" onClick={downloadTemplate}>modelo XLSX</button> (abas
              Colaboradores + Eventos) ou um CSV com os mesmos cabeçalhos. A importação é <strong>tudo-ou-nada</strong>:
              qualquer linha com erro rejeita o arquivo. Nada é gravado antes de você confirmar a prévia.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Arquivo (CSV ou XLSX) *</Label>
                <input
                  ref={mainFileRef}
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleMainFile(f); }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-secondary-foreground"
                />
              </div>
              <div>
                <Label>Eventos (CSV separado — opcional)</Label>
                <input
                  ref={eventsFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  disabled={!payload || !!payload.xlsxBase64}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleEventsFile(f); }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-secondary-foreground disabled:opacity-50"
                />
              </div>
            </div>

            {previewMut.isPending && <p className="text-sm text-muted-foreground">Validando arquivo…</p>}

            {preview && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {preview.canCommit
                    ? <Badge className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" />Arquivo válido</Badge>
                    : <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Arquivo com erros</Badge>}
                  <Badge variant="secondary">{preview.eligible.ok}/{preview.eligible.total} colaborador(es)</Badge>
                  {preview.events.total > 0 && <Badge variant="secondary">{preview.events.ok}/{preview.events.total} evento(s)</Badge>}
                  {preview.mode === 'EVENTS_APPEND' && <Badge variant="outline">Somente eventos (anexa ao lote atual)</Badge>}
                </div>

                <IssueList title="Erros — colaboradores" issues={preview.eligible.errors} tone="error" />
                <IssueList title="Erros — eventos" issues={preview.events.errors} tone="error" />
                <IssueList title="Avisos — colaboradores" issues={preview.eligible.warnings} tone="warn" />
                <IssueList title="Avisos — eventos" issues={preview.events.warnings} tone="warn" />
                {[...preview.eligible.unknownColumns, ...preview.events.unknownColumns].length > 0 && (
                  <p className="text-xs text-amber-700">Colunas ignoradas (verifique digitação): {[...preview.eligible.unknownColumns, ...preview.events.unknownColumns].join(', ')}</p>
                )}

                {pr && (
                  <div className="rounded border border-border/60 p-2">
                    <p className="mb-1 text-xs font-medium">Prévia da conciliação contra o lote atual</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">+{pr.added.length} novos</Badge>
                      <Badge variant="secondary">−{pr.removed.length} saem</Badge>
                      <Badge variant="secondary">~{pr.changed.length} alterados</Badge>
                      <Badge variant="outline">{pr.unchanged} iguais</Badge>
                      <Badge variant="outline">{pr.flags.missingSalary.length} sem salário</Badge>
                      <Badge variant="outline">{pr.flags.terminated.length} desligados</Badge>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeImport}>Cancelar</Button>
            <Button
              onClick={() => commitMut.mutate()}
              disabled={!preview?.canCommit || commitMut.isPending || previewMut.isPending}
            >
              {commitMut.isPending ? 'Importando…' : preview?.mode === 'EVENTS_APPEND' ? 'Registrar eventos' : 'Confirmar importação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Importação de atestados (planilha DatasAtestados — espelho de ponto) */}
      <Dialog open={atestadosOpen} onOpenChange={(o) => !o && closeAtestados()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Importar atestados (DatasAtestados)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Contingência enquanto o Apdata não está ligado. Suba a planilha <strong>DatasAtestados</strong> (XLSX ou CSV) com as colunas
              <em> Id Contratado, Data Início, Data Fim, Quantidade</em>. Os atestados reduzem os <strong>Dias de Direito</strong> e,
              a partir do <strong>2º atestado</strong>, reduzem 20%/dia do prêmio (1º atestado abonado). Reimportar <strong>substitui</strong> os atestados desta competência.
            </p>
            <div>
              <Label>Arquivo DatasAtestados (CSV ou XLSX) *</Label>
              <input
                ref={ateFileRef}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleAtestadoFile(f); }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-secondary-foreground"
              />
            </div>

            {atePreviewMut.isPending && <p className="text-sm text-muted-foreground">Validando arquivo…</p>}

            {atePreview && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {atePreview.canCommit
                    ? <Badge className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" />Arquivo válido</Badge>
                    : <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Arquivo com erros</Badge>}
                  <Badge variant="secondary">{atePreview.ok}/{atePreview.total} atestado(s)</Badge>
                  <Badge variant="secondary">{atePreview.employeesAffected} colaborador(es)</Badge>
                </div>

                <IssueList title="Erros" issues={atePreview.errors} tone="error" />
                <IssueList title="Avisos" issues={atePreview.warnings} tone="warn" />
                {atePreview.unknownColumns.length > 0 && (
                  <p className="text-xs text-amber-700">Colunas ignoradas (verifique digitação): {atePreview.unknownColumns.join(', ')}</p>
                )}

                {atePreview.perEmployee.length > 0 && (
                  <div className="rounded border border-border/60 p-2">
                    <p className="mb-1 text-xs font-medium">Resumo por colaborador (top {atePreview.perEmployee.length} por dias)</p>
                    <div className="max-h-44 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground"><tr><th className="text-left">Matrícula</th><th className="text-right">Atestados</th><th className="text-right">Dias</th></tr></thead>
                        <tbody>
                          {atePreview.perEmployee.map((p) => (
                            <tr key={p.registration} className="border-t border-border/40">
                              <td className="py-0.5 font-mono">{p.registration}</td>
                              <td className="py-0.5 text-right">{p.occurrences}</td>
                              <td className="py-0.5 text-right">{p.totalDays}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAtestados}>Cancelar</Button>
            <Button onClick={() => ateCommitMut.mutate()} disabled={!atePreview?.canCommit || ateCommitMut.isPending || atePreviewMut.isPending}>
              {ateCommitMut.isPending ? 'Importando…' : 'Confirmar atestados'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
