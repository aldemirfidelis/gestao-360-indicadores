import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { basename, dirname, resolve, sep } from 'path';
import { PrismaService } from '../../prisma/prisma.service';

export interface StoredDocumentFile {
  storageProvider: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  hashSha256: string;
}

/** Chaves de arquivos guardados no Postgres (tabela document_blobs). */
export const DATABASE_STORAGE_PREFIX = 'db:';

/**
 * Armazenamento dos arquivos do GED.
 *
 * Padrão: o conteúdo vai para o próprio Postgres (`document_blobs`), coberto
 * pelo backup diário do banco. `DOCUMENT_STORAGE_PROVIDER=LOCAL` mantém a
 * gravação em disco (volume). A leitura aceita os dois formatos de chave, então
 * arquivos antigos gravados em disco continuam abrindo.
 */
@Injectable()
export class DocumentStorageService {
  private readonly root = resolve(process.env.DOCUMENT_STORAGE_PATH ?? 'storage/documents');

  constructor(private readonly prisma: PrismaService) {}

  get provider(): 'DATABASE' | 'LOCAL' {
    return (process.env.DOCUMENT_STORAGE_PROVIDER ?? 'DATABASE').trim().toUpperCase() === 'LOCAL' ? 'LOCAL' : 'DATABASE';
  }

  async putText(companyId: string, folder: string, fileName: string, content: string, mimeType: string): Promise<StoredDocumentFile> {
    return this.put(companyId, folder, fileName, Buffer.from(content, 'utf8'), mimeType, sha256(content));
  }

  /** Persiste conteúdo binário (DOCX editado no Word/Collabora, PDF oficial, imagens). */
  async putBinary(companyId: string, folder: string, fileName: string, content: Buffer, mimeType: string): Promise<StoredDocumentFile> {
    return this.put(companyId, folder, fileName, content, mimeType, sha256Buffer(content));
  }

  async readText(storageKey: string): Promise<string> {
    return (await this.readBinary(storageKey)).toString('utf8');
  }

  async readBinary(storageKey: string): Promise<Buffer> {
    if (storageKey.startsWith(DATABASE_STORAGE_PREFIX)) {
      const blob = await this.prisma.documentBlob.findUnique({
        where: { id: storageKey.slice(DATABASE_STORAGE_PREFIX.length) },
        select: { data: true },
      });
      if (!blob) throw new NotFoundException('Conteúdo do arquivo não encontrado.');
      return Buffer.from(blob.data);
    }
    return readFile(this.resolveKey(storageKey));
  }

  /** Remove o conteúdo (descarte por temporalidade). Metadados ficam com o chamador. */
  async remove(storageKey: string): Promise<void> {
    if (storageKey.startsWith(DATABASE_STORAGE_PREFIX)) {
      await this.prisma.documentBlob.deleteMany({ where: { id: storageKey.slice(DATABASE_STORAGE_PREFIX.length) } });
      return;
    }
    try {
      await unlink(this.resolveKey(storageKey));
    } catch {
      // Arquivo legado já ausente no disco: nada a remover.
    }
  }

  /** Uso do armazenamento no banco pela empresa (diagnóstico). */
  async usage(companyId: string) {
    const result = await this.prisma.documentBlob.aggregate({ where: { companyId }, _count: { _all: true }, _sum: { sizeBytes: true } });
    return { provider: this.provider, files: result._count._all, bytes: result._sum.sizeBytes ?? 0 };
  }

  private async put(companyId: string, folder: string, fileName: string, content: Buffer, mimeType: string, hash: string): Promise<StoredDocumentFile> {
    const safeName = sanitizeFileName(fileName);
    if (this.provider === 'DATABASE') {
      const blob = await this.prisma.documentBlob.create({
        data: { companyId, sha256: hash, sizeBytes: content.length, mimeType, data: content },
        select: { id: true },
      });
      return {
        storageProvider: 'DATABASE',
        storageKey: `${DATABASE_STORAGE_PREFIX}${blob.id}`,
        fileName: safeName,
        mimeType,
        sizeBytes: content.length,
        hashSha256: hash,
      };
    }
    const key = `${companyId}/${sanitizePathPart(folder)}/${Date.now()}-${randomUUID()}-${safeName}`;
    const target = this.resolveKey(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    const info = await stat(target);
    return {
      storageProvider: 'LOCAL',
      storageKey: key,
      fileName: safeName,
      mimeType,
      sizeBytes: info.size,
      hashSha256: hash,
    };
  }

  private resolveKey(storageKey: string) {
    const target = resolve(this.root, storageKey);
    if (!target.startsWith(this.root + sep)) {
      throw new Error('Storage key inválida.');
    }
    return target;
  }
}

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256Buffer(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function sanitizeFileName(value: string) {
  const clean = basename(value || 'documento.txt')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 140);
  return clean || 'documento.txt';
}

function sanitizePathPart(value: string) {
  return (value || 'geral').replace(/[^\w-]+/g, '-').slice(0, 80) || 'geral';
}
