'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { QrType } from '@/lib/qr';

type Resolution = { status: 'idle' | 'resolving' | 'ok' | 'error'; message?: string };

/** Aceita tanto a URL deep-link (.../scan?type=..&token=..) quanto "type:token" cru. */
function parseScan(text: string): { type: QrType; token: string } | null {
  try {
    const u = new URL(text);
    const type = u.searchParams.get('type');
    const token = u.searchParams.get('token');
    if ((type === 'checkpoint' || type === 'form' || type === 'occurrence') && token) {
      return { type, token };
    }
  } catch {
    /* não é URL */
  }
  const m = text.match(/^(checkpoint|form|occurrence):(.+)$/);
  if (m) return { type: m[1] as QrType, token: m[2] };
  return null;
}

function ScanInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [res, setRes] = useState<Resolution>({ status: 'idle' });
  const [scanning, setScanning] = useState(false);
  // html5-qrcode é carregado dinamicamente (browser-only); guardamos a instância.
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const handledRef = useRef(false);

  async function stopScanner() {
    const s = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (s) {
      try { await s.stop(); s.clear(); } catch { /* ignore */ }
    }
  }

  async function resolveAndRoute(type: QrType, token: string) {
    if (handledRef.current) return;
    handledRef.current = true;
    setRes({ status: 'resolving' });
    await stopScanner();
    try {
      if (type === 'form') {
        const r = await api<{ valid: boolean; templateId?: string; title?: string }>(`/forms/qrcode/validate/${encodeURIComponent(token)}`);
        if (!r.valid || !r.templateId) throw new Error('QR de formulário inválido ou inativo.');
        setRes({ status: 'ok', message: `Abrindo formulário: ${r.title ?? ''}` });
        router.push(`/forms?fill=${r.templateId}`);
        return;
      }
      const r = await api<{ valid: boolean; qr?: { entityType: string; entityId: string; purpose: string } }>(`/asset-security/qrcodes/validate/${encodeURIComponent(token)}`);
      if (!r.valid || !r.qr) throw new Error('QR inválido, expirado ou inativo.');
      const dest = type === 'checkpoint'
        ? `/seguranca-patrimonial?scan=checkpoint&token=${encodeURIComponent(token)}&entityId=${encodeURIComponent(r.qr.entityId)}`
        : `/seguranca-patrimonial?scan=occurrence&token=${encodeURIComponent(token)}&gateId=${encodeURIComponent(r.qr.entityId)}`;
      setRes({ status: 'ok', message: 'QR reconhecido. Abrindo...' });
      router.push(dest);
    } catch (e: any) {
      handledRef.current = false;
      setRes({ status: 'error', message: e?.message ?? 'Não foi possível resolver o QR.' });
    }
  }

  // Aberto pela câmera nativa do celular (deep-link): resolve direto, sem re-escanear.
  useEffect(() => {
    const type = params.get('type');
    const token = params.get('token');
    if ((type === 'checkpoint' || type === 'form' || type === 'occurrence') && token) {
      void resolveAndRoute(type, token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { void stopScanner(); }, []);

  async function startScanner() {
    setRes({ status: 'idle' });
    handledRef.current = false;
    setScanning(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded: string) => {
          const parsed = parseScan(decoded);
          if (parsed) void resolveAndRoute(parsed.type, parsed.token);
        },
        () => { /* leituras sem QR: ignorar */ },
      );
    } catch {
      setScanning(false);
      setRes({ status: 'error', message: 'Não foi possível acessar a câmera. Verifique as permissões do navegador.' });
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader
        eyebrow="Operação móvel"
        title="Escanear QR Code"
        description="Aponte a câmera para o QR do ponto de ronda, formulário ou portaria."
      />
      <div id="qr-reader" className="overflow-hidden rounded-xl border bg-muted/20 [&_video]:rounded-xl" />
      {!scanning && res.status !== 'resolving' && (
        <Button className="w-full" onClick={startScanner}>
          <Camera className="mr-2 h-4 w-4" />{res.status === 'error' ? 'Tentar de novo' : 'Abrir câmera'}
        </Button>
      )}
      {scanning && <Button variant="outline" className="w-full" onClick={stopScanner}>Parar</Button>}
      {res.status === 'resolving' && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Resolvendo QR…</p>
      )}
      {res.status === 'ok' && (
        <p className="flex items-center justify-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />{res.message}</p>
      )}
      {res.status === 'error' && (
        <p className="flex items-center justify-center gap-2 text-sm text-rose-600"><XCircle className="h-4 w-4" />{res.message}</p>
      )}
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando…</div>}>
      <ScanInner />
    </Suspense>
  );
}
