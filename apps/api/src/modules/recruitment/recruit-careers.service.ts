import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeHost, subdomainFromHost } from '../../common/tenant-host';
import { isPubliclyVisible, toPublicVacancy } from './recruit-posting.logic';

/**
 * Portal público de carreiras (F2) — SEM autenticação. Resolve a empresa pelo
 * host (subdomínio/domínio próprio) ou por slug explícito, e expõe SOMENTE
 * campos públicos das vagas publicadas. Nenhum dado interno (orçamento, centro
 * de custo, aprovadores, notas, requisição) sai daqui.
 */
@Injectable()
export class RecruitCareersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve a empresa por host (subdomínio/domínio próprio) OU slug explícito. Público: reusado por candidato/candidatura. */
  async resolveCompany(host?: string, slug?: string) {
    const normalizedHost = normalizeHost(host);
    if (normalizedHost) {
      const byDomain = await this.prisma.company.findFirst({ where: { customDomain: normalizedHost, deletedAt: null }, select: brandSelect });
      if (byDomain) return byDomain;
      const sub = subdomainFromHost(normalizedHost);
      if (sub) {
        const bySub = await this.prisma.company.findFirst({ where: { slug: sub, deletedAt: null }, select: brandSelect });
        if (bySub) return bySub;
      }
    }
    const cleanSlug = String(slug ?? '').trim().toLowerCase();
    if (cleanSlug) {
      const bySlug = await this.prisma.company.findFirst({ where: { slug: cleanSlug, deletedAt: null }, select: brandSelect });
      if (bySlug) return bySlug;
    }
    throw new NotFoundException('Empresa não encontrada.');
  }

  /** Marca da empresa + contagem de vagas abertas (para o cabeçalho do portal). */
  async companyInfo(host?: string, slug?: string) {
    const company = await this.resolveCompany(host, slug);
    const openCount = await this.prisma.recruitJobPosting.count({
      where: { companyId: company.id, deletedAt: null, status: 'PUBLISHED', visibility: { in: ['PUBLIC', 'BOTH'] } },
    });
    return { company: { name: company.tradeName ?? company.name, slug: company.slug, logoUrl: company.logoUrl }, openVacancies: openCount };
  }

  /** Lista as vagas públicas abertas (com filtros simples). */
  async listVacancies(host?: string, slug?: string, filters: { q?: string; city?: string; workMode?: string } = {}) {
    const company = await this.resolveCompany(host, slug);
    const postings = await this.prisma.recruitJobPosting.findMany({
      where: {
        companyId: company.id,
        deletedAt: null,
        status: 'PUBLISHED',
        visibility: { in: ['PUBLIC', 'BOTH'] },
        OR: [{ closesAt: null }, { closesAt: { gte: new Date() } }],
        ...(filters.city ? { city: { contains: filters.city, mode: 'insensitive' } } : {}),
        ...(filters.workMode ? { workMode: filters.workMode } : {}),
        ...(filters.q ? { OR: [{ title: { contains: filters.q, mode: 'insensitive' } }, { areaName: { contains: filters.q, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take: 200,
      select: postingSelect,
    });
    return {
      company: { name: company.tradeName ?? company.name, slug: company.slug, logoUrl: company.logoUrl },
      vacancies: postings.filter((p) => isPubliclyVisible(p)).map(toPublicVacancy),
    };
  }

  /** Detalhe público de uma vaga. */
  async getVacancy(vacancySlug: string, host?: string, slug?: string) {
    const company = await this.resolveCompany(host, slug);
    const posting = await this.prisma.recruitJobPosting.findFirst({
      where: { companyId: company.id, slug: vacancySlug, deletedAt: null },
      select: postingSelect,
    });
    if (!posting || !isPubliclyVisible(posting)) throw new NotFoundException('Vaga não encontrada ou encerrada.');
    return { company: { name: company.tradeName ?? company.name, slug: company.slug, logoUrl: company.logoUrl }, vacancy: toPublicVacancy(posting) };
  }
}

const brandSelect = { id: true, name: true, tradeName: true, slug: true, logoUrl: true } as const;

const postingSelect = {
  id: true, slug: true, title: true, publicDescription: true, publicRequirements: true, benefitsText: true,
  processStepsText: true, location: true, city: true, workMode: true, contractType: true, areaName: true,
  visibility: true, pcd: true, showSalary: true, salaryText: true, status: true, publishedAt: true, closesAt: true,
} as const;
