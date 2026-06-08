import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, stat, writeFile } from 'fs/promises';
import { basename, dirname, resolve } from 'path';

export interface StoredAuditEvidence {
  storageProvider: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  hashSha256: string;
}

@Injectable()
export class AuditStorageService {
  private readonly provider = process.env.AUDIT_STORAGE_PROVIDER ?? 'LOCAL';
  private readonly root = resolve(process.env.AUDIT_STORAGE_PATH ?? 'storage/audits');

  async putText(companyId: string, folder: string, fileName: string, content: string, mimeType: string): Promise<StoredAuditEvidence> {
    const safeName = sanitizeFileName(fileName);
    const key = `${companyId}/${sanitizePathPart(folder)}/${Date.now()}-${randomUUID()}-${safeName}`;
    const target = this.resolveKey(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
    const info = await stat(target);
    return {
      storageProvider: this.provider,
      storageKey: key,
      fileName: safeName,
      mimeType,
      sizeBytes: info.size,
      hashSha256: sha256(content),
    };
  }

  async readText(storageKey: string): Promise<string> {
    return readFile(this.resolveKey(storageKey), 'utf8');
  }

  private resolveKey(storageKey: string) {
    const target = resolve(this.root, storageKey);
    if (!target.startsWith(this.root)) throw new Error('Storage key inválida.');
    return target;
  }
}

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function sanitizeFileName(value: string) {
  const clean = basename(value || 'evidencia.txt')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 140);
  return clean || 'evidencia.txt';
}

function sanitizePathPart(value: string) {
  return (value || 'geral').replace(/[^\w-]+/g, '-').slice(0, 80) || 'geral';
}
