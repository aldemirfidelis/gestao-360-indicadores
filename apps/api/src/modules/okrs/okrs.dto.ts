import { z } from 'zod';

/** Validação Zod dos endpoints de escrita de OKRs (Fase 2 do hardening). */

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida');
const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullish();
const id = z.string().trim().min(1).max(64);

export const okrCycleCreateSchema = z.object({
  name: shortText(120),
  startsAt: isoDate,
  endsAt: isoDate,
});

export const okrCycleUpdateSchema = z.object({
  name: shortText(120).optional(),
  startsAt: isoDate.optional(),
  endsAt: isoDate.optional(),
  active: z.boolean().optional(),
});

export const okrObjectiveCreateSchema = z.object({
  name: shortText(240),
  description: optionalText(4000),
  ownerName: optionalText(160),
  team: optionalText(160),
  ownerNodeId: id.nullish(),
  ownerUserId: id.nullish(),
  weight: z.number().min(0).max(1000).optional(),
  strategicObjId: id.nullish(),
  parentId: id.nullish(),
});

export const okrObjectiveUpdateSchema = okrObjectiveCreateSchema
  .partial()
  .extend({
    status: z.enum(['PLANNED', 'ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'DONE', 'CANCELLED']).optional(),
    confidence: z.number().min(0).max(1).optional(),
  });

export const okrKeyResultCreateSchema = z.object({
  metric: shortText(240),
  unit: z
    .enum(['PERCENT', 'CURRENCY', 'QUANTITY', 'HOURS', 'DAYS', 'TONS', 'LITERS', 'INDEX', 'TEXT', 'CUSTOM'])
    .optional(),
  startValue: z.number().finite(),
  currentValue: z.number().finite(),
  targetValue: z.number().finite(),
  direction: z.enum(['HIGHER_BETTER', 'LOWER_BETTER', 'EQUAL_TARGET', 'RANGE']).optional(),
  weight: z.number().min(0).max(1000).optional(),
  responsible: optionalText(160),
  indicatorId: id.nullish(),
});

export const okrKeyResultUpdateSchema = okrKeyResultCreateSchema.partial();

export const okrCheckinSchema = z.object({
  weekRef: shortText(16),
  confidence: z.number().min(0).max(1),
  progress: z.number().min(0).max(2),
  note: optionalText(2000),
});
