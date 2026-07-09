'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Building2, Camera, Check, ChevronsUpDown, Home, KeyRound, LifeBuoy, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
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
import { isActivePath, visibleAllNavSections } from '@/components/shell/navigation';
import { NotificationsBell } from './notifications-bell';
import { OnlineUsersButton } from '@/components/communication/online-users-button';
import { MessagesButton } from '@/components/communication/messages-button';
import { UserAvatar } from '@/components/communication/user-avatar';
import { api } from '@/lib/api';
import { BrandLogo } from '@/components/brand/brand-logo';

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
  const { user, logout, refreshUser } = useAuth();
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const profileRef = useRef<HTMLDivElement | null>(null);
  const sections = visibleAllNavSections(user);
  const section = sections.find((s) => s.items.some((i) => isActivePath(pathname, i.href, i.exact)));
  const profileRole = user?.accessProfile?.name ?? user?.jobTitle ?? user?.role ?? '-';

  // Esc fecha a busca global e o card de perfil de qualquer lugar da página;
  // clique fora do card de perfil também fecha (o card fica aberto por padrão
  // e concentra dados sensíveis + troca de senha).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setSearchOpen(false);
      setProfileOpen(false);
    }
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const globalSearch = useQuery<SearchResult[]>({
    queryKey: ['global-search', search],
    queryFn: () => api<SearchResult[]>(`/search?q=${encodeURIComponent(search)}&limit=6`),
    enabled: search.trim().length >= 2 && searchOpen,
  });

  const avatarMutation = useMutation({
    mutationFn: (avatarUrl: string | null) => api('/communication/me/profile', { method: 'PATCH', json: { avatarUrl } }),
    onSuccess: async () => {
      await refreshUser();
      toast.success('Foto atualizada');
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível atualizar a foto'),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) throw new Error('Digite a senha novamente igual à nova senha.');
      if (passwordForm.newPassword.length < 6) throw new Error('A nova senha precisa ter pelo menos 6 caracteres.');
      return api('/auth/me/password', { method: 'PATCH', json: passwordForm });
    },
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Senha alterada');
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível alterar a senha'),
  });

  const handleAvatarFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida.');
      return;
    }
    if (file.size > 1_500_000) {
      toast.error('A imagem deve ter até 1,5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => avatarMutation.mutate(String(reader.result));
    reader.onerror = () => toast.error('Não foi possível ler a imagem.');
    reader.readAsDataURL(file);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[#1b2b54]/50 bg-[#0a1128] px-3 pt-[env(safe-area-inset-top)] [height:calc(3.5rem+env(safe-area-inset-top))] backdrop-blur lg:px-6">
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden text-slate-300 hover:text-white hover:bg-white/[0.05]" aria-label="Abrir menu">
            <Menu className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="left-2 top-2 h-[calc(100vh-1rem)] max-w-[300px] translate-x-0 translate-y-0 p-0">
          <DialogHeader className="border-b border-[#1b2b54]/50 px-4 py-3 bg-[#0a1128] text-white">
            <DialogTitle className="flex items-center gap-2 text-sm text-white">
              <BrandLogo variant="horizontal" size="sm" theme="dark" animated={true} />
            </DialogTitle>
          </DialogHeader>
          <div className="bg-[#0a1128] h-full">
            <AccordionNavigation mobile onNavigate={() => setMenuOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <div className="hidden min-w-[140px] lg:block">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
          {section?.heading ?? 'Início'}
        </div>
      </div>

      <CompanySwitcher />

      <div className="relative min-w-0 flex-1 lg:max-w-xl">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
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
          type="search"
          name="topbar-search"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          placeholder="Buscar indicadores, ações, setores..."
          className="h-9 border-[#203363] bg-[#121c38] pl-9 pr-8 text-sm text-white placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-0"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded bg-[#1e293b] px-1.5 font-mono text-[10px] font-medium text-slate-400 opacity-100 sm:flex">
          <span className="text-[11px]">⌘</span>K
        </kbd>
        {searchOpen && search.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden border border-[#1b2b54]/80 bg-[#0c1938] shadow-lg rounded-lg text-white">
            <div className="border-b border-[#1b2b54]/50 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400 bg-[#0a1128]">
              Busca global
            </div>
            <div className="max-h-[420px] overflow-y-auto p-1">
              {globalSearch.isLoading && (
                <div className="px-3 py-6 text-center text-sm text-slate-400">Buscando...</div>
              )}
              {!globalSearch.isLoading && (globalSearch.data?.length ?? 0) === 0 && (
                <div className="px-3 py-6 text-center text-sm text-slate-400">Nada encontrado.</div>
              )}
              {globalSearch.data?.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.href}
                  onClick={() => {
                    setSearchOpen(false);
                    setSearch('');
                  }}
                  className="flex items-start justify-between gap-3 px-3 py-2 text-sm transition-colors hover:bg-white/[0.05] rounded-md"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-white">{item.label}</span>
                    <span className="block truncate text-xs text-slate-400">{item.description}</span>
                  </span>
                  <span className="shrink-0 border border-[#1b2b54]/50 bg-[#121c38] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300 rounded">
                    {typeLabel(item.type)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5 text-slate-300 [&_button]:text-slate-300 [&_button:hover]:text-white [&_button:hover]:bg-white/[0.05]">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-white hover:bg-white/[0.05]" aria-label="Ajuda" asChild>
          <Link href="/ajuda" title="Ajuda">
            <LifeBuoy className="h-4 w-4" />
          </Link>
        </Button>
        <MessagesButton />
        <OnlineUsersButton />
        <NotificationsBell />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-slate-300 hover:text-white hover:bg-white/[0.05]"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {user && (
          <div ref={profileRef} className="relative ml-1 flex items-center gap-2 border-l border-[#1b2b54]/50 pl-3 text-white">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-xs font-medium text-white">{user.name}</div>
              <div className="text-[10px] text-slate-400">{profileRole}</div>
            </div>
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              className="rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Abrir perfil"
              title="Perfil"
            >
              <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
            </button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-white hover:bg-white/[0.05]" onClick={logout} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
            {profileOpen && (
              <div className="absolute right-0 top-11 z-50 w-[330px] border border-border bg-card p-4 text-foreground shadow-xl">
                <div className="flex items-start gap-3 border-b border-border/60 pb-3">
                  <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{user.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{profileRole}</div>
                    {user.activeCompany?.name && <div className="mt-1 truncate text-xs text-muted-foreground">{user.activeCompany.name}</div>}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <InfoPill label="Cargo" value={user.jobTitle ?? '-'} />
                  <InfoPill label="Perfil" value={user.accessProfile?.name ?? user.role} />
                </div>

                <div className="mt-4 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Foto</div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors hover:bg-accent/35">
                      <Camera className="h-3.5 w-3.5" />
                      Alterar foto
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
                    </label>
                    {user.avatarUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => avatarMutation.mutate(null)}
                        disabled={avatarMutation.isPending}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </div>

                <form
                  className="mt-4 space-y-2 border-t border-border/60 pt-3"
                  autoComplete="off"
                  onSubmit={(e) => {
                    e.preventDefault();
                    passwordMutation.mutate();
                  }}
                >
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" />
                    Alterar senha
                  </div>
                  {/* Campo de usuário oculto: dá ao Chrome um alvo dedicado para
                      associar às senhas deste formulário, evitando que ele
                      preencha automaticamente a busca global (fora do form)
                      com o e-mail salvo do usuário. */}
                  <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
                  <Input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="Senha atual"
                    autoComplete="current-password"
                    className="h-8 text-xs"
                  />
                  <Input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Nova senha"
                    autoComplete="new-password"
                    className="h-8 text-xs"
                  />
                  <Input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Digite a senha novamente"
                    autoComplete="new-password"
                    className="h-8 text-xs"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 w-full text-xs"
                    disabled={passwordMutation.isPending || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                  >
                    {passwordMutation.isPending ? 'Aplicando...' : 'Aplicar'}
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/30 px-2 py-1.5">
      <div className="text-[10px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className="truncate text-xs font-medium">{value}</div>
    </div>
  );
}

interface SwitcherCompany {
  id: string;
  name: string;
  tradeName: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
}

function CompanySwitcher() {
  const { user, switchCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const companies = useQuery<SwitcherCompany[]>({
    queryKey: ['platform-companies'],
    queryFn: () => api<SwitcherCompany[]>('/platform/companies'),
    enabled: open && user?.role === 'SUPER_ADMIN',
  });

  if (user?.role !== 'SUPER_ADMIN') return null;

  const activeName = user.activeCompany?.name ?? 'Selecionar empresa';
  const enter = async (companyId: string | null) => {
    setBusy(true);
    try {
      await switchCompany(companyId);
    } catch {
      setBusy(false);
    }
  };

  const list = (companies.data ?? []).filter((c) =>
    [c.name, c.tradeName].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden h-9 max-w-[220px] items-center gap-2 border-border/60 md:flex"
          title="Trocar de empresa (superadministrador)"
        >
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-medium">{activeName}</span>
          {user.impersonating && (
            <span className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-600">
              Admin
            </span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Trocar de empresa</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-xs text-muted-foreground">
          Você entra no contexto da empresa escolhida para administrar todos os seus dados.
        </p>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empresa..." className="h-9" />
        <button
          type="button"
          disabled={busy}
          onClick={() => enter(null)}
          className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-left text-sm transition-colors hover:bg-accent/35 disabled:opacity-60"
        >
          <Home className="h-4 w-4 text-muted-foreground" />
          <span>Minha empresa de origem</span>
        </button>
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {companies.isLoading && <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>}
          {list.map((c) => {
            const isCurrent = user.companyId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                disabled={busy || isCurrent}
                onClick={() => enter(c.id)}
                className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent/35 disabled:cursor-default disabled:opacity-100"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.tradeName ?? ''}</span>
                </span>
                {isCurrent && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
          {!companies.isLoading && list.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
