/**
 * Recrutamento e Seleção (F1) — lógica pura da requisição de vaga: máquina de
 * estados, travas de quadro/orçamento (modo flexível com exceção aprovável) e
 * avaliação do workflow de aprovação com segregação de funções.
 *
 * Nada aqui toca o banco; tudo determinístico e testável. Ver
 * docs/diagnostico-recrutamento-selecao.md (decisão do usuário: travas FLEXÍVEIS).
 */

export type RequisitionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETURNED'
  | 'FROZEN'
  | 'CANCELLED'
  | 'SENT_TO_RECRUITMENT'
  | 'IN_RECRUITMENT'
  | 'FILLED'
  | 'CLOSED';

/** Transições permitidas da requisição. */
export const REQUISITION_TRANSITIONS: Record<RequisitionStatus, RequisitionStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'RETURNED', 'FROZEN', 'CANCELLED'],
  RETURNED: ['SUBMITTED', 'CANCELLED'],
  FROZEN: ['SUBMITTED', 'CANCELLED'],
  APPROVED: ['SENT_TO_RECRUITMENT', 'FROZEN', 'CANCELLED'],
  SENT_TO_RECRUITMENT: ['IN_RECRUITMENT', 'FROZEN', 'CANCELLED'],
  IN_RECRUITMENT: ['FILLED', 'FROZEN', 'CANCELLED'],
  FILLED: ['CLOSED'],
  REJECTED: [],
  CANCELLED: [],
  CLOSED: [],
};

export function canTransition(from: RequisitionStatus, to: RequisitionStatus): boolean {
  return (REQUISITION_TRANSITIONS[from] ?? []).includes(to);
}

/** Status que reservam quadro/orçamento (reserva ativa). */
export function reservesHeadcount(status: RequisitionStatus): boolean {
  return ['SUBMITTED', 'APPROVED', 'SENT_TO_RECRUITMENT', 'IN_RECRUITMENT'].includes(status);
}

// ------------------------------ travas de quadro/orçamento ------------------------------

export type GateMode = 'STRICT' | 'FLEXIBLE';

export interface VacancyGateInput {
  /** Existe posição aprovada (CompensationPosition) vinculada? */
  hasApprovedPosition: boolean;
  /** Saldo de quadro disponível (null = orçamento de headcount não cadastrado). */
  headcountAvailable: number | null;
  requestedOpenings: number;
  /** Orçamento mensal disponível em centavos (null = orçamento não cadastrado). */
  budgetAvailableCents: number | null;
  requiredMonthlyCents: number;
  /** A requisição passou por todo o workflow de aprovação? */
  fullyApproved: boolean;
  hasDescription: boolean;
  hasRecruiter: boolean;
  hasPipeline: boolean;
}

export interface VacancyGateResult {
  ready: boolean;
  blocks: string[]; // impedem de prosseguir (sempre)
  warnings: string[]; // sinalizam, não impedem no modo flexível
  exceptionsRequired: string[]; // itens que exigem exceção aprovada e auditada
}

/**
 * Avalia se a requisição pode virar vaga/ser encaminhada ao recrutamento.
 * STRICT: posição/quadro/orçamento são obrigatórios (bloqueiam).
 * FLEXIBLE (decisão do usuário): posição/quadro/orçamento ausentes viram AVISO
 * + exceção aprovável; só bloqueiam de fato as regras de processo (aprovação,
 * descrição, recrutador, pipeline).
 */
export function evaluateVacancyGate(input: VacancyGateInput, mode: GateMode = 'FLEXIBLE'): VacancyGateResult {
  const blocks: string[] = [];
  const warnings: string[] = [];
  const exceptionsRequired: string[] = [];
  const strict = mode === 'STRICT';

  // Regras de processo — sempre bloqueiam.
  if (!input.fullyApproved) blocks.push('Requisição não passou por todas as aprovações.');
  if (!input.hasDescription) blocks.push('Descrição/requisitos do cargo ausentes.');
  if (!input.hasRecruiter) blocks.push('Sem recrutador responsável.');
  if (!input.hasPipeline) blocks.push('Pipeline de seleção não definido.');
  if (input.requestedOpenings < 1) blocks.push('Quantidade de vagas inválida.');

  // Posição.
  if (!input.hasApprovedPosition) {
    if (strict) blocks.push('Sem posição aprovada no organograma.');
    else { warnings.push('Sem posição vinculada — será criada/aprovada no fluxo (exceção).'); exceptionsRequired.push('POSITION'); }
  }

  // Quadro (headcount).
  if (input.headcountAvailable !== null && input.headcountAvailable < input.requestedOpenings) {
    const msg = `Saldo de quadro insuficiente (${input.headcountAvailable} disponível, ${input.requestedOpenings} solicitado).`;
    if (strict) blocks.push(msg);
    else { warnings.push(msg); exceptionsRequired.push('HEADCOUNT'); }
  } else if (input.headcountAvailable === null) {
    warnings.push('Orçamento de quadro não cadastrado para esta área/período.');
  }

  // Orçamento (budget).
  if (input.budgetAvailableCents !== null && input.budgetAvailableCents < input.requiredMonthlyCents) {
    const msg = 'Orçamento mensal insuficiente para a faixa/salário previsto.';
    if (strict) blocks.push(msg);
    else { warnings.push(msg); exceptionsRequired.push('BUDGET'); }
  } else if (input.budgetAvailableCents === null) {
    warnings.push('Orçamento não cadastrado para esta área/período.');
  }

  return { ready: blocks.length === 0, blocks, warnings, exceptionsRequired };
}

// ------------------------------ workflow de aprovação ------------------------------

export interface ApprovalStep {
  order: number;
  role: string; // GESTOR | RH | COMPENSATION | FINANCE | DIRECTOR | COMPLIANCE | ...
  decision?: 'APPROVED' | 'REJECTED' | 'RETURNED' | null;
  approverId?: string | null;
}

/** Próximo passo pendente de decisão (ordem crescente). */
export function nextPendingApproval(steps: ApprovalStep[]): ApprovalStep | null {
  return [...steps].sort((a, b) => a.order - b.order).find((s) => !s.decision) ?? null;
}

/** Situação consolidada do workflow. */
export function approvalOutcome(steps: ApprovalStep[]): 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' {
  if (steps.some((s) => s.decision === 'REJECTED')) return 'REJECTED';
  if (steps.some((s) => s.decision === 'RETURNED')) return 'RETURNED';
  if (steps.length > 0 && steps.every((s) => s.decision === 'APPROVED')) return 'APPROVED';
  return 'PENDING';
}

/**
 * Segregação de funções: o solicitante não pode ser o aprovador quando a matriz
 * exige (padrão). Retorna erro (string) ou null se ok.
 */
export function checkApprovalSegregation(requesterId: string, approverId: string, enforce = true): string | null {
  if (enforce && requesterId === approverId) return 'Segregação de funções: o solicitante não pode aprovar a própria requisição.';
  return null;
}
