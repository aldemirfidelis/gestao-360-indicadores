import { SetMetadata } from '@nestjs/common';

export interface PortalGateMetadata {
  module?: string;
  page?: string;
  feature?: string;
}

export const PORTAL_GATE_KEY = 'portal_gate';
export const PortalGate = (meta: PortalGateMetadata) => SetMetadata(PORTAL_GATE_KEY, meta);
