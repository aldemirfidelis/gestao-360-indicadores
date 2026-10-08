'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { WhatsAppIcon } from '@/components/recruitment/whatsapp-button';
import { WHATSAPP_NUMBER, WHATSAPP_URL } from '@/lib/public-site';
import { formatWhatsappNumber } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'g360.demoContactCardClosed';

/** No mobile, fica acima da navegação inferior (h-14 + área segura). */
const POSITION = 'fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 lg:bottom-5 lg:right-5';

function readCollapsed() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function trackWhatsAppClick(cta: string) {
  const payload = { event: 'whatsapp_contact_click', page: window.location.pathname, clickedAt: new Date().toISOString(), cta };
  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).dataLayer.push(payload);
}

/**
 * Convite de contato exibido só na Empresa Demonstração: quem gostou do que
 * viu fala com a equipe pelo WhatsApp. Fechar o card o reduz a um botão
 * redondo, que continua levando ao WhatsApp até o fim da sessão do navegador.
 */
export function DemoContactCard() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const phone = formatWhatsappNumber(WHATSAPP_NUMBER);

  function collapse() {
    setCollapsed(true);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Sem armazenamento (aba privada, bloqueio): o card só volta ao recarregar.
    }
  }

  if (collapsed) {
    return (
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackWhatsAppClick('demo_whatsapp_bubble')}
        aria-label="Falar com a equipe do Gestão 360 pelo WhatsApp"
        title="Falar com a equipe do Gestão 360 pelo WhatsApp"
        className={cn(
          POSITION,
          'grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-950/20 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40',
        )}
      >
        <WhatsAppIcon className="h-6 w-6" />
      </a>
    );
  }

  return (
    <aside
      aria-label="Contato comercial"
      className={cn(POSITION, 'w-[min(340px,calc(100vw-2rem))] border border-border/70 bg-card p-4 text-sm shadow-xl shadow-slate-950/15')}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#25D366]/15 text-[#128C7E]" aria-hidden>
          <WhatsAppIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">Gostou do Gestão 360?</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            Entre em contato pelo WhatsApp para receber uma proposta ou montar a solução ideal para a sua empresa.
          </p>
        </div>
        <button
          type="button"
          onClick={collapse}
          aria-label="Minimizar convite de contato"
          className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackWhatsAppClick('demo_floating_card')}
        className="mt-3 flex w-full items-center justify-center gap-2 bg-[#25D366] px-3 py-2 font-semibold text-slate-950 transition-colors hover:bg-[#20bd5a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40"
      >
        <WhatsAppIcon className="h-4 w-4" />
        WhatsApp {phone}
      </a>
    </aside>
  );
}
