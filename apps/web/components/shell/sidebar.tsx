'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Network,
  Target,
  TrendingUp,
  PencilLine,
  AlertTriangle,
  ClipboardList,
  Users,
  Settings,
  Map,
  Building2,
  Sparkles,
  Crosshair,
  Calendar,
  FolderKanban,
  Upload,
  FileBarChart,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const sections: { heading: string; items: { href: string; label: string; icon: any }[] }[] = [
  {
    heading: 'Visao',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/insights', label: 'Insights IA', icon: Sparkles },
    ],
  },
  {
    heading: 'Estrategia',
    items: [
      { href: '/strategy', label: 'Mapa Estrategico', icon: Map },
      { href: '/okrs', label: 'OKRs', icon: Crosshair },
    ],
  },
  {
    heading: 'Performance',
    items: [
      { href: '/indicators', label: 'Indicadores', icon: Target },
      { href: '/results', label: 'Lancamentos', icon: PencilLine },
      { href: '/tree', label: 'Arvore', icon: TrendingUp },
    ],
  },
  {
    heading: 'Execucao',
    items: [
      { href: '/deviations', label: 'Desvios / FCA', icon: AlertTriangle },
      { href: '/actions', label: 'Planos de Acao', icon: ClipboardList },
      { href: '/projects', label: 'Projetos', icon: FolderKanban },
      { href: '/meetings', label: 'Reunioes', icon: Calendar },
    ],
  },
  {
    heading: 'Dados',
    items: [
      { href: '/imports', label: 'Importacao', icon: Upload },
      { href: '/reports', label: 'Relatorios', icon: FileBarChart },
    ],
  },
  {
    heading: 'Empresa',
    items: [
      { href: '/org', label: 'Estrutura', icon: Network },
      { href: '/users', label: 'Usuarios', icon: Users },
      { href: '/audit', label: 'Auditoria', icon: ScrollText },
      { href: '/settings', label: 'Configuracoes', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r bg-card/40 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-16 items-center gap-2 px-5 border-b">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Gestao 360</div>
          <div className="text-xs text-muted-foreground">Indicadores</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {sections.map((section) => (
          <div key={section.heading}>
            <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.heading}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-4 text-[11px] text-muted-foreground border-t">v0.2 - Fase 2</div>
    </aside>
  );
}
