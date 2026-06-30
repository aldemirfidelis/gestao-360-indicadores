'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QrCode } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { QrPrintDialog } from '@/components/qr/qr-print-dialog';
import type { QrType } from '@/lib/qr';

interface Gate { id: string; name: string }
interface Checkpoint { id: string; name: string }
interface Route { id: string; name: string; checkpoints?: Checkpoint[] }

/**
 * Geração/impressão de QR Codes para o campo: portarias (registrar ocorrência) e
 * pontos de ronda (registrar passagem). O QR carrega um deep-link para /scan; o
 * vigilante escaneia pelo celular (funciona offline e sincroniza ao reconectar).
 */
export function SecurityQrGeneratorSection() {
  const gates = useQuery<Gate[]>({ queryKey: ['asset-security', 'gates'], queryFn: () => api('/asset-security/gates') });
  const routes = useQuery<Route[]>({ queryKey: ['asset-security', 'round-routes'], queryFn: () => api('/asset-security/round-routes') });
  const [qr, setQr] = useState<{ type: QrType; token: string; title: string; subtitle?: string } | null>(null);

  const generate = useMutation({
    mutationFn: (v: { entityType: string; entityId: string; purpose: string }) =>
      api<{ token: string }>('/asset-security/qrcodes', { method: 'POST', json: v }),
  });

  async function gen(type: QrType, entityType: string, entityId: string, purpose: string, title: string, subtitle?: string) {
    try {
      const r = await generate.mutateAsync({ entityType, entityId, purpose });
      setQr({ type, token: r.token, title, subtitle });
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao gerar QR Code');
    }
  }

  const hasCheckpoints = (routes.data ?? []).some((r) => (r.checkpoints ?? []).length > 0);

  return (
    <SectionCard
      title="QR Codes para o campo"
      description="Gere e imprima os QR Codes para colar nas portarias e pontos de ronda. O vigilante escaneia pelo celular (funciona sem internet e sincroniza ao reconectar)."
    >
      <div className="grid gap-6 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portarias — registrar ocorrência</div>
          {(gates.data ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground">Nenhuma portaria cadastrada.</div>
          ) : (
            (gates.data ?? []).map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="truncate">{g.name}</span>
                <Button size="sm" variant="outline" disabled={generate.isPending} onClick={() => gen('occurrence', 'GATE', g.id, 'OCCURRENCE', g.name, 'Escaneie para registrar uma ocorrência')}>
                  <QrCode className="mr-1.5 h-3.5 w-3.5" />Gerar QR
                </Button>
              </div>
            ))
          )}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pontos de ronda — registrar passagem</div>
          {!hasCheckpoints ? (
            <div className="text-xs text-muted-foreground">Nenhum ponto de ronda cadastrado.</div>
          ) : (
            (routes.data ?? []).map((r) => (
              <div key={r.id} className="space-y-1">
                {(r.checkpoints ?? []).length > 0 && <div className="text-[11px] font-medium text-muted-foreground">{r.name}</div>}
                {(r.checkpoints ?? []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <span className="truncate">{c.name}</span>
                    <Button size="sm" variant="outline" disabled={generate.isPending} onClick={() => gen('checkpoint', 'ROUND_CHECKPOINT', c.id, 'CHECKPOINT', c.name, `Ponto da ronda: ${r.name}`)}>
                      <QrCode className="mr-1.5 h-3.5 w-3.5" />Gerar QR
                    </Button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
      {qr && <QrPrintDialog open onOpenChange={(v) => !v && setQr(null)} type={qr.type} token={qr.token} title={qr.title} subtitle={qr.subtitle} />}
    </SectionCard>
  );
}
