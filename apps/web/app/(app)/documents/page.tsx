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
  NEAR_EXPIRATION: 'Proximo do vencimento',
  EXPIRED: 'Vencido',
  PERIODIC_REVIEW: 'Revisão periódica',
  REPLACED: 'Substituído',
  OBSOLETE: 'Obsoleto',
  ARCHIVED: 'Arquivado',
  CANCELLED: 'Cancelado',
};

const TYPE_LABEL: Record<DocType, string> = {
  POLICY: 'Politica',
  PROCEDURE: 'Procedimento',
  INSTRUCTION: 'Instrucao',
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
  CHECKLIST: 'Checklist',
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
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantForm, setGrantForm] = useState({ requesterUserId: '', reason: '', expiresAt: '' });
  const [draftContent, setDraftContent] = useState('');
  const [editorSession, setEditorSession] = useState<EditorSession | null>(null);
  const [viewer, setViewer] = useState<{ url: string; fileId: string; fileName: string } | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const autoOpenEditorRef = useRef<string | null>(null);
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
        toast.message('Editor online indisponivel', {
          description: session.message ?? 'Use download/upload de nova versão.',
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
      toast.success(variables.action === 'approve' ? 'Edição liberada' : variables.action === 'reject' ? 'Solicitação rejeitada' : 'Edição concluida');
      invalidate(qc);
      void qc.invalidateQueries({ queryKey: ['my-day'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível atualizar a solicitação'),
  });

  const upload = useMutation({
    mutationFn: ({ id, kind, fileName, content }: { id: string; kind: FileKind; fileName: string; content: string }) =>
      api(`/documents/${id}/files`, { method: 'POST', json: { kind, fileName, content } }),
    onSuccess: () => {
      toast.success('Arquivo registrado');
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
    onError: (e: any) => toast.error(e?.message ?? 'Não foi possível cadastrar o template'),
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
        description="GED corporativo com códigos, revisões, validade, aprovação e publicação controlada."
        actions={canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo documento</Button> : null}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Publicados" value={formatNumber(summary?.published)} description={`${formatNumber(summary?.total)} no acervo`} icon={<FileText className="h-4 w-4" />} tone="green" />
        <MetricCard title="Em elaboração" value={formatNumber(summary?.draft)} description="Rascunho, ajustes ou revisão" icon={<Edit className="h-4 w-4" />} tone="blue" />
        <MetricCard title="Aguardando aprovação" value={formatNumber(summary?.waitingApproval)} description="Fluxo pendente" icon={<ShieldCheck className="h-4 w-4" />} tone={(summary?.waitingApproval ?? 0) > 0 ? 'purple' : 'green'} />
        <MetricCard title="Vencidos" value={formatNumber(summary?.expired)} description="Publicados fora da validade" icon={<CalendarClock className="h-4 w-4" />} tone={(summary?.expired ?? 0) > 0 ? 'red' : 'green'} />
        <MetricCard title="A revisar" value={formatNumber(summary?.needsReview)} description="Vencem no alerta" icon={<RotateCcw className="h-4 w-4" />} tone={(summary?.needsReview ?? 0) > 0 ? 'yellow' : 'green'} />
      </div>

      <Tabs defaultValue="acervo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="acervo"><Layers className="mr-2 h-4 w-4" />Acervo</TabsTrigger>
          <TabsTrigger value="matriz"><Table2 className="mr-2 h-4 w-4" />Matriz</TabsTrigger>
          {canManage && <TabsTrigger value="config"><Settings className="mr-2 h-4 w-4" />Configurações</TabsTrigger>}
        </TabsList>

        <TabsContent value="acervo">
          <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr,360px]">
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Validade / revisão</div>
                    <div className="text-xs text-muted-foreground">Documentos vencidos ou próximos da revisão.</div>
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
                        <div className="mt-1 text-xs text-muted-foreground">{TYPE_LABEL[doc.type]} - {doc.owner?.name ?? 'Sem responsável'} - validade {formatDate(doc.validUntil)}</div>
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
              <DocumentCard key={doc.id} doc={doc} canUpdate={canUpdate} canDelete={canDelete} onView={() => setDetailId(doc.id)} onEdit={() => openEdit(doc)} onRemove={() => handleRemoveTrigger(doc.id, doc.title)} removing={remove.isPending} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="matriz">
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Código</th>
                    <th className="px-4 py-3 text-left font-medium">Titulo</th>
                    <th className="px-4 py-3 text-left font-medium">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Área</th>
                    <th className="px-4 py-3 text-left font-medium">Responsável</th>
                    <th className="px-4 py-3 text-left font-medium">Revisão</th>
                    <th className="px-4 py-3 text-left font-medium">Validade</th>
                    <th className="px-4 py-3 text-right font-medium">Ações</th>
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
                    <div className="text-sm font-semibold">Tipos e códigos</div>
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
                          <div className="text-xs text-muted-foreground">{type.prefix}-001 - próximo {type.nextNumber}</div>
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
              <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
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
                <Label>Código manual</Label>
                <Input placeholder={selectedType ? `${selectedType.prefix}-001` : 'Gerado automaticamente'} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
              </div>
              <div>
                <Label>Versao</Label>
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
            <TabsContent value="vinculos" className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            <TabsContent value="conteudo" className="space-y-4">
              <div>
                <Label>Conteúdo inicial</Label>
                <Textarea rows={8} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
              </div>
              <div>
                <Label>Nota de alteração</Label>
                <Input value={form.changeNote} onChange={(e) => setForm((f) => ({ ...f, changeNote: e.target.value }))} />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSaveSubmit} disabled={save.isPending || !form.title.trim()}>
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
            <Tabs defaultValue="visualização">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <TabsList>
                  <TabsTrigger value="visualização">Visualização</TabsTrigger>
                  <TabsTrigger value="geral">Geral</TabsTrigger>
                  <TabsTrigger value="documento">Edição</TabsTrigger>
                  <TabsTrigger value="revisoes">Revisões</TabsTrigger>
                  <TabsTrigger value="aprovacoes">Aprovações</TabsTrigger>
                  <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
                  <TabsTrigger value="distribuicao">Distribuicao</TabsTrigger>
                </TabsList>
                <WorkflowActions doc={detail} canUpdate={canUpdate} pending={workflow.isPending} run={(action, body) => workflow.mutate({ id: detail.id, action, body })} />
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
                        <div className="mb-3 text-xs uppercase text-muted-foreground">Prévia textual controlada</div>
                        <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{detail.content || detail.description || 'Este documento ainda não possui PDF publicado para visualização interna.'}</pre>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-md border p-3">
                      <div className="text-sm font-semibold">Ações do documento</div>
                      <div className="mt-1 text-xs text-muted-foreground">A abertura padrao e somente leitura. Edição online exige liberação.</div>
                      <div className="mt-3 space-y-2">
                        {latestDocx && (
                          <Button variant="outline" className="w-full justify-start" onClick={() => downloadControlled(detail.id, latestDocx.id, latestDocx.fileName)}>
                            <Download className="mr-2 h-4 w-4" />Baixar DOCX
                          </Button>
                        )}
                        {!myActiveEditRequest && (
                          <Button variant="outline" className="w-full justify-start" disabled={requestEdit.isPending} onClick={() => {
                            const reason = window.prompt('Descreva o motivo da revisão/edição');
                            if (reason === null) return;
                            requestEdit.mutate({ id: detail.id, reason: reason || undefined });
                          }}>
                            <Send className="mr-2 h-4 w-4" />Solicitar edição
                          </Button>
                        )}
                        {myActiveEditRequest && (
                          <Button className="w-full justify-start" disabled={!canEditOnline || openEditor.isPending} onClick={() => openEditor.mutate(detail.id)}>
                            <Edit className="mr-2 h-4 w-4" />Editar Documento
                          </Button>
                        )}
                        {canUpdate && (
                          <Button className="w-full justify-start" onClick={() => {
                            setGrantForm({ requesterUserId: '', reason: '', expiresAt: '' });
                            setGrantOpen(true);
                          }}>
                            <Edit className="mr-2 h-4 w-4" />Editar Documento
                          </Button>
                        )}
                        {myActiveEditRequest && (
                          <Button variant="outline" className="w-full justify-start" disabled={decideEdit.isPending} onClick={() => decideEdit.mutate({ requestId: myActiveEditRequest.id, action: 'complete' })}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />Concluir edição
                          </Button>
                        )}
                      </div>
                    </div>

                    {!detail.editor.configured && (
                      <div className="rounded-md border border-status-yellow/40 bg-status-yellow/5 p-3 text-sm text-muted-foreground">
                        <div>{detail.editor.message}</div>
                      </div>
                    )}

                    <div className="rounded-md border p-3">
                      <div className="mb-2 text-sm font-semibold">Liberações de edição</div>
                      {detail.editRequests.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma solicitação registrada.</div>}
                      <div className="space-y-2">
                        {detail.editRequests.slice(0, 5).map((request) => {
                          const canDecide = request.status === 'REQUESTED' && (request.operatorUserId === user?.id || canUpdate);
                          return (
                            <div key={request.id} className="rounded-md border p-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium">{request.requester?.name ?? 'Solicitante'}</span>
                                <Badge variant="outline">{request.status}</Badge>
                              </div>
                              {request.reason && <div className="mt-1 text-xs text-muted-foreground">{request.reason}</div>}
                              {canDecide && (
                                <div className="mt-2 flex gap-2">
                                  <Button size="sm" disabled={decideEdit.isPending} onClick={() => decideEdit.mutate({ requestId: request.id, action: 'approve' })}>Liberar</Button>
                                  <Button size="sm" variant="outline" disabled={decideEdit.isPending} onClick={() => {
                                    const note = window.prompt('Justificativa da rejeicao');
                                    if (note) decideEdit.mutate({ requestId: request.id, action: 'reject', note });
                                  }}>Rejeitar</Button>
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

              <TabsContent value="geral">
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
                <div className="mt-4 rounded-md border p-4 text-sm text-muted-foreground">{detail.description ?? 'Sem descrição registrada.'}</div>
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
                      {myActiveEditRequest && (
                        <Button variant="outline" onClick={() => openEditor.mutate(detail.id)} disabled={openEditor.isPending || !canEditOnline}>
                          <Edit className="mr-2 h-4 w-4" />Editar Documento
                        </Button>
                      )}
                      {canUpdate && (
                        <Button variant="outline" onClick={() => {
                          setGrantForm({ requesterUserId: '', reason: '', expiresAt: '' });
                          setGrantOpen(true);
                        }}>
                          <Edit className="mr-2 h-4 w-4" />Editar Documento
                        </Button>
                      )}
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
                        const content = window.prompt('Conteúdo do arquivo');
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
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  Confirmações de leitura ficam registradas por revisão.
                  <Button className="ml-0 mt-3 sm:ml-3 sm:mt-0" variant="outline" onClick={() => api(`/documents/${detail.id}/read-confirmations`, { method: 'POST', json: {} }).then(() => toast.success('Leitura confirmada')).then(() => invalidate(qc))}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />Confirmar leitura
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
              O usuário receberá a tarefa para editar o documento. A abertura online só fica disponível depois desta liberação.
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
          <DialogTitle className="text-sm">Editor DOCX online — {session.provider}</DialogTitle>
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

function DocumentCard({ doc, canUpdate, canDelete, onView, onEdit, onRemove, removing }: { doc: Doc; canUpdate: boolean; canDelete: boolean; onView: () => void; onEdit: () => void; onRemove: () => void; removing: boolean }) {
  const { open: openVision360 } = useVision360();
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
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{doc.description || 'Sem descrição registrada.'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => openVision360('DOCUMENT', doc.id)} title="Visão 360°"><Network className="h-4 w-4 text-primary" /></Button>
            <Button variant="ghost" size="icon" onClick={onView} title="Abrir documento"><Eye className="h-4 w-4" /></Button>
            {canUpdate && <Button variant="ghost" size="icon" onClick={onEdit} title="Editar metadados"><Edit className="h-4 w-4" /></Button>}
            {canDelete && (
              <Button variant="ghost" size="icon" onClick={onRemove} disabled={removing} title="Excluir documento">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div>Área/processo: <span className="text-foreground">{doc.orgNode?.name ?? '-'}</span></div>
          <div>Responsável: <span className="text-foreground">{doc.owner?.name ?? '-'}</span></div>
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
          <Input placeholder="Buscar por título, código, conteúdo..." value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
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
      {isEditable(doc.status) && <Button size="sm" disabled={pending} onClick={() => run('submit-review')}><Send className="mr-2 h-4 w-4" />Enviar revisão</Button>}
      {doc.status === 'WAITING_REVIEW' && <Button size="sm" disabled={pending} onClick={() => run('start-review')}><Eye className="mr-2 h-4 w-4" />Iniciar revisão</Button>}
      {(doc.status === 'IN_REVIEW' || doc.status === 'REVIEW') && (
        <>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => {
            const value = comment('Comentário dos ajustes');
            if (value) run('request-adjustments', { comment: value });
          }}><AlertTriangle className="mr-2 h-4 w-4" />Ajustes</Button>
          <Button size="sm" disabled={pending} onClick={() => run('complete-review')}><CheckCircle2 className="mr-2 h-4 w-4" />Revisado</Button>
        </>
      )}
      {doc.status === 'REVIEWED' && <Button size="sm" disabled={pending} onClick={() => run('send-approval')}><ShieldCheck className="mr-2 h-4 w-4" />Enviar aprovação</Button>}
      {doc.status === 'WAITING_APPROVAL' && <Button size="sm" disabled={pending} onClick={() => run('start-approval')}><ShieldCheck className="mr-2 h-4 w-4" />Iniciar aprovação</Button>}
      {doc.status === 'IN_APPROVAL' && (
        <>
          <Button size="sm" disabled={pending} onClick={() => run('approve')}><CheckCircle2 className="mr-2 h-4 w-4" />Aprovar</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => {
            const value = comment('Motivo da reprovação');
            if (value) run('reject', { comment: value });
          }}><X className="mr-2 h-4 w-4" />Reprovar</Button>
        </>
      )}
      {doc.status === 'APPROVED' && <Button size="sm" disabled={pending} onClick={() => run('publish')}><FileText className="mr-2 h-4 w-4" />Publicar</Button>}
      {doc.status === 'PUBLISHED' && (
        <>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => {
            const value = comment('Motivo da nova revisão');
            if (value) run('new-revision', { reason: value });
          }}><RotateCcw className="mr-2 h-4 w-4" />Nova revisão</Button>
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

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['documents'] });
}
