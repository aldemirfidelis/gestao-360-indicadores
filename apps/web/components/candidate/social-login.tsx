'use client';

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { CAREERS_API_URL } from '@/lib/careers';

type Provider = 'GOOGLE' | 'LINKEDIN';
interface ProviderInfo { provider: Provider; label: string }

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 01-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.11A12 12 0 0012 24z" />
      <path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 010-4.56V6.61H1.29a12 12 0 000 10.78l4-3.11z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 001.29 6.61l4 3.11C6.23 6.88 8.88 4.75 12 4.75z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path
        fill="#0A66C2"
        d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"
      />
    </svg>
  );
}

const ICON: Record<Provider, () => ReactElement> = { GOOGLE: GoogleIcon, LINKEDIN: LinkedInIcon };

/**
 * Botões de login social.
 *
 * A lista vem da API: provedor sem credencial configurada no servidor não é
 * devolvido e o botão não aparece — em vez de oferecer um caminho que quebraria
 * no clique. Enquanto nenhum estiver configurado, o bloco inteiro some, e a
 * tela fica só com e-mail e senha.
 */
export function SocialLogin({ returnTo }: { returnTo: string }) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  useEffect(() => {
    let active = true;
    fetch(`${CAREERS_API_URL}/careers/candidates/oauth/providers`)
      .then((response) => (response.ok ? response.json() : { providers: [] }))
      .then((data: { providers?: ProviderInfo[] }) => {
        if (active) setProviders(data?.providers ?? []);
      })
      .catch(() => {
        if (active) setProviders([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (providers.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="grid gap-2.5">
        {providers.map((item) => {
          const Icon = ICON[item.provider];
          return (
            <a
              key={item.provider}
              href={`${CAREERS_API_URL}/careers/candidates/oauth/${item.provider.toLowerCase()}/start?returnTo=${encodeURIComponent(returnTo)}`}
              className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-400/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Icon />
              Continuar com {item.label}
            </a>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">ou com e-mail</span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}
