import { z } from 'zod';
import {
  ActionOrigin,
  ActionPriority,
  ActionStatus,
  ActionAnalysisTool,
  Direction,
  FeedKind,
  IndicatorStatus,
  IndicatorType,
  IndicatorUnit,
  OrgNodeType,
  Periodicity,
  UserRole,
} from './enums';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const orgNodeCreateSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  companyId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(160),
  code: z.string().max(40).optional().nullable(),
  type: z.nativeEnum(OrgNodeType),
  responsibleUserId: z.string().uuid().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  icon: z.string().max(40).optional().nullable(),
  active: z.boolean().optional().default(true),
});
export type OrgNodeCreateInput = z.infer<typeof orgNodeCreateSchema>;

export const indicatorCreateSchema = z.object({
  companyId: z.string().uuid(),
  ownerNodeId: z.string().uuid(),
  responsibleUserId: z.string().uuid().optional().nullable(),
  feederUserId: z.string().uuid().optional().nullable(),
  name: z.string().min(2).max(160),
  code: z.string().max(40).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  type: z.nativeEnum(IndicatorType),
  category: z.string().max(80).optional().nullable(),
  unit: z.nativeEnum(IndicatorUnit),
  unitLabel: z.string().max(40).optional().nullable(),
  periodicity: z.nativeEnum(Periodicity),
  direction: z.nativeEnum(Direction),
  formula: z.string().max(2000).optional().nullable(),
  source: z.string().max(200).optional().nullable(),
  feedKind: z.nativeEnum(FeedKind).default(FeedKind.MANUAL),
  status: z.nativeEnum(IndicatorStatus).default(IndicatorStatus.ACTIVE),
  weight: z.number().min(0).max(100).default(1),
});
export type IndicatorCreateInput = z.infer<typeof indicatorCreateSchema>;

export const indicatorTargetUpsertSchema = z.object({
  indicatorId: z.string().uuid(),
  periodRef: z.string().min(4).max(10), // YYYY ou YYYY-MM ou YYYY-MM-DD
  target: z.number(),
  lowerBound: z.number().optional().nullable(),
  upperBound: z.number().optional().nullable(),
  weight: z.number().min(0).max(100).default(1),
});
export type IndicatorTargetUpsertInput = z.infer<typeof indicatorTargetUpsertSchema>;

export const indicatorResultUpsertSchema = z.object({
  indicatorId: z.string().uuid(),
  periodRef: z.string().min(4).max(10),
  value: z.number(),
  note: z.string().max(2000).optional().nullable(),
});
export type IndicatorResultUpsertInput = z.infer<typeof indicatorResultUpsertSchema>;

export const actionCreateSchema = z.object({
  companyId: z.string().uuid().optional(),
  title: z.string().min(2).max(200),
  description: z.string().max(4000).optional().nullable(),
  problemDescription: z.string().max(4000).optional().nullable(),
  origin: z.nativeEnum(ActionOrigin).default(ActionOrigin.MANUAL),
  originRefId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  strategicObjectiveId: z.string().uuid().optional().nullable(),
  okrObjectiveId: z.string().uuid().optional().nullable(),
  indicatorId: z.string().uuid().optional().nullable(),
  indicatorResultId: z.string().uuid().optional().nullable(),
  deviationId: z.string().uuid().optional().nullable(),
  analysisId: z.string().uuid().optional().nullable(),
  meetingId: z.string().uuid().optional().nullable(),
  treatmentId: z.string().uuid().optional().nullable(),
  analysisTool: z.nativeEnum(ActionAnalysisTool).optional().nullable(),
  rootCause: z.string().max(4000).optional().nullable(),
  responsibleUserId: z.string().uuid().optional().nullable(),
  ownerNodeId: z.string().uuid().optional().nullable(),
  priority: z.nativeEnum(ActionPriority).default(ActionPriority.MEDIUM),
  criticality: z.nativeEnum(ActionPriority).default(ActionPriority.MEDIUM),
  status: z.nativeEnum(ActionStatus).default(ActionStatus.NOT_STARTED),
  startDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  estimatedCost: z.number().nonnegative().optional().nullable(),
  expectedResult: z.string().max(4000).optional().nullable(),
  achievedResult: z.string().max(4000).optional().nullable(),
  evidenceRequired: z.boolean().optional(),
});
export type ActionCreateInput = z.infer<typeof actionCreateSchema>;

export const userCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(64),
  name: z.string().min(2).max(120),
  role: z.nativeEnum(UserRole).default(UserRole.COLLABORATOR),
  companyId: z.string().uuid(),
  branchId: z.string().uuid().optional().nullable(),
  accessProfileId: z.string().uuid().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING']).optional().default('ACTIVE'),
  active: z.boolean().optional(),
  passwordResetRequired: z.boolean().optional(),
  jobTitle: z.string().max(80).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  defaultNodeId: z.string().uuid().optional().nullable(),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

// ---------------------------------------------------------------------------
// Schemas "leves" de escrita (auditoria 2026-07): garantem corpo objeto,
// campo-chave presente e limite de tamanho, deixando a validação semântica
// (vínculos, enums, permissões) para o service. `.passthrough()` preserva os
// payloads atuais do frontend — o objetivo é 400 claro em vez de 500.
// ---------------------------------------------------------------------------

const requiredTrimmed = (max: number) =>
  z.preprocess((value) => (typeof value === 'string' ? value.trim() : value), z.string().min(1).max(max));

/** Criação de registros identificados por `title` (documentos, NC, riscos, formulários...). */
export const titledCreateSchema = z.object({ title: requiredTrimmed(300) }).passthrough();
/** Atualização parcial: `title`, se presente, não pode ser vazio. */
export const titledUpdateSchema = z.object({ title: requiredTrimmed(300).optional() }).passthrough();

/** Criação de registros identificados por `name` (indicadores...). */
export const namedCreateSchema = z.object({ name: requiredTrimmed(200) }).passthrough();
export const namedUpdateSchema = z.object({ name: requiredTrimmed(200).optional() }).passthrough();

/** Preenchimento de formulário: respostas, quando enviadas, devem ser uma lista. */
export const formSubmissionWriteSchema = z
  .object({ answers: z.array(z.any()).optional().nullable() })
  .passthrough();
