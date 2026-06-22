import { redirect } from 'next/navigation';

export default function PrizeIntegrationsRedirect() {
  redirect('/platform-admin?section=externalIntegrations&tab=prize');
}
