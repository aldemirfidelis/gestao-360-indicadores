/**
 * Recrutamento (F2) — lógica pura da vaga/pipeline: slug, etapas padrão do
 * pipeline e projeção PÚBLICA segura (nunca expõe orçamento, centro de custo,
 * aprovadores, notas, salário interno etc.).
 */

/** Gera um slug estável a partir de um texto. */
export function slugify(text: string): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'vaga';
}

export interface PipelineStageSeed {
  order: number;
  name: string;
  type: 'STANDARD' | 'ELIMINATORY' | 'INTERVIEW' | 'ASSESSMENT' | 'OFFER' | 'PREHIRE' | 'FINAL';
}

/** Etapas padrão de um pipeline de seleção (base configurável). */
export const DEFAULT_PIPELINE_STAGES: PipelineStageSeed[] = [
  { order: 1, name: 'Candidatura recebida', type: 'STANDARD' },
  { order: 2, name: 'Triagem curricular', type: 'STANDARD' },
  { order: 3, name: 'Perguntas eliminatórias', type: 'ELIMINATORY' },
  { order: 4, name: 'Entrevista com RH', type: 'INTERVIEW' },
  { order: 5, name: 'Teste/avaliação', type: 'ASSESSMENT' },
  { order: 6, name: 'Entrevista com gestor', type: 'INTERVIEW' },
  { order: 7, name: 'Avaliação final', type: 'FINAL' },
  { order: 8, name: 'Proposta', type: 'OFFER' },
  { order: 9, name: 'Pré-admissão', type: 'PREHIRE' },
  { order: 10, name: 'Contratado', type: 'FINAL' },
];

export interface PostingLike {
  id: string;
  slug: string;
  title: string;
  publicDescription: string | null;
  publicRequirements: string | null;
  benefitsText: string | null;
  processStepsText: string | null;
  location: string | null;
  city: string | null;
  workMode: string | null;
  contractType: string | null;
  areaName: string | null;
  visibility: string;
  pcd: boolean;
  showSalary: boolean;
  salaryText: string | null;
  status: string;
  publishedAt: Date | null;
  closesAt: Date | null;
}

/** Vaga está visível ao público externo? (publicada, visibilidade pública, não encerrada) */
export function isPubliclyVisible(posting: Pick<PostingLike, 'status' | 'visibility' | 'closesAt'>, now = new Date()): boolean {
  if (posting.status !== 'PUBLISHED') return false;
  if (!['PUBLIC', 'BOTH'].includes(posting.visibility)) return false;
  if (posting.closesAt && posting.closesAt.getTime() < now.getTime()) return false;
  return true;
}

/**
 * Projeta apenas os campos PÚBLICOS da vaga. Defesa em profundidade: mesmo que
 * a query traga colunas internas, nada sensível vaza para o portal.
 */
export function toPublicVacancy(posting: PostingLike) {
  return {
    slug: posting.slug,
    title: posting.title,
    description: posting.publicDescription,
    requirements: posting.publicRequirements,
    benefits: posting.benefitsText,
    processSteps: posting.processStepsText,
    location: posting.location,
    city: posting.city,
    workMode: posting.workMode,
    contractType: posting.contractType,
    area: posting.areaName,
    pcd: posting.pcd,
    salary: posting.showSalary ? posting.salaryText : null,
    publishedAt: posting.publishedAt,
    closesAt: posting.closesAt,
    closed: !isPubliclyVisible(posting),
  };
}
