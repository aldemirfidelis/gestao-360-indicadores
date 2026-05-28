export const PERIODICITY_LABEL: Record<string, string> = {
  DAILY: 'Diária',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

export const DIRECTION_LABEL: Record<string, string> = {
  HIGHER_BETTER: 'Quanto maior, melhor',
  LOWER_BETTER: 'Quanto menor, melhor',
  EQUAL_TARGET: 'Igual à meta',
  RANGE: 'Faixa aceitável',
};

export const DIRECTION_SHORT_LABEL: Record<string, string> = {
  HIGHER_BETTER: 'Maior é melhor',
  LOWER_BETTER: 'Menor é melhor',
  EQUAL_TARGET: 'Igual à meta',
  RANGE: 'Faixa',
};

export const INDICATOR_TYPE_LABEL: Record<string, string> = {
  STRATEGIC: 'Estratégico',
  TACTICAL: 'Tático',
  OPERATIONAL: 'Operacional',
  PROJECT: 'Projeto',
  PROCESS: 'Processo',
  SAFETY: 'Segurança',
  QUALITY: 'Qualidade',
  HR: 'RH',
  FINANCE: 'Financeiro',
  PRODUCTION: 'Produção',
  MAINTENANCE: 'Manutenção',
  PROCUREMENT: 'Suprimentos',
  COMMERCIAL: 'Comercial',
  CUSTOM: 'Personalizado',
};

export const INDICATOR_UNIT_LABEL: Record<string, string> = {
  PERCENT: '%',
  CURRENCY: 'R$',
  QUANTITY: 'Quantidade',
  HOURS: 'Horas',
  DAYS: 'Dias',
  TONS: 'Toneladas',
  LITERS: 'Litros',
  INDEX: 'Índice',
  TEXT: 'Texto',
  CUSTOM: 'Personalizada',
};

export const INDICATOR_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  IN_REVIEW: 'Em revisão',
};

export const TRAFFIC_LIGHT_LABEL: Record<string, string> = {
  GREEN: 'No alvo',
  YELLOW: 'Atenção',
  RED: 'Crítico',
  GRAY: 'Sem dados',
};

export const ACTION_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  NOT_STARTED: 'Aberto',
  UNDER_ANALYSIS: 'Em análise',
  IN_PROGRESS: 'Em execução',
  WAITING_THIRD: 'Aguardando terceiro',
  WAITING_EVIDENCE: 'Aguardando evidência',
  WAITING_VALIDATION: 'Aguardando validação',
  PAUSED: 'Pausado',
  DONE: 'Concluído',
  DONE_LATE: 'Concluído fora do prazo',
  CANCELLED: 'Cancelado',
  REOPENED: 'Reaberto',
  INEFFECTIVE: 'Ineficaz',
  EFFECTIVE: 'Eficaz',
};

export const ACTION_PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const DEVIATION_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberto',
  IN_ANALYSIS: 'Em análise',
  WAITING_ACTION: 'Aguardando ação',
  IN_PROGRESS: 'Em execução',
  CLOSED: 'Concluído',
  CLOSED_LATE: 'Concluído fora do prazo',
  CANCELLED: 'Cancelado',
};

export const DEVIATION_SEVERITY_LABEL: Record<string, string> = {
  LOW: 'Baixa',
  MODERATE: 'Moderada',
  CRITICAL: 'Crítica',
};

export const RESULT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  FILLED: 'Preenchido',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  REOPENED: 'Reaberto',
};

export const OBJECTIVE_STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planejado',
  ON_TRACK: 'No ritmo',
  AT_RISK: 'Em risco',
  OFF_TRACK: 'Fora do plano',
  DONE: 'Concluído',
  CANCELLED: 'Cancelado',
};

export const MEETING_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendada',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
};

export const SUGGESTION_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  ACCEPTED: 'Aceita',
  REJECTED: 'Rejeitada',
};

export const FEED_KIND_LABEL: Record<string, string> = {
  MANUAL: 'Manual',
  IMPORT: 'Importação',
  API: 'API',
  DATABASE: 'Banco de dados',
  INTEGRATION: 'Integração',
};

export const PERSPECTIVE_KIND_LABEL: Record<string, string> = {
  FINANCIAL: 'Financeira',
  CUSTOMERS: 'Clientes',
  INTERNAL_PROCESS: 'Processos internos',
  LEARNING_GROWTH: 'Aprendizado e crescimento',
  SAFETY: 'Segurança',
  PEOPLE: 'Pessoas',
  ESG: 'ESG',
  QUALITY: 'Qualidade',
  PRODUCTIVITY: 'Produtividade',
  COSTS: 'Custos',
  CUSTOM: 'Personalizada',
};

export function labelOf(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '-';
  return map[value] ?? value;
}
