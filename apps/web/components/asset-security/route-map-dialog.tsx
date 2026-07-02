'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Crosshair, ImagePlus, MapPin, Printer, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrPrintDialog } from '@/components/qr/qr-print-dialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { AnyRecord } from '@/lib/asset-security/types';

/**
 * Mapa da rota de ronda: a empresa sobe a planta (imagem) e posiciona os
 * pontos de controle clicando sobre o mapa. Os pontos ficam ligados na ordem
 * da ronda e cada um mantém seu QR Code para leitura em campo.
 */
export function RouteMapDialog({ route, canManage, onClose }: { route: AnyRecord; canManage: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [placing, setPlacing] = useState<string | null>(null); // checkpointId em modo "posicionar"
  const [qr, setQr] = useState<{ token: string; title: string } | null>(null);

  const checkpoints = useMemo(
    () => ((route.checkpoints ?? []) as AnyRecord[]).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [route.checkpoints],
  );
  const placed = checkpoints.filter((c) => c.mapX != null && c.mapY != null);
  const unplaced = checkpoints.filter((c) => c.mapX == null || c.mapY == null);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['asset-security', 'round-routes'] });

  const saveMap = useMutation({
    mutationFn: (mapImage: string | null) => api(`/asset-security/round-routes/${route.id}`, { method: 'PATCH', json: { mapImage } }),
    onSuccess: () => { toast.success('Mapa da rota atualizado'); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar o mapa'),
  });

  const placeCheckpoint = useMutation({
    mutationFn: ({ id, mapX, mapY }: { id: string; mapX: number | null; mapY: number | null }) =>
      api(`/asset-security/round-checkpoints/${id}`, { method: 'PATCH', json: { mapX, mapY } }),
    onSuccess: () => { invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao posicionar o ponto'),
  });

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Envie uma imagem (planta/croqui da área).');
      return;
    }
    try {
      const dataUrl = await resizeImage(file, 1600, 0.85);
      saveMap.mutate(dataUrl);
    } catch {
      toast.error('Não foi possível processar a imagem.');
    }
  }

  function handleMapClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!placing || !canManage) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const mapX = Math.round(((event.clientX - rect.left) / rect.width) * 1000) / 10;
    const mapY = Math.round(((event.clientY - rect.top) / rect.height) * 1000) / 10;
    const target = checkpoints.find((c) => c.id === placing);
    placeCheckpoint.mutate({ id: placing, mapX, mapY });
    toast.success(`"${target?.name ?? 'Ponto'}" posicionado no mapa`);
    setPlacing(null);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-sky-600" />Mapa da rota — {route.name}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
          {/* Mapa */}
          <div>
            {!route.mapImage ? (
              <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-muted/20 p-8 text-center">
                <ImagePlus className="h-10 w-10 text-muted-foreground/60" />
                <div className="text-sm font-semibold">Suba a planta da empresa ou o croqui da área</div>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Depois do upload, clique em "Posicionar" em cada ponto de controle e marque o local exato no mapa.
                  A rota fica ligada na ordem da ronda.
                </p>
                {canManage && (
                  <Button size="sm" onClick={() => fileRef.current?.click()} disabled={saveMap.isPending}>
                    <ImagePlus className="mr-1.5 h-4 w-4" />{saveMap.isPending ? 'Enviando…' : 'Enviar imagem do mapa'}
                  </Button>
                )}
              </div>
            ) : (
              <div>
                <div
                  className={cn('relative select-none overflow-hidden rounded-xl border bg-slate-100 dark:bg-slate-900', placing && 'cursor-crosshair ring-2 ring-sky-500')}
                  onClick={handleMapClick}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={route.mapImage} alt={`Mapa da rota ${route.name}`} className="block h-auto w-full" draggable={false} />

                  {/* Linha da rota ligando os pontos na ordem */}
                  {placed.length > 1 && (
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polyline
                        points={placed.map((c) => `${c.mapX},${c.mapY}`).join(' ')}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth="0.45"
                        strokeDasharray="1.4 1"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                    </svg>
                  )}

                  {/* Pinos numerados */}
                  {placed.map((cp, index) => (
                    <button
                      key={cp.id}
                      type="button"
                      title={`${index + 1}. ${cp.name}${cp.location ? ` — ${cp.location}` : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (placing === cp.id) { setPlacing(null); return; }
                        if (cp.qrCodeToken) setQr({ token: cp.qrCodeToken, title: cp.name });
                      }}
                      className={cn(
                        'absolute z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-md transition-transform hover:scale-110',
                        placing === cp.id ? 'bg-amber-500' : 'bg-sky-600',
                      )}
                      style={{ left: `${cp.mapX}%`, top: `${cp.mapY}%` }}
                    >
                      {index + 1}
                    </button>
                  ))}

                  {placing && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-sky-600/90 px-3 py-1.5 text-center text-xs font-semibold text-white">
                      Clique no mapa para posicionar: {checkpoints.find((c) => c.id === placing)?.name}
                    </div>
                  )}
                </div>
                {canManage && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={saveMap.isPending}>
                      <ImagePlus className="mr-1.5 h-3.5 w-3.5" />Trocar imagem
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-status-red"
                      onClick={() => { if (window.confirm('Remover o mapa desta rota? As posições dos pontos serão mantidas.')) saveMap.mutate(null); }}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />Remover mapa
                    </Button>
                  </div>
                )}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { void handleFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
            />
          </div>

          {/* Pontos de controle */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pontos da ronda ({checkpoints.length})
            </div>
            {checkpoints.length === 0 && (
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Cadastre os pontos de controle na rota para plotá-los no mapa.
              </p>
            )}
            {checkpoints.map((cp, index) => {
              const isPlaced = cp.mapX != null && cp.mapY != null;
              return (
                <div key={cp.id} className={cn('rounded-lg border p-2.5 text-xs', placing === cp.id && 'border-amber-400 bg-amber-50 dark:bg-amber-950/20')}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white', isPlaced ? 'bg-sky-600' : 'bg-slate-400')}>{index + 1}</span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{cp.name}</div>
                        {cp.location && <div className="truncate text-[10px] text-muted-foreground">{cp.location}</div>}
                      </div>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0 text-[9px]', isPlaced ? 'border-emerald-300 text-emerald-600' : 'border-slate-300 text-slate-500')}>
                      {isPlaced ? 'No mapa' : 'Sem posição'}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {canManage && route.mapImage && (
                      <Button size="sm" variant={placing === cp.id ? 'default' : 'outline'} className="h-6 px-2 text-[10px]" onClick={() => setPlacing(placing === cp.id ? null : cp.id)}>
                        <Crosshair className="mr-1 h-3 w-3" />{placing === cp.id ? 'Cancelar' : isPlaced ? 'Reposicionar' : 'Posicionar'}
                      </Button>
                    )}
                    {canManage && isPlaced && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => placeCheckpoint.mutate({ id: cp.id, mapX: null, mapY: null })}>
                        Tirar do mapa
                      </Button>
                    )}
                    {cp.qrCodeToken && (
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setQr({ token: cp.qrCodeToken, title: cp.name })}>
                        <Printer className="mr-1 h-3 w-3" />QR Code
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {unplaced.length > 0 && route.mapImage && (
              <p className="text-[10px] text-muted-foreground">
                {unplaced.length} ponto(s) ainda sem posição no mapa — use "Posicionar" e clique no local exato.
              </p>
            )}
          </div>
        </div>

        {qr && (
          <QrPrintDialog
            open
            onOpenChange={(open) => !open && setQr(null)}
            type="checkpoint"
            token={qr.token}
            title={qr.title}
            subtitle="Escaneie durante a ronda para registrar a passagem"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Redimensiona a imagem no cliente (máx. lado maior = maxSize) e devolve data URL JPEG. */
function resizeImage(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
    img.src = url;
  });
}
