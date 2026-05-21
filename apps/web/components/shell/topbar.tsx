'use client';

import { Moon, Search, Sun, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/auth/auth-provider';
import { NotificationsBell } from './notifications-bell';

export function Topbar() {
  const { setTheme, theme } = useTheme();
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur px-6">
      <div className="relative flex-1 max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar indicadores, acoes, areas..." className="pl-9" />
      </div>
      <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-3 pl-3 ml-1 border-l">
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">{user.jobTitle ?? user.role}</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
              {user.name
                .split(' ')
                .slice(0, 2)
                .map((n) => n[0])
                .join('')}
            </div>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
