import type { DocNode } from '@g360/shared';

export type DocStatus =
  | 'DRAFT' | 'IN_DEVELOPMENT' | 'WAITING_REVIEW' | 'REVIEW' | 'IN_REVIEW' | 'ADJUSTMENTS_REQUESTED' | 'REVIEWED'
  | 'WAITING_APPROVAL' | 'IN_APPROVAL' | 'REJECTED' | 'APPROVED' | 'SCHEDULED_PUBLICATION' | 'PUBLISHED'
  | 'NEAR_EXPIRATION' | 'EXPIRED' | 'PERIODIC_REVIEW' | 'REPLACED' | 'OBSOLETE' | 'ARCHIVED' | 'CANCELLED';

export type DocType =
  | 'POLICY' | 'PROCEDURE' | 'INSTRUCTION' | 'MANUAL' | 'FORM' | 'TEMPLATE' | 'RECORD' | 'INTERNAL_STANDARD'
  | 'GUIDELINE' | 'REGULATION' | 'FLOWCHART' | 'PLAN' | 'REPORT' | 'CHECKLIST' | 'TECHNICAL_SPECIFICATION' | 'EXTERNAL' | 'OTHER';

export type Confidentiality = 'INTERNAL' | 'RESTRICTED' | 'CONFIDENTIAL';
export type ContentFormat = 'TEXT' | 'STRUCTURED' | 'DOCX' | 'FILE';

export interface Person { id: string; name: string; email?: string }
export interface TypeConfig {
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
  description?: string | null;
  approvalFlow?: { mode?: 'SEQUENTIAL' | 'PARALLEL'; reviewDays?: number; approvalDays?: number } | null;
}

export interface DocSummaryRow {
  id: string;
  number: number;
  code: string | null;
  title: string;
  description: string | null;
  type: DocType;
  typeConfig: { id: string; name: string; sigla: string; alertDays?: number } | null;
  status: DocStatus;
  version: number;
  confidentiality: Confidentiality;
  contentFormat: ContentFormat;
  readRequired: boolean;
  validUntil: string | null;
  publishedAt: string | null;
  updatedAt: string;
  orgNode: { id: string; name: string } | null;
  owner: Person | null;
  isExpired: boolean;
  needsReview: boolean;
  daysToExpire: number | null;
  snippet?: string | null;
}

export interface SearchResult { items: DocSummaryRow[]; total: number; page: number; pageSize: number; query: string }

export interface Overview {
  total: number;
  published: number;
  development: number;
  review: number;
  approval: number;
  obsolete: number;
  expired: number;
  needsReview: number;
  restricted: number;
  readRequired: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  expiringSoon: DocSummaryRow[];
  mine: { reads: number; steps: number; changeRequests: number };
}

export interface WorkflowStep {
  id: string;
  role: 'REVIEW' | 'APPROVAL';
  order: number;
  user: Person | null;
  decision: string;
  comment: string | null;
  dueAt: string | null;
  decidedAt: string | null;
  delegatedFromUserId: string | null;
  active: boolean;
  overdue: boolean;
}

export interface WorkflowState {
  mode: 'SEQUENTIAL' | 'PARALLEL';
  reviewDays: number;
  approvalDays: number;
  reviewers: Person[];
  approvers: Person[];
  author: string | null;
  versionId: string | null;
  versionLabel: string | null;
  changeSummary: string | null;
  contentHash: string | null;
  steps: WorkflowStep[];
  myStepId: string | null;
  myRole: 'REVIEW' | 'APPROVAL' | null;
  canSubmit: boolean;
  inFlow: boolean;
}

export interface DistributionSummary {
  readRequired: boolean;
  readDueDays: number;
  targets: { users: Person[]; orgNodes: Array<{ id: string; name: string }>; groups: Array<{ id: string; name: string }> };
  versionId: string | null;
  versionLabel: string | null;
  total: number;
  confirmed: number;
  pending: number;
  overdue: number;
  adhesion: number | null;
  confirmedUsers: Array<{ id: string; name: string; confirmedAt: string | null }>;
  pendingUsers: Array<{ id: string; name: string; dueAt: string | null; overdue: boolean }>;
  mine: { status: string; dueAt: string | null; confirmedAt: string | null } | null;
}

export interface Capabilities {
  isAuthor: boolean;
  isManager: boolean;
  canEditMetadata: boolean;
  canEditContent: boolean;
  canConfigure: boolean;
  canSubmit: boolean;
  canPublish: boolean;
  canRevise: boolean;
  canDelete: boolean;
  canDownloadDocx: boolean;
  canManageAccess: boolean;
  canObsolete: boolean;
}

export interface DocVersion {
  id: string;
  revisionNumber: number;
  versionLabel: string;
  status: DocStatus;
  changeReason: string | null;
  changeSummary: string | null;
  docxFileId: string | null;
  pdfFileId: string | null;
  contentHash: string | null;
  pdfSource: string | null;
  publicationDate: string | null;
  expirationDate: string | null;
  createdAt: string;
}

export interface DocFile {
  id: string;
  kind: 'DOCX' | 'PDF' | 'TEMPLATE' | 'ATTACHMENT' | 'EVIDENCE' | 'IMAGE' | 'TEMPORARY';
  versionId: string | null;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  hashSha256: string | null;
  protected: boolean;
  createdAt: string;
}

export interface EditRequest {
  id: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  reason: string | null;
  decisionNote: string | null;
  requesterUserId: string;
  operatorUserId: string | null;
  expiresAt: string | null;
  createdAt: string;
  requester?: Person | null;
  operator?: Person | null;
}

export interface ChangeRequest {
  id: string;
  status: 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'IMPLEMENTED' | 'CANCELLED';
  reason: string;
  proposal: string | null;
  sourceType: string | null;
  sourceLabel: string | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  requester: Person | null;
  decidedBy: Person | null;
}

export interface DocDetail extends DocSummaryRow {
  companyId: string;
  content: string | null;
  contentJson: DocNode | null;
  bodyText: string | null;
  externalUrl: string | null;
  changeNote: string | null;
  validFrom: string | null;
  reviewIntervalMonths: number | null;
  approvedAt: string | null;
  ownerUserId: string | null;
  createdById: string | null;
  approverUserId: string | null;
  orgNodeId: string | null;
  indicatorId: string | null;
  indicator: { id: string; name: string; code: string | null } | null;
  createdBy: Person | null;
  readDueDays: number | null;
  retentionUntil: string | null;
  disposedAt: string | null;
  editor: { configured: boolean; provider: string; mode: 'ONLINE' | 'MANUAL'; url: string | null; message?: string };
  converterAvailable: boolean;
  versions: DocVersion[];
  files: DocFile[];
  statusHistory: Array<{ id: string; statusFrom: string | null; statusTo: string; comment: string | null; createdAt: string; user: Person | null }>;
  approvals: Array<{ id: string; decision: string; approverRole: string | null; comment: string | null; decidedAt: string | null; createdAt: string; signatureHash: string | null; signatureMethod: string | null; user: Person | null }>;
  editRequests: EditRequest[];
  comments: Array<{ id: string; body: string; createdAt: string; user: Person | null }>;
  auditLogs: Array<{ id: string; action: string; reason: string | null; result: string; createdAt: string; user: Person | null }>;
  externalMetadata: {
    issuer: string | null; responsibleAgency: string | null; externalNumber: string | null; issueDate: string | null; expirationDate: string | null;
    sourceLink: string | null; requiresRenewal: boolean; alertDays: number | null;
  } | null;
  tags: Array<{ id: string; name: string }>;
  processLinks: Array<{ id: string; process: { id: string; code: string | null; name: string }; activity: { id: string; name: string } | null; label: string | null }>;
  changeRequests: ChangeRequest[];
  workflow: WorkflowState;
  distribution: DistributionSummary;
  capabilities: Capabilities;
}

export interface DocOptions {
  orgNodes: Array<{ id: string; name: string; type: string }>;
  allOrgNodes: Array<{ id: string; name: string; type: string }>;
  indicators: Array<{ id: string; name: string; code: string | null }>;
  users: Array<{ id: string; name: string; email: string; defaultNodeId: string | null }>;
  typeConfigs: TypeConfig[];
  templates: DocTemplate[];
  groups: Array<{ id: string; name: string }>;
  processes: Array<{ id: string; code: string | null; name: string; status: string }>;
  placeholders: string[];
  editor: DocDetail['editor'];
  converterAvailable: boolean;
  storage: string;
  permissions: { manage: boolean; publish: boolean; create: boolean };
}

export interface DocTemplate {
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

export const STATUS_LABEL: Record<DocStatus, string> = {
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
  PUBLISHED: 'Vigente',
  NEAR_EXPIRATION: 'Vence em breve',
  EXPIRED: 'Vencido',
  PERIODIC_REVIEW: 'Revisão periódica',
  REPLACED: 'Substituído',
  OBSOLETE: 'Obsoleto',
  ARCHIVED: 'Arquivado',
  CANCELLED: 'Cancelado',
};

export const STATUS_CLASS: Record<DocStatus, string> = {
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

export const TYPE_LABEL: Record<DocType, string> = {
  POLICY: 'Política',
  PROCEDURE: 'Procedimento',
  INSTRUCTION: 'Instrução de trabalho',
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
  EXTERNAL: 'Documento externo',
  OTHER: 'Outro',
};

export const CONFIDENTIALITY_LABEL: Record<Confidentiality, string> = { INTERNAL: 'Interno', RESTRICTED: 'Restrito', CONFIDENTIAL: 'Confidencial' };
export const CONFIDENTIALITY_HINT: Record<Confidentiality, string> = {
  INTERNAL: 'Quem enxerga a área do documento.',
  RESTRICTED: 'Só pessoas, grupos e áreas autorizados.',
  CONFIDENTIAL: 'Só autorizados e nunca enviado para a IA.',
};
export const FORMAT_LABEL: Record<ContentFormat, string> = { TEXT: 'Texto simples', STRUCTURED: 'Editor visual', DOCX: 'Arquivo Word', FILE: 'PDF anexado' };

export const EDITABLE: DocStatus[] = ['DRAFT', 'IN_DEVELOPMENT', 'ADJUSTMENTS_REQUESTED', 'REJECTED'];
export const PUBLISHED_LIKE: DocStatus[] = ['PUBLISHED', 'NEAR_EXPIRATION', 'EXPIRED', 'PERIODIC_REVIEW'];
export const isEditable = (status: DocStatus) => EDITABLE.includes(status);
export const isPublishedLike = (status: DocStatus) => PUBLISHED_LIKE.includes(status);

export const docLabel = (doc: { code: string | null; number?: number; title: string }) => `${doc.code ?? `#${doc.number ?? ''}`} · ${doc.title}`;

export function formatBytes(value: number | null | undefined) {
  if (!value) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function toInputDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
