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
  const pathname = usePathname();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
      {sections.map((section) => {
        const active = pathname === section.href || (section.href !== '/cargos-salarios' && pathname.startsWith(`${section.href}/`));
        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              active ? 'border-foreground bg-foreground text-background' : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </div>
  );
}
