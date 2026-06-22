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
  const pathname = usePathname();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
      {sections.map((section) => {
        const active = pathname === section.href || (section.href !== '/gestao-premio' && pathname.startsWith(`${section.href}/`));
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
