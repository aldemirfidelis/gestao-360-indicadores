import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeHost, subdomainFromHost } from '../../common/tenant-host';

export interface TenantBrand {
  companyId: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
}

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve a empresa a partir do host: primeiro por domínio próprio
   * (customDomain = host completo), depois pelo slug do subdomínio.
   * Retorna null quando o host é o apex/serviço ou não corresponde a um tenant.
   */
  async resolveByHost(rawHost: string | null | undefined): Promise<TenantBrand | null> {
    const host = normalizeHost(rawHost);
    if (!host) return null;

    const select = { id: true, name: true, tradeName: true, slug: true, logoUrl: true } as const;

    const byCustomDomain = await this.prisma.company.findFirst({
      where: { customDomain: host, deletedAt: null },
      select,
    });
    if (byCustomDomain) return this.toBrand(byCustomDomain);

    const slug = subdomainFromHost(host);
    if (!slug) return null;
    const bySlug = await this.prisma.company.findFirst({
      where: { slug, deletedAt: null },
      select,
    });
    return bySlug ? this.toBrand(bySlug) : null;
  }

  private toBrand(c: { id: string; name: string; tradeName: string | null; slug: string | null; logoUrl: string | null }): TenantBrand {
    return {
      companyId: c.id,
      name: c.tradeName || c.name,
      slug: c.slug,
      logoUrl: c.logoUrl,
    };
  }
}
