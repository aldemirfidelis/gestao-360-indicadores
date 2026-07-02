'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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
  History,
  Layers,
  MessageSquare,
  Network,
  Plus,
  RotateCcw,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Table2,
  Trash2,
  Upload,
  Users,
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
import { useVision360 } from '@/components/ui/vision360-context';
import { ImpactConfirmationModal } from '@/components/ui/impact-confirmation-modal';
import { ReasonDialog, type ReasonDialogState } from '@/components/platform/reason-dialog';

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
  editRequests: Array<{
    id: string;
    status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    reason: string | null;
    decisionNote: string | null;
    requesterUserId: string;
    operatorUserId: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    completedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    requester?: { id: string; name: string; email: string } | null;
    operator?: { id: string; name: string; email: string } | null;
    decidedBy?: { id: string; name: string; email: string } | null;
  }>;
  comments: Array<{ id: string; body: string; userId: string | null; resolvedAt: string | null; createdAt: string }>;
  auditLogs: Array<{ id: string; action: string; reason: string | null; result: string; createdAt: string }>;
  tags: Array<{ id: string; name: string; color: string | null }>;
}

interface EditorSession {
  configured: boolean;
  provider: string;
  mode: 'ONLINE' | 'MANUAL';
  message?: string;
  documentId: string;
  fileId: string | null;
  editorUrl: string | null;
  accessToken: string | null;
  accessTokenTtl: number;
  wopiSrc: string | null;
}


interface DocSummary {
  total: number;
  published: number;
  draft: number;
  waitingApproval: number;
  expired: number;
  needsReview: number;
  obsolete: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  expiringSoon: Array<Pick<Doc, 'id' | 'number' | 'code' | 'title' | 'type' | 'status' | 'validUntil' | 'isExpired' | 'daysToExpire' | 'orgNode' | 'owner'>>;
}

interface DocTemplate {
  id: string;
  name: string;
  description: string | null;
  typeConfigId: string | null;
  version: number;
  isDefault: boolean;
  active: boolean;
  fileName: string | null;
  content: string | null;
  placeholders: string[] | null;
  updatedAt?: string;
}

interface LibraryTemplateEntry {
  key: string;
  name: string;
  description: string;
  category: DocType;
  preview: string;
  installed: boolean;
}

interface DocOptions {
  orgNodes: Array<{ id: string; name: string; type: string }>;
  indicators: Array<{ id: string; name: string; code: string | null; ownerNodeId: string }>;
  users: Array<{ id: string; name: string; email: string; defaultNodeId: string | null }>;
  typeConfigs: TypeConfig[];
  templates: DocTemplate[];
  placeholders: string[];
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
  templateId: string;
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
  IN_DEVELOPMENT: 'Em elaboração',
  WAITING_REVIEW: 'Aguardando revisão',
  REVIEW: 'Em revisão',
  IN_REVIEW: 'Em revisão',
  ADJUSTMENTS_REQUESTED: 'Ajustes solicitados',
  REVIEWED: 'Revisado',
  WAITING_APPROVAL: 'Aguardando aprovação',
  IN_APPROVAL: 'Em aprovação',
  REJECTED: 'Reprovado',
  APPROVED: 'Aprovado',
  SCHEDULED_PUBLICATION: 'Publicação agendada',
  PUBLISHED: 'Publicado',
  NEAR_EXPIRATION: 'Próximo do vencimento',
  EXPIRED: 'Vencido',
  PERIODIC_REVIEW: 'Revisão periódica',
  REPLACED: 'Substituído',
  OBSOLETE: 'Obsoleto',
  ARCHIVED: 'Arquivado',
  CANCELLED: 'Cancelado',
};

const TYPE_LABEL: Record<DocType, string> = {
  POLICY: 'Política',
  PROCEDURE: 'Procedimento',
  INSTRUCTION: 'Instrução',
  MANUAL: 'Manual',
  FORM: 'Formulário',
  TEMPLATE: 'Modelo',
  RECORD: 'Registro',
  INTERNAL_STANDARD: 'Norma interna',
  GUIDELINE: 'Diretriz',
  REGULATION: 'Regulamento',
  FLOWCHART: 'Fluxograma',
  PLAN: 'Plano',
  REPORT: 'Relatório',
  CHECKLIST: 'Lista de verificação',
  TECHNICAL_SPECIFICATION: 'Especificação técnica',
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
  templateId: '',
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
  const { hasPermission, user } = useAuth();
  const { open: openVision360 } = useVision360();
  const canCreate = hasPermission(['doc:create']);
  const canUpdate = hasPermission(['doc:update']);
  const canDelete = hasPermission(['doc:delete']);
  const canManage = hasPermission(['doc:manage']);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [section, setSection] = useState('acervo');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [filters, setFilters] = useState({ search: '', status: '', type: '', expiring: '' });
  const [form, setForm] = useState<DocForm>(EMPTY_FORM);
  const [typeForm, setTypeForm] = useState({ name: 'Procedimento', sigla: 'PRO', prefix: 'PRO', category: 'PROCEDURE' as DocType, digits: '3', defaultValidityDays: '365', alertDays: '30' });
  const [templateDialog, setTemplateDialog] = useState<{ mode: 'create' | 'edit'; template: DocTemplate | null } | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', typeConfigId: '', description: '', content: '', isDefault: false });
  const [importDialog, setImportDialog] = useState<{ fileName: string; base64: string } | null>(null);
  const [importForm, setImportForm] = useState({ name: '', typeConfigId: '', description: '' });
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [gallerySelection, setGallerySelection] = useState<string[]>([]);
  const templateFileRef = useRef<HTMLInputElement>(null);
  const docxFileRef = useRef<HTMLInputElement>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(null);
  const [grantForm, setGrantForm] = useState({ requesterUserId: '', reason: '', expiresAt: '' });
  const [draftContent, setDraftContent] = useState('');
  const [editorSession, setEditorSession] = useState<EditorSession | null>(null);
  const [viewer, setViewer] = useState<{ url: string; fileId: string; fileName: string } | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const autoOpenEditorRef = useRef<string | null>(null);
  const typeConfigRef = useRef<HTMLDivElement>(null);
  const templateConfigRef = useRef<HTMLDivElement>(null);
  const readingRef = useRef<HTMLDivElement>(null);
  const [impactModalConfig, setImpactModalConfig] = useState<{
    isOpen: boolean;
    entityType: string;
    entityId: string;
    operationType: 'UPDATE' | 'DELETE' | 'INACTIVE';
    changeSummary: string;
    onConfirm: (payload: { justification: string; affectedItems: any[] }) => void;
  } | null>(null);

  const handleSaveSubmit = () => {
    if (!editing) {
      save.mutate();
      return;
    }
    setImpactModalConfig({
      isOpen: true,
      entityType: 'DOCUMENT',
      entityId: editing.id,
      operationType: 'UPDATE',
      changeSummary: `Edição cadastral do documento "${form.title}" (Código: ${form.code || 'sem código'})`,
      onConfirm: async (payload) => {
        try {
          await api('/vision360/impact-analysis', {
            method: 'POST',
            json: {
              sourceEntityType: 'DOCUMENT',
              sourceEntityId: editing.id,
              operationType: 'UPDATE',
              changeSummary: `Edição cadastral do documento "${form.title}"`,
              justification: payload.justification,
              impactLevel: payload.affectedItems.some(i => i.impactLevel === 'CRITICAL' || i.impactLevel === 'HIGH') ? 'HIGH' : 'MEDIUM',
              affectedItems: payload.affectedItems,
            }
          });
          save.mutate();
          setImpactModalConfig(null);
        } catch (err: any) {
          toast.error(err.message || 'Erro ao registrar análise de impacto.');
        }
      }
    });
  };

  const handleRemoveTrigger = (id: string, title: string) => {
    setImpactModalConfig({
      isOpen: true,
      entityType: 'DOCUMENT',
      entityId: id,
      operationType: 'DELETE',
      changeSummary: `Exclusão do documento "${title}"`,
      onConfirm: async (payload) => {
        try {
          await api('/vision360/impact-analysis', {
            method: 'POST',
            json: {
              sourceEntityType: 'DOCUMENT',
              sourceEntityId: id,
              operationType: 'DELETE',
              changeSummary: `Exclusão do documento "${title}"`,
              justification: payload.justification,
              impactLevel: payload.affectedItems.some(i => i.impactLevel === 'CRITICAL' || i.impactLevel === 'HIGH') ? 'HIGH' : 'MEDIUM',
              affectedItems: payload.affectedItems,
            }
          });
          remove.mutate(id);
          setImpactModalConfig(null);
        } catch (err: any) {
          toast.error(err.message || 'Erro ao registrar análise de impacto.');
        }
      }
    });
  };

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
  const templatesQuery = useQuery<DocTemplate[]>({
    queryKey: ['documents', 'templates'],
    queryFn: () => api<DocTemplate[]>('/documents/templates'),
    enabled: canManage,
  });
  const libraryQuery = useQuery<LibraryTemplateEntry[]>({
    queryKey: ['documents', 'templates', 'library'],
    queryFn: () => api<LibraryTemplateEntry[]>('/documents/templates/library'),
    enabled: canManage && galleryOpen,
  });

  const items = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const summary = summaryQuery.data;
  const options = optionsQuery.data;
  const detail = detailQuery.data ?? null;
  const latestDocx = useMemo(() => detail?.files.find((file) => file.kind === 'DOCX') ?? null, [detail?.files]);
  const latestPdf = useMemo(() => detail?.files.find((file) => file.kind === 'PDF') ?? null, [detail?.files]);
  const myActiveEditRequest = useMemo(() => {
    if (!detail || !user?.id) return null;
    return detail.editRequests.find((request) =>
      request.requesterUserId === user.id && ['APPROVED', 'IN_PROGRESS'].includes(request.status),
    ) ?? null;
  }, [detail, user?.id]);
  const canEditOnline = Boolean(myActiveEditRequest);

  useEffect(() => {
    if (detail) setDraftContent(detail.content ?? '');
  }, [detail?.id, detail?.content]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setViewer(null);
    if (!detail || !latestPdf) {
      setViewerLoading(false);
      return;
    }
    setViewerLoading(true);
    fetchControlledBlob(detail.id, latestPdf.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setViewer({ url: objectUrl, fileId: latestPdf.id, fileName: latestPdf.fileName });
      })
      .catch(() => {
        if (!cancelled) toast.error('Não foi possível carregar a visualização do PDF');
      })
      .finally(() => {
        if (!cancelled) setViewerLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [detail?.id, latestPdf?.id]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        code: form.code || null,
        description: form.description || null,
        type: form.type,
        typeConfigId: form.typeConfigId || null,
        templateId: editing ? undefined : form.templateId || null,
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
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível salvar o documento'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api<Doc>(`/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Documento excluido');
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível excluir o documento'),
  });

  const workflow = useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: unknown }) =>
      api<DocDetail>(`/documents/${id}/${action}`, { method: 'POST', json: body ?? {} }),
    onSuccess: (doc) => {
      toast.success('Fluxo atualizado');
      setDetailId(doc.id);
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível executar a ação'),
  });

  const autosave = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => api(`/documents/${id}/autosave`, { method: 'POST', json: { content } }),
    onSuccess: () => {
      toast.success('Checkpoint salvo');
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar checkpoint'),
  });

  const openEditor = useMutation({
    mutationFn: (id: string) => api<EditorSession>(`/documents/${id}/editor/open`, { method: 'POST', json: {} }),
    onSuccess: (session) => {
      if (session.editorUrl && session.accessToken) {
        setEditorSession(session);
      } else {
        toast.message('Editor pela web indisponível', {
          description: session.message ?? 'Use baixar/envio de nova versão.',
        });
      }
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível abrir o editor'),
  });

  useEffect(() => {
    if (!detail || !myActiveEditRequest || searchParams.get('edit') !== '1' || autoOpenEditorRef.current === detail.id) return;
    autoOpenEditorRef.current = detail.id;
    openEditor.mutate(detail.id);
  }, [detail?.id, myActiveEditRequest?.id, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestEdit = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api(`/documents/${id}/edit-requests`, { method: 'POST', json: { reason } }),
    onSuccess: () => {
      toast.success('Solicitação enviada ao operador');
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível solicitar edição'),
  });

  const grantEdit = useMutation({
    mutationFn: ({ id, requesterUserId, reason, expiresAt }: { id: string; requesterUserId: string; reason?: string; expiresAt?: string }) =>
      api(`/documents/${id}/edit-requests/grant`, { method: 'POST', json: { requesterUserId, reason, expiresAt: expiresAt || undefined } }),
    onSuccess: () => {
      toast.success('Edição enviada para o usuário');
      setGrantOpen(false);
      setGrantForm({ requesterUserId: '', reason: '', expiresAt: '' });
      invalidate(qc);
      void qc.invalidateQueries({ queryKey: ['my-day'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível liberar edição'),
  });

  const decideEdit = useMutation({
    mutationFn: ({ requestId, action, note }: { requestId: string; action: 'approve' | 'reject' | 'complete'; note?: string }) =>
      api(`/documents/edit-requests/${requestId}/${action}`, { method: 'POST', json: { note } }),
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'approve' ? 'Edição liberada' : variables.action === 'reject' ? 'Solicitação rejeitada' : 'Edição concluída');
      invalidate(qc);
      void qc.invalidateQueries({ queryKey: ['my-day'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível atualizar a solicitação'),
  });

  const upload = useMutation({
    mutationFn: ({ id, kind, fileName, contentBase64 }: { id: string; kind: FileKind; fileName: string; contentBase64: string }) =>
      api(`/documents/${id}/files`, { method: 'POST', json: { kind, fileName, contentBase64 } }),
    onSuccess: () => {
      toast.success('Arquivo enviado');
      invalidate(qc);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível registrar o arquivo'),
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
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível cadastrar o tipo'),
  });

  const invalidateTemplates = () => {
    qc.invalidateQueries({ queryKey: ['documents', 'options'] });
    qc.invalidateQueries({ queryKey: ['documents', 'templates'] });
  };

  const saveTemplate = useMutation({
    mutationFn: () => {
      const payload = {
        name: templateForm.name,
        typeConfigId: templateForm.typeConfigId || null,
        description: templateForm.description || null,
        content: templateForm.content || null,
        isDefault: templateForm.isDefault,
      };
      return templateDialog?.mode === 'edit' && templateDialog.template
        ? api(`/documents/templates/${templateDialog.template.id}`, { method: 'PATCH', json: payload })
        : api('/documents/templates', { method: 'POST', json: payload });
    },
    onSuccess: () => {
      toast.success(templateDialog?.mode === 'edit' ? 'Modelo atualizado' : 'Modelo cadastrado');
      setTemplateDialog(null);
      invalidateTemplates();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível salvar o modelo'),
  });

  const patchTemplate = useMutation({
    mutationFn: ({ id, json }: { id: string; json: Record<string, unknown> }) =>
      api(`/documents/templates/${id}`, { method: 'PATCH', json }),
    onSuccess: () => {
      toast.success('Modelo atualizado');
      invalidateTemplates();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível atualizar o modelo'),
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => api(`/documents/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Modelo excluído');
      invalidateTemplates();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível excluir o modelo'),
  });

  const duplicateTemplate = useMutation({
    mutationFn: (id: string) => api(`/documents/templates/${id}/duplicate`, { method: 'POST', json: {} }),
    onSuccess: () => {
      toast.success('Modelo duplicado');
      invalidateTemplates();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível duplicar o modelo'),
  });

  const importTemplate = useMutation({
    mutationFn: () =>
      api('/documents/templates/import', {
        method: 'POST',
        json: {
          name: importForm.name,
          typeConfigId: importForm.typeConfigId || null,
          description: importForm.description || null,
          fileName: importDialog?.fileName,
          contentBase64: importDialog?.base64,
        },
      }),
    onSuccess: () => {
      toast.success('Modelo importado com sucesso');
      setImportDialog(null);
      setImportForm({ name: '', typeConfigId: '', description: '' });
      invalidateTemplates();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível importar o modelo'),
  });

  const installTemplates = useMutation({
    mutationFn: (keys: string[]) => api<{ installed: unknown[]; skipped: string[] }>('/documents/templates/library/install', { method: 'POST', json: { keys } }),
    onSuccess: (result) => {
      toast.success(`${result.installed.length} modelo(s) adicionados à empresa`);
      if (result.skipped.length) toast.message('Alguns modelos já existiam', { description: result.skipped.join(', ') });
      setGallerySelection([]);
      setGalleryOpen(false);
      invalidateTemplates();
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível instalar os modelos'),
  });

  const openTemplateDialog = (template: DocTemplate | null) => {
    setTemplateForm({
      name: template?.name ?? '',
      typeConfigId: template?.typeConfigId ?? '',
      description: template?.description ?? '',
      content: template?.content ?? '',
      isDefault: template?.isDefault ?? false,
    });
    setTemplateDialog({ mode: template ? 'edit' : 'create', template });
  };

  const handleTemplateFile = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('Selecione um arquivo .docx');
      return;
    }
    try {
      const base64 = await readFileAsBase64(file);
      setImportForm({ name: file.name.replace(/\.docx$/i, ''), typeConfigId: '', description: '' });
      setImportDialog({ fileName: file.name, base64 });
    } catch {
      toast.error('Não foi possível ler o arquivo selecionado');
    }
  };

  const handleDocxUpload = async (file: File | null) => {
    if (!file || !detail) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('Selecione um arquivo .docx');
      return;
    }
    try {
      const base64 = await readFileAsBase64(file);
      upload.mutate({ id: detail.id, kind: 'DOCX', fileName: file.name, contentBase64: base64 });
    } catch {
      toast.error('Não foi possível ler o arquivo selecionado');
    }
  };

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
      templateId: '',
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

  const publishedForReading = items.filter((doc) => doc.status === 'PUBLISHED');
  const revisedDocuments = [...items].filter((doc) => doc.version > 1).sort((a, b) => b.version - a.version);

  function openConfig(target: 'types' | 'templates') {
    if (!canManage) {
      toast.error('Você não possui permissão para gerenciar a configuração documental');
      return;
    }
    setSection('config');
    window.setTimeout(() => {
      (target === 'types' ? typeConfigRef : templateConfigRef).current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  function openReadings() {
    setSection('acervo');
    window.setTimeout(() => readingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentos"
        description="GED corporativo com controle de revisão, vigência, ciclos de treinamento e conformidade ISO 9500."
        actions={canCreate ? <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"><Plus className="mr-1.5 h-4 w-4" />Novo documento</Button> : null}
      />

      {/* KPIs superiores */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard title="Publicados" value={formatNumber(summary?.published)} change={`${formatNumber(summary?.total)} no acervo`} color="emerald" icon={FileText} />
        <KpiCard title="Em elaboração" value={formatNumber(summary?.draft)} change="Rascunho ou revisão" color="sky" icon={Edit} />
        <KpiCard title="Aguardando aprovação" value={formatNumber(summary?.waitingApproval)} change="Pendência de fluxo" color="purple" icon={ShieldCheck} />
        <KpiCard title="Vencidos" value={formatNumber(summary?.expired)} change="Fora da validade" color="rose" icon={CalendarClock} />
        <KpiCard title="A revisar" value={formatNumber(summary?.needsReview)} change="Vencem no alerta" color="amber" icon={RotateCcw} />
      </div>

      {/* Ações Rápidas */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
        <QuickActionBtn icon={Plus} title="Criar documento" onClick={openCreate} />
        <QuickActionBtn icon={Layers} title="Criar categoria" onClick={() => openConfig('types')} />
        <QuickActionBtn icon={FileText} title="Modelos de documento" onClick={() => openConfig('templates')} />
        <QuickActionBtn icon={History} title="Histórico de revisões" onClick={() => setHistoryOpen(true)} />
        <QuickActionBtn icon={Users} title="Leituras e treinamentos" onClick={openReadings} />
      </div>

      <Tabs value={section} onValueChange={setSection} className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-800">
          <TabsTrigger value="acervo" className="text-xs font-semibold"><Layers className="mr-2 h-4 w-4" />Acervo</TabsTrigger>
          <TabsTrigger value="matriz" className="text-xs font-semibold"><Table2 className="mr-2 h-4 w-4" />Matriz Geral</TabsTrigger>
          {canManage && <TabsTrigger value="config" className="text-xs font-semibold"><Settings className="mr-2 h-4 w-4" />Configurações</TabsTrigger>}
        </TabsList>

        <TabsContent value="acervo">
          {/* Explorador GED (padrão ECM): navegação à esquerda, acervo em tabela */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[250px_1fr]">
            {/* Rail de navegação */}
            <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <CardContent className="space-y-4 p-3">
                  <Input
                    placeholder="Buscar no acervo..."
                    value={filters.search}
                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                    className="h-9 text-xs"
                  />
                  <div>
                    <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Situação</div>
                    <div className="space-y-0.5">
                      {[
                        { label: 'Todos os documentos', status: '', expiring: '', count: summary?.total },
                        { label: 'Publicados (vigentes)', status: 'PUBLISHED', expiring: '', count: summary?.published },
                        { label: 'Em elaboração', status: 'DRAFT', expiring: '', count: summary?.byStatus?.DRAFT },
                        { label: 'Aguardando aprovação', status: 'WAITING_APPROVAL', expiring: '', count: summary?.waitingApproval },
                        { label: 'A revisar (vencem em breve)', status: '', expiring: 'soon', count: summary?.needsReview },
                        { label: 'Vencidos', status: '', expiring: 'expired', count: summary?.expired },
                        { label: 'Obsoletos/arquivados', status: 'OBSOLETE', expiring: '', count: summary?.obsolete },
                      ].map((item) => {
                        const active = filters.status === item.status && filters.expiring === item.expiring;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => setFilters((f) => ({ ...f, status: item.status, expiring: item.expiring }))}
                            className={cn(
                              'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                              active ? 'bg-sky-500/10 font-semibold text-sky-600' : 'text-slate-600 hover:bg-muted/60 dark:text-slate-300',
                            )}
                          >
                            <span className="truncate">{item.label}</span>
                            <span className={cn('ml-2 shrink-0 rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-sky-500/15' : 'bg-muted text-muted-foreground')}>
                              {formatNumber(item.count ?? 0)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipos de documento</div>
                    <div className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => setFilters((f) => ({ ...f, type: '' }))}
                        className={cn('flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors', !filters.type ? 'bg-sky-500/10 font-semibold text-sky-600' : 'text-slate-600 hover:bg-muted/60 dark:text-slate-300')}
                      >
                        <span>Todos os tipos</span>
                      </button>
                      {Object.entries(summary?.byType ?? {})
                        .filter(([, count]) => count > 0)
                        .sort(([, a], [, b]) => b - a)
                        .map(([type, count]) => {
                          const active = filters.type === type;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setFilters((f) => ({ ...f, type: active ? '' : type }))}
                              className={cn(
                                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                                active ? 'bg-sky-500/10 font-semibold text-sky-600' : 'text-slate-600 hover:bg-muted/60 dark:text-slate-300',
                              )}
                            >
                              <span className="flex min-w-0 items-center gap-1.5"><FileText className="h-3 w-3 shrink-0 text-muted-foreground" /><span className="truncate">{TYPE_LABEL[type as DocType] ?? type}</span></span>
                              <span className={cn('ml-2 shrink-0 rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-sky-500/15' : 'bg-muted text-muted-foreground')}>{count}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                  {(filters.search || filters.status || filters.type || filters.expiring) && (
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setFilters({ search: '', status: '', type: '', expiring: '' })}>
                      <X className="mr-1.5 h-3.5 w-3.5" />Limpar filtros
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Acervo em tabela */}
            <div className="min-w-0 space-y-4">
              <Card className="border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                  <div className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{formatNumber(items.length)}</strong> documento(s) no escopo atual
                  </div>
                  {canCreate && (
                    <Button size="sm" className="h-8 bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700" onClick={openCreate}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />Novo documento
                    </Button>
                  )}
                </div>
                <CardContent className="overflow-x-auto p-0">
                  {items.length === 0 ? (
                    <div className="p-10 text-center text-sm text-muted-foreground">
                      {listQuery.isLoading ? 'Carregando documentos...' : 'Nenhum documento encontrado para os filtros atuais.'}
                    </div>
                  ) : (
                    <table className="w-full min-w-[880px] text-sm">
                      <thead className="border-b bg-slate-50/60 text-[10px] uppercase tracking-wider text-muted-foreground dark:bg-slate-900/40">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Código</th>
                          <th className="px-2 py-2.5 text-left">Documento</th>
                          <th className="px-2 py-2.5 text-left">Tipo</th>
                          <th className="px-2 py-2.5 text-center">Rev.</th>
                          <th className="px-2 py-2.5 text-left">Status</th>
                          <th className="px-2 py-2.5 text-left">Validade</th>
                          <th className="px-2 py-2.5 text-left">Responsável</th>
                          <th className="px-4 py-2.5 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {items.map((doc) => (
                          <tr
                            key={doc.id}
                            className="cursor-pointer transition-colors hover:bg-sky-50/40 dark:hover:bg-slate-900/50"
                            onClick={() => setDetailId(doc.id)}
                          >
                            <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{doc.code ?? `#${doc.number}`}</td>
                            <td className="max-w-[280px] px-2 py-2.5">
                              <div className="truncate font-medium text-slate-800 dark:text-slate-200">{doc.title}</div>
                              {doc.description && <div className="truncate text-[11px] text-muted-foreground">{doc.description}</div>}
                            </td>
                            <td className="px-2 py-2.5 text-xs">{TYPE_LABEL[doc.type]}</td>
                            <td className="px-2 py-2.5 text-center text-xs font-semibold tabular-nums">v{doc.version}</td>
                            <td className="px-2 py-2.5">
                              <Badge variant="outline" className={cn('text-[10px]', STATUS_CLASS[doc.status])}>{STATUS_LABEL[doc.status]}</Badge>
                            </td>
                            <td className={cn('px-2 py-2.5 text-xs tabular-nums', doc.isExpired ? 'font-semibold text-status-red' : doc.needsReview ? 'text-status-yellow' : '')}>
                              {formatDate(doc.validUntil)}
                              {doc.isExpired && <span className="ml-1 text-[9px] font-bold uppercase">vencido</span>}
                            </td>
                            <td className="max-w-[140px] truncate px-2 py-2.5 text-xs">{doc.owner?.name ?? '—'}</td>
                            <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-0.5">
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Visão 360°" onClick={() => openVision360('DOCUMENT', doc.id)}><Network className="h-3.5 w-3.5 text-primary" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Abrir" onClick={() => setDetailId(doc.id)}><Eye className="h-3.5 w-3.5" /></Button>
                                {canUpdate && <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar metadados" onClick={() => openEdit(doc)}><Edit className="h-3.5 w-3.5" /></Button>}
                                {canDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-status-red" title="Excluir" disabled={remove.isPending} onClick={() => handleRemoveTrigger(doc.id, doc.title)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              {/* Pendências: validade e leituras lado a lado */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="flex h-[260px] flex-col border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                  <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                      <CalendarClock className="h-4 w-4 text-rose-500" />
                      Validade & Revisão Periódica
                    </h3>
                  </div>
                  <CardContent className="flex-1 overflow-y-auto p-0">
                    {(summary?.expiringSoon ?? []).length === 0 ? (
                      <div className="flex h-full items-center justify-center p-8 text-center text-xs text-muted-foreground">Nenhum documento com prazo crítico.</div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {(summary?.expiringSoon ?? []).map((doc) => (
                          <div
                            key={doc.id}
                            onClick={() => setDetailId(doc.id)}
                            className="flex cursor-pointer items-center justify-between p-3 text-xs transition-all hover:bg-slate-50/40 dark:hover:bg-slate-900/40"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-bold text-slate-800 dark:text-slate-200">{doc.code ? `${doc.code} - ` : ''}{doc.title}</div>
                              <div className="mt-0.5 text-[10px] text-slate-400">{TYPE_LABEL[doc.type]} - {doc.owner?.name ?? 'Sem responsável'}</div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-[10px] font-semibold text-slate-400">{formatDate(doc.validUntil)}</span>
                              <Badge variant="outline" className={doc.isExpired ? 'border-status-red/40 text-status-red' : 'border-status-yellow/40 text-status-yellow'}>
                                {doc.isExpired ? 'Vencido' : `${doc.daysToExpire}d`}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card ref={readingRef} className="flex h-[260px] scroll-mt-20 flex-col border border-slate-100 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50">
                  <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                      <Users className="h-4 w-4 text-sky-500" />
                      Leituras e treinamentos documentais
                    </h3>
                  </div>
                  <CardContent className="flex-1 overflow-y-auto p-0">
                    {publishedForReading.length === 0 ? (
                      <div className="flex h-full items-center justify-center p-8 text-center text-xs text-muted-foreground">Nenhum documento publicado está disponível para leitura.</div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {publishedForReading.slice(0, 8).map((doc) => (
                          <button type="button" key={doc.id} onClick={() => setDetailId(doc.id)} className="flex w-full items-center justify-between gap-3 p-3 text-left text-xs transition-all hover:bg-slate-50/40 dark:hover:bg-slate-900/40">
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-800 dark:text-slate-200">{doc.code ? `${doc.code} · ` : ''}{doc.title}</div>
                              <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{doc.orgNode?.name ?? 'Sem área'} · versão {doc.version}</div>
                            </div>
                            <span className="shrink-0 rounded border px-2 py-1 text-[9px] font-semibold text-sky-600">Abrir e confirmar</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="matriz">
          <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm">
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[980px] text-xs">
                <thead className="border-b bg-muted/40 text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-4 py-3 text-left">Título</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Área</th>
                    <th className="px-4 py-3 text-left">Responsável</th>
                    <th className="px-4 py-3 text-left">Revisão</th>
                    <th className="px-4 py-3 text-left">Validade</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-350">
                  {items.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/40">
                      <td className="px-4 py-3 font-bold">{doc.code ?? `#${doc.number}`}</td>
                      <td className="px-4 py-3 font-medium">{doc.title}</td>
                      <td className="px-4 py-3">{TYPE_LABEL[doc.type]}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className={STATUS_CLASS[doc.status]}>{STATUS_LABEL[doc.status]}</Badge></td>
                      <td className="px-4 py-3">{doc.orgNode?.name ?? '-'}</td>
                      <td className="px-4 py-3">{doc.owner?.name ?? '-'}</td>
                      <td className="px-4 py-3 font-bold">v{doc.version}</td>
                      <td className={cn('px-4 py-3', doc.isExpired && 'text-status-red')}>{formatDate(doc.validUntil)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="h-7 text-sky-500 hover:bg-sky-50/50" onClick={() => setDetailId(doc.id)}><Eye className="mr-1.5 h-3.5 w-3.5" />Abrir</Button>
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
              <Card ref={typeConfigRef} className="scroll-mt-20 border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Tipos e códigos</div>
                    <Badge variant="outline">{formatNumber(options?.typeConfigs.length)} tipos</Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                    <Input placeholder="Nome" value={typeForm.name} onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))} />
                    <Input placeholder="Sigla" value={typeForm.sigla} onChange={(e) => setTypeForm((f) => ({ ...f, sigla: e.target.value.toUpperCase(), prefix: e.target.value.toUpperCase() }))} />
                    <Input placeholder="Prefixo" value={typeForm.prefix} onChange={(e) => setTypeForm((f) => ({ ...f, prefix: e.target.value.toUpperCase() }))} />
                    <NativeSelect value={typeForm.category} onChange={(e) => setTypeForm((f) => ({ ...f, category: e.target.value as DocType }))}>
                      {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </NativeSelect>
                    <Input type="number" min={1} placeholder="Digitos" value={typeForm.digits} onChange={(e) => setTypeForm((f) => ({ ...f, digits: e.target.value }))} />
                    <Input type="number" min={1} placeholder="Validade padrão" value={typeForm.defaultValidityDays} onChange={(e) => setTypeForm((f) => ({ ...f, defaultValidityDays: e.target.value }))} />
                  </div>
                  <Button size="sm" onClick={() => createType.mutate()} disabled={createType.isPending || !typeForm.name.trim()} className="bg-sky-500 hover:bg-sky-600 text-white font-semibold"><Plus className="mr-1.5 h-4 w-4" />Cadastrar tipo</Button>
                  <div className="space-y-2">
                    {(options?.typeConfigs ?? []).map((type) => (
                      <div key={type.id} className="flex items-center justify-between rounded-md border p-3 text-xs">
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{type.name}</div>
                          <div className="text-[10px] text-muted-foreground">{type.prefix}-001 - próximo {type.nextNumber}</div>
                        </div>
                        <Badge variant={type.active ? 'secondary' : 'outline'}>{TYPE_LABEL[type.category]}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card ref={templateConfigRef} className="scroll-mt-20 border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Modelos de documento</div>
                    <Badge variant="outline">{formatNumber(templatesQuery.data?.length ?? options?.templates.length)} modelos</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openTemplateDialog(null)} className="bg-sky-500 hover:bg-sky-600 text-white font-semibold">
                      <Plus className="mr-1.5 h-4 w-4" />Novo modelo
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => templateFileRef.current?.click()}>
                      <Upload className="mr-1.5 h-4 w-4" />Importar .docx
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setGalleryOpen(true)}>
                      <Layers className="mr-1.5 h-4 w-4" />Galeria de modelos
                    </Button>
                    <input
                      ref={templateFileRef}
                      type="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={(e) => {
                        void handleTemplateFile(e.target.files?.[0] ?? null);
                        e.target.value = '';
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    {(templatesQuery.data ?? []).length === 0 && (
                      <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                        Nenhum modelo cadastrado. Crie um do zero, importe um .docx da empresa ou instale um pronto pela galeria.
                      </div>
                    )}
                    {(templatesQuery.data ?? []).map((template) => {
                      const type = options?.typeConfigs.find((item) => item.id === template.typeConfigId);
                      return (
                        <div key={template.id} className={cn('rounded-md border p-3 text-xs', !template.active && 'opacity-60')}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{template.name}</span>
                                {template.isDefault && <Badge className="h-4 px-1.5 text-[9px] bg-sky-500 hover:bg-sky-500">Padrão</Badge>}
                                {!template.active && <Badge variant="outline" className="h-4 px-1.5 text-[9px]">Inativo</Badge>}
                              </div>
                              <div className="mt-0.5 text-[10px] text-muted-foreground">
                                {type ? `Tipo: ${type.name}` : 'Sem tipo vinculado'} · v{template.version}
                                {template.description ? ` · ${template.description}` : ''}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Baixar .docx" onClick={() => downloadTemplateDocx(template)}>
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => openTemplateDialog(template)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicar" disabled={duplicateTemplate.isPending} onClick={() => duplicateTemplate.mutate(template.id)}>
                                <Layers className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title={template.isDefault ? 'Remover padrão' : 'Definir como padrão'}
                                disabled={patchTemplate.isPending}
                                onClick={() => patchTemplate.mutate({ id: template.id, json: { isDefault: !template.isDefault } })}
                              >
                                <ShieldCheck className={cn('h-3.5 w-3.5', template.isDefault && 'text-sky-500')} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title={template.active ? 'Desativar' : 'Ativar'}
                                disabled={patchTemplate.isPending}
                                onClick={() => patchTemplate.mutate({ id: template.id, json: { active: !template.active } })}
                              >
                                {template.active ? <Archive className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-status-red"
                                title="Excluir"
                                disabled={deleteTemplate.isPending}
                                onClick={() => {
                                  if (window.confirm(`Excluir o modelo "${template.name}"?`)) deleteTemplate.mutate(template.id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="rounded-md border p-3 text-xs">
                    <div className="font-semibold">Editor DOCX</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{options?.editor.configured ? `${options.editor.provider} configurado` : 'Modo manual de baixar/envio'}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Histórico de revisões do acervo</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] divide-y overflow-y-auto rounded-md border">
            {revisedDocuments.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum documento possui revisão posterior à versão inicial.</div>
            ) : revisedDocuments.map((doc) => (
              <button
                type="button"
                key={doc.id}
                onClick={() => {
                  setHistoryOpen(false);
                  setDetailId(doc.id);
                }}
                className="flex w-full items-center justify-between gap-4 p-3 text-left hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{doc.code ? `${doc.code} · ` : ''}{doc.title}</div>
                  <div className="text-xs text-muted-foreground">{doc.owner?.name ?? 'Sem responsável'} · {STATUS_LABEL[doc.status]}</div>
                </div>
                <Badge variant="secondary">versão {doc.version}</Badge>
              </button>
            ))}
          </div>
          <DialogFooter><Button onClick={() => setHistoryOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova RNC Dialog Modal */}
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-4xl overflow-y-auto max-h-[90vh] bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar documento #${editing.number}` : 'Novo documento'}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="geral" className="p-2">
            <TabsList className="bg-slate-100 dark:bg-slate-800">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
              <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
            </TabsList>
            <TabsContent value="geral" className="grid grid-cols-1 gap-4 md:grid-cols-2 pt-3">
              <div className="md:col-span-2">
                <Label>Título</Label>
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
                <Label>Código manual</Label>
                <Input placeholder={selectedType ? `${selectedType.prefix}-001` : 'Gerado automaticamente'} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
              </div>
              <div>
                <Label>Versão</Label>
                <Input type="number" min={1} value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} />
              </div>
              <div>
                <Label>Vigência</Label>
                <Input type="date" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} />
              </div>
              <div>
                <Label>Validade</Label>
                <Input type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Descrição</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </TabsContent>
            <TabsContent value="vinculos" className="grid grid-cols-1 gap-4 md:grid-cols-2 pt-3">
              <SelectField label="Área/processo" value={form.orgNodeId} onChange={(value) => setForm((f) => ({ ...f, orgNodeId: value }))} empty="Sem área direta" items={(options?.orgNodes ?? []).map((item) => ({ value: item.id, label: item.name }))} />
              <SelectField label="Indicador relacionado" value={form.indicatorId} onChange={(value) => setForm((f) => ({ ...f, indicatorId: value }))} empty="Sem indicador" items={(options?.indicators ?? []).map((item) => ({ value: item.id, label: `${item.code ? `[${item.code}] ` : ''}${item.name}` }))} />
              <SelectField label="Responsável" value={form.ownerUserId} onChange={(value) => setForm((f) => ({ ...f, ownerUserId: value }))} empty="Sem responsável" items={(options?.users ?? []).map((item) => ({ value: item.id, label: item.name }))} />
              <SelectField label="Aprovador" value={form.approverUserId} onChange={(value) => setForm((f) => ({ ...f, approverUserId: value }))} empty="Sem aprovador" items={(options?.users ?? []).map((item) => ({ value: item.id, label: item.name }))} />
              <div>
                <Label>Intervalo de revisão (meses)</Label>
                <Input type="number" min={1} value={form.reviewIntervalMonths} onChange={(e) => setForm((f) => ({ ...f, reviewIntervalMonths: e.target.value }))} />
              </div>
              <div>
                <Label>URL externa</Label>
                <Input placeholder="https://..." value={form.externalUrl} onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))} />
              </div>
            </TabsContent>
            <TabsContent value="conteudo" className="space-y-4 pt-3">
              {!editing && (
                <div>
                  <Label>Modelo do documento</Label>
                  <NativeSelect value={form.templateId} onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}>
                    <option value="">Sem modelo (ou padrão do tipo, se definido)</option>
                    {(options?.templates ?? [])
                      .filter((template) => template.active)
                      .filter((template) => !form.typeConfigId || !template.typeConfigId || template.typeConfigId === form.typeConfigId)
                      .map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}{template.isDefault ? ' (padrão)' : ''}
                        </option>
                      ))}
                  </NativeSelect>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Com um modelo selecionado e o conteúdo abaixo em branco, o documento e o DOCX inicial são gerados do modelo com código, título, empresa, responsáveis e datas já preenchidos.
                  </p>
                </div>
              )}
              <div>
                <Label>Conteúdo inicial</Label>
                <Textarea rows={8} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder={form.templateId ? 'Deixe em branco para usar o conteúdo do modelo selecionado' : ''} />
              </div>
              <div>
                <Label>Nota de alteração</Label>
                <Input value={form.changeNote} onChange={(e) => setForm((f) => ({ ...f, changeNote: e.target.value }))} />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSaveSubmit} disabled={save.isPending || !form.title.trim()} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              {save.isPending ? 'Salvando...' : 'Salvar documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Detail Dialog */}
      <Dialog open={Boolean(detailId)} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-w-6xl overflow-y-auto max-h-[92vh] bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>{detail ? `${detail.code ?? `#${detail.number}`} - ${detail.title}` : 'Documento'}</DialogTitle>
          </DialogHeader>
          
          {/* Visualizador do Ciclo de Vida do Documento */}
          {detail && (
            <div className="border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1">
                <span className={cn('h-2 w-2 rounded-full', detail.status === 'DRAFT' || detail.status === 'IN_DEVELOPMENT' ? 'bg-sky-500 animate-pulse' : 'bg-slate-300')} />
                <span>Elaboração</span>
              </div>
              <span className="text-slate-300">→</span>
              <div className="flex items-center gap-1">
                <span className={cn('h-2 w-2 rounded-full', detail.status.includes('REVIEW') || detail.status.includes('REVIS') ? 'bg-violet-500 animate-pulse' : 'bg-slate-300')} />
                <span>Revisão</span>
              </div>
              <span className="text-slate-300">→</span>
              <div className="flex items-center gap-1">
                <span className={cn('h-2 w-2 rounded-full', detail.status.includes('APPROV') || detail.status.includes('APROV') ? 'bg-amber-500 animate-pulse' : 'bg-slate-300')} />
                <span>Aprovação</span>
              </div>
              <span className="text-slate-300">→</span>
              <div className="flex items-center gap-1">
                <span className={cn('h-2 w-2 rounded-full', detail.status === 'PUBLISHED' ? 'bg-emerald-500' : 'bg-slate-300')} />
                <span>Publicado (Vigente)</span>
              </div>
            </div>
          )}

          {!detail && <div className="p-6 text-sm text-muted-foreground">Carregando documento...</div>}
          {detail && (
            <Tabs defaultValue="visualização">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between py-2">
                <TabsList className="bg-slate-100 dark:bg-slate-800">
                  <TabsTrigger value="visualização">Visualização</TabsTrigger>
                  <TabsTrigger value="geral">Geral</TabsTrigger>
                  <TabsTrigger value="documento">Edição</TabsTrigger>
                  <TabsTrigger value="revisoes">Revisões</TabsTrigger>
                  <TabsTrigger value="aprovacoes">Aprovações</TabsTrigger>
                  <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
                  <TabsTrigger value="distribuicao">Distribuição</TabsTrigger>
                </TabsList>
                <WorkflowActions doc={detail} canUpdate={canUpdate} pending={workflow.isPending} run={(action, body) => workflow.mutate({ id: detail.id, action, body })} ask={setReasonDialog} />
              </div>

              <TabsContent value="visualização">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr,320px]">
                  <div className="min-h-[420px] rounded-md border bg-muted/10">
                    {viewerLoading && <div className="p-6 text-sm text-muted-foreground">Carregando visualização...</div>}
                    {!viewerLoading && viewer && (
                      <iframe title={`Visualização de ${viewer.fileName}`} src={viewer.url} className="h-[64vh] min-h-[420px] w-full rounded-md border-0" />
                    )}
                    {!viewerLoading && !viewer && (
                      <div className="h-full min-h-[420px] overflow-auto p-5">
                        <div className="mb-3 text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Prévia textual controlada</div>
                        <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-foreground font-sans">{detail.content || detail.description || 'Este documento ainda não possui PDF publicado para visualização interna.'}</pre>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-md border p-3 text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Ações do documento</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">A abertura padrão é somente leitura. A edição exige liberação.</div>
                      <div className="mt-3 space-y-2">
                        {latestDocx && (
                          <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8" onClick={() => downloadControlled(detail.id, latestDocx.id, latestDocx.fileName)}>
                            <Download className="mr-1.5 h-3.5 w-3.5" />Baixar DOCX
                          </Button>
                        )}
                        {!myActiveEditRequest && (
                          <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8" disabled={requestEdit.isPending} onClick={() => setReasonDialog({
                            title: 'Solicitar edição do documento',
                            label: 'Motivo da revisão/edição',
                            required: false,
                            confirmLabel: 'Enviar solicitação',
                            onConfirm: (reason) => requestEdit.mutate({ id: detail.id, reason: reason || undefined }),
                          })}>
                            <Send className="mr-1.5 h-3.5 w-3.5" />Solicitar edição
                          </Button>
                        )}
                        {myActiveEditRequest && (
                          <Button size="sm" className="w-full justify-start text-xs h-8 bg-sky-500 hover:bg-sky-600 text-white" disabled={!canEditOnline || openEditor.isPending} onClick={() => openEditor.mutate(detail.id)}>
                            <Edit className="mr-1.5 h-3.5 w-3.5" />Editar Documento
                          </Button>
                        )}
                        {canUpdate && (
                          <Button size="sm" className="w-full justify-start text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => {
                            setGrantForm({ requesterUserId: '', reason: '', expiresAt: '' });
                            setGrantOpen(true);
                          }}>
                            <Edit className="mr-1.5 h-3.5 w-3.5" />Editar Documento
                          </Button>
                        )}
                        {myActiveEditRequest && (
                          <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8" disabled={decideEdit.isPending} onClick={() => decideEdit.mutate({ requestId: myActiveEditRequest.id, action: 'complete' })}>
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Concluir edição
                          </Button>
                        )}
                      </div>
                    </div>

                    {!detail.editor.configured && (
                      <div className="rounded-md border border-status-yellow/40 bg-status-yellow/5 p-3 text-xs text-muted-foreground">
                        <div>{detail.editor.message}</div>
                      </div>
                    )}

                    <div className="rounded-md border p-3 text-xs">
                      <div className="mb-2 font-semibold text-slate-800 dark:text-slate-200">Liberações de edição</div>
                      {detail.editRequests.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma solicitação registrada.</div>}
                      <div className="space-y-2">
                        {detail.editRequests.slice(0, 5).map((request) => {
                          const canDecide = request.status === 'REQUESTED' && (request.operatorUserId === user?.id || canUpdate);
                          return (
                            <div key={request.id} className="rounded-md border p-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-semibold">{request.requester?.name ?? 'Solicitante'}</span>
                                <Badge variant="outline" className="text-[9px] scale-90">{request.status}</Badge>
                              </div>
                              {request.reason && <div className="mt-1 text-[10px] text-muted-foreground">{request.reason}</div>}
                              {canDecide && (
                                <div className="mt-2 flex gap-2">
                                  <Button size="sm" className="h-6 text-[10px]" disabled={decideEdit.isPending} onClick={() => decideEdit.mutate({ requestId: request.id, action: 'approve' })}>Liberar</Button>
                                  <Button size="sm" variant="outline" className="h-6 text-[10px]" disabled={decideEdit.isPending} onClick={() => setReasonDialog({
                                    title: 'Rejeitar solicitação de edição',
                                    label: 'Justificativa da rejeição',
                                    confirmLabel: 'Rejeitar',
                                    destructive: true,
                                    onConfirm: (note) => decideEdit.mutate({ requestId: request.id, action: 'reject', note }),
                                  })}>Rejeitar</Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="geral" className="pt-2">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <InfoTile label="Status" value={<Badge variant="outline" className={STATUS_CLASS[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>} />
                  <InfoTile label="Tipo" value={TYPE_LABEL[detail.type]} />
                  <InfoTile label="Revisão atual" value={`v${detail.version}`} />
                  <InfoTile label="Área" value={detail.orgNode?.name ?? '-'} />
                  <InfoTile label="Responsável" value={detail.owner?.name ?? '-'} />
                  <InfoTile label="Aprovador" value={detail.approver?.name ?? '-'} />
                  <InfoTile label="Publicação" value={formatDate(detail.publishedAt)} />
                  <InfoTile label="Validade" value={formatDate(detail.validUntil)} />
                  <InfoTile label="Editor" value={detail.editor.configured ? detail.editor.provider : 'Manual'} />
                </div>
                <div className="mt-4 rounded-md border p-4 text-xs text-muted-foreground">{detail.description ?? 'Sem descrição registrada.'}</div>
              </TabsContent>

              <TabsContent value="documento">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr,320px]">
                  <div className="space-y-3">
                    {!detail.editor.configured && (
                      <div className="rounded-md border border-status-yellow/40 bg-status-yellow/5 p-3 text-xs text-muted-foreground">
                        {detail.editor.message}
                      </div>
                    )}
                    <Textarea rows={14} value={draftContent} onChange={(e) => setDraftContent(e.target.value)} disabled={!isEditable(detail.status) || !canUpdate} className="text-xs font-mono" />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => autosave.mutate({ id: detail.id, content: draftContent })} disabled={!isEditable(detail.status) || autosave.isPending || !canUpdate}>
                        <Save className="mr-1.5 h-4 w-4" />Salvar checkpoint
                      </Button>
                      {myActiveEditRequest && (
                        <Button size="sm" variant="outline" onClick={() => openEditor.mutate(detail.id)} disabled={openEditor.isPending || !canEditOnline}>
                          <Edit className="mr-1.5 h-4 w-4" />Editar Documento
                        </Button>
                      )}
                      {canUpdate && (
                        <Button size="sm" variant="outline" onClick={() => {
                          setGrantForm({ requesterUserId: '', reason: '', expiresAt: '' });
                          setGrantOpen(true);
                        }}>
                          <Edit className="mr-1.5 h-4 w-4" />Editar Documento
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Arquivos</div>
                    {detail.files.length === 0 && <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground text-center">Nenhum arquivo registrado.</div>}
                    {detail.files.map((file) => (
                      <div key={file.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{file.fileName}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{file.kind} - {formatBytes(file.sizeBytes)}</div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadControlled(detail.id, file.id, file.fileName)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {canUpdate && (
                      <>
                        <input
                          ref={docxFileRef}
                          type="file"
                          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className="hidden"
                          onChange={(e) => {
                            void handleDocxUpload(e.target.files?.[0] ?? null);
                            e.target.value = '';
                          }}
                        />
                        <Button variant="outline" size="sm" className="w-full text-xs" disabled={upload.isPending} onClick={() => docxFileRef.current?.click()}>
                          <Upload className="mr-1.5 h-4 w-4" />{upload.isPending ? 'Enviando...' : 'Enviar DOCX (arquivo)'}
                        </Button>
                        <p className="text-[10px] text-muted-foreground">
                          Envie o .docx baixado/editado no Word. O arquivo é preservado byte a byte e vira a versão editável atual.
                        </p>
                      </>
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
                  }))} empty="Nenhuma solicitação de ajuste." />
                  <Timeline items={detail.approvals.map((item) => ({
                    id: item.id,
                    icon: <CheckCircle2 className="h-4 w-4" />,
                    title: item.decision,
                    meta: item.decidedAt ? formatDate(item.decidedAt) : formatDate(item.createdAt),
                    body: item.comment,
                  }))} empty="Nenhuma aprovação registrada." />
                </div>
              </TabsContent>

              <TabsContent value="auditoria">
                <Timeline items={[...detail.statusHistory.map((item) => ({
                  id: item.id,
                  icon: <History className="h-4 w-4" />,
                  title: `${item.statusFrom ?? 'Início'} -> ${item.statusTo}`,
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
                <div className="rounded-md border p-4 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Confirmações de leitura ficam registradas por revisão.</span>
                  <Button variant="outline" size="sm" className="h-8 text-xs bg-sky-500 hover:bg-sky-600 text-white font-semibold" onClick={() => api(`/documents/${detail.id}/read-confirmations`, { method: 'POST', json: {} }).then(() => toast.success('Leitura confirmada')).then(() => invalidate(qc))}>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Confirmar leitura
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar edição do documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              O usuário receberá a tarefa para editar o documento. A abertura para edição só fica disponível depois desta liberação.
            </div>
            <div>
              <Label>Usuário responsável pela edição</Label>
              <NativeSelect value={grantForm.requesterUserId} onChange={(event) => setGrantForm((form) => ({ ...form, requesterUserId: event.target.value }))}>
                <option value="">Selecione o usuário</option>
                {(options?.users ?? []).map((item) => (
                  <option key={item.id} value={item.id}>{item.name} - {item.email}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Motivo ou orientação</Label>
              <Textarea rows={3} value={grantForm.reason} onChange={(event) => setGrantForm((form) => ({ ...form, reason: event.target.value }))} placeholder="Informe o que deve ser revisado ou alterado." />
            </div>
            <div>
              <Label>Prazo da liberação</Label>
              <Input type="date" value={grantForm.expiresAt} onChange={(event) => setGrantForm((form) => ({ ...form, expiresAt: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancelar</Button>
            <Button
              disabled={!detail || !grantForm.requesterUserId || grantEdit.isPending}
              onClick={() => detail && grantEdit.mutate({ id: detail.id, requesterUserId: grantForm.requesterUserId, reason: grantForm.reason || undefined, expiresAt: grantForm.expiresAt || undefined })}
            >
              {grantEdit.isPending ? 'Enviando...' : 'Enviar para edição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Criar/editar modelo de documento */}
      <Dialog open={Boolean(templateDialog)} onOpenChange={(v) => !v && setTemplateDialog(null)}>
        <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{templateDialog?.mode === 'edit' ? `Editar modelo — ${templateDialog.template?.name}` : 'Novo modelo de documento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Nome do modelo</Label>
                <Input value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Tipo documental vinculado</Label>
                <NativeSelect value={templateForm.typeConfigId} onChange={(e) => setTemplateForm((f) => ({ ...f, typeConfigId: e.target.value }))}>
                  <option value="">Sem tipo vinculado (uso geral)</option>
                  {(options?.typeConfigs ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </NativeSelect>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={templateForm.description} onChange={(e) => setTemplateForm((f) => ({ ...f, description: e.target.value }))} placeholder="Quando usar este modelo" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Conteúdo do modelo</Label>
                <span className="text-[10px] text-muted-foreground">Suporta títulos (#), tabelas (|), negrito (**) e os campos abaixo</span>
              </div>
              {templateDialog?.mode === 'edit' && templateDialog.template?.fileName && (
                <p className="mb-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  Alterar o texto regenera o arquivo .docx do modelo. Para manter a formatação de um .docx importado, edite o arquivo no Word e importe novamente.
                </p>
              )}
              <Textarea rows={12} className="font-mono text-xs" value={templateForm.content} onChange={(e) => setTemplateForm((f) => ({ ...f, content: e.target.value }))} placeholder={'# 1. Objetivo\n\n{{document_code}} - {{document_title}}...'} />
              <div className="mt-2 flex flex-wrap gap-1">
                {(options?.placeholders ?? []).map((placeholder) => (
                  <button
                    key={placeholder}
                    type="button"
                    className="rounded border bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono hover:bg-muted"
                    title="Inserir no conteúdo"
                    onClick={() => setTemplateForm((f) => ({ ...f, content: `${f.content}${f.content && !f.content.endsWith(' ') && !f.content.endsWith('\n') ? ' ' : ''}${placeholder}` }))}
                  >
                    {placeholder}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={templateForm.isDefault} onChange={(e) => setTemplateForm((f) => ({ ...f, isDefault: e.target.checked }))} />
              Usar como modelo padrão {templateForm.typeConfigId ? 'deste tipo documental' : 'geral'}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(null)}>Cancelar</Button>
            <Button onClick={() => saveTemplate.mutate()} disabled={saveTemplate.isPending || !templateForm.name.trim()} className="bg-sky-500 hover:bg-sky-600 text-white font-semibold">
              {saveTemplate.isPending ? 'Salvando...' : 'Salvar modelo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Importar modelo .docx */}
      <Dialog open={Boolean(importDialog)} onOpenChange={(v) => !v && setImportDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar modelo (.docx)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              Arquivo: <span className="font-semibold text-foreground">{importDialog?.fileName}</span>. O .docx é preservado como está;
              campos <span className="font-mono">{'{{...}}'}</span> presentes no arquivo são preenchidos automaticamente ao criar documentos.
            </div>
            <div>
              <Label>Nome do modelo</Label>
              <Input value={importForm.name} onChange={(e) => setImportForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Tipo documental vinculado</Label>
              <NativeSelect value={importForm.typeConfigId} onChange={(e) => setImportForm((f) => ({ ...f, typeConfigId: e.target.value }))}>
                <option value="">Sem tipo vinculado (uso geral)</option>
                {(options?.typeConfigs ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={importForm.description} onChange={(e) => setImportForm((f) => ({ ...f, description: e.target.value }))} placeholder="Quando usar este modelo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialog(null)}>Cancelar</Button>
            <Button onClick={() => importTemplate.mutate()} disabled={importTemplate.isPending || !importForm.name.trim()} className="bg-sky-500 hover:bg-sky-600 text-white font-semibold">
              <Upload className="mr-1.5 h-4 w-4" />{importTemplate.isPending ? 'Importando...' : 'Importar modelo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Galeria de modelos prontos */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-4xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Galeria de modelos prontos</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Modelos profissionais com estrutura, tabelas e campos automáticos. Ao instalar, viram modelos da empresa e podem ser editados livremente.
          </p>
          {libraryQuery.isLoading && <div className="p-6 text-sm text-muted-foreground">Carregando galeria...</div>}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(libraryQuery.data ?? []).map((entry) => {
              const checked = gallerySelection.includes(entry.key);
              return (
                <button
                  key={entry.key}
                  type="button"
                  disabled={entry.installed}
                  onClick={() => setGallerySelection((keys) => (checked ? keys.filter((k) => k !== entry.key) : [...keys, entry.key]))}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-all',
                    entry.installed && 'opacity-50 cursor-not-allowed',
                    checked && 'border-sky-500 ring-2 ring-sky-500/20',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{entry.name}</span>
                    {entry.installed ? (
                      <Badge variant="secondary" className="text-[9px]">Instalado</Badge>
                    ) : (
                      <input type="checkbox" readOnly checked={checked} />
                    )}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{TYPE_LABEL[entry.category] ?? entry.category}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGalleryOpen(false)}>Fechar</Button>
            <Button
              onClick={() => installTemplates.mutate(gallerySelection)}
              disabled={installTemplates.isPending || gallerySelection.length === 0}
              className="bg-sky-500 hover:bg-sky-600 text-white font-semibold"
            >
              {installTemplates.isPending ? 'Instalando...' : `Adicionar ${gallerySelection.length || ''} modelo(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog state={reasonDialog} onClose={() => setReasonDialog(null)} />

      <OnlineEditorDialog session={editorSession} onClose={() => { setEditorSession(null); invalidate(qc); }} />

      {impactModalConfig && (
        <ImpactConfirmationModal
          isOpen={impactModalConfig.isOpen}
          onClose={() => setImpactModalConfig(null)}
          onConfirm={impactModalConfig.onConfirm}
          entityType={impactModalConfig.entityType}
          entityId={impactModalConfig.entityId}
          operationType={impactModalConfig.operationType}
          changeSummary={impactModalConfig.changeSummary}
        />
      )}
    </div>
  );
}

function OnlineEditorDialog({ session, onClose }: { session: EditorSession | null; onClose: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (session?.editorUrl) {
      // O frame WOPI exige um POST com o access_token; submetemos apos montar.
      const timer = setTimeout(() => formRef.current?.submit(), 0);
      return () => clearTimeout(timer);
    }
  }, [session?.editorUrl, session?.accessToken]);

  if (!session?.editorUrl) return null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-sm">Editor DOCX pela web — {session.provider}</DialogTitle>
        </DialogHeader>
        <div className="relative min-h-0 flex-1">
          <form ref={formRef} action={session.editorUrl} method="post" target="g360-editor-frame" className="hidden">
            <input type="hidden" name="access_token" value={session.accessToken ?? ''} />
            <input type="hidden" name="access_token_ttl" value={String(session.accessTokenTtl ?? 0)} />
          </form>
          <iframe
            name="g360-editor-frame"
            title="Editor de documento"
            className="h-full w-full border-0"
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkflowActions({ doc, canUpdate, pending, run, ask }: { doc: DocDetail; canUpdate: boolean; pending: boolean; run: (action: string, body?: unknown) => void; ask: (state: ReasonDialogState) => void }) {
  if (!canUpdate) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {isEditable(doc.status) && <Button size="sm" disabled={pending} onClick={() => run('submit-review')}><Send className="mr-2 h-4 w-4" />Enviar revisão</Button>}
      {doc.status === 'WAITING_REVIEW' && <Button size="sm" disabled={pending} onClick={() => run('start-review')}><Eye className="mr-2 h-4 w-4" />Iniciar revisão</Button>}
      {(doc.status === 'IN_REVIEW' || doc.status === 'REVIEW') && (
        <>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => ask({
            title: 'Solicitar ajustes',
            label: 'Comentário dos ajustes',
            confirmLabel: 'Solicitar ajustes',
            onConfirm: (value) => run('request-adjustments', { comment: value }),
          })}><AlertTriangle className="mr-2 h-4 w-4" />Ajustes</Button>
          <Button size="sm" disabled={pending} onClick={() => run('complete-review')}><CheckCircle2 className="mr-2 h-4 w-4" />Revisado</Button>
        </>
      )}
      {doc.status === 'REVIEWED' && <Button size="sm" disabled={pending} onClick={() => run('send-approval')}><ShieldCheck className="mr-2 h-4 w-4" />Enviar aprovação</Button>}
      {doc.status === 'WAITING_APPROVAL' && <Button size="sm" disabled={pending} onClick={() => run('start-approval')}><ShieldCheck className="mr-2 h-4 w-4" />Iniciar aprovação</Button>}
      {doc.status === 'IN_APPROVAL' && (
        <>
          <Button size="sm" disabled={pending} onClick={() => run('approve')}><CheckCircle2 className="mr-2 h-4 w-4" />Aprovar</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => ask({
            title: 'Reprovar documento',
            label: 'Motivo da reprovação',
            confirmLabel: 'Reprovar',
            destructive: true,
            onConfirm: (value) => run('reject', { comment: value }),
          })}><X className="mr-2 h-4 w-4" />Reprovar</Button>
        </>
      )}
      {doc.status === 'APPROVED' && <Button size="sm" disabled={pending} onClick={() => run('publish')}><FileText className="mr-2 h-4 w-4" />Publicar</Button>}
      {doc.status === 'PUBLISHED' && (
        <>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => ask({
            title: 'Iniciar nova revisão',
            label: 'Motivo da nova revisão',
            confirmLabel: 'Criar revisão',
            onConfirm: (value) => run('new-revision', { reason: value }),
          })}><RotateCcw className="mr-2 h-4 w-4" />Nova revisão</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => ask({
            title: 'Tornar documento obsoleto',
            label: 'Motivo da obsolescência',
            confirmLabel: 'Tornar obsoleto',
            destructive: true,
            onConfirm: (value) => run('obsolete', { comment: value }),
          })}><Archive className="mr-2 h-4 w-4" />Obsoleto</Button>
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
  try {
    const blob = await fetchControlledBlob(documentId, fileId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Não foi possível baixar o arquivo');
  }
}

async function fetchControlledBlob(documentId: string, fileId: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/documents/${documentId}/files/${fileId}/download`, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error('Falha ao baixar arquivo');
  return res.blob();
}

async function downloadTemplateDocx(template: DocTemplate) {
  try {
    const token = getAccessToken();
    const res = await fetch(`${API_URL}/documents/templates/${template.id}/download`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error('Falha ao baixar modelo');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = template.fileName?.endsWith('.docx') ? template.fileName : `${template.name}.docx`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Não foi possível baixar o modelo');
  }
}

/** Lê um arquivo local e retorna apenas o payload base64 (sem prefixo data:). */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
      if (!base64) reject(new Error('Arquivo vazio'));
      else resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Falha na leitura'));
    reader.readAsDataURL(file);
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['documents'] });
}

function KpiCard({ title, value, change, color, icon: Icon }: { title: string; value: any; change: string; color: 'emerald' | 'sky' | 'purple' | 'rose' | 'amber'; icon: any }) {
  const colors = {
    emerald: 'border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/10 dark:bg-emerald-950/10 text-emerald-600 dark:text-emerald-400',
    sky: 'border-sky-100 dark:border-sky-900/30 bg-sky-50/10 dark:bg-sky-950/10 text-sky-600 dark:text-sky-400',
    purple: 'border-purple-100 dark:border-purple-900/30 bg-purple-50/10 dark:bg-purple-950/10 text-purple-600 dark:text-purple-400',
    rose: 'border-rose-100 dark:border-rose-900/30 bg-rose-50/10 dark:bg-rose-950/10 text-rose-600 dark:text-rose-400',
    amber: 'border-amber-100 dark:border-amber-900/30 bg-amber-50/10 dark:bg-amber-950/10 text-amber-600 dark:text-amber-400'
  };

  return (
    <Card className={cn("border bg-card shadow-sm p-4 relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.01] flex items-center justify-between", colors[color])}>
      <div className="space-y-1">
        <span className="text-[10px] uppercase font-bold tracking-wider opacity-85 text-slate-550 dark:text-slate-400">{title}</span>
        <div className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">{value ?? '0'}</div>
        <span className="text-[10px] text-slate-400 font-medium">{change}</span>
      </div>
      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-50 dark:border-slate-800">
        <Icon className="h-5 w-5" />
      </div>
    </Card>
  );
}

function QuickActionBtn({ icon: Icon, title, onClick }: { icon: any; title: string; onClick?: () => void }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="flex items-center justify-start gap-3 bg-card border-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 text-slate-700 dark:text-slate-200 h-11 w-full rounded-xl transition-all duration-200 text-xs font-semibold shadow-sm hover:scale-[1.01]"
    >
      <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4" />
      </div>
      <span>{title}</span>
    </Button>
  );
}


