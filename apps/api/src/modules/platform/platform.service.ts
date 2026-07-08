import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActionStatus, CompanyStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AccessService } from '../access/access.service';
import { AuthPayload } from '../auth/auth.types';
import { swallow } from '../../common/logging/swallow';
import { prepareTenantFields } from '../../common/tenant-fields';
import { CreateCompanyDto, UpdateCompanyDto } from './platform.dto';

const OPEN_ACTION_STATUSES = {
  notIn: [ActionStatus.DONE, ActionStatus.DONE_LATE, ActionStatus.CANCELLED],
} satisfies Prisma.EnumActionStatusFilter;

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  /**
   * Super Admin escolhe/entra em uma empresa para administrar (impersonação).
   * `companyId === null` (ou a própria empresa de origem) volta o usuário à origem.
   * Grava em `User.activeCompanyId`; a empresa efetiva é recomputada no `JwtStrategy.validate`
   * a cada requisição, então a troca passa a valer no próximo request (o frontend recarrega).
   */
  async switchCompany(me: AuthPayload, companyId: string | null) {
    const home = me.homeCompanyId ?? me.companyId;
    let target: string | null = null;
    let company: Prisma.CompanyGetPayload<object> | null;

    if (companyId && companyId !== home) {
      // Super Admin pode administrar empresas de qualquer status (inclusive suspensas).
      company = await this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null } });
      if (!company) throw new NotFoundException('Empresa não encontrada.');
      target = companyId;
    } else {
      company = await this.prisma.company.findFirst({ where: { id: home, deletedAt: null } });
      target = null;
    }

    await this.prisma.user.update({ where: { id: me.sub }, data: { activeCompanyId: target } });
    this.access.invalidate(me.sub);
    await this.audit(me, target ?? home, 'SWITCH_COMPANY', { activeCompanyId: me.companyId }, { activeCompanyId: target });

    return {
      company: company ? this.serialize(company) : null,
      impersonating: target !== null,
    };
  }

  /** Dashboard global do Super Admin: contagens agregadas da plataforma. */
  async overview() {
    const [companies, statusGroups, totalUsers, activeUsers] = await this.prisma.$transaction([
      this.prisma.company.count({ where: { deletedAt: null } }),
      this.prisma.company.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true, orderBy: { status: 'asc' } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE', active: true } }),
    ]);
    const byStatus = (s: CompanyStatus) => statusGroups.find((g) => g.status === s)?._count ?? 0;
    return {
      companies,
      active: byStatus(CompanyStatus.ACTIVE),
      suspended: byStatus(CompanyStatus.SUSPENDED),
      inactive: byStatus(CompanyStatus.INACTIVE),
      totalUsers,
      activeUsers,
    };
  }

  /** Lista de empresas com indicadores de uso (usuários, indicadores, ações, último acesso). */
  async listCompanies() {
    const companies = await this.prisma.company.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
    const ids = companies.map((c) => c.id);
    if (ids.length === 0) return [];

    const order = { companyId: 'asc' } as const;
    const [users, indicators, openActions, lastAccess] = await this.prisma.$transaction([
      this.prisma.user.groupBy({ by: ['companyId'], where: { companyId: { in: ids }, deletedAt: null }, _count: true, orderBy: order }),
      this.prisma.indicator.groupBy({ by: ['companyId'], where: { companyId: { in: ids }, deletedAt: null }, _count: true, orderBy: order }),
      this.prisma.actionPlan.groupBy({
        by: ['companyId'],
        where: { companyId: { in: ids }, deletedAt: null, status: OPEN_ACTION_STATUSES },
        _count: true,
        orderBy: order,
      }),
      this.prisma.user.groupBy({ by: ['companyId'], where: { companyId: { in: ids }, deletedAt: null }, _max: { lastLoginAt: true }, orderBy: order }),
    ]);

    const countMap = (arr: Array<{ companyId: string; _count: unknown }>) => {
      const m = new Map<string, number>();
      for (const x of arr) m.set(x.companyId, typeof x._count === 'number' ? x._count : 0);
      return m;
    };
    const usersMap = countMap(users);
    const indicatorsMap = countMap(indicators);
    const actionsMap = countMap(openActions);
    const lastAccessMap = new Map(lastAccess.map((x) => [x.companyId, x._max?.lastLoginAt ?? null]));

    return companies.map((c) => ({
      ...this.serialize(c),
      usage: {
        users: usersMap.get(c.id) ?? 0,
        indicators: indicatorsMap.get(c.id) ?? 0,
        openActions: actionsMap.get(c.id) ?? 0,
        lastAccessAt: lastAccessMap.get(c.id) ?? null,
      },
    }));
  }

  async getCompany(id: string) {
    const company = await this.prisma.company.findFirst({ where: { id, deletedAt: null } });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    const [users, branches, areas, indicators] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { companyId: id, deletedAt: null } }),
      this.prisma.branch.count({ where: { companyId: id, deletedAt: null } }),
      this.prisma.orgNode.count({ where: { companyId: id, deletedAt: null } }),
      this.prisma.indicator.count({ where: { companyId: id, deletedAt: null } }),
    ]);
    return { ...this.serialize(company), usage: { users, branches, areas, indicators } };
  }

  async createCompany(me: AuthPayload, dto: CreateCompanyDto) {
    if (dto.cnpj) {
      const dup = await this.prisma.company.findFirst({ where: { cnpj: dto.cnpj, deletedAt: null } });
      if (dup) throw new ConflictException('Já existe empresa com este CNPJ.');
    }
    const status = dto.status ?? CompanyStatus.ACTIVE;
    const tenantFields = await this.prepareTenantFields(dto);
    const created = await this.prisma.company.create({
      data: {
        name: dto.name,
        tradeName: dto.tradeName ?? null,
        cnpj: dto.cnpj ?? null,
        logoUrl: dto.logoUrl ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        addressLine: dto.addressLine ?? null,
        city: dto.city ?? null,
        state: dto.state ?? null,
        segment: dto.segment ?? null,
        maxUsers: dto.maxUsers ?? null,
        notes: dto.notes ?? null,
        status,
        active: status === CompanyStatus.ACTIVE,
        areaAccessEnabled: dto.areaAccessEnabled ?? true,
        ...tenantFields,
      },
    });
    await this.audit(me, created.id, 'CREATE', null, created);
    return this.serialize(created);
  }

  async updateCompany(me: AuthPayload, id: string, dto: UpdateCompanyDto) {
    const before = await this.prisma.company.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('Empresa não encontrada.');
    if (dto.cnpj && dto.cnpj !== before.cnpj) {
      const dup = await this.prisma.company.findFirst({ where: { cnpj: dto.cnpj, deletedAt: null, NOT: { id } } });
      if (dup) throw new ConflictException('Já existe empresa com este CNPJ.');
    }
    const tenantFields = await this.prepareTenantFields(dto, id);
    // slug/customDomain são validados/normalizados em prepareTenantFields; o resto do dto entra direto.
    const { slug: _slug, customDomain: _customDomain, ...rest } = dto;
    const data: Prisma.CompanyUpdateInput = { ...rest, ...tenantFields };
    if (dto.status) data.active = dto.status === CompanyStatus.ACTIVE;
    const updated = await this.prisma.company.update({ where: { id }, data });
    await this.audit(me, id, 'UPDATE', before, updated);
    return this.serialize(updated);
  }

  async setStatus(me: AuthPayload, id: string, status: CompanyStatus) {
    const before = await this.prisma.company.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('Empresa não encontrada.');
    const updated = await this.prisma.company.update({
      where: { id },
      data: { status, active: status === CompanyStatus.ACTIVE },
    });
    await this.audit(me, id, status === CompanyStatus.SUSPENDED ? 'SUSPEND' : status === CompanyStatus.ACTIVE ? 'REACTIVATE' : 'DEACTIVATE', before, updated);
    return this.serialize(updated);
  }

  /** Valida/normaliza slug e customDomain reusando a regra compartilhada. */
  private prepareTenantFields(dto: { slug?: string; customDomain?: string }, currentId?: string) {
    return prepareTenantFields(dto, {
      slugTaken: async (slug) =>
        !!(await this.prisma.company.findFirst({
          where: { slug, deletedAt: null, ...(currentId ? { NOT: { id: currentId } } : {}) },
          select: { id: true },
        })),
      customDomainTaken: async (domain) =>
        !!(await this.prisma.company.findFirst({
          where: { customDomain: domain, deletedAt: null, ...(currentId ? { NOT: { id: currentId } } : {}) },
          select: { id: true },
        })),
    });
  }

  private serialize(c: Prisma.CompanyGetPayload<object>) {
    return {
      id: c.id,
      name: c.name,
      tradeName: c.tradeName,
      cnpj: c.cnpj,
      slug: c.slug,
      customDomain: c.customDomain,
      logoUrl: c.logoUrl,
      email: c.email,
      phone: c.phone,
      addressLine: c.addressLine,
      city: c.city,
      state: c.state,
      segment: c.segment,
      maxUsers: c.maxUsers,
      notes: c.notes,
      status: c.status,
      areaAccessEnabled: c.areaAccessEnabled,
      createdAt: c.createdAt,
    };
  }

  private async audit(me: AuthPayload, companyId: string, action: string, before: unknown, after: unknown) {
    await this.auditWriter.record(
      { companyId, sub: me.sub },
      { action, module: 'platform', entity: 'Company', entityId: companyId, before, after },
    );
  }
}
