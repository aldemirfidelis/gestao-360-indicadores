import { z } from 'zod';

/** Validação Zod dos endpoints de escrita de Desvios (Fase 2 do hardening). */

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida');
const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullish();
const id = z.string().trim().min(1).max(64);

const severity = z.enum(['LOW', 'MODERATE', 'CRITICAL']);
const analysisMethod = z.enum(['FCA', 'FIVE_WHYS', 'ISHIKAWA', 'PARETO', 'PDCA', 'MASP', 'DMAIC', 'CAPA', 'SIMPLE']);

export const deviationOpenSchema = z.object({
  indicatorId: id,
  periodRef: z.string().trim().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'periodRef inválido (AAAA-MM)'),
  title: optionalText(240),
  severity: severity.optional(),
  responsibleUserId: id.nullish(),
  dueDate: isoDate.nullish(),
  method: analysisMethod.optional(),
  fact: optionalText(8000),
  immediateAction: optionalText(8000),
});

export const deviationUpdateSchema = z
  .object({
    title: shortText(240),
    severity,
    status: z.enum(['OPEN', 'IN_ANALYSIS', 'WAITING_ACTION', 'IN_PROGRESS', 'CLOSED', 'CLOSED_LATE', 'CANCELLED']),
    responsibleUserId: id.nullable(),
    dueDate: isoDate.nullable(),
    method: analysisMethod,
    fact: z.string().trim().max(8000).nullable(),
    impact: z.string().trim().max(8000).nullable(),
    immediateAction: z.string().trim().max(8000).nullable(),
    noImmediateAction: z.boolean(),
    // rootCause fora de propósito: a causa raiz consolidada é preenchida pela
    // ANÁLISE (saveAnalysis), nunca por PATCH direto — regra do fluxo de desvio.
  })
  .partial();

export const deviationCauseSchema = z.object({
  description: shortText(2000),
  category: optionalText(120),
  weight: z.number().min(0).max(100).optional(),
});

export const deviationAnalysisSchema = z.object({
  method: analysisMethod,
  content: shortText(100_000),
});

export const deviationActionSchema = z.object({
  title: shortText(240),
  description: optionalText(8000),
  responsibleUserId: id.nullish(),
  ownerNodeId: id.nullish(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dueDate: isoDate.nullish(),
  estimatedCost: z.number().min(0).finite().nullish(),
  expectedResult: optionalText(4000),
});
