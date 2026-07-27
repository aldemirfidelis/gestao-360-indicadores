/**
 * Rótulos em português usados nas saídas do backend (relatórios/CSV).
 * A interface tem os seus próprios em `lib/training/types.ts`; aqui ficam só
 * os necessários para não exportar código de banco em arquivo entregue ao
 * usuário.
 */
export const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Não iniciado',
  PENDING: 'Pendente',
  SCHEDULED: 'Programado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em andamento',
  AWAITING_ASSESSMENT: 'Aguardando avaliação',
  AWAITING_EFFECTIVENESS: 'Aguardando eficácia',
  AWAITING_VALIDATION: 'Aguardando validação',
  VALID: 'Válido',
  DUE_SOON: 'Próximo do vencimento',
  EXPIRED: 'Vencido',
  FAILED: 'Reprovado',
  ABSENT: 'Ausente',
  WAIVED: 'Dispensado',
  NOT_APPLICABLE: 'Não aplicável',
  SUPERSEDED: 'Substituído',
};

export const MODALITY_LABEL: Record<string, string> = {
  PRESENCIAL: 'Presencial',
  ONLINE: 'Online',
  HIBRIDO: 'Híbrido',
  LEITURA_ORIENTADA: 'Leitura orientada',
  DIALOGO_SEGURANCA: 'Diálogo de segurança',
  INTEGRACAO: 'Integração',
  PRATICO: 'Treinamento prático',
  EXTERNO: 'Treinamento externo',
  RECICLAGEM: 'Reciclagem',
  CIENCIA: 'Confirmação de ciência',
};
