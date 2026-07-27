/**
 * Rótulos do portal do candidato. Nada aqui pode chegar ao candidato como
 * código do banco.
 *
 * ASO, resultado e tipo de documento reaproveitam `lib/recruitment/labels`; os
 * mapas abaixo existem à parte porque o texto muda de perspectiva — o
 * recrutador lê "Enviada ao candidato", o candidato precisa ler "Aguardando
 * sua resposta".
 */

export type Tone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info';

export const APPLICATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Em andamento', tone: 'info' },
  HIRED: { label: 'Contratado', tone: 'positive' },
  REJECTED: { label: 'Não selecionado', tone: 'neutral' },
  WITHDRAWN: { label: 'Você desistiu', tone: 'neutral' },
  DISQUALIFIED: { label: 'Desclassificado', tone: 'neutral' },
};

export const OFFER_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Em elaboração', tone: 'neutral' },
  PENDING_APPROVAL: { label: 'Aguardando aprovação', tone: 'neutral' },
  APPROVED: { label: 'Aprovada', tone: 'info' },
  SENT: { label: 'Aguardando sua resposta', tone: 'warning' },
  ACCEPTED: { label: 'Aceita por você', tone: 'positive' },
  DECLINED: { label: 'Recusada por você', tone: 'neutral' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
  EXPIRED: { label: 'Expirada', tone: 'negative' },
};

export const PRE_ADMISSION_STATUS: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: 'Aberta', tone: 'info' },
  IN_DOCUMENTS: { label: 'Envio de documentos', tone: 'warning' },
  READY_FOR_ASO: { label: 'Pronta para o exame admissional', tone: 'info' },
  COMPLETED: { label: 'Concluída', tone: 'positive' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
};

export const DOCUMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pendente', tone: 'warning' },
  SUBMITTED: { label: 'Enviado, em análise', tone: 'info' },
  APPROVED: { label: 'Aprovado', tone: 'positive' },
  REJECTED: { label: 'Reprovado, reenviar', tone: 'negative' },
  WAIVED: { label: 'Dispensado', tone: 'neutral' },
};

export const EXAM_TYPE: Record<string, string> = {
  ADMISSIONAL: 'Admissional',
  PERIODICO: 'Periódico',
  RETORNO_TRABALHO: 'Retorno ao trabalho',
  MUDANCA_RISCO: 'Mudança de risco',
  DEMISSIONAL: 'Demissional',
};

export const DATA_REQUEST_TYPE: Record<string, string> = {
  ACCESS: 'Acesso aos dados',
  RECTIFICATION: 'Retificação',
  PORTABILITY: 'Portabilidade',
  DELETION: 'Exclusão/anonimização',
};

export const DATA_REQUEST_STATUS: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: 'Em aberto', tone: 'warning' },
  DONE: { label: 'Atendida', tone: 'positive' },
  REJECTED: { label: 'Recusada', tone: 'neutral' },
};

/** Traduz o código; valor novo vira algo legível em vez do código cru. */
export function text(map: Record<string, string>, value?: string | null): string {
  if (!value) return '—';
  return map[value] ?? value.replace(/_/g, ' ').toLowerCase();
}

/** Rótulo + tom de um mapa de status. */
export function status(map: Record<string, { label: string; tone: Tone }>, value?: string | null): { label: string; tone: Tone } {
  if (!value) return { label: '—', tone: 'neutral' };
  return map[value] ?? { label: value.replace(/_/g, ' ').toLowerCase(), tone: 'neutral' };
}
