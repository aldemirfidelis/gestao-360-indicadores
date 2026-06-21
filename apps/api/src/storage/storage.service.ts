import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Abstração de storage de binários (S3 / DigitalOcean Spaces) — item 15.
 *
 * Fica INERTE até ser configurado por ambiente; nenhuma conexão é aberta no boot.
 * O banco deve guardar apenas metadados + a `key`; o binário vive no bucket.
 *
 * Variáveis (separadas das do backup off-site para evitar conflito de semântica):
 *   STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_REGION (default us-east-1),
 *   STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY,
 *   STORAGE_PREFIX (opcional), STORAGE_FORCE_PATH_STYLE ('true' p/ alguns S3 compat).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;

  private readonly endpoint = process.env.STORAGE_ENDPOINT ?? '';
  private readonly bucket = process.env.STORAGE_BUCKET ?? '';
  private readonly prefix = (process.env.STORAGE_PREFIX ?? '').replace(/^\/+|\/+$/g, '');

  isConfigured(): boolean {
    return Boolean(
      this.endpoint &&
        this.bucket &&
        process.env.STORAGE_ACCESS_KEY_ID &&
        process.env.STORAGE_SECRET_ACCESS_KEY,
    );
  }

  private getClient(): S3Client {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Storage S3/Spaces não configurado (defina STORAGE_ENDPOINT, STORAGE_BUCKET e credenciais).',
      );
    }
    if (!this.client) {
      this.client = new S3Client({
        endpoint: this.endpoint,
        region: process.env.STORAGE_REGION ?? 'us-east-1',
        forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
        credentials: {
          accessKeyId: process.env.STORAGE_ACCESS_KEY_ID as string,
          secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY as string,
        },
      });
      this.logger.log(`StorageService ativo (bucket ${this.bucket}).`);
    }
    return this.client;
  }

  /** Aplica o prefixo configurado à chave lógica. */
  private fullKey(key: string): string {
    const clean = key.replace(/^\/+/, '');
    return this.prefix ? `${this.prefix}/${clean}` : clean;
  }

  async put(key: string, body: Buffer | Uint8Array | string, contentType?: string): Promise<{ key: string }> {
    const Key = this.fullKey(key);
    await this.getClient().send(
      new PutObjectCommand({ Bucket: this.bucket, Key, Body: body, ContentType: contentType }),
    );
    return { key: Key };
  }

  /** URL assinada temporária para download direto (evita trafegar o binário pela API). */
  async getSignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
      { expiresIn: expiresInSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
    );
  }
}
