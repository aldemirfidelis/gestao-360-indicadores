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

export const ACTION_ORIGIN_LABEL: Record<string, string> = {
  INDICATOR: 'Indicador',
  DEVIATION: 'Desvio',
  MEETING: 'Reunião',
  STRATEGY: 'Mapa estratégico',
  OKR: 'OKR',
  MANUAL: 'Manual',
  IMPORT: 'Importação',
};

export const ACTION_CRITICALITY_LABEL: Record<string, string> = {
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

export const SUGGESTION_TYPE_LABEL: Record<string, string> = {
  QUESTION: 'Pergunta',
  ACTION: 'Ação',
  EFFECTIVENESS: 'Eficácia',
};

export const TRACE_ENTITY_LABEL: Record<string, string> = {
  COMPANY: 'Empresa',
  ORG_NODE: 'Setor',
  STRATEGIC_OBJECTIVE: 'Objetivo estratégico',
  OKR_OBJECTIVE: 'Objetivo OKR',
  INDICATOR: 'Indicador',
  INDICATOR_RESULT: 'Resultado',
  DEVIATION: 'Desvio',
  DEVIATION_CAUSE: 'Causa',
  DEVIATION_ANALYSIS: 'Análise',
  MEETING: 'Reunião',
  MEETING_DECISION: 'Decisão',
  ACTION_PLAN: 'Plano de ação',
  ACTION_TASK: 'Tarefa',
  PROJECT: 'Projeto',
};

export const FEED_KIND_LABEL: Record<string, string> = {
  MANUAL: 'Manual',
  IMPORT: 'Importação',
  API: 'API',
  DATABASE: 'Banco de dados',
  INTEGRATION: 'Integração',
};

export const TRACE_EVENT_LABEL: Record<string, string> = {
  CREATED: 'Criado',
  UPDATED: 'Atualizado',
  STATUS_CHANGED: 'Status alterado',
  RESULT_RECORDED: 'Resultado registrado',
  OFF_TARGET_ALERT: 'Alerta fora da meta',
  CAUSE_CREATED: 'Causa registrada',
  ANALYSIS_CREATED: 'Análise registrada',
  ANALYSIS_SAVED: 'Análise salva',
  MEETING_CREATED: 'Reunião criada',
  MEETING_COMPLETED: 'Reunião concluída',
  MEETING_DECISION: 'Decisão de reunião',
  ACTION_CREATED: 'Ação criada',
  ACTION_STATUS_CHANGED: 'Status da ação',
  TASK_UPDATED: 'Tarefa atualizada',
  TASK_CREATED: 'Tarefa criada',
  TASK_DONE: 'Tarefa concluída',
  TASK_REOPENED: 'Tarefa reaberta',
  EVIDENCE_ADDED: 'Evidência adicionada',
  COMMENT_ADDED: 'Comentário adicionado',
  PARTICIPANT_ADDED: 'Participante adicionado',
  PARTICIPANT_REMOVED: 'Participante removido',
  EMAIL_INVITE_SENT: 'Convite enviado',
  EMAIL_INVITE_FAILED: 'Falha no convite',
  CALENDAR_INVITE_CREATED: 'Convite de agenda',
  TREATMENT_STARTED: 'Fluxo de ação iniciado',
  TREATMENT_IGNORED: 'Fluxo de ação ignorado',
  INDICATOR_REEVALUATED: 'Indicador reavaliado',
  INDICATOR_RESOLVED: 'Indicador resolvido',
  LINK_CREATED: 'Vínculo criado',
  LINK_REMOVED: 'Vínculo removido',
  CLOSED: 'Concluído',
  REOPENED: 'Reaberto',
  AI_USED: 'IA utilizada',
  AI_SUGGESTION_GENERATED: 'Sugestão de IA gerada',
  AI_SUGGESTION_ACCEPTED: 'Sugestão de IA aceita',
  AI_SUGGESTION_REJECTED: 'Sugestão de IA rejeitada',
  EFFECTIVENESS_RECORDED: 'Eficácia registrada',
  EFFECTIVENESS_REQUESTED: 'Análise de eficácia solicitada',
};

export const TRACE_FIELD_LABEL: Record<string, string> = {
  general: 'Geral',
  analysis: 'Análise de causa',
  effectiveness: 'Eficácia',
  '5w2h': '5W2H',
  analysisTool: 'Ferramenta',
  problemDescription: 'Descrição do problema',
  rootCause: 'Causa raiz',
  description: 'Ação proposta',
  expectedResult: 'Resultado esperado',
  achievedResult: 'Resultado alcançado',
  effectivenessSummary: 'Aprendizado',
  effectivenessEvidence: 'Evidência da eficácia',
  status: 'Status',
  priority: 'Prioridade',
  dueDate: 'Prazo',
  startDate: 'Início',
  endDate: 'Conclusão',
  responsibleUserId: 'Responsável',
  ownerNodeId: 'Área/Setor',
  origin: 'Origem',
  criticality: 'Criticidade',
};

export const ANALYSIS_METHOD_LABEL: Record<string, string> = {
  FIVE_WHYS: '5 Porquês',
  ISHIKAWA: 'Ishikawa',
  MASP: 'MASP',
  PDCA: 'PDCA',
  FIVE_W_TWO_H: '5W2H',
  PARETO: 'Pareto',
  FCA: 'FCA',
  GUT: 'Matriz GUT',
  PRIORITIZATION_MATRIX: 'Matriz de priorização',
  BRAINSTORMING: 'Brainstorming',
  ROOT_CAUSE: 'Causa raiz',
  EFFECTIVENESS_CHECKLIST: 'Checklist de eficácia',
};

export const EFFECTIVENESS_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Não avaliada',
  PENDING: 'Pendente',
  IN_REVIEW: 'Em revisão',
  EFFECTIVE: 'Eficaz',
  INEFFECTIVE: 'Ineficaz',
  REOPENED: 'Reaberta',
  NOT_APPLICABLE: 'Não se aplica',
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
