/**
 * Rótulos PT-BR e tons de status para os enums do módulo Segurança Patrimonial.
 * Centraliza a tradução para que badges e selects não exibam enum cru
 * (ex.: `WAITING_DOCUMENTS`, `LOANED`, `NOT_REQUIRED`).
 */

/** Mesmo conjunto de tons aceito por `StatusBadge` (components/platform/status-badge). */
export type Tone = 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple';

export const PERSON_TYPE_LABELS: Record<string, string> = {
  VISITOR: 'Visitante',
  CONTRACTOR: 'Prestador',
  DRIVER: 'Motorista',
  PASSENGER: 'Passageiro',
  EMPLOYEE: 'Colaborador',
  THIRD_PARTY: 'Terceiro',
  SUPPLIER: 'Fornecedor',
  REPRESENTATIVE: 'Representante',
  AUTHORITY: 'Autoridade',
  GUEST: 'Convidado',
  BLOCKED: 'Bloqueado',
};

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  VALID: 'Válido',
  EXPIRING: 'A vencer',
  EXPIRED: 'Vencido',
  MISSING: 'Ausente',
  IN_REVIEW: 'Em análise',
  REJECTED: 'Reprovado',
  BLOCKED: 'Bloqueado',
  NOT_REQUIRED: 'Não exigido',
};

export const AUTH_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  REQUESTED: 'Solicitada',
  WAITING_DOCUMENTS: 'Aguardando documentos',
  WAITING_APPROVAL: 'Aguardando aprovação',
  APPROVED: 'Aprovada',
  REJECTED: 'Reprovada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Expirada',
  USED: 'Utilizada',
  PARTIALLY_USED: 'Parcialmente utilizada',
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  PERSON_ENTRY: 'Entrada de pessoa',
  PERSON_EXIT: 'Saída de pessoa',
  VEHICLE_ENTRY: 'Entrada de veículo',
  VEHICLE_EXIT: 'Saída de veículo',
  MATERIAL_ENTRY: 'Entrada de material',
  MATERIAL_EXIT: 'Saída de material',
  EQUIPMENT_ENTRY: 'Entrada de equipamento',
  EQUIPMENT_EXIT: 'Saída de equipamento',
  CARGO: 'Carga',
  UNLOADING: 'Descarga',
  CORRESPONDENCE: 'Correspondência',
  KEY_LOAN: 'Empréstimo de chave',
  KEY_RETURN: 'Devolução de chave',
  BADGE_DELIVERY: 'Entrega de crachá',
  BADGE_RETURN: 'Devolução de crachá',
};

export const MOVEMENT_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Em aberto',
  CLOSED: 'Encerrada',
  PENDING: 'Pendente',
  BLOCKED: 'Bloqueada',
  CANCELLED: 'Cancelada',
  OVERDUE: 'Permanência excedida',
};

export const INCIDENT_SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
  EMERGENCY: 'Emergência',
};

export const INCIDENT_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Aberta',
  IN_PROGRESS: 'Em tratativa',
  WAITING_ACTION: 'Aguardando ação',
  CLOSED: 'Encerrada',
  CANCELLED: 'Cancelada',
};

export const ROUND_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planejada',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
  LATE: 'Atrasada',
  MISSED: 'Não realizada',
  CANCELLED: 'Cancelada',
};

export const HANDOVER_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Não iniciada',
  IN_PROGRESS: 'Em andamento',
  WAITING_REVIEW: 'Aguardando revisão',
  WAITING_ACCEPTANCE: 'Aguardando aceite',
  COMPLETED: 'Concluída',
  COMPLETED_WITH_PENDING: 'Concluída com pendências',
};

export const CUSTODY_TYPE_LABELS: Record<string, string> = {
  KEY: 'Chave',
  BADGE: 'Crachá',
};

export const CUSTODY_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponível',
  LOANED: 'Emprestado',
  OVERDUE: 'Devolução atrasada',
  LOST: 'Extraviado',
  BLOCKED: 'Bloqueado',
  MAINTENANCE: 'Manutenção',
  INACTIVE: 'Inativo',
};

export const RECORD_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  BLOCKED: 'Bloqueado',
  ARCHIVED: 'Arquivado',
};

export const PACKAGE_STATUS_LABELS: Record<string, string> = {
  ENABLED: 'Ativo',
  DISABLED: 'Desativado',
  TRIAL: 'Período de teste',
  READ_ONLY: 'Somente leitura',
  BLOCKED: 'Bloqueado',
  EXPIRED: 'Expirado',
};

export const OFFLINE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  SYNCED: 'Sincronizado',
  CONFLICT: 'Conflito',
  ERROR: 'Erro',
};

export const CRITICALITY_LABELS: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

/** Une todos os mapas para resolução genérica de rótulo a partir de um valor de enum. */
const ALL_LABELS: Record<string, string> = {
  ...PERSON_TYPE_LABELS,
  ...DOCUMENT_STATUS_LABELS,
  ...AUTH_STATUS_LABELS,
  ...MOVEMENT_TYPE_LABELS,
  ...MOVEMENT_STATUS_LABELS,
  ...INCIDENT_SEVERITY_LABELS,
  ...INCIDENT_STATUS_LABELS,
  ...ROUND_STATUS_LABELS,
  ...HANDOVER_STATUS_LABELS,
  ...CUSTODY_TYPE_LABELS,
  ...CUSTODY_STATUS_LABELS,
  ...RECORD_STATUS_LABELS,
  ...PACKAGE_STATUS_LABELS,
  ...OFFLINE_STATUS_LABELS,
};

/** Resolve o rótulo PT-BR de um valor de enum, com fallback para o próprio valor. */
export function labelFor(value: string | null | undefined, map?: Record<string, string>): string {
  if (!value) return '—';
  if (map && map[value]) return map[value];
  return ALL_LABELS[value] ?? value;
}

/** Tom (cor) de status para `StatusBadge`, cobrindo os enums do módulo. */
const TONE_BY_VALUE: Record<string, Tone> = {
  // positivos / concluídos
  ACTIVE: 'green',
  VALID: 'green',
  APPROVED: 'green',
  DONE: 'green',
  CLOSED: 'green',
  COMPLETED: 'green',
  AVAILABLE: 'green',
  SYNCED: 'green',
  ENABLED: 'green',
  USED: 'gray',
  // em andamento
  IN_PROGRESS: 'blue',
  OPEN: 'blue',
  PLANNED: 'gray',
  REQUESTED: 'yellow',
  NOT_STARTED: 'gray',
  DRAFT: 'gray',
  // atenção / pendência
  PENDING: 'yellow',
  EXPIRING: 'yellow',
  IN_REVIEW: 'yellow',
  WAITING_ACTION: 'yellow',
  WAITING_APPROVAL: 'yellow',
  WAITING_DOCUMENTS: 'yellow',
  WAITING_REVIEW: 'yellow',
  WAITING_ACCEPTANCE: 'yellow',
  PARTIALLY_USED: 'yellow',
  LOANED: 'yellow',
  COMPLETED_WITH_PENDING: 'yellow',
  TRIAL: 'yellow',
  READ_ONLY: 'yellow',
  MAINTENANCE: 'yellow',
  CONFLICT: 'yellow',
  LATE: 'yellow',
  MEDIUM: 'yellow',
  // negativos / críticos
  OVERDUE: 'red',
  EXPIRED: 'red',
  MISSING: 'red',
  REJECTED: 'red',
  BLOCKED: 'red',
  CANCELLED: 'gray',
  MISSED: 'red',
  LOST: 'red',
  ERROR: 'red',
  CRITICAL: 'red',
  EMERGENCY: 'red',
  HIGH: 'red',
  // severidade baixa
  LOW: 'blue',
  // genéricos
  INACTIVE: 'gray',
  ARCHIVED: 'gray',
  DISABLED: 'gray',
  NOT_REQUIRED: 'gray',
};

export function statusTone(value: string | null | undefined): Tone {
  if (!value) return 'gray';
  return TONE_BY_VALUE[value] ?? 'gray';
}

/** Converte um array de enum em options `{ value, label }` para selects. */
export function toOptions(values: string[] | undefined, map?: Record<string, string>) {
  return (values ?? []).map((value) => ({ value, label: labelFor(value, map) }));
}
