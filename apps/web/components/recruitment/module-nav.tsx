'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Briefcase, ClipboardCheck, Mail, ShieldCheck, UserPlus, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

interface ModuleItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permissions: string[];
  exact?: boolean;
}

const items: ModuleItem[] = [
  {
    label: 'Requisições e aprovações',
    href: '/recrutamento',
    icon: ClipboardCheck,
    permissions: ['recruit:view', 'recruit:requisition:create', 'recruit:requisition:approve', 'recruit:manage'],
    exact: true,
  },
  {
    label: 'Vagas e candidatos',
    href: '/recrutamento/vagas',
    icon: Briefcase,
    permissions: ['recruit:view', 'recruit:offer:approve', 'recruit:prehire', 'recruit:admit', 'recruit:manage', 'saude:occupational'],
  },
  {
    label: 'Análises',
    href: '/recrutamento/analises',
    icon: BarChart3,
    permissions: ['recruit:view', 'recruit:manage'],
  },
  {
    label: 'Comunicação',
    href: '/recrutamento/comunicacao',
    icon: Mail,
    permissions: ['recruit:manage'],
  },
  {
    label: 'Privacidade e LGPD',
    href: '/recrutamento/lgpd',
    icon: ShieldCheck,
    permissions: ['recruit:lgpd', 'recruit:manage'],
  },
];

export function RecruitmentModuleNav() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const visibleItems = items.filter((item) => hasPermission(item.permissions));

  return (
    <nav aria-label="Abas de Recrutamento e Seleção" className="rounded-lg border border-border/60 bg-card px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-1 flex items-center gap-2 px-1 text-xs font-semibold text-foreground">
          <UserPlus className="h-4 w-4 text-primary" />
          <span>Recrutamento e Seleção</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
