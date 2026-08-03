'use client';

/**
 * Cabeçalho (faixa PNG) da apresentação da Reunião Mensal.
 *
 * A faixa é da empresa (cada uma sobe a sua) e vale SÓ para as telas de
 * apresentação deste módulo — o Painel Executivo e o detalhe do indicador
 * abertos fora da Reunião Mensal continuam sem cabeçalho.
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface PresentationBranding {
  imageDataUrl: string | null;
  fileName: string | null;
  enabled: boolean;
  showTitle: boolean;
  titleAlign: 'left' | 'center' | 'right';
  titleColor: 'light' | 'dark';
  updatedAt?: string | null;
}

const BRANDING_KEY = ['monthly-presentation-branding'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function usePresentationBranding() {
  return useQuery<PresentationBranding>({
    queryKey: BRANDING_KEY,
    queryFn: () => api<PresentationBranding>('/monthly-results/presentation-branding'),
    staleTime: 5 * 60 * 1000,
  });
}

/** Faixa exibida no topo das telas de apresentação (painel executivo e indicador). */
export function PresentationHeaderBanner({ branding, title }: { branding?: PresentationBranding; title?: string }) {
  if (!branding?.enabled || !branding.imageDataUrl) return null;
  const showTitle = branding.showTitle && Boolean(title?.trim());
  return (
    <div className="relative w-full overflow-hidden rounded-lg border bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={branding.imageDataUrl} alt="Cabeçalho da apresentação" className="block w-full" />
      {showTitle && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 flex items-center px-[4%]',
            branding.titleAlign === 'center' ? 'justify-center' : branding.titleAlign === 'right' ? 'justify-end' : 'justify-start',
          )}
        >
          {/* Tamanho de projeção: precisa ser legível no fundo da sala. */}
          <span
            className={cn(
              'max-w-[78%] truncate text-[clamp(1.5rem,3.8vw,3.5rem)] font-bold uppercase leading-tight tracking-wide drop-shadow-sm',
              branding.titleColor === 'dark' ? 'text-slate-900' : 'text-white',
            )}
          >
            {title}
          </span>
        </div>
      )}
    </div>
  );
}

/** Editor do cabeçalho (aba Configurar da reunião). */
export function PresentationHeaderSettings({ canUpdate }: { canUpdate: boolean }) {
  const qc = useQueryClient();
  const branding = usePresentationBranding();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<PresentationBranding | null>(null);

  useEffect(() => {
    if (branding.data) setDraft(branding.data);
  }, [branding.data]);

  const save = useMutation({
    mutationFn: (payload: Partial<PresentationBranding>) =>
      api<PresentationBranding>('/monthly-results/presentation-branding', { method: 'PUT', json: payload }),
    onSuccess: (data) => {
      qc.setQueryData(BRANDING_KEY, data);
      setDraft(data);
      toast.success('Cabeçalho da apresentação salvo');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const current = draft ?? branding.data ?? null;

  function pickFile(file: File | null) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Envie uma imagem PNG, JPG ou WEBP.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('A imagem do cabeçalho deve ter até 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast.error('Não foi possível ler a imagem.');
    reader.onload = () =>
      save.mutate({ imageDataUrl: String(reader.result ?? ''), fileName: file.name, enabled: true });
    reader.readAsDataURL(file);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cabeçalho da apresentação</CardTitle>
        <p className="text-xs text-muted-foreground">
          Faixa em PNG (com a marca da empresa) exibida no topo do painel executivo e do detalhe do indicador durante a
          apresentação da reunião. Vale para todas as reuniões mensais da empresa e não aparece fora deste módulo.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {branding.isLoading && <p className="text-sm text-muted-foreground">Carregando cabeçalho…</p>}

        {current?.imageDataUrl ? (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-lg border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.imageDataUrl} alt="Prévia do cabeçalho" className="block w-full" />
            </div>
            <p className="text-xs text-muted-foreground">{current.fileName ?? 'Cabeçalho enviado'}</p>
          </div>
        ) : (
          !branding.isLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <ImageIcon className="h-4 w-4 shrink-0" />
              Nenhum cabeçalho enviado. A apresentação segue sem faixa.
            </div>
          )
        )}

        {canUpdate && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {current?.imageDataUrl ? 'Trocar imagem' : 'Enviar imagem'}
              </Button>
              {current?.imageDataUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={save.isPending}
                  onClick={() => save.mutate({ imageDataUrl: '', fileName: '', enabled: false })}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Remover
                </Button>
              )}
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={Boolean(current?.enabled)}
                  disabled={!current?.imageDataUrl || save.isPending}
                  onChange={(e) => save.mutate({ enabled: e.target.checked })}
                />
                Exibir o cabeçalho na apresentação da reunião
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={Boolean(current?.showTitle)}
                  disabled={!current?.imageDataUrl || save.isPending}
                  onChange={(e) => save.mutate({ showTitle: e.target.checked })}
                />
                Escrever o título da tela sobre a faixa
              </label>
              {current?.showTitle && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Posição do título</Label>
                    <NativeSelect
                      className="mt-1"
                      value={current?.titleAlign ?? 'left'}
                      disabled={save.isPending}
                      onChange={(e) => save.mutate({ titleAlign: e.target.value as PresentationBranding['titleAlign'] })}
                    >
                      <option value="left">Esquerda</option>
                      <option value="center">Centro</option>
                      <option value="right">Direita</option>
                    </NativeSelect>
                  </div>
                  <div>
                    <Label className="text-xs">Cor do título</Label>
                    <NativeSelect
                      className="mt-1"
                      value={current?.titleColor ?? 'light'}
                      disabled={save.isPending}
                      onChange={(e) => save.mutate({ titleColor: e.target.value as PresentationBranding['titleColor'] })}
                    >
                      <option value="light">Claro (faixa escura)</option>
                      <option value="dark">Escuro (faixa clara)</option>
                    </NativeSelect>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
