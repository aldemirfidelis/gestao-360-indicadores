'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileType2,
  KeyRound,
  ListChecks,
  Loader2,
  Monitor,
  Paperclip,
  PenLine,
  RefreshCw,
  Save,
  Sparkles,
  Upload,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { checkRequiredSections, isDocNode, type DocNode } from '@g360/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ReasonDialog, type ReasonDialogState } from '@/components/platform/reason-dialog';
import { cn } from '@/lib/utils';
import { downloadProtected, fetchProtectedBlob, uploadDocumentFile } from './files';
import { OnlineEditorDialog, type DesktopEditorSession, type EditorSession } from './online-editor-dialog';
import { StructuredEditor, StructuredViewer } from './structured-editor';
import { FORMAT_LABEL, formatBytes, formatDateTime, isEditable, type ContentFormat, type DocDetail, type DocFile, type DocOptions, type DocStatus } from './types';
import { EmptyState, Field, errorMessage, invalidateDocuments } from './ui';
import { AutosaveQueue } from './autosave-queue';

export type RegisterContentSave = (save: (() => Promise<void>) | null) => void;

const PdfViewer = dynamic(() => import('./pdf-viewer'), {
  ssr: false,
  loading: () => <div className="flex h-[70vh] min-h-[420px] items-center justify-center rounded-lg border text-sm text-muted-foreground">Carregando visualizador…</div>,
});

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const OFFICIAL_STATUSES: DocStatus[] = ['PUBLISHED', 'NEAR_EXPIRATION', 'EXPIRED', 'PERIODIC_REVIEW', 'REPLACED', 'OBSOLETE', 'ARCHIVED'];

/** Carrega um PDF protegido como Blob para o visualizador. */
function useProtectedPdf(path: string | null) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setBlob(null);
    setError(null);
    if (!path) return;
    setLoading(true);
    fetchProtectedBlob(path)
      .then((result) => !cancelled && setBlob(result))
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, nonce]);
  return { blob, error, loading, reload: () => setNonce((value) => value + 1) };
}

function PdfBox({ path, fileName, emptyText }: { path: string | null; fileName: string; emptyText: string }) {
  const pdf = useProtectedPdf(path);
  if (!path) return <EmptyState title={emptyText} />;
  if (pdf.loading) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando visualização…</div>;
  if (pdf.error) return <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Não foi possível carregar o PDF" description={pdf.error} action={<Button size="sm" variant="outline" onClick={pdf.reload}>Tentar de novo</Button>} />;
  if (!pdf.blob) return null;
  return <PdfViewer src={pdf.blob} fileName={fileName} className="h-[75vh] min-h-[480px]" />;
}

// ------------------------------------------------------------ editor visual

function StructuredContent({ doc, canEdit, initial, onFirstSave, registerSave }: { doc: DocDetail; canEdit: boolean; initial: DocNode | string | null; onFirstSave: () => void; registerSave: RegisterContentSave }) {
  const [state, setState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [live, setLive] = useState<DocNode | null>(isDocNode(doc.contentJson) ? doc.contentJson : null);
  const timer = useRef<number | undefined>(undefined);
  const firstSave = useRef(true);
  const saveRef = useRef<(value: DocNode) => Promise<void>>(async () => {});
  const queue = useMemo(() => new AutosaveQueue<DocNode>((value) => saveRef.current(value)), []);
  const sigla = doc.typeConfig?.sigla ?? null;

  saveRef.current = async (next) => {
    setState('saving');
    try {
      const result = await api<{ savedAt: string; status: string }>(`/documents/${doc.id}/content`, { method: 'PUT', json: { contentJson: next } });
      setSavedAt(result.savedAt);
      setState(queue.hasPending ? 'dirty' : 'saved');
      if (firstSave.current || result.status !== doc.status) {
        firstSave.current = false;
        onFirstSave();
      }
    } catch (error) {
      setState('error');
      toast.error(errorMessage(error, 'Não foi possível salvar o conteúdo.'));
      throw error;
    }
  };

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    await queue.flush();
  }, [queue]);

  useEffect(() => {
    registerSave(flush);
    return () => registerSave(null);
  }, [flush, registerSave]);

  const onChange = useCallback(
    (next: DocNode) => {
      queue.enqueue(next);
      setLive(next);
      setState('dirty');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush().catch(() => {}), 2000);
    },
    [flush, queue],
  );

  // HTML importado do Word: salva o documento já convertido pelo editor.
  const onReady = useCallback(
    (ready: DocNode) => {
      if (typeof initial === 'string') onChange(ready);
    },
    [initial, onChange],
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (queue.hasChanges) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.clearTimeout(timer.current);
      if (queue.hasChanges) void flush().catch(() => {});
    };
  }, [flush, queue]);

  const check = useMemo(() => checkRequiredSections(live, sigla), [live, sigla]);

  const importDocx = async (file: File) => {
    const result = await uploadDocumentFile<{ html: string; imagesSkipped: boolean }>('/documents/import/docx-html', file);
    if (result.imagesSkipped) toast.message('As imagens do arquivo eram grandes demais e não foram importadas.');
    return result.html;
  };

  if (!canEdit) {
    return (
      <div className="rounded-lg border bg-card px-6 py-5">
        {live ? <StructuredViewer value={live} /> : <p className="text-sm text-muted-foreground">Sem conteúdo.</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className={cn('flex items-center gap-1.5', state === 'error' ? 'text-status-red' : 'text-muted-foreground')}>
            {state === 'saving' && <><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando…</>}
            {state === 'dirty' && <><PenLine className="h-3.5 w-3.5" />Alterações não salvas</>}
            {state === 'saved' && <><CheckCircle2 className="h-3.5 w-3.5 text-status-green" />Salvo às {savedAt ? new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</>}
            {state === 'error' && <><AlertTriangle className="h-3.5 w-3.5" />Falha ao salvar</>}
            {state === 'idle' && 'Salvamento automático ligado'}
          </span>
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={state === 'saving' || (state !== 'dirty' && state !== 'error')} onClick={() => void flush().catch(() => {})}>
            <Save className="mr-1 h-3.5 w-3.5" /> Salvar agora
          </Button>
        </div>
        <StructuredEditor value={initial} onChange={onChange} onReady={onReady} sigla={sigla} onImportDocx={importDocx} minHeight="60vh" />
      </div>
      <aside className="space-y-3">
        <SectionChecklist check={check} sigla={sigla} />
        <QualityCheck doc={doc} />
      </aside>
    </div>
  );
}

function SectionChecklist({ check, sigla }: { check: ReturnType<typeof checkRequiredSections>; sigla: string | null }) {
  if (!check.required.length) {
    return (
      <Card>
        <CardContent className="p-3 text-xs text-muted-foreground">O tipo {sigla ?? ''} não tem seções obrigatórias definidas.</CardContent>
      </Card>
    );
  }
  const done = check.required.length - check.missing.length - check.empty.length;
  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm"><ListChecks className="h-4 w-4" />Seções do {sigla}</CardTitle>
        <CardDescription className="text-xs">{done} de {check.required.length} completas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 p-3 pt-0">
        {check.required.map((title) => {
          const missing = check.missing.includes(title);
          const empty = check.empty.includes(title);
          return (
            <p key={title} className={cn('flex items-center gap-1.5 text-xs', missing ? 'text-status-red' : empty ? 'text-status-yellow' : 'text-muted-foreground')}>
              {missing ? <XCircle className="h-3.5 w-3.5 shrink-0" /> : empty ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-status-green" />}
              <span className="truncate">{title}</span>
              {empty && <span className="ml-auto shrink-0 text-[10px]">vazia</span>}
            </p>
          );
        })}
      </CardContent>
    </Card>
  );
}

function QualityCheck({ doc }: { doc: DocDetail }) {
  const run = useMutation({
    mutationFn: () => api<{ missing: string[]; empty: string[]; ok: boolean; suggestions: string[]; usedAi: boolean }>(`/documents/${doc.id}/ai/check`, { method: 'POST', json: {} }),
    onError: (error) => toast.error(errorMessage(error)),
  });
  if (doc.confidentiality === 'CONFIDENTIAL') {
    return <p className="rounded-md border px-3 py-2 text-[11px] text-muted-foreground">Documento confidencial: a revisão de redação pela IA fica desligada.</p>;
  }
  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm"><Sparkles className="h-4 w-4" />Revisão de redação</CardTitle>
        <CardDescription className="text-xs">Sugestões da IA sobre clareza, responsáveis e critérios. Usa o conteúdo salvo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        <Button size="sm" variant="outline" className="w-full" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
          Revisar texto
        </Button>
        {run.data && (
          run.data.suggestions.length ? (
            <ul className="space-y-1.5">
              {run.data.suggestions.map((suggestion) => (
                <li key={suggestion} className="rounded bg-muted/40 px-2 py-1 text-xs">{suggestion}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{run.data.usedAi ? 'Nenhuma sugestão.' : 'IA indisponível ou texto curto demais para revisar.'}</p>
          )
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------- Word

function DocxContent({ doc, canEdit, latestDocx }: { doc: DocDetail; canEdit: boolean; latestDocx: DocFile | null }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<EditorSession | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const uploadRef = useRef<HTMLInputElement>(null);
  const online = doc.editor.configured;

  const openOnline = useMutation({
    mutationFn: (readOnly: boolean) => api<EditorSession>(`/documents/${doc.id}/${readOnly ? 'viewer' : 'editor'}/open`, { method: 'POST', json: {} }).then((result) => ({ ...result, readOnly })),
    onSuccess: (result) => {
      if (result.editorUrl && result.accessToken) setSession(result);
      else toast.message('Editor no navegador indisponível', { description: result.message ?? 'Baixe o Word, edite e envie a nova versão.' });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const openDesktop = useMutation({
    mutationFn: () => api<DesktopEditorSession>(`/documents/${doc.id}/editor/open-word`, { method: 'POST', json: {} }),
    onSuccess: (result) => {
      if (result.msWordUrl) {
        window.location.href = result.msWordUrl;
        toast.message('Abrindo no Word instalado', { description: 'Ao salvar no Word, a nova versão volta para o Gestão 360.' });
      } else {
        toast.message('Word instalado indisponível', { description: result.message });
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadDocumentFile(`/documents/${doc.id}/files/upload`, file, { purpose: 'MAIN_DOCX' }),
    onSuccess: () => {
      toast.success('Nova versão do Word enviada.');
      setPreviewKey((value) => value + 1);
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const closeEditor = () => {
    setSession(null);
    setPreviewKey((value) => value + 1);
    invalidateDocuments(qc);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <FileType2 className="h-8 w-8 shrink-0 text-status-blue" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{latestDocx?.fileName ?? 'Arquivo Word'}</p>
            <p className="text-xs text-muted-foreground">
              {latestDocx ? `${formatBytes(latestDocx.sizeBytes)} · atualizado em ${formatDateTime(latestDocx.createdAt)}` : 'O arquivo é gerado ao abrir pela primeira vez.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && online && (
              <Button size="sm" disabled={openOnline.isPending} onClick={() => openOnline.mutate(false)}>
                <PenLine className="mr-1.5 h-4 w-4" /> Editar no navegador
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="outline" disabled={openDesktop.isPending} onClick={() => openDesktop.mutate()}>
                <Monitor className="mr-1.5 h-4 w-4" /> Abrir no Word instalado
              </Button>
            )}
            {!canEdit && online && (
              <Button size="sm" variant="outline" disabled={openOnline.isPending} onClick={() => openOnline.mutate(true)}>
                <Eye className="mr-1.5 h-4 w-4" /> Visualizar no navegador
              </Button>
            )}
            {doc.capabilities.canDownloadDocx && latestDocx && (
              <Button size="sm" variant="outline" onClick={() => downloadProtected(`/documents/${doc.id}/files/${latestDocx.id}/download`, latestDocx.fileName)}>
                <Download className="mr-1.5 h-4 w-4" /> Baixar Word
              </Button>
            )}
            {canEdit && (
              <>
                <Button size="sm" variant="outline" disabled={upload.isPending} onClick={() => uploadRef.current?.click()}>
                  {upload.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                  Enviar nova versão
                </Button>
                <input
                  ref={uploadRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) upload.mutate(file);
                    event.target.value = '';
                  }}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>
      {!online && canEdit && (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Editor no navegador (Collabora, gratuito) não configurado neste servidor. Use o Word instalado ou baixe, edite e envie a nova versão.
        </p>
      )}
      <PdfBox key={previewKey} path={`/documents/${doc.id}/preview-pdf`} fileName={`${doc.code ?? doc.number}-previa.pdf`} emptyText="Sem prévia" />
      <OnlineEditorDialog session={session} onClose={closeEditor} />
    </div>
  );
}

// -------------------------------------------------------------- PDF pronto

function FileContent({ doc, canEdit, mainPdf }: { doc: DocDetail; canEdit: boolean; mainPdf: DocFile | null }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) => uploadDocumentFile(`/documents/${doc.id}/files/upload`, file, { purpose: 'MAIN_PDF' }),
    onSuccess: () => {
      toast.success('PDF enviado.');
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <div className="space-y-4">
      {canEdit && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex-1 text-sm">
              <p className="font-semibold">{mainPdf ? mainPdf.fileName : 'Nenhum PDF enviado'}</p>
              <p className="text-xs text-muted-foreground">O PDF é o conteúdo deste documento. Na publicação ele recebe o carimbo de controle e a página de assinaturas.</p>
            </div>
            <Button size="sm" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
              {upload.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              {mainPdf ? 'Trocar PDF' : 'Enviar PDF'}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                event.target.value = '';
              }}
            />
          </CardContent>
        </Card>
      )}
      <PdfBox path={mainPdf ? `/documents/${doc.id}/files/${mainPdf.id}/view` : null} fileName={mainPdf?.fileName ?? 'documento.pdf'} emptyText="Envie o PDF do documento para visualizar aqui." />
    </div>
  );
}

// ------------------------------------------------------- liberação de edição

function EditAccess({ doc, options }: { doc: DocDetail; options: DocOptions | undefined }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [reason, setReason] = useState<ReasonDialogState | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grant, setGrant] = useState({ requesterUserId: '', reason: '', expiresAt: '' });
  const caps = doc.capabilities;
  const mine = doc.editRequests.find((request) => request.requesterUserId === user?.id && ['REQUESTED', 'APPROVED', 'IN_PROGRESS'].includes(request.status));
  const toDecide = doc.editRequests.filter((request) => request.status === 'REQUESTED' && (request.operatorUserId === user?.id || caps.isManager));
  const active = doc.editRequests.filter((request) => ['APPROVED', 'IN_PROGRESS'].includes(request.status));

  const request = useMutation({
    mutationFn: (text: string) => api(`/documents/${doc.id}/edit-requests`, { method: 'POST', json: { reason: text } }),
    onSuccess: () => {
      toast.success('Pedido de edição enviado ao responsável.');
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const decide = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'approve' | 'reject' | 'complete'; note?: string }) => api(`/documents/edit-requests/${id}/${action}`, { method: 'POST', json: { note } }),
    onSuccess: () => {
      toast.success('Pedido atualizado.');
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const grantMutation = useMutation({
    mutationFn: () => api(`/documents/${doc.id}/edit-requests/grant`, { method: 'POST', json: { requesterUserId: grant.requesterUserId, reason: grant.reason || undefined, expiresAt: grant.expiresAt || undefined } }),
    onSuccess: () => {
      toast.success('Edição liberada para a pessoa.');
      setGrantOpen(false);
      setGrant({ requesterUserId: '', reason: '', expiresAt: '' });
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!isEditable(doc.status) && !toDecide.length && !active.length) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2">
        <div>
          <CardTitle className="flex items-center gap-1.5 text-sm"><KeyRound className="h-4 w-4" />Quem pode editar</CardTitle>
          <CardDescription className="text-xs">O responsável edita direto. Outras pessoas pedem liberação, que fica registrada.</CardDescription>
        </div>
        {caps.canEditContent && (
          <Button size="sm" variant="outline" onClick={() => setGrantOpen(true)}>
            <UserCheck className="mr-1.5 h-4 w-4" /> Liberar para alguém
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-2">
        {!caps.canEditContent && isEditable(doc.status) && (
          mine ? (
            <p className="text-sm">
              Seu pedido está <Badge variant="outline">{mine.status === 'REQUESTED' ? 'aguardando o responsável' : 'liberado'}</Badge>
            </p>
          ) : (
            <Button size="sm" onClick={() => setReason({ title: 'Pedir liberação para editar', label: 'O que você vai alterar', confirmLabel: 'Enviar pedido', onConfirm: (text) => request.mutate(text) })}>
              <PenLine className="mr-1.5 h-4 w-4" /> Pedir para editar
            </Button>
          )
        )}
        {toDecide.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center">
            <div className="flex-1 text-sm">
              <p className="font-medium">{item.requester?.name ?? 'Usuário'} pediu para editar</p>
              {item.reason && <p className="text-xs text-muted-foreground">{item.reason}</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => decide.mutate({ id: item.id, action: 'approve' })}>Liberar</Button>
              <Button size="sm" variant="outline" onClick={() => setReason({ title: 'Recusar pedido de edição', label: 'Motivo', confirmLabel: 'Recusar', destructive: true, onConfirm: (text) => decide.mutate({ id: item.id, action: 'reject', note: text }) })}>
                Recusar
              </Button>
            </div>
          </div>
        ))}
        {active.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
            <span>{item.requester?.name ?? 'Usuário'} · edição liberada{item.expiresAt ? ` até ${formatDateTime(item.expiresAt)}` : ''}</span>
            {(item.requesterUserId === user?.id || item.operatorUserId === user?.id || caps.isManager) && (
              <Button size="sm" variant="ghost" onClick={() => decide.mutate({ id: item.id, action: 'complete' })}>Encerrar</Button>
            )}
          </div>
        ))}
      </CardContent>
      <ReasonDialog state={reason} onClose={() => setReason(null)} />
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Liberar edição</DialogTitle></DialogHeader>
          <Field label="Pessoa">
            <NativeSelect value={grant.requesterUserId} onChange={(event) => setGrant({ ...grant, requesterUserId: event.target.value })}>
              <option value="">Escolha</option>
              {(options?.users ?? []).filter((person) => person.id !== user?.id).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Motivo"><Textarea rows={2} value={grant.reason} onChange={(event) => setGrant({ ...grant, reason: event.target.value })} /></Field>
          <Field label="Válida até (opcional)"><Input type="date" value={grant.expiresAt} onChange={(event) => setGrant({ ...grant, expiresAt: event.target.value })} /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancelar</Button>
            <Button disabled={!grant.requesterUserId || grantMutation.isPending} onClick={() => grantMutation.mutate()}>Liberar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ------------------------------------------------------------------ anexos

function Attachments({ doc }: { doc: DocDetail }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  // O PDF principal ("PDF pronto") é protegido e aparece no conteúdo, não aqui.
  const files = doc.files.filter((file) => ['ATTACHMENT', 'EVIDENCE', 'IMAGE'].includes(file.kind) && !file.protected);
  const upload = useMutation({
    mutationFn: (file: File) => uploadDocumentFile(`/documents/${doc.id}/files/upload`, file, { purpose: 'ATTACHMENT' }),
    onSuccess: () => {
      toast.success('Anexo enviado.');
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const canUpload = doc.capabilities.canEditMetadata;
  if (!files.length && !canUpload) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-4 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm"><Paperclip className="h-4 w-4" />Anexos</CardTitle>
        {canUpload && (
          <>
            <Button size="sm" variant="outline" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" /> Anexar
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.pptx,.txt,.csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                event.target.value = '';
              }}
            />
          </>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground">Formulários, fotos de referência e evidências ficam aqui (até 20 MB cada).</p>
        ) : (
          <ul className="space-y-1">
            {files.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40">
                <span className="min-w-0 truncate">{file.fileName}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {formatBytes(file.sizeBytes)}
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Baixar ${file.fileName}`} onClick={() => downloadProtected(`/documents/${doc.id}/files/${file.id}/download`, file.fileName)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------- painel

export function ContentPanel({ doc, options, registerSave: registerParentSave }: { doc: DocDetail; options: DocOptions | undefined; registerSave?: RegisterContentSave }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [htmlSeed, setHtmlSeed] = useState<{ html: string; key: number } | null>(null);
  const saveRef = useRef<(() => Promise<void>) | null>(null);
  const registerSave = useCallback<RegisterContentSave>((save) => {
    saveRef.current = save;
    registerParentSave?.(save);
  }, [registerParentSave]);
  const caps = doc.capabilities;
  const editableStatus = isEditable(doc.status);
  const approvedEdit = doc.editRequests.some((request) => request.requesterUserId === user?.id && ['APPROVED', 'IN_PROGRESS'].includes(request.status));
  const canEdit = editableStatus && (caps.canEditContent || approvedEdit);
  const latestDocx = doc.files.find((file) => file.kind === 'DOCX') ?? null;
  const currentVersionId = doc.versions[0]?.id ?? null;
  const mainPdf =
    doc.files.find((file) => file.kind === 'ATTACHMENT' && file.protected && file.mimeType === 'application/pdf' && (!currentVersionId || file.versionId === currentVersionId)) ?? null;
  // Vigente ou encerrado: mostra o PDF oficial. Em análise, mostra o conteúdo em análise.
  const published = OFFICIAL_STATUSES.includes(doc.status) && doc.versions.some((version) => version.pdfFileId);

  const changeFormat = useMutation({
    mutationFn: async (format: ContentFormat) => {
      await saveRef.current?.();
      return api<{ format: ContentFormat; html: string | null }>(`/documents/${doc.id}/content/format`, { method: 'POST', json: { format } });
    },
    onSuccess: (result) => {
      if (result.html) setHtmlSeed({ html: result.html, key: Date.now() });
      toast.success(`Formato alterado para ${FORMAT_LABEL[result.format]}.`);
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const refresh = useCallback(() => invalidateDocuments(qc), [qc]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Formato:</span>
          <Badge variant="outline">{FORMAT_LABEL[doc.contentFormat]}</Badge>
          {!editableStatus && <span className="text-xs text-muted-foreground">Conteúdo travado: abra uma nova revisão para alterar.</span>}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Trocar para</span>
            {(['STRUCTURED', 'DOCX', 'FILE'] as const).filter((format) => format !== doc.contentFormat).map((format) => (
              <Button
                key={format}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={changeFormat.isPending}
                onClick={() => {
                  const warning = format === 'FILE' ? ' O conteúdo passa a ser o PDF que você enviar.' : format === 'STRUCTURED' && doc.contentFormat === 'DOCX' ? ' Parte da formatação do Word pode se perder.' : '';
                  if (window.confirm(`Trocar o formato para ${FORMAT_LABEL[format]}?${warning}`)) changeFormat.mutate(format);
                }}
              >
                <RefreshCw className="mr-1 h-3 w-3" /> {FORMAT_LABEL[format]}
              </Button>
            ))}
          </div>
        )}
      </div>

      {published && doc.contentFormat !== 'STRUCTURED' ? (
        <PdfBox path={`/documents/${doc.id}/official-pdf?inline=1`} fileName={`${doc.code ?? doc.number}.pdf`} emptyText="Sem PDF oficial." />
      ) : doc.contentFormat === 'STRUCTURED' ? (
        <StructuredContent
          key={`${doc.id}:${htmlSeed?.key ?? ''}`}
          doc={doc}
          canEdit={canEdit}
          initial={htmlSeed?.html ?? (isDocNode(doc.contentJson) ? doc.contentJson : null)}
          onFirstSave={refresh}
          registerSave={registerSave}
        />
      ) : doc.contentFormat === 'DOCX' ? (
        <DocxContent doc={doc} canEdit={canEdit} latestDocx={latestDocx} />
      ) : doc.contentFormat === 'FILE' ? (
        <FileContent doc={doc} canEdit={canEdit} mainPdf={mainPdf} />
      ) : (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="whitespace-pre-wrap text-sm">{doc.content || doc.bodyText || 'Sem conteúdo.'}</p>
            {canEdit && (
              <Button size="sm" variant="outline" disabled={changeFormat.isPending} onClick={() => changeFormat.mutate('STRUCTURED')}>
                <RefreshCw className="mr-1.5 h-4 w-4" /> Passar para o editor visual
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <EditAccess doc={doc} options={options} />
        <Attachments doc={doc} />
      </div>
    </div>
  );
}
