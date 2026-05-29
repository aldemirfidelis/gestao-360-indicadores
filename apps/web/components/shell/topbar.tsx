'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LifeBuoy, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/auth-provider';
import { AccordionNavigation } from '@/components/shell/accordion-navigation';
import { isActivePath, visibleNavSections } from '@/components/shell/navigation';
import { NotificationsBell } from './notifications-bell';
import { api } from '@/lib/api';
import { BrandMark } from '@/components/brand/brand-mark';

interface SearchResult {
  id: string;
  type: string;
  label: string;
  description: string;
  href: string;
  status: string;
}

export function Topbar() {
  const { setTheme, theme } = useTheme();
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const sections = visibleNavSections(user);
  const section = sections.find((s) => s.items.some((i) => isActivePath(pathname, i.href, i.exact)));

  const globalSearch = useQuery<SearchResult[]>({
    queryKey: ['global-search', search],
    queryFn: () => api<SearchResult[]>(`/search?q=${encodeURIComponent(search)}&limit=6`),
    enabled: search.trim().length >= 2 && searchOpen,
  });

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/95 px-3 backdrop-blur lg:px-6">
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
            <Menu className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="left-2 top-2 h-[calc(100vh-1rem)] max-w-[300px] translate-x-0 translate-y-0 p-0">
          <DialogHeader className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <BrandMark className="h-7 w-7" />
              <span>Gestão 360</span>
            </DialogTitle>
          </DialogHeader>
          <AccordionNavigation mobile onNavigate={() => setMenuOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="hidden min-w-[140px] lg:block">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
          {section?.heading ?? 'Início'}
        </div>
      </div>

      <div className="relative min-w-0 flex-1 lg:max-w-xl">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setSearchOpen(false);
          }}
          placeholder="Buscar indicadores, ações, setores..."
          className="h-9 border-border/60 bg-muted/40 pl-9 text-sm placeholder:text-muted-foreground/60"
        />
        {searchOpen && search.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden border border-border bg-card shadow-lg">
            <div className="border-b border-border/60 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Busca global
            </div>
            <div className="max-h-[420px] overflow-y-auto p-1">
              {globalSearch.isLoading && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">Buscando...</div>
              )}
              {!globalSearch.isLoading && (globalSearch.data?.length ?? 0) === 0 && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">Nada encontrado.</div>
              )}
              {globalSearch.data?.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.href}
                  onClick={() => {
                    setSearchOpen(false);
                    setSearch('');
                  }}
                  className="flex items-start justify-between gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                  </span>
                  <span className="shrink-0 border border-border/60 bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {typeLabel(item.type)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Ajuda">
          <LifeBuoy className="h-4 w-4" />
        </Button>
        <NotificationsBell />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {user && (
          <div className="ml-1 flex items-center gap-2 border-l border-border/60 pl-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-xs font-medium">{user.name}</div>
              <div className="text-[10px] text-muted-foreground">{user.accessProfile?.name ?? user.jobTitle ?? user.role}</div>
            </div>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">
              {user.name
                .split(' ')
                .slice(0, 2)
                .map((n) => n[0])
                .join('')}
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={logout} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    indicator: 'Indicador',
    org: 'Estrutura',
    action: 'Ação',
    deviation: 'Desvio',
    meeting: 'Reunião',
    user: 'Usuário',
    objective: 'Objetivo',
  };
  return labels[type] ?? type;
}
