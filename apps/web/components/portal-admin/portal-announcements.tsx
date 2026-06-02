'use client';

import { useState, useEffect } from 'react';
import { Megaphone, X, AlertTriangle, Info, ShieldAlert, Sparkles } from 'lucide-react';
import { usePortalConfig } from './portal-config-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ANNOUNCEMENT_BG: Record<string, string> = {
  urgent: 'bg-status-red/10 border-status-red/30 text-status-red',
  maintenance: 'bg-status-yellow/10 border-status-yellow/30 text-status-yellow-dark',
  warning: 'bg-status-yellow/10 border-status-yellow/30 text-status-yellow-dark',
  info: 'bg-status-blue/10 border-status-blue/30 text-status-blue',
  update: 'bg-status-blue/10 border-status-blue/30 text-status-blue',
  training: 'bg-status-green/10 border-status-green/30 text-status-green',
  feature: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400',
};

const ANNOUNCEMENT_ICONS: Record<string, JSX.Element> = {
  urgent: <ShieldAlert className="h-4 w-4 shrink-0" />,
  maintenance: <AlertTriangle className="h-4 w-4 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0" />,
  info: <Info className="h-4 w-4 shrink-0" />,
  update: <Info className="h-4 w-4 shrink-0" />,
  training: <Megaphone className="h-4 w-4 shrink-0" />,
  feature: <Sparkles className="h-4 w-4 shrink-0" />,
};

export function PortalAnnouncements() {
  const { config } = usePortalConfig();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [activeModalId, setActiveModalId] = useState<string | null>(null);

  // Load dismissed announcements from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('g360_dismissed_announcements');
      if (stored) {
        setDismissed(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load dismissed announcements', e);
    }
  }, []);

  const handleDismiss = (id: string) => {
    const updated = [...dismissed, id];
    setDismissed(updated);
    try {
      localStorage.setItem('g360_dismissed_announcements', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save dismissed announcement state', e);
    }
    if (activeModalId === id) {
      setActiveModalId(null);
    }
  };

  const activeAnnouncements = config?.announcements ?? [];
  const visible = activeAnnouncements.filter((a) => !dismissed.includes(a.id));

  const banners = visible.filter((a) => a.display === 'banner');
  const modals = visible.filter((a) => a.display === 'modal');

  // Trigger the first modal if any
  useEffect(() => {
    if (modals.length > 0 && !activeModalId) {
      // Find the first modal that is not dismissed
      const nextModal = modals[0];
      if (nextModal) {
        setActiveModalId(nextModal.id);
      }
    }
  }, [modals, activeModalId]);

  const currentModal = modals.find((m) => m.id === activeModalId) ?? null;

  return (
    <>
      {/* Banners container */}
      {banners.length > 0 && (
        <div className="flex flex-col gap-2 px-4 pt-4 sm:px-5 lg:px-6">
          {banners.map((b) => {
            const bgClass = ANNOUNCEMENT_BG[b.type] ?? 'bg-card border-border text-foreground';
            const icon = ANNOUNCEMENT_ICONS[b.type] ?? <Megaphone className="h-4 w-4 shrink-0" />;

            return (
              <div
                key={b.id}
                className={cn(
                  'flex items-start justify-between gap-3 rounded-lg border p-3.5 text-sm shadow-sm transition-all duration-200 animate-in fade-in slide-in-from-top-2',
                  bgClass
                )}
              >
                <div className="flex gap-2.5 items-start">
                  <div className="mt-0.5">{icon}</div>
                  <div>
                    <span className="font-semibold block">{b.title}</span>
                    <span className="opacity-95">{b.message}</span>
                  </div>
                </div>
                {b.dismissible && (
                  <button
                    onClick={() => handleDismiss(b.id)}
                    className="mt-0.5 rounded-full p-1 opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 shrink-0 transition-colors"
                    aria-label="Dispensar aviso"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal alert container */}
      {currentModal && (
        <Dialog open onOpenChange={(open) => {
          if (!open && currentModal.dismissible) {
            handleDismiss(currentModal.id);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader className="flex flex-row items-center gap-2 text-left">
              <div className="rounded-full p-1.5 bg-muted">
                {ANNOUNCEMENT_ICONS[currentModal.type] ?? <Megaphone className="h-5 w-5" />}
              </div>
              <DialogTitle className="text-lg font-bold">{currentModal.title}</DialogTitle>
            </DialogHeader>
            <div className="py-3 text-sm text-muted-foreground whitespace-pre-wrap">
              {currentModal.message}
            </div>
            <DialogFooter>
              {currentModal.dismissible ? (
                <Button onClick={() => handleDismiss(currentModal.id)}>Dispensar</Button>
              ) : (
                <Button onClick={() => setActiveModalId(null)}>Fechar</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
