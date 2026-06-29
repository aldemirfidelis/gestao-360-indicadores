'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, Download, Share, SquarePlus, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { enablePushNotifications, notificationPermission, pushSupported } from '@/lib/push';

const DISMISS_KEY = 'g360.pwaPromptDismissedAt';
const DISMISS_DAYS = 14;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function PwaManager() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [busy, setBusy] = useState(false);

  // Registra o service worker (habilita instalacao e push).
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setLoggedIn(Boolean(window.localStorage.getItem('g360.accessToken')));
    setNotifGranted(notificationPermission() === 'granted');

    if (isStandalone()) return; // ja instalado

    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIOS(ios);

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS/iPadOS Safari nao dispara beforeinstallprompt: mostramos instrucoes.
    if (ios) {
      const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|chrome/.test(ua);
      if (isSafari) setShow(true);
    }

    window.addEventListener('appinstalled', () => setShow(false));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage pode estar bloqueado */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === 'accepted') {
      toast.success('Aplicativo instalado! Abra pela tela inicial.');
      setShow(false);
    }
  };

  const enableNotifications = async () => {
    setBusy(true);
    try {
      const res = await enablePushNotifications();
      if (res.ok) {
        setNotifGranted(true);
        toast.success('Notificações ativadas neste dispositivo.');
      } else if (res.reason === 'denied') {
        toast.error('Permissão de notificações negada. Habilite nas configurações do navegador.');
      } else if (res.reason === 'unsupported') {
        toast.error('Este navegador não suporta notificações. No iPhone, instale o app primeiro.');
      } else if (res.reason === 'not-configured') {
        toast.error('Notificações ainda não configuradas no servidor.');
      } else {
        toast.error('Não foi possível ativar as notificações.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] p-3 pb-[calc(0.75rem+3.75rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:p-0 sm:pb-0">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/95 text-white shadow-2xl backdrop-blur-xl sm:w-[22rem]">
        <div className="flex items-start gap-3 p-4">
          <div className="shrink-0 rounded-xl bg-slate-800/80 p-1.5">
            <BrandLogo variant="icon" size="sm" theme="dark" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight">Instale o Gestão 360</p>
            <p className="mt-0.5 text-xs text-slate-400">Acesso rápido pela tela inicial, em tela cheia e com notificações.</p>
          </div>
          <button onClick={dismiss} aria-label="Fechar" className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 px-4 pb-4">
          {isIOS ? (
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/50 p-3 text-xs text-slate-300">
              <p className="font-semibold text-slate-200">Para instalar no iPhone/iPad:</p>
              <ol className="mt-1.5 space-y-1">
                <li className="flex items-center gap-1.5">
                  1. Toque em <Share className="inline h-3.5 w-3.5 text-cyan-400" /> <span className="text-slate-400">(Compartilhar)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  2. Escolha <SquarePlus className="inline h-3.5 w-3.5 text-cyan-400" /> <span className="font-medium">Adicionar à Tela de Início</span>
                </li>
                <li>3. Abra o app pela tela inicial e ative as notificações.</li>
              </ol>
            </div>
          ) : (
            <button
              onClick={install}
              disabled={!deferred}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Instalar aplicativo
            </button>
          )}

          {loggedIn && pushSupported() && !notifGranted && (
            <button
              onClick={enableNotifications}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 disabled:opacity-50"
            >
              <Bell className="h-4 w-4 text-cyan-400" />
              {busy ? 'Ativando...' : 'Ativar notificações'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
