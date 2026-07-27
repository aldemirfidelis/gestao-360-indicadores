import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { AuditWriterService } from '../../../common/audit/audit-writer.service';

/** Categorias sugeridas — criadas na primeira abertura do modulo pela empresa. */
const SEED_CATEGORIES: Array<{ name: string; color: string }> = [
  { name: 'Comunicado', color: '#0ea5e9' },
  { name: 'Campanha', color: '#8b5cf6' },
  { name: 'Benefício', color: '#10b981' },
  { name: 'Evento', color: '#f59e0b' },
  { name: 'Segurança', color: '#ef4444' },
  { name: 'Recursos Humanos', color: '#6366f1' },
  { name: 'Treinamento', color: '#14b8a6' },
  { name: 'Saúde', color: '#ec4899' },
  { name: 'Reconhecimento', color: '#eab308' },
  { name: 'Institucional', color: '#64748b' },
];

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

@Injectable()
export class CommunicationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  /** Configuracao da empresa, criada sob demanda com os padroes do modulo. */
  async settings(companyId: string) {
    const existing = await this.prisma.communicationSettings.findUnique({ where: { companyId } });
    if (existing) return existing;
    return this.prisma.communicationSettings.create({ data: { companyId } });
  }

  /**
   * Categorias ativas da empresa. Na primeira chamada semeia a lista sugerida
   * para a tela nunca abrir com um seletor vazio.
   */
  async categories(companyId: string, includeInactive = false) {
    const existing = await this.prisma.communicationCategory.findMany({
      where: { companyId, deletedAt: null, ...(includeInactive ? {} : { active: true }) },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
    if (existing.length > 0) return existing;

    await this.prisma.communicationCategory.createMany({
      data: SEED_CATEGORIES.map((category, index) => ({
        companyId,
        name: category.name,
        slug: slugify(category.name),
        color: category.color,
        position: index,
      })),
      skipDuplicates: true,
    });
    return this.prisma.communicationCategory.findMany({
      where: { companyId, deletedAt: null, active: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(me: AuthPayload, body: { name?: string; color?: string }) {
    const name = String(body?.name ?? '').trim();
    if (!name) throw new BadRequestException('Informe o nome da categoria.');
    const slug = slugify(name);
    if (!slug) throw new BadRequestException('Nome de categoria inválido.');

    const clash = await this.prisma.communicationCategory.findFirst({ where: { companyId: me.companyId, slug } });
    if (clash) {
      if (clash.deletedAt || !clash.active) {
        const revived = await this.prisma.communicationCategory.update({
          where: { id: clash.id },
          data: { deletedAt: null, active: true, name, color: body.color ?? clash.color },
        });
        return revived;
      }
      throw new BadRequestException('Já existe uma categoria com esse nome.');
    }

    const last = await this.prisma.communicationCategory.findFirst({
      where: { companyId: me.companyId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const created = await this.prisma.communicationCategory.create({
      data: { companyId: me.companyId, name, slug, color: body.color ?? null, position: (last?.position ?? 0) + 1 },
    });
    await this.audit.record(me, { action: 'CREATE', module: 'Comunicação', entity: 'CommunicationCategory', entityId: created.id, message: name });
    return created;
  }

  async updateCategory(me: AuthPayload, id: string, body: { name?: string; color?: string; active?: boolean }) {
    const category = await this.prisma.communicationCategory.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    if (name !== undefined && !name) throw new BadRequestException('Informe o nome da categoria.');
    const updated = await this.prisma.communicationCategory.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name, slug: slugify(name) } : {}),
        ...(body.color !== undefined ? { color: body.color || null } : {}),
        ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
      },
    });
    await this.audit.record(me, {
      action: 'UPDATE',
      module: 'Comunicação',
      entity: 'CommunicationCategory',
      entityId: id,
      message: updated.name,
      before: category,
      after: updated,
    });
    return updated;
  }

  /** Exclusao logica; categorias em uso apenas saem do seletor. */
  async removeCategory(me: AuthPayload, id: string) {
    const category = await this.prisma.communicationCategory.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!category) throw new NotFoundException('Categoria não encontrada.');
    const inUse = await this.prisma.communicationPost.count({ where: { categoryId: id, deletedAt: null } });
    if (inUse > 0) {
      await this.prisma.communicationCategory.update({ where: { id }, data: { active: false } });
      await this.audit.record(me, { action: 'DEACTIVATE', module: 'Comunicação', entity: 'CommunicationCategory', entityId: id, message: category.name });
      return { deactivated: true, posts: inUse };
    }
    await this.prisma.communicationCategory.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await this.audit.record(me, { action: 'DELETE', module: 'Comunicação', entity: 'CommunicationCategory', entityId: id, message: category.name });
    return { deleted: true };
  }

  async updateSettings(me: AuthPayload, body: { approvalRequired?: boolean; defaultEmployeeFeed?: boolean }) {
    const current = await this.settings(me.companyId);
    const updated = await this.prisma.communicationSettings.update({
      where: { companyId: me.companyId },
      data: {
        ...(body.approvalRequired !== undefined ? { approvalRequired: Boolean(body.approvalRequired) } : {}),
        ...(body.defaultEmployeeFeed !== undefined ? { defaultEmployeeFeed: Boolean(body.defaultEmployeeFeed) } : {}),
      },
    });
    await this.audit.record(me, {
      action: 'UPDATE',
      module: 'Comunicação',
      entity: 'CommunicationSettings',
      entityId: updated.id,
      message: 'Configurações do módulo',
      before: current,
      after: updated,
    });
    return updated;
  }
}
