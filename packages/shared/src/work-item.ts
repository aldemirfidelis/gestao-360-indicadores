// Contrato unificado da Central de Trabalho "Meu Dia".
// Referencia o registro de origem; nunca o substitui como fonte oficial.

export type WorkItemPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type WorkItemStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'BLOCKED' | 'DONE' | 'ARCHIVED';
export type WorkItemSlaStatus = 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' | 'NONE';

export type WorkItemType =
  | 'TASK'
  | 'APPROVAL'
  | 'OVERDUE_ACTION'
  | 'DOCUMENT_REVIEW'
  | 'INDICATOR_OFF_TARGET'
  | 'RISK_CRITICAL'
  | 'MEETING'
  | 'AUDIT'
  | 'TRAINING'
  | 'NONCONFORMITY'
  | 'ALERT'
  | 'MESSAGE'
  | 'MENTION'
  | 'WORKFLOW_TASK'
  | 'RECOMMENDATION';

export const WORK_ITEM_PRIORITY_ORDER: Record<WorkItemPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

/** Acao que pode ser executada sobre um item (no painel "Agir agora" ou no modulo). */
export interface WorkItemAction {
  key: string; // 'complete' | 'approve' | 'reject' | 'comment' | 'open' | ...
  label: string;
  kind?: 'primary' | 'default' | 'danger';
  /** Executavel inline (painel lateral), sem trocar de tela. */
  inline?: boolean;
  requiresJustification?: boolean;
  requiresEvidence?: boolean;
  /** Rota do modulo de origem, quando a acao exige abrir a tela completa. */
  href?: string | null;
}

export interface UnifiedWorkItem {
  id: string;
  companyId: string;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceEventId?: string | null;
  workflowInstanceId?: string | null;
  workflowNodeKey?: string | null;
  itemType: WorkItemType | string;
  title: string;
  summary?: string | null;
  status: WorkItemStatus | string;
  priority: WorkItemPriority;
  priorityScore: number;
  priorityReason?: string | null;
  criticality?: string | null;
  dueAt?: string | null;
  overdueDays: number;
  slaStatus?: WorkItemSlaStatus | string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  requesterUserId?: string | null;
  managerUserId?: string | null;
  branchId?: string | null;
  orgNodeId?: string | null;
  orgNodeName?: string | null;
  processId?: string | null;
  context?: Record<string, unknown> | null;
  availableActions: WorkItemAction[];
  recommendedAction?: string | null;
  requiresDecision: boolean;
  requiresEvidence: boolean;
  isBlocking: boolean;
  isExternal: boolean;
  isDelegated: boolean;
  delegatedFromUserId?: string | null;
  isFollowed?: boolean;
  isPinned?: boolean;
  followedAt?: string | null;
  pinnedAt?: string | null;
  sourceCreatedAt?: string | null;
  sourceUpdatedAt?: string | null;
  completedAt?: string | null;
}

/** Cards-resumo do topo da Central. */
export interface WorkItemSummaryCounts {
  pending: number;
  overdue: number;
  dueToday: number;
  approvals: number;
  indicatorsOffTarget: number;
  risksCritical: number;
  documentsToReview: number;
  trainingsPending: number;
  meetingsToday: number;
  unreadMessages: number;
}
