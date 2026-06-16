/**
 * Tipos do módulo Segurança Patrimonial e Portarias (`/seguranca-patrimonial`).
 * Refletem o retorno dos endpoints `/asset-security/*` (ver
 * `apps/api/src/modules/asset-security/asset-security.service.ts`).
 * Mantidos propositalmente tolerantes (campos opcionais) porque o backend
 * decora registros com relações resolvidas em runtime.
 */

export type AnyRecord = Record<string, any>;

/** KPIs consolidados de `GET /asset-security/summary`. */
export interface SecuritySummary {
  gates: number;
  posts: number;
  peoplePresent: number;
  vehiclesPresent: number;
  todayEntries: number;
  todayExits: number;
  pendingExits: number;
  overduePresence: number;
  expiredOrInvalidDocuments: number;
  authorizationsPending: number;
  openIncidents: number;
  criticalIncidents: number;
  lateRounds: number;
  custodyPending: number;
  correspondenceWaiting: number;
  offlinePending: number;
  activeBlocklistItems: number;
  generatedAt: string;
}

/** Opções e catálogos de `GET /asset-security/options`. */
export interface SecurityOptions {
  branches: AnyRecord[];
  orgNodes: AnyRecord[];
  users: AnyRecord[];
  gates: AnyRecord[];
  posts: AnyRecord[];
  people: AnyRecord[];
  contractorCompanies: AnyRecord[];
  vehicles: AnyRecord[];
  roundRoutes: AnyRecord[];
  formTemplates: AnyRecord[];
  packageFeatures: string[];
  packageStatuses: string[];
  recordStatuses: string[];
  personTypes: string[];
  documentStatuses: string[];
  authorizationStatuses: string[];
  movementTypes: string[];
  movementStatuses: string[];
  incidentSeverities: string[];
  incidentStatuses: string[];
  roundStatuses: string[];
  handoverStatuses: string[];
  custodyTypes: string[];
  custodyStatuses: string[];
  qrStatuses: string[];
  offlineStatuses: string[];
  gateTypes: string[];
  vehicleTypes: string[];
}

/** Movimentação de acesso decorada (`present`, `pending-exits`, `movements`). */
export interface SecurityMovement {
  id: string;
  code?: string | null;
  movementType: string;
  category?: string | null;
  status: string;
  overdue?: boolean;
  entryAt?: string | null;
  exitAt?: string | null;
  expectedExitAt?: string | null;
  durationMinutes?: number | null;
  maxStayMinutes?: number | null;
  plate?: string | null;
  reason?: string | null;
  originCompanyName?: string | null;
  person?: AnyRecord | null;
  driver?: AnyRecord | null;
  vehicle?: AnyRecord | null;
  gate?: AnyRecord | null;
  post?: AnyRecord | null;
  contractorCompany?: AnyRecord | null;
}

/** Relatório de emergência/evacuação (`GET /asset-security/emergency-report`). */
export interface EmergencyReport {
  generatedAt: string;
  lastOfflineSyncAt: string | null;
  totalPeople: number;
  totalVehicles: number;
  people: SecurityMovement[];
  evacuation: { enabled: boolean; fields: string[] };
}

export interface AssistantInsight {
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  humanDecisionRequired: boolean;
}

export interface AssistantInsightsResponse {
  generatedAt: string;
  summary: SecuritySummary;
  insights: AssistantInsight[];
  samples: AnyRecord;
}
