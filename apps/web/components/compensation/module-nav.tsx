'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const sections = [
  { label: 'Visão Geral', href: '/cargos-salarios' },
  { label: 'Estrutura e Quadro', href: '/cargos-salarios/estrutura-quadro' },
  { label: 'Catálogo de Cargos', href: '/cargos-salarios/catalogo' },
  { label: 'Descrições', href: '/cargos-salarios/descricoes' },
  { label: 'Tabelas Salariais', href: '/cargos-salarios/tabelas-salariais' },
  { label: 'Enquadramento', href: '/cargos-salarios/enquadramento' },
  { label: 'Movimentações', href: '/cargos-salarios/movimentacoes' },
  { label: 'Ciclos de Mérito', href: '/cargos-salarios/ciclos' },
  { label: 'Orçamento de Pessoal', href: '/cargos-salarios/orcamento' },
  { label: 'Pesquisas Salariais', href: '/cargos-salarios/pesquisas' },
  { label: 'Simulações', href: '/cargos-salarios/simulacoes' },
  { label: 'Aprovações', href: '/cargos-salarios/aprovacoes' },
  { label: 'Configurações', href: '/cargos-salarios/configuracoes' },
  { label: 'Relatórios', href: '/cargos-salarios/relatorios' },
] as const;

export function CompensationModuleNav() {
  return null;
}
