'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, CheckCircle2, CloudOff, Loader2, ScanLine, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { onQueueChange, pendingCount, sendOrQueue, startOfflineSync } from '@/lib/offline-queue';
import type { QrType } from '@/lib/qr';

type Phase =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'done'; ok: boolean; message: string }
  | { kind: 'occurrence'; token: string; gateId: string };

function parseScan(text: string): { type: QrType; token: string } | null {
  try {
    const u = new URL(text);
    const type = u.searchParams.get('type');
    const token = u.searchParams.get('token');
    if ((type === 'checkpoint' || type === 'form' || type === 'occurrence') && token) return { type, token };
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
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [scanning, setScanning] = useState(false);
  const [pending, setPending] = useState(0);
  const [occ, setOcc] = useState({ title: '', description: '', severity: 'MEDIUM' });
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    startOfflineSync();
    const refresh = () => { void pendingCount().then(setPending); };
    refresh();
    const off = onQueueChange(refresh);
    const onOnline = () => refresh();
    window.addEventListener('online', onOnline);
    return () => { off(); window.removeEventListener('online', onOnline); };
  }, []);

  async function stopScanner() {
    const s = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (s) { try { await s.stop(); s.clear(); } catch { /* ignore */ } }
  }

  function resetForNext() {
    handledRef.current = false;
    setPhase({ kind: 'idle' });
    setOcc({ title: '', description: '', severity: 'MEDIUM' });
  }

  async function handleScan(type: QrType, token: string) {
    if (handledRef.current) return;
    handledRef.current = true;
    setPhase({ kind: 'resolving' });
    await stopScanner();
    try {
      if (type === 'form') {
        const r = await api<{ valid: boolean; templateId?: string; title?: string }>(`/forms/qrcode/validate/${encodeURIComponent(token)}`);
        if (!r.valid || !r.templateId) throw new Error('QR de formulário inválido ou inativo.');
        setPhase({ kind: 'done', ok: true, message: `Abrindo formulário: ${r.title ?? ''}` });
        router.push(`/forms?fill=${r.templateId}`);
        return;
      }
      const r = await api<{ valid: boolean; qr?: { entityType: string; entityId: string; purpose: string } }>(`/asset-security/qrcodes/validate/${encodeURIComponent(token)}`);
      if (!r.valid || !r.qr) throw new Error('QR inválido, expirado ou inativo.');
      if (type === 'occurrence') {
        setPhase({ kind: 'occurrence', token, gateId: r.qr.entityId });
        return;
      }
      // checkpoint: registra a passagem (online) ou enfileira (offline)
      const res = await sendOrQueue({
        path: `/asset-security/round-checkpoints/${encodeURIComponent(r.qr.entityId)}/scan`,
        body: {},
        label: 'Passagem em ponto de ronda',
      });
      setPhase({
        kind: 'done',
        ok: true,
        message: res.status === 'sent'
          ? `Ponto registrado: ${(res.result as any)?.checkpointName ?? 'OK'} (${(res.result as any)?.visitedCount ?? '?'} no total).`
          : 'Sem internet: passagem guardada e será enviada ao reconectar.',
      });
    } catch (e: any) {
      setPhase({ kind: 'done', ok: false, message: e?.message ?? 'Não foi possível processar o QR.' });
    }
  }

  async function submitOccurrence() {
    if (phase.kind !== 'occurrence') return;
    if (!occ.title.trim()) { setPhase({ kind: 'done', ok: false, message: 'Informe um título para a ocorrência.' }); return; }
    const localId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `occ_${Date.now()}`;
    setPhase({ kind: 'resolving' });
    try {
      const res = await sendOrQueue({
        id: localId,
        path: '/asset-security/offline-sync',
        body: {
          records: [{
            localId,
            entityType: 'INCIDENT',
            operation: 'CREATE',
            payload: { title: occ.title.trim(), description: occ.description.trim() || undefined, severity: occ.severity, gateId: (phase as any).gateId },
            localCreatedAt: new Date().toISOString(),
          }],
        },
        label: `Ocorrência: ${occ.title.trim()}`,
      });
      setPhase({
        kind: 'done',
        ok: true,
        message: res.status === 'sent'
          ? 'Ocorrência registrada com sucesso.'
          : 'Sem internet: ocorrência guardada e será enviada ao reconectar.',
      });
    } catch (e: any) {
      setPhase({ kind: 'done', ok: false, message: e?.message ?? 'Falha ao registrar ocorrência.' });
    }
  }

  // Deep-link (câmera nativa): resolve direto.
  useEffect(() => {
    const type = params.get('type');
    const token = params.get('token');
    if ((type === 'checkpoint' || type === 'form' || type === 'occurrence') && token) void handleScan(type, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { void stopScanner(); }, []);

  async function startScanner() {
    resetForNext();
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
          if (parsed) void handleScan(parsed.type, parsed.token);
        },
        () => { /* sem QR no frame: ignorar */ },
      );
    } catch {
      setScanning(false);
      setPhase({ kind: 'done', ok: false, message: 'Não foi possível acessar a câmera. Verifique as permissões do navegador.' });
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader
        eyebrow="Operação móvel"
        title="Escanear QR Code"
        description="Aponte a câmera para o QR do ponto de ronda, formulário ou portaria."
      />

      {pending > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          <CloudOff className="h-4 w-4" />
          {pending} registro(s) aguardando internet para sincronizar.
        </div>
      )}

      <div id="qr-reader" className="overflow-hidden rounded-xl border bg-muted/20 [&_video]:rounded-xl" />

      {phase.kind === 'occurrence' && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><ScanLine className="h-4 w-4 text-primary" />Registrar ocorrência</div>
          <div className="space-y-1">
            <Label>Título</Label>
            <Input value={occ.title} onChange={(e) => setOcc((o) => ({ ...o, title: e.target.value }))} placeholder="Ex.: Tentativa de acesso não autorizado" />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea rows={3} value={occ.description} onChange={(e) => setOcc((o) => ({ ...o, description: e.target.value }))} placeholder="O que aconteceu?" />
          </div>
          <div className="space-y-1">
            <Label>Gravidade</Label>
            <NativeSelect value={occ.severity} onChange={(e) => setOcc((o) => ({ ...o, severity: e.target.value }))}>
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="CRITICAL">Crítica</option>
            </NativeSelect>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={resetForNext}>Cancelar</Button>
            <Button className="flex-1" onClick={submitOccurrence}>Registrar</Button>
          </div>
        </div>
      )}

      {phase.kind === 'resolving' && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Processando…</p>
      )}
      {phase.kind === 'done' && (
        <div className="space-y-2">
          <p className={`flex items-center justify-center gap-2 text-sm ${phase.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
            {phase.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{phase.message}
          </p>
          <Button className="w-full" onClick={startScanner}><Camera className="mr-2 h-4 w-4" />Escanear novamente</Button>
        </div>
      )}
      {phase.kind === 'idle' && !scanning && (
        <Button className="w-full" onClick={startScanner}><Camera className="mr-2 h-4 w-4" />Abrir câmera</Button>
      )}
      {scanning && <Button variant="outline" className="w-full" onClick={stopScanner}>Parar</Button>}
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
