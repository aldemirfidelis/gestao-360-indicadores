'use client';

/**
 * Identidade visual da empresa: cor principal do portal e logo exibido no topo,
 * ao lado da marca Gestão 360. Vale para todos os usuários da empresa.
 */

import { useEffect, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { SectionCard } from '@/components/platform/section-card';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { BRAND_COLOR_PRESETS, brandPaletteFrom, normalizeHex } from '@/lib/brand-color';
import { companyBrandingQueryKey, useCompanyBranding } from '@/components/brand/company-branding-provider';

const DEFAULT_PREVIEW: CSSProperties = { backgroundColor: '#0a1128', borderColor: '#1b2b54', color: '#ffffff' };

export function BrandingSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const { branding, loading } = useCompanyBranding();
  const [color, setColor] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Enquanto o usuário não mexe, o formulário espelha o que está salvo.
  useEffect(() => {
    if (touched) return;
    setColor(branding?.brandColor ?? '');
    setLogo(branding?.logoUrl ?? null);
  }, [branding, touched]);

  const save = useMutation({
    mutationFn: () =>
      api('/companies/me/branding', { method: 'PATCH', json: { brandColor: color || null, logoUrl: logo } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: companyBrandingQueryKey });
      setTouched(false);
      toast.success('Identidade visual atualizada');
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível salvar a identidade visual'),
  });

  const handleLogoFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem (PNG, JPG ou SVG).');
      return;
    }
    if (file.size > 1_500_000) {
      toast.error('A imagem deve ter até 1,5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogo(String(reader.result));
      setTouched(true);
    };
    reader.onerror = () => toast.error('Não foi possível ler a imagem.');
    reader.readAsDataURL(file);
  };

  const palette = brandPaletteFrom(color);
  const previewStyle: CSSProperties = palette
    ? {
        backgroundColor: `hsl(${palette.shellBg})`,
        borderColor: `hsl(${palette.shellBorder})`,
        color: `hsl(${palette.shellForeground})`,
      }
    : DEFAULT_PREVIEW;
  const dirty = (color || null) !== (branding?.brandColor ?? null) || (logo || null) !== (branding?.logoUrl ?? null);

  if (loading) return <LoadingState />;

  return (
    <SectionCard
      title="Identidade visual"
      description="Cor principal do portal e logo da empresa no topo. Vale para todos os usuários desta empresa."
      actions={
        canManage ? (
          <div className="flex flex-wrap gap-2">
            {dirty && (
              <Button
                variant="outline"
                onClick={() => {
                  setColor(branding?.brandColor ?? '');
                  setLogo(branding?.logoUrl ?? null);
                  setTouched(false);
                }}
              >
                Descartar
              </Button>
            )}
            <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {save.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        ) : null
      }
    >
      {!canManage && (
        <p className="mb-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Você pode ver a identidade visual, mas alterá-la exige a permissão de gerenciar configurações.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div>
            <Label>Cor principal do portal</Label>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={normalizeHex(color) ?? '#0a1128'}
                disabled={!canManage}
                onChange={(event) => {
                  setColor(event.target.value);
                  setTouched(true);
                }}
                className="h-9 w-14 cursor-pointer rounded border bg-background p-1"
                aria-label="Escolher cor"
              />
              <Input
                value={color}
                disabled={!canManage}
                onChange={(event) => {
                  setColor(event.target.value);
                  setTouched(true);
                }}
                placeholder="#1B4B8F"
                className="h-9 w-36 font-mono text-sm"
              />
              {color && canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setColor('');
                    setTouched(true);
                  }}
                >
                  Usar o azul padrão
                </Button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BRAND_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  disabled={!canManage}
                  title={preset.label}
                  aria-label={preset.label}
                  onClick={() => {
                    setColor(preset.value);
                    setTouched(true);
                  }}
                  className={cn(
                    'h-7 w-7 rounded-full border shadow-sm transition-transform hover:scale-110 disabled:cursor-not-allowed',
                    normalizeHex(color) === preset.value && 'ring-2 ring-primary ring-offset-2',
                  )}
                  style={{ backgroundColor: preset.value }}
                />
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              O tom do cabeçalho e do menu é calculado a partir da cor da marca, mantendo o texto legível mesmo com
              cores claras. O conteúdo das telas segue neutro, para os dados continuarem em primeiro plano.
            </p>
          </div>

          <div>
            <Label>Logo da empresa</Label>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <div className="grid h-14 w-32 place-items-center rounded-md border bg-muted/30 p-2">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="Logo da empresa" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[11px] text-muted-foreground">Sem logo</span>
                )}
              </div>
              {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent/40">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                    Enviar imagem
                  </label>
                  {logo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setLogo(null);
                        setTouched(true);
                      }}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              PNG, JPG ou SVG de até 1,5 MB. Prefira fundo transparente e formato horizontal — o logo aparece ao lado
              da marca Gestão 360, no topo do portal.
            </p>
          </div>
        </div>

        <div>
          <Label>Prévia</Label>
          <div className="mt-1.5 overflow-hidden rounded-lg border">
            <div className="flex h-14 items-center gap-3 border-b px-4" style={previewStyle}>
              <span className="text-sm font-semibold tracking-tight">Gestão 360</span>
              {logo && (
                <>
                  <span aria-hidden className="h-5 w-px" style={{ backgroundColor: String(previewStyle.borderColor) }} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo} alt="" className="h-6 w-auto max-w-[96px] object-contain" />
                </>
              )}
              <span className="ml-auto text-[11px] opacity-70">usuário</span>
            </div>
            <div className="flex">
              <div className="w-28 shrink-0 space-y-2 p-3" style={previewStyle}>
                <div className="h-2 w-16 rounded bg-current opacity-50" />
                <div className="h-2 w-12 rounded bg-current opacity-30" />
                <div className="h-2 w-14 rounded bg-current opacity-30" />
              </div>
              <div className="flex-1 space-y-2 bg-background p-3">
                <div className="h-2 w-2/3 rounded bg-muted" />
                <div className="h-2 w-1/2 rounded bg-muted" />
                <div className="h-16 rounded border border-dashed" />
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            A mudança vale para todos os usuários da empresa assim que você salvar.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
