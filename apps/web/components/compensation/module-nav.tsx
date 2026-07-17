'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Navegação interna de Cargos e Salários, agrupada pelo processo do módulo
 * (estruturar → remunerar → movimentar → governar). Renderizada logo abaixo do
 * PageHeader em todas as subpáginas — dá contexto de "onde estou" sem depender
 * do accordion do menu lateral, que lista as 15 telas de forma plana.
 */
const groups: Array<{ label: string; items: Array<{ label: string; href: string }> }> = [
  {
    label: 'Painel',
    items: [{ label: 'Visão Geral', href: '/cargos-salarios' }],
  },
  {
    label: 'Estrutura',
    items: [
      { label: 'Estrutura e Quadro', href: '/cargos-salarios/estrutura-quadro' },
      { label: 'Catálogo de Cargos', href: '/cargos-salarios/catalogo' },
      { label: 'Descrições', href: '/cargos-salarios/descricoes' },
    ],
  },
  {
    label: 'Remuneração',
    items: [
      { label: 'Tabelas Salariais', href: '/cargos-salarios/tabelas-salariais' },
      { label: 'Enquadramento', href: '/cargos-salarios/enquadramento' },
      { label: 'Equidade Salarial', href: '/cargos-salarios/equidade' },
      { label: 'Pesquisas Salariais', href: '/cargos-salarios/pesquisas' },
    ],
  },
  {
    label: 'Movimentação',
    items: [
      { label: 'Movimentações', href: '/cargos-salarios/movimentacoes' },
      { label: 'Ciclos de Mérito', href: '/cargos-salarios/ciclos' },
      { label: 'Simulações', href: '/cargos-salarios/simulacoes' },
      { label: 'Orçamento de Pessoal', href: '/cargos-salarios/orcamento' },
    ],
  },
  {
    label: 'Governança',
    items: [
      { label: 'Aprovações', href: '/cargos-salarios/aprovacoes' },
      { label: 'Relatórios', href: '/cargos-salarios/relatorios' },
      { label: 'Configurações', href: '/cargos-salarios/configuracoes' },
    ],
  },
];

export function CompensationModuleNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções de Cargos e Salários" className="overflow-x-auto border-b border-border/60 pb-2">
      <div className="flex min-w-max items-end gap-4">
        {groups.map((group) => (
          <div key={group.label} className="shrink-0">
            <div className="mb-1 px-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {group.label}
            </div>
            <div className="flex items-center gap-1">
              {group.items.map((item) => {
                const active = item.href === '/cargos-salarios' ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
