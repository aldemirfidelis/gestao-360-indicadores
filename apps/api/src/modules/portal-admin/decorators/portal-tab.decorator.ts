import { SetMetadata } from '@nestjs/common';
import { PortalTab } from '../portal-admin.constants';

export const PORTAL_TAB_KEY = 'portalTab';
export const PortalTabTag = (tab: PortalTab) => SetMetadata(PORTAL_TAB_KEY, tab);
