'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Menu, Moon, Search, Sun, LogOut, LifeBuoy } from 'lucide-react';
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
import { navSections } from '@/components/shell/navigation';
import { NotificationsBell } from './notifications-bell';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

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
  const section = navSections.find((s) => s.items.some((i) => isActive(pathname, i.href)));

  const globalSearch = useQuery<SearchResult[]>({
    queryKey: ['global-search', search],
    queryFn: () => api<SearchResult[]>(`/search?q=${encodeURIComponent(search)}&limit=6`),
    enabled: search.trim().length >= 2 && searchOpen,
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/88 px-3 backdrop-blur lg:px-6">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" className="lg:hidden" aria-label="Abrir menu">
            <Menu className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="left-3 top-3 h-[calc(100vh-1.5rem)] max-w-[340px] translate-x-0 translate-y-0 p-0 sm:rounded-lg">
          <DialogHeader className="border-b px-4 py-4">
            <DialogTitle className="text-base">Gestao 360</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto p-3">
            {navSections.map((nav) => (
              <div key={nav.heading} className="mb-4">
                <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {nav.heading}
                </div>
                <div className="space-y-1">
                  {nav.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={`${nav.heading}-${item.href}`}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                          active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div className="hidden min-w-[140px] lg:block">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {section?.heading ?? 'Inicio'}
        </div>
        <div className="text-sm font-medium">Gestao 360</div>
      </div>

      <div className="relative min-w-0 flex-1 lg:max-w-2xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
          placeholder="Buscar indicadores, acoes, setores, responsaveis..."
          className="h-10 border-border/80 bg-card pl-9 shadow-sm"
        />
        {searchOpen && search.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-lg border bg-card shadow-xl">
            <div className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Busca global
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
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
                  className="flex items-start justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                  </span>
                  <span className="shrink-0 rounded border bg-background px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {typeLabel(item.type)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 lg:gap-2">
        <Button variant="ghost" size="icon" aria-label="Ajuda">
          <LifeBuoy className="h-4 w-4" />
        </Button>
        <NotificationsBell />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {user && (
          <div className="flex items-center gap-2 pl-2 lg:border-l lg:pl-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">{user.jobTitle ?? user.role}</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {user.name
                .split(' ')
                .slice(0, 2)
                .map((n) => n[0])
                .join('')}
            </div>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sair" className="hidden sm:inline-flex">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    indicator: 'Indicador',
    org: 'Estrutura',
    action: 'Acao',
    deviation: 'Desvio',
    meeting: 'Reuniao',
    user: 'Usuario',
    objective: 'Objetivo',
  };
  return labels[type] ?? type;
}
