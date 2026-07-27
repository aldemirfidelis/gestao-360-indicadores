import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CommMediaStatus, CommMediaType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { AuditWriterService } from '../../../common/audit/audit-writer.service';

const MAX_MEDIA_BYTES = 6 * 1024 * 1024;
const ALLOWED_VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']);
const ALLOWED_DOC_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/** Proporcoes recomendadas para os formatos do feed (secao 5 do plano). */
const RECOMMENDED_RATIOS = [
  { id: 'banner', label: 'Banner 16:9', ratio: 16 / 9 },
  { id: 'feed', label: 'Feed 4:5', ratio: 4 / 5 },
  { id: 'square', label: 'Quadrado 1:1', ratio: 1 },
];

export interface MediaUploadBody {
  fileName?: string;
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
  dataBase64?: string;
  type?: CommMediaType;
  folder?: string;
  tags?: string[];
  width?: number;
  height?: number;
}

@Injectable()
export class MediaLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  async list(me: AuthPayload, query: { search?: string; folder?: string; type?: string; status?: string }) {
    const where: Prisma.CommunicationMediaWhereInput = { companyId: me.companyId, deletedAt: null };
    if (query.search?.trim()) where.name = { contains: query.search.trim(), mode: 'insensitive' };
    if (query.folder) where.folder = query.folder;
    if (query.type && Object.values(CommMediaType).includes(query.type as CommMediaType)) {
      where.type = query.type as CommMediaType;
    }
    where.status = query.status === 'ARCHIVED' ? CommMediaStatus.ARCHIVED : CommMediaStatus.ACTIVE;

    const [rows, folders] = await Promise.all([
      this.prisma.communicationMedia.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 300,
        include: { _count: { select: { postLinks: true } } },
      }),
      this.prisma.communicationMedia.groupBy({
        by: ['folder'],
        where: { companyId: me.companyId, deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    return {
      items: rows.map((row) => this.toItem(row)),
      folders: folders
        .filter((group) => group.folder)
        .map((group) => ({ name: group.folder!, count: group._count._all }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  async upload(me: AuthPayload, body: MediaUploadBody) {
    const upload = this.prepare(body);
    const type = this.typeFromMime(upload.mimeType, body.type);
    const width = Number(body.width) || null;
    const height = Number(body.height) || null;

    const created = await this.prisma.communicationMedia.create({
      data: {
        companyId: me.companyId,
        name: this.clean(body.name) ?? upload.fileName,
        type,
        folder: this.clean(body.folder),
        category: this.clean(body.folder) ?? (type === 'VIDEO' ? 'Vídeos' : type === 'DOCUMENT' ? 'Documentos' : 'Imagens'),
        tags: (Array.isArray(body.tags) ? body.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 20) : []) as unknown as Prisma.InputJsonValue,
        url: `data:${upload.mimeType};base64,${upload.dataBase64}`,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        width,
        height,
        authorId: me.sub,
        status: CommMediaStatus.ACTIVE,
      },
      include: { _count: { select: { postLinks: true } } },
    });
    await this.audit.record(me, { action: 'CREATE', module: 'Comunicação', entity: 'CommunicationMedia', entityId: created.id, message: created.name });
    return this.toItem(created);
  }

  /** Substituir o arquivo mantendo o mesmo id — nao quebra as publicacoes. */
  async replace(me: AuthPayload, id: string, body: MediaUploadBody) {
    const media = await this.prisma.communicationMedia.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!media) throw new NotFoundException('Mídia não encontrada.');
    const upload = this.prepare(body);
    const updated = await this.prisma.communicationMedia.update({
      where: { id },
      data: {
        url: `data:${upload.mimeType};base64,${upload.dataBase64}`,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        width: Number(body.width) || null,
        height: Number(body.height) || null,
        type: this.typeFromMime(upload.mimeType, body.type ?? media.type),
        version: media.version + 1,
      },
      include: { _count: { select: { postLinks: true } } },
    });
    await this.audit.record(me, { action: 'REPLACE', module: 'Comunicação', entity: 'CommunicationMedia', entityId: id, message: media.name });
    return this.toItem(updated);
  }

  async update(me: AuthPayload, id: string, body: { name?: string; folder?: string | null; status?: CommMediaStatus }) {
    const media = await this.prisma.communicationMedia.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!media) throw new NotFoundException('Mídia não encontrada.');
    const name = body.name !== undefined ? this.clean(body.name) : undefined;
    if (body.name !== undefined && !name) throw new BadRequestException('Informe o nome da mídia.');
    const updated = await this.prisma.communicationMedia.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(body.folder !== undefined ? { folder: this.clean(body.folder), category: this.clean(body.folder) ?? media.category } : {}),
        ...(body.status && Object.values(CommMediaStatus).includes(body.status) ? { status: body.status } : {}),
      },
      include: { _count: { select: { postLinks: true } } },
    });
    await this.audit.record(me, { action: 'UPDATE', module: 'Comunicação', entity: 'CommunicationMedia', entityId: id, message: updated.name });
    return this.toItem(updated);
  }

  /** So exclui midia sem uso; em uso, arquiva (nao quebra publicacao publicada). */
  async remove(me: AuthPayload, id: string) {
    const media = await this.prisma.communicationMedia.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: { _count: { select: { postLinks: true } } },
    });
    if (!media) throw new NotFoundException('Mídia não encontrada.');
    if (media._count.postLinks > 0) {
      throw new BadRequestException(
        `Esta mídia está em uso em ${media._count.postLinks} publicação(ões). Arquive-a em vez de excluir.`,
      );
    }
    await this.prisma.communicationMedia.update({ where: { id }, data: { deletedAt: new Date(), status: CommMediaStatus.ARCHIVED } });
    await this.audit.record(me, { action: 'DELETE', module: 'Comunicação', entity: 'CommunicationMedia', entityId: id, message: media.name });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- helpers

  private toItem(media: any) {
    const ratio = media.width && media.height ? media.width / media.height : null;
    const closest = ratio
      ? RECOMMENDED_RATIOS.reduce((best, item) =>
          Math.abs(item.ratio - ratio) < Math.abs(best.ratio - ratio) ? item : best,
        )
      : null;
    // Alerta quando a imagem foge mais de 12% de qualquer proporcao recomendada.
    const ratioWarning = ratio && closest && Math.abs(closest.ratio - ratio) / closest.ratio > 0.12
      ? `Proporção fora dos formatos recomendados (mais próxima: ${closest.label}).`
      : null;
    return {
      id: media.id,
      name: media.name,
      type: media.type,
      folder: media.folder,
      url: media.url,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
      width: media.width,
      height: media.height,
      status: media.status,
      tags: Array.isArray(media.tags) ? media.tags : [],
      usageCount: media._count?.postLinks ?? 0,
      createdAt: media.createdAt,
      ratioWarning,
    };
  }

  private prepare(body: MediaUploadBody) {
    const fileName = this.safeFileName(this.required(body.fileName ?? body.name, 'Informe o arquivo.'));
    const mimeType = this.required(body.mimeType, 'Informe o tipo do arquivo.').toLowerCase();
    const isImage = mimeType.startsWith('image/');
    const isVideo = ALLOWED_VIDEO_MIME.has(mimeType);
    const isDoc = ALLOWED_DOC_MIME.has(mimeType);
    if (!isImage && !isVideo && !isDoc) {
      throw new BadRequestException('Envie imagens, vídeos (mp4, webm, ogg, mov) ou documentos (PDF, Word, Excel).');
    }

    const declared = Number(body.sizeBytes ?? 0);
    if (!Number.isFinite(declared) || declared <= 0 || declared > MAX_MEDIA_BYTES) {
      throw new BadRequestException('Cada arquivo da biblioteca pode ter até 6 MB.');
    }

    const raw = this.required(body.dataBase64, 'Envie o arquivo em base64.')
      .replace(/^data:[^;]+;base64,/i, '')
      .replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) throw new BadRequestException('Arquivo em base64 inválido.');

    const data = Buffer.from(raw, 'base64');
    if (!data.length || data.length > MAX_MEDIA_BYTES || data.length !== declared) {
      throw new BadRequestException('Tamanho do arquivo inválido.');
    }
    return { fileName, mimeType, sizeBytes: data.length, dataBase64: data.toString('base64') };
  }

  private typeFromMime(mimeType: string, requested?: CommMediaType): CommMediaType {
    if (mimeType.startsWith('video/')) return CommMediaType.VIDEO;
    if (mimeType === 'application/pdf') return CommMediaType.PDF;
    if (ALLOWED_DOC_MIME.has(mimeType)) return CommMediaType.DOCUMENT;
    return requested === CommMediaType.BANNER ? CommMediaType.BANNER : CommMediaType.IMAGE;
  }

  private safeFileName(value: string) {
    return (
      value
        .trim()
        .replace(/[^\w.\- ]+/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, 120) || `midia-${randomUUID()}`
    );
  }

  private clean(value: unknown) {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private required(value: unknown, message: string) {
    const text = this.clean(value);
    if (!text) throw new BadRequestException(message);
    return text;
  }
}
