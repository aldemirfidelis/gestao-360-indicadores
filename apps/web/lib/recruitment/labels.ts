/**
 * Labels pt-BR e tons de status para os enums do módulo de Recrutamento (ATS).
 * Fonte única da tradução — nenhuma tela deve exibir enum cru do backend.
 * Tons seguem o vocabulário do StatusBadge da plataforma.
 */
export type StatusTone = 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple';

export interface EnumMeta {
  label: string;
  tone: StatusTone;
}

export const REQUISITION_STATUS: Record<string, EnumMeta> = {
  DRAFT: { label: 'Rascunho', tone: 'gray' },
  SUBMITTED: { label: 'Em aprovação', tone: 'yellow' },
  APPROVED: { label: 'Aprovada', tone: 'blue' },
  REJECTED: { label: 'Reprovada', tone: 'red' },
  RETURNED: { label: 'Devolvida', tone: 'yellow' },
  FROZEN: { label: 'Congelada', tone: 'gray' },
  CANCELLED: { label: 'Cancelada', tone: 'gray' },
  SENT_TO_RECRUITMENT: { label: 'No recrutamento', tone: 'purple' },
  IN_RECRUITMENT: { label: 'Em seleção', tone: 'blue' },
  FILLED: { label: 'Preenchida', tone: 'green' },
  CLOSED: { label: 'Encerrada', tone: 'gray' },
};

export const VACANCY_TYPE: Record<string, string> = {
  AUMENTO: 'Aumento de quadro',
  SUBSTITUICAO: 'Substituição',
  TEMPORARIA: 'Temporária',
  SAZONAL: 'Sazonal',
  APRENDIZ: 'Aprendiz',
  ESTAGIO: 'Estágio',
  TERCEIRIZACAO: 'Terceirização',
  CONFIDENCIAL: 'Confidencial',
  BANCO_TALENTOS: 'Banco de talentos',
};

export const PRIORITY: Record<string, EnumMeta> = {
  BAIXA: { label: 'Baixa', tone: 'gray' },
  NORMAL: { label: 'Normal', tone: 'blue' },
  ALTA: { label: 'Alta', tone: 'yellow' },
  URGENTE: { label: 'Urgente', tone: 'red' },
};

export const APPROVAL_ROLE: Record<string, string> = {
  GESTOR: 'Gestor da área',
  SUPERINTENDENTE: 'Superintendente',
  RH: 'RH',
  COMPENSATION: 'Cargos e Salários',
  FINANCE: 'Financeiro',
  DIRECTOR: 'Diretoria',
  COMPLIANCE: 'Compliance',
};

export const POSTING_STATUS: Record<string, EnumMeta> = {
  DRAFT: { label: 'Rascunho', tone: 'gray' },
  PUBLISHED: { label: 'Publicada', tone: 'green' },
  PAUSED: { label: 'Pausada', tone: 'yellow' },
  CLOSED: { label: 'Encerrada', tone: 'gray' },
};

export const VISIBILITY: Record<string, string> = {
  PUBLIC: 'Pública',
  INTERNAL: 'Interna',
  BOTH: 'Interna e externa',
  CONFIDENTIAL: 'Confidencial',
};

export const WORK_MODE: Record<string, string> = {
  PRESENCIAL: 'Presencial',
  HIBRIDO: 'Híbrido',
  REMOTO: 'Remoto',
};

export const APPLICATION_STATUS: Record<string, EnumMeta> = {
  ACTIVE: { label: 'Em processo', tone: 'green' },
  HIRED: { label: 'Contratado', tone: 'green' },
  REJECTED: { label: 'Rejeitado', tone: 'red' },
  WITHDRAWN: { label: 'Desistiu', tone: 'gray' },
  DISQUALIFIED: { label: 'Desclassificado', tone: 'gray' },
};

export const OFFER_STATUS: Record<string, EnumMeta> = {
  DRAFT: { label: 'Rascunho', tone: 'gray' },
  PENDING_APPROVAL: { label: 'Aguardando aprovação', tone: 'yellow' },
  APPROVED: { label: 'Aprovada', tone: 'blue' },
  SENT: { label: 'Enviada ao candidato', tone: 'purple' },
  ACCEPTED: { label: 'Aceita', tone: 'green' },
  DECLINED: { label: 'Recusada', tone: 'red' },
  CANCELLED: { label: 'Cancelada', tone: 'gray' },
  EXPIRED: { label: 'Expirada', tone: 'gray' },
};

export const PRE_ADMISSION_STATUS: Record<string, EnumMeta> = {
  OPEN: { label: 'Aberta', tone: 'blue' },
  IN_DOCUMENTS: { label: 'Recebendo documentos', tone: 'yellow' },
  READY_FOR_ASO: { label: 'Pronta para o ASO', tone: 'blue' },
  IN_ASO: { label: 'ASO em andamento', tone: 'yellow' },
  ASO_CLEARED: { label: 'ASO apto', tone: 'green' },
  ASO_BLOCKED: { label: 'ASO com pendência', tone: 'red' },
  COMPLETED: { label: 'Concluída', tone: 'green' },
  CANCELLED: { label: 'Cancelada', tone: 'gray' },
};

export const PRE_DOC_STATUS: Record<string, EnumMeta> = {
  PENDING: { label: 'Aguardando envio', tone: 'gray' },
  SUBMITTED: { label: 'Enviado — revisar', tone: 'yellow' },
  APPROVED: { label: 'Aprovado', tone: 'green' },
  REJECTED: { label: 'Rejeitado', tone: 'red' },
  WAIVED: { label: 'Dispensado', tone: 'gray' },
};

export const ASO_STATUS: Record<string, EnumMeta> = {
  REQUESTED: { label: 'Solicitado', tone: 'yellow' },
  SCHEDULED: { label: 'Agendado', tone: 'blue' },
  COMPLETED: { label: 'Concluído', tone: 'green' },
  CANCELLED: { label: 'Cancelado', tone: 'gray' },
};

export const ASO_RESULT: Record<string, EnumMeta> = {
  APTO: { label: 'Apto', tone: 'green' },
  APTO_COM_RESTRICAO: { label: 'Apto com restrição', tone: 'yellow' },
  INAPTO: { label: 'Inapto', tone: 'red' },
};

export const ADMISSION_STATUS: Record<string, EnumMeta> = {
  AUTHORIZED: { label: 'Autorizada', tone: 'blue' },
  EMPLOYEE_CREATED: { label: 'Colaborador criado', tone: 'blue' },
  ONBOARDING_STARTED: { label: 'Onboarding iniciado', tone: 'blue' },
  ESOCIAL_PENDING: { label: 'eSocial pendente', tone: 'yellow' },
  ESOCIAL_GENERATED: { label: 'eSocial gerado', tone: 'green' },
  COMPLETED: { label: 'Concluída', tone: 'green' },
  CANCELLED: { label: 'Cancelada', tone: 'gray' },
};

export const ESOCIAL_STATUS: Record<string, EnumMeta> = {
  NOT_GENERATED: { label: 'Não gerado', tone: 'gray' },
  PENDING: { label: 'Pendente', tone: 'yellow' },
  GENERATED: { label: 'Gerado', tone: 'green' },
  SKIPPED: { label: 'Dispensado', tone: 'gray' },
  ERROR: { label: 'Erro', tone: 'red' },
};

export const INTERVIEW_STATUS: Record<string, EnumMeta> = {
  SCHEDULED: { label: 'Agendada', tone: 'blue' },
  CONFIRMED: { label: 'Confirmada', tone: 'blue' },
  RESCHEDULED: { label: 'Remarcada', tone: 'yellow' },
  DONE: { label: 'Realizada', tone: 'green' },
  NO_SHOW: { label: 'Não compareceu', tone: 'red' },
  CANCELLED: { label: 'Cancelada', tone: 'gray' },
};

export const INTERVIEW_TYPE: Record<string, string> = {
  RH: 'Entrevista com RH',
  GESTOR: 'Entrevista com gestor',
  TECNICA: 'Entrevista técnica',
  PAINEL: 'Painel',
  OUTRA: 'Outra',
};

export const ASSESSMENT_STATUS: Record<string, EnumMeta> = {
  ASSIGNED: { label: 'Atribuído', tone: 'blue' },
  SUBMITTED: { label: 'Entregue', tone: 'yellow' },
  REVIEWED: { label: 'Avaliado', tone: 'green' },
  CANCELLED: { label: 'Cancelado', tone: 'gray' },
};

export const ASSESSMENT_KIND: Record<string, string> = {
  TECHNICAL_TEST: 'Teste técnico',
  CASE: 'Estudo de caso',
  LOGIC: 'Raciocínio lógico',
  LANGUAGE: 'Idioma',
  PERSONALITY: 'Perfil comportamental',
  OTHER: 'Outro',
};

export const PROBATION_STATUS: Record<string, EnumMeta> = {
  PENDING: { label: 'Pendente', tone: 'yellow' },
  COMPLETED: { label: 'Concluída', tone: 'green' },
  WAIVED: { label: 'Dispensada', tone: 'gray' },
};

export const PROBATION_RECOMMENDATION: Record<string, string> = {
  CONTINUAR: 'Continuar acompanhando',
  EFETIVAR: 'Efetivar',
  ENCERRAR: 'Encerrar contrato',
};

export const RECOMMENDATION: Record<string, string> = {
  STRONG_YES: 'Forte sim',
  YES: 'Sim',
  NEUTRAL: 'Neutro',
  NO: 'Não',
  STRONG_NO: 'Forte não',
};

export const DOC_KIND: Record<string, string> = {
  CV: 'Currículo',
  COVER: 'Carta de apresentação',
  CERTIFICATE: 'Certificado',
  PORTFOLIO: 'Portfólio',
  OTHER: 'Outro',
};

export const QUESTION_TYPE: Record<string, string> = {
  TEXT: 'Texto livre',
  YES_NO: 'Sim/Não',
  SINGLE_CHOICE: 'Escolha única',
  MULTI_CHOICE: 'Múltipla escolha',
  NUMBER: 'Número',
};

export const GATE_KIND: Record<string, string> = {
  POSITION: 'posição vinculada',
  HEADCOUNT: 'quadro de pessoal',
  BUDGET: 'orçamento',
};

export const EVENT_TYPE: Record<string, string> = {
  CREATED: 'Candidatura recebida',
  SCREENING_FLAG: 'Alerta na triagem',
  STAGE_MOVED: 'Mudou de etapa',
  EVALUATION_SUBMITTED: 'Avaliação registrada',
  INTERVIEW_SCHEDULED: 'Entrevista agendada',
  INTERVIEW_STATUS: 'Status da entrevista atualizado',
  ASSESSMENT: 'Teste atribuído/atualizado',
  AI_TRIAGE: 'Triagem assistida por IA',
  OFFER_PREPARED: 'Proposta preparada',
  OFFER_APPROVED: 'Proposta aprovada',
  OFFER_SENT: 'Proposta enviada',
  OFFER_ACCEPTED: 'Proposta aceita',
  OFFER_DECLINED: 'Proposta recusada',
  OFFER_CANCELLED: 'Proposta cancelada',
  PREHIRE_STARTED: 'Pré-admissão iniciada',
  PREHIRE_DOC_REQUIRED: 'Documento solicitado',
  PREHIRE_DOC_SUBMITTED: 'Documento enviado',
  PREHIRE_DOC_REVIEWED: 'Documento revisado',
  ASO_REQUESTED: 'ASO solicitado',
  ASO_SCHEDULED: 'ASO agendado',
  ASO_CLEARED: 'ASO apto',
  ASO_BLOCKED: 'ASO com pendência',
  ASO_CANCELLED: 'ASO cancelado',
  ADMISSION_AUTHORIZED: 'Admissão autorizada',
  WITHDRAWN: 'Candidato desistiu',
  REJECTED: 'Candidatura rejeitada',
  NOTE: 'Nota interna',
  DOC_ADDED: 'Documento anexado',
};

/** Label seguro: devolve o valor cru quando não mapeado (nunca quebra a tela). */
export function metaOf(map: Record<string, EnumMeta>, value: string | null | undefined): EnumMeta {
  if (!value) return { label: '—', tone: 'gray' };
  return map[value] ?? { label: value, tone: 'gray' };
}

export function labelOf(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '—';
  return map[value] ?? value;
}

export function formatMoneyCents(cents: number | string | null | undefined, currency = 'BRL'): string {
  if (cents == null || cents === '') return '—';
  const value = typeof cents === 'string' ? Number(cents) : cents;
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(value / 100);
}

export function formatDateTimeBr(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Caminho da página pública da vaga. No apex (gestao360.org) sem subdomínio/domínio
 * próprio da empresa, o portal público precisa do slug da empresa no querystring
 * (`?empresa=`) para saber de quem é a vaga — senão retorna "Vaga não encontrada".
 * Quando a empresa acessar por subdomínio/domínio próprio, o param é inofensivo.
 */
export function publicVacancyPath(vacancySlug: string, company?: { slug?: string | null } | null): string {
  const base = `/carreiras/vagas/${vacancySlug}`;
  const companySlug = company?.slug?.trim();
  return companySlug ? `${base}?empresa=${encodeURIComponent(companySlug)}` : base;
}

export function formatDateBr(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-BR');
}
