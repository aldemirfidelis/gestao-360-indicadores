'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const sections = [
  { label: 'Visão Geral', href: '/gestao-premio' },
  { label: 'Programas de Prêmio', href: '/gestao-premio/programas' },
  { label: 'Competências', href: '/gestao-premio/competencias' },
  { label: 'Anexos e Regras', href: '/gestao-premio/anexos' },
  { label: 'Realizado', href: '/gestao-premio/realizado' },
  { label: 'Colaboradores Elegíveis', href: '/gestao-premio/colaboradores' },
  { label: 'Apuração Mensal', href: '/gestao-premio/apuracao' },
  { label: 'Ajustes e Exceções', href: '/gestao-premio/ajustes' },
  { label: 'Espelhos do Prêmio', href: '/gestao-premio/espelhos' },
  { label: 'Relatório e Auditoria', href: '/gestao-premio/relatorios' },
  { label: 'Integração com a Folha', href: '/gestao-premio/folha' },
] as const;

export function PrizeModuleNav() {
  return null;
}
