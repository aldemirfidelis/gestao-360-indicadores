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
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <span aria-hidden className="h-5 w-px shrink-0 bg-[hsl(var(--shell-border))]" />
      <img
        src={logo}
        alt={label}
        title={label}
        className={cn('h-7 w-auto max-w-[104px] shrink-0 object-contain', imgClassName)}
      />
    </span>
  );
}
