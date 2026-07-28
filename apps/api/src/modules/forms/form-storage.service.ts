import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join, normalize, resolve, sep } from 'path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

/** Imagens que a câmera do celular produz. */
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
/** Foto de inspeção comprimida no navegador cabe folgado nisto. */
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

@Injectable()
export class FormStorageService {
  /**
   * Mesmo padrão do GED: binário em disco, com volume persistente no compose.
   * O S3 (`StorageService`) só entra quando `STORAGE_*` estiver configurado —
   * hoje não está, e uma foto que "some" no próximo deploy seria pior que não
   * ter a funcionalidade.
   */
  private readonly root = resolve(process.env.FORM_STORAGE_PATH ?? 'storage/forms');

  /** Grava a foto e devolve a chave lógica para guardar na evidência. */
  async savePhoto(companyId: string, input: { contentBase64: string; mimeType?: string | null; fileName?: string | null }) {
    const mimeType = String(input.mimeType ?? 'image/jpeg').toLowerCase();
    if (!IMAGE_MIME.has(mimeType)) throw new BadRequestException('Formato de imagem não aceito. Use JPG, PNG ou WEBP.');

    const buffer = Buffer.from(String(input.contentBase64 ?? '').replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (buffer.length === 0) throw new BadRequestException('A imagem chegou vazia.');
    if (buffer.length > MAX_PHOTO_BYTES) throw new BadRequestException('A imagem ultrapassa o limite de 6 MB.');

    const key = `${companyId}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${EXTENSION[mimeType]}`;
    const target = this.resolveKey(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buffer);

    return {
      storageProvider: 'LOCAL',
      storageKey: key,
      fileName: this.text(input.fileName) ?? `foto-${new Date().toISOString().slice(0, 19)}.${EXTENSION[mimeType]}`,
      mimeType,
      sizeBytes: buffer.length,
      hashSha256: createHash('sha256').update(buffer).digest('hex'),
    };
  }

  async readPhoto(storageKey: string): Promise<Buffer> {
    // Resolve FORA do try: chave maliciosa tem de estourar como pedido
    // inválido, não virar "não encontrada" — senão a recusa de segurança fica
    // indistinguível de um arquivo ausente.
    const target = this.resolveKey(storageKey);
    try {
      return await readFile(target);
    } catch {
      throw new NotFoundException('Imagem não encontrada.');
    }
  }

  /**
   * Resolve a chave dentro da raiz.
   * A chave vem do banco, mas normalizar e conferir o prefixo evita que um
   * `../` gravado por engano (ou de propósito) leia fora da pasta.
   */
  private resolveKey(key: string): string {
    const target = normalize(join(this.root, key.replace(/^\/+/, '')));
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new BadRequestException('Caminho de arquivo inválido.');
    }
    return target;
  }

  normalizeEvidence(input: any) {
    const fileName = this.text(input?.fileName) ?? this.text(input?.name);
    const fileUrl = this.text(input?.fileUrl) ?? this.text(input?.url);
    const content = this.text(input?.contentText) ?? this.text(input?.content) ?? fileUrl ?? fileName ?? JSON.stringify(input ?? {});
    const hashSha256 = this.text(input?.hashSha256) ?? createHash('sha256').update(content).digest('hex');
    return {
      fileName,
      fileUrl,
      mimeType: this.text(input?.mimeType),
      sizeBytes: Number.isFinite(Number(input?.sizeBytes)) ? Math.max(0, Math.round(Number(input.sizeBytes))) : null,
      hashSha256,
      description: this.text(input?.description),
      type: this.text(input?.type) ?? 'ATTACHMENT',
      origin: this.text(input?.origin) ?? 'FORMS',
      storageProvider: this.text(input?.storageProvider) ?? (fileUrl ? 'URL' : 'INLINE'),
      storageKey: this.text(input?.storageKey) ?? fileUrl,
      location: input?.location && typeof input.location === 'object' ? input.location : undefined,
      metadata: input?.metadata && typeof input.metadata === 'object' ? input.metadata : undefined,
    };
  }

  private text(value: unknown) {
    const text = String(value ?? '').trim();
    return text || null;
  }
}
