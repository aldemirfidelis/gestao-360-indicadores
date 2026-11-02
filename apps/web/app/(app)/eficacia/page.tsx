import { isProductRouteActive } from '@g360/shared';
import { redirect } from 'next/navigation';

export default function EficaciaPage() {
  // Com a central de aprovações suspensa, a verificação de eficácia fica no Plano de Ação.
  redirect(isProductRouteActive('/aprovacoes-cargo') ? '/aprovacoes-cargo?tab=eficacia' : '/actions?effectivenessStatus=PENDING');
}
