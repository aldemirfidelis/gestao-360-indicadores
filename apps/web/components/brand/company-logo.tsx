'use client';

/* eslint-disable @next/next/no-img-element -- logo vem do banco (data URL ou URL
   externa do cliente); o otimizador do Next não cobre esses casos. */

import { useCompanyBranding } from '@/components/brand/company-branding-provider';
import { cn } from '@/lib/utils';

/**
 * Logo da empresa exibido ao lado da marca Gestão 360, separado por um traço
 * vertical. Some sozinho quando a empresa não tem logo configurado.
 */
export function CompanyLogo({ className, imgClassName }: { className?: string; imgClassName?: string }) {
  const { branding } = useCompanyBranding();
  const logo = branding?.logoUrl;
  if (!logo) return null;

  const label = branding?.tradeName || branding?.name || 'Empresa';
  return (
    // min-w-0 + shrink deixam o conjunto encolher junto com a barra em vez de
    // vazar e ser cortado pela borda.
    <span className={cn('flex min-w-0 shrink items-center gap-2 overflow-hidden', className)}>
      <span aria-hidden className="h-5 w-px shrink-0 bg-[hsl(var(--shell-border))]" />
      <img
        src={logo}
        alt={label}
        title={label}
        className={cn('h-7 w-auto max-w-full object-contain object-left', imgClassName)}
      />
    </span>
  );
}

/** Há logo da empresa configurado? Usado para escolher o formato da marca. */
export function useHasCompanyLogo(): boolean {
  const { branding } = useCompanyBranding();
  return Boolean(branding?.logoUrl);
}
