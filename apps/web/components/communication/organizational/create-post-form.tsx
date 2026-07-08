'use client';

// Extraido de app/(app)/comunicacao/page.tsx (decomposicao Fase 4).
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Crop, FileText, FileUp, Film, HelpCircle, Image as ImageIcon, ImagePlus, Link2, PlaySquare, Send, SlidersHorizontal, Sparkles, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  adjustedImageName,
  base64ByteSize,
  BOOLEAN_FIELDS,
  CHANNELS,
  drawAdjustedImage,
  IMAGE_PRESETS,
  inferVideoMime,
  isImageMedia,
  isPlayableVideoUrl,
  isVideoMedia,
  MAX_COMMUNICATION_MEDIA_BYTES,
  PRIORITY_LABEL,
  readFileAsDataUrl,
  stripDataUrl,
  toggle,
  TYPE_LABEL,
  type AdjustedImageUpload,
  type AudienceScope,
  type ChannelConfig,
  type CommunicationForm,
  type CommunicationOverview,
  type MediaItem,
  type MediaUploadPayload,
  type PostType,
  type Priority,
  type TemplateItem,
  type UploadMediaFn,
} from './shared';
import { Field, MultiCheck, PriorityBadge } from './shared-widgets';
import { MediaPreview } from './media-preview';

export interface CreatePostFormProps {
  form: CommunicationForm;
  setForm: React.Dispatch<React.SetStateAction<CommunicationForm>>;
  overview?: CommunicationOverview;
  aiPrompt: string;
  setAiPrompt: React.Dispatch<React.SetStateAction<string>>;
  generateAi: () => void;
  saving: boolean;
  uploadMedia: UploadMediaFn;
  uploadingMedia: boolean;
  onSubmit: () => void;
}

export function CreatePostForm({ form, setForm, overview, aiPrompt, setAiPrompt, generateAi, saving, uploadMedia, uploadingMedia, onSubmit }: CreatePostFormProps) {
  const users = overview?.audienceOptions.users ?? [];
  const areas = overview?.audienceOptions.areas ?? [];
  const templates = overview?.templates ?? [];
  const applyTemplate = (template: TemplateItem) => {
    setForm((current) => ({
      ...current,
      type: template.type,
      category: template.category || current.category,
      title: current.title || template.titlePattern,
      content: current.content ? current.content : template.contentPattern,
    }));
    toast.success(`Template "${template.name}" aplicado`);
  };
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Editor visual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates.length > 0 && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Biblioteca de templates
              </div>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    title={`${TYPE_LABEL[template.type]} · ${template.tone}`}
                    className="rounded-full border bg-card px-3 py-1 text-xs font-medium transition hover:border-primary hover:bg-primary/5"
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Tipo">
              <NativeSelect value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as PostType })}>
                {Object.entries(TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Prioridade">
              <NativeSelect value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>
                {Object.entries(PRIORITY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Título" className="md:col-span-2">
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label="Subtítulo" className="md:col-span-2">
              <Input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} />
            </Field>
            <Field label="Categoria">
              <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </Field>
            <Field label="Validade">
              <Input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
            </Field>
            <Field label="Conteúdo" className="md:col-span-2">
              <Textarea rows={8} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
            </Field>
            <PostMediaFields
              form={form}
              setForm={setForm}
              media={overview?.media ?? []}
              uploadMedia={uploadMedia}
              uploadingMedia={uploadingMedia}
            />
            <Field label="Imagem / banner">
              <Input value={form.coverImageUrl} onChange={(event) => setForm({ ...form, coverImageUrl: event.target.value })} />
            </Field>
            <Field label="Vídeo externo">
              <Input value={form.videoUrl} onChange={(event) => setForm({ ...form, videoUrl: event.target.value })} />
            </Field>
            <Field label="Link de ação">
              <Input value={form.actionUrl} onChange={(event) => setForm({ ...form, actionUrl: event.target.value })} />
            </Field>
            <Field label="Texto do botão">
              <Input value={form.actionLabel} onChange={(event) => setForm({ ...form, actionLabel: event.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Público-alvo">
              <NativeSelect value={form.audienceScope} onChange={(event) => setForm({ ...form, audienceScope: event.target.value as AudienceScope })}>
                <option value="ALL_COMPANY">Toda a empresa</option>
                <option value="AREAS">Áreas selecionadas</option>
                <option value="USERS">Usuários específicos</option>
                <option value="MANAGERS">Gestores</option>
                <option value="DIRECTORS">Diretoria</option>
                <option value="ACTIVE_USERS">Usuários ativos</option>
              </NativeSelect>
            </Field>
            <Field label="Publicação">
              <Input type="datetime-local" value={form.publishAt} onChange={(event) => setForm({ ...form, publishAt: event.target.value })} />
            </Field>
          </div>
          {form.audienceScope === 'AREAS' && (
            <MultiCheck
              title="Áreas"
              items={areas.map((area: any) => ({ id: area.id, label: area.name }))}
              selected={form.audienceAreaIds}
              onToggle={(id) => setForm({ ...form, audienceAreaIds: toggle(form.audienceAreaIds, id) })}
            />
          )}
          {form.audienceScope === 'USERS' && (
            <MultiCheck
              title="Usuários"
              items={users.map((user: any) => ({ id: user.id, label: `${user.name} · ${user.areaName ?? 'sem área'}` }))}
              selected={form.audienceUserIds}
              onToggle={(id) => setForm({ ...form, audienceUserIds: toggle(form.audienceUserIds, id) })}
            />
          )}
          <MultiCheck
            title="Canais"
            items={CHANNELS.map((channel) => ({ id: channel.key, label: channel.label }))}
            selected={CHANNELS.filter((channel) => form.channels[channel.key]).map((channel) => channel.key)}
            onToggle={(key) => setForm({ ...form, channels: { ...form.channels, [key]: !form.channels[key as keyof ChannelConfig] } })}
          />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {BOOLEAN_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <input type="checkbox" checked={Boolean(form[key])} onChange={() => setForm({ ...form, [key]: !form[key] })} />
                {label}
              </label>
            ))}
          </div>
          {(form.type === 'POLL' || form.type === 'SURVEY' || form.requiresPollAnswer) && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Pergunta" className="md:col-span-2">
                <Input value={form.pollQuestion} onChange={(event) => setForm({ ...form, pollQuestion: event.target.value })} />
              </Field>
              <Field label="Opções">
                <Textarea rows={4} value={form.pollOptions} onChange={(event) => setForm({ ...form, pollOptions: event.target.value })} />
              </Field>
              <Field label="Prazo da enquete">
                <Input type="datetime-local" value={form.pollDueAt} onChange={(event) => setForm({ ...form, pollDueAt: event.target.value })} />
              </Field>
            </div>
          )}
          <Button onClick={onSubmit} disabled={saving || !form.title || !form.content}>
            <Send className="mr-2 h-4 w-4" />
            Salvar comunicado
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>IA e pré-visualização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Briefing para IA">
            <Textarea rows={4} value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} />
          </Field>
          <Button variant="outline" onClick={generateAi}>
            <Sparkles className="mr-2 h-4 w-4" />
            Gerar texto
          </Button>
          <div className="rounded-md border p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <PriorityBadge priority={form.priority} />
              <Badge variant="secondary">{TYPE_LABEL[form.type]}</Badge>
            </div>
            <h3 className="break-words text-lg font-semibold">{form.title || 'Título do comunicado'}</h3>
            <p className="mt-1 break-words text-sm text-muted-foreground">{form.subtitle || 'Subtítulo'}</p>
            <p className="mt-4 whitespace-pre-line break-words text-sm">{form.content || 'Conteúdo do comunicado.'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PostMediaFields({
  form,
  setForm,
  media,
  uploadMedia,
  uploadingMedia,
}: {
  form: CommunicationForm;
  setForm: React.Dispatch<React.SetStateAction<CommunicationForm>>;
  media: MediaItem[];
  uploadMedia: UploadMediaFn;
  uploadingMedia: boolean;
}) {
  const images = media.filter(isImageMedia).slice(0, 6);
  const videos = media.filter(isVideoMedia).slice(0, 4);
  const applyMedia = (item: MediaItem) => {
    if (!item.url) return;
    if (isVideoMedia(item)) {
      setForm((current) => ({ ...current, videoUrl: item.url ?? current.videoUrl, type: current.type === 'SIMPLE' ? 'VIDEO' : current.type }));
      return;
    }
    setForm((current) => ({ ...current, coverImageUrl: item.url ?? current.coverImageUrl, type: current.type === 'SIMPLE' ? 'BANNER' : current.type }));
  };
  return (
    <div className="md:col-span-2 space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Mídia do comunicado</p>
          <p className="text-xs text-muted-foreground">Upload de imagem com ajuste e vídeo curto.</p>
        </div>
        <MediaAssetUploader
          uploadMedia={uploadMedia}
          uploadingMedia={uploadingMedia}
          imageType="BANNER"
          category="Comunicados"
          onUploaded={applyMedia}
        />
      </div>

      {(form.coverImageUrl || form.videoUrl) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {form.coverImageUrl && (
            <div className="overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.coverImageUrl} alt="Imagem do comunicado" className="h-40 w-full object-cover" />
            </div>
          )}
          {form.videoUrl && (
            <div className="overflow-hidden rounded-md border">
              {isPlayableVideoUrl(form.videoUrl) ? (
                <video className="h-40 w-full bg-black object-contain" controls preload="metadata">
                  <source src={form.videoUrl} />
                </video>
              ) : (
                <div className="flex h-40 items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Link2 className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-all">{form.videoUrl}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(images.length > 0 || videos.length > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Acervo</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {[...images, ...videos].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applyMedia(item)}
                className="min-w-0 overflow-hidden rounded-md border text-left transition hover:border-primary hover:bg-muted"
              >
                <MediaPreview item={item} className="h-20 rounded-none border-0" />
                <span className="block truncate px-2 py-1 text-xs">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MediaAssetUploader({
  uploadMedia,
  uploadingMedia,
  onUploaded,
  imageType = 'IMAGE',
  category = 'Geral',
}: {
  uploadMedia: UploadMediaFn;
  uploadingMedia: boolean;
  onUploaded?: (item: MediaItem) => void;
  imageType?: 'IMAGE' | 'BANNER';
  category?: string;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const disabled = uploadingMedia || busy;

  const uploadAdjustedImage = async (payload: AdjustedImageUpload) => {
    setBusy(true);
    try {
      const item = await uploadMedia({ ...payload, category, tags: ['upload', 'imagem'] });
      onUploaded?.(item);
      toast.success('Imagem enviada');
      setImageDialogOpen(false);
      setImageFile(null);
    } finally {
      setBusy(false);
    }
  };

  const uploadVideoFile = async (file: File) => {
    if (file.size > MAX_COMMUNICATION_MEDIA_BYTES) {
      toast.error('O vídeo deve ter até 6 MB.');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const item = await uploadMedia({
        fileName: file.name,
        name: file.name.replace(/\.[^.]+$/, ''),
        mimeType: file.type || inferVideoMime(file.name),
        sizeBytes: file.size,
        dataBase64: stripDataUrl(dataUrl),
        type: 'VIDEO',
        category,
        tags: ['upload', 'video'],
      });
      onUploaded?.(item);
      toast.success('Vídeo enviado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} disabled={disabled}>
        <ImagePlus className="mr-2 h-4 w-4" />
        Imagem
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => videoInputRef.current?.click()} disabled={disabled}>
        <Video className="mr-2 h-4 w-4" />
        Vídeo
      </Button>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.currentTarget.value = '';
          if (!file) return;
          setImageFile(file);
          setImageDialogOpen(true);
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.currentTarget.value = '';
          if (file) void uploadVideoFile(file);
        }}
      />
      <ImageAdjustDialog
        file={imageFile}
        open={imageDialogOpen}
        imageType={imageType}
        disabled={disabled}
        onOpenChange={setImageDialogOpen}
        onApply={uploadAdjustedImage}
      />
    </div>
  );
}

export function ImageAdjustDialog({
  file,
  open,
  imageType,
  disabled,
  onOpenChange,
  onApply,
}: {
  file: File | null;
  open: boolean;
  imageType: 'IMAGE' | 'BANNER';
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (payload: AdjustedImageUpload) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const initialPreset = IMAGE_PRESETS.find((preset) => preset.type === imageType) ?? IMAGE_PRESETS[0]!;
  const [presetId, setPresetId] = useState(initialPreset.id);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [quality, setQuality] = useState(86);
  const [ready, setReady] = useState(false);
  const preset = IMAGE_PRESETS.find((item) => item.id === presetId) ?? initialPreset;

  useEffect(() => {
    if (!file || !open) return;
    setReady(false);
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      imageRef.current = image;
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
      setReady(true);
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      toast.error('Não foi possível abrir a imagem.');
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }, [file, open]);

  useEffect(() => {
    drawAdjustedImage(canvasRef.current, imageRef.current, preset.width, preset.height, zoom, offsetX, offsetY);
  }, [preset.width, preset.height, zoom, offsetX, offsetY, ready]);

  const apply = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !file || !ready) return;
    drawAdjustedImage(canvas, imageRef.current, preset.width, preset.height, zoom, offsetX, offsetY);
    const dataUrl = canvas.toDataURL('image/jpeg', quality / 100);
    const dataBase64 = stripDataUrl(dataUrl);
    const sizeBytes = base64ByteSize(dataBase64);
    if (sizeBytes > MAX_COMMUNICATION_MEDIA_BYTES) {
      toast.error('A imagem ajustada passou de 6 MB.');
      return;
    }
    await onApply({
      fileName: adjustedImageName(file.name),
      name: file.name.replace(/\.[^.]+$/, ''),
      mimeType: 'image/jpeg',
      sizeBytes,
      dataBase64,
      type: preset.type,
      adjustments: {
        preset: preset.id,
        width: preset.width,
        height: preset.height,
        zoom,
        offsetX,
        offsetY,
        quality,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Ajustar imagem
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0 overflow-hidden rounded-md border bg-muted/30 p-2">
            <canvas ref={canvasRef} className="max-h-[520px] w-full rounded-md bg-white object-contain" />
          </div>
          <div className="space-y-4">
            <Field label="Formato">
              <NativeSelect value={presetId} onChange={(event) => setPresetId(event.target.value)}>
                {IMAGE_PRESETS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </NativeSelect>
            </Field>
            <RangeControl label="Zoom" value={zoom} min={1} max={2.5} step={0.05} onChange={setZoom} />
            <RangeControl label="Horizontal" value={offsetX} min={-50} max={50} step={1} onChange={setOffsetX} />
            <RangeControl label="Vertical" value={offsetY} min={-50} max={50} step={1} onChange={setOffsetY} />
            <RangeControl label="Qualidade" value={quality} min={60} max={95} step={1} onChange={setQuality} suffix="%" />
            <div className="rounded-md border p-3 text-xs text-muted-foreground">
              {preset.width} x {preset.height}px
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>Cancelar</Button>
          <Button type="button" onClick={apply} disabled={disabled || !ready}>
            <Crop className="mr-2 h-4 w-4" />
            Aplicar e enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RangeControl({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{Number(value).toFixed(step < 1 ? 2 : 0)}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

