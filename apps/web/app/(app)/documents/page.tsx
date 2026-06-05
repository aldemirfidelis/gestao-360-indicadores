'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  CheckCircle2,
  Download,
  Edit,
  Eye,
  FileText,
  Filter,
  History,
  Layers,
  MessageSquare,
  Plus,
  RotateCcw,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Table2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { MetricCard } from '@/components/platform/metric-card';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api, getAccessToken } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

type DocStatus =
  | 'DRAFT'
  | 'IN_DEVELOPMENT'
  | 'WAITING_REVIEW'
  | 'REVIEW'
  | 'IN_REVIEW'
  | 'ADJUSTMENTS_REQUESTED'
  | 'REVIEWED'
  | 'WAITING_APPROVAL'
  | 'IN_APPROVAL'
  | 'REJECTED'
  | 'APPROVED'
  | 'SCHEDULED_PUBLICATION'
  | 'PUBLISHED'
  | 'NEAR_EXPIRATION'
  | 'EXPIRED'
  | 'PERIODIC_REVIEW'
  | 'REPLACED'
  | 'OBSOLETE'
  | 'ARCHIVED'
  | 'CANCELLED';

type DocType =
  | 'POLICY'
  | 'PROCEDURE'
  | 'INSTRUCTION'
  | 'MANUAL'
  | 'FORM'
  | 'TEMPLATE'
  | 'RECORD'
  | 'INTERNAL_STANDARD'
  | 'GUIDELINE'
  | 'REGULATION'
  | 'FLOWCHART'
  | 'PLAN'
  | 'REPORT'
  | 'CHECKLIST'
  | 'TECHNICAL_SPECIFICATION'
  | 'EXTERNAL'
  | 'OTHER';

type FileKind = 'DOCX' | 'PDF' | 'TEMPLATE' | 'ATTACHMENT' | 'EVIDENCE' | 'IMAGE' | 'TEMPORARY';

interface Doc {
  id: string;
  number: number;
  code: string | null;
  title: string;
  description: string | null;
  type: DocType;
  status: DocStatus;
  version: number;
  content: string | null;
  externalUrl: string | null;
  changeNote: string | null;
  validFrom: string | null;
  validUntil: string | null;
  reviewIntervalMonths: number | null;
  approvedAt: string | null;
  publishedAt: string | null;
  isExpired: boolean;
  needsReview: boolean;
  daysToExpire: number | null;
  orgNodeId: string | null;
  indicatorId: string | null;
  ownerUserId: string | null;
  approverUserId: string | null;
  orgNode: { id: string; name: string; type: string } | null;
  indicator: { id: string; name: string; code: string | null; ownerNodeId: string } | null;
  owner: { id: string; name: string; email: string } | null;
  approver: { id: string; name: string; email: string } | null;
}

interface DocDetail extends Doc {
  editor: {
    configured: boolean;
    provider: string;
    mode: 'ONLINE' | 'MANUAL';
    url: string | null;
    autosave: boolean;
    concurrentEditing: boolean;
    message?: string;
  };
  versions: Array<{
    id: string;
    revisionNumber: number;
    versionLabel: string;
    status: DocStatus;
    changeReason: string | null;
    changeSummary: string | null;
    publicationDate: string | null;
    expirationDate: string | null;
    docxFileId: string | null;
    pdfFileId: string | null;
    createdAt: string;
  }>;
  files: Array<{
    id: string;
    kind: FileKind;
    versionId: string | null;
    fileName: string;
    mimeType: string | null;
    sizeBytes: number | null;
    hashSha256: string | null;
    createdAt: string;
  }>;
  statusHistory: Array<{ id: string; statusFrom: string | null; statusTo: string; comment: string | null; createdAt: string }>;
  approvals: Array<{ id: string; decision: string; approverUserId: string | null; comment: string | null; decidedAt: string | null; createdAt: string }>;
  reviewRequests: Array<{ id: string; status: string; comment: string; dueAt: string | null; answer: string | null; createdAt: string }>;
  comments: Array<{ id: string; body: string; userId: string | null; resolvedAt: string | null; createdAt: string }>;
  auditLogs: Array<{ id: string; action: string; reason: string | null; result: string; createdAt: string }>;
  tags: Array<{ id: string; name: string; color: string | null }>;
}

interface DocSummary {
  total: number;
  published: number;
  draft: number;
  waitingApproval: number;
  expired: number;
  needsReview: number;
  obsolete: number;
  expiringSoon: Array<Pick<Doc, 'id' | 'number' | 'code' | 'title' | 'type' | 'status' | 'validUntil' | 'isExpired' | 'daysToExpire' | 'orgNode' | 'owner'>>;
}

interface DocOptions {
  orgNodes: Array<{ id: string; name: string; type: string }>;
  indicators: Array<{ id: string; name: string; code: string | null; ownerNodeId: string }>;
  users: Array<{ id: string; name: string; email: string; defaultNodeId: string | null }>;
  typeConfigs: TypeConfig[];
  templates: Array<{ id: string; name: string; typeConfigId: string | null; isDefault: boolean; active: boolean }>;
  editor: DocDetail['editor'];
  statuses: DocStatus[];
  types: DocType[];
}

interface TypeConfig {
  id: string;
  name: string;
  sigla: string;
  prefix: string;
  category: DocType;
  codePattern: string;
  digits: number;
  nextNumber: number;
  defaultValidityDays: number | null;
  alertDays: number;
  active: boolean;
}

interface DocForm {
  title: string;
  code: string;
  description: string;
  type: DocType;
  typeConfigId: string;
  version: string;
  content: string;
  externalUrl: string;
  changeNote: string;
  orgNodeId: string;
  indicatorId: string;
  ownerUserId: string;
  approverUserId: string;
  validFrom: string;
  validUntil: string;
  reviewIntervalMonths: string;
}

const STATUS_LABEL: Record<DocStatus, string> = {
  DRAFT: 'Rascunho',
  IN_DEVELOPMENT: 'Em elaboracao',
  WAITING_REVIEW: 'Aguardando revisao',
  REVIEW: 'Em revisao',
  IN_REVIEW: 'Em revisao',
  ADJUSTMENTS_REQUESTED: 'Ajustes solicitados',
  REVIEWED: 'Revisado',
  WAITING_APPROVAL: 'Aguardando aprovacao',
  IN_APPROVAL: 'Em aprovacao',
  REJECTED: 'Reprovado',
  APPROVED: 'Aprovado',
  SCHEDULED_PUBLICATION: 'Publicacao agendada',
  PUBLISHED: 'Publicado',
  NEAR_EXPIRATION: 'Proximo do vencimento',
  EXPIRED: 'Vencido',
  PERIODIC_REVIEW: 'Revisao periodica',
  REPLACED: 'Substituido',
  OBSOLETE: 'Obsoleto',
  ARCHIVED: 'Arquivado',
  CANCELLED: 'Cancelado',
};

const TYPE_LABEL: Record<DocType, string> = {
  POLICY: 'Politica',
  PROCEDURE: 'Procedimento',
  INSTRUCTION: 'Instrucao',
  MANUAL: 'Manual',
  FORM: 'Formulario',
  TEMPLATE: 'Modelo',
  RECORD: 'Registro',
  INTERNAL_STANDARD: 'Norma interna',
  GUIDELINE: 'Diretriz',
  REGULATION: 'Regulamento',
  FLOWCHART: 'Fluxograma',
  PLAN: 'Plano',
  REPORT: 'Relatorio',
  CHECKLIST: 'Checklist',
  TECHNICAL_SPECIFICATION: 'Especificacao tecnica',
  EXTERNAL: 'Externo',
  OTHER: 'Outro',
};

const STATUS_CLASS: Record<DocStatus, string> = {
  DRAFT: 'border-border text-muted-foreground',
  IN_DEVELOPMENT: 'border-status-blue/30 text-status-blue',
  WAITING_REVIEW: 'border-status-yellow/40 text-status-yellow',
  REVIEW: 'border-status-blue/30 text-status-blue',
  IN_REVIEW: 'border-status-blue/30 text-status-blue',
  ADJUSTMENTS_REQUESTED: 'border-status-yellow/40 text-status-yellow',
  REVIEWED: 'border-status-purple/30 text-status-purple',
  WAITING_APPROVAL: 'border-status-purple/30 text-status-purple',
  IN_APPROVAL: 'border-status-purple/30 text-status-purple',
  REJECTED: 'border-status-red/40 text-status-red',
  APPROVED: 'border-status-green/40 text-status-green',
  SCHEDULED_PUBLICATION: 'border-status-green/40 text-status-green',
  PUBLISHED: 'border-status-green/40 text-status-green',
  NEAR_EXPIRATION: 'border-status-yellow/40 text-status-yellow',
  EXPIRED: 'border-status-red/40 text-status-red',
  PERIODIC_REVIEW: 'border-status-yellow/40 text-status-yellow',
  REPLACED: 'border-border text-muted-foreground',
  OBSOLETE: 'border-border text-muted-foreground line-through',
  ARCHIVED: 'border-border text-muted-foreground',
  CANCELLED: 'border-status-red/40 text-status-red',
};

const EMPTY_FORM: DocForm = {
  title: '',
  code: '',
  description: '',
  type: 'PROCEDURE',
  typeConfigId: '',
  version: '1',
  content: '',
  externalUrl: '',
  changeNote: '',
  orgNodeId: '',
  indicatorId: '',
  ownerUserId: '',
  approverUserId: '',
  validFrom: '',
  validUntil: '',
  reviewIntervalMonths: '',
};

export default function DocumentsPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['doc:create']);
  const canUpdate = hasPermission(['doc:update']);
  const canDelete = hasPermission(['doc:delete']);
  const canManage = hasPermission(['doc:manage']);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: '', status: '', type: '', expiring: '' });
  const [form, setForm] = useState<DocForm>(EMPTY_FORM);
  const [typeForm, setTypeForm] = useState({ name: 'Procedimento', sigla: 'PRO', prefix: 'PRO', category: 'PROCEDURE' as DocType, digits: '3', defaultValidityDays: '365', alertDays: '30' });
  const [templateForm, setTemplateForm] = useState({ name: '', typeConfigId: '', content: '' });
  const [draftContent, setDraftContent] = useState('');

  const listQuery = useQuery<Doc[]>({
    queryKey: ['documents', filters],
    queryFn: () => api<Doc[]>(`/documents${toQueryString(filters)}`),
  });
  const summaryQuery = useQuery<DocSummary>({
    queryKey: ['documents', 'summary'],
    queryFn: () => api<DocSummary>('/documents/summary'),
  });
  const optionsQuery = useQuery<DocOptions>({
    queryKey: ['documents', 'options'],
    queryFn: () => api<DocOptions>('/documents/options'),
    staleTime: 60_000,
  });
  const detailQuery = useQuery<DocDetail>({
    queryKey: ['documents', detailId],
    queryFn: () => api<DocDetail>(`/documents/${detailId}`),
    enabled: Boolean(detailId),
  });

  const items = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const summary = summaryQuery.data;
  const options = optionsQuery.data;
  const detail = detailQuery.data ?? null;

  useEffect(() => {
    if (detail) setDraftContent(detail.content ?? '');
  }, [detail?.id, detail?.content]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        code: form.code || null,
        description: form.description || null,
        type: form.type,
        typeConfigId: form.typeConfigId || null,
        version: Number(form.version) || 1,
        content: form.content || null,
        externalUrl: form.externalUrl || null,
        changeNote: form.changeNote || null,
        orgNodeId: form.orgNodeId || null,
        indicatorId: form.indicatorId || null,
        ownerUserId: form.ownerUserId || null,
        approverUserId: form.approverUserId || null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        reviewIntervalMonths: form.reviewIntervalMonths ? Number(form.reviewIntervalMonths) : null,
      };
      return editing
        ? api<DocDetail>(`/documents/${editing.id}`, { method: 'PATCH', json: payload })
        : api<DocDetail>('/documents', { method: 'POST', json: payload });
    },
    onSuccess: (doc) => {
      toast.success(editing ? 'Documento atualizado' : 'Documento criado');
      closeDialog();
      setDetailId(doc.id);
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel salvar o documento'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api<Doc>(`/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Documento excluido');
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel excluir o documento'),
  });

  const workflow = useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: unknown }) =>
      api<DocDetail>(`/documents/${id}/${action}`, { method: 'POST', json: body ?? {} }),
    onSuccess: (doc) => {
      toast.success('Fluxo atualizado');
      setDetailId(doc.id);
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel executar a acao'),
  });

  const autosave = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => api(`/documents/${id}/autosave`, { method: 'POST', json: { content } }),
    onSuccess: () => {
      toast.success('Checkpoint salvo');
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar checkpoint'),
  });

  const upload = useMutation({
    mutationFn: ({ id, kind, fileName, content }: { id: string; kind: FileKind; fileName: string; content: string }) =>
      api(`/documents/${id}/files`, { method: 'POST', json: { kind, fileName, content } }),
    onSuccess: () => {
      toast.success('Arquivo registrado');
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel registrar o arquivo'),
  });

  const createType = useMutation({
    mutationFn: () =>
      api('/documents/types', {
        method: 'POST',
        json: {
          ...typeForm,
          digits: Number(typeForm.digits) || 3,
          defaultValidityDays: Number(typeForm.defaultValidityDays) || null,
          alertDays: Number(typeForm.alertDays) || 30,
        },
      }),
    onSuccess: () => {
      toast.success('Tipo cadastrado');
      qc.invalidateQueries({ queryKey: ['documents', 'options'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel cadastrar o tipo'),
  });

  const createTemplate = useMutation({
    mutationFn: () =>
      api('/documents/templates', {
        method: 'POST',
        json: { name: templateForm.name, typeConfigId: templateForm.typeConfigId || null, content: templateForm.content || null },
      }),
    onSuccess: () => {
      toast.success('Template cadastrado');
      setTemplateForm({ name: '', typeConfigId: '', content: '' });
      qc.invalidateQueries({ queryKey: ['documents', 'options'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Nao foi possivel cadastrar o template'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, typeConfigId: options?.typeConfigs?.find((item) => item.prefix === 'PRO')?.id ?? '' });
    setOpen(true);
  };

  const openEdit = (doc: Doc) => {
    setEditing(doc);
    setForm({
      title: doc.title,
      code: doc.code ?? '',
      description: doc.description ?? '',
      type: doc.type,
      typeConfigId: '',
      version: String(doc.version ?? 1),
      content: doc.content ?? '',
      externalUrl: doc.externalUrl ?? '',
      changeNote: doc.changeNote ?? '',
      orgNodeId: doc.orgNodeId ?? '',
      indicatorId: doc.indicatorId ?? '',
      ownerUserId: doc.ownerUserId ?? '',
      approverUserId: doc.approverUserId ?? '',
      validFrom: toInputDate(doc.validFrom),
      validUntil: toInputDate(doc.validUntil),
      reviewIntervalMonths: doc.reviewIntervalMonths ? String(doc.reviewIntervalMonths) : '',
    });
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const focusId = searchParams.get('focus');
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusId || focusedRef.current === focusId) return;
    const target = items.find((d) => d.id === focusId);
    if (target) {
      focusedRef.current = focusId;
      setDetailId(target.id);
    }
  }, [focusId, items]);

  const selectedType = options?.typeConfigs.find((type) => type.id === form.typeConfigId);

  return (
    <div>
      <PageHeader
        title="Documentos"
        description="GED corporativo com codigos, revisoes, validade, aprovacao e publicacao controlada."
        actions={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo documento</Button> : null}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Publicados" value={formatNumber(summary?.published)} description={`${formatNumber(summary?.total)} no acervo`} icon={<FileText className="h-4 w-4" />} tone="green" />
        <MetricCard title="Em elaboracao" value={formatNumber(summary?.draft)} description="Rascunho, ajustes ou revisao" icon={<Edit className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Aguardando aprovacao" value={formatNumber(summary?.waitingApproval)} description="Fluxo pendente" icon={<ShieldCheck className="h-4 w-4" />} tone={(summary?.waitingApproval ?? 0) > 0 ? 'purple' : 'green'} />
        <MetricCard title="Vencidos" value={formatNumber(summary?.expired)} description="Publicados fora da validade" icon={<CalendarClock className="h-4 w-4" />} tone={(summary?.expired ?? 0) > 0 ? 'red' : 'green'} />
        <MetricCard title="A revisar" value={formatNumber(summary?.needsReview)} description="Vencem no alerta" icon={<RotateCcw className="h-4 w-4" />} tone={(summary?.needsReview ?? 0) > 0 ? 'yellow' : 'green'} />
      </div>

      <Tabs defaultValue="acervo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="acervo"><Layers className="mr-2 h-4 w-4" />Acervo</TabsTrigger>
          <TabsTrigger value="matriz"><Table2 className="mr-2 h-4 w-4" />Matriz</TabsTrigger>
          {canManage && <TabsTrigger value="config"><Settings className="mr-2 h-4 w-4" />Configuracoes</TabsTrigger>}
        </TabsList>

        <TabsContent value="acervo">
          <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr,360px]">
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Validade / revisao</div>
                    <div className="text-xs text-muted-foreground">Documentos vencidos ou proximos da revisao.</div>
                  </div>
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  {(summary?.expiringSoon ?? []).length === 0 && (
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Nenhum documento a vencer.</div>
                  )}
                  {(summary?.expiringSoon ?? []).map((doc) => (
                    <button key={doc.id} onClick={() => setDetailId(doc.id)} className="flex w-full items-start justify-between gap-3 rounded-md border p-3 text-left hover:bg-muted/40">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{doc.code ? `${doc.code} - ` : ''}{doc.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{TYPE_LABEL[doc.type]} - {doc.owner?.name ?? 'Sem dono'} - validade {formatDate(doc.validUntil)}</div>
                      </div>
                      <Badge variant="outline" className={doc.isExpired ? 'border-status-red/40 text-status-red' : 'border-status-yellow/40 text-status-yellow'}>
                        {doc.isExpired ? 'Vencido' : `${doc.daysToExpire}d`}
                      </Badge>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <FiltersCard filters={filters} setFilters={setFilters} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {items.length === 0 && (
              <Card className="xl:col-span-2">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  {listQuery.isLoading ? 'Carregando documentos...' : 'Nenhum documento encontrado para os filtros atuais.'}
                </CardContent>
              </Card>
            )}
            {items.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} canUpdate={canUpdate} canDelete={canDelete} onView={() => setDetailId(doc.id)} onEdit={() => openEdit(doc)} onRemove={() => remove.mutate(doc.id)} removing={remove.isPending} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="matriz">
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Codigo</th>
                    <th className="px-4 py-3 text-left font-medium">Titulo</th>
                    <th className="px-4 py-3 text-left font-medium">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Area</th>
                    <th className="px-4 py-3 text-left font-medium">Responsavel</th>
                    <th className="px-4 py-3 text-left font-medium">Revisao</th>
                    <th className="px-4 py-3 text-left font-medium">Validade</th>
                    <th className="px-4 py-3 text-right font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((doc) => (
                    <tr key={doc.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{doc.code ?? `#${doc.number}`}</td>
                      <td className="px-4 py-3">{doc.title}</td>
                      <td className="px-4 py-3">{TYPE_LABEL[doc.type]}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className={STATUS_CLASS[doc.status]}>{STATUS_LABEL[doc.status]}</Badge></td>
                      <td className="px-4 py-3">{doc.orgNode?.name ?? '-'}</td>
                      <td className="px-4 py-3">{doc.owner?.name ?? '-'}</td>
                      <td className="px-4 py-3">v{doc.version}</td>
                      <td className={cn('px-4 py-3', doc.isExpired && 'text-status-red')}>{formatDate(doc.validUntil)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetailId(doc.id)}><Eye className="mr-2 h-4 w-4" />Abrir</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {canManage && (
          <TabsContent value="config">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Tipos e codigos</div>
                    <Badge variant="outline">{formatNumber(options?.typeConfigs.length)} tipos</Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input placeholder="Nome" value={typeForm.name} onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))} />
                    <Input placeholder="Sigla" value={typeForm.sigla} onChange={(e) => setTypeForm((f) => ({ ...f, sigla: e.target.value.toUpperCase(), prefix: e.target.value.toUpperCase() }))} />
                    <Input placeholder="Prefixo" value={typeForm.prefix} onChange={(e) => setTypeForm((f) => ({ ...f, prefix: e.target.value.toUpperCase() }))} />
                    <NativeSelect value={typeForm.category} onChange={(e) => setTypeForm((f) => ({ ...f, category: e.target.value as DocType }))}>
                      {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </NativeSelect>
                    <Input type="number" min={1} placeholder="Digitos" value={typeForm.digits} onChange={(e) => setTypeForm((f) => ({ ...f, digits: e.target.value }))} />
                    <Input type="number" min={1} placeholder="Validade padrao" value={typeForm.defaultValidityDays} onChange={(e) => setTypeForm((f) => ({ ...f, defaultValidityDays: e.target.value }))} />
                  </div>
                  <Button onClick={() => createType.mutate()} disabled={createType.isPending || !typeForm.name.trim()}><Plus className="mr-2 h-4 w-4" />Cadastrar tipo</Button>
                  <div className="space-y-2">
                    {(options?.typeConfigs ?? []).map((type) => (
                      <div key={type.id} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <div className="text-sm font-medium">{type.name}</div>
                          <div className="text-xs text-muted-foreground">{type.prefix}-001 - proximo {type.nextNumber}</div>
                        </div>
                        <Badge variant={type.active ? 'secondary' : 'outline'}>{TYPE_LABEL[type.category]}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Templates DOCX</div>
                    <Badge variant="outline">{formatNumber(options?.templates.length)} templates</Badge>
                  </div>
                  <Input placeholder="Nome do template" value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} />
                  <NativeSelect value={templateForm.typeConfigId} onChange={(e) => setTemplateForm((f) => ({ ...f, typeConfigId: e.target.value }))}>
                    <option value="">Sem tipo vinculado</option>
                    {(options?.typeConfigs ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </NativeSelect>
                  <Textarea rows={6} placeholder="{{document_code}} - {{document_title}}" value={templateForm.content} onChange={(e) => setTemplateForm((f) => ({ ...f, content: e.target.value }))} />
                  <Button onClick={() => createTemplate.mutate()} disabled={createTemplate.isPending || !templateForm.name.trim()}><Upload className="mr-2 h-4 w-4" />Cadastrar template</Button>
                  <div className="rounded-md border p-3 text-sm">
                    <div className="font-medium">Editor DOCX</div>
                    <div className="mt-1 text-xs text-muted-foreground">{options?.editor.configured ? `${options.editor.provider} configurado` : 'Modo manual de download/upload'}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar documento #${editing.number}` : 'Novo documento'}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="geral">
            <TabsList>
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="vinculos">Vinculos</TabsTrigger>
              <TabsTrigger value="conteudo">Conteudo</TabsTrigger>
            </TabsList>
            <TabsContent value="geral" className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Titulo</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label>Tipo configurado</Label>
                <NativeSelect value={form.typeConfigId} onChange={(e) => {
                  const type = options?.typeConfigs.find((item) => item.id === e.target.value);
                  setForm((f) => ({ ...f, typeConfigId: e.target.value, type: type?.category ?? f.type }));
                }}>
                  <option value="">Gerar pelo tipo base</option>
                  {(options?.typeConfigs ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.prefix})</option>)}
                </NativeSelect>
              </div>
              <div>
                <Label>Tipo base</Label>
                <NativeSelect value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DocType }))}>
                  {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </div>
              <div>
                <Label>Codigo manual</Label>
                <Input placeholder={selectedType ? `${selectedType.prefix}-001` : 'Gerado automaticamente'} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
              </div>
              <div>
                <Label>Versao</Label>
                <Input type="number" min={1} value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} />
              </div>
              <div>
                <Label>Vigencia</Label>
                <Input type="date" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} />
              </div>
              <div>
                <Label>Validade</Label>
                <Input type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Descricao</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </TabsContent>
            <TabsContent value="vinculos" className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField label="Area/processo" value={form.orgNodeId} onChange={(value) => setForm((f) => ({ ...f, orgNodeId: value }))} empty="Sem area direta" items={(options?.orgNodes ?? []).map((item) => ({ value: item.id, label: item.name }))} />
              <SelectField label="Indicador relacionado" value={form.indicatorId} onChange={(value) => setForm((f) => ({ ...f, indicatorId: value }))} empty="Sem indicador" items={(options?.indicators ?? []).map((item) => ({ value: item.id, label: `${item.code ? `[${item.code}] ` : ''}${item.name}` }))} />
              <SelectField label="Responsavel" value={form.ownerUserId} onChange={(value) => setForm((f) => ({ ...f, ownerUserId: value }))} empty="Sem responsavel" items={(options?.users ?? []).map((item) => ({ value: item.id, label: item.name }))} />
              <SelectField label="Aprovador" value={form.approverUserId} onChange={(value) => setForm((f) => ({ ...f, approverUserId: value }))} empty="Sem aprovador" items={(options?.users ?? []).map((item) => ({ value: item.id, label: item.name }))} />
              <div>
                <Label>Intervalo de revisao (meses)</Label>
                <Input type="number" min={1} value={form.reviewIntervalMonths} onChange={(e) => setForm((f) => ({ ...f, reviewIntervalMonths: e.target.value }))} />
              </div>
              <div>
                <Label>URL externa</Label>
                <Input placeholder="https://..." value={form.externalUrl} onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))} />
              </div>
            </TabsContent>
            <TabsContent value="conteudo" className="space-y-4">
              <div>
                <Label>Conteudo inicial</Label>
                <Textarea rows={8} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
              </div>
              <div>
                <Label>Nota de alteracao</Label>
                <Input value={form.changeNote} onChange={(e) => setForm((f) => ({ ...f, changeNote: e.target.value }))} />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()}>
              {save.isPending ? 'Salvando...' : 'Salvar documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailId)} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{detail ? `${detail.code ?? `#${detail.number}`} - ${detail.title}` : 'Documento'}</DialogTitle>
          </DialogHeader>
          {!detail && <div className="p-6 text-sm text-muted-foreground">Carregando documento...</div>}
          {detail && (
            <Tabs defaultValue="geral">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <TabsList>
                  <TabsTrigger value="geral">Geral</TabsTrigger>
                  <TabsTrigger value="documento">Documento</TabsTrigger>
                  <TabsTrigger value="revisoes">Revisoes</TabsTrigger>
                  <TabsTrigger value="aprovacoes">Aprovacoes</TabsTrigger>
                  <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
                  <TabsTrigger value="distribuicao">Distribuicao</TabsTrigger>
                </TabsList>
                <WorkflowActions doc={detail} canUpdate={canUpdate} pending={workflow.isPending} run={(action, body) => workflow.mutate({ id: detail.id, action, body })} />
              </div>

              <TabsContent value="geral">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <InfoTile label="Status" value={<Badge variant="outline" className={STATUS_CLASS[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>} />
                  <InfoTile label="Tipo" value={TYPE_LABEL[detail.type]} />
                  <InfoTile label="Revisao atual" value={`v${detail.version}`} />
                  <InfoTile label="Area" value={detail.orgNode?.name ?? '-'} />
                  <InfoTile label="Responsavel" value={detail.owner?.name ?? '-'} />
                  <InfoTile label="Aprovador" value={detail.approver?.name ?? '-'} />
                  <InfoTile label="Publicacao" value={formatDate(detail.publishedAt)} />
                  <InfoTile label="Validade" value={formatDate(detail.validUntil)} />
                  <InfoTile label="Editor" value={detail.editor.configured ? detail.editor.provider : 'Manual'} />
                </div>
                <div className="mt-4 rounded-md border p-4 text-sm text-muted-foreground">{detail.description ?? 'Sem descricao registrada.'}</div>
              </TabsContent>

              <TabsContent value="documento">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr,320px]">
                  <div className="space-y-3">
                    {!detail.editor.configured && (
                      <div className="rounded-md border border-status-yellow/40 bg-status-yellow/5 p-3 text-sm text-muted-foreground">
                        {detail.editor.message}
                      </div>
                    )}
                    <Textarea rows={14} value={draftContent} onChange={(e) => setDraftContent(e.target.value)} disabled={!isEditable(detail.status) || !canUpdate} />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => autosave.mutate({ id: detail.id, content: draftContent })} disabled={!isEditable(detail.status) || autosave.isPending || !canUpdate}>
                        <Save className="mr-2 h-4 w-4" />Salvar checkpoint
                      </Button>
                      <Button variant="outline" onClick={() => workflow.mutate({ id: detail.id, action: 'editor/open' })}>
                        <Edit className="mr-2 h-4 w-4" />Abrir editor
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Arquivos</div>
                    {detail.files.length === 0 && <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Nenhum arquivo registrado.</div>}
                    {detail.files.map((file) => (
                      <div key={file.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{file.fileName}</div>
                            <div className="text-xs text-muted-foreground">{file.kind} - {formatBytes(file.sizeBytes)}</div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => downloadControlled(detail.id, file.id, file.fileName)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {canUpdate && (
                      <Button variant="outline" className="w-full" onClick={() => {
                        const content = window.prompt('Conteudo do arquivo');
                        if (!content) return;
                        upload.mutate({ id: detail.id, kind: 'DOCX', fileName: `${detail.code ?? detail.number}.docx`, content });
                      }}>
                        <Upload className="mr-2 h-4 w-4" />Enviar DOCX
                      </Button>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="revisoes">
                <Timeline items={detail.versions.map((item) => ({
                  id: item.id,
                  icon: <History className="h-4 w-4" />,
                  title: `${item.versionLabel} - ${STATUS_LABEL[item.status]}`,
                  meta: `${formatDate(item.createdAt)} - ${item.changeReason ?? 'Sem motivo'}`,
                  body: item.changeSummary,
                }))} />
              </TabsContent>

              <TabsContent value="aprovacoes">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Timeline items={detail.reviewRequests.map((item) => ({
                    id: item.id,
                    icon: <MessageSquare className="h-4 w-4" />,
                    title: `Ajuste ${item.status}`,
                    meta: `${formatDate(item.createdAt)} - prazo ${formatDate(item.dueAt)}`,
                    body: item.comment,
                  }))} empty="Nenhuma solicitacao de ajuste." />
                  <Timeline items={detail.approvals.map((item) => ({
                    id: item.id,
                    icon: <CheckCircle2 className="h-4 w-4" />,
                    title: item.decision,
                    meta: item.decidedAt ? formatDate(item.decidedAt) : formatDate(item.createdAt),
                    body: item.comment,
                  }))} empty="Nenhuma aprovacao registrada." />
                </div>
              </TabsContent>

              <TabsContent value="auditoria">
                <Timeline items={[...detail.statusHistory.map((item) => ({
                  id: item.id,
                  icon: <History className="h-4 w-4" />,
                  title: `${item.statusFrom ?? 'Inicio'} -> ${item.statusTo}`,
                  meta: formatDate(item.createdAt),
                  body: item.comment,
                })), ...detail.auditLogs.map((item) => ({
                  id: item.id,
                  icon: <ShieldCheck className="h-4 w-4" />,
                  title: item.action,
                  meta: `${formatDate(item.createdAt)} - ${item.result}`,
                  body: item.reason,
                }))]} />
              </TabsContent>

              <TabsContent value="distribuicao">
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  Confirmacoes de leitura ficam registradas por revisao. 
                  <Button className="ml-0 mt-3 sm:ml-3 sm:mt-0" variant="outline" onClick={() => api(`/documents/${detail.id}/read-confirmations`, { method: 'POST', json: {} }).then(() => toast.success('Leitura confirmada')).then(() => invalidate(qc))}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />Confirmar leitura
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentCard({ doc, canUpdate, canDelete, onView, onEdit, onRemove, removing }: { doc: Doc; canUpdate: boolean; canDelete: boolean; onView: () => void; onEdit: () => void; onRemove: () => void; removing: boolean }) {
  return (
    <Card className={cn('overflow-hidden', doc.isExpired && 'border-status-red/40', doc.needsReview && !doc.isExpired && 'border-status-yellow/50')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{doc.code ? doc.code : `#${doc.number}`}</Badge>
              <Badge variant="outline" className={STATUS_CLASS[doc.status]}>{STATUS_LABEL[doc.status]}</Badge>
              <Badge variant="secondary">{TYPE_LABEL[doc.type]}</Badge>
              <Badge variant="outline">v{doc.version}</Badge>
            </div>
            <h2 className="mt-3 truncate text-base font-semibold">{doc.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{doc.description || 'Sem descricao registrada.'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onView} title="Abrir documento"><Eye className="h-4 w-4" /></Button>
            {canUpdate && <Button variant="ghost" size="icon" onClick={onEdit} title="Editar metadados"><Edit className="h-4 w-4" /></Button>}
            {canDelete && (
              <Button variant="ghost" size="icon" onClick={() => window.confirm('Excluir este documento?') && onRemove()} disabled={removing} title="Excluir documento">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div>Area/processo: <span className="text-foreground">{doc.orgNode?.name ?? '-'}</span></div>
          <div>Responsavel: <span className="text-foreground">{doc.owner?.name ?? '-'}</span></div>
          <div>Aprovador: <span className="text-foreground">{doc.approver?.name ?? '-'}</span></div>
          <div>Validade: <span className={cn('text-foreground', doc.isExpired && 'text-status-red')}>{formatDate(doc.validUntil)}</span></div>
        </div>
      </CardContent>
    </Card>
  );
}

function FiltersCard({ filters, setFilters }: { filters: { search: string; status: string; type: string; expiring: string }; setFilters: Dispatch<SetStateAction<{ search: string; status: string; type: string; expiring: string }>> }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Filter className="h-4 w-4" />Filtros</div>
        <div className="space-y-3">
          <Input placeholder="Buscar por titulo, codigo, conteudo..." value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
          <NativeSelect value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </NativeSelect>
          <NativeSelect value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
            <option value="">Todos os tipos</option>
            {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </NativeSelect>
          <NativeSelect value={filters.expiring} onChange={(e) => setFilters((f) => ({ ...f, expiring: e.target.value }))}>
            <option value="">Qualquer validade</option>
            <option value="soon">Proximos do vencimento</option>
            <option value="expired">Vencidos</option>
          </NativeSelect>
          {(filters.search || filters.status || filters.type || filters.expiring) && (
            <Button variant="ghost" size="sm" onClick={() => setFilters({ search: '', status: '', type: '', expiring: '' })}>
              <X className="mr-2 h-4 w-4" />Limpar filtros
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowActions({ doc, canUpdate, pending, run }: { doc: DocDetail; canUpdate: boolean; pending: boolean; run: (action: string, body?: unknown) => void }) {
  if (!canUpdate) return null;
  const comment = (label: string) => window.prompt(label) ?? '';
  return (
    <div className="flex flex-wrap gap-2">
      {isEditable(doc.status) && <Button size="sm" disabled={pending} onClick={() => run('submit-review')}><Send className="mr-2 h-4 w-4" />Enviar revisao</Button>}
      {doc.status === 'WAITING_REVIEW' && <Button size="sm" disabled={pending} onClick={() => run('start-review')}><Eye className="mr-2 h-4 w-4" />Iniciar revisao</Button>}
      {(doc.status === 'IN_REVIEW' || doc.status === 'REVIEW') && (
        <>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => {
            const value = comment('Comentario dos ajustes');
            if (value) run('request-adjustments', { comment: value });
          }}><AlertTriangle className="mr-2 h-4 w-4" />Ajustes</Button>
          <Button size="sm" disabled={pending} onClick={() => run('complete-review')}><CheckCircle2 className="mr-2 h-4 w-4" />Revisado</Button>
        </>
      )}
      {doc.status === 'REVIEWED' && <Button size="sm" disabled={pending} onClick={() => run('send-approval')}><ShieldCheck className="mr-2 h-4 w-4" />Enviar aprovacao</Button>}
      {doc.status === 'WAITING_APPROVAL' && <Button size="sm" disabled={pending} onClick={() => run('start-approval')}><ShieldCheck className="mr-2 h-4 w-4" />Iniciar aprovacao</Button>}
      {doc.status === 'IN_APPROVAL' && (
        <>
          <Button size="sm" disabled={pending} onClick={() => run('approve')}><CheckCircle2 className="mr-2 h-4 w-4" />Aprovar</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => {
            const value = comment('Motivo da reprovacao');
            if (value) run('reject', { comment: value });
          }}><X className="mr-2 h-4 w-4" />Reprovar</Button>
        </>
      )}
      {doc.status === 'APPROVED' && <Button size="sm" disabled={pending} onClick={() => run('publish')}><FileText className="mr-2 h-4 w-4" />Publicar</Button>}
      {doc.status === 'PUBLISHED' && (
        <>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => {
            const value = comment('Motivo da nova revisao');
            if (value) run('new-revision', { reason: value });
          }}><RotateCcw className="mr-2 h-4 w-4" />Nova revisao</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => {
            const value = comment('Motivo da obsolescencia');
            if (value) run('obsolete', { comment: value });
          }}><Archive className="mr-2 h-4 w-4" />Obsoleto</Button>
        </>
      )}
    </div>
  );
}

function Timeline({ items, empty = 'Nenhum registro encontrado.' }: { items: Array<{ id: string; icon: ReactNode; title: string; meta: string; body?: string | null }>; empty?: string }) {
  if (items.length === 0) return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{empty}</div>;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 rounded-md border p-3">
          <div className="mt-0.5 text-muted-foreground">{item.icon}</div>
          <div className="min-w-0">
            <div className="text-sm font-medium">{item.title}</div>
            <div className="text-xs text-muted-foreground">{item.meta}</div>
            {item.body && <div className="mt-2 text-sm text-muted-foreground">{item.body}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function SelectField({ label, value, onChange, empty, items }: { label: string; value: string; onChange: (value: string) => void; empty: string; items: Array<{ value: string; label: string }> }) {
  return (
    <div>
      <Label>{label}</Label>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{empty}</option>
        {items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </NativeSelect>
    </div>
  );
}

function toQueryString(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toInputDate(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function isEditable(status: DocStatus) {
  return ['DRAFT', 'IN_DEVELOPMENT', 'ADJUSTMENTS_REQUESTED', 'REJECTED'].includes(status);
}

function formatBytes(value: number | null | undefined) {
  if (!value) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

async function downloadControlled(documentId: string, fileId: string, fileName: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/documents/${documentId}/files/${fileId}/download`, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    toast.error('Nao foi possivel baixar o arquivo');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['documents'] });
}
