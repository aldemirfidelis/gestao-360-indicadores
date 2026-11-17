import { toast } from 'sonner';
import { api, getAccessToken } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

/** Baixa um recurso protegido da API (envia o token no cabeçalho). */
export async function fetchProtectedBlob(path: string): Promise<Blob> {
  const token = getAccessToken();
  const response = await fetch(`${API_URL}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : undefined });
  if (!response.ok) {
    let message = 'Não foi possível baixar o arquivo.';
    try {
      const body = await response.json();
      if (body?.message) message = String(body.message);
    } catch {
      // resposta sem JSON
    }
    throw new Error(message);
  }
  return response.blob();
}

export async function downloadProtected(path: string, fileName: string) {
  try {
    const blob = await fetchProtectedBlob(path);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (error) {
    toast.error((error as Error).message);
  }
}

/** Envio de arquivo de verdade (multipart), sem base64. */
export function uploadDocumentFile<T = unknown>(path: string, file: File, fields: Record<string, string> = {}) {
  const form = new FormData();
  form.append('file', file, file.name);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return api<T>(path, { method: 'POST', body: form });
}

/**
 * Reduz fotos antes de embutir no documento (lado maior até 1400 px, JPEG),
 * mantendo o documento leve para salvar, gerar PDF e abrir no celular.
 */
export function imageToDataUrl(file: File, maxSide = 1400, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      reject(new Error('Envie uma imagem PNG, JPEG ou WEBP.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler a imagem.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Imagem inválida.'));
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Navegador sem suporte a imagens.'));
          return;
        }
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
