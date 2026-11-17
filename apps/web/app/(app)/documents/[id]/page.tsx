'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BookOpen,
  BookOpenCheck,
  CalendarClock,
  Download,
  Eye,
  FileType2,
  Loader2,
  Lock,
  PenLine,
  RotateCcw,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ReasonDialog, type ReasonDialogState } from '@/components/platform/reason-dialog';
import { formatDate } from '@/lib/utils';
import { ActivityPanel } from '@/components/documents/activity-panel';
import { ContentPanel } from '@/components/documents/content-panel';
import { DistributionPanel } from '@/components/documents/distribution-panel';
import { fetchProtectedBlob, downloadProtected } from '@/components/documents/files';
import { AccessPanel, ChangeRequestsPanel, ExternalPanel, LinksPanel } from '@/components/documents/governance-panels';
import { QrLabelButton } from '@/components/documents/qr-label';
import { RevisionsPanel } from '@/components/documents/revisions-panel';
import { WorkflowPanel } from '@/components/documents/workflow-panel';
import {
  CONFIDENTIALITY_LABEL,
  FORMAT_LABEL,
  TYPE_LABEL,
  formatDateTime,
  isEditable,
  isPublishedLike,
  toInputDate,
  type DocDetail,
  type DocOptions,
} from '@/components/documents/types';
import { ConfidentialityBadge, EmptyState, Field, InfoTile, StatusBadge, errorMessage, invalidateDocuments, useDocOptions } from '@/components/documents/ui';

const TABS = ['geral', 'conteudo', 'fluxo', 'leitura', 'revisoes', 'vinculos', 'acesso', 'solicitacoes', 'atividade'] as const;
type Tab = (typeof TABS)[number];

/** Abre um PDF protegido em outra aba (a aba abre antes, para não ser bloqueada). */
async function openProtectedPdf(path: string) {
  const popup = window.open('', '_blank');
  try {
    const blob = await fetchProtectedBlob(path);
    const url = URL.createObjectURL(blob);
    if (popup) popup.location.href = url;
    else window.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    popup?.close();
    toast.error(errorMessage(error, 'Não foi possível abrir o PDF.'));
  }
}

// ----------------------------------------------------------------- dados

function MetadataCard({ doc, options }: { doc: DocDetail; options: DocOptions | undefined }) {
  const qc = useQueryClient();
  const canEdit = doc.capabilities.canEditMetadata;
  const locked = !isEditable(doc.status);
  const initial = useMemo(
    () => ({
      title: doc.title,
      code: doc.code ?? '',
      description: doc.description ?? '',
      orgNodeId: doc.orgNodeId ?? '',
      ownerUserId: doc.ownerUserId ?? '',
      indicatorId: doc.indicatorId ?? '',
      validFrom: toInputDate(doc.validFrom),
      validUntil: toInputDate(doc.validUntil),
      reviewIntervalMonths: doc.reviewIntervalMonths ? String(doc.reviewIntervalMonths) : '',
    }),
    [doc],
  );
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);
  const changed = (Object.keys(form) as Array<keyof typeof form>).filter((key) => form[key] !== initial[key]);

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {};
      for (const key of changed) {
        const value = form[key];
        if (key === 'reviewIntervalMonths') payload[key] = value ? Number(value) : null;
        else payload[key] = value === '' ? null : value;
      }
      return api(`/documents/${doc.id}`, { method: 'PATCH', json: payload });
    },
    onSuccess: () => {
      toast.success('Dados atualizados.');
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const patch = (next: Partial<typeof form>) => setForm((current) => ({ ...current, ...next }));
  const disabled = !canEdit;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dados do documento</CardTitle>
        {locked && canEdit && <CardDescription>Título, código e objetivo ficam travados fora da elaboração. Área, responsável e datas podem mudar.</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Field label="Título" className="sm:col-span-2"><Input value={form.title} disabled={disabled || locked} onChange={(event) => patch({ title: event.target.value })} /></Field>
        <Field label="Objetivo / resumo" className="sm:col-span-2"><Textarea rows={2} value={form.description} disabled={disabled || locked} onChange={(event) => patch({ description: event.target.value })} /></Field>
        <Field label="Código"><Input value={form.code} disabled={disabled || locked} onChange={(event) => patch({ code: event.target.value })} /></Field>
        <Field label="Área">
          <NativeSelect value={form.orgNodeId} disabled={disabled} onChange={(event) => patch({ orgNodeId: event.target.value })}>
            <option value="">Empresa toda</option>
            {(options?.orgNodes ?? []).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Responsável (elabora)">
          <NativeSelect value={form.ownerUserId} disabled={disabled} onChange={(event) => patch({ ownerUserId: event.target.value })}>
            <option value="">Quem criou</option>
            {(options?.users ?? []).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Indicador relacionado">
          <NativeSelect value={form.indicatorId} disabled={disabled} onChange={(event) => patch({ indicatorId: event.target.value })}>
            <option value="">Nenhum</option>
            {(options?.indicators ?? []).map((indicator) => <option key={indicator.id} value={indicator.id}>{indicator.code ? `${indicator.code} · ` : ''}{indicator.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Início da vigência"><Input type="date" value={form.validFrom} disabled={disabled} onChange={(event) => patch({ validFrom: event.target.value })} /></Field>
        <Field label="Validade"><Input type="date" value={form.validUntil} disabled={disabled} onChange={(event) => patch({ validUntil: event.target.value })} /></Field>
        <Field label="Revisão periódica (meses)"><Input type="number" min={1} max={120} value={form.reviewIntervalMonths} disabled={disabled} onChange={(event) => patch({ reviewIntervalMonths: event.target.value })} /></Field>
        {canEdit && (
          <div className="flex items-end">
            <Button size="sm" disabled={!changed.length || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Salvar dados
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LifecycleCard({ doc }: { doc: DocDetail }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [reason, setReason] = useState<ReasonDialogState | null>(null);
  const caps = doc.capabilities;
  const transition = useMutation({
    mutationFn: ({ action, comment }: { action: string; comment: string }) => api(`/documents/${doc.id}/${action}`, { method: 'POST', json: { comment } }),
    onSuccess: () => {
      toast.success('Status atualizado.');
      invalidateDocuments(qc);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: () => api(`/documents/${doc.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Documento excluído.');
      invalidateDocuments(qc);
      router.push('/documents');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const ask = (title: string, action: string, description: string, destructive = false) =>
    setReason({ title, description, label: 'Justificativa', confirmLabel: title, destructive, onConfirm: (comment) => transition.mutate({ action, comment }) });

  const published = isPublishedLike(doc.status);
  const actions = [
    published && doc.status !== 'PERIODIC_REVIEW' && caps.canEditMetadata && (
      <Button key="periodic" size="sm" variant="outline" onClick={() => ask('Iniciar revisão periódica', 'periodic-review', 'Marca o documento para revisão. Ele continua vigente até a nova revisão ser publicada.')}>
        <RotateCcw className="mr-1.5 h-4 w-4" /> Revisão periódica
      </Button>
    ),
    (published || doc.status === 'REPLACED') && caps.canObsolete && (
      <Button key="obsolete" size="sm" variant="outline" onClick={() => ask('Tornar obsoleto', 'obsolete', 'O documento sai de uso: some do acervo vigente e as leituras pendentes são canceladas. Confira a aba Vínculos antes.', true)}>
        <XCircle className="mr-1.5 h-4 w-4" /> Tornar obsoleto
      </Button>
    ),
    ['EXPIRED', 'REPLACED', 'OBSOLETE'].includes(doc.status) && caps.canObsolete && (
      <Button key="archive" size="sm" variant="outline" onClick={() => ask('Arquivar', 'archive', 'Guarda o documento no arquivo morto, respeitando a temporalidade.')}>
        <Archive className="mr-1.5 h-4 w-4" /> Arquivar
      </Button>
    ),
    isEditable(doc.status) && caps.canEditMetadata && (
      <Button key="cancel" size="sm" variant="outline" onClick={() => ask('Cancelar documento', 'cancel', 'Encerra o documento sem publicar.', true)}>
        <XCircle className="mr-1.5 h-4 w-4" /> Cancelar
      </Button>
    ),
    caps.canDelete && !published && (
      <Button key="delete" size="sm" variant="outline" className="text-status-red" onClick={() => window.confirm('Excluir este documento? O histórico fica guardado na auditoria.') && remove.mutate()}>
        <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
      </Button>
    ),
  ].filter(Boolean);

  if (!actions.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ciclo de vida</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">{actions}</CardContent>
      <ReasonDialog state={reason} onClose={() => setReason(null)} />
    </Card>
  );
}

function OverviewTab({ doc, options }: { doc: DocDetail; options: DocOptions | undefined }) {
  const approvers = doc.workflow.approvers.map((person) => person.name).join(', ');
  const reviewers = doc.workflow.reviewers.map((person) => person.name).join(', ');
  const current = doc.versions[0];
  const external = doc.type === 'EXTERNAL' || doc.typeConfig?.sigla === 'EXT' || Boolean(doc.externalMetadata);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <MetadataCard doc={doc} options={options} />
        {external && <ExternalPanel doc={doc} />}
        <LifecycleCard doc={doc} />
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <InfoTile label="Tipo" value={doc.typeConfig ? `${doc.typeConfig.sigla} · ${doc.typeConfig.name}` : TYPE_LABEL[doc.type]} className="col-span-2" />
          <InfoTile label="Revisão" value={current?.versionLabel ?? '—'} />
          <InfoTile label="Formato" value={FORMAT_LABEL[doc.contentFormat]} />
          <InfoTile label="Classificação" value={CONFIDENTIALITY_LABEL[doc.confidentiality]} />
          <InfoTile label="Área" value={doc.orgNode?.name ?? 'Empresa toda'} />
          <InfoTile label="Responsável" value={doc.owner?.name ?? doc.createdBy?.name ?? '—'} className="col-span-2" />
          <InfoTile label="Revisores" value={reviewers || 'Sem revisão'} className="col-span-2" />
          <InfoTile label="Aprovadores" value={approvers || 'Defina no Fluxo'} className="col-span-2" />
          <InfoTile label="Publicado em" value={doc.publishedAt ? formatDate(doc.publishedAt) : '—'} />
          <InfoTile label="Validade" value={doc.validUntil ? formatDate(doc.validUntil) : 'Sem vencimento'} />
          <InfoTile label="Leitura obrigatória" value={doc.distribution.readRequired ? `${doc.distribution.adhesion ?? 0}% de adesão` : 'Não'} />
          <InfoTile label="Atualizado" value={formatDateTime(doc.updatedAt)} />
        </div>
        {doc.retentionUntil && <p className="text-xs text-muted-foreground">Guarda até {formatDate(doc.retentionUntil)} (temporalidade).</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ página

function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const optionsQuery = useDocOptions();
  const options = optionsQuery.data;
  const requested = params.get('tab');
  const [tab, setTab] = useState<Tab>(TABS.includes(requested as Tab) ? (requested as Tab) : 'geral');
  const saveContent = useRef<(() => Promise<void>) | null>(null);
  const changingTab = useRef(false);
  const registerSave = useCallback((save: (() => Promise<void>) | null) => { saveContent.current = save; }, []);
  useEffect(() => {
    if (requested && TABS.includes(requested as Tab)) setTab(requested as Tab);
    else if (params.get('edit') === '1') setTab('conteudo');
  }, [requested, params]);

  const detail = useQuery<DocDetail>({ queryKey: ['documents', id], queryFn: () => api<DocDetail>(`/documents/${id}`), enabled: Boolean(id) });
  const doc = detail.data;

  const changeTab = async (value: string) => {
    if (changingTab.current) return;
    changingTab.current = true;
    try {
      await saveContent.current?.();
    } catch {
      changingTab.current = false;
      return; // A mensagem de falha aparece no editor; preserve o conteúdo na tela.
    }
    setTab(value as Tab);
    const next = new URLSearchParams(params.toString());
    next.set('tab', value);
    next.delete('edit');
    router.replace(`/documents/${id}?${next.toString()}`, { scroll: false });
    changingTab.current = false;
  };

  if (detail.isLoading) {
    return <div className="space-y-3"><div className="h-24 animate-pulse rounded-xl bg-muted/40" /><div className="h-96 animate-pulse rounded-xl bg-muted/30" /></div>;
  }
  if (detail.isError || !doc) {
    return (
      <EmptyState
        icon={<Lock className="h-5 w-5" />}
        title="Documento indisponível"
        description={errorMessage(detail.error, 'Ele pode ter sido excluído ou você não tem acesso.')}
        action={<Button size="sm" variant="outline" asChild><Link href="/documents"><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar ao acervo</Link></Button>}
        className="mt-10"
      />
    );
  }

  const caps = doc.capabilities;
  const hasOfficial = doc.versions.some((version) => version.pdfFileId);
  const myRead = doc.distribution.mine;
  const code = doc.code ?? `#${doc.number}`;
  const openRequests = doc.changeRequests.filter((request) => request.status === 'OPEN').length;

  return (
    <div className="space-y-4">
      <PageHeader
        compact
        breadcrumbs={[{ label: 'Documentos', href: '/documents' }, { label: code }]}
        title={doc.title}
        description={`${code} · ${doc.typeConfig?.name ?? TYPE_LABEL[doc.type]} · ${doc.versions[0]?.versionLabel ?? ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/documents/${doc.id}/leitor`}><BookOpen className="mr-1.5 h-4 w-4" />Modo leitura</Link>
            </Button>
            {hasOfficial && (
              <Button size="sm" variant="outline" onClick={() => downloadProtected(`/documents/${doc.id}/official-pdf`, `${code}.pdf`)}>
                <Download className="mr-1.5 h-4 w-4" />PDF oficial
              </Button>
            )}
            {!isPublishedLike(doc.status) && (
              <Button size="sm" variant="outline" onClick={() => void openProtectedPdf(`/documents/${doc.id}/preview-pdf`)}>
                <Eye className="mr-1.5 h-4 w-4" />Prévia em PDF
              </Button>
            )}
            {caps.canDownloadDocx && doc.contentFormat !== 'FILE' && (
              <Button size="sm" variant="outline" onClick={() => downloadProtected(`/documents/${doc.id}/export/docx`, `${code}.docx`)}>
                <FileType2 className="mr-1.5 h-4 w-4" />Word
              </Button>
            )}
            <QrLabelButton documentId={doc.id} code={doc.code} title={doc.title} />
          </div>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={doc.status} />
          <ConfidentialityBadge level={doc.confidentiality} />
          {doc.validUntil && (
            <span className={doc.isExpired ? 'text-xs font-medium text-status-red' : 'text-xs text-muted-foreground'}>
              {doc.isExpired ? 'Venceu em' : 'Válido até'} {formatDate(doc.validUntil)}
            </span>
          )}
        </div>
      </PageHeader>

      {doc.workflow.myStepId && tab !== 'fluxo' && (
        <button type="button" onClick={() => changeTab('fluxo')} className="flex w-full items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-left text-sm hover:bg-primary/10">
          <PenLine className="h-5 w-5 shrink-0 text-primary" />
          <span className="flex-1"><strong>{doc.workflow.myRole === 'REVIEW' ? 'Sua revisão' : 'Sua aprovação'} é necessária.</strong> Leia o conteúdo e assine na aba Fluxo.</span>
        </button>
      )}
      {myRead?.status === 'PENDING' && (
        <Link href={`/documents/${doc.id}/leitor`} className="flex items-center gap-3 rounded-lg border border-status-blue/40 bg-status-blue/5 px-4 py-3 text-sm hover:bg-status-blue/10">
          <BookOpenCheck className="h-5 w-5 shrink-0 text-status-blue" />
          <span className="flex-1"><strong>Leitura obrigatória pendente.</strong> {myRead.dueAt ? `Prazo ${formatDate(myRead.dueAt)}.` : ''} Abra o modo leitura e confirme.</span>
        </Link>
      )}
      {doc.status === 'SCHEDULED_PUBLICATION' && (
        <p className="flex items-center gap-2 rounded-lg border border-status-green/40 bg-status-green/5 px-4 py-2.5 text-sm">
          <CalendarClock className="h-4 w-4 text-status-green" />
          Publicação agendada{doc.versions[0]?.publicationDate ? ` para ${formatDateTime(doc.versions[0].publicationDate)}` : ''}.
        </p>
      )}
      {doc.isExpired && isPublishedLike(doc.status) && (
        <p className="flex items-center gap-2 rounded-lg border border-status-red/40 bg-status-red/5 px-4 py-2.5 text-sm">
          <AlertTriangle className="h-4 w-4 text-status-red" />
          Documento vencido. {caps.canRevise ? 'Abra uma nova revisão na aba Revisões.' : 'Avise o responsável.'}
        </p>
      )}

      <Tabs value={tab} onValueChange={changeTab}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="flex-nowrap">
            <TabsTrigger value="geral">Visão geral</TabsTrigger>
            <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
            <TabsTrigger value="fluxo">Fluxo{doc.workflow.myStepId ? ' •' : ''}</TabsTrigger>
            <TabsTrigger value="leitura">Leitura</TabsTrigger>
            <TabsTrigger value="revisoes">Revisões</TabsTrigger>
            <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
            {caps.canManageAccess && <TabsTrigger value="acesso">Acesso</TabsTrigger>}
            <TabsTrigger value="solicitacoes">Solicitações{openRequests ? ` (${openRequests})` : ''}</TabsTrigger>
            <TabsTrigger value="atividade">Atividade</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="geral"><OverviewTab doc={doc} options={options} /></TabsContent>
        <TabsContent value="conteudo"><ContentPanel doc={doc} options={options} registerSave={registerSave} /></TabsContent>
        <TabsContent value="fluxo"><WorkflowPanel doc={doc} options={options} /></TabsContent>
        <TabsContent value="leitura"><DistributionPanel doc={doc} options={options} /></TabsContent>
        <TabsContent value="revisoes"><RevisionsPanel doc={doc} /></TabsContent>
        <TabsContent value="vinculos"><LinksPanel doc={doc} /></TabsContent>
        {caps.canManageAccess && <TabsContent value="acesso"><AccessPanel doc={doc} options={options} /></TabsContent>}
        <TabsContent value="solicitacoes"><ChangeRequestsPanel doc={doc} /></TabsContent>
        <TabsContent value="atividade"><ActivityPanel doc={doc} options={options} /></TabsContent>
      </Tabs>
    </div>
  );
}

export default function DocumentDetailPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando documento…</div>}>
      <DocumentDetail />
    </Suspense>
  );
}
