'use client';

/**
 * Identidade visual da empresa da sessão: cor principal do portal + logo.
 *
 * A cor escolhida vira um conjunto de CSS vars aplicadas no <html>, que o shell
 * (cabeçalho, menu lateral e realces) consome. Sem cor configurada, as vars não
 * são escritas e vale o azul padrão do Gestão 360 definido no globals.css.
 */

import { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { brandPaletteFrom, type BrandPalette } from '@/lib/brand-color';

export interface CompanyBranding {
  id: string;
  name: string;
  tradeName: string | null;
  logoUrl: string | null;
  brandColor: string | null;
  brandTextColor: string | null;
}

interface BrandingCtx {
  branding: CompanyBranding | null;
  palette: BrandPalette | null;
  loading: boolean;
}

const Ctx = createContext<BrandingCtx | null>(null);

export const companyBrandingQueryKey = ['company', 'branding'] as const;

export function CompanyBrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const query = useQuery<CompanyBranding>({
    queryKey: companyBrandingQueryKey,
    queryFn: () => api<CompanyBranding>('/companies/me/branding'),
    enabled: Boolean(user),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const branding = query.data ?? null;
  const palette = useMemo(
    () => brandPaletteFrom(branding?.brandColor ?? null, branding?.brandTextColor ?? null),
    [branding?.brandColor, branding?.brandTextColor],
  );

  useEffect(() => {
    const root = document.documentElement;
    const vars = ['--shell-bg', '--shell-bg-soft', '--shell-border', '--shell-foreground', '--shell-muted', '--brand'];
    if (!palette) {
      // Sem cor da empresa: devolve o controle ao tema padrão.
      for (const name of vars) root.style.removeProperty(name);
      return;
    }
    root.style.setProperty('--shell-bg', palette.shellBg);
    root.style.setProperty('--shell-bg-soft', palette.shellBgSoft);
    root.style.setProperty('--shell-border', palette.shellBorder);
    root.style.setProperty('--shell-foreground', palette.shellForeground);
    root.style.setProperty('--shell-muted', palette.shellMuted);
    root.style.setProperty('--brand', palette.brand);
  }, [palette]);

  const value = useMemo<BrandingCtx>(
    () => ({ branding, palette, loading: query.isLoading }),
    [branding, palette, query.isLoading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCompanyBranding(): BrandingCtx {
  // Fora do provider (telas públicas), devolve o padrão sem quebrar.
  return useContext(Ctx) ?? { branding: null, palette: null, loading: false };
}
