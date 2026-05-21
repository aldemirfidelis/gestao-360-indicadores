/**
 * Enums espelhados do schema Prisma. Mantenha sincronizado com
 * apps/api/prisma/schema.prisma.
 */

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  DIRECTOR: 'DIRECTOR',
  MANAGER: 'MANAGER',
  ANALYST: 'ANALYST',
  COLLABORATOR: 'COLLABORATOR',
  VIEWER: 'VIEWER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const OrgNodeType = {
  COMPANY: 'COMPANY',
  BRANCH: 'BRANCH',
  DIRECTORATE: 'DIRECTORATE',
  MANAGEMENT: 'MANAGEMENT',
  COORDINATION: 'COORDINATION',
  SECTOR: 'SECTOR',
  AREA: 'AREA',
  PROCESS: 'PROCESS',
} as const;
export type OrgNodeType = (typeof OrgNodeType)[keyof typeof OrgNodeType];

export const IndicatorType = {
  STRATEGIC: 'STRATEGIC',
  TACTICAL: 'TACTICAL',
  OPERATIONAL: 'OPERATIONAL',
  PROJECT: 'PROJECT',
  PROCESS: 'PROCESS',
  SAFETY: 'SAFETY',
  QUALITY: 'QUALITY',
  HR: 'HR',
  FINANCE: 'FINANCE',
  PRODUCTION: 'PRODUCTION',
  MAINTENANCE: 'MAINTENANCE',
  PROCUREMENT: 'PROCUREMENT',
  COMMERCIAL: 'COMMERCIAL',
  CUSTOM: 'CUSTOM',
} as const;
export type IndicatorType = (typeof IndicatorType)[keyof typeof IndicatorType];

export const IndicatorUnit = {
  PERCENT: 'PERCENT',
  CURRENCY: 'CURRENCY',
  QUANTITY: 'QUANTITY',
  HOURS: 'HOURS',
  DAYS: 'DAYS',
  TONS: 'TONS',
  LITERS: 'LITERS',
  INDEX: 'INDEX',
  TEXT: 'TEXT',
  CUSTOM: 'CUSTOM',
} as const;
export type IndicatorUnit = (typeof IndicatorUnit)[keyof typeof IndicatorUnit];

export const Periodicity = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  SEMIANNUAL: 'SEMIANNUAL',
  ANNUAL: 'ANNUAL',
} as const;
export type Periodicity = (typeof Periodicity)[keyof typeof Periodicity];

export const Direction = {
  HIGHER_BETTER: 'HIGHER_BETTER',
  LOWER_BETTER: 'LOWER_BETTER',
  EQUAL_TARGET: 'EQUAL_TARGET',
  RANGE: 'RANGE',
} as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

export const FeedKind = {
  MANUAL: 'MANUAL',
  IMPORT: 'IMPORT',
  API: 'API',
  DATABASE: 'DATABASE',
  INTEGRATION: 'INTEGRATION',
} as const;
export type FeedKind = (typeof FeedKind)[keyof typeof FeedKind];

export const IndicatorStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  IN_REVIEW: 'IN_REVIEW',
} as const;
export type IndicatorStatus = (typeof IndicatorStatus)[keyof typeof IndicatorStatus];

export const ResultStatus = {
  PENDING: 'PENDING',
  FILLED: 'FILLED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REOPENED: 'REOPENED',
} as const;
export type ResultStatus = (typeof ResultStatus)[keyof typeof ResultStatus];

export const DeviationSeverity = {
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  CRITICAL: 'CRITICAL',
} as const;
export type DeviationSeverity = (typeof DeviationSeverity)[keyof typeof DeviationSeverity];

export const DeviationStatus = {
  OPEN: 'OPEN',
  IN_ANALYSIS: 'IN_ANALYSIS',
  WAITING_ACTION: 'WAITING_ACTION',
  IN_PROGRESS: 'IN_PROGRESS',
  CLOSED: 'CLOSED',
  CLOSED_LATE: 'CLOSED_LATE',
  CANCELLED: 'CANCELLED',
} as const;
export type DeviationStatus = (typeof DeviationStatus)[keyof typeof DeviationStatus];

export const AnalysisMethod = {
  FCA: 'FCA',
  FIVE_WHYS: 'FIVE_WHYS',
  ISHIKAWA: 'ISHIKAWA',
  PARETO: 'PARETO',
  PDCA: 'PDCA',
  MASP: 'MASP',
  DMAIC: 'DMAIC',
  CAPA: 'CAPA',
  SIMPLE: 'SIMPLE',
} as const;
export type AnalysisMethod = (typeof AnalysisMethod)[keyof typeof AnalysisMethod];

export const ActionStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_THIRD: 'WAITING_THIRD',
  PAUSED: 'PAUSED',
  DONE: 'DONE',
  DONE_LATE: 'DONE_LATE',
  CANCELLED: 'CANCELLED',
} as const;
export type ActionStatus = (typeof ActionStatus)[keyof typeof ActionStatus];

export const ActionPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type ActionPriority = (typeof ActionPriority)[keyof typeof ActionPriority];

export const ActionOrigin = {
  INDICATOR: 'INDICATOR',
  DEVIATION: 'DEVIATION',
  OBJECTIVE: 'OBJECTIVE',
  OKR: 'OKR',
  MEETING: 'MEETING',
  PROJECT: 'PROJECT',
  MANUAL: 'MANUAL',
} as const;
export type ActionOrigin = (typeof ActionOrigin)[keyof typeof ActionOrigin];

export const PerspectiveKind = {
  FINANCIAL: 'FINANCIAL',
  CUSTOMERS: 'CUSTOMERS',
  INTERNAL_PROCESS: 'INTERNAL_PROCESS',
  LEARNING_GROWTH: 'LEARNING_GROWTH',
  SAFETY: 'SAFETY',
  PEOPLE: 'PEOPLE',
  ESG: 'ESG',
  QUALITY: 'QUALITY',
  PRODUCTIVITY: 'PRODUCTIVITY',
  COSTS: 'COSTS',
  CUSTOM: 'CUSTOM',
} as const;
export type PerspectiveKind = (typeof PerspectiveKind)[keyof typeof PerspectiveKind];

export const ObjectiveStatus = {
  PLANNED: 'PLANNED',
  ON_TRACK: 'ON_TRACK',
  AT_RISK: 'AT_RISK',
  OFF_TRACK: 'OFF_TRACK',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
} as const;
export type ObjectiveStatus = (typeof ObjectiveStatus)[keyof typeof ObjectiveStatus];

export const TrafficLight = {
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  RED: 'RED',
  GRAY: 'GRAY',
} as const;
export type TrafficLight = (typeof TrafficLight)[keyof typeof TrafficLight];
