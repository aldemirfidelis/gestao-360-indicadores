export interface ScreeningQuestionLike {
  id: string;
  type: string;
  question: string;
  required?: boolean | null;
  knockout?: boolean | null;
  desiredAnswer?: unknown;
  weight?: number | null;
}

export interface ScreeningAnswerLike {
  questionId: string;
  answer: unknown;
}

export interface ScreeningResult {
  requiredMissing: string[];
  knockoutFailed: string[];
  passedByQuestion: Record<string, boolean | null>;
  score: number | null;
}

export function evaluateScreening(questions: ScreeningQuestionLike[], answers: ScreeningAnswerLike[]): ScreeningResult {
  const byQuestion = new Map(answers.map((item) => [item.questionId, item.answer]));
  const requiredMissing: string[] = [];
  const knockoutFailed: string[] = [];
  const passedByQuestion: Record<string, boolean | null> = {};
  let weighted = 0;
  let weightTotal = 0;

  for (const q of questions) {
    const answer = byQuestion.get(q.id);
    if (q.required && isEmptyAnswer(answer)) requiredMissing.push(q.id);
    const passed = answerPasses(q.type, answer, q.desiredAnswer);
    passedByQuestion[q.id] = passed;
    if (q.knockout && passed === false) knockoutFailed.push(q.id);
    const weight = Math.max(0, Math.round(Number(q.weight ?? 0)));
    if (weight > 0 && passed !== null) {
      weighted += passed ? weight : 0;
      weightTotal += weight;
    }
  }

  return {
    requiredMissing,
    knockoutFailed,
    passedByQuestion,
    score: weightTotal > 0 ? Math.round((weighted / weightTotal) * 100) : null,
  };
}

export function answerPasses(type: string, answer: unknown, desired: unknown): boolean | null {
  if (desired === undefined || desired === null || desired === '') return null;
  if (isEmptyAnswer(answer)) return false;
  const kind = String(type || 'TEXT').toUpperCase();
  if (kind === 'YES_NO') return Boolean(answer) === Boolean(desired);
  if (kind === 'NUMBER') {
    const a = Number(answer);
    if (!Number.isFinite(a)) return false;
    if (typeof desired === 'object' && desired && ('min' in desired || 'max' in desired)) {
      const range = desired as { min?: unknown; max?: unknown };
      const min = range.min == null ? -Infinity : Number(range.min);
      const max = range.max == null ? Infinity : Number(range.max);
      return a >= min && a <= max;
    }
    return a === Number(desired);
  }
  const desiredList = Array.isArray(desired) ? desired.map(normalizeText) : [normalizeText(desired)];
  const answerList = Array.isArray(answer) ? answer.map(normalizeText) : [normalizeText(answer)];
  if (kind === 'MULTI_CHOICE') return desiredList.every((item) => answerList.includes(item));
  return desiredList.includes(answerList[0]);
}

export function weightedAverage(items: Array<{ score: number; weight?: number | null }>): number | null {
  let total = 0;
  let weightTotal = 0;
  for (const item of items) {
    const score = Number(item.score);
    const weight = Math.max(1, Math.round(Number(item.weight ?? 1)));
    if (!Number.isFinite(score)) continue;
    total += score * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? Math.round((total / weightTotal) * 10) / 10 : null;
}

export interface FallbackTriageInput {
  vacancyTitle: string;
  requirements?: string | null;
  candidateText?: string | null;
  criteria?: Array<{ name: string; description?: string | null }>;
  screening?: ScreeningResult | null;
}

export function fallbackTriage(input: FallbackTriageInput) {
  const haystack = normalizeText(input.candidateText ?? '');
  const terms = extractRequirementTerms(`${input.requirements ?? ''} ${(input.criteria ?? []).map((c) => `${c.name} ${c.description ?? ''}`).join(' ')}`);
  const found = terms.filter((term) => haystack.includes(term));
  const missing = terms.filter((term) => !haystack.includes(term)).slice(0, 12);
  const coverage = terms.length ? found.length / terms.length : 0;
  const screeningPenalty = input.screening?.knockoutFailed.length ? 0.25 : input.screening?.requiredMissing.length ? 0.1 : 0;
  const confidence = Math.max(0.15, Math.min(0.85, coverage - screeningPenalty));
  return {
    summary: `Analise deterministica para ${input.vacancyTitle}: ${found.length}/${terms.length || 0} requisito(s) objetivo(s) encontrados no material do candidato. Revisao humana obrigatoria.`,
    criteria: terms.map((term) => ({ term, found: found.includes(term) })),
    evidence: found.map((term) => ({ term, source: 'candidate_text' })),
    missingRequirements: missing.map((term) => ({ term, reason: 'Nao encontrado no texto analisado.' })),
    risks: [
      ...(input.screening?.requiredMissing ?? []).map((questionId) => ({ kind: 'REQUIRED_MISSING', questionId })),
      ...(input.screening?.knockoutFailed ?? []).map((questionId) => ({ kind: 'KNOCKOUT_FAILED', questionId })),
    ],
    confidence: Math.round(confidence * 100) / 100,
  };
}

export function extractRequirementTerms(text: string): string[] {
  const words = normalizeText(text)
    .split(/[^a-z0-9+#.]+/g)
    .filter((word) => word.length >= 4 || SHORT_TECH_TERMS.has(word))
    .filter((word) => !STOP_WORDS.has(word));
  return [...new Set(words)].slice(0, 30);
}

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isEmptyAnswer(answer: unknown): boolean {
  if (answer === null || answer === undefined) return true;
  if (typeof answer === 'string') return answer.trim() === '';
  if (Array.isArray(answer)) return answer.length === 0;
  return false;
}

const STOP_WORDS = new Set([
  'para', 'como', 'com', 'sem', 'entre', 'sobre', 'pela', 'pelo', 'anos', 'ano',
  'experiencia', 'conhecimento', 'desejavel', 'obrigatorio', 'obrigatoria',
  'atividade', 'atividades', 'requisito', 'requisitos', 'vaga', 'area',
]);

const SHORT_TECH_TERMS = new Set(['sql', 'bi', 'rh', 'dp', 'c#', 'c++', 'go', 'ux', 'ui', 'qa']);
