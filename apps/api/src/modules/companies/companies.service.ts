import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Cor em hex de 3 ou 6 dígitos (#0a1128 / #abc). */
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
/** Limite do logo embutido (data URL) — imagem de marca, não arquivo pesado. */
const MAX_LOGO_CHARS = 2_000_000;

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Identidade visual da empresa: usada pelo shell (cor do portal + logo). */
  async branding(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, tradeName: true, logoUrl: true, brandColor: true, brandTextColor: true },
    });
    if (!company) throw new NotFoundException('Empresa nao encontrada.');
    return company;
  }

  async updateBranding(
    companyId: string,
    input: { brandColor?: string | null; brandTextColor?: string | null; logoUrl?: string | null },
  ) {
    const data: { brandColor?: string | null; brandTextColor?: string | null; logoUrl?: string | null } = {};

    if (input.brandColor !== undefined) {
      const color = (input.brandColor ?? '').trim();
      if (color && !HEX_COLOR.test(color)) {
        throw new BadRequestException('Informe a cor em hexadecimal, por exemplo #1B4B8F.');
      }
      data.brandColor = color || null; // vazio volta ao padrão Gestão 360
    }

    if (input.brandTextColor !== undefined) {
      const textColor = (input.brandTextColor ?? '').trim();
      if (textColor && !HEX_COLOR.test(textColor)) {
        throw new BadRequestException('Informe a cor das letras em hexadecimal, por exemplo #FFFFFF.');
      }
      data.brandTextColor = textColor || null; // vazio = contraste automático
    }

    if (input.logoUrl !== undefined) {
      const logo = (input.logoUrl ?? '').trim();
      if (logo.length > MAX_LOGO_CHARS) {
        throw new BadRequestException('A imagem do logo é muito grande. Use um arquivo de até ~1,5 MB.');
      }
      if (logo && !/^(data:image\/|https?:\/\/|\/)/.test(logo)) {
        throw new BadRequestException('Logo inválido: envie uma imagem ou informe uma URL.');
      }
      data.logoUrl = logo || null;
    }

    await this.prisma.company.update({ where: { id: companyId }, data });
    return this.branding(companyId);
  }

  list() {
    return this.prisma.company.findMany({
      where: { deletedAt: null },
      include: { branches: true },
    });
  }

  getById(id: string) {
    return this.prisma.company.findUnique({
      where: { id },
      include: { branches: true },
    });
  }

  listBranches(companyId: string) {
    return this.prisma.branch.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }
}
