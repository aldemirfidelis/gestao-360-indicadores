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
    cta: 'floating_whatsapp_chat',
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
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {showBubble && (
        <div className="w-[min(360px,calc(100vw-2rem))] border border-emerald-200 bg-white p-4 text-sm text-slate-700 shadow-xl shadow-slate-950/15">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800" aria-hidden="true">
              G360
            </div>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-slate-950">Atendimento Gestão 360</p>
                <button
                  type="button"
                  onClick={closeBubble}
                  className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center text-slate-500 hover:text-slate-900"
                  aria-label="Fechar mensagem do WhatsApp"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 leading-6">
                Gostou? Fale com a gente para enviarmos uma proposta ou criarmos uma solução que atenda às suas necessidades ou às necessidades da sua empresa.
              </p>
            </div>
          </div>
        </div>
      )}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar com a equipe do Gestão 360 pelo WhatsApp"
        title="Fale com a equipe do Gestão 360 pelo WhatsApp"
        onClick={trackWhatsAppClick}
        className="group inline-flex h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 font-semibold text-slate-950 shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-950/10 transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-emerald-300"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="hidden pr-1 text-sm sm:inline">WhatsApp</span>
      </a>
    </div>
  );
}
