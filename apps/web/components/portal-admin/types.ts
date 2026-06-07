// Tipos da Central de Administração do Portal (espelham apps/api/.../portal-admin).

export interface PortalModuleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  route: string | null;
  menuOrder: number;
  status: string;
  criticality: string;
  dependencies: string;
  allowedRoles: string;
  allowedScopes: string;
  systemRequired: boolean;
  nonBlockable: boolean;
  experimental: boolean;
  unavailableMessage: string | null;
  updatedBy: string | null;
  updateReason: string | null;
  updatedAt: string;
}

export interface PortalPageRow {
  id: string;
  moduleCode: string | null;
  code: string;
  name: string;
  title: string | null;
  route: string | null;
  description: string | null;
  status: string;
  menuOrder: number;
  component: string | null;
  allowedRoles: string;
  allowedScopes: string;
  unavailableMessage: string | null;
  updatedBy: string | null;
  updateReason: string | null;
  updatedAt: string;
}

export interface PortalFeatureRow {
  id: string;
  moduleCode: string | null;
  pageCode: string | null;
  code: string;
  name: string;
  description: string | null;
  status: string;
  criticality: string;
  allowedRoles: string;
  allowedScopes: string;
  dependencies: string;
  flagKey: string | null;
  updatedBy: string | null;
  updateReason: string | null;
  updatedAt: string;
}

export interface PortalFeatureFlagRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rolloutPercentage: number | null;
  allowedRoles: string;
  allowedUserIds: string;
  allowedScopes: string;
  environment: string | null;
  experimental: boolean;
  scheduledOnAt: string | null;
  scheduledOffAt: string | null;
  updatedAt: string;
}

export interface PortalOverview {
  modules: { total: number; active: number; inactive: number; maintenance: number; critical: number };
  pages: { total: number; active: number; blocked: number };
  features: { total: number; experimentalFlags: number; restricted: number };
  flags: { total: number; enabled: number };
  integrations: { total: number; active: number; failing: number };
  roles: number;
  superAdmins: number;
  recentChanges: number;
  deniedAttempts: number;
  scheduledChanges: number;
  activeMaintenance: number;
  activeAnnouncements: number;
  lastSnapshot: { id: string; label: string; createdAt: string } | null;
  recentActions: PortalAuditRow[];
  portalStatus: string;
}

export interface PortalAuditRow {
  id: string;
  userEmail: string | null;
  userRole: string | null;
  tab: string;
  action: string;
  targetType: string | null;
  targetCode: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  reason: string | null;
  result: string;
  message: string | null;
  createdAt: string;
}

export interface PortalConfig {
  role: string;
  flags: Record<string, boolean>;
  maintenance: { global: { active: boolean; message?: string | null; allowSuperAdmin?: boolean }; modules: (string | null)[]; pages: (string | null)[] };
  modules: { code: string; status: string; route: string | null; hidden: boolean; maintenance: boolean; unavailable: boolean; unavailableMessage: string | null; companyModuleStatus?: string | null; companyModuleReadOnly?: boolean }[];
  pages: { code: string; route: string | null; status: string; hidden: boolean; maintenance: boolean; unavailable: boolean; unavailableMessage: string | null }[];
  navOverrides: { itemKey: string; kind: string; hidden: boolean; order: number | null; labelOverride: string | null; iconOverride: string | null; groupOverride: string | null }[];
  announcements: { id: string; title: string; message: string; type: string; display: string; pinned: boolean; dismissible: boolean }[];
  isSuperAdmin: boolean;
}

export const PORTAL_STATUS_TONE: Record<string, string> = {
  ACTIVE: 'pill-green',
  INACTIVE: 'pill-gray',
  HIDDEN: 'pill-gray',
  MAINTENANCE: 'pill-yellow',
  EXPERIMENTAL: 'pill-blue',
  SCHEDULED: 'pill-blue',
  BLOCKED: 'pill-red',
  DISCONTINUED: 'pill-red',
  RESTRICTED_ROLE: 'pill-yellow',
  RESTRICTED_SCOPE: 'pill-yellow',
};
