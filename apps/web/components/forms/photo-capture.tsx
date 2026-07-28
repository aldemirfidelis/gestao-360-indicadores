'use client';

import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export interface CapturedPhoto {
  /** Base64 sem o prefixo de data URL, pronto para enviar. */
  contentBase64: string;
  mimeType: string;
  fileName: string;
  /** Miniatura para a tela; não é enviada. */
  preview: string;
}

/**
 * Registro fotográfico da inspeção.
 *
 * `capture="environment"` faz o celular abrir a câmera traseira direto, em vez
 * da galeria. No desktop o mesmo input vira seletor de arquivo, então o
 * componente serve nos dois.
 *
 * A foto é reduzida no próprio aparelho antes de sair: uma câmera de 12 MP
 * gera 4-8 MB por foto, e uma inspeção com 10 fotos ficaria impossível de
 * enviar em 4G no campo.
 */
export function PhotoCapture({
  photos,
  onChange,
  max = 10,
  disabled,
}: {
  photos: CapturedPhoto[];
  onChange: (photos: CapturedPhoto[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    if (photos.length + files.length > max) {
      toast.error(`Limite de ${max} fotos por registro.`);
      return;
    }

    setBusy(true);
    try {
      const novas: CapturedPhoto[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} não é uma imagem.`);
          continue;
        }
        novas.push(await compress(file));
      }
      if (novas.length) onChange([...photos, ...novas]);
    } catch {
      toast.error('Não foi possível processar a foto. Tente novamente.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        disabled={disabled || busy}
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <Button type="button" variant="outline" size="sm" disabled={disabled || busy || photos.length >= max} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
        {busy ? 'Processando…' : photos.length ? 'Adicionar foto' : 'Tirar foto'}
      </Button>

      {photos.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" /> No celular, abre a câmera direto. As fotos ficam anexadas a este registro.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <figure key={`${photo.fileName}-${index}`} className="group relative overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.preview} alt={`Foto ${index + 1} da inspeção`} className="aspect-square w-full object-cover" />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(photos.filter((_, i) => i !== index))}
                aria-label={`Remover foto ${index + 1}`}
                className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

/** Reduz para no máximo 1600px no maior lado e reencoda em JPEG. */
async function compress(file: File, maxSide = 1600, quality = 0.8): Promise<CapturedPhoto> {
  const dataUrl = await readAsDataUrl(file);
  const image = await loadImage(dataUrl);

  const escala = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * escala);
  canvas.height = Math.round(image.height * escala);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas indisponível');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const comprimido = canvas.toDataURL('image/jpeg', quality);
  return {
    contentBase64: comprimido.split(',')[1] ?? '',
    mimeType: 'image/jpeg',
    fileName: file.name.replace(/\.[^.]+$/, '') + '.jpg',
    preview: comprimido,
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('falha ao ler arquivo'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('imagem inválida'));
    image.src = src;
  });
}
