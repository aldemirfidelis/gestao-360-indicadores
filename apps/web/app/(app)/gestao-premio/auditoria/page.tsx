import { redirect } from 'next/navigation';

// Tela consolidada: a trilha de auditoria agora é uma aba de /gestao-premio/relatorios.
export default function PrizeAuditRedirect() {
  redirect('/gestao-premio/relatorios');
}
