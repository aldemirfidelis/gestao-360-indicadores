import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { normalizeHost, subdomainFromHost } from '../../common/tenant-host';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { DocumentStorageService } from '../documents/document-storage.service';
import { isPubliclyVisible, toPublicVacancy } from './recruit-posting.logic';

const MODULE = 'recruitment';
const CAREER_TEMPLATES = ['MODERN', 'CORPORATE', 'MINIMAL'];
const HERO_ALIGNMENTS = ['LEFT', 'CENTER'];
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface PublicCareerPage {
  published: boolean;
  showInGlobalPortal: boolean;
  template: string;
  heroAlignment: string;
  headline: string;
  subheadline: string;
  bannerUrl: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  aboutTitle: string;
  aboutText: string | null;
  cultureTitle: string;
  cultureText: string | null;
  benefitsTitle: string;
  benefitsText: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  showAbout: boolean;
  showCulture: boolean;
  showBenefits: boolean;
}

/**
 * Vitrines públicas de recrutamento:
 * 1) marketplace global do Gestão 360;
 * 2) página de carreiras personalizada por empresa;
 * 3) dados públicos necessários ao portal global do candidato.
 *
 * Somente campos públicos das vagas são expostos. Requisição, orçamento,
 * aprovadores, notas e snapshots protegidos nunca saem por este serviço.
 */
@Injectable()
export class RecruitCareersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: DocumentStorageService,
    private readonly audit: AuditWriterService,
  ) {}

  /** Resolve a empresa pelo host, subdomínio ou slug explícito. */
  async resolveCompany(host?: string, slug?: string) {
    const normalizedHost = normalizeHost(host);
    const activeWhere = { deletedAt: null, active: true, status: 'ACTIVE' as const };
    if (normalizedHost) {
      const byDomain = await this.prisma.company.findFirst({
        where: { customDomain: normalizedHost, ...activeWhere },
        select: brandSelect,
      });
      if (byDomain) return byDomain;
      const sub = subdomainFromHost(normalizedHost);
      if (sub) {
        const bySub = await this.prisma.company.findFirst({
          where: { slug: sub, ...activeWhere },
          select: brandSelect,
        });
        if (bySub) return bySub;
      }
    }
    const cleanSlug = String(slug ?? '').trim().toLowerCase();
    if (cleanSlug) {
      const bySlug = await this.prisma.company.findFirst({
        where: { slug: cleanSlug, ...activeWhere },
        select: brandSelect,
      });
      if (bySlug) return bySlug;
    }
    throw new NotFoundException('Empresa não encontrada.');
  }

  /** Marca, conteúdo e contagem de vagas abertas da página de uma empresa. */
  async companyInfo(host?: string, slug?: string) {
    const company = await this.resolveCompany(host, slug);
    const page = this.publicCareerPage(company);
    if (!page.published) throw new NotFoundException('Página de carreiras indisponível.');
    const openCount = await this.prisma.recruitJobPosting.count({
      where: { ...publicPostingWhere([company.id]), AND: publicPostingAnd() },
    });
    return {
      company: this.publicCompany(company),
      careerPage: page,
      openVacancies: openCount,
    };
  }

  /** Lista as vagas públicas abertas de uma empresa. */
  async listVacancies(
    host?: string,
    slug?: string,
    filters: { q?: string; city?: string; workMode?: string; contractType?: string } = {},
  ) {
    const company = await this.resolveCompany(host, slug);
    const careerPage = this.publicCareerPage(company);
    if (!careerPage.published) throw new NotFoundException('Página de carreiras indisponível.');
    const postings = await this.prisma.recruitJobPosting.findMany({
      where: {
        ...publicPostingWhere([company.id]),
        AND: [
          ...publicPostingAnd(),
          ...(filters.q
            ? [{
                OR: [
                  { title: { contains: filters.q, mode: 'insensitive' as const } },
                  { areaName: { contains: filters.q, mode: 'insensitive' as const } },
                  { publicDescription: { contains: filters.q, mode: 'insensitive' as const } },
                ],
              }]
            : []),
        ],
        ...(filters.city ? { city: { contains: filters.city, mode: 'insensitive' } } : {}),
        ...(filters.workMode ? { workMode: filters.workMode } : {}),
        ...(filters.contractType ? { contractType: filters.contractType } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take: 200,
      select: postingSelect,
    });
    return {
      company: this.publicCompany(company),
      careerPage,
      vacancies: postings.filter((posting) => isPubliclyVisible(posting)).map(toPublicVacancy),
      facets: facetsOf(postings),
    };
  }

  /** Marketplace global: vagas de todas as empresas que autorizam divulgação. */
  async listGlobalVacancies(filters: {
    q?: string;
    city?: string;
    workMode?: string;
    contractType?: string;
    company?: string;
  } = {}) {
    const companies = await this.prisma.company.findMany({
      where: { deletedAt: null, active: true, status: 'ACTIVE', slug: { not: null } },
      select: brandSelect,
      orderBy: [{ tradeName: 'asc' }, { name: 'asc' }],
    });
    const eligibleCompanies = companies.filter((company) => {
      const page = this.publicCareerPage(company);
      if (!page.published || !page.showInGlobalPortal) return false;
      if (!filters.company) return true;
      const term = filters.company.trim().toLowerCase();
      return company.slug?.toLowerCase() === term ||
        (company.tradeName ?? company.name).toLowerCase().includes(term);
    });
    const companyIds = eligibleCompanies.map((company) => company.id);
    if (!companyIds.length) return { vacancies: [], companies: [], facets: facetsOf([]), total: 0 };

    const postings = await this.prisma.recruitJobPosting.findMany({
      where: {
        ...publicPostingWhere(companyIds),
        AND: [
          ...publicPostingAnd(),
          ...(filters.q
            ? [{
                OR: [
                  { title: { contains: filters.q, mode: 'insensitive' as const } },
                  { areaName: { contains: filters.q, mode: 'insensitive' as const } },
                  { publicDescription: { contains: filters.q, mode: 'insensitive' as const } },
                ],
              }]
            : []),
        ],
        ...(filters.city ? { city: { contains: filters.city, mode: 'insensitive' } } : {}),
        ...(filters.workMode ? { workMode: filters.workMode } : {}),
        ...(filters.contractType ? { contractType: filters.contractType } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take: 500,
      select: postingSelect,
    });
    const companyById = new Map(eligibleCompanies.map((company) => [company.id, company]));
    const vacancies = postings
      .filter((posting) => isPubliclyVisible(posting) && companyById.has(posting.companyId))
      .map((posting) => ({
        ...toPublicVacancy(posting),
        company: this.publicCompany(companyById.get(posting.companyId)!),
      }));
    const counts = new Map<string, number>();
    for (const vacancy of vacancies) counts.set(vacancy.company.id, (counts.get(vacancy.company.id) ?? 0) + 1);

    return {
      vacancies,
      companies: eligibleCompanies
        .filter((company) => counts.has(company.id))
        .map((company) => ({
          ...this.publicCompany(company),
          openVacancies: counts.get(company.id) ?? 0,
          primaryColor: this.publicCareerPage(company).primaryColor,
        })),
      facets: facetsOf(postings),
      total: vacancies.length,
    };
  }

  /** Detalhe público de uma vaga de uma empresa. */
  async getVacancy(vacancySlug: string, host?: string, slug?: string) {
    const company = await this.resolveCompany(host, slug);
    const careerPage = this.publicCareerPage(company);
    if (!careerPage.published) throw new NotFoundException('Página de carreiras indisponível.');
    const posting = await this.prisma.recruitJobPosting.findFirst({
      where: { companyId: company.id, slug: vacancySlug, deletedAt: null },
      select: postingSelect,
    });
    if (!posting || !isPubliclyVisible(posting)) {
      throw new NotFoundException('Vaga não encontrada ou encerrada.');
    }
    return {
      company: this.publicCompany(company),
      careerPage,
      vacancy: toPublicVacancy(posting),
    };
  }

  /** Configuração privada usada pelo editor da empresa. */
  async getCareerPageConfig(me: AuthPayload) {
    const company = await this.prisma.company.findFirst({
      where: { id: me.companyId, deletedAt: null },
      select: brandSelect,
    });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    return {
      company: {
        id: company.id,
        name: company.tradeName ?? company.name,
        slug: company.slug,
        defaultLogoUrl: company.logoUrl,
      },
      page: this.publicCareerPage(company),
      configured: Boolean(company.recruitCareerPage),
      publicPath: company.slug ? `/carreiras/${company.slug}` : null,
    };
  }

  async updateCareerPage(me: AuthPayload, body: Record<string, unknown> = {}) {
    const company = await this.prisma.company.findFirst({
      where: { id: me.companyId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada.');

    const data = normalizeCareerPageInput(body);
    const updated = await this.prisma.recruitCareerPage.upsert({
      where: { companyId: me.companyId },
      create: { companyId: me.companyId, ...data },
      update: data,
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'RecruitCareerPage',
      entityId: updated.id,
      action: 'UPDATE',
      message: 'Página pública de carreiras atualizada',
    });
    return this.getCareerPageConfig(me);
  }

  async uploadCareerAsset(me: AuthPayload, kind: string, body: Record<string, unknown> = {}) {
    if (!['logo', 'banner'].includes(kind)) throw new BadRequestException('Tipo de imagem inválido.');
    const mimeType = String(body.mimeType ?? '').toLowerCase();
    if (!IMAGE_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException('Use uma imagem PNG, JPG ou WebP.');
    }
    const rawBase64 = String(body.contentBase64 ?? '').replace(/^data:[^;]+;base64,/, '');
    if (!rawBase64) throw new BadRequestException('Envie o conteúdo da imagem.');
    const buffer = Buffer.from(rawBase64, 'base64');
    const maxBytes = kind === 'banner' ? 6 * 1024 * 1024 : 2 * 1024 * 1024;
    if (!buffer.length || buffer.length > maxBytes) {
      throw new BadRequestException(`A imagem deve ter no máximo ${kind === 'banner' ? '6 MB' : '2 MB'}.`);
    }
    if (!matchesImageSignature(buffer, mimeType)) throw new BadRequestException('O conteúdo não corresponde ao tipo da imagem.');

    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const stored = await this.storage.putBinary(
      me.companyId,
      'recruitment/careers',
      `${kind}-${Date.now()}.${extension}`,
      buffer,
      mimeType,
    );
    const data = kind === 'banner'
      ? { bannerStorageKey: stored.storageKey, bannerMimeType: mimeType, bannerUrl: null }
      : { logoStorageKey: stored.storageKey, logoMimeType: mimeType, logoUrl: null };
    const updated = await this.prisma.recruitCareerPage.upsert({
      where: { companyId: me.companyId },
      create: { companyId: me.companyId, ...data },
      update: data,
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'RecruitCareerPage',
      entityId: updated.id,
      action: 'UPLOAD',
      message: `${kind === 'banner' ? 'Banner' : 'Logo'} da página de carreiras atualizado`,
    });
    return this.getCareerPageConfig(me);
  }

  async removeCareerAsset(me: AuthPayload, kind: string) {
    if (!['logo', 'banner'].includes(kind)) throw new BadRequestException('Tipo de imagem inválido.');
    const existing = await this.prisma.recruitCareerPage.findUnique({ where: { companyId: me.companyId } });
    if (!existing) return this.getCareerPageConfig(me);
    const data = kind === 'banner'
      ? { bannerStorageKey: null, bannerMimeType: null, bannerUrl: null }
      : { logoStorageKey: null, logoMimeType: null, logoUrl: null };
    await this.prisma.recruitCareerPage.update({ where: { companyId: me.companyId }, data });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'RecruitCareerPage',
      entityId: existing.id,
      action: 'DELETE_ASSET',
      message: `${kind === 'banner' ? 'Banner' : 'Logo'} da página de carreiras removido`,
    });
    return this.getCareerPageConfig(me);
  }

  async readPublicAsset(kind: string, host?: string, slug?: string) {
    if (!['logo', 'banner'].includes(kind)) throw new NotFoundException('Imagem não encontrada.');
    const company = await this.resolveCompany(host, slug);
    const page = company.recruitCareerPage;
    const storageKey = kind === 'banner' ? page?.bannerStorageKey : page?.logoStorageKey;
    const mimeType = kind === 'banner' ? page?.bannerMimeType : page?.logoMimeType;
    if (!storageKey || !mimeType) throw new NotFoundException('Imagem não encontrada.');
    return { buffer: await this.storage.readBinary(storageKey), mimeType };
  }

  private publicCompany(company: BrandCompany) {
    return {
      id: company.id,
      name: company.tradeName ?? company.name,
      slug: company.slug,
      logoUrl: this.publicCareerPage(company).logoUrl,
      careersPath: company.slug ? `/carreiras/${company.slug}` : '/carreiras',
    };
  }

  private publicCareerPage(company: BrandCompany): PublicCareerPage {
    const page = company.recruitCareerPage;
    const slugQuery = company.slug ? `?empresa=${encodeURIComponent(company.slug)}` : '';
    return {
      published: page?.published ?? true,
      showInGlobalPortal: page?.showInGlobalPortal ?? true,
      template: page?.template ?? 'MODERN',
      heroAlignment: page?.heroAlignment ?? 'LEFT',
      headline: page?.headline ?? `Venha construir o futuro com ${company.tradeName ?? company.name}`,
      subheadline: page?.subheadline ?? 'Conheça nossas oportunidades e encontre o próximo passo da sua carreira.',
      bannerUrl: page?.bannerStorageKey ? `/careers/assets/banner${slugQuery}` : page?.bannerUrl ?? null,
      logoUrl: page?.logoStorageKey ? `/careers/assets/logo${slugQuery}` : page?.logoUrl ?? company.logoUrl,
      primaryColor: page?.primaryColor ?? '#0f172a',
      secondaryColor: page?.secondaryColor ?? '#0284c7',
      accentColor: page?.accentColor ?? '#10b981',
      backgroundColor: page?.backgroundColor ?? '#f8fafc',
      aboutTitle: page?.aboutTitle ?? 'Sobre nós',
      aboutText: page?.aboutText ?? null,
      cultureTitle: page?.cultureTitle ?? 'Nossa cultura',
      cultureText: page?.cultureText ?? null,
      benefitsTitle: page?.benefitsTitle ?? 'Por que trabalhar conosco',
      benefitsText: page?.benefitsText ?? null,
      contactEmail: page?.contactEmail ?? null,
      websiteUrl: page?.websiteUrl ?? null,
      linkedinUrl: page?.linkedinUrl ?? null,
      seoTitle: page?.seoTitle ?? null,
      seoDescription: page?.seoDescription ?? null,
      showAbout: page?.showAbout ?? true,
      showCulture: page?.showCulture ?? true,
      showBenefits: page?.showBenefits ?? true,
    };
  }
}

const careerPageSelect = {
  published: true,
  showInGlobalPortal: true,
  template: true,
  heroAlignment: true,
  headline: true,
  subheadline: true,
  bannerUrl: true,
  bannerStorageKey: true,
  bannerMimeType: true,
  logoUrl: true,
  logoStorageKey: true,
  logoMimeType: true,
  primaryColor: true,
  secondaryColor: true,
  accentColor: true,
  backgroundColor: true,
  aboutTitle: true,
  aboutText: true,
  cultureTitle: true,
  cultureText: true,
  benefitsTitle: true,
  benefitsText: true,
  contactEmail: true,
  websiteUrl: true,
  linkedinUrl: true,
  seoTitle: true,
  seoDescription: true,
  showAbout: true,
  showCulture: true,
  showBenefits: true,
} as const;

const brandSelect = {
  id: true,
  name: true,
  tradeName: true,
  slug: true,
  logoUrl: true,
  recruitCareerPage: { select: careerPageSelect },
} as const;

type BrandCompany = Prisma.CompanyGetPayload<{ select: typeof brandSelect }>;

const postingSelect = {
  id: true,
  companyId: true,
  slug: true,
  title: true,
  publicDescription: true,
  publicRequirements: true,
  benefitsText: true,
  processStepsText: true,
  location: true,
  city: true,
  workMode: true,
  contractType: true,
  areaName: true,
  visibility: true,
  pcd: true,
  showSalary: true,
  salaryText: true,
  status: true,
  publishedAt: true,
  closesAt: true,
} as const;

function publicPostingWhere(companyIds: string[]): Prisma.RecruitJobPostingWhereInput {
  return {
    companyId: { in: companyIds },
    deletedAt: null,
    status: 'PUBLISHED',
    visibility: { in: ['PUBLIC', 'BOTH'] },
  };
}

function publicPostingAnd(): Prisma.RecruitJobPostingWhereInput[] {
  return [{ OR: [{ closesAt: null }, { closesAt: { gte: new Date() } }] }];
}

function facetsOf(postings: Array<{ city: string | null; workMode: string | null; contractType: string | null }>) {
  return {
    cities: unique(postings.map((posting) => posting.city)),
    workModes: unique(postings.map((posting) => posting.workMode)),
    contractTypes: unique(postings.map((posting) => posting.contractType)),
  };
}

function unique(values: Array<string | null>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}

export function normalizeCareerPageInput(body: Record<string, unknown>): Prisma.RecruitCareerPageUncheckedCreateWithoutCompanyInput {
  const data: Record<string, unknown> = {};
  for (const field of ['published', 'showInGlobalPortal', 'showAbout', 'showCulture', 'showBenefits']) {
    if (field in body) data[field] = Boolean(body[field]);
  }
  if ('template' in body) {
    const template = String(body.template ?? '').toUpperCase();
    if (!CAREER_TEMPLATES.includes(template)) throw new BadRequestException('Modelo de página inválido.');
    data.template = template;
  }
  if ('heroAlignment' in body) {
    const alignment = String(body.heroAlignment ?? '').toUpperCase();
    if (!HERO_ALIGNMENTS.includes(alignment)) throw new BadRequestException('Alinhamento do destaque inválido.');
    data.heroAlignment = alignment;
  }
  for (const field of ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor']) {
    if (!(field in body)) continue;
    const color = String(body[field] ?? '').trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) throw new BadRequestException(`Cor inválida em ${field}.`);
    data[field] = color;
  }
  const shortFields = ['headline', 'aboutTitle', 'cultureTitle', 'benefitsTitle', 'seoTitle'];
  for (const field of shortFields) if (field in body) data[field] = limitedText(body[field], 160);
  const longFields = ['subheadline', 'aboutText', 'cultureText', 'benefitsText', 'seoDescription'];
  for (const field of longFields) if (field in body) data[field] = limitedText(body[field], field.endsWith('Text') ? 6000 : 500);
  for (const field of ['bannerUrl', 'logoUrl', 'websiteUrl', 'linkedinUrl']) {
    if (field in body) data[field] = publicUrl(body[field]);
  }
  if ('bannerUrl' in body && data.bannerUrl) {
    data.bannerStorageKey = null;
    data.bannerMimeType = null;
  }
  if ('logoUrl' in body && data.logoUrl) {
    data.logoStorageKey = null;
    data.logoMimeType = null;
  }
  if ('contactEmail' in body) {
    const email = limitedText(body.contactEmail, 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('E-mail de contato inválido.');
    data.contactEmail = email;
  }
  return data as Prisma.RecruitCareerPageUncheckedCreateWithoutCompanyInput;
}

function limitedText(value: unknown, max: number) {
  const text = String(value ?? '').trim();
  if (text.length > max) throw new BadRequestException(`Texto excede o limite de ${max} caracteres.`);
  return text || null;
}

function publicUrl(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new BadRequestException('Informe uma URL completa, começando com http:// ou https://.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new BadRequestException('Protocolo de URL não permitido.');
  return parsed.toString();
}

export function matchesImageSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}
