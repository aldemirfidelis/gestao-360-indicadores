'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const sections = [
  { label: 'Visao Geral', href: '/cargos-salarios' },
  { label: 'Estrutura e Quadro', href: '/cargos-salarios/estrutura-quadro' },
  { label: 'Catalogo de Cargos', href: '/cargos-salarios/catalogo' },
  { label: 'Descricoes', href: '/cargos-salarios/descricoes' },
  { label: 'Tabelas Salariais', href: '/cargos-salarios/tabelas-salariais' },
  { label: 'Enquadramento', href: '/cargos-salarios/enquadramento' },
  { label: 'Movimentacoes', href: '/cargos-salarios/movimentacoes' },
  { label: 'Relatorios', href: '/cargos-salarios/relatorios' },
] as const;

const planned = [
  'Ciclos de Merito',
  'Orcamento de Pessoal',
  'Pesquisas Salariais',
  'Simulacoes',
  'Aprovacoes',
  'Configuracoes',
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
      {planned.map((label) => (
        <Badge key={label} variant="outline" className="rounded-md px-2.5 py-1 text-[11px] text-muted-foreground">
          {label}
        </Badge>
      ))}
    </div>
  );
}

