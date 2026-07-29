'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Archive,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Copy,
  Edit,
  FileCheck,
  FileDown,
  FileSpreadsheet,
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
import { HeaderBuilder } from '@/components/forms/header-builder';
import { PhotoCapture, type CapturedPhoto } from '@/components/forms/photo-capture';
import { ExecutePicker } from '@/components/forms/execute-picker';
import { ParticipantsField, ParticipantsFooter, type Participant } from '@/components/forms/participants-field';
import type { ExecuteSelection } from '@/lib/forms/execute';
import {
  type HeaderFieldForm,
  headerFieldFilter,
  headerFieldsFromTemplate,
  headerFieldsPayload,
  headerSectionPayload,
} from '@/lib/forms/header';
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
import { api, getAccessToken } from '@/lib/api';
import { QrPrintDialog } from '@/components/qr/qr-print-dialog';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import {
  type ExportableRecord,
  type RecordEvidence,
  type RecordParticipant,
  exportRecordListXlsx,
  exportRecordPdf,
  exportRecordXlsx,
} from './record-export';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

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
  /** Guarda a numeração fixada pelo autor em `displayNumber`. */
  metadata?: { displayNumber?: string } | null;
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
  settings?: Record<string, unknown> | null;
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
  createdAt?: string | null;
  submittedAt: string | null;
  completedAt?: string | null;
  reviewedAt: string | null;
  score?: number | null;
  classification?: string | null;
  /** Modelo de origem, para a lista de registros mostrar o nome do checklist. */
  template?: { id: string; title: string; type?: string; version?: string | null } | null;
  orgNode?: { id: string; name: string; type?: string } | null;
  /** [{ registrationId, name, jobTitle, managerName }] vindo do cadastro funcional. */
  participants?: unknown;
  templateVersion?: { id: string; versionNumber: number; versionLabel: string; status: string } | null;
  execution?: { id: string; code: string; title: string; status: string; dueDate: string | null } | null;
  operationalRecord?: { id: string; code: string; title: string; status: string; recordDate: string } | null;
  submittedBy: { id: string; name: string; email: string } | null;
  evidence?: unknown[];
  signatures?: unknown[];
  approvals?: Array<{ id: string; decision: string; stage: string; decidedAt: string | null; approverUserId: string | null }>;
  issues?: Array<{ id: string; code: string; title: string; status: string; severity: string | null; dueDate: string | null }>;
  answers: Array<{ id: string; fieldId: string | null; fieldCode?: string | null; fieldLabel: string; fieldType?: string | null; value: string | null; weight?: number | null; score?: number | null }>;
  /** Pontos obtidos e em disputa, recalculados das respostas pelo backend. */
  points?: number;
  pointsTotal?: number;
  /** O modelo usa nota por pergunta? Sem isso, a tela nem fala de pontos. */
  usesWeights?: boolean;
  scoreSummary?: string;
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
  orgNodes: Array<{ id: string; name: string; type: string; parentId: string | null }>;
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
  /** Numeração fixada pelo autor; vazio = usa a posição na lista. */
  displayNumber: string;
  code: string;
  label: string;
  type: FieldType;
  required: boolean;
  evidenceRequired: boolean;
  commentRequired: boolean;
  criticality: string;
  /** Nota da pergunta: quanto ela vale no resultado. Vazio = 1 (peso normal). */
  weight: string;
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
  /** Campos do cabeçalho (seção HEADER), exibidos antes das perguntas. */
  headerFields: HeaderFieldForm[];
  /** Gatilho: reprovação em campo de conformidade (ou sim/não crítico) gera NC automática. */
  autoNonconformity: boolean;
  /** Demais chaves de template.settings preservadas no round-trip. */
  settingsRaw: Record<string, unknown>;
}

const TYPE_LABEL: Record<string, string> = {
  FORM: 'Formulário',
  CHECKLIST: 'Lista de verificação',
  OPERATIONAL_RECORD: 'Registro operacional',
  INSPECTION: 'Inspecao',
  AUDIT_CHECKLIST: 'Lista de verificação de auditoria',
  PROCESS_CHECKLIST: 'Lista de verificação de processo',
  DAILY_RECORD: 'Registro diario',
  SHIFT_LOG: 'Passagem de turno',
  OCCURRENCE: 'Ocorrência',
  ROUND: 'Ronda',
  MAINTENANCE: 'Manutenção',
  SAFETY: 'Seguranca',
  QUALITY: 'Qualidade',
  ENVIRONMENT: 'Meio ambiente',
  HR: 'RH',
  SURVEY: 'Pesquisa',
  SUPPLIER: 'Fornecedor',
  PROJECT: 'Projeto',
  EXTERNAL: 'Externo',
  PUBLIC: 'Público',
  OTHER: 'Outro',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  IN_DEVELOPMENT: 'Em desenvolvimento',
  WAITING_REVIEW: 'Aguardando revisão',
  IN_REVIEW: 'Em revisão',
  ADJUSTMENTS_REQUESTED: 'Ajustes solicitados',
  WAITING_APPROVAL: 'Aguardando aprovação',
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
  NUMBER: 'Número',
  INTEGER: 'Inteiro',
  DECIMAL: 'Decimal',
  CURRENCY: 'Moeda',
  PERCENT: 'Percentual',
  DATE: 'Data',
  TIME: 'Hora',
  DATETIME: 'Data e hora',
  BOOLEAN: 'Sim/Não',
  YES_NO: 'Sim/Não',
  CONFORMITY: 'Conformidade',
  SELECT: 'Seleção',
  MULTISELECT: 'Múltipla seleção',
  RADIO: 'Radio',
  CHECKBOX: 'Checkbox',
  PHOTO: 'Foto',
  ATTACHMENT: 'Anexo',
  SIGNATURE: 'Assinatura',
  LOCATION: 'Localização',
  FORMULA: 'Formula',
  CALCULATED: 'Calculado',
};

const SUBMISSION_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  ASSIGNED: 'Atribuido',
  IN_PROGRESS: 'Em preenchimento',
  SUBMITTED: 'Enviado',
  WAITING_CORRECTION: 'Aguardando correção',
  WAITING_APPROVAL: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  REVIEWED: 'Revisado',
  CLOSED: 'Fechado',
  CANCELLED: 'Cancelado',
};

const EXECUTION_LABEL: Record<string, string> = {
  PLANNED: 'Planejada',
  ASSIGNED: 'Atribuida',
  IN_PROGRESS: 'Em execução',
  WAITING_APPROVAL: 'Aguardando aprovação',
  COMPLETED: 'Concluída',
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

/**
 * Tipos que valem nota. Espelha TIPOS_AVALIAVEIS de form-scoring.logic.ts no
 * backend: texto, foto e data são registro, não entram no percentual — então
 * oferecer "Nota" neles seria prometer um ponto que nunca é contado.
 */
const SCORABLE_TYPES = new Set(['CONFORMITY', 'YES_NO', 'BOOLEAN']);

const EMPTY_FIELD: FieldForm = {
  order: '1',
  displayNumber: '',
  code: '',
  label: '',
  type: 'TEXT',
  required: false,
  evidenceRequired: false,
  commentRequired: false,
  criticality: '',
  weight: '',
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
  headerFields: [],
  autoNonconformity: false,
  settingsRaw: {},
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
  // Preencher (campo, quase sempre no celular) é permissão própria: o técnico
  // recebe só `forms:fill` e não enxerga criar/editar/publicar/copiar.
  const canFill = hasPermission(['forms:fill', 'forms:update']);
  const canExecute = hasPermission(['forms:execute']);
  const canEvidence = hasPermission(['forms:evidence']);
  const canApprove = hasPermission(['forms:approve']);
  const canIssues = hasPermission(['forms:issues']);
  const canAi = hasPermission(['forms:ai']);
  const canDashboard = hasPermission(['forms:dashboard']);
  // Quem só preenche não gerencia modelo: a lista some de detalhes e de ações.
  const canManageTemplates = canCreate || canUpdate || canPublish || canDelete || canBuilder;
  // O técnico cai direto na lista de formulários: sem o painel, "Painel Geral"
  // seria uma tela vazia de KPIs que ele nem tem permissão de consultar.
  const [tab, setTab] = useState(canDashboard ? 'dashboard' : 'templates');
  const [filters, setFilters] = useState({ search: '', status: '', type: '' });
  const [executionFilters, setExecutionFilters] = useState({ search: '', status: '' });
  const [recordFilters, setRecordFilters] = useState({ search: '', templateId: '', from: '', to: '' });
  const [recordDetail, setRecordDetail] = useState<FormSubmission | null>(null);
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
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [execution, setExecution] = useState<ExecuteSelection>({ areaId: '', sectorId: '' });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [executionForm, setExecutionForm] = useState({ title: '', assignedToId: '', dueDate: '', offlineEnabled: false });
  const [executionAnswers, setExecutionAnswers] = useState<Record<string, string>>({});
  const [evidenceForm, setEvidenceForm] = useState({ fileName: '', fileUrl: '', description: '', type: 'ATTACHMENT' });
  const [approvalForm, setApprovalForm] = useState({ decision: 'APPROVED', comment: '' });
  const [issueForm, setIssueForm] = useState({ title: '', description: '', severity: 'MEDIUM', responsibleUserId: '', dueDate: '' });

  const listQuery = useQuery<FormTemplate[]>({ queryKey: ['forms', filters], queryFn: () => api<FormTemplate[]>(`/forms${toQueryString(filters)}`) });
  const dashboardQuery = useQuery<FormsDashboard>({ queryKey: ['forms', 'dashboard'], queryFn: () => api<FormsDashboard>('/forms/dashboard'), enabled: canDashboard });
  const optionsQuery = useQuery<FormsOptions>({ queryKey: ['forms', 'options'], queryFn: () => api<FormsOptions>('/forms/options'), staleTime: 60_000 });
  const executionsQuery = useQuery<FormExecution[]>({ queryKey: ['forms', 'executions', executionFilters], queryFn: () => api<FormExecution[]>(`/forms/executions${toQueryString(executionFilters)}`), enabled: canExecute });
  // Registros de TODOS os formulários: quem preenche precisa achar o que
  // acabou de gravar sem antes selecionar o modelo na aba Modelos.
  const recordsQuery = useQuery<FormSubmission[]>({
    queryKey: ['forms', 'records', recordFilters],
    queryFn: () => api<FormSubmission[]>(`/forms/submissions${toQueryString(recordFilters)}`),
  });

  const templates = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  // O técnico só vê o que dá para preencher — rascunho e obsoleto confundem.
  const visibleTemplates = useMemo(
    () => (canManageTemplates ? templates : templates.filter(isExecutable)),
    [templates, canManageTemplates],
  );
  const records = useMemo(() => recordsQuery.data ?? [], [recordsQuery.data]);
  const dashboard = dashboardQuery.data;
  const options = optionsQuery.data;
  const selected = useMemo(() => templates.find((item) => item.id === selectedId) ?? null, [templates, selectedId]);

  // QR Code do formulário: gera (ou reusa) o token e abre o diálogo de impressão.
  const [qrInfo, setQrInfo] = useState<{ token: string; title: string } | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const generateQr = useMutation({
    mutationFn: (templateId: string) => api<{ token: string; title: string }>(`/forms/${templateId}/qrcode`, { method: 'POST', json: {} }),
    onSuccess: (r) => { setQrInfo(r); setQrOpen(true); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao gerar QR Code'),
  });
  const builderQuery = useQuery<BuilderPayload>({
    queryKey: ['forms', selectedId, 'builder'],
    queryFn: () => api<BuilderPayload>(`/forms/${selectedId}/builder`),
    enabled: Boolean(selectedId && canBuilder),
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
      toast.success(editing ? 'Formulário atualizado' : 'Formulário criado');
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
      toast.success('Formulário removido');
      setSelectedId(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const publishTemplate = useMutation({
    mutationFn: (id: string) => api<FormTemplate>(`/forms/${id}/publish`, { method: 'POST', json: { changeReason: 'Publicação pela tela de formulários' } }),
    onSuccess: () => {
      toast.success('Formulário publicado');
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
    mutationFn: (id: string) => api(`/forms/${id}/versions`, { method: 'POST', json: { changeReason: 'Versão criada pelo construtor' } }),
    onSuccess: () => {
      toast.success('Versão criada');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submitForm = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Formulário não selecionado');
      const submission = await api<FormSubmission>(`/forms/${selected.id}/submissions`, {
        method: 'POST',
        json: {
          notes: submissionNotes || null,
          status: 'SUBMITTED',
          // O setor e o no mais especifico: e por ele que o indicador agrega.
          ...(execution.sectorId ? { orgNodeId: execution.sectorId } : {}),
          participants: participants.length ? participants : null,
          answers: selected.fields.map((field) => ({ fieldId: field.id, value: answers[field.id] ?? '' })),
        },
      });

      // Fotos vão depois: o registro precisa existir para a evidência apontar
      // para ele. Falha aqui não desfaz o preenchimento — o registro está
      // salvo, e a foto pode ser reenviada pela ficha.
      const enviadas = await Promise.allSettled(
        photos.map((photo) =>
          api(`/forms/submissions/${submission.id}/photo`, {
            method: 'POST',
            json: { contentBase64: photo.contentBase64, mimeType: photo.mimeType, fileName: photo.fileName },
          }),
        ),
      );
      const falhas = enviadas.filter((item) => item.status === 'rejected').length;
      return { submission, falhas };
    },
    onSuccess: ({ submission, falhas }) => {
      if (falhas > 0) toast.warning(`Registro salvo, mas ${falhas} foto(s) não subiram. Reenvie pela ficha.`);
      // Em checklist pontuado o resumo já vem em pontos ("70% — 70 de 100
      // pontos"), que é o número que o técnico confere na hora.
      else toast.success(submission.scoreSummary ? `Preenchimento registrado — ${submission.scoreSummary}` : 'Preenchimento registrado');
      setSubmissionOpen(false);
      setSubmissionNotes('');
      setAnswers({});
      setPhotos([]);
      setParticipants([]);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createExecution = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Formulário não selecionado');
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
      toast.success('Execução criada');
      setExecutionOpen(false);
      setExecutionForm({ title: '', assignedToId: '', dueDate: '', offlineEnabled: false });
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveResponses = useMutation({
    mutationFn: () => {
      if (!selectedExecution) throw new Error('Execução não selecionada');
      const template = templates.find((item) => item.id === selectedExecution.templateId);
      if (!template) throw new Error('Modelo da execução não carregado');
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
      toast.success('Execução concluída');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addEvidence = useMutation({
    mutationFn: () => {
      if (!selectedSubmission) throw new Error('Preenchimento não selecionado');
      return api(`/forms/submissions/${selectedSubmission.id}/evidence`, { method: 'POST', json: evidenceForm });
    },
    onSuccess: () => {
      toast.success('Evidência adicionada');
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
      if (!selectedSubmission) throw new Error('Preenchimento não selecionado');
      return api(`/forms/submissions/${selectedSubmission.id}/approvals`, { method: 'POST', json: approvalForm });
    },
    onSuccess: () => {
      toast.success('Aprovação registrada');
      setApprovalOpen(false);
      setApprovalForm({ decision: 'APPROVED', comment: '' });
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createIssue = useMutation({
    mutationFn: () => {
      if (!selectedSubmission) throw new Error('Preenchimento não selecionado');
      return api(`/forms/submissions/${selectedSubmission.id}/issues`, { method: 'POST', json: issueForm });
    },
    onSuccess: () => {
      toast.success('Pendência criada');
      setIssueOpen(false);
      setIssueForm({ title: '', description: '', severity: 'MEDIUM', responsibleUserId: '', dueDate: '' });
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createAiSuggestions = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Formulário não selecionado');
      return api('/forms/ai/suggestions', { method: 'POST', json: { templateId: selected.id } });
    },
    onSuccess: () => {
      toast.success('Sugestões geradas');
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
      autoNonconformity: Boolean((item.settings as { autoNonconformity?: { enabled?: boolean } } | null)?.autoNonconformity?.enabled),
      settingsRaw: (item.settings as Record<string, unknown> | null) ?? {},
      headerFields: headerFieldsFromTemplate(item.sections, item.fields),
      // Campos do cabeçalho saem da lista de perguntas: são editados no bloco
      // próprio, e apareceriam duplicados aqui.
      fields: item.fields.filter((field) => !isHeaderField(item.sections, field)).length
        ? item.fields.filter((field) => !isHeaderField(item.sections, field)).map((field) => ({
            order: String(field.order),
            displayNumber: String((field.metadata as { displayNumber?: unknown } | null)?.displayNumber ?? ''),
            code: field.code ?? '',
            label: field.label,
            type: field.type,
            required: field.required,
            evidenceRequired: Boolean(field.evidenceRequired),
            commentRequired: Boolean(field.commentRequired),
            criticality: field.criticality ?? '',
            weight: field.weight ? String(field.weight) : '',
            options: field.options ?? '',
            helpText: field.helpText ?? '',
          }))
        : [{ ...EMPTY_FIELD }],
    });
    setTemplateOpen(true);
  }

  function openSubmission(item: FormTemplate) {
    setSelectedId(item.id);
    setSubmissionNotes('');
    setPhotos([]);
    setExecution({ areaId: '', sectorId: '' });
    setParticipants([]);
    setAnswers(Object.fromEntries(item.fields.map((field) => [field.id, ''])));
    setSubmissionOpen(true);
  }

  // Aberto via QR (/scan -> /forms?fill=<templateId>): abre direto o preenchimento da inspeção.
  const fillHandledRef = useRef(false);
  useEffect(() => {
    const fillId = searchParams.get('fill');
    if (!fillId || fillHandledRef.current) return;
    const t = templates.find((x) => x.id === fillId);
    if (t) { fillHandledRef.current = true; openSubmission(t); }
  }, [searchParams, templates]);

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

  function moveField(index: number, direction: -1 | 1) {
    setForm((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.fields.length) return current;
      const fields = [...current.fields];
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...current, fields: fields.map((field, i) => ({ ...field, order: String(i + 1) })) };
    });
  }

  function duplicateField(index: number) {
    setForm((current) => {
      const fields = [...current.fields];
      fields.splice(index + 1, 0, { ...current.fields[index], code: '' });
      return { ...current, fields: fields.map((field, i) => ({ ...field, order: String(i + 1) })) };
    });
  }

  const selectedBuilder = builderQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Formulários e Checklists"
        description="Modelos de listas de verificação, auditorias operacionais, registros digitais e evidências de conformidade."
        actions={
          canCreate ? (
            <Button onClick={openCreate} size="sm" className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold"><Plus className="mr-1.5 h-4 w-4" /> Novo modelo</Button>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        {/* Abas de gestão só aparecem para quem gerencia: no celular do técnico
            a tela fica em Modelos e Registros, sem construtor nem catálogos. */}
        <TabsList className="bg-slate-100 dark:bg-slate-800">
          {canDashboard ? <TabsTrigger value="dashboard" className="text-xs font-semibold">Painel Geral</TabsTrigger> : null}
          <TabsTrigger value="templates" className="text-xs font-semibold">Modelos</TabsTrigger>
          {canBuilder ? <TabsTrigger value="builder" className="text-xs font-semibold">Construtor</TabsTrigger> : null}
          {canExecute ? <TabsTrigger value="executions" className="text-xs font-semibold">Execuções</TabsTrigger> : null}
          <TabsTrigger value="records" className="text-xs font-semibold">Registros</TabsTrigger>
          {canManageTemplates ? <TabsTrigger value="settings" className="text-xs font-semibold">Configurações</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          
          {/* KPIs de Checklists */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Modelos de Formulários" value={formatNumber(dashboard?.total)} change={`${formatNumber(dashboard?.active)} ativos no SGQ`} color="sky" icon={LayoutTemplate} />
            <KpiCard title="Execuções Programadas" value={formatNumber(dashboard?.executions)} change={`${formatNumber(dashboard?.overdueExecutions)} em atraso`} color="rose" icon={ListChecks} />
            <KpiCard title="Registros Realizados" value={formatNumber(dashboard?.records)} change={`${formatNumber(dashboard?.submissions)} checklists preenchidos`} color="emerald" icon={FileCheck} />
            <KpiCard title="Não Conformidades (RNC)" value={formatNumber(dashboard?.openIssues)} change={`${formatNumber(dashboard?.pendingApprovals)} revisões pendentes`} color="purple" icon={ShieldCheck} />
          </div>

          {/* Gráfico de Aderência e Desvios */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[340px]">
              <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-855 dark:text-white">
                  <Play className="h-4 w-4 text-sky-500" />
                  Execuções Pendentes e Recentes
                </h3>
              </div>
              <CardContent className="p-4 overflow-y-auto flex-1 space-y-3">
                {(dashboard?.recentExecutions ?? []).slice(0, 4).map((execution) => (
                  <ExecutionRow key={execution.id} execution={execution} onResponses={canExecute ? openExecutionResponse : undefined} onComplete={canExecute ? (id) => completeExecution.mutate(id) : undefined} />
                ))}
                {!dashboard?.recentExecutions?.length ? <EmptyText>Sem execuções recentes no momento.</EmptyText> : null}
              </CardContent>
            </Card>

            <Card className="border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col h-[340px]">
              <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-855 dark:text-white">
                  <Archive className="h-4 w-4 text-emerald-500" />
                  Registros Operacionais Recebidos
                </h3>
              </div>
              <CardContent className="p-4 overflow-y-auto flex-1 space-y-3">
                {(dashboard?.recentRecords ?? []).slice(0, 3).map((record) => (
                  <div key={record.id} className="rounded-xl border p-3 bg-slate-50/30 dark:bg-slate-900/30 flex flex-col gap-1 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-800 dark:text-slate-200">{record.code}</span>
                      <Badge variant="outline" className="text-[9px] scale-90">{record.status}</Badge>
                    </div>
                    <p className="text-slate-600 dark:text-slate-350">{record.title}</p>
                    <span className="text-[10px] text-slate-400 mt-1">{formatDate(record.recordDate)}</span>
                  </div>
                ))}
                {!dashboard?.recentRecords?.length ? <EmptyText>Sem registros recebidos.</EmptyText> : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Filters filters={filters} setFilters={setFilters} options={options} showStatus={canManageTemplates} />
          <div className="grid gap-2">
            {listQuery.isLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando formulários...</CardContent></Card> : null}
            {!listQuery.isLoading && visibleTemplates.length === 0 ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">
                {canManageTemplates ? 'Nenhum formulário encontrado.' : 'Nenhum formulário publicado para preenchimento.'}
              </CardContent></Card>
            ) : null}
            {visibleTemplates.map((item) => (
              <TemplateCard
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                showDetails={canManageTemplates}
                onSelect={() => setSelectedId(selectedId === item.id ? null : item.id)}
                onFill={canFill ? openSubmission : undefined}
                onSchedule={canExecute ? openExecution : undefined}
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
                <SectionTitle icon={<Edit className="h-4 w-4" />} title={selected ? selected.title : 'Selecione um modelo'} />
                <div className="flex flex-wrap gap-2">
                  {selected && canUpdate ? <Button size="sm" variant="outline" onClick={() => openEdit(selected)}><Edit className="mr-2 h-4 w-4" /> Editar estrutura</Button> : null}
                  {selected && canBuilder ? <Button size="sm" variant="outline" onClick={() => createVersion.mutate(selected.id)}><History className="mr-2 h-4 w-4" /> Nova versão</Button> : null}
                  {selected && canAi ? <Button size="sm" variant="outline" onClick={() => createAiSuggestions.mutate()}><Sparkles className="mr-2 h-4 w-4" /> Sugestões</Button> : null}
                </div>
              </div>
              {!selected ? <EmptyText>Escolha um modelo na aba Modelos para visualizar o construtor.</EmptyText> : null}
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
              <SectionTitle icon={<ShieldCheck className="h-4 w-4" />} title="Governança" />
              <MiniList title="Versões" items={(selectedBuilder?.template.versions ?? selected?.versions ?? []).map((v) => `${v.versionLabel} - ${label(STATUS_LABEL, v.status)}`)} empty="Sem versões." />
              <MiniList title="Regras" items={(selectedBuilder?.rules ?? []).map((r) => `${r.name} - ${r.event}`)} empty="Sem regras configuradas." />
              <MiniList title="Formulas" items={(selectedBuilder?.formulas ?? []).map((f) => `${f.code}: ${f.expression}`)} empty="Sem formulas configuradas." />
              {selected && canBuilder ? (
                <Button size="sm" variant="outline" className="w-full" onClick={() => generateQr.mutate(selected.id)} disabled={generateQr.isPending}>
                  <QrCode className="mr-2 h-4 w-4" />{generateQr.isPending ? 'Gerando…' : 'Gerar QR do formulário'}
                </Button>
              ) : null}
              <MiniList title="QR e externo" items={[...(selectedBuilder?.qrCodes ?? []).map((q) => `QR ${q.code}`), ...(selectedBuilder?.externalLinks ?? []).map((l) => `${l.name} - ${l.status}`)]} empty="Sem acesso externo." />
              <MiniList title="IA" items={(selectedBuilder?.aiSuggestions ?? []).map((s) => s.title)} empty="Sem sugestões." />
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="executions" className="space-y-4">
          <Card><CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
            <Field label="Buscar"><Input value={executionFilters.search} onChange={(e) => setExecutionFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Código, título ou modelo" /></Field>
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
            {!executionsQuery.isLoading && !(executionsQuery.data ?? []).length ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhuma execução encontrada.</CardContent></Card> : null}
          </div>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <Card><CardContent className="flex flex-col gap-3 p-4 md:flex-row md:flex-wrap md:items-end">
            <Field label="Buscar"><Input value={recordFilters.search} onChange={(e) => setRecordFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Código, formulário, setor ou quem preencheu" /></Field>
            <Field label="Formulário">
              <NativeSelect value={recordFilters.templateId} onChange={(e) => setRecordFilters((f) => ({ ...f, templateId: e.target.value }))}>
                <option value="">Todos</option>
                {visibleTemplates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </NativeSelect>
            </Field>
            <Field label="De"><Input type="date" value={recordFilters.from} onChange={(e) => setRecordFilters((f) => ({ ...f, from: e.target.value }))} /></Field>
            <Field label="Até"><Input type="date" value={recordFilters.to} onChange={(e) => setRecordFilters((f) => ({ ...f, to: e.target.value }))} /></Field>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRecordFilters({ search: '', templateId: '', from: '', to: '' })}><X className="mr-2 h-4 w-4" /> Limpar</Button>
              <Button variant="outline" onClick={() => downloadRecordList(records)} disabled={!records.length}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel da lista</Button>
            </div>
          </CardContent></Card>

          <div className="grid gap-2">
            {recordsQuery.isLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando registros...</CardContent></Card> : null}
            {!recordsQuery.isLoading && !records.length ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum formulário preenchido no filtro atual.</CardContent></Card>
            ) : null}
            {records.map((submission) => (
              <RecordRow key={submission.id} submission={submission} onOpen={() => setRecordDetail(submission)} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <CatalogPanel icon={<FileSpreadsheet className="h-4 w-4" />} title="Tipos" items={(options?.typeConfigs ?? []).map((item) => `${item.name} (${label(TYPE_LABEL, item.category)})`)} />
            <CatalogPanel icon={<FolderTree className="h-4 w-4" />} title="Categorias" items={(options?.categories ?? []).map((item) => item.name)} />
            <CatalogPanel icon={<FolderTree className="h-4 w-4" />} title="Pastas" items={(options?.folders ?? []).map((item) => item.name)} />
            <CatalogPanel icon={<Tags className="h-4 w-4" />} title="Tags" items={(options?.tags ?? []).map((item) => item.name)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <CatalogPanel icon={<LayoutTemplate className="h-4 w-4" />} title="Blocos reutilizáveis" items={(options?.reusableBlocks ?? []).map((item) => `${item.name} - ${item.blockType}`)} />
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
        moveField={moveField}
        duplicateField={duplicateField}
        save={() => saveTemplate.mutate()}
        saving={saveTemplate.isPending}
      />

      <SubmissionDialog open={submissionOpen} setOpen={setSubmissionOpen} selected={selected} options={optionsQuery.data} execution={execution} setExecution={setExecution} participants={participants} setParticipants={setParticipants} photos={photos} setPhotos={setPhotos} notes={submissionNotes} setNotes={setSubmissionNotes} answers={answers} setAnswers={setAnswers} submit={() => submitForm.mutate()} saving={submitForm.isPending} />

      <RecordDetailDialog
        submission={recordDetail}
        onClose={() => setRecordDetail(null)}
        onEvidence={canEvidence ? (item) => { setSelectedSubmission(item); setEvidenceOpen(true); } : undefined}
        onSign={canFill || canApprove ? (item) => signSubmission.mutate(item) : undefined}
        onApprove={canApprove ? (item) => { setSelectedSubmission(item); setApprovalOpen(true); } : undefined}
        onIssue={canIssues ? (item) => { setSelectedSubmission(item); setIssueOpen(true); } : undefined}
      />
      <QrPrintDialog open={qrOpen} onOpenChange={setQrOpen} type="form" token={qrInfo?.token ?? null} title={qrInfo?.title ?? 'Formulário'} subtitle="Escaneie para abrir e preencher a inspeção" />

      <ExecutionDialog open={executionOpen} setOpen={setExecutionOpen} selected={selected} options={options} form={executionForm} setForm={setExecutionForm} save={() => createExecution.mutate()} saving={createExecution.isPending} />

      <ExecutionResponseDialog open={responseOpen} setOpen={setResponseOpen} execution={selectedExecution} template={selectedExecution ? templates.find((item) => item.id === selectedExecution.templateId) ?? null : null} answers={executionAnswers} setAnswers={setExecutionAnswers} save={() => saveResponses.mutate()} saving={saveResponses.isPending} />

      <Dialog open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Adicionar evidência</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <Field label="Nome do arquivo"><Input value={evidenceForm.fileName} onChange={(e) => setEvidenceForm({ ...evidenceForm, fileName: e.target.value })} /></Field>
            <Field label="URL ou chave"><Input value={evidenceForm.fileUrl} onChange={(e) => setEvidenceForm({ ...evidenceForm, fileUrl: e.target.value })} /></Field>
            <Field label="Tipo"><Input value={evidenceForm.type} onChange={(e) => setEvidenceForm({ ...evidenceForm, type: e.target.value })} /></Field>
            <Field label="Descrição"><Textarea value={evidenceForm.description} onChange={(e) => setEvidenceForm({ ...evidenceForm, description: e.target.value })} rows={3} /></Field>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEvidenceOpen(false)}>Cancelar</Button><Button onClick={() => addEvidence.mutate()} disabled={addEvidence.isPending || (!evidenceForm.fileName && !evidenceForm.fileUrl)}><Paperclip className="mr-2 h-4 w-4" /> Anexar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Aprovar registro</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <Field label="Decisão">
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
          <DialogHeader><DialogTitle>Criar pendência</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <Field label="Título"><Input value={issueForm.title} onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })} /></Field>
            <Field label="Responsável">
              <NativeSelect value={issueForm.responsibleUserId} onChange={(e) => setIssueForm({ ...issueForm, responsibleUserId: e.target.value })}>
                <option value="">Sem responsável</option>
                {options?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </NativeSelect>
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Severidade"><Input value={issueForm.severity} onChange={(e) => setIssueForm({ ...issueForm, severity: e.target.value })} /></Field>
              <Field label="Prazo"><Input type="date" value={issueForm.dueDate} onChange={(e) => setIssueForm({ ...issueForm, dueDate: e.target.value })} /></Field>
            </div>
            <Field label="Descrição"><Textarea value={issueForm.description} onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })} rows={3} /></Field>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIssueOpen(false)}>Cancelar</Button><Button onClick={() => createIssue.mutate()} disabled={createIssue.isPending || !issueForm.title.trim()}><ListChecks className="mr-2 h-4 w-4" /> Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Filters({ filters, setFilters, options, showStatus }: { filters: Record<string, string>; setFilters: (fn: any) => void; options?: FormsOptions; showStatus: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
        <Field label="Buscar"><Input value={filters.search} onChange={(e) => setFilters((f: any) => ({ ...f, search: e.target.value }))} placeholder="Nome do formulário ou item" /></Field>
        {/* Status só interessa a quem gerencia o modelo: o técnico só enxerga
            formulário publicado, então o filtro seria sempre o mesmo. */}
        {showStatus ? (
          <Field label="Status">
            <NativeSelect value={filters.status} onChange={(e) => setFilters((f: any) => ({ ...f, status: e.target.value }))}>
              <option value="">Todos</option>
              {(options?.statuses ?? Object.keys(STATUS_LABEL)).map((status) => <option key={status} value={status}>{label(STATUS_LABEL, status)}</option>)}
            </NativeSelect>
          </Field>
        ) : null}
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

/**
 * Linha da lista de modelos.
 *
 * Só o nome do formulário: quem vai preencher precisa reconhecer o checklist,
 * não decorar código, versão, contadores e dono. Número, descrição, campos e
 * metadados ficam no detalhe, que abre ao tocar no nome — e só para quem
 * gerencia modelos. A ação principal (Preencher) é a única em destaque; editar,
 * publicar, copiar, programar e excluir viram ícones, porque são do analista.
 */
function TemplateCard({ item, selected, showDetails, onSelect, onFill, onSchedule, onEdit, onPublish, onDuplicate, onDelete }: {
  item: FormTemplate;
  selected: boolean;
  showDetails: boolean;
  onSelect: () => void;
  onFill?: (item: FormTemplate) => void;
  onSchedule?: (item: FormTemplate) => void;
  onEdit?: (item: FormTemplate) => void;
  onPublish?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const executavel = isExecutable(item);
  return (
    <Card className={cn('transition-colors', selected && showDetails && 'border-primary/70 bg-primary/5')}>
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
            onClick={onSelect}
            disabled={!showDetails}
          >
            <span className="truncate text-base font-semibold">{item.title}</span>
            {/* Publicado é o normal e não precisa de selo; o que interessa
                sinalizar é o que ainda não está pronto para preencher. */}
            {!executavel ? (
              <Badge variant="outline" className={cn('shrink-0', STATUS_CLASS[item.status] ?? 'border-border')}>{label(STATUS_LABEL, item.status)}</Badge>
            ) : null}
          </button>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {onFill ? (
              <Button
                size="sm"
                className="h-10 flex-1 bg-blue-600 font-semibold text-white hover:bg-blue-700 sm:h-9 sm:flex-none"
                onClick={() => onFill(item)}
                disabled={!executavel || item.fields.length === 0}
                title={executavel ? 'Preencher este formulário' : 'Publique o formulário para poder preencher'}
              >
                <PenLine className="mr-2 h-4 w-4" /> Preencher
              </Button>
            ) : null}
            {onSchedule ? <IconAction icon={Play} title="Programar execução (responsável e prazo)" onClick={() => onSchedule(item)} disabled={!executavel} /> : null}
            {onPublish ? <IconAction icon={CheckCircle2} title="Publicar" onClick={() => onPublish(item.id)} disabled={item.fields.length === 0 || item.status === 'PUBLISHED'} /> : null}
            {onEdit ? <IconAction icon={Edit} title="Editar" onClick={() => onEdit(item)} /> : null}
            {onDuplicate ? <IconAction icon={Copy} title="Copiar" onClick={() => onDuplicate(item.id)} /> : null}
            {onDelete ? <IconAction icon={Trash2} title="Excluir" danger onClick={() => onDelete(item.id)} /> : null}
          </div>
        </div>
        {selected && showDetails ? (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-2 rounded-md border bg-background/60 p-3">
              <SectionTitle icon={<ClipboardCheck className="h-4 w-4" />} title="Campos" />
              {item.fields.map((field) => <FieldPreview key={field.id} field={field} />)}
              {!item.fields.length ? <EmptyText>Nenhum campo configurado.</EmptyText> : null}
            </div>
            <div className="space-y-2 rounded-md border bg-background/60 p-3">
              <SectionTitle icon={<History className="h-4 w-4" />} title="Versões e metadados" />
              <div className="grid gap-2 sm:grid-cols-2">
                <MiniStat label="Campos" value={item.fieldsCount} />
                <MiniStat label="Registros" value={item.submissionsCount} />
              </div>
              <MetaLine label="Descrição" value={item.description || item.purpose || '-'} />
              <MetaLine label="Área" value={item.orgNode?.name ?? item.process?.name ?? 'Geral'} />
              <MetaLine label="Indicador" value={item.indicator ? `${item.indicator.code ? `${item.indicator.code} - ` : ''}${item.indicator.name}` : '-'} />
              <MetaLine label="Tipo" value={item.typeConfig?.name ?? label(TYPE_LABEL, item.type)} />
              <MetaLine label="Versão" value={item.version ? `rev ${item.version}` : '-'} />
              <MetaLine label="Dono" value={item.owner?.name ?? '-'} />
              <MiniList title="Tags" items={item.tags ?? []} empty="Sem tags." />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Ação secundária: ícone com tooltip, para não competir com "Preencher". */
function IconAction({ icon: Icon, title, onClick, disabled, danger }: { icon: typeof Edit; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Button
      size="icon"
      variant="outline"
      className={cn('h-9 w-9', danger && 'text-status-red')}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="h-4 w-4" />
    </Button>
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
          <MiniStat label="Pendências" value={execution.openIssues ?? 0} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Linha da aba Registros: o formulário preenchido como o usuário o procura —
 * pelo nome do checklist, pelo setor e pela data. Abrir mostra a ficha inteira;
 * PDF e Excel saem direto daqui, para conferência posterior.
 */
function RecordRow({ submission, onOpen }: { submission: FormSubmission; onOpen: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{submission.template?.title ?? submission.title ?? 'Preenchimento'}</span>
            <Badge variant="outline" className="shrink-0">{label(SUBMISSION_LABEL, submission.status)}</Badge>
            {typeof submission.score === 'number' ? (
              <Badge variant="outline" className={cn('shrink-0', submission.score >= 90 ? 'border-emerald-300 text-emerald-700' : submission.score >= 70 ? 'border-amber-300 text-amber-700' : 'border-red-300 text-red-700')}>
                {formatPercent(submission.score)}
                {submission.usesWeights ? ` · ${formatNumber(submission.points)}/${formatNumber(submission.pointsTotal)} pts` : ''}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {[submission.code, submission.orgNode?.name, submission.submittedBy?.name, formatDate(recordDate(submission))].filter(Boolean).join(' · ')}
          </p>
        </button>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-9" onClick={onOpen}><FileCheck className="mr-2 h-4 w-4" /> Ver</Button>
          <IconAction icon={FileDown} title="Baixar em PDF" onClick={() => downloadRecordPdf(submission)} />
          <IconAction icon={FileSpreadsheet} title="Baixar em Excel" onClick={() => downloadRecordXlsx(submission)} />
        </div>
      </CardContent>
    </Card>
  );
}

/** Ficha do preenchimento: o que foi respondido, por quem, com foto e anexos. */
function RecordDetailDialog({ submission, onClose, onEvidence, onSign, onApprove, onIssue }: {
  submission: FormSubmission | null;
  onClose: () => void;
  onEvidence?: (submission: FormSubmission) => void;
  onSign?: (submission: FormSubmission) => void;
  onApprove?: (submission: FormSubmission) => void;
  onIssue?: (submission: FormSubmission) => void;
}) {
  const participants = recordParticipants(submission);
  return (
    <Dialog open={Boolean(submission)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{submission?.template?.title ?? 'Formulário preenchido'}</DialogTitle></DialogHeader>
        {submission ? (
          <div className="space-y-4 py-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <MetaLine label="Registro" value={submission.code ?? '-'} />
              <MetaLine label="Área / Setor" value={submission.orgNode?.name ?? '-'} />
              <MetaLine label="Preenchido por" value={submission.submittedBy?.name ?? '-'} />
              <MetaLine label="Data" value={formatDate(recordDate(submission))} />
              <MetaLine label="Situação" value={label(SUBMISSION_LABEL, submission.status)} />
              <MetaLine
                label={submission.usesWeights ? 'Pontuação' : 'Conformidade'}
                value={submission.scoreSummary ?? (typeof submission.score === 'number' ? formatPercent(submission.score) : '-')}
              />
            </div>

            <div className="space-y-2">
              <SectionTitle icon={<ClipboardCheck className="h-4 w-4" />} title="Respostas" />
              {submission.answers.map((answer, index) => (
                <div key={answer.id} className="rounded-md border px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{index + 1}. {answer.fieldLabel}</p>
                    {/* Quanto o item valia e quanto ele rendeu — é o que
                        permite conferir o percentual item a item. Pergunta sem
                        nota é marcada como tal, e não como "0 pontos". */}
                    {submission.usesWeights ? (
                      typeof answer.score === 'number' ? (
                        <Badge variant="outline" className="shrink-0 text-[10px] font-semibold">
                          {formatNumber(answer.score)} / {formatNumber(fieldNote(answer))}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0 border-dashed text-[10px] text-muted-foreground">
                          {fieldNote(answer) === null ? 'Sem nota' : 'Fora da conta'}
                        </Badge>
                      )
                    ) : null}
                  </div>
                  <p className="mt-0.5 break-words text-sm font-medium">{answer.value || '—'}</p>
                </div>
              ))}
              {!submission.answers.length ? <EmptyText>Sem respostas registradas.</EmptyText> : null}
            </div>

            {participants.length ? (
              <div className="space-y-2">
                <SectionTitle icon={<ListChecks className="h-4 w-4" />} title="Participantes" />
                {participants.map((person, index) => (
                  <div key={`${person.registrationId ?? index}`} className="rounded-md border px-3 py-2 text-sm">
                    <span className="font-medium">{person.name ?? 'Participante'}</span>
                    <span className="text-muted-foreground">{[person.registrationId, person.jobTitle, person.managerName].filter(Boolean).length ? ` — ${[person.registrationId, person.jobTitle, person.managerName].filter(Boolean).join(' · ')}` : ''}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {submission.notes ? <MetaLine label="Observações" value={submission.notes} /> : null}

            <div className="space-y-2">
              <SectionTitle icon={<Paperclip className="h-4 w-4" />} title="Evidências e fotos" />
              {(submission.evidence ?? []).length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {(submission.evidence as RecordEvidence[]).map((item) => (
                    <EvidenceThumb key={item.id} evidence={item} />
                  ))}
                </div>
              ) : <EmptyText>Sem fotos ou anexos neste registro.</EmptyText>}
            </div>
          </div>
        ) : null}
        <DialogFooter className="flex-wrap gap-2">
          {submission && onEvidence ? <Button size="sm" variant="outline" onClick={() => onEvidence(submission)}><Paperclip className="mr-2 h-4 w-4" /> Evidência</Button> : null}
          {submission && onSign ? <Button size="sm" variant="outline" onClick={() => onSign(submission)}><PenLine className="mr-2 h-4 w-4" /> Assinar</Button> : null}
          {submission && onApprove ? <Button size="sm" variant="outline" onClick={() => onApprove(submission)}><ShieldCheck className="mr-2 h-4 w-4" /> Aprovar</Button> : null}
          {submission && onIssue ? <Button size="sm" variant="outline" onClick={() => onIssue(submission)}><ListChecks className="mr-2 h-4 w-4" /> Pendência</Button> : null}
          {submission ? <Button size="sm" variant="outline" onClick={() => downloadRecordPdf(submission)}><FileDown className="mr-2 h-4 w-4" /> PDF</Button> : null}
          {submission ? <Button size="sm" variant="outline" onClick={() => downloadRecordXlsx(submission)}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button> : null}
          <Button size="sm" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Miniatura da evidência: a imagem exige Bearer, então vem por fetch autenticado. */
function EvidenceThumb({ evidence }: { evidence: RecordEvidence }) {
  const [src, setSrc] = useState<string | null>(null);
  const isImage = (evidence.mimeType ?? '').startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      const token = getAccessToken();
      try {
        const res = await fetch(`${API_URL}/forms/evidence/${evidence.id}/content`, { headers: token ? { authorization: `Bearer ${token}` } : undefined });
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      } catch {
        /* miniatura é acessório: falhou, mostra só o nome do arquivo */
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [evidence.id, isImage]);

  return (
    <div className="overflow-hidden rounded-md border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={evidence.fileName ?? 'Evidência'} className="h-40 w-full object-cover" /> : null}
      <p className="truncate px-3 py-2 text-xs text-muted-foreground">{evidence.description || evidence.fileName || 'Anexo'}</p>
    </div>
  );
}

function TemplateDialog({ open, setOpen, editing, form, setForm, options, updateField, addField, removeField, moveField, duplicateField, save, saving }: {
  open: boolean;
  setOpen: (open: boolean) => void;
  editing: FormTemplate | null;
  form: TemplateForm;
  setForm: (form: TemplateForm) => void;
  options?: FormsOptions;
  updateField: (index: number, patch: Partial<FieldForm>) => void;
  addField: () => void;
  removeField: (index: number) => void;
  moveField: (index: number, direction: -1 | 1) => void;
  duplicateField: (index: number) => void;
  save: () => void;
  saving: boolean;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const optionTypes = new Set(['SELECT', 'MULTISELECT', 'RADIO', 'CHECKBOX']);
  // Total de pontos do modelo; `null` quando ninguém pontuou nada (aí a tela
  // não fala de nota, para não sugerir uma configuração que não existe).
  const scoreTotal = useMemo(() => {
    const notas = form.fields
      .filter((field) => SCORABLE_TYPES.has(field.type))
      .map((field) => parseWeight(field.weight));
    if (!notas.some((nota) => nota !== null)) return null;
    return notas.reduce((total: number, nota) => total + (nota ?? 0), 0);
  }, [form.fields]);

  // Perguntas de avaliação que ficaram de fora por não ter nota.
  const semNota = useMemo(
    () => form.fields.filter((field) => SCORABLE_TYPES.has(field.type) && parseWeight(field.weight) === null).length,
    [form.fields],
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto bg-slate-50 p-0 dark:bg-slate-950">
        <DialogHeader className="sticky top-0 z-10 border-b bg-white px-6 py-4 dark:bg-slate-900">
          <DialogTitle>{editing ? 'Editar formulário' : 'Novo formulário'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-2 pt-4">
          {/* Cabeçalho do formulário: título grande + descrição (estilo builder) */}
          <div className="rounded-xl border border-t-8 border-t-primary bg-white p-5 shadow-sm dark:bg-slate-900">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Título do formulário"
              className="h-auto rounded-none border-0 border-b px-0 pb-2 text-2xl font-semibold shadow-none focus-visible:border-primary focus-visible:ring-0"
            />
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descrição — explique quando e como este formulário deve ser preenchido"
              rows={2}
              className="mt-2 resize-none rounded-none border-0 px-0 text-sm shadow-none focus-visible:ring-0"
            />
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Field label="Tipo"><NativeSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{(options?.types ?? Object.keys(TYPE_LABEL)).map((value) => <option key={value} value={value}>{label(TYPE_LABEL, value)}</option>)}</NativeSelect></Field>
              <Field label="Área responsável"><NativeSelect value={form.orgNodeId} onChange={(e) => setForm({ ...form, orgNodeId: e.target.value })}><option value="">Geral (toda a empresa)</option>{options?.orgNodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</NativeSelect></Field>
              <Field label="Status"><NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{(options?.statuses ?? Object.keys(STATUS_LABEL)).map((value) => <option key={value} value={value}>{label(STATUS_LABEL, value)}</option>)}</NativeSelect></Field>
            </div>
          </div>

          {/* Cabeçalho do preenchimento: contexto do registro, antes das perguntas */}
          <HeaderBuilder
            fields={form.headerFields}
            fieldTypes={options?.fieldTypes ?? FIELD_TYPES}
            fieldLabel={(value) => label(FIELD_LABEL, value)}
            onChange={(headerFields) => setForm({ ...form, headerFields })}
          />

          {/* Perguntas: um cartão por campo, com reordenar/duplicar/excluir */}
          <div className="space-y-3">
            {form.fields.map((field, index) => (
              <div key={`${index}-${field.order}`} className="group rounded-xl border border-l-4 border-l-primary/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900">
                <div className="flex items-start gap-3">
                  {/* Numeração editável: em branco segue a posição na lista. */}
                  <Input
                    value={field.displayNumber}
                    onChange={(e) => updateField(index, { displayNumber: e.target.value })}
                    placeholder={String(index + 1)}
                    title="Número da pergunta (deixe vazio para numerar automaticamente)"
                    className="mt-2 h-7 w-11 shrink-0 rounded-full bg-primary/10 px-0 text-center text-xs font-bold text-primary shadow-none"
                  />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        placeholder="Escreva a pergunta ou item de verificação"
                        className="rounded-none border-0 border-b px-0 text-base font-medium shadow-none focus-visible:border-primary focus-visible:ring-0"
                      />
                      <NativeSelect value={field.type} onChange={(e) => updateField(index, { type: e.target.value })}>
                        {(options?.fieldTypes ?? FIELD_TYPES).map((value) => <option key={value} value={value}>{label(FIELD_LABEL, value)}</option>)}
                      </NativeSelect>
                    </div>
                    {optionTypes.has(field.type) && (
                      <Field label="Opções (uma por linha ou separadas por vírgula)">
                        <Textarea value={field.options} onChange={(e) => updateField(index, { options: e.target.value })} rows={3} placeholder="Conforme
Não conforme
Não se aplica" />
                      </Field>
                    )}
                    <Input
                      value={field.helpText}
                      onChange={(e) => updateField(index, { helpText: e.target.value })}
                      placeholder="Texto de ajuda para quem preenche (opcional)"
                      className="text-xs"
                    />
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3 text-sm">
                      <label className="flex items-center gap-1.5"><input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} /> Obrigatório</label>
                      <label className="flex items-center gap-1.5"><input type="checkbox" checked={field.evidenceRequired} onChange={(e) => updateField(index, { evidenceRequired: e.target.checked })} /> Exige evidência</label>
                      <label className="flex items-center gap-1.5"><input type="checkbox" checked={field.commentRequired} onChange={(e) => updateField(index, { commentRequired: e.target.checked })} /> Exige comentário</label>
                      {/* Nota da pergunta: só faz sentido em item de avaliação —
                          texto, foto e data são registro, não entram na conta. */}
                      {SCORABLE_TYPES.has(field.type) ? (
                        <label
                          className="flex items-center gap-1.5"
                          title="Quanto esta pergunta vale no resultado. Deixe em branco para a pergunta não pontuar."
                        >
                          Nota
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={field.weight}
                            onChange={(e) => updateField(index, { weight: e.target.value })}
                            placeholder="—"
                            className="h-8 w-20 text-xs"
                          />
                          {/* Enquanto ninguém pontuou nada, "sem nota" não quer
                              dizer nada: todas valem igual. A partir da primeira
                              nota, o aviso passa a ser informação real. */}
                          {scoreTotal !== null && !field.weight.trim() ? (
                            <span className="text-xs text-muted-foreground">não pontua</span>
                          ) : null}
                        </label>
                      ) : null}
                      <label className="flex items-center gap-1.5">
                        Criticidade
                        <NativeSelect value={field.criticality} onChange={(e) => updateField(index, { criticality: e.target.value })} className="h-8 w-28 text-xs">
                          <option value="">Normal</option>
                          <option value="CRITICAL">Crítico</option>
                        </NativeSelect>
                      </label>
                      <div className="ml-auto flex items-center gap-0.5">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Mover para cima" onClick={() => moveField(index, -1)} disabled={index === 0}><ChevronUp className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Mover para baixo" onClick={() => moveField(index, 1)} disabled={index === form.fields.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Duplicar pergunta" onClick={() => duplicateField(index)}><Copy className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-status-red" title="Excluir pergunta" onClick={() => removeField(index)} disabled={form.fields.length === 1}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-full border-dashed" onClick={addField}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar pergunta
            </Button>
          </div>

          {/* Gatilho de NC automática */}
          <label className="flex items-start gap-2 rounded-xl border bg-white p-4 text-sm shadow-sm dark:bg-slate-900">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.autoNonconformity}
              onChange={(e) => setForm({ ...form, autoNonconformity: e.target.checked })}
            />
            <span>
              <span className="font-medium">Gerar Não Conformidade automática quando reprovado</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Ao concluir um preenchimento com item de conformidade reprovado (ou sim/não crítico negativo), o sistema abre uma NC
                vinculada à área do preenchimento, com os itens reprovados na descrição.
              </span>
            </span>
          </label>

          {/* Configurações avançadas (recolhidas por padrão) */}
          <div className="rounded-xl border bg-white shadow-sm dark:bg-slate-900">
            <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold" onClick={() => setShowAdvanced((v) => !v)}>
              <span>Configurações avançadas</span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showAdvanced && (
              <div className="grid gap-3 border-t p-4 md:grid-cols-3">
                <Field label="Código"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Automático" /></Field>
                <Field label="Versão"><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></Field>
                <Field label="Confidencialidade"><NativeSelect value={form.confidentiality} onChange={(e) => setForm({ ...form, confidentiality: e.target.value })}><option value="PUBLIC">Pública</option><option value="INTERNAL">Interna</option><option value="RESTRICTED">Restrita</option></NativeSelect></Field>
                <Field label="Tipo configurado"><NativeSelect value={form.typeConfigId} onChange={(e) => setForm({ ...form, typeConfigId: e.target.value })}><option value="">Automático</option>{options?.typeConfigs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect></Field>
                <Field label="Categoria"><NativeSelect value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Sem categoria</option>{options?.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect></Field>
                <Field label="Pasta"><NativeSelect value={form.folderId} onChange={(e) => setForm({ ...form, folderId: e.target.value })}><option value="">Sem pasta</option>{options?.folders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect></Field>
                <Field label="Dono"><NativeSelect value={form.ownerUserId} onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}><option value="">Sem dono</option>{options?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</NativeSelect></Field>
                <Field label="Processo"><NativeSelect value={form.processId} onChange={(e) => setForm({ ...form, processId: e.target.value })}><option value="">Sem processo</option>{options?.processes.map((process) => <option key={process.id} value={process.id}>#{process.number} {process.code ? `${process.code} - ` : ''}{process.name}</option>)}</NativeSelect></Field>
                <Field label="Indicador"><NativeSelect value={form.indicatorId} onChange={(e) => setForm({ ...form, indicatorId: e.target.value })}><option value="">Sem indicador</option>{options?.indicators.map((indicator) => <option key={indicator.id} value={indicator.id}>{indicator.code ? `${indicator.code} - ` : ''}{indicator.name}</option>)}</NativeSelect></Field>
                <Field label="Tempo estimado (min)"><Input type="number" min={0} value={form.estimatedMinutes} onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })} /></Field>
                <Field label="Retenção (dias)"><Input type="number" min={0} value={form.retentionDays} onChange={(e) => setForm({ ...form, retentionDays: e.target.value })} /></Field>
                <Field label="Tags"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Crítico, recorrente, externo" /></Field>
                <div className="grid gap-3 md:col-span-3 md:grid-cols-2">
                  <Field label="Finalidade"><Textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} rows={2} /></Field>
                  <Field label="Instruções"><Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={2} /></Field>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="sticky bottom-0 border-t bg-white px-6 py-3 dark:bg-slate-900">
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {form.fields.length} pergunta(s)
            {/* Soma das notas: o autor precisa ver se o checklist fecha em 100.
                Não é obrigatório fechar — o resultado é sempre percentual —,
                mas fechar em 100 deixa "nota = ponto" e evita confusão. */}
            {scoreTotal !== null ? (
              <> · <strong>{formatNumber(scoreTotal)}</strong> pontos no total
                {semNota > 0 ? ` · ${semNota} pergunta(s) sem nota (não pontuam)` : ''}
                {scoreTotal !== 100 ? ' — o resultado é percentual, não precisa fechar em 100' : ''}
              </>
            ) : null}
          </span>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={!form.title.trim() || saving}><Save className="mr-2 h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar formulário'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubmissionDialog({ open, setOpen, selected, options, execution, setExecution, participants, setParticipants, photos, setPhotos, notes, setNotes, answers, setAnswers, submit, saving }: {
  open: boolean;
  setOpen: (open: boolean) => void;
  selected: FormTemplate | null;
  options?: FormsOptions;
  execution: ExecuteSelection;
  setExecution: (value: ExecuteSelection) => void;
  participants: Participant[];
  setParticipants: (value: Participant[]) => void;
  photos: CapturedPhoto[];
  setPhotos: (photos: CapturedPhoto[]) => void;
  notes: string;
  setNotes: (value: string) => void;
  answers: Record<string, string>;
  setAnswers: (fn: any) => void;
  submit: () => void;
  saving: boolean;
}) {
  const isHeader = headerFieldFilter(selected?.sections);
  const headerFields = (selected?.fields ?? []).filter(isHeader);
  const questionFields = (selected?.fields ?? []).filter((field) => !isHeader(field));
  // Modelo pontuado = alguma pergunta tem nota. Só então a tela fala de pontos;
  // em checklist comum isso seria ruído na mão de quem está em campo.
  const notas = questionFields.filter(isScorable).map(fieldNote);
  const pontosDoModelo = notas.some((nota) => nota !== null)
    ? notas.reduce((total: number, nota) => total + (nota ?? 0), 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preencher {selected?.title}</DialogTitle>
          {pontosDoModelo > 0 ? (
            <p className="text-xs text-muted-foreground">Checklist pontuado: {formatNumber(pontosDoModelo)} pontos no total. O resultado é o percentual dos pontos obtidos.</p>
          ) : null}
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* Onde a inspeção está sendo feita: define a qual indicador o
              resultado vai somar. O formulário já foi escolhido em "Preencher". */}
          <div className="rounded-lg border p-3">
            <ExecutePicker nodes={options?.orgNodes ?? []} value={execution} onChange={setExecution} />
          </div>

          {/* Cabecalho: contexto do registro, sem numeracao — nao sao perguntas. */}
          {headerFields.length > 0 && (
            <div className="rounded-lg border border-l-4 border-l-sky-500 bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Informações</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {headerFields.map((field) => (
                  <Field key={field.id} label={`${field.label}${field.required ? ' *' : ''}`}>
                    <AnswerInput field={field} value={answers[field.id] ?? ''} onChange={(value) => setAnswers((current: Record<string, string>) => ({ ...current, [field.id]: value }))} />
                  </Field>
                ))}
              </div>
            </div>
          )}
          {/* Perguntas: numeradas de 1 em diante, pela posicao na lista.
              Quando o modelo é pontuado, cada uma mostra quanto vale. */}
          {questionFields.map((field, index) => (
            <Field
              key={field.id}
              label={`${questionNumber(field, index)}. ${field.label}${field.required ? ' *' : ''}`}
              hint={pontosDoModelo > 0 && isScorable(field) ? notaHint(field) : undefined}
            >
              <AnswerInput field={field} value={answers[field.id] ?? ''} onChange={(value) => setAnswers((current: Record<string, string>) => ({ ...current, [field.id]: value }))} />
            </Field>
          ))}
          {/* Quem participou: matrícula traz nome, cargo e gestor. */}
          <Field label="Participantes">
            <ParticipantsField participants={participants} onChange={setParticipants} disabled={saving} />
          </Field>

          {/* Registro fotográfico: no celular abre a câmera direto. */}
          <Field label="Registro fotográfico">
            <PhotoCapture photos={photos} onChange={setPhotos} disabled={saving} />
          </Field>
          <Field label="Observações"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></Field>
          <ParticipantsFooter participants={participants} />
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
        <DialogHeader><DialogTitle>Programar execução</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <p className="text-sm text-muted-foreground">
            {selected?.title} — atribui o checklist a um responsável com prazo. Para responder agora, use <strong>Preencher</strong>.
          </p>
          <Field label="Título"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Responsável"><NativeSelect value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}><option value="">Sem responsável</option>{options?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</NativeSelect></Field>
          <Field label="Prazo"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.offlineEnabled} onChange={(e) => setForm({ ...form, offlineEnabled: e.target.checked })} /> Permitir sem conexão</label>
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
        <DialogHeader><DialogTitle>Respostas da execução {execution?.code}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          {!template ? <EmptyText>Modelo da execução não está carregado na lista atual.</EmptyText> : null}
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

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid min-w-0 flex-1 gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {hint ? <Badge variant="outline" className="shrink-0 text-[10px] font-semibold">{hint}</Badge> : null}
      </div>
      {children}
    </div>
  );
}

/** A pergunta é do tipo que pode pontuar? (espelha SCORABLE_TYPES) */
function isScorable(field: { type: FieldType }): boolean {
  return SCORABLE_TYPES.has(field.type);
}

/**
 * Nota da pergunta, ou `null` quando ela não tem nota.
 * Espelha `noteOf` de form-scoring.logic.ts no backend.
 */
function fieldNote(field: { weight?: number | null }): number | null {
  const parsed = Number(field.weight);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Selo da pergunta em checklist pontuado.
 *
 * "Sem nota" precisa ser dito: o técnico tem de saber que aquela pergunta ele
 * responde, mas ela não muda o resultado — senão vai achar que reprovar ali
 * derrubou a inspeção.
 */
function notaHint(field: { weight?: number | null }): string {
  const nota = fieldNote(field);
  return nota === null ? 'Sem nota' : `Nota ${formatNumber(nota)}`;
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
        {field.evidenceRequired ? <Badge variant="outline" className="border-amber-300 text-amber-700">Evidência</Badge> : null}
        {isScorable(field) && fieldNote(field) !== null ? <Badge variant="outline" className="border-blue-300 text-blue-700">Nota {formatNumber(fieldNote(field))}</Badge> : null}
      </div>
      {field.helpText ? <p className="mt-1 text-sm text-muted-foreground">{field.helpText}</p> : null}
      {field.options ? <p className="mt-1 text-xs text-muted-foreground">Opções: {splitOptions(field.options).join(', ')}</p> : null}
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
  if (['BOOLEAN', 'YES_NO'].includes(field.type)) return <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}><option value="">Selecione</option><option value="Sim">Sim</option><option value="Nao">Não</option></NativeSelect>;
  if (field.type === 'CONFORMITY') return <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}><option value="">Selecione</option><option value="Conforme">Conforme</option><option value="Nao conforme">Não conforme</option><option value="Nao aplicavel">Não aplicável</option></NativeSelect>;
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
    settings: { ...form.settingsRaw, autoNonconformity: { enabled: form.autoNonconformity } },
    sections: headerSectionPayload(form.headerFields),
    // Cabeçalho primeiro: é o topo do documento, antes das perguntas.
    fields: [
      ...headerFieldsPayload(form.headerFields),
      // Ordem = posição na lista, sempre. Herdar a ordem antiga fazia a
      // primeira pergunta de um modelo novo aparecer como "16".
      ...form.fields.filter((field) => field.label.trim()).map((field, index) => ({
        order: form.headerFields.length + index + 1,
        metadata: field.displayNumber.trim() ? { displayNumber: field.displayNumber.trim() } : null,
        code: field.code || null,
        label: field.label,
        type: field.type,
        required: field.required,
        evidenceRequired: field.evidenceRequired,
        commentRequired: field.commentRequired,
        criticality: field.criticality || null,
        // Nota da pergunta; `null` = sem nota (fica fora da pontuação).
        weight: parseWeight(field.weight),
        options: field.options || null,
        helpText: field.helpText || null,
      })),
    ],
  };
}

/**
 * Nota digitada pelo autor, ou `null` quando ele deixou em branco.
 *
 * "Em branco" é uma resposta legítima: nem toda pergunta tem nota. Converter
 * para 1 daria um ponto escondido à pergunta que o autor decidiu não pontuar.
 */
function parseWeight(value: string): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number(text.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Número exibido da pergunta.
 *
 * A posição na lista manda; o autor pode fixar um número próprio (guardado em
 * `metadata.displayNumber`) quando a numeração precisa seguir um padrão da
 * empresa. Antes usávamos `field.order` cru, que vinha herdado de versões
 * anteriores do modelo e fazia a primeira pergunta aparecer como "16".
 */
function questionNumber(field: { metadata?: unknown }, index: number): string {
  const custom = (field.metadata as { displayNumber?: unknown } | null | undefined)?.displayNumber;
  const text = String(custom ?? '').trim();
  return text || String(index + 1);
}

/** Percentual de conformidade em pt-BR (ex.: 97,1%). */
function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/** Data que o usuário reconhece como "quando isso foi preenchido". */
function recordDate(submission: FormSubmission): string | null {
  return submission.completedAt ?? submission.submittedAt ?? submission.createdAt ?? submission.reviewedAt ?? null;
}

/** Participantes chegam como Json do banco: só confia se vier como lista. */
function recordParticipants(submission: FormSubmission | null): RecordParticipant[] {
  if (!submission || !Array.isArray(submission.participants)) return [];
  return (submission.participants as RecordParticipant[]).filter((item) => item && typeof item === 'object');
}

/** Registro no formato que os exportadores (PDF/Excel) entendem. */
function toExportable(submission: FormSubmission): ExportableRecord {
  return {
    id: submission.id,
    code: submission.code ?? null,
    title: submission.title,
    status: submission.status,
    statusLabel: label(SUBMISSION_LABEL, submission.status),
    templateTitle: submission.template?.title ?? submission.title ?? 'Formulário',
    templateVersion: submission.templateVersion?.versionLabel ?? submission.template?.version ?? null,
    orgNodeName: submission.orgNode?.name ?? null,
    submittedByName: submission.submittedBy?.name ?? null,
    filledAt: recordDate(submission),
    score: submission.score ?? null,
    points: submission.points ?? null,
    pointsTotal: submission.pointsTotal ?? null,
    usesWeights: Boolean(submission.usesWeights),
    notes: submission.notes,
    answers: submission.answers.map((answer) => ({
      id: answer.id,
      fieldLabel: answer.fieldLabel,
      fieldType: answer.fieldType ?? null,
      value: answer.value,
      weight: answer.weight ?? null,
      points: answer.score ?? null,
    })),
    participants: recordParticipants(submission),
    evidence: (submission.evidence ?? []) as RecordEvidence[],
  };
}

async function downloadRecordPdf(submission: FormSubmission) {
  try {
    await exportRecordPdf(toExportable(submission));
  } catch {
    toast.error('Não foi possível gerar o PDF do registro.');
  }
}

async function downloadRecordXlsx(submission: FormSubmission) {
  try {
    await exportRecordXlsx(toExportable(submission));
  } catch {
    toast.error('Não foi possível gerar o Excel do registro.');
  }
}

async function downloadRecordList(submissions: FormSubmission[]) {
  try {
    await exportRecordListXlsx(submissions.map(toExportable));
  } catch {
    toast.error('Não foi possível gerar a planilha da lista.');
  }
}

/** O campo pertence ao cabeçalho? (evita duplicá-lo na lista de perguntas) */
function isHeaderField(
  sections: Array<{ id: string; code: string | null }> | undefined,
  field: { sectionId?: string | null },
): boolean {
  return headerFieldFilter(sections)(field);
}

function cloneTemplateForm(): TemplateForm {
  return { ...EMPTY_TEMPLATE, headerFields: [], fields: [{ ...EMPTY_FIELD }] };
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
