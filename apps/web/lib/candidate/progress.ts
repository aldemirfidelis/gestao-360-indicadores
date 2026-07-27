/**
 * O que o candidato precisa fazer agora, e quanto do perfil já preencheu.
 *
 * A tela inicial do portal existe para responder "e agora?". Em vez de mostrar
 * seis painéis abertos ao mesmo tempo, ela lista ações derivadas dos dados
 * reais — proposta esperando resposta, documento reprovado, exame agendado.
 */

import type { PortalData, Profile } from './types';

export type NextStepTone = 'action' | 'warning' | 'info';

export interface NextStep {
  id: string;
  title: string;
  description: string;
  tone: NextStepTone;
  /** Aba do portal onde a ação é resolvida. */
  target: 'candidaturas' | 'perfil' | 'documentos';
}

export interface ProfileCompletion {
  percent: number;
  filled: number;
  total: number;
  missing: string[];
}

const PROFILE_FIELDS: Array<{ label: string; get: (p: Profile) => unknown }> = [
  { label: 'Telefone', get: (p) => p.phone },
  { label: 'Cidade', get: (p) => p.city },
  { label: 'Título profissional', get: (p) => p.headline },
  { label: 'Sobre você', get: (p) => p.profileData?.about },
  { label: 'Habilidades', get: (p) => p.profileData?.skills?.length },
  { label: 'Experiências', get: (p) => p.profileData?.experiences?.length },
  { label: 'Formação', get: (p) => p.profileData?.education?.length },
  { label: 'Disponibilidade para iniciar', get: (p) => p.profileData?.availabilityToStart },
];

/**
 * Percentual de preenchimento do perfil.
 *
 * Só entram campos que ajudam a triagem: e-mail e nome são obrigatórios no
 * cadastro, então contá-los daria 25% "de graça" e o número perderia sentido.
 */
export function profileCompletion(profile: Profile | null): ProfileCompletion {
  if (!profile) return { percent: 0, filled: 0, total: PROFILE_FIELDS.length, missing: [] };
  const missing: string[] = [];
  let filled = 0;
  for (const field of PROFILE_FIELDS) {
    if (isFilled(field.get(profile))) filled += 1;
    else missing.push(field.label);
  }
  return {
    percent: Math.round((filled / PROFILE_FIELDS.length) * 100),
    filled,
    total: PROFILE_FIELDS.length,
    missing,
  };
}

function isFilled(value: unknown): boolean {
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return Boolean(value);
}

/** Ações pendentes, da mais urgente para a menos. */
export function nextSteps(data: PortalData): NextStep[] {
  const steps: NextStep[] = [];

  // 1. Proposta aguardando resposta: tem prazo e destrava a contratação.
  for (const offer of data.offers) {
    if (offer.status !== 'SENT') continue;
    steps.push({
      id: `offer-${offer.id}`,
      title: `Responda à proposta de ${offer.application.posting.title}`,
      description: offer.expiresAt
        ? `A empresa aguarda sua decisão até ${formatDay(offer.expiresAt)}.`
        : 'A empresa aguarda sua decisão.',
      tone: 'action',
      target: 'candidaturas',
    });
  }

  // 2. Documento de pré-admissão reprovado ou ainda não enviado.
  for (const pre of data.preAdmissions) {
    const rejected = pre.documents.filter((doc) => doc.status === 'REJECTED');
    const pending = pre.documents.filter((doc) => doc.status === 'PENDING' && doc.required);
    if (rejected.length > 0) {
      steps.push({
        id: `pre-rejected-${pre.id}`,
        title: `Reenvie ${countLabel(rejected.length, 'documento', 'documentos')} da admissão`,
        description: `${rejected.map((doc) => doc.title).join(', ')} — a empresa pediu correção.`,
        tone: 'warning',
        target: 'candidaturas',
      });
    }
    if (pending.length > 0) {
      steps.push({
        id: `pre-pending-${pre.id}`,
        title: `Envie ${countLabel(pending.length, 'documento obrigatório', 'documentos obrigatórios')}`,
        description: `${pending.map((doc) => doc.title).join(', ')} para ${pre.application.posting.title}.`,
        tone: 'action',
        target: 'candidaturas',
      });
    }

    // 3. Exame admissional marcado: é compromisso com hora e lugar.
    for (const exam of pre.occupationalExamRequests ?? []) {
      if (!exam.appointment || exam.asoRecord) continue;
      steps.push({
        id: `exam-${exam.id}`,
        title: 'Exame admissional agendado',
        description: `${formatDayTime(exam.appointment.scheduledAt)}${exam.appointment.location ? ` · ${exam.appointment.location}` : ''}`,
        tone: 'info',
        target: 'candidaturas',
      });
    }
  }

  // 4. Sem currículo: trava a triagem de qualquer candidatura.
  if (!data.documents.some((doc) => doc.kind === 'CV')) {
    steps.push({
      id: 'missing-cv',
      title: 'Envie seu currículo',
      description: 'As empresas usam o currículo na primeira triagem.',
      tone: 'warning',
      target: 'documentos',
    });
  }

  // 5. Perfil incompleto — só vira ação quando falta bastante.
  const completion = profileCompletion(data.profile);
  if (data.profile && completion.percent < 70) {
    steps.push({
      id: 'profile-incomplete',
      title: 'Complete seu perfil',
      description: `Falta preencher: ${completion.missing.slice(0, 3).join(', ')}.`,
      tone: 'info',
      target: 'perfil',
    });
  }

  return steps;
}

/** Contadores do cabeçalho e dos marcadores das abas. */
export function portalCounters(data: PortalData) {
  const activeApplications = data.applications.filter((app) => app.status === 'ACTIVE').length;
  const openOffers = data.offers.filter((offer) => offer.status === 'SENT').length;
  const pendingDocuments = data.preAdmissions.reduce(
    (total, pre) => total + pre.documents.filter((doc) => doc.status === 'REJECTED' || (doc.status === 'PENDING' && doc.required)).length,
    0,
  );
  return {
    activeApplications,
    openOffers,
    pendingDocuments,
    applicationsBadge: openOffers + pendingDocuments,
    documentsCount: data.documents.length,
    openDataRequests: data.dataRequests.filter((item) => item.status === 'OPEN').length,
  };
}

function countLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function formatDay(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR') : value;
}

function formatDayTime(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : value;
}
