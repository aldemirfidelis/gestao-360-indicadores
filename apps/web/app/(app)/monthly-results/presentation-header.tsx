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
  /** Corpo dos rótulos de dados dos gráficos na apresentação (px). */
  chartLabelSize: number;
  updatedAt?: string | null;
}

const BRANDING_KEY = ['monthly-presentation-branding'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const CHART_LABEL_SIZE_MIN = 8;
export const CHART_LABEL_SIZE_MAX = 32;
export const CHART_LABEL_SIZE_DEFAULT = 10;

export function usePresentationBranding() {
  return useQuery<PresentationBranding>({
    queryKey: BRANDING_KEY,
    queryFn: () => api<PresentationBranding>('/monthly-results/presentation-branding'),
    staleTime: 5 * 60 * 1000,
  });
}

/** Salva a configuração da apresentação (faixa e gráficos compartilham o registro). */
function usePresentationBrandingSave(okMessage: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<PresentationBranding>) =>
      api<PresentationBranding>('/monthly-results/presentation-branding', { method: 'PUT', json: payload }),
    onSuccess: (data) => {
      qc.setQueryData(BRANDING_KEY, data);
      toast.success(okMessage);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * Corpo do título sobre a faixa.
 *
 * O nome inteiro da área tem que aparecer — cortar com reticências esconde
 * justamente o que a faixa anuncia. A solução é quebrar linha, mantendo o
 * tamanho de projeção: em duas linhas o texto ainda cabe folgado na altura da
 * faixa. Só um título realmente longo (que passaria de duas linhas e vazaria
 * para fora da imagem) desce um degrau de fonte — e mesmo aí segue grande.
 */
function titleSizeClass(title: string): string {
  const length = title.trim().length;
  if (length <= 42) return 'text-[clamp(1.5rem,3.6vw,3.25rem)]';
  if (length <= 70) return 'text-[clamp(1.25rem,2.9vw,2.6rem)]';
  return 'text-[clamp(1rem,2.2vw,2rem)]';
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
          <span
            className={cn(
              'max-w-[78%] break-words font-bold uppercase leading-tight tracking-wide drop-shadow-sm',
              branding.titleAlign === 'center' ? 'text-center' : branding.titleAlign === 'right' ? 'text-right' : 'text-left',
              titleSizeClass(title ?? ''),
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
  const branding = usePresentationBranding();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<PresentationBranding | null>(null);

  useEffect(() => {
    if (branding.data) setDraft(branding.data);
  }, [branding.data]);

  const save = usePresentationBrandingSave('Cabeçalho da apresentação salvo');
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

/**
 * Tamanho dos rótulos de dados dos gráficos da apresentação.
 *
 * O corpo bom depende do projetor e do tamanho da sala — não dá para acertar um
 * número fixo que sirva a todas. Vale só para a apresentação da Reunião Mensal;
 * o detalhe do indicador aberto fora dela mantém o corpo de tela de trabalho.
 */
export function PresentationChartSettings({ canUpdate }: { canUpdate: boolean }) {
  const branding = usePresentationBranding();
  const save = usePresentationBrandingSave('Tamanho dos rótulos salvo');
  const salvo = branding.data?.chartLabelSize ?? CHART_LABEL_SIZE_DEFAULT;
  const [size, setSize] = useState(salvo);

  useEffect(() => setSize(salvo), [salvo]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rótulos dos gráficos na apresentação</CardTitle>
        <p className="text-xs text-muted-foreground">
          Corpo dos números escritos sobre as barras e pontos do gráfico do indicador durante a apresentação. Aumente
          para projetar em sala grande; diminua quando os valores começarem a se encostar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="range"
            min={CHART_LABEL_SIZE_MIN}
            max={CHART_LABEL_SIZE_MAX}
            step={1}
            value={size}
            disabled={!canUpdate || save.isPending}
            onChange={(e) => setSize(Number(e.target.value))}
            onMouseUp={() => size !== salvo && save.mutate({ chartLabelSize: size })}
            onTouchEnd={() => size !== salvo && save.mutate({ chartLabelSize: size })}
            onKeyUp={() => size !== salvo && save.mutate({ chartLabelSize: size })}
            className="h-2 min-w-[220px] flex-1 cursor-pointer accent-primary"
            aria-label="Tamanho do rótulo de dados"
          />
          <span className="w-14 shrink-0 text-sm font-medium tabular-nums">{size} px</span>
          {canUpdate && size !== salvo && (
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ chartLabelSize: size })}>
              Salvar
            </Button>
          )}
          {canUpdate && salvo !== CHART_LABEL_SIZE_DEFAULT && (
            <Button size="sm" variant="ghost" disabled={save.isPending} onClick={() => save.mutate({ chartLabelSize: CHART_LABEL_SIZE_DEFAULT })}>
              Voltar ao padrão
            </Button>
          )}
        </div>
        {/* Prévia: o mesmo desenho do rótulo sobre a barra, no corpo escolhido. */}
        <div className="flex items-end gap-4 rounded-md border bg-muted/20 p-4">
          <div className="flex flex-col items-center gap-1">
            <span style={{ fontSize: `${size}px` }} className="font-semibold leading-none text-foreground">100</span>
            <span className="h-12 w-8 rounded-t bg-status-blue/80" />
            <span className="text-[10px] text-muted-foreground">Meta</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span style={{ fontSize: `${size}px` }} className="font-semibold leading-none text-foreground">85,5</span>
            <span className="h-9 w-8 rounded-t bg-status-red/80" />
            <span className="text-[10px] text-muted-foreground">Realizado</span>
          </div>
          <p className="text-xs text-muted-foreground">Prévia do rótulo no tamanho escolhido.</p>
        </div>
      </CardContent>
    </Card>
  );
}
