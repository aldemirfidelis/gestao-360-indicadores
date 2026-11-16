import { z } from 'zod';

const text = z.string().trim().max(4000).default('');
const name = z.string().trim().min(1).max(240);
const id = z.string().uuid();
const optionalId = id.nullish();
const ids = z.array(id).max(100).default([]);
const item = { id: id, name, description: text };
const party = z.object({
  ...item, type: z.enum(['INTERNAL', 'EXTERNAL']), orgNodeId: optionalId,
  relatedProcessId: optionalId, participation: text, needs: text,
  expectedResult: text, acceptanceCriteria: text,
}).strict();

export const sipocSchema = z.object({
  suppliers: z.array(party).max(100).default([]),
  inputs: z.array(z.object({ ...item, origin: text, requirements: text, qualityCriteria: text, documentIds: ids, formTemplateIds: ids }).strict()).max(100).default([]),
  steps: z.array(z.object({ ...item, processStepId: optionalId }).strict()).max(100).default([]),
  outputs: z.array(z.object({ ...item, acceptanceCriteria: text, indicatorIds: ids, documentIds: ids }).strict()).max(100).default([]),
  customers: z.array(party).max(100).default([]),
}).strict();
export type SipocContent = z.infer<typeof sipocSchema>;

export const integrationTypes = ['INDICATOR', 'PROJECT', 'PROJECT_TASK', 'TASK', 'ACTION', 'DEVIATION', 'DOCUMENT', 'FORM', 'RISK', 'AUDIT', 'TRAINING', 'MEETING', 'OBJECTIVE', 'PROCESS', 'AREA'] as const;
export type ProcessIntegrationType = typeof integrationTypes[number];
export const integrationSchema = z.object({
  type: z.enum(integrationTypes), targetId: id, activityId: optionalId,
  label: z.string().trim().max(240).optional(),
}).strict();

export const raciAssignmentSchema = z.object({
  subjectType: z.enum(['USER', 'AREA', 'JOB']), subjectId: id,
  roles: z.array(z.enum(['R', 'A', 'C', 'I'])).min(1).max(4),
}).strict();
export const raciRowSchema = z.object({
  id, name,
  targetType: z.enum(['ACTIVITY', 'STEP', 'PROJECT_TASK', 'TASK', 'ACTION']).nullish(),
  targetId: optionalId,
  assignments: z.array(raciAssignmentSchema).max(100),
}).strict().refine((row) => Boolean(row.targetType) === Boolean(row.targetId), 'Selecione o tipo e o registro relacionado.');
export const raciSchema = z.object({ rows: z.array(raciRowSchema).max(200) }).strict();
export type RaciContent = z.infer<typeof raciSchema>;

export function raciConsistency(content: RaciContent) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!content.rows.length) errors.push('Inclua ao menos uma atividade na matriz.');
  const rowIds = new Set<string>();
  for (const row of content.rows) {
    if (rowIds.has(row.id)) errors.push(`Atividade repetida: ${row.name}.`);
    rowIds.add(row.id);
    const subjects = new Set<string>();
    let responsible = 0;
    let accountable = 0;
    for (const assignment of row.assignments) {
      const key = `${assignment.subjectType}:${assignment.subjectId}`;
      if (subjects.has(key)) errors.push(`${row.name}: participante repetido.`);
      subjects.add(key);
      if (new Set(assignment.roles).size !== assignment.roles.length) errors.push(`${row.name}: papel repetido.`);
      if (assignment.roles.includes('R')) responsible++;
      if (assignment.roles.includes('A')) accountable++;
      if (assignment.roles.includes('C') && assignment.roles.includes('I')) warnings.push(`${row.name}: o mesmo participante está como consultado e informado.`);
    }
    if (!responsible) errors.push(`${row.name}: defina ao menos um responsável pela execução (R).`);
    if (accountable !== 1) errors.push(`${row.name}: defina exatamente um responsável final (A).`);
  }
  return { errors, warnings };
}

export const artifactCreateSchema = z.object({
  kind: z.enum(['SIPOC', 'BPMN', 'RACI']), name,
  scenario: z.enum(['AS_IS', 'TO_BE']).default('AS_IS'), basedOnId: optionalId,
}).strict();
export const artifactSaveSchema = z.object({
  revision: z.number().int().positive(), name: name.optional(),
  content: z.unknown().optional(), bpmnXml: z.string().max(2_000_000).optional(),
  reviewDueAt: z.string().datetime().nullish(), changeNote: z.string().trim().min(1).max(2000),
}).strict();
export const artifactTransitionSchema = z.object({
  revision: z.number().int().positive(),
  action: z.enum(['SUBMIT', 'APPROVE', 'PUBLISH', 'REVISE', 'ARCHIVE']),
  changeNote: z.string().trim().min(1).max(2000),
}).strict();
export const activitySaveSchema = z.object({
  revision: z.number().int().positive(), description: text,
  orgNodeId: optionalId, ownerUserId: optionalId, orgJobId: optionalId,
  expectedMinutes: z.number().int().min(0).max(5_256_000).nullish(),
  slaMinutes: z.number().int().min(0).max(5_256_000).nullish(), systems: text,
}).strict();

/** Compara versões por identificadores BPMN estáveis, não por coordenadas da tela. */
export function compareProcessActivities(before: Array<{ elementId: string; [key: string]: unknown }>, after: Array<{ elementId: string; [key: string]: unknown }>) {
  const left = new Map(before.map((activity) => [activity.elementId, activity]));
  const right = new Map(after.map((activity) => [activity.elementId, activity]));
  const signature = (activity: Record<string, unknown>) => JSON.stringify(Object.fromEntries(
    Object.entries(activity).filter(([key]) => !['id', 'artifactId', 'updatedAt', 'active', 'raciRows'].includes(key)).sort(([a], [b]) => a.localeCompare(b)),
  ));
  return {
    added: after.filter((activity) => !left.has(activity.elementId)),
    removed: before.filter((activity) => !right.has(activity.elementId)),
    modified: after.filter((activity) => left.has(activity.elementId) && signature(left.get(activity.elementId)!) !== signature(activity)),
  };
}
