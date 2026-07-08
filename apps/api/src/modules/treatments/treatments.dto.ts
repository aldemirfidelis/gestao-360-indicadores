import { z } from 'zod';

/** Validação Zod dos endpoints de escrita de Tratativas (Fase 2 do hardening). */

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida');
const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullish();
const id = z.string().trim().min(1).max(64);

export const treatmentIgnoreSchema = z.object({
  reason: shortText(2000),
});

export const treatmentAnalysisSchema = z.object({
  problem: shortText(4000),
  probableCause: optionalText(4000),
  rootCause: shortText(4000),
  method: z.enum(['FCA', 'FIVE_WHYS', 'ISHIKAWA', 'PARETO', 'PDCA', 'MASP', 'DMAIC', 'CAPA', 'SIMPLE']),
  evidence: optionalText(8000),
  observations: optionalText(8000),
  dueDate: isoDate.nullish(),
});

export const treatmentMeetingSchema = z.object({
  title: optionalText(240),
  startsAt: isoDate,
  endsAt: isoDate.nullish(),
  location: optionalText(240),
  format: z.enum(['PRESENTIAL', 'ONLINE', 'HYBRID']).optional(),
  objective: optionalText(4000),
  notes: optionalText(8000),
  participants: z
    .array(
      z.object({
        userId: id.nullish(),
        name: optionalText(160),
        email: z.string().trim().email().max(160).nullish().or(z.literal('').transform(() => null)),
        jobTitle: optionalText(160),
        area: optionalText(160),
        role: z.enum(['RESPONSIBLE', 'PARTICIPANT', 'APPROVER', 'EXECUTOR', 'GUEST']).optional(),
        notes: optionalText(2000),
      }),
    )
    .max(100)
    .optional(),
});

export const treatmentActionSchema = z.object({
  title: shortText(240),
  description: optionalText(8000),
  responsibleUserId: id.nullish(),
  responsibleEmail: z.string().trim().email().max(160).nullish().or(z.literal('').transform(() => null)),
  ownerNodeId: id.nullish(),
  startDate: isoDate.nullish(),
  dueDate: isoDate.nullish(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  evidenceRequired: z.boolean().optional(),
  expectedResult: optionalText(4000),
  observations: optionalText(8000),
});
