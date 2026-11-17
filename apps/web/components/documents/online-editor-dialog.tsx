'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface EditorSession {
  configured: boolean;
  provider: string;
  mode: 'ONLINE' | 'MANUAL';
  message?: string;
  documentId: string;
  fileId: string | null;
  editorUrl: string | null;
  accessToken: string | null;
  accessTokenTtl: number;
  wopiSrc: string | null;
  readOnly?: boolean;
  notice?: string;
}

export interface DesktopEditorSession {
  configured: boolean;
  provider: 'word_desktop';
  mode: 'DESKTOP';
  documentId: string;
  fileId: string | null;
  fileName: string | null;
  davUrl: string | null;
  msWordUrl: string | null;
  message?: string;
}

const PROVIDER_LABEL: Record<string, string> = {
  collabora: 'Collabora Online',
  microsoft_365: 'Microsoft 365',
  onlyoffice: 'ONLYOFFICE',
};

/**
 * Editor de Word no navegador (WOPI). O frame exige um POST com o
 * access_token, enviado por um formulário oculto depois de montar.
 */
export function OnlineEditorDialog({ session, onClose }: { session: EditorSession | null; onClose: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!session?.editorUrl) return;
    const timer = window.setTimeout(() => formRef.current?.submit(), 0);
    return () => window.clearTimeout(timer);
  }, [session?.editorUrl, session?.accessToken]);

  if (!session?.editorUrl) return null;
  const title = session.readOnly ? 'Visualização do documento' : 'Edição do documento';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[94vh] w-[98vw] max-w-[98vw] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-2.5">
          <DialogTitle className="text-sm">{title} · {PROVIDER_LABEL[session.provider] ?? session.provider}</DialogTitle>
          <DialogDescription className="text-xs">
            {session.readOnly ? 'Somente leitura.' : 'As alterações são salvas automaticamente no Gestão 360. Feche quando terminar.'}
          </DialogDescription>
          {session.notice && (
            <p className="mt-1 flex items-center gap-1.5 rounded-md border border-status-yellow/40 bg-status-yellow/5 px-2.5 py-1.5 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-yellow" />
              {session.notice}
            </p>
          )}
        </DialogHeader>
        <div className="relative min-h-0 flex-1">
          <form ref={formRef} action={session.editorUrl} method="post" target="g360-editor-frame" className="hidden">
            <input type="hidden" name="access_token" value={session.accessToken ?? ''} />
            <input type="hidden" name="access_token_ttl" value={String(session.accessTokenTtl ?? 0)} />
          </form>
          <iframe name="g360-editor-frame" title={title} className="h-full w-full border-0" allow="clipboard-read; clipboard-write; fullscreen" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
