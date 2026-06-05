import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FormStorageService {
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
