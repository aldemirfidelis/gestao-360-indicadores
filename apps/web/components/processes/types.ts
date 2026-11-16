import type { RaciContent, SipocContent, ProcessIntegrationType } from '@g360/shared';

export type ArtifactKind = 'SIPOC' | 'BPMN' | 'RACI';
export type ArtifactState = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
export interface ArtifactSummary {
  id: string; processId: string; kind: ArtifactKind; name: string; scenario: 'AS_IS' | 'TO_BE';
  state: ArtifactState; revision: number; version: number; reviewDueAt: string | null; updatedAt: string;
}
export interface ProcessActivity {
  id: string; artifactId: string; elementId: string; elementType: string; name: string; description: string | null;
  orgNodeId: string | null; ownerUserId: string | null; orgJobId: string | null;
  expectedMinutes: number | null; slaMinutes: number | null; systems: string | null; active: boolean;
  artifact?: { name: string; scenario: string; state: ArtifactState; revision: number };
  raciRows?: Array<{ id: string; name: string; artifact: { id: string; name: string; state: ArtifactState }; assignments: Array<{ role: string; subjectSnapshot: { name: string } }> }>;
}
export interface Artifact extends ArtifactSummary {
  content: SipocContent | Record<string, unknown>; bpmnXml: string | null; raci: RaciContent | null;
  activities: ProcessActivity[];
  raciRows: Array<{ id: string; assignments: Array<{ subjectKey: string; subjectSnapshot: { name: string }; [key: string]: unknown }> }>;
  versions: Array<{ id: string; version: number; state: ArtifactState; changeNote: string; authorName: string; createdAt: string }>;
  validation: { errors: string[]; warnings: string[] };
}
export interface RelatedTarget { id: string; type: ProcessIntegrationType; name: string; href: string; status: string | null; result?: { periodRef: string; value: number; light: string; attainment: number | null } | null }
export interface Subject { id: string; name: string; subjectType: 'USER' | 'AREA' | 'JOB' }
export interface ProcessContext {
  process: {
    id: string; name: string; objective: string | null; description: string | null; status: string; orgNodeId: string | null; ownerUserId: string | null; indicatorId: string | null;
    orgNode: { id: string; name: string } | null; owner: { id: string; name: string } | null;
    steps: Array<{ id: string; name: string; description: string | null; order?: number; responsible?: string | null }>;
    code?: string | null; type?: string; version?: string | null;
    suppliers?: string | null; inputs?: string | null; outputs?: string | null; customers?: string | null;
    indicator?: { id: string; name: string; code: string | null } | null;
  };
  artifacts: ArtifactSummary[]; activities: ProcessActivity[];
  integrations: Array<{ id: string; type: ProcessIntegrationType; label: string | null; activityId: string | null; artifactId?: string | null; target: RelatedTarget }>;
  hiddenIntegrations: number;
  metrics: { withoutOwner: number; inReview: number; overdueReview: number; indicatorsOffTarget: number };
  history: Array<{ id: string; title: string; description: string | null; occurredAt: string }>;
}
export const STATE_LABEL: Record<ArtifactState, string> = { DRAFT: 'Rascunho', IN_REVIEW: 'Em revisão', APPROVED: 'Aprovado', PUBLISHED: 'Publicado', ARCHIVED: 'Arquivado' };
export const TARGET_LABEL: Record<ProcessIntegrationType, string> = { INDICATOR: 'Indicador', PROJECT: 'Projeto', PROJECT_TASK: 'Tarefa de projeto', TASK: 'Tarefa', ACTION: 'Plano de ação', DEVIATION: 'Desvio', DOCUMENT: 'Documento', FORM: 'Formulário', RISK: 'Risco', AUDIT: 'Auditoria', TRAINING: 'Treinamento', MEETING: 'Reunião', OBJECTIVE: 'Objetivo estratégico', PROCESS: 'Processo', AREA: 'Área' };
