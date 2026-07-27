'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Crop, FileUp, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { api } from '@/lib/api';
import {
  base64ByteSize,
  drawAdjustedImage,
  IMAGE_PRESETS,
  MAX_MEDIA_BYTES,
  readFileAsDataUrl,
  stripDataUrl,
  type MediaAsset,
} from '@/lib/communication/publications';

interface UploadPayload {
  fileName: string;
  name?: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
  type?: 'IMAGE' | 'BANNER';
  folder?: string;
  width?: number;
  height?: number;
}

export async function uploadMedia(payload: UploadPayload) {
  return api<MediaAsset>('/communication/media', { method: 'POST', json: payload });
}

/**
 * Envio de imagem com recorte no formato recomendado. O recorte roda no
 * canvas do navegador, então o arquivo já sai no tamanho certo — é o que
 * garante banners bem proporcionados no feed.
 */
export function ImageUploadButton({
  onUploaded,
  presetId = 'banner',
  folder,
  label = 'Enviar imagem',
  variant = 'outline',
  disabled,
}: {
  onUploaded: (media: MediaAsset) => void;
  presetId?: string;
  folder?: string;
  label?: string;
  variant?: 'default' | 'outline';
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant={variant} size="sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
        <ImagePlus className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          event.currentTarget.value = '';
          if (!selected) return;
          setFile(selected);
          setOpen(true);
        }}
      />
      <ImageAdjustDialog
        file={file}
        open={open}
        presetId={presetId}
        folder={folder}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setFile(null);
        }}
        onUploaded={onUploaded}
      />
    </>
  );
}

/** Envio direto de documento/vídeo (sem recorte). */
export function FileUploadButton({
  onUploaded,
  folder,
  label = 'Enviar arquivo',
  accept = 'application/pdf,.doc,.docx,.xls,.xlsx,video/mp4,video/webm,video/ogg,video/quicktime',
}: {
  onUploaded: (media: MediaAsset) => void;
  folder?: string;
  label?: string;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function send(file: File) {
    if (file.size > MAX_MEDIA_BYTES) {
      toast.error('O arquivo deve ter até 6 MB.');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const media = await uploadMedia({
        fileName: file.name,
        name: file.name.replace(/\.[^.]+$/, ''),
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        dataBase64: stripDataUrl(dataUrl),
        folder,
      });
      onUploaded(media);
      toast.success('Arquivo enviado.');
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível enviar o arquivo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
        <FileUp className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.currentTarget.value = '';
          if (file) void send(file);
        }}
      />
    </>
  );
}

function ImageAdjustDialog({
  file,
  open,
  presetId,
  folder,
  onOpenChange,
  onUploaded,
}: {
  file: File | null;
  open: boolean;
  presetId: string;
  folder?: string;
  onOpenChange: (open: boolean) => void;
  onUploaded: (media: MediaAsset) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [selectedPreset, setSelectedPreset] = useState(presetId);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const preset = IMAGE_PRESETS.find((item) => item.id === selectedPreset) ?? IMAGE_PRESETS[0]!;

  useEffect(() => setSelectedPreset(presetId), [presetId, open]);

  useEffect(() => {
    if (!file || !open) return;
    setReady(false);
    setName(file.name.replace(/\.[^.]+$/, ''));
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

  async function apply() {
    const canvas = canvasRef.current;
    if (!canvas || !file || !ready) return;
    drawAdjustedImage(canvas, imageRef.current, preset.width, preset.height, zoom, offsetX, offsetY);
    const dataBase64 = stripDataUrl(canvas.toDataURL('image/jpeg', 0.86));
    const sizeBytes = base64ByteSize(dataBase64);
    if (sizeBytes > MAX_MEDIA_BYTES) {
      toast.error('A imagem ajustada passou de 6 MB. Reduza o zoom ou escolha um formato menor.');
      return;
    }
    setBusy(true);
    try {
      const media = await uploadMedia({
        fileName: `${name || 'imagem'}.jpg`,
        name: name || 'Imagem',
        mimeType: 'image/jpeg',
        sizeBytes,
        dataBase64,
        type: preset.type,
        folder,
        width: preset.width,
        height: preset.height,
      });
      onUploaded(media);
      toast.success('Imagem enviada.');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível enviar a imagem.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Crop className="h-4 w-4" />
            Ajustar imagem
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
          <div className="min-w-0 overflow-hidden rounded-lg border bg-muted/30 p-2">
            <canvas ref={canvasRef} className="max-h-[420px] w-full rounded-md bg-white object-contain" />
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Formato recomendado</Label>
              <NativeSelect value={selectedPreset} onChange={(event) => setSelectedPreset(event.target.value)}>
                {IMAGE_PRESETS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-[11px] text-muted-foreground">
                {preset.width} × {preset.height}px
              </p>
            </div>
            <Range label="Zoom" value={zoom} min={1} max={2.5} step={0.05} onChange={setZoom} />
            <Range label="Horizontal" value={offsetX} min={-50} max={50} step={1} onChange={setOffsetX} />
            <Range label="Vertical" value={offsetY} min={-50} max={50} step={1} onChange={setOffsetY} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void apply()} disabled={busy || !ready}>
            <Crop className="mr-2 h-4 w-4" />
            {busy ? 'Enviando...' : 'Aplicar e enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value.toFixed(step < 1 ? 2 : 0)}</span>
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
