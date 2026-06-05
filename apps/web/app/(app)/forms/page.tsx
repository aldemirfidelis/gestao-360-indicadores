'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Archive,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Edit,
  FileCheck,
  FileSpreadsheet,
  Filter,
  FolderTree,
  History,
  LayoutTemplate,
  Link2,
  ListChecks,
  Paperclip,
  PenLine,
  Play,
  Plus,
  QrCode,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
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
import { Progress } from '@/components/ui/progress';
import { NativeSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';

type TemplateType = string;
type TemplateStatus = string;
type FieldType = string;
type SubmissionStatus = string;
type ExecutionStatus = string;

interface FormField {
  id: string;
  order: number;
  code: string | null;
  sectionId?: string | null;
  label: string;
  type: FieldType;
  required: boolean;
  options: string | null;
  helpText: string | null;
  placeholder?: string | null;
  evidenceRequired?: boolean;
  commentRequired?: boolean;
  criticality?: string | null;
  weight?: number | null;
  optionsV2?: Array<{ id: string; label: string; value: string; color: string | null; score: number | null }>;
}

interface FormTemplate {
  id: string;
  number: number;
  code: string | null;
  title: string;
  description: string | null;
  purpose?: string | null;
  instructions?: string | null;
  type: TemplateType;
  status: TemplateStatus;
  version: string | null;
  currentVersionId?: string | null;
  typeConfigId?: string | null;
  categoryId?: string | null;
  folderId?: string | null;
  confidentiality?: string | null;
  estimatedMinutes?: number | null;
  retentionDays?: number | null;
  tags?: string[];
  orgNodeId: string | null;
  processId: string | null;
  indicatorId: string | null;
  ownerUserId: string | null;
  orgNode: { id: string; name: string; type: string } | null;
  process: { id: string; number: number; code: string | null; name: string; orgNodeId: string | null } | null;
  indicator: { id: string; name: string; code: string | null; ownerNodeId: string } | null;
  owner: { id: string; name: string; email: string } | null;
  typeConfig?: { id: string; name: string; code: string; color: string | null; icon: string | null; category: string } | null;
  category?: { id: string; name: string; color: string | null; icon: string | null } | null;
  folder?: { id: string; name: string; path: string | null } | null;
  versions?: Array<{ id: string; versionNumber: number; versionLabel: string; status: string; publishedAt?: string | null }>;
  sections?: Array<{ id: string; code: string | null; title: string; position: number; repeatable: boolean }>;
  fields: FormField[];
  fieldsCount: number;
  requiredFieldsCount?: number;
  submissionsCount: number;
  versionsCount?: number;
  executionsCount?: number;
  issuesCount?: number;
  areaId: string | null;
}

interface FormSubmission {
  id: string;
  code?: string | null;
  title: string | null;
  status: SubmissionStatus;
  notes: string | null;
  submittedAt: string | null;
  completedAt?: string | null;
  reviewedAt: string | null;
  score?: number | null;
  classification?: string | null;
  templateVersion?: { id: string; versionNumber: number; versionLabel: string; status: string } | null;
  execution?: { id: string; code: string; title: string; status: string; dueDate: string | null } | null;
  operationalRecord?: { id: string; code: string; title: string; status: string; recordDate: string } | null;
  submittedBy: { id: string; name: string; email: string } | null;
  evidence?: unknown[];
  signatures?: unknown[];
  approvals?: Array<{ id: string; decision: string; stage: string; decidedAt: string | null; approverUserId: string | null }>;
  issues?: Array<{ id: string; code: string; title: string; status: string; severity: string | null; dueDate: string | null }>;
  answers: Array<{ id: string; fieldId: string | null; fieldCode?: string | null; fieldLabel: string; fieldType?: string | null; value: string | null }>;
  answersCount: number;
  evidenceCount?: number;
  signaturesCount?: number;
  approvalsCount?: number;
  openIssues?: number;
}

interface FormExecution {
  id: string;
  code: string;
  title: string;
  status: ExecutionStatus;
  progress: number;
  dueDate: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  assignedToId: string | null;
  templateId: string;
  template: { id: string; number: number; code: string | null; title: string; type: string; status: string };
  templateVersion: { id: string; versionNumber: number; versionLabel: string; status: string } | null;
  responseItems: Array<{ id: string; fieldId: string | null; fieldCode: string | null; fieldLabel: string; valueText: string | null }>;
  issues?: Array<{ id: string; code: string; title: string; status: string }>;
  responsesCount: number;
  submissionsCount: number;
  recordsCount: number;
  openIssues: number;
}

interface FormsSummary {
  total: number;
  active: number;
  draft: number;
  archived: number;
  fields: number;
  submissions: number;
  versions?: number;
  executions?: number;
  issues?: number;
  withoutFields: number;
}

interface FormsDashboard extends FormsSummary {
  pendingApprovals: number;
  openIssues: number;
  overdueExecutions: number;
  records: number;
  recentRecords: Array<{ id: string; code: string; title: string; status: string; recordDate: string }>;
  recentExecutions: FormExecution[];
}

interface FormsOptions {
  orgNodes: Array<{ id: string; name: string; type: string }>;
  indicators: Array<{ id: string; name: string; code: string | null; ownerNodeId: string }>;
  processes: Array<{ id: string; number: number; code: string | null; name: string; orgNodeId: string | null; indicatorId: string | null }>;
  users: Array<{ id: string; name: string; email: string; defaultNodeId: string | null }>;
  typeConfigs: Array<{ id: string; name: string; code: string; category: string; color: string | null; icon: string | null }>;
  categories: Array<{ id: string; name: string; color: string | null; icon: string | null }>;
  folders: Array<{ id: string; name: string; path: string | null }>;
  tags: Array<{ id: string; name: string; color: string | null }>;
  reusableBlocks: Array<{ id: string; name: string; blockType: string; description: string | null }>;
  types: string[];
  statuses: string[];
  fieldTypes: string[];
  submissionStatuses: string[];
  executionStatuses: string[];
  approvalDecisions: string[];
}

interface BuilderPayload {
  template: FormTemplate;
  rules: Array<{ id: string; name: string; event: string; active: boolean }>;
  formulas: Array<{ id: string; name: string; code: string; expression: string; active: boolean }>;
  workflows: Array<{ id: string; name: string; mode: string; active: boolean }>;
  printLayouts: Array<{ id: string; name: string; isDefault: boolean; active: boolean }>;
  schedules: Array<{ id: string; name: string; status: string; frequency: string; nextRunAt: string | null }>;
  externalLinks: Array<{ id: string; name: string; status: string; validUntil: string | null; uses: number }>;
  qrCodes: Array<{ id: string; code: string; label: string | null; active: boolean }>;
  aiSuggestions: Array<{ id: string; title: string; content: string; status: string }>;
}

interface FieldForm {
  order: string;
  code: string;
  label: string;
  type: FieldType;
  required: boolean;
  evidenceRequired: boolean;
  commentRequired: boolean;
  criticality: string;
  options: string;
  helpText: string;
}

interface TemplateForm {
  title: string;
  code: string;
  description: string;
  purpose: string;
  instructions: string;
  type: TemplateType;
  status: TemplateStatus;
  version: string;
  typeConfigId: string;
  categoryId: string;
  folderId: string;
  confidentiality: string;
  estimatedMinutes: string;
  retentionDays: string;
  tags: string;
  orgNodeId: string;
  processId: string;
  indicatorId: string;
  ownerUserId: string;
  fields: FieldForm[];
}

const TYPE_LABEL: Record<string, string> = {
  FORM: 'Formulario',
  CHECKLIST: 'Checklist',
  OPERATIONAL_RECORD: 'Registro operacional',
  INSPECTION: 'Inspecao',
  AUDIT_CHECKLIST: 'Checklist de auditoria',
  PROCESS_CHECKLIST: 'Checklist de processo',
  DAILY_RECORD: 'Registro diario',
  SHIFT_LOG: 'Passagem de turno',
  OCCURRENCE: 'Ocorrencia',
  ROUND: 'Ronda',
  MAINTENANCE: 'Manutencao',
  SAFETY: 'Seguranca',
  QUALITY: 'Qualidade',
  ENVIRONMENT: 'Meio ambiente',
  HR: 'RH',
  SURVEY: 'Pesquisa',
  SUPPLIER: 'Fornecedor',
  PROJECT: 'Projeto',
  EXTERNAL: 'Externo',
  PUBLIC: 'Publico',
  OTHER: 'Outro',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  IN_DEVELOPMENT: 'Em desenvolvimento',
  WAITING_REVIEW: 'Aguardando revisao',
  IN_REVIEW: 'Em revisao',
  ADJUSTMENTS_REQUESTED: 'Ajustes solicitados',
  WAITING_APPROVAL: 'Aguardando aprovacao',
  APPROVED: 'Aprovado',
  PUBLISHED: 'Publicado',
  ACTIVE: 'Ativo',
  SUSPENDED: 'Suspenso',
  OBSOLETE: 'Obsoleto',
  ARCHIVED: 'Arquivado',
};

const FIELD_LABEL: Record<string, string> = {
  TEXT: 'Texto curto',
  RICH_TEXT: 'Texto rico',
  TEXTAREA: 'Texto longo',
  NUMBER: 'Numero',
  INTEGER: 'Inteiro',
  DECIMAL: 'Decimal',
  CURRENCY: 'Moeda',
  PERCENT: 'Percentual',
  DATE: 'Data',
  TIME: 'Hora',
  DATETIME: 'Data e hora',
  BOOLEAN: 'Sim/Nao',
  YES_NO: 'Sim/Nao',
  CONFORMITY: 'Conformidade',
  SELECT: 'Selecao',
  MULTISELECT: 'Multipla selecao',
  RADIO: 'Radio',
  CHECKBOX: 'Checkbox',
  PHOTO: 'Foto',
  ATTACHMENT: 'Anexo',
  SIGNATURE: 'Assinatura',
  LOCATION: 'Localizacao',
  FORMULA: 'Formula',
  CALCULATED: 'Calculado',
};

const SUBMISSION_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  ASSIGNED: 'Atribuido',
  IN_PROGRESS: 'Em preenchimento',
  SUBMITTED: 'Enviado',
  WAITING_CORRECTION: 'Aguardando correcao',
  WAITING_APPROVAL: 'Aguardando aprovacao',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  REVIEWED: 'Revisado',
  CLOSED: 'Fechado',
  CANCELLED: 'Cancelado',
};

const EXECUTION_LABEL: Record<string, string> = {
  PLANNED: 'Planejada',
  ASSIGNED: 'Atribuida',
  IN_PROGRESS: 'Em execucao',
  WAITING_APPROVAL: 'Aguardando aprovacao',
  COMPLETED: 'Concluida',
  CLOSED: 'Fechada',
  CANCELLED: 'Cancelada',
  OVERDUE: 'Atrasada',
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'border-border text-muted-foreground',
  IN_DEVELOPMENT: 'border-border text-muted-foreground',
  WAITING_REVIEW: 'border-amber-300 text-amber-700',
  IN_REVIEW: 'border-blue-300 text-blue-700',
  WAITING_APPROVAL: 'border-amber-300 text-amber-700',
  APPROVED: 'border-emerald-300 text-emerald-700',
  PUBLISHED: 'border-emerald-300 text-emerald-700',
  ACTIVE: 'border-emerald-300 text-emerald-700',
  SUSPENDED: 'border-orange-300 text-orange-700',
  OBSOLETE: 'border-muted text-muted-foreground line-through',
  ARCHIVED: 'border-muted text-muted-foreground line-through',
};

const FIELD_TYPES = ['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'BOOLEAN', 'CONFORMITY', 'SELECT', 'MULTISELECT', 'PHOTO', 'ATTACHMENT', 'SIGNATURE', 'LOCATION'];

const EMPTY_FIELD: FieldForm = {
  order: '1',
  code: '',
  label: '',
  type: 'TEXT',
  required: false,
  evidenceRequired: false,
  commentRequired: false,
  criticality: '',
  options: '',
  helpText: '',
};

const EMPTY_TEMPLATE: TemplateForm = {
  title: '',
  code: '',
  description: '',
  purpose: '',
  instructions: '',
  type: 'CHECKLIST',
  status: 'DRAFT',
  version: '1.0',
  typeConfigId: '',
  categoryId: '',
  folderId: '',
  confidentiality: 'INTERNAL',
  estimatedMinutes: '',
  retentionDays: '',
  tags: '',
  orgNodeId: '',
  processId: '',
  indicatorId: '',
  ownerUserId: '',
  fields: [{ ...EMPTY_FIELD }],
};

export default function FormsPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['forms:create']);
  const canUpdate = hasPermission(['forms:update']);
  const canDelete = hasPermission(['forms:delete']);
  const canBuilder = hasPermission(['forms:builder']);
  const canPublish = hasPermission(['forms:publish']);
  const canExecute = hasPermission(['forms:execute']);
  const canEvidence = hasPermission(['forms:evidence']);
  const canApprove = hasPermission(['forms:approve']);
  const canIssues = hasPermission(['forms:issues']);
  const canAi = hasPermission(['forms:ai']);
  const [tab, setTab] = useState('dashboard');
  const [filters, setFilters] = useState({ search: '', status: '', type: '' });
  const [executionFilters, setExecutionFilters] = useState({ search: '', status: '' });
  const [templateOpen, setTemplateOpen] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [responseOpen, setResponseOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [editing, setEditing] = useState<FormTemplate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<FormExecution | null>(null);
  const [form, setForm] = useState<TemplateForm>(cloneTemplateForm());
  const [submissionTitle, setSubmissionTitle] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [executionForm, setExecutionForm] = useState({ title: '', assignedToId: '', dueDate: '', offlineEnabled: false });
  const [executionAnswers, setExecutionAnswers] = useState<Record<string, string>>({});
  const [evidenceForm, setEvidenceForm] = useState({ fileName: '', fileUrl: '', description: '', type: 'ATTACHMENT' });
  const [approvalForm, setApprovalForm] = useState({ decision: 'APPROVED', comment: '' });
  const [issueForm, setIssueForm] = useState({ title: '', description: '', severity: 'MEDIUM', responsibleUserId: '', dueDate: '' });

  const listQuery = useQuery<FormTemplate[]>({ queryKey: ['forms', filters], queryFn: () => api<FormTemplate[]>(`/forms${toQueryString(filters)}`) });
  const dashboardQuery = useQuery<FormsDashboard>({ queryKey: ['forms', 'dashboard'], queryFn: () => api<FormsDashboard>('/forms/dashboard') });
  const optionsQuery = useQuery<FormsOptions>({ queryKey: ['forms', 'options'], queryFn: () => api<FormsOptions>('/forms/options'), staleTime: 60_000 });
  const executionsQuery = useQuery<FormExecution[]>({ queryKey: ['forms', 'executions', executionFilters], queryFn: () => api<FormExecution[]>(`/forms/executions${toQueryString(executionFilters)}`) });

  const templates = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const dashboard = dashboardQuery.data;
  const options = optionsQuery.data;
  const selected = useMemo(() => templates.find((item) => item.id === selectedId) ?? null, [templates, selectedId]);
  const builderQuery = useQuery<BuilderPayload>({
    queryKey: ['forms', selectedId, 'builder'],
    queryFn: () => api<BuilderPayload>(`/forms/${selectedId}/builder`),
    enabled: Boolean(selectedId && canBuilder),
  });
  const submissionsQuery = useQuery<FormSubmission[]>({
    queryKey: ['forms', selectedId, 'submissions'],
    queryFn: () => api<FormSubmission[]>(`/forms/${selectedId}/submissions`),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus || !templates.length) return;
    const found = templates.find((item) => item.id === focus);
    if (found) setSelectedId(found.id);
  }, [templates, searchParams]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['forms'] });

  const saveTemplate = useMutation({
    mutationFn: () => {
      const payload = templatePayload(form);
      return editing ? api<FormTemplate>(`/forms/${editing.id}`, { method: 'PATCH', json: payload }) : api<FormTemplate>('/forms', { method: 'POST', json: payload });
    },
    onSuccess: (saved) => {
      toast.success(editing ? 'Formulario atualizado' : 'Formulario criado');
      setTemplateOpen(false);
      setEditing(null);
      setSelectedId(saved.id);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => api(`/forms/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Formulario removido');
      setSelectedId(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const publishTemplate = useMutation({
    mutationFn: (id: string) => api<FormTemplate>(`/forms/${id}/publish`, { method: 'POST', json: { changeReason: 'Publicacao pela tela de formularios' } }),
    onSuccess: () => {
      toast.success('Formulario publicado');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const duplicateTemplate = useMutation({
    mutationFn: (id: string) => api<FormTemplate>(`/forms/${id}/duplicate`, { method: 'POST', json: {} }),
    onSuccess: (created) => {
      toast.success('Copia criada');
      setSelectedId(created.id);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createVersion = useMutation({
    mutationFn: (id: string) => api(`/forms/${id}/versions`, { method: 'POST', json: { changeReason: 'Versao criada pelo construtor' } }),
    onSuccess: () => {
      toast.success('Versao criada');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submitForm = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Formulario nao selecionado');
      return api<FormSubmission>(`/forms/${selected.id}/submissions`, {
        method: 'POST',
        json: {
          title: submissionTitle || null,
          notes: submissionNotes || null,
          status: 'SUBMITTED',
          answers: selected.fields.map((field) => ({ fieldId: field.id, value: answers[field.id] ?? '' })),
        },
      });
    },
    onSuccess: () => {
      toast.success('Preenchimento registrado');
      setSubmissionOpen(false);
      setSubmissionTitle('');
      setSubmissionNotes('');
      setAnswers({});
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createExecution = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Formulario nao selecionado');
      return api<FormExecution>('/forms/executions', {
        method: 'POST',
        json: {
          templateId: selected.id,
          title: executionForm.title || null,
          assignedToId: executionForm.assignedToId || null,
          dueDate: executionForm.dueDate || null,
          offlineEnabled: executionForm.offlineEnabled,
        },
      });
    },
    onSuccess: () => {
      toast.success('Execucao criada');
      setExecutionOpen(false);
      setExecutionForm({ title: '', assignedToId: '', dueDate: '', offlineEnabled: false });
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveResponses = useMutation({
    mutationFn: () => {
      if (!selectedExecution) throw new Error('Execucao nao selecionada');
      const template = templates.find((item) => item.id === selectedExecution.templateId);
      if (!template) throw new Error('Template da execucao nao carregado');
      return api<FormExecution>(`/forms/executions/${selectedExecution.id}/responses`, {
        method: 'POST',
        json: {
          responses: template.fields.map((field) => ({ fieldId: field.id, fieldCode: field.code, fieldLabel: field.label, value: executionAnswers[field.id] ?? '' })),
        },
      });
    },
    onSuccess: () => {
      toast.success('Respostas salvas');
      setResponseOpen(false);
      setExecutionAnswers({});
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const completeExecution = useMutation({
    mutationFn: (id: string) => api<FormExecution>(`/forms/executions/${id}/complete`, { method: 'POST', json: {} }),
    onSuccess: () => {
      toast.success('Execucao concluida');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addEvidence = useMutation({
    mutationFn: () => {
      if (!selectedSubmission) throw new Error('Preenchimento nao selecionado');
      return api(`/forms/submissions/${selectedSubmission.id}/evidence`, { method: 'POST', json: evidenceForm });
    },
    onSuccess: () => {
      toast.success('Evidencia adicionada');
      setEvidenceOpen(false);
      setEvidenceForm({ fileName: '', fileUrl: '', description: '', type: 'ATTACHMENT' });
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const signSubmission = useMutation({
    mutationFn: (submission: FormSubmission) => api(`/forms/submissions/${submission.id}/signatures`, { method: 'POST', json: { method: 'ELECTRONIC' } }),
    onSuccess: () => {
      toast.success('Assinatura registrada');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approveSubmission = useMutation({
    mutationFn: () => {
      if (!selectedSubmission) throw new Error('Preenchimento nao selecionado');
      return api(`/forms/submissions/${selectedSubmission.id}/approvals`, { method: 'POST', json: approvalForm });
    },
    onSuccess: () => {
      toast.success('Aprovacao registrada');
      setApprovalOpen(false);
      setApprovalForm({ decision: 'APPROVED', comment: '' });
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createIssue = useMutation({
    mutationFn: () => {
      if (!selectedSubmission) throw new Error('Preenchimento nao selecionado');
      return api(`/forms/submissions/${selectedSubmission.id}/issues`, { method: 'POST', json: issueForm });
    },
    onSuccess: () => {
      toast.success('Pendencia criada');
      setIssueOpen(false);
      setIssueForm({ title: '', description: '', severity: 'MEDIUM', responsibleUserId: '', dueDate: '' });
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createAiSuggestions = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Formulario nao selecionado');
      return api('/forms/ai/suggestions', { method: 'POST', json: { templateId: selected.id } });
    },
    onSuccess: () => {
      toast.success('Sugestoes geradas');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openCreate() {
    setEditing(null);
    setForm(cloneTemplateForm());
    setTemplateOpen(true);
  }

  function openEdit(item: FormTemplate) {
    setEditing(item);
    setSelectedId(item.id);
    setForm({
      title: item.title,
      code: item.code ?? '',
      description: item.description ?? '',
      purpose: item.purpose ?? '',
      instructions: item.instructions ?? '',
      type: item.type,
      status: item.status,
      version: item.version ?? '1.0',
      typeConfigId: item.typeConfigId ?? '',
      categoryId: item.categoryId ?? '',
      folderId: item.folderId ?? '',
      confidentiality: item.confidentiality ?? 'INTERNAL',
      estimatedMinutes: item.estimatedMinutes ? String(item.estimatedMinutes) : '',
      retentionDays: item.retentionDays ? String(item.retentionDays) : '',
      tags: (item.tags ?? []).join(', '),
      orgNodeId: item.orgNodeId ?? '',
      processId: item.processId ?? '',
      indicatorId: item.indicatorId ?? '',
      ownerUserId: item.ownerUserId ?? '',
      fields: item.fields.length
        ? item.fields.map((field) => ({
            order: String(field.order),
            code: field.code ?? '',
            label: field.label,
            type: field.type,
            required: field.required,
            evidenceRequired: Boolean(field.evidenceRequired),
            commentRequired: Boolean(field.commentRequired),
            criticality: field.criticality ?? '',
            options: field.options ?? '',
            helpText: field.helpText ?? '',
          }))
        : [{ ...EMPTY_FIELD }],
    });
    setTemplateOpen(true);
  }

  function openSubmission(item: FormTemplate) {
    setSelectedId(item.id);
    setSubmissionTitle('');
    setSubmissionNotes('');
    setAnswers(Object.fromEntries(item.fields.map((field) => [field.id, ''])));
    setSubmissionOpen(true);
  }

  function openExecution(item: FormTemplate) {
    setSelectedId(item.id);
    setExecutionForm({ title: item.title, assignedToId: item.ownerUserId ?? '', dueDate: '', offlineEnabled: false });
    setExecutionOpen(true);
  }

  function openExecutionResponse(execution: FormExecution) {
    setSelectedExecution(execution);
    const template = templates.find((item) => item.id === execution.templateId);
    setExecutionAnswers(Object.fromEntries((template?.fields ?? []).map((field) => [field.id, ''])));
    setResponseOpen(true);
  }

  function updateField(index: number, patch: Partial<FieldForm>) {
    setForm((current) => ({ ...current, fields: current.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)) }));
  }

  function addField() {
    setForm((current) => ({ ...current, fields: [...current.fields, { ...EMPTY_FIELD, order: String(current.fields.length + 1) }] }));
  }

  function removeField(index: number) {
    setForm((current) => ({ ...current, fields: current.fields.filter((_, i) => i !== index).map((field, i) => ({ ...field, order: String(i + 1) })) }));
  }

  const selectedSubmissions = submissionsQuery.data ?? [];
  const selectedBuilder = builderQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Formularios e Checklists"
        description="Templates versionados, execucoes, evidencias, aprovacoes e registros operacionais digitais."
        actions={
          <div className="flex flex-wrap gap-2">
            {selected && canExecute ? <Button variant="outline" onClick={() => openExecution(selected)} disabled={!isExecutable(selected)}><Play className="mr-2 h-4 w-4" /> Execucao</Button> : null}
            {canCreate ? <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Novo template</Button> : null}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Painel</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="builder">Construtor</TabsTrigger>
          <TabsTrigger value="executions">Execucoes</TabsTrigger>
          <TabsTrigger value="records">Registros</TabsTrigger>
          <TabsTrigger value="settings">Configuracoes</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard title="Templates" value={formatNumber(dashboard?.total)} description={`${formatNumber(dashboard?.active)} ativos/publicados`} icon={<LayoutTemplate className="h-4 w-4" />} tone="blue" />
            <MetricCard title="Execucoes" value={formatNumber(dashboard?.executions)} description={`${formatNumber(dashboard?.overdueExecutions)} atrasadas`} icon={<ListChecks className="h-4 w-4" />} tone="yellow" />
            <MetricCard title="Registros" value={formatNumber(dashboard?.records)} description={`${formatNumber(dashboard?.submissions)} preenchimentos`} icon={<FileCheck className="h-4 w-4" />} tone="green" />
            <MetricCard title="Pendencias" value={formatNumber(dashboard?.openIssues)} description={`${formatNumber(dashboard?.pendingApprovals)} aprovacoes pendentes`} icon={<ShieldCheck className="h-4 w-4" />} tone="red" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Card><CardContent className="space-y-3 p-4">
              <SectionTitle icon={<Play className="h-4 w-4" />} title="Execucoes recentes" />
              {(dashboard?.recentExecutions ?? []).map((execution) => <ExecutionRow key={execution.id} execution={execution} onResponses={canExecute ? openExecutionResponse : undefined} onComplete={canExecute ? (id) => completeExecution.mutate(id) : undefined} />)}
              {!dashboard?.recentExecutions?.length ? <EmptyText>Sem execucoes recentes.</EmptyText> : null}
            </CardContent></Card>
            <Card><CardContent className="space-y-3 p-4">
              <SectionTitle icon={<Archive className="h-4 w-4" />} title="Registros recentes" />
              {(dashboard?.recentRecords ?? []).map((record) => (
                <div key={record.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{record.code}</span>
                    <Badge variant="outline">{record.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{record.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(record.recordDate)}</p>
                </div>
              ))}
              {!dashboard?.recentRecords?.length ? <EmptyText>Sem registros recentes.</EmptyText> : null}
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Filters filters={filters} setFilters={setFilters} options={options} />
          <div className="grid gap-4">
            {listQuery.isLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando formularios...</CardContent></Card> : null}
            {!listQuery.isLoading && templates.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum formulario encontrado.</CardContent></Card> : null}
            {templates.map((item) => (
              <TemplateCard
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onSelect={() => setSelectedId(selectedId === item.id ? null : item.id)}
                onSubmit={canExecute ? openSubmission : undefined}
                onExecution={canExecute ? openExecution : undefined}
                onEdit={canUpdate ? openEdit : undefined}
                onPublish={canPublish ? (id) => publishTemplate.mutate(id) : undefined}
                onDuplicate={canCreate ? (id) => duplicateTemplate.mutate(id) : undefined}
                onDelete={canDelete ? (id) => deleteTemplate.mutate(id) : undefined}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="builder" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[260px_1fr_340px]">
            <Card><CardContent className="space-y-3 p-4">
              <SectionTitle icon={<LayoutTemplate className="h-4 w-4" />} title="Componentes" />
              {FIELD_TYPES.map((type) => (
                <div key={type} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{label(FIELD_LABEL, type)}</span>
                  <Badge variant="outline">{type}</Badge>
                </div>
              ))}
            </CardContent></Card>
            <Card><CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionTitle icon={<Edit className="h-4 w-4" />} title={selected ? selected.title : 'Selecione um template'} />
                <div className="flex flex-wrap gap-2">
                  {selected && canUpdate ? <Button size="sm" variant="outline" onClick={() => openEdit(selected)}><Edit className="mr-2 h-4 w-4" /> Editar estrutura</Button> : null}
                  {selected && canBuilder ? <Button size="sm" variant="outline" onClick={() => createVersion.mutate(selected.id)}><History className="mr-2 h-4 w-4" /> Nova versao</Button> : null}
                  {selected && canAi ? <Button size="sm" variant="outline" onClick={() => createAiSuggestions.mutate()}><Sparkles className="mr-2 h-4 w-4" /> Sugestoes</Button> : null}
                </div>
              </div>
              {!selected ? <EmptyText>Escolha um template na aba Templates para visualizar o construtor.</EmptyText> : null}
              {selected?.sections?.length ? selected.sections.map((section) => (
                <div key={section.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{section.title}</span>
                    {section.repeatable ? <Badge variant="outline">Repetivel</Badge> : null}
                  </div>
                  {selected.fields.filter((field) => !field.sectionId || field.sectionId === section.id).map((field) => <FieldPreview key={field.id} field={field} />)}
                </div>
              )) : selected?.fields.map((field) => <FieldPreview key={field.id} field={field} />)}
            </CardContent></Card>
            <Card><CardContent className="space-y-4 p-4">
              <SectionTitle icon={<ShieldCheck className="h-4 w-4" />} title="Governanca" />
              <MiniList title="Versoes" items={(selectedBuilder?.template.versions ?? selected?.versions ?? []).map((v) => `${v.versionLabel} - ${label(STATUS_LABEL, v.status)}`)} empty="Sem versoes." />
              <MiniList title="Regras" items={(selectedBuilder?.rules ?? []).map((r) => `${r.name} - ${r.event}`)} empty="Sem regras configuradas." />
              <MiniList title="Formulas" items={(selectedBuilder?.formulas ?? []).map((f) => `${f.code}: ${f.expression}`)} empty="Sem formulas configuradas." />
              <MiniList title="QR e externo" items={[...(selectedBuilder?.qrCodes ?? []).map((q) => `QR ${q.code}`), ...(selectedBuilder?.externalLinks ?? []).map((l) => `${l.name} - ${l.status}`)]} empty="Sem acesso externo." />
              <MiniList title="IA" items={(selectedBuilder?.aiSuggestions ?? []).map((s) => s.title)} empty="Sem sugestoes." />
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="executions" className="space-y-4">
          <Card><CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
            <Field label="Buscar"><Input value={executionFilters.search} onChange={(e) => setExecutionFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Codigo, titulo ou template" /></Field>
            <Field label="Status">
              <NativeSelect value={executionFilters.status} onChange={(e) => setExecutionFilters((f) => ({ ...f, status: e.target.value }))}>
                <option value="">Todos</option>
                {(options?.executionStatuses ?? []).map((status) => <option key={status} value={status}>{label(EXECUTION_LABEL, status)}</option>)}
              </NativeSelect>
            </Field>
            <Button variant="outline" onClick={() => setExecutionFilters({ search: '', status: '' })}><X className="mr-2 h-4 w-4" /> Limpar</Button>
          </CardContent></Card>
          <div className="grid gap-3">
            {(executionsQuery.data ?? []).map((execution) => <ExecutionRow key={execution.id} execution={execution} onResponses={canExecute ? openExecutionResponse : undefined} onComplete={canExecute ? (id) => completeExecution.mutate(id) : undefined} />)}
            {!executionsQuery.isLoading && !(executionsQuery.data ?? []).length ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhuma execucao encontrada.</CardContent></Card> : null}
          </div>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <Card><CardContent className="space-y-3 p-4">
            <SectionTitle icon={<FileCheck className="h-4 w-4" />} title={selected ? `Registros de ${selected.title}` : 'Registros operacionais'} />
            {!selected ? <EmptyText>Selecione um template para ver preenchimentos, registros, evidencias e pendencias.</EmptyText> : null}
            {selectedSubmissions.map((submission) => (
              <SubmissionRecord
                key={submission.id}
                submission={submission}
                onEvidence={canEvidence ? (item) => { setSelectedSubmission(item); setEvidenceOpen(true); } : undefined}
                onSign={canExecute ? (item) => signSubmission.mutate(item) : undefined}
                onApprove={canApprove ? (item) => { setSelectedSubmission(item); setApprovalOpen(true); } : undefined}
                onIssue={canIssues ? (item) => { setSelectedSubmission(item); setIssueOpen(true); } : undefined}
              />
            ))}
            {selected && !submissionsQuery.isLoading && !selectedSubmissions.length ? <EmptyText>Nenhum preenchimento registrado.</EmptyText> : null}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <CatalogPanel icon={<FileSpreadsheet className="h-4 w-4" />} title="Tipos" items={(options?.typeConfigs ?? []).map((item) => `${item.name} (${label(TYPE_LABEL, item.category)})`)} />
            <CatalogPanel icon={<FolderTree className="h-4 w-4" />} title="Categorias" items={(options?.categories ?? []).map((item) => item.name)} />
            <CatalogPanel icon={<FolderTree className="h-4 w-4" />} title="Pastas" items={(options?.folders ?? []).map((item) => item.name)} />
            <CatalogPanel icon={<Tags className="h-4 w-4" />} title="Tags" items={(options?.tags ?? []).map((item) => item.name)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <CatalogPanel icon={<LayoutTemplate className="h-4 w-4" />} title="Blocos reutilizaveis" items={(options?.reusableBlocks ?? []).map((item) => `${item.name} - ${item.blockType}`)} />
            <CatalogPanel icon={<QrCode className="h-4 w-4" />} title="QR/externo" items={(selectedBuilder?.qrCodes ?? []).map((item) => item.code)} />
            <CatalogPanel icon={<Bot className="h-4 w-4" />} title="Assistente" items={(selectedBuilder?.aiSuggestions ?? []).map((item) => item.title)} />
          </div>
        </TabsContent>
      </Tabs>

      <TemplateDialog
        open={templateOpen}
        setOpen={setTemplateOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        options={options}
        updateField={updateField}
        addField={addField}
        removeField={removeField}
        save={() => saveTemplate.mutate()}
        saving={saveTemplate.isPending}
      />

      <SubmissionDialog open={submissionOpen} setOpen={setSubmissionOpen} selected={selected} title={submissionTitle} setTitle={setSubmissionTitle} notes={submissionNotes} setNotes={setSubmissionNotes} answers={answers} setAnswers={setAnswers} submit={() => submitForm.mutate()} saving={submitForm.isPending} />

      <ExecutionDialog open={executionOpen} setOpen={setExecutionOpen} selected={selected} options={options} form={executionForm} setForm={setExecutionForm} save={() => createExecution.mutate()} saving={createExecution.isPending} />

      <ExecutionResponseDialog open={responseOpen} setOpen={setResponseOpen} execution={selectedExecution} template={selectedExecution ? templates.find((item) => item.id === selectedExecution.templateId) ?? null : null} answers={executionAnswers} setAnswers={setExecutionAnswers} save={() => saveResponses.mutate()} saving={saveResponses.isPending} />

      <Dialog open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Adicionar evidencia</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <Field label="Nome do arquivo"><Input value={evidenceForm.fileName} onChange={(e) => setEvidenceForm({ ...evidenceForm, fileName: e.target.value })} /></Field>
            <Field label="URL ou chave"><Input value={evidenceForm.fileUrl} onChange={(e) => setEvidenceForm({ ...evidenceForm, fileUrl: e.target.value })} /></Field>
            <Field label="Tipo"><Input value={evidenceForm.type} onChange={(e) => setEvidenceForm({ ...evidenceForm, type: e.target.value })} /></Field>
            <Field label="Descricao"><Textarea value={evidenceForm.description} onChange={(e) => setEvidenceForm({ ...evidenceForm, description: e.target.value })} rows={3} /></Field>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEvidenceOpen(false)}>Cancelar</Button><Button onClick={() => addEvidence.mutate()} disabled={addEvidence.isPending || (!evidenceForm.fileName && !evidenceForm.fileUrl)}><Paperclip className="mr-2 h-4 w-4" /> Anexar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Aprovar registro</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <Field label="Decisao">
              <NativeSelect value={approvalForm.decision} onChange={(e) => setApprovalForm({ ...approvalForm, decision: e.target.value })}>
                {(options?.approvalDecisions ?? ['APPROVED', 'REJECTED', 'ADJUSTMENTS_REQUESTED']).map((decision) => <option key={decision} value={decision}>{decision}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Comentario"><Textarea value={approvalForm.comment} onChange={(e) => setApprovalForm({ ...approvalForm, comment: e.target.value })} rows={3} /></Field>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setApprovalOpen(false)}>Cancelar</Button><Button onClick={() => approveSubmission.mutate()} disabled={approveSubmission.isPending}><ShieldCheck className="mr-2 h-4 w-4" /> Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Criar pendencia</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <Field label="Titulo"><Input value={issueForm.title} onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })} /></Field>
            <Field label="Responsavel">
              <NativeSelect value={issueForm.responsibleUserId} onChange={(e) => setIssueForm({ ...issueForm, responsibleUserId: e.target.value })}>
                <option value="">Sem responsavel</option>
                {options?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </NativeSelect>
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Severidade"><Input value={issueForm.severity} onChange={(e) => setIssueForm({ ...issueForm, severity: e.target.value })} /></Field>
              <Field label="Prazo"><Input type="date" value={issueForm.dueDate} onChange={(e) => setIssueForm({ ...issueForm, dueDate: e.target.value })} /></Field>
            </div>
            <Field label="Descricao"><Textarea value={issueForm.description} onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })} rows={3} /></Field>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIssueOpen(false)}>Cancelar</Button><Button onClick={() => createIssue.mutate()} disabled={createIssue.isPending || !issueForm.title.trim()}><ListChecks className="mr-2 h-4 w-4" /> Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Filters({ filters, setFilters, options }: { filters: Record<string, string>; setFilters: (fn: any) => void; options?: FormsOptions }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
        <Field label="Buscar"><Input value={filters.search} onChange={(e) => setFilters((f: any) => ({ ...f, search: e.target.value }))} placeholder="Titulo, codigo, descricao, campo ou tag" /></Field>
        <Field label="Status">
          <NativeSelect value={filters.status} onChange={(e) => setFilters((f: any) => ({ ...f, status: e.target.value }))}>
            <option value="">Todos</option>
            {(options?.statuses ?? Object.keys(STATUS_LABEL)).map((status) => <option key={status} value={status}>{label(STATUS_LABEL, status)}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Tipo">
          <NativeSelect value={filters.type} onChange={(e) => setFilters((f: any) => ({ ...f, type: e.target.value }))}>
            <option value="">Todos</option>
            {(options?.types ?? Object.keys(TYPE_LABEL)).map((type) => <option key={type} value={type}>{label(TYPE_LABEL, type)}</option>)}
          </NativeSelect>
        </Field>
        <Button variant="outline" onClick={() => setFilters({ search: '', status: '', type: '' })}><X className="mr-2 h-4 w-4" /> Limpar</Button>
      </CardContent>
    </Card>
  );
}

function TemplateCard({ item, selected, onSelect, onSubmit, onExecution, onEdit, onPublish, onDuplicate, onDelete }: {
  item: FormTemplate;
  selected: boolean;
  onSelect: () => void;
  onSubmit?: (item: FormTemplate) => void;
  onExecution?: (item: FormTemplate) => void;
  onEdit?: (item: FormTemplate) => void;
  onPublish?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <Card className={cn('transition-colors', selected && 'border-primary/70 bg-primary/5')}>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <button type="button" className="min-w-0 text-left" onClick={onSelect}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">#{item.number} {item.code ? `${item.code} - ` : ''}{item.title}</span>
              <Badge variant="outline" className={STATUS_CLASS[item.status] ?? 'border-border'}>{label(STATUS_LABEL, item.status)}</Badge>
              <Badge variant="secondary">{label(TYPE_LABEL, item.type)}</Badge>
              {item.version ? <Badge variant="outline">v{item.version}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.description || item.purpose || 'Sem descricao.'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.orgNode?.name ?? item.process?.name ?? 'Formulario geral'}{item.indicator ? ` | Indicador: ${item.indicator.code ? `${item.indicator.code} - ` : ''}${item.indicator.name}` : ''}{item.owner ? ` | Dono: ${item.owner.name}` : ''}
            </p>
          </button>
          <div className="flex flex-wrap gap-2">
            {onSubmit ? <Button size="sm" variant="outline" onClick={() => onSubmit(item)} disabled={!isExecutable(item) || item.fields.length === 0}><Send className="mr-2 h-4 w-4" /> Preencher</Button> : null}
            {onExecution ? <Button size="sm" variant="outline" onClick={() => onExecution(item)} disabled={!isExecutable(item)}><Play className="mr-2 h-4 w-4" /> Execucao</Button> : null}
            {onPublish ? <Button size="sm" variant="outline" onClick={() => onPublish(item.id)} disabled={item.fields.length === 0 || item.status === 'PUBLISHED'}><CheckCircle2 className="mr-2 h-4 w-4" /> Publicar</Button> : null}
            {onDuplicate ? <Button size="sm" variant="outline" onClick={() => onDuplicate(item.id)}><Copy className="mr-2 h-4 w-4" /> Copiar</Button> : null}
            {onEdit ? <Button size="sm" variant="outline" onClick={() => onEdit(item)}><Edit className="mr-2 h-4 w-4" /> Editar</Button> : null}
            {onDelete ? <Button size="sm" variant="outline" className="text-status-red" onClick={() => onDelete(item.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</Button> : null}
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-5">
          <MiniStat label="Campos" value={item.fieldsCount} />
          <MiniStat label="Obrigatorios" value={item.requiredFieldsCount ?? item.fields.filter((field) => field.required).length} />
          <MiniStat label="Versoes" value={item.versionsCount ?? item.versions?.length ?? 0} />
          <MiniStat label="Execucoes" value={item.executionsCount ?? 0} />
          <MiniStat label="Registros" value={item.submissionsCount} />
        </div>
        {selected ? (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-2 rounded-md border bg-background/60 p-3">
              <SectionTitle icon={<ClipboardCheck className="h-4 w-4" />} title="Campos" />
              {item.fields.map((field) => <FieldPreview key={field.id} field={field} />)}
              {!item.fields.length ? <EmptyText>Nenhum campo configurado.</EmptyText> : null}
            </div>
            <div className="space-y-2 rounded-md border bg-background/60 p-3">
              <SectionTitle icon={<History className="h-4 w-4" />} title="Versoes e metadados" />
              <MetaLine label="Tipo" value={item.typeConfig?.name ?? label(TYPE_LABEL, item.type)} />
              <MetaLine label="Categoria" value={item.category?.name ?? '-'} />
              <MetaLine label="Pasta" value={item.folder?.name ?? '-'} />
              <MetaLine label="Confidencialidade" value={item.confidentiality ?? 'INTERNAL'} />
              <MetaLine label="Tempo estimado" value={item.estimatedMinutes ? `${item.estimatedMinutes} min` : '-'} />
              <MiniList title="Tags" items={item.tags ?? []} empty="Sem tags." />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ExecutionRow({ execution, onResponses, onComplete }: { execution: FormExecution; onResponses?: (execution: FormExecution) => void; onComplete?: (id: string) => void }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{execution.code} - {execution.title}</span>
              <Badge variant="outline">{label(EXECUTION_LABEL, execution.status)}</Badge>
              {execution.templateVersion ? <Badge variant="secondary">v{execution.templateVersion.versionLabel}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{execution.template.title} | Prazo: {formatDate(execution.dueDate)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onResponses ? <Button size="sm" variant="outline" onClick={() => onResponses(execution)}><Save className="mr-2 h-4 w-4" /> Respostas</Button> : null}
            {onComplete ? <Button size="sm" variant="outline" onClick={() => onComplete(execution.id)} disabled={execution.status === 'COMPLETED' || execution.status === 'CLOSED'}><CheckCircle2 className="mr-2 h-4 w-4" /> Concluir</Button> : null}
          </div>
        </div>
        <Progress value={execution.progress ?? 0} />
        <div className="grid gap-2 md:grid-cols-4">
          <MiniStat label="Respostas" value={execution.responsesCount ?? execution.responseItems?.length ?? 0} />
          <MiniStat label="Registros" value={execution.recordsCount ?? 0} />
          <MiniStat label="Submissoes" value={execution.submissionsCount ?? 0} />
          <MiniStat label="Pendencias" value={execution.openIssues ?? 0} />
        </div>
      </CardContent>
    </Card>
  );
}

function SubmissionRecord({ submission, onEvidence, onSign, onApprove, onIssue }: {
  submission: FormSubmission;
  onEvidence?: (submission: FormSubmission) => void;
  onSign?: (submission: FormSubmission) => void;
  onApprove?: (submission: FormSubmission) => void;
  onIssue?: (submission: FormSubmission) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{submission.code ? `${submission.code} - ` : ''}{submission.title || 'Preenchimento'}</span>
            <Badge variant="outline">{label(SUBMISSION_LABEL, submission.status)}</Badge>
            {submission.templateVersion ? <Badge variant="secondary">v{submission.templateVersion.versionLabel}</Badge> : null}
            {submission.operationalRecord ? <Badge variant="outline">{submission.operationalRecord.code}</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{submission.submittedBy?.name ?? 'Usuario'} | {formatDate(submission.submittedAt ?? submission.completedAt ?? submission.reviewedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onEvidence ? <Button size="sm" variant="outline" onClick={() => onEvidence(submission)}><Paperclip className="mr-2 h-4 w-4" /> Evidencia</Button> : null}
          {onSign ? <Button size="sm" variant="outline" onClick={() => onSign(submission)}><PenLine className="mr-2 h-4 w-4" /> Assinar</Button> : null}
          {onApprove ? <Button size="sm" variant="outline" onClick={() => onApprove(submission)}><ShieldCheck className="mr-2 h-4 w-4" /> Aprovar</Button> : null}
          {onIssue ? <Button size="sm" variant="outline" onClick={() => onIssue(submission)}><ListChecks className="mr-2 h-4 w-4" /> Pendencia</Button> : null}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-5">
        <MiniStat label="Respostas" value={submission.answersCount} />
        <MiniStat label="Evidencias" value={submission.evidenceCount ?? submission.evidence?.length ?? 0} />
        <MiniStat label="Assinaturas" value={submission.signaturesCount ?? submission.signatures?.length ?? 0} />
        <MiniStat label="Aprovacoes" value={submission.approvalsCount ?? submission.approvals?.length ?? 0} />
        <MiniStat label="Pendencias" value={submission.openIssues ?? submission.issues?.length ?? 0} />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {submission.answers.slice(0, 6).map((answer) => <MetaLine key={answer.id} label={answer.fieldLabel} value={answer.value ?? '-'} />)}
      </div>
    </div>
  );
}

function TemplateDialog({ open, setOpen, editing, form, setForm, options, updateField, addField, removeField, save, saving }: {
  open: boolean;
  setOpen: (open: boolean) => void;
  editing: FormTemplate | null;
  form: TemplateForm;
  setForm: (form: TemplateForm) => void;
  options?: FormsOptions;
  updateField: (index: number, patch: Partial<FieldForm>) => void;
  addField: () => void;
  removeField: (index: number) => void;
  save: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Editar formulario' : 'Novo formulario'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_170px]">
            <Field label="Titulo"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Codigo"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="Versao"><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></Field>
            <Field label="Confidencialidade"><Input value={form.confidentiality} onChange={(e) => setForm({ ...form, confidentiality: e.target.value })} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Tipo"><NativeSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{(options?.types ?? Object.keys(TYPE_LABEL)).map((value) => <option key={value} value={value}>{label(TYPE_LABEL, value)}</option>)}</NativeSelect></Field>
            <Field label="Status"><NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{(options?.statuses ?? Object.keys(STATUS_LABEL)).map((value) => <option key={value} value={value}>{label(STATUS_LABEL, value)}</option>)}</NativeSelect></Field>
            <Field label="Tipo configurado"><NativeSelect value={form.typeConfigId} onChange={(e) => setForm({ ...form, typeConfigId: e.target.value })}><option value="">Automatico</option>{options?.typeConfigs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect></Field>
            <Field label="Categoria"><NativeSelect value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Sem categoria</option>{options?.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Pasta"><NativeSelect value={form.folderId} onChange={(e) => setForm({ ...form, folderId: e.target.value })}><option value="">Sem pasta</option>{options?.folders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect></Field>
            <Field label="Area"><NativeSelect value={form.orgNodeId} onChange={(e) => setForm({ ...form, orgNodeId: e.target.value })}><option value="">Geral</option>{options?.orgNodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</NativeSelect></Field>
            <Field label="Dono"><NativeSelect value={form.ownerUserId} onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}><option value="">Sem dono</option>{options?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</NativeSelect></Field>
            <Field label="Tempo min."><Input type="number" min={0} value={form.estimatedMinutes} onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Processo"><NativeSelect value={form.processId} onChange={(e) => setForm({ ...form, processId: e.target.value })}><option value="">Sem processo</option>{options?.processes.map((process) => <option key={process.id} value={process.id}>#{process.number} {process.code ? `${process.code} - ` : ''}{process.name}</option>)}</NativeSelect></Field>
            <Field label="Indicador"><NativeSelect value={form.indicatorId} onChange={(e) => setForm({ ...form, indicatorId: e.target.value })}><option value="">Sem indicador</option>{options?.indicators.map((indicator) => <option key={indicator.id} value={indicator.id}>{indicator.code ? `${indicator.code} - ` : ''}{indicator.name}</option>)}</NativeSelect></Field>
          </div>
          <Field label="Descricao"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Finalidade"><Textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} rows={2} /></Field>
            <Field label="Instrucoes"><Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={2} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Tags"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Critico, recorrente, externo" /></Field>
            <Field label="Retencao dias"><Input type="number" min={0} value={form.retentionDays} onChange={(e) => setForm({ ...form, retentionDays: e.target.value })} /></Field>
          </div>
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <SectionTitle icon={<ClipboardCheck className="h-4 w-4" />} title="Campos" />
              <Button type="button" variant="outline" size="sm" onClick={addField}><Plus className="mr-2 h-4 w-4" /> Campo</Button>
            </div>
            {form.fields.map((field, index) => (
              <div key={`${index}-${field.order}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-[70px_100px_1fr_170px_150px_40px]">
                <Field label="Ordem"><Input type="number" min={1} value={field.order} onChange={(e) => updateField(index, { order: e.target.value })} /></Field>
                <Field label="Codigo"><Input value={field.code} onChange={(e) => updateField(index, { code: e.target.value })} /></Field>
                <Field label="Rotulo"><Input value={field.label} onChange={(e) => updateField(index, { label: e.target.value })} /></Field>
                <Field label="Tipo"><NativeSelect value={field.type} onChange={(e) => updateField(index, { type: e.target.value })}>{(options?.fieldTypes ?? FIELD_TYPES).map((value) => <option key={value} value={value}>{label(FIELD_LABEL, value)}</option>)}</NativeSelect></Field>
                <Field label="Criticidade"><Input value={field.criticality} onChange={(e) => updateField(index, { criticality: e.target.value })} /></Field>
                <Button type="button" variant="outline" size="sm" className="mt-6 text-status-red" onClick={() => removeField(index)} disabled={form.fields.length === 1}><Trash2 className="h-4 w-4" /></Button>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} /> Obrigatorio</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.evidenceRequired} onChange={(e) => updateField(index, { evidenceRequired: e.target.checked })} /> Evidencia</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.commentRequired} onChange={(e) => updateField(index, { commentRequired: e.target.checked })} /> Comentario</label>
                <div className="md:col-span-2"><Field label="Opcoes"><Textarea value={field.options} onChange={(e) => updateField(index, { options: e.target.value })} rows={2} /></Field></div>
                <div className="md:col-span-3"><Field label="Ajuda"><Input value={field.helpText} onChange={(e) => updateField(index, { helpText: e.target.value })} /></Field></div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={!form.title.trim() || saving}><Save className="mr-2 h-4 w-4" /> Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubmissionDialog({ open, setOpen, selected, title, setTitle, notes, setNotes, answers, setAnswers, submit, saving }: {
  open: boolean;
  setOpen: (open: boolean) => void;
  selected: FormTemplate | null;
  title: string;
  setTitle: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  answers: Record<string, string>;
  setAnswers: (fn: any) => void;
  submit: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Preencher {selected?.title}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label="Titulo do preenchimento"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          {selected?.fields.map((field) => (
            <Field key={field.id} label={`${field.order}. ${field.label}${field.required ? ' *' : ''}`}>
              <AnswerInput field={field} value={answers[field.id] ?? ''} onChange={(value) => setAnswers((current: Record<string, string>) => ({ ...current, [field.id]: value }))} />
            </Field>
          ))}
          <Field label="Observacoes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={submit} disabled={saving}><Send className="mr-2 h-4 w-4" /> Registrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExecutionDialog({ open, setOpen, selected, options, form, setForm, save, saving }: {
  open: boolean;
  setOpen: (open: boolean) => void;
  selected: FormTemplate | null;
  options?: FormsOptions;
  form: { title: string; assignedToId: string; dueDate: string; offlineEnabled: boolean };
  setForm: (form: { title: string; assignedToId: string; dueDate: string; offlineEnabled: boolean }) => void;
  save: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Criar execucao</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <p className="text-sm text-muted-foreground">{selected?.title}</p>
          <Field label="Titulo"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Responsavel"><NativeSelect value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}><option value="">Sem responsavel</option>{options?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</NativeSelect></Field>
          <Field label="Prazo"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.offlineEnabled} onChange={(e) => setForm({ ...form, offlineEnabled: e.target.checked })} /> Permitir offline</label>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saving || !selected}><Play className="mr-2 h-4 w-4" /> Criar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExecutionResponseDialog({ open, setOpen, execution, template, answers, setAnswers, save, saving }: {
  open: boolean;
  setOpen: (open: boolean) => void;
  execution: FormExecution | null;
  template: FormTemplate | null;
  answers: Record<string, string>;
  setAnswers: (fn: any) => void;
  save: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Respostas da execucao {execution?.code}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          {!template ? <EmptyText>Template da execucao nao esta carregado na lista atual.</EmptyText> : null}
          {template?.fields.map((field) => (
            <Field key={field.id} label={`${field.order}. ${field.label}${field.required ? ' *' : ''}`}>
              <AnswerInput field={field} value={answers[field.id] ?? ''} onChange={(value) => setAnswers((current: Record<string, string>) => ({ ...current, [field.id]: value }))} />
            </Field>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saving || !template}><Save className="mr-2 h-4 w-4" /> Salvar respostas</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid min-w-0 flex-1 gap-2"><Label>{label}</Label>{children}</div>;
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return <div className="flex items-center gap-2 text-sm font-semibold">{icon}<span>{title}</span></div>;
}

function MiniStat({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="rounded-md border bg-background/60 p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{formatNumber(value)}</p>
    </div>
  );
}

function FieldPreview({ field }: { field: FormField }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{field.order}. {field.label}</span>
        <Badge variant="secondary">{label(FIELD_LABEL, field.type)}</Badge>
        {field.code ? <Badge variant="outline">{field.code}</Badge> : null}
        {field.required ? <Badge variant="outline" className="border-red-300 text-red-700">Obrigatorio</Badge> : null}
        {field.evidenceRequired ? <Badge variant="outline" className="border-amber-300 text-amber-700">Evidencia</Badge> : null}
      </div>
      {field.helpText ? <p className="mt-1 text-sm text-muted-foreground">{field.helpText}</p> : null}
      {field.options ? <p className="mt-1 text-xs text-muted-foreground">Opcoes: {splitOptions(field.options).join(', ')}</p> : null}
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function MiniList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase text-muted-foreground">{title}</p>
      {items.length ? items.slice(0, 6).map((item) => <div key={item} className="rounded-md border px-3 py-2 text-sm">{item}</div>) : <EmptyText>{empty}</EmptyText>}
    </div>
  );
}

function CatalogPanel({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <SectionTitle icon={icon} title={title} />
        {items.length ? items.slice(0, 10).map((item) => <div key={item} className="rounded-md border px-3 py-2 text-sm">{item}</div>) : <EmptyText>Nenhum item.</EmptyText>}
      </CardContent>
    </Card>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{children}</p>;
}

function AnswerInput({ field, value, onChange }: { field: FormField; value: string; onChange: (value: string) => void }) {
  const options = field.optionsV2?.length ? field.optionsV2.map((item) => item.label) : splitOptions(field.options);
  if (['TEXTAREA', 'RICH_TEXT'].includes(field.type)) return <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={field.helpText ?? undefined} />;
  if (['NUMBER', 'INTEGER', 'DECIMAL', 'CURRENCY', 'PERCENT', 'SCORE', 'TEMPERATURE'].includes(field.type)) return <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.helpText ?? undefined} />;
  if (field.type === 'DATE') return <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
  if (field.type === 'TIME') return <Input type="time" value={value} onChange={(e) => onChange(e.target.value)} />;
  if (field.type === 'DATETIME') return <Input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} />;
  if (['BOOLEAN', 'YES_NO'].includes(field.type)) return <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}><option value="">Selecione</option><option value="Sim">Sim</option><option value="Nao">Nao</option></NativeSelect>;
  if (field.type === 'CONFORMITY') return <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}><option value="">Selecione</option><option value="Conforme">Conforme</option><option value="Nao conforme">Nao conforme</option><option value="Nao aplicavel">Nao aplicavel</option></NativeSelect>;
  if (['SELECT', 'RADIO', 'STATUS'].includes(field.type) && options.length) return <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}><option value="">Selecione</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</NativeSelect>;
  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={['MULTISELECT', 'CHECKBOX'].includes(field.type) ? 'Separe valores por virgula' : field.helpText ?? undefined} />;
}

function templatePayload(form: TemplateForm) {
  return {
    title: form.title,
    code: form.code || null,
    description: form.description || null,
    purpose: form.purpose || null,
    instructions: form.instructions || null,
    type: form.type,
    status: form.status,
    version: form.version || null,
    typeConfigId: form.typeConfigId || null,
    categoryId: form.categoryId || null,
    folderId: form.folderId || null,
    confidentiality: form.confidentiality || 'INTERNAL',
    estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
    retentionDays: form.retentionDays ? Number(form.retentionDays) : null,
    tags: splitOptions(form.tags),
    orgNodeId: form.orgNodeId || null,
    processId: form.processId || null,
    indicatorId: form.indicatorId || null,
    ownerUserId: form.ownerUserId || null,
    fields: form.fields.filter((field) => field.label.trim()).map((field, index) => ({
      order: field.order ? Number(field.order) : index + 1,
      code: field.code || null,
      label: field.label,
      type: field.type,
      required: field.required,
      evidenceRequired: field.evidenceRequired,
      commentRequired: field.commentRequired,
      criticality: field.criticality || null,
      options: field.options || null,
      helpText: field.helpText || null,
    })),
  };
}

function cloneTemplateForm(): TemplateForm {
  return { ...EMPTY_TEMPLATE, fields: [{ ...EMPTY_FIELD }] };
}

function isExecutable(item: FormTemplate) {
  return ['ACTIVE', 'PUBLISHED', 'APPROVED'].includes(item.status);
}

function label(map: Record<string, string>, value: string | null | undefined) {
  if (!value) return '-';
  return map[value] ?? value;
}

function splitOptions(value: string | null | undefined) {
  return (value ?? '').split(/\r?\n|,|;/).map((item) => item.trim()).filter(Boolean);
}

function toQueryString(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
