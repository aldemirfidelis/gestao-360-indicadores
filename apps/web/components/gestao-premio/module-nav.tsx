'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const sections = [
  { label: 'Visao Geral', href: '/gestao-premio' },
  { label: 'Programas de Premio', href: '/gestao-premio/programas' },
  { label: 'Competencias', href: '/gestao-premio/competencias' },
  { label: 'Anexos e Regras', href: '/gestao-premio/anexos' },
  { label: 'Realizado', href: '/gestao-premio/realizado' },
  { label: 'Colaboradores Elegiveis', href: '/gestao-premio/colaboradores' },
  { label: 'Apuracao Mensal', href: '/gestao-premio/apuracao' },
  { label: 'Ajustes e Excecoes', href: '/gestao-premio/ajustes' },
  { label: 'Espelhos do Premio', href: '/gestao-premio/espelhos' },
  { label: 'Relatorio e Auditoria', href: '/gestao-premio/relatorios' },
  { label: 'Integracao com a Folha', href: '/gestao-premio/folha' },
] as const;

export function PrizeModuleNav() {
  return null;
}
