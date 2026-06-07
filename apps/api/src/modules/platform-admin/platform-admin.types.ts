export interface PlatformAdminIdentity {
  sub: string;
  email: string;
  name: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
  kind: 'platform-admin';
}

export interface PlatformAdminRequest {
  platformAdmin?: PlatformAdminIdentity;
}
