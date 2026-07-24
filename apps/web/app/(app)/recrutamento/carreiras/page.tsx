'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Eye, ImageIcon, Loader2, Palette, Save, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/page-header';
import { LoadingState } from '@/components/platform/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { type CareerPageConfig, careersImageUrl } from '@/lib/careers';

interface CareerPagePayload {
  company: { id: string; name: string; slug: string | null; defaultLogoUrl: string | null };
  page: CareerPageConfig;
  configured: boolean;
  publicPath: string | null;
}

export default function CareerPageEditor() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(['recruit:manage']);
  const queryClient = useQueryClient();
  const query = useQuery<CareerPagePayload>({
    queryKey: ['recruitment', 'career-page'],
    queryFn: () => api('/recruitment/career-page'),
  });
  const [form, setForm] = useState<CareerPageConfig | null>(null);

  useEffect(() => {
    if (query.data?.page) setForm(query.data.page);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => api<CareerPagePayload>('/recruitment/career-page', { method: 'PATCH', json: careerPagePayload(form) }),
    onSuccess: (payload) => {
      setForm(payload.page);
      queryClient.setQueryData(['recruitment', 'career-page'], payload);
      toast.success('Página de carreiras salva.');
    },
    onError: (reason: Error) => toast.error(reason.message || 'Não foi possível salvar a página.'),
  });

  const upload = useMutation({
    mutationFn: ({ kind, mimeType, contentBase64 }: { kind: 'logo' | 'banner'; mimeType: string; contentBase64: string }) =>
      api<CareerPagePayload>(`/recruitment/career-page/assets/${kind}`, {
        method: 'POST',
        json: { mimeType, contentBase64 },
      }),
    onSuccess: (payload) => {
      setForm(payload.page);
      queryClient.setQueryData(['recruitment', 'career-page'], payload);
      toast.success('Imagem atualizada.');
    },
    onError: (reason: Error) => toast.error(reason.message || 'Não foi possível enviar a imagem.'),
  });

  const removeAsset = useMutation({
    mutationFn: (kind: 'logo' | 'banner') =>
      api<CareerPagePayload>(`/recruitment/career-page/assets/${kind}`, { method: 'DELETE' }),
    onSuccess: (payload) => {
      setForm(payload.page);
      queryClient.setQueryData(['recruitment', 'career-page'], payload);
      toast.success('Imagem removida.');
    },
    onError: (reason: Error) => toast.error(reason.message || 'Não foi possível remover a imagem.'),
  });

  async function pickImage(kind: 'logo' | 'banner', event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const max = kind === 'banner' ? 6 * 1024 * 1024 : 2 * 1024 * 1024;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Use uma imagem PNG, JPG ou WebP.');
      return;
    }
    if (file.size > max) {
      toast.error(`A imagem deve ter no máximo ${kind === 'banner' ? '6 MB' : '2 MB'}.`);
      return;
    }
    upload.mutate({ kind, mimeType: file.type, contentBase64: await fileToBase64(file) });
  }

  if (query.isLoading || !form || !query.data) return <LoadingState label="Carregando editor da página de carreiras..." />;

  const payload = query.data;
  const previewLogo = careersImageUrl(form.logoUrl || payload.company.defaultLogoUrl);
  const previewBanner = careersImageUrl(form.bannerUrl);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Página de Carreiras"
        description="Monte a vitrine pública da sua marca empregadora. As vagas publicadas aparecem automaticamente abaixo do conteúdo configurado."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/carreiras" target="_blank">
              <Button variant="outline"><Eye className="mr-2 h-4 w-4" /> Portal global</Button>
            </Link>
            {payload.publicPath && (
              <Link href={payload.publicPath} target="_blank">
                <Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" /> Ver página pública</Button>
              </Link>
            )}
            <Button disabled={!canManage || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar página
            </Button>
          </div>
        }
      />

      {!payload.company.slug && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          A empresa ainda não possui um slug/subdomínio. A configuração pode ser preparada, mas o Portal Administrativo Global precisa definir o slug antes da publicação da URL própria.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Publicação e modelo</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <ToggleField label="Página publicada" description="Permite acessar a página própria da empresa." checked={form.published} onChange={(value) => update(setForm, 'published', value)} disabled={!canManage} />
              <ToggleField label="Divulgar no portal global" description="Inclui as vagas da empresa em /carreiras." checked={form.showInGlobalPortal} onChange={(value) => update(setForm, 'showInGlobalPortal', value)} disabled={!canManage} />
              <Field label="Modelo visual">
                <NativeSelect value={form.template} onChange={(event) => update(setForm, 'template', event.target.value)} disabled={!canManage}>
                  <option value="MODERN">Moderno — banner com destaque</option>
                  <option value="CORPORATE">Corporativo — estrutura sóbria</option>
                  <option value="MINIMAL">Minimalista — conteúdo e tipografia</option>
                </NativeSelect>
              </Field>
              <Field label="Alinhamento do destaque">
                <NativeSelect value={form.heroAlignment} onChange={(event) => update(setForm, 'heroAlignment', event.target.value)} disabled={!canManage}>
                  <option value="LEFT">À esquerda</option>
                  <option value="CENTER">Centralizado</option>
                </NativeSelect>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ImageIcon className="h-4 w-4" /> Banner e logo</CardTitle></CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <AssetField
                title="Banner"
                description="Recomendado: 1600 × 560 px, até 6 MB."
                imageUrl={form.bannerUrl}
                canManage={canManage}
                pending={upload.isPending || removeAsset.isPending}
                onPick={(event) => void pickImage('banner', event)}
                onRemove={() => removeAsset.mutate('banner')}
              />
              <AssetField
                title="Logo"
                description="PNG, JPG ou WebP, até 2 MB."
                imageUrl={form.logoUrl || payload.company.defaultLogoUrl}
                canManage={canManage}
                pending={upload.isPending || removeAsset.isPending}
                onPick={(event) => void pickImage('logo', event)}
                onRemove={() => removeAsset.mutate('logo')}
              />
              <Field label="Ou use uma URL de banner">
                <Input value={form.bannerUrl?.startsWith('/careers/') ? '' : form.bannerUrl ?? ''} onChange={(event) => update(setForm, 'bannerUrl', event.target.value)} placeholder="https://..." disabled={!canManage} />
              </Field>
              <Field label="Ou use uma URL de logo">
                <Input value={form.logoUrl?.startsWith('/careers/') ? '' : form.logoUrl ?? ''} onChange={(event) => update(setForm, 'logoUrl', event.target.value)} placeholder="https://..." disabled={!canManage} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4" /> Identidade visual</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ColorField label="Cor principal" value={form.primaryColor} onChange={(value) => update(setForm, 'primaryColor', value)} disabled={!canManage} />
              <ColorField label="Cor secundária" value={form.secondaryColor} onChange={(value) => update(setForm, 'secondaryColor', value)} disabled={!canManage} />
              <ColorField label="Cor de destaque" value={form.accentColor} onChange={(value) => update(setForm, 'accentColor', value)} disabled={!canManage} />
              <ColorField label="Fundo da página" value={form.backgroundColor} onChange={(value) => update(setForm, 'backgroundColor', value)} disabled={!canManage} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Mensagem principal</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Título de destaque">
                <Input maxLength={160} value={form.headline} onChange={(event) => update(setForm, 'headline', event.target.value)} disabled={!canManage} />
              </Field>
              <Field label="Texto de apoio">
                <Textarea rows={3} maxLength={500} value={form.subheadline} onChange={(event) => update(setForm, 'subheadline', event.target.value)} disabled={!canManage} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Conteúdo da marca empregadora</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <ContentEditor title="Sobre a empresa" enabled={form.showAbout} titleValue={form.aboutTitle} textValue={form.aboutText ?? ''} disabled={!canManage} onEnabled={(value) => update(setForm, 'showAbout', value)} onTitle={(value) => update(setForm, 'aboutTitle', value)} onText={(value) => update(setForm, 'aboutText', value)} />
              <ContentEditor title="Cultura e valores" enabled={form.showCulture} titleValue={form.cultureTitle} textValue={form.cultureText ?? ''} disabled={!canManage} onEnabled={(value) => update(setForm, 'showCulture', value)} onTitle={(value) => update(setForm, 'cultureTitle', value)} onText={(value) => update(setForm, 'cultureText', value)} />
              <ContentEditor title="Benefícios e diferenciais" enabled={form.showBenefits} titleValue={form.benefitsTitle} textValue={form.benefitsText ?? ''} disabled={!canManage} onEnabled={(value) => update(setForm, 'showBenefits', value)} onTitle={(value) => update(setForm, 'benefitsTitle', value)} onText={(value) => update(setForm, 'benefitsText', value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Contato, redes e busca</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="E-mail de contato"><Input type="email" value={form.contactEmail ?? ''} onChange={(event) => update(setForm, 'contactEmail', event.target.value)} disabled={!canManage} /></Field>
              <Field label="Site institucional"><Input value={form.websiteUrl ?? ''} onChange={(event) => update(setForm, 'websiteUrl', event.target.value)} placeholder="https://..." disabled={!canManage} /></Field>
              <Field label="LinkedIn"><Input value={form.linkedinUrl ?? ''} onChange={(event) => update(setForm, 'linkedinUrl', event.target.value)} placeholder="https://linkedin.com/company/..." disabled={!canManage} /></Field>
              <Field label="Título para buscadores"><Input maxLength={160} value={form.seoTitle ?? ''} onChange={(event) => update(setForm, 'seoTitle', event.target.value)} disabled={!canManage} /></Field>
              <div className="md:col-span-2">
                <Field label="Descrição para buscadores">
                  <Textarea rows={3} maxLength={500} value={form.seoDescription ?? ''} onChange={(event) => update(setForm, 'seoDescription', event.target.value)} disabled={!canManage} />
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="xl:sticky xl:top-20 xl:self-start">
          <Card className="overflow-hidden">
            <CardHeader className="border-b"><CardTitle className="text-base">Prévia da página</CardTitle></CardHeader>
            <div style={{ backgroundColor: form.backgroundColor }}>
              <div className="relative min-h-64 overflow-hidden p-7 text-white" style={{ backgroundColor: form.template === 'MINIMAL' ? form.backgroundColor : form.primaryColor }}>
                {previewBanner && form.template !== 'MINIMAL' && (
                  <>
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${previewBanner}")` }} />
                    <div className="absolute inset-0 bg-slate-950/65" />
                  </>
                )}
                <div className={`relative ${form.heroAlignment === 'CENTER' ? 'text-center' : ''} ${form.template === 'MINIMAL' ? 'text-slate-950' : ''}`}>
                  {previewLogo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewLogo} alt="" className={`mb-5 h-12 max-w-36 bg-white object-contain p-1 ${form.heroAlignment === 'CENTER' ? 'mx-auto' : ''}`} />
                  )}
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">Carreiras em {payload.company.name}</div>
                  <h2 className="mt-2 text-2xl font-black leading-tight">{form.headline}</h2>
                  <p className="mt-3 text-xs leading-5 opacity-80">{form.subheadline}</p>
                  <span className="mt-5 inline-block px-3 py-2 text-[10px] font-black text-white" style={{ backgroundColor: form.accentColor }}>Ver vagas abertas</span>
                </div>
              </div>
              <div className="space-y-2 p-5">
                {[1, 2, 3].map((item) => <div key={item} className="border bg-white p-3"><div className="h-2 w-2/3 bg-slate-800/80" /><div className="mt-2 h-1.5 w-1/2 bg-slate-200" /></div>)}
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function ToggleField({ label, description, checked, onChange, disabled }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void; disabled: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} className="mt-1 h-4 w-4 accent-primary" />
      <span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{description}</span></span>
    </label>
  );
}

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-10 w-12 cursor-pointer border bg-transparent p-1" />
        <Input value={value} onChange={(event) => onChange(event.target.value)} maxLength={7} disabled={disabled} className="font-mono text-xs" />
      </div>
    </Field>
  );
}

function AssetField({ title, description, imageUrl, canManage, pending, onPick, onRemove }: { title: string; description: string; imageUrl: string | null; canManage: boolean; pending: boolean; onPick: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void }) {
  const resolved = careersImageUrl(imageUrl);
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div><div className="text-sm font-semibold">{title}</div><div className="text-xs text-muted-foreground">{description}</div></div>
      <div className="flex h-28 items-center justify-center overflow-hidden rounded border bg-muted/20">
        {resolved ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolved} alt="" className="h-full w-full object-contain" />
        ) : <ImageIcon className="h-8 w-8 text-muted-foreground/40" />}
      </div>
      <div className="flex gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-xs font-semibold hover:bg-muted">
          <Upload className="mr-2 h-3.5 w-3.5" /> Enviar
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPick} disabled={!canManage || pending} className="hidden" />
        </label>
        {resolved && <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={!canManage || pending}><Trash2 className="mr-1 h-3.5 w-3.5" /> Remover</Button>}
      </div>
    </div>
  );
}

function ContentEditor({ title, enabled, titleValue, textValue, disabled, onEnabled, onTitle, onText }: { title: string; enabled: boolean; titleValue: string; textValue: string; disabled: boolean; onEnabled: (value: boolean) => void; onTitle: (value: string) => void; onText: (value: string) => void }) {
  return (
    <div className="space-y-3 border-b pb-5 last:border-0 last:pb-0">
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={enabled} onChange={(event) => onEnabled(event.target.checked)} disabled={disabled} className="h-4 w-4 accent-primary" /> Exibir {title.toLowerCase()}</label>
      <Input maxLength={160} value={titleValue} onChange={(event) => onTitle(event.target.value)} disabled={disabled || !enabled} placeholder="Título da seção" />
      <Textarea rows={5} maxLength={6000} value={textValue} onChange={(event) => onText(event.target.value)} disabled={disabled || !enabled} placeholder="Conte a história, os valores e os diferenciais da empresa. Use uma linha por item quando quiser uma lista." />
    </div>
  );
}

function update<K extends keyof CareerPageConfig>(setForm: Dispatch<SetStateAction<CareerPageConfig | null>>, key: K, value: CareerPageConfig[K]) {
  setForm((current) => current ? { ...current, [key]: value } : current);
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

function careerPagePayload(form: CareerPageConfig | null) {
  if (!form) return {};
  return {
    ...form,
    bannerUrl: form.bannerUrl?.startsWith('/careers/') ? null : form.bannerUrl,
    logoUrl: form.logoUrl?.startsWith('/careers/') ? null : form.logoUrl,
  };
}
