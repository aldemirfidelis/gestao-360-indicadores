'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, GitCompare, History, Loader2, Plus, Sparkles } from 'lucide-react';
import { diffStats, diffText } from '@g360/shared';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { downloadProtected } from './files';
import { formatDateTime, type DocDetail } from './types';
import { Field, StatusBadge, errorMessage, invalidateDocuments } from './ui';

interface CompareResult {
  from: { id: string; label: string; text: string } | null;
  to: { id: string; label: string; text: string; changeSummary: string | null };
  versions: Array<{ id: string; label: string; status: string; publicationDate: string | null }>;
}

const PDF_SOURCE: Record<string, string> = {
  NATIVE: 'PDF gerado do editor visual',
  CONVERTED: 'PDF convertido do Word',
  TEXT: 'PDF de texto (sem conversor)',
  FILE: 'PDF anexado',
};

export function RevisionsPanel({ doc }: { doc: DocDetail }) {
  const qc = useQueryClient();
  const versions = doc.versions;
  const [toId, setToId] = useState(versions[0]?.id ?? '');
  const [fromId, setFromId] = useState(versions[1]?.id ?? '');
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState('');
  const [aiSummary, setAiSummary] = useState<{ summary: string; usedAi: boolean } | null>(null);

  useEffect(() => {
    setToId(versions[0]?.id ?? '');
    setFromId(versions[1]?.id ?? '');
    setAiSummary(null);
  }, [versions]);

  const compare = useQuery<CompareResult>({
    queryKey: ['documents', doc.id, 'compare', fromId, toId],
    queryFn: () => api<CompareResult>(`/documents/${doc.id}/compare?${new URLSearchParams({ ...(fromId ? { from: fromId } : {}), ...(toId ? { to: toId } : {}) }).toString()}`),
    enabled: versions.length > 1 && Boolean(toId),
  });

  const ops = useMemo(() => (compare.data?.from ? diffText(compare.data.from.text, compare.data.to.text) : []), [compare.data]);
  const stats = useMemo(() => diffStats(ops), [ops]);

  const summarize = useMutation({
    mutationFn: () => api<{ summary: string; usedAi: boolean }>(`/documents/${doc.id}/ai/summary`, { method: 'POST', json: { fromId, toId } }),
    onSuccess: (result) => setAiSummary(result),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const newRevision = useMutation({
    mutationFn: () => api<DocDetail>(`/documents/${doc.id}/new-revision`, { method: 'POST', json: { reason: reason.trim(), summary: summary.trim() || null } }),
    onSuccess: () => {
      toast.success('Nova revisão aberta. Edite o conteúdo e envie para aprovação.');
      setRevisionOpen(false);
      setReason('');
      setSummary('');
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />Revisões</CardTitle>
            <CardDescription>Cada revisão guarda o conteúdo assinado, o hash e o PDF oficial publicado.</CardDescription>
          </div>
          {doc.capabilities.canRevise && (
            <Button size="sm" onClick={() => setRevisionOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova revisão
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {versions.map((version) => (
              <li key={version.id} className="flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {version.versionLabel}
                    <StatusBadge status={version.status} />
                    {version.pdfSource && <span className="text-xs font-normal text-muted-foreground">{PDF_SOURCE[version.pdfSource] ?? version.pdfSource}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {version.publicationDate ? `Publicada em ${formatDateTime(version.publicationDate)}` : `Aberta em ${formatDateTime(version.createdAt)}`}
                    {version.contentHash && <span className="ml-1">· hash {version.contentHash.slice(0, 12).toUpperCase()}</span>}
                  </p>
                  {(version.changeSummary || version.changeReason) && (
                    <p className="mt-1 whitespace-pre-wrap text-sm">{version.changeSummary || version.changeReason}</p>
                  )}
                </div>
                {version.pdfFileId && (
                  <Button size="sm" variant="outline" onClick={() => downloadProtected(`/documents/${doc.id}/files/${version.pdfFileId}/download`, `${doc.code ?? doc.number}-${version.versionLabel.replace(/\W+/g, '')}.pdf`)}>
                    <Download className="mr-1.5 h-4 w-4" /> PDF
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {versions.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><GitCompare className="h-4 w-4" />Comparar revisões</CardTitle>
            <CardDescription>Verde: texto incluído. Vermelho riscado: texto removido.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label="De" className="flex-1">
                <NativeSelect value={fromId} onChange={(event) => { setFromId(event.target.value); setAiSummary(null); }}>
                  {versions.filter((version) => version.id !== toId).map((version) => (
                    <option key={version.id} value={version.id}>{version.versionLabel}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Para" className="flex-1">
                <NativeSelect value={toId} onChange={(event) => { setToId(event.target.value); setAiSummary(null); }}>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>{version.versionLabel}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Button variant="outline" disabled={summarize.isPending || !compare.data?.from} onClick={() => summarize.mutate()}>
                {summarize.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                Resumir mudanças
              </Button>
            </div>

            {aiSummary && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <p className="mb-1 text-xs font-medium text-primary">{aiSummary.usedAi ? 'Resumo da IA (confira antes de usar)' : 'Resumo automático'}</p>
                <p className="whitespace-pre-wrap text-sm">{aiSummary.summary}</p>
              </div>
            )}

            {compare.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Comparando…</p>
            ) : compare.data?.from ? (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="border-status-green/40 text-status-green">+{stats.inserted} palavra(s)</Badge>
                  <Badge variant="outline" className="border-status-red/40 text-status-red">−{stats.deleted} palavra(s)</Badge>
                  <Badge variant="outline">{stats.unchanged} sem mudança</Badge>
                </div>
                <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg border bg-card px-4 py-3 text-sm leading-relaxed">
                  {ops.map((op, index) => (
                    <span
                      key={index}
                      className={cn(
                        op.type === 'insert' && 'rounded-sm bg-status-green/15 text-status-green',
                        op.type === 'delete' && 'rounded-sm bg-status-red/10 text-status-red line-through',
                      )}
                    >
                      {op.text}
                    </span>
                  ))}
                  {ops.length === 0 && <span className="text-muted-foreground">Sem diferenças de texto.</span>}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Escolha duas revisões para comparar.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={revisionOpen} onOpenChange={(open) => !newRevision.isPending && setRevisionOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir nova revisão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">A revisão vigente continua valendo até a nova ser aprovada e publicada.</p>
          <Field label="Motivo" required>
            <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: mudança no equipamento da linha 2." />
          </Field>
          <Field label="O que vai mudar (opcional)">
            <Textarea rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionOpen(false)}>Cancelar</Button>
            <Button disabled={reason.trim().length < 3 || newRevision.isPending} onClick={() => newRevision.mutate()}>
              {newRevision.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Abrir revisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
