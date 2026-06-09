'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { WHATSAPP_URL } from '@/lib/public-site';

const STORAGE_KEY = 'g360.whatsappBubbleClosed';

function trackWhatsAppClick() {
  const payload = {
    event: 'whatsapp_contact_click',
    page: window.location.pathname,
    clickedAt: new Date().toISOString(),
    cta: 'floating_whatsapp',
    device: window.innerWidth < 768 ? 'mobile' : 'desktop',
    referrer: document.referrer || null,
    utm: Object.fromEntries(new URLSearchParams(window.location.search).entries()),
  };
  window.dispatchEvent(new CustomEvent('g360:analytics', { detail: payload }));
  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).dataLayer.push(payload);
}

export function WhatsAppButton() {
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    setShowBubble(window.localStorage.getItem(STORAGE_KEY) !== '1');
  }, []);

  function closeBubble() {
    window.localStorage.setItem(STORAGE_KEY, '1');
    setShowBubble(false);
  }

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 flex max-w-[calc(100vw-2rem)] items-end gap-2">
      {showBubble && (
        <div className="hidden max-w-[240px] border border-emerald-200 bg-white p-3 text-sm text-slate-700 shadow-lg sm:block">
          <button
            type="button"
            onClick={closeBubble}
            className="float-right -mr-1 -mt-1 grid h-6 w-6 place-items-center text-slate-500 hover:text-slate-900"
            aria-label="Fechar mensagem do WhatsApp"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          Ola! Posso ajudar voce a conhecer o Gestao 360?
        </div>
      )}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar com a equipe do Gestao 360 pelo WhatsApp"
        title="Fale conosco pelo WhatsApp"
        onClick={trackWhatsAppClick}
        className="group inline-flex h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 font-semibold text-slate-950 shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-950/10 transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-emerald-300"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="hidden pr-1 text-sm sm:inline">WhatsApp</span>
      </a>
    </div>
  );
}
