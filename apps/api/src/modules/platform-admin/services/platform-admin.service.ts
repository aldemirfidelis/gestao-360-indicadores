import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CompanyStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlatformAdminAuditService } from './platform-admin-audit.service';
import { PlatformAdminIdentity } from '../platform-admin.types';
import { PLATFORM_MODULES, PLATFORM_PLANS } from '../platform-admin.catalog';

const ACTIVE_MODULE_STATUSES = ['ATIVO', 'ACTIVE', 'HERDADO_DO_PLANO', 'EM_IMPLANTACAO', 'EM_TESTE', 'EXPERIMENTAL'];
const BLOCKED_MODULE_STATUSES = ['BLOQUEADO', 'SUSPENSO', 'BLOCKED', 'SUSPENDED'];

interface CompanyInput {
  name?: string;
  tradeName?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  segment?: string | null;
  maxUsers?: number | null;
  notes?: string | null;
  lifecycleStatus?: string;
  planCode?: string | null;
  internalCode?: string | null;
  commercialOwner?: string | null;
  implementationOwner?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  contractEndsAt?: string | null;
  storageLimitMb?: number | null;
  maxBranches?: number | null;
  maxDocuments?: number | null;
  maxForms?: number | null;
  maxIndicators?: number | null;
  maxIntegrations?: number | null;
}

interface ModuleUpdateInput {
  status: string;
  reason?: string | null;
  note?: string | null;
  readOnly?: boolean;
  activationScheduledAt?: string | null;
  expirationScheduledAt?: string | null;
  trialEndsAt?: string | null;
}

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAdminAuditService,
  ) {}

  async syncFoundation(user: PlatformAdminIdentity) {
    await this.syncCatalogData();
    await this.audit.record({ user, action: 'SYNC_FOUNDATION', targetType: 'PlatformFoundation' });
    return { ok: true };
  }

  async dashboard() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalCompanies,
      companyStatus,
      profileStatus,
      totalUsers,
      active7d,
      active30d,
      onlineUsers,
      accessesToday,
      accessesMonth,
      recentErrors,
      modules,
      moduleUsage,
      integrations,
      health,
      lastBackup,
      nextBackup,
      pendingMigrations,
      currentRelease,
      alerts,
      recentAudit,
    ] = await Promise.all([
      this.prisma.company.count({ where: { deletedAt: null } }),
      this.prisma.company.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
      this.prisma.platformCompanyProfile.groupBy({ by: ['lifecycleStatus'], _count: { _all: true } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: sevenDaysAgo } } }),
      this.prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: thirtyDaysAgo } } }),
      this.prisma.userPresence.count({ where: { status: 'ONLINE' } }).catch(() => 0),
      this.prisma.auditLog.count({ where: { action: 'LOGIN', createdAt: { gte: dayStart } } }),
      this.prisma.auditLog.count({ where: { action: 'LOGIN', createdAt: { gte: monthStart } } }),
      this.prisma.platformAuditLog.count({ where: { result: 'ERROR', createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.platformModuleCatalog.count(),
      this.prisma.platformCompanyModule.groupBy({ by: ['moduleCode'], _count: { _all: true }, orderBy: { moduleCode: 'asc' } }),
      this.prisma.platformIntegrationConfig.groupBy({ by: ['status'], _count: { _all: true } }),
      this.databaseHealth(),
      this.prisma.platformBackup.findFirst({ orderBy: { createdAt: 'desc' } }),
      this.prisma.platformBackup.findFirst({ where: { status: 'SCHEDULED' }, orderBy: { createdAt: 'asc' } }),
      this.prisma.platformMigrationRecord.count({ where: { status: 'PENDING' } }),
      this.prisma.platformRelease.findFirst({ where: { environmentCode: 'production' }, orderBy: { createdAt: 'desc' } }),
      this.adminAlerts(now),
      this.prisma.platformAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);

    const companyStatusMap = new Map(companyStatus.map((item) => [item.status, item._count._all]));
    const lifecycleMap = new Map(profileStatus.map((item) => [item.lifecycleStatus, item._count._all]));
    const integrationMap = new Map(integrations.map((item) => [item.status, item._count._all]));
    const moduleUsageRows = moduleUsage.map((item) => ({ moduleCode: item.moduleCode, companies: item._count._all }));

    return {
      cards: {
        totalCompanies,
        activeCompanies: companyStatusMap.get(CompanyStatus.ACTIVE) ?? 0,
        suspendedCompanies: companyStatusMap.get(CompanyStatus.SUSPENDED) ?? 0,
        implementationCompanies: lifecycleMap.get('IMPLEMENTATION') ?? 0,
        trialCompanies: lifecycleMap.get('TRIAL') ?? 0,
        totalUsers,
        activeUsers7d: active7d,
        activeUsers30d: active30d,
        onlineUsers,
        accessesToday,
        accessesMonth,
        totalModules: modules,
        recentErrors,
        integrationStatus: {
          total: integrations.reduce((sum, item) => sum + item._count._all, 0),
          active: integrationMap.get('ACTIVE') ?? integrationMap.get('enabled') ?? 0,
          failing: integrationMap.get('ERROR') ?? integrationMap.get('FAILING') ?? 0,
        },
        databaseStatus: health.status,
        lastBackupAt: lastBackup?.finishedAt ?? lastBackup?.createdAt ?? null,
        nextBackupAt: nextBackup?.createdAt ?? null,
        currentVersion: currentRelease?.version ?? process.env.npm_package_version ?? '0.1.0',
        pendingUpdates: pendingMigrations,
      },
      charts: {
        companiesByPlan: await this.companiesByPlan(),
        modulesMostUsed: moduleUsageRows.sort((a, b) => b.companies - a.companies).slice(0, 8),
        modulesLeastUsed: moduleUsageRows.sort((a, b) => a.companies - b.companies).slice(0, 8),
        activeUsers: [
          { label: '7 dias', value: active7d },
          { label: '30 dias', value: active30d },
        ],
      },
      alerts,
      health,
      recentAudit,
    };
  }

  async listCompanies(params: { q?: string; status?: string; plan?: string; skip?: number; take?: number }) {
    const where: Prisma.CompanyWhereInput = { deletedAt: null };
    if (params.q) {
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { tradeName: { contains: params.q, mode: 'insensitive' } },
        { cnpj: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    if (params.status && ['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(params.status)) {
      where.status = params.status as CompanyStatus;
    }

    const take = Math.min(Math.max(params.take ?? 50, 1), 200);
    const skip = Math.max(params.skip ?? 0, 0);
    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
      this.prisma.company.count({ where }),
    ]);
    const rows = await this.decorateCompanies(companies);
    const filtered = params.plan ? rows.filter((row) => row.profile?.planCode === params.plan) : rows;
    return { rows: filtered, total, take, skip };
  }

  async getCompany(id: string) {
    const company = await this.prisma.company.findFirst({ where: { id, deletedAt: null } });
    if (!company) throw new NotFoundException('Empresa nao encontrada.');

    const [profile, users, branches, orgNodes, indicators, actions, documents, audits, forms, modules, logs, integrations, support] =
      await Promise.all([
        this.prisma.platformCompanyProfile.findUnique({ where: { companyId: id } }),
        this.prisma.user.findMany({
          where: { companyId: id, deletedAt: null },
          orderBy: { name: 'asc' },
          take: 200,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            active: true,
            lastLoginAt: true,
            createdAt: true,
            branch: { select: { name: true } },
            defaultNode: { select: { name: true } },
          },
        }),
        this.prisma.branch.count({ where: { companyId: id, deletedAt: null } }),
        this.prisma.orgNode.count({ where: { companyId: id, deletedAt: null } }),
        this.prisma.indicator.count({ where: { companyId: id, deletedAt: null } }),
        this.prisma.actionPlan.count({ where: { companyId: id, deletedAt: null } }),
        this.prisma.document.count({ where: { companyId: id, deletedAt: null } }).catch(() => 0),
        this.prisma.audit.count({ where: { companyId: id, deletedAt: null } }).catch(() => 0),
        this.prisma.formTemplate.count({ where: { companyId: id, deletedAt: null } }).catch(() => 0),
        this.companyModules(id),
        this.prisma.platformAuditLog.findMany({ where: { companyId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
        this.prisma.platformIntegrationConfig.findMany({ where: { companyId: id }, orderBy: { name: 'asc' } }),
        this.prisma.platformSupportSession.findMany({ where: { companyId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      ]);

    return {
      company: this.serializeCompany(company),
      profile,
      usage: { users: users.length, branches, orgNodes, indicators, actions, documents, audits, forms },
      users,
      modules,
      logs,
      integrations,
      supportSessions: support,
    };
  }

  async createCompany(user: PlatformAdminIdentity, input: CompanyInput) {
    if (!input.name) throw new ConflictException('Nome da empresa e obrigatorio.');
    if (input.cnpj) {
      const dup = await this.prisma.company.findFirst({ where: { cnpj: input.cnpj, deletedAt: null } });
      if (dup) throw new ConflictException('Ja existe empresa com este CNPJ.');
    }

    const companyStatus = input.lifecycleStatus === 'SUSPENDED' ? CompanyStatus.SUSPENDED : CompanyStatus.ACTIVE;
    const company = await this.prisma.company.create({
      data: {
        name: input.name,
        tradeName: input.tradeName ?? null,
        cnpj: input.cnpj ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        segment: input.segment ?? null,
        maxUsers: input.maxUsers ?? null,
        notes: input.notes ?? null,
        status: companyStatus,
        active: companyStatus === CompanyStatus.ACTIVE,
      },
    });
    await this.upsertCompanyProfile(company.id, input, user);
    await this.applyPlanDefaults(company.id, input.planCode ?? 'ESSENCIAL', user);
    await this.audit.record({
      user,
      action: 'COMPANY_CREATE',
      permissionKey: 'platform.companies.create',
      companyId: company.id,
      targetType: 'Company',
      targetId: company.id,
      targetLabel: company.name,
      afterValue: { company, profile: input },
      justification: input.notes ?? null,
    });
    return this.getCompany(company.id);
  }

  async updateCompany(user: PlatformAdminIdentity, id: string, input: CompanyInput) {
    const before = await this.prisma.company.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('Empresa nao encontrada.');
    if (input.cnpj && input.cnpj !== before.cnpj) {
      const dup = await this.prisma.company.findFirst({ where: { cnpj: input.cnpj, deletedAt: null, NOT: { id } } });
      if (dup) throw new ConflictException('Ja existe empresa com este CNPJ.');
    }

    const data: Prisma.CompanyUpdateInput = {};
    for (const key of ['name', 'tradeName', 'cnpj', 'email', 'phone', 'city', 'state', 'segment', 'maxUsers', 'notes'] as const) {
      if (key in input) (data as Record<string, unknown>)[key] = input[key] ?? null;
    }
    const company = await this.prisma.company.update({ where: { id }, data });
    const profile = await this.upsertCompanyProfile(id, input, user);

    await this.audit.record({
      user,
      action: 'COMPANY_UPDATE',
      permissionKey: 'platform.companies.edit',
      companyId: id,
      targetType: 'Company',
      targetId: id,
      targetLabel: company.name,
      beforeValue: before,
      afterValue: { company, profile },
      justification: input.notes ?? null,
    });
    return this.getCompany(id);
  }

  async setCompanyStatus(user: PlatformAdminIdentity, id: string, status: string, reason?: string | null) {
    const before = await this.prisma.company.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('Empresa nao encontrada.');
    const companyStatus = status === 'SUSPENDED' ? CompanyStatus.SUSPENDED : status === 'INACTIVE' ? CompanyStatus.INACTIVE : CompanyStatus.ACTIVE;
    const company = await this.prisma.company.update({
      where: { id },
      data: { status: companyStatus, active: companyStatus === CompanyStatus.ACTIVE },
    });
    const profile = await this.prisma.platformCompanyProfile.upsert({
      where: { companyId: id },
      create: {
        companyId: id,
        internalCode: await this.nextCompanyCode(),
        lifecycleStatus: status,
      },
      update: { lifecycleStatus: status },
    });
    await this.prisma.platformCompanyStatusHistory.create({
      data: {
        companyId: id,
        previousStatus: before.status,
        newStatus: status,
        reason: reason ?? null,
        changedBy: user.sub,
        changedByEmail: user.email,
      },
    });
    await this.audit.record({
      user,
      action: status === 'SUSPENDED' ? 'COMPANY_SUSPEND' : status === 'ACTIVE' ? 'COMPANY_REACTIVATE' : 'COMPANY_STATUS_CHANGE',
      permissionKey: 'platform.companies.suspend',
      companyId: id,
      targetType: 'Company',
      targetId: id,
      targetLabel: company.name,
      beforeValue: before,
      afterValue: { company, profile },
      justification: reason ?? null,
    });
    return this.getCompany(id);
  }

  async listModules() {
    await this.ensureModuleCatalog();
    return this.prisma.platformModuleCatalog.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  async moduleMatrix() {
    const [companies, modules, assignments] = await Promise.all([
      this.prisma.company.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true, tradeName: true, status: true } }),
      this.listModules(),
      this.prisma.platformCompanyModule.findMany(),
    ]);
    const byKey = new Map(assignments.map((item) => [`${item.companyId}:${item.moduleCode}`, item]));
    return {
      modules,
      companies: companies.map((company) => ({
        ...company,
        modules: modules.map((module) => {
          const assignment = byKey.get(`${company.id}:${module.code}`);
          return {
            moduleCode: module.code,
            status: assignment?.status ?? 'HERDADO_DO_PLANO',
            readOnly: assignment?.readOnly ?? false,
            note: assignment?.note ?? null,
          };
        }),
      })),
    };
  }

  async setCompanyModule(user: PlatformAdminIdentity, companyId: string, moduleCode: string, input: ModuleUpdateInput) {
    const company = await this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null } });
    if (!company) throw new NotFoundException('Empresa nao encontrada.');
    await this.ensureModuleCatalog();
    const module = await this.prisma.platformModuleCatalog.findUnique({ where: { code: moduleCode } });
    if (!module) throw new NotFoundException('Modulo nao encontrado.');

    const before = await this.prisma.platformCompanyModule.findUnique({ where: { companyId_moduleCode: { companyId, moduleCode } } });
    const updated = await this.prisma.platformCompanyModule.upsert({
      where: { companyId_moduleCode: { companyId, moduleCode } },
      create: {
        companyId,
        moduleCode,
        status: input.status,
        readOnly: input.readOnly ?? input.status === 'SOMENTE_LEITURA',
        activationScheduledAt: toDate(input.activationScheduledAt),
        expirationScheduledAt: toDate(input.expirationScheduledAt),
        trialEndsAt: toDate(input.trialEndsAt),
        inheritedFromPlan: input.status === 'HERDADO_DO_PLANO',
        manuallyOverridden: input.status !== 'HERDADO_DO_PLANO',
        note: input.note ?? null,
        updatedBy: user.sub,
        updatedByEmail: user.email,
      },
      update: {
        status: input.status,
        readOnly: input.readOnly ?? input.status === 'SOMENTE_LEITURA',
        activationScheduledAt: toDate(input.activationScheduledAt),
        expirationScheduledAt: toDate(input.expirationScheduledAt),
        trialEndsAt: toDate(input.trialEndsAt),
        inheritedFromPlan: input.status === 'HERDADO_DO_PLANO',
        manuallyOverridden: input.status !== 'HERDADO_DO_PLANO',
        note: input.note ?? null,
        updatedBy: user.sub,
        updatedByEmail: user.email,
      },
    });
    await this.prisma.platformCompanyModuleHistory.create({
      data: {
        companyId,
        moduleCode,
        previousStatus: before?.status ?? null,
        newStatus: input.status,
        reason: input.reason ?? null,
        note: input.note ?? null,
        changedBy: user.sub,
        changedByEmail: user.email,
      },
    });
    await this.audit.record({
      user,
      action: BLOCKED_MODULE_STATUSES.includes(input.status) ? 'MODULE_BLOCK' : 'MODULE_CHANGE',
      permissionKey: 'platform.modules.manage',
      companyId,
      moduleCode,
      targetType: 'PlatformCompanyModule',
      targetId: updated.id,
      targetLabel: `${company.name} / ${module.name}`,
      beforeValue: before,
      afterValue: updated,
      justification: input.reason ?? null,
    });
    return updated;
  }

  async applyPlanDefaults(companyId: string, planCode: string, user: PlatformAdminIdentity) {
    const plan = await this.prisma.platformPlan.findUnique({ where: { code: planCode }, include: { modules: true } });
    if (!plan) return;
    for (const module of plan.modules) {
      await this.prisma.platformCompanyModule.upsert({
        where: { companyId_moduleCode: { companyId, moduleCode: module.moduleCode } },
        create: {
          companyId,
          moduleCode: module.moduleCode,
          status: module.included ? 'HERDADO_DO_PLANO' : 'BLOQUEADO',
          inheritedFromPlan: true,
          manuallyOverridden: false,
          updatedBy: user.sub,
          updatedByEmail: user.email,
        },
        update: {
          status: module.included ? 'HERDADO_DO_PLANO' : 'BLOQUEADO',
          inheritedFromPlan: true,
          manuallyOverridden: false,
          updatedBy: user.sub,
          updatedByEmail: user.email,
        },
      });
    }
  }

  async listPlans() {
    await this.ensurePlans();
    return this.prisma.platformPlan.findMany({ where: { deletedAt: null }, include: { modules: true }, orderBy: { monthlyPriceCents: 'asc' } });
  }

  async upsertPlan(user: PlatformAdminIdentity, input: Record<string, unknown>) {
    const code = String(input.code ?? '').trim().toUpperCase();
    const name = String(input.name ?? '').trim();
    if (!code || !name) throw new ConflictException('Codigo e nome do plano sao obrigatorios.');
    const before = await this.prisma.platformPlan.findUnique({ where: { code }, include: { modules: true } });
    const plan = await this.prisma.platformPlan.upsert({
      where: { code },
      create: {
        code,
        name,
        description: stringOrNull(input.description),
        monthlyPriceCents: numberOrZero(input.monthlyPriceCents),
        setupPriceCents: numberOrZero(input.setupPriceCents),
        defaultUsers: numberOrNull(input.defaultUsers),
        defaultBranches: numberOrNull(input.defaultBranches),
        storageLimitMb: numberOrNull(input.storageLimitMb),
        supportLevel: stringOrNull(input.supportLevel),
        sla: stringOrNull(input.sla),
        trialDays: numberOrNull(input.trialDays),
      },
      update: {
        name,
        description: stringOrNull(input.description),
        monthlyPriceCents: numberOrZero(input.monthlyPriceCents),
        setupPriceCents: numberOrZero(input.setupPriceCents),
        defaultUsers: numberOrNull(input.defaultUsers),
        defaultBranches: numberOrNull(input.defaultBranches),
        storageLimitMb: numberOrNull(input.storageLimitMb),
        supportLevel: stringOrNull(input.supportLevel),
        sla: stringOrNull(input.sla),
        trialDays: numberOrNull(input.trialDays),
      },
    });
    await this.audit.record({
      user,
      action: before ? 'PLAN_UPDATE' : 'PLAN_CREATE',
      permissionKey: 'platform.plans.manage',
      targetType: 'PlatformPlan',
      targetId: plan.id,
      targetLabel: plan.name,
      beforeValue: before,
      afterValue: plan,
    });
    return plan;
  }

  async listUsers(params: { q?: string; companyId?: string; status?: string }) {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (params.companyId) where.companyId = params.companyId;
    if (params.status) where.status = params.status as Prisma.EnumUserAccessStatusFilter;
    if (params.q) {
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { email: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.user.findMany({
      where,
      orderBy: { lastLoginAt: 'desc' },
      take: 300,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
        passwordResetRequired: true,
        company: { select: { id: true, name: true, tradeName: true } },
        branch: { select: { name: true } },
        defaultNode: { select: { name: true } },
        refreshTokens: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, createdAt: true, userAgent: true, ip: true } },
      },
    });
  }

  async setUserStatus(user: PlatformAdminIdentity, id: string, status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'PENDING') {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before || before.deletedAt) throw new NotFoundException('Usuario nao encontrado.');
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status,
        active: status === 'ACTIVE',
        blockedAt: status === 'BLOCKED' ? new Date() : null,
      },
    });
    await this.audit.record({
      user,
      action: 'USER_STATUS_CHANGE',
      permissionKey: 'platform.users.manage',
      companyId: updated.companyId,
      targetType: 'User',
      targetId: id,
      targetLabel: updated.email,
      beforeValue: before,
      afterValue: updated,
    });
    return updated;
  }

  async revokeUserSessions(user: PlatformAdminIdentity, id: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) throw new NotFoundException('Usuario nao encontrado.');
    const updated = await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      user,
      action: 'USER_SESSIONS_REVOKE',
      permissionKey: 'platform.users.manage',
      companyId: target.companyId,
      targetType: 'User',
      targetId: id,
      targetLabel: target.email,
      afterValue: updated,
    });
    return updated;
  }

  async sessions() {
    const [companySessions, adminSessions] = await Promise.all([
      this.prisma.refreshToken.findMany({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { user: { select: { id: true, name: true, email: true, company: { select: { name: true, tradeName: true } } } } },
      }),
      this.prisma.platformAdminSession.findMany({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);
    return { companySessions, adminSessions };
  }

  async startSupportSession(
    user: PlatformAdminIdentity,
    input: { companyId?: string; reason?: string; justification?: string; minutes?: number; readOnly?: boolean },
  ) {
    if (!input.companyId || !input.reason || !input.justification) {
      throw new ConflictException('Empresa, motivo e justificativa sao obrigatorios para o modo de suporte.');
    }
    const company = await this.prisma.company.findFirst({ where: { id: input.companyId, deletedAt: null } });
    if (!company) throw new NotFoundException('Empresa nao encontrada.');
    const minutes = Math.min(Math.max(input.minutes ?? 60, 5), 240);
    const session = await this.prisma.platformSupportSession.create({
      data: {
        companyId: input.companyId,
        adminUserId: user.sub,
        adminEmail: user.email,
        reason: input.reason,
        justification: input.justification,
        readOnly: input.readOnly ?? true,
        expiresAt: new Date(Date.now() + minutes * 60 * 1000),
      },
    });
    await this.audit.record({
      user,
      action: 'SUPPORT_MODE_START',
      permissionKey: 'platform.support_mode.start',
      companyId: input.companyId,
      targetType: 'PlatformSupportSession',
      targetId: session.id,
      targetLabel: company.name,
      afterValue: session,
      justification: input.justification,
    });
    return session;
  }

  async endSupportSession(user: PlatformAdminIdentity, id: string) {
    const before = await this.prisma.platformSupportSession.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Sessao de suporte nao encontrada.');
    const updated = await this.prisma.platformSupportSession.update({ where: { id }, data: { endedAt: new Date() } });
    await this.audit.record({
      user,
      action: 'SUPPORT_MODE_END',
      permissionKey: 'platform.support_mode.start',
      companyId: updated.companyId,
      targetType: 'PlatformSupportSession',
      targetId: id,
      beforeValue: before,
      afterValue: updated,
    });
    return updated;
  }

  async database() {
    const health = await this.databaseHealth();
    const [backups, migrations] = await Promise.all([
      this.prisma.platformBackup.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.platformMigrationRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return { health, backups, migrations };
  }

  async featureFlags() {
    const [flags, targets] = await Promise.all([
      this.prisma.portalFeatureFlag.findMany({ orderBy: { key: 'asc' } }),
      this.prisma.platformFeatureFlagTarget.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);
    return { flags, targets };
  }

  async upsertFeatureFlag(user: PlatformAdminIdentity, input: Record<string, unknown>) {
    const key = String(input.key ?? '').trim();
    if (!key) throw new ConflictException('Chave da flag e obrigatoria.');
    const before = await this.prisma.portalFeatureFlag.findUnique({ where: { key } });
    const flag = await this.prisma.portalFeatureFlag.upsert({
      where: { key },
      create: {
        key,
        name: String(input.name ?? key),
        description: stringOrNull(input.description),
        enabled: Boolean(input.enabled),
        rolloutPercentage: numberOrNull(input.rolloutPercentage),
        environment: stringOrNull(input.environment),
        experimental: Boolean(input.experimental),
        updatedBy: user.email,
      },
      update: {
        name: String(input.name ?? key),
        description: stringOrNull(input.description),
        enabled: Boolean(input.enabled),
        rolloutPercentage: numberOrNull(input.rolloutPercentage),
        environment: stringOrNull(input.environment),
        experimental: Boolean(input.experimental),
        updatedBy: user.email,
      },
    });
    await this.audit.record({
      user,
      action: before ? 'FEATURE_FLAG_UPDATE' : 'FEATURE_FLAG_CREATE',
      permissionKey: 'platform.feature_flags.manage',
      targetType: 'PortalFeatureFlag',
      targetId: flag.id,
      targetLabel: flag.key,
      beforeValue: before,
      afterValue: flag,
    });
    return flag;
  }

  async environments() {
    const [environments, releases] = await Promise.all([
      this.prisma.platformEnvironment.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.platformRelease.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    return { environments, releases };
  }

  async integrations() {
    return this.prisma.platformIntegrationConfig.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }] });
  }

  async jobs() {
    return this.prisma.platformJob.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async maintenance() {
    return this.prisma.portalMaintenanceWindow.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });
  }

  async createMaintenance(user: PlatformAdminIdentity, input: Record<string, unknown>) {
    const window = await this.prisma.portalMaintenanceWindow.create({
      data: {
        scope: String(input.scope ?? 'global'),
        targetCode: stringOrNull(input.targetCode),
        message: stringOrNull(input.message),
        startsAt: toDate(input.startsAt),
        endsAt: toDate(input.endsAt),
        allowSuperAdmin: input.allowSuperAdmin === undefined ? true : Boolean(input.allowSuperAdmin),
        createdBy: user.email,
      },
    });
    await this.audit.record({
      user,
      action: 'MAINTENANCE_CREATE',
      permissionKey: 'platform.maintenance.manage',
      targetType: 'PortalMaintenanceWindow',
      targetId: window.id,
      targetLabel: window.scope,
      afterValue: window,
      justification: stringOrNull(input.message),
    });
    return window;
  }

  private async decorateCompanies(companies: Array<Prisma.CompanyGetPayload<object>>) {
    const ids = companies.map((item) => item.id);
    if (ids.length === 0) return [];
    const [profiles, users, modules, lastAccess] = await Promise.all([
      this.prisma.platformCompanyProfile.findMany({ where: { companyId: { in: ids } } }),
      this.prisma.user.groupBy({ by: ['companyId'], where: { companyId: { in: ids }, deletedAt: null }, _count: { _all: true } }),
      this.prisma.platformCompanyModule.groupBy({
        by: ['companyId'],
        where: { companyId: { in: ids }, status: { in: ACTIVE_MODULE_STATUSES } },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({ by: ['companyId'], where: { companyId: { in: ids }, deletedAt: null }, _max: { lastLoginAt: true } }),
    ]);
    const profileMap = new Map(profiles.map((item) => [item.companyId, item]));
    const userMap = new Map(users.map((item) => [item.companyId, item._count._all]));
    const moduleMap = new Map(modules.map((item) => [item.companyId, item._count._all]));
    const accessMap = new Map(lastAccess.map((item) => [item.companyId, item._max.lastLoginAt ?? null]));
    return companies.map((company) => ({
      ...this.serializeCompany(company),
      profile: profileMap.get(company.id) ?? null,
      usage: {
        users: userMap.get(company.id) ?? 0,
        modules: moduleMap.get(company.id) ?? 0,
        lastAccessAt: accessMap.get(company.id) ?? null,
      },
    }));
  }

  private async companyModules(companyId: string) {
    const [modules, assignments] = await Promise.all([
      this.listModules(),
      this.prisma.platformCompanyModule.findMany({ where: { companyId } }),
    ]);
    const assignmentMap = new Map(assignments.map((item) => [item.moduleCode, item]));
    return modules.map((module) => ({ module, assignment: assignmentMap.get(module.code) ?? null }));
  }

  private async upsertCompanyProfile(companyId: string, input: CompanyInput, user: PlatformAdminIdentity) {
    const profile = await this.prisma.platformCompanyProfile.upsert({
      where: { companyId },
      create: {
        companyId,
        internalCode: input.internalCode ?? (await this.nextCompanyCode()),
        lifecycleStatus: input.lifecycleStatus ?? 'ACTIVE',
        planCode: input.planCode ?? 'ESSENCIAL',
        commercialOwner: input.commercialOwner ?? null,
        implementationOwner: input.implementationOwner ?? null,
        primaryContactName: input.primaryContactName ?? null,
        primaryContactEmail: input.primaryContactEmail ?? null,
        contractEndsAt: toDate(input.contractEndsAt),
        storageLimitMb: input.storageLimitMb ?? null,
        maxBranches: input.maxBranches ?? null,
        maxDocuments: input.maxDocuments ?? null,
        maxForms: input.maxForms ?? null,
        maxIndicators: input.maxIndicators ?? null,
        maxIntegrations: input.maxIntegrations ?? null,
        notes: input.notes ?? null,
      },
      update: {
        ...(input.internalCode !== undefined ? { internalCode: input.internalCode } : {}),
        ...(input.lifecycleStatus !== undefined ? { lifecycleStatus: input.lifecycleStatus } : {}),
        ...(input.planCode !== undefined ? { planCode: input.planCode } : {}),
        ...(input.commercialOwner !== undefined ? { commercialOwner: input.commercialOwner } : {}),
        ...(input.implementationOwner !== undefined ? { implementationOwner: input.implementationOwner } : {}),
        ...(input.primaryContactName !== undefined ? { primaryContactName: input.primaryContactName } : {}),
        ...(input.primaryContactEmail !== undefined ? { primaryContactEmail: input.primaryContactEmail } : {}),
        ...(input.contractEndsAt !== undefined ? { contractEndsAt: toDate(input.contractEndsAt) } : {}),
        ...(input.storageLimitMb !== undefined ? { storageLimitMb: input.storageLimitMb } : {}),
        ...(input.maxBranches !== undefined ? { maxBranches: input.maxBranches } : {}),
        ...(input.maxDocuments !== undefined ? { maxDocuments: input.maxDocuments } : {}),
        ...(input.maxForms !== undefined ? { maxForms: input.maxForms } : {}),
        ...(input.maxIndicators !== undefined ? { maxIndicators: input.maxIndicators } : {}),
        ...(input.maxIntegrations !== undefined ? { maxIntegrations: input.maxIntegrations } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    if (input.planCode) {
      await this.prisma.platformCompanyPlanOverride.create({
        data: {
          companyId,
          planCode: input.planCode,
          field: 'planCode',
          newValue: input.planCode,
          reason: input.notes ?? null,
          changedBy: user.sub,
          changedByEmail: user.email,
        },
      });
    }
    return profile;
  }

  private async nextCompanyCode() {
    const count = await this.prisma.platformCompanyProfile.count();
    return `G360-${String(count + 1).padStart(4, '0')}`;
  }

  private serializeCompany(company: Prisma.CompanyGetPayload<object>) {
    return {
      id: company.id,
      name: company.name,
      tradeName: company.tradeName,
      cnpj: company.cnpj,
      logoUrl: company.logoUrl,
      email: company.email,
      phone: company.phone,
      city: company.city,
      state: company.state,
      segment: company.segment,
      maxUsers: company.maxUsers,
      notes: company.notes,
      active: company.active,
      status: company.status,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }

  private async companiesByPlan() {
    const rows = await this.prisma.platformCompanyProfile.groupBy({ by: ['planCode'], _count: { _all: true }, orderBy: { planCode: 'asc' } });
    return rows.map((row) => ({ planCode: row.planCode ?? 'SEM_PLANO', companies: row._count._all }));
  }

  private async adminAlerts(now: Date) {
    const nextThirty = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [contracts, blockedModules, failedBackups, disconnectedIntegrations, pendingMigrations, suspiciousLogins, noAdmin] = await Promise.all([
      this.prisma.platformCompanyProfile.count({ where: { contractEndsAt: { gte: now, lte: nextThirty } } }),
      this.prisma.platformCompanyModule.count({ where: { status: { in: BLOCKED_MODULE_STATUSES } } }),
      this.prisma.platformBackup.count({ where: { status: { in: ['FAILED', 'ERROR'] } } }),
      this.prisma.platformIntegrationConfig.count({ where: { status: { in: ['ERROR', 'DISCONNECTED', 'FAILING'] } } }),
      this.prisma.platformMigrationRecord.count({ where: { status: 'PENDING' } }),
      this.prisma.platformAccessLog.count({ where: { result: 'DENIED', createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }),
      this.companiesWithoutAdmin(),
    ]);
    return [
      { code: 'contracts.expiring', label: 'Contratos proximos do vencimento', count: contracts },
      { code: 'modules.blocked', label: 'Empresas com modulos bloqueados', count: blockedModules },
      { code: 'backups.failed', label: 'Backups com falha', count: failedBackups },
      { code: 'integrations.disconnected', label: 'Integracoes desconectadas', count: disconnectedIntegrations },
      { code: 'migrations.pending', label: 'Migracoes pendentes', count: pendingMigrations },
      { code: 'security.denied', label: 'Tentativas suspeitas de acesso', count: suspiciousLogins },
      { code: 'companies.no_admin', label: 'Empresas sem administrador principal', count: noAdmin },
    ];
  }

  private async companiesWithoutAdmin() {
    const companies = await this.prisma.company.findMany({ where: { deletedAt: null }, select: { id: true } });
    if (companies.length === 0) return 0;
    const withAdmin = await this.prisma.user.groupBy({
      by: ['companyId'],
      where: { role: { in: ['SUPER_ADMIN', 'COMPANY_ADMIN'] }, deletedAt: null, active: true },
      _count: { _all: true },
    });
    const ids = new Set(withAdmin.map((item) => item.companyId));
    return companies.filter((company) => !ids.has(company.id)).length;
  }

  private async databaseHealth() {
    const started = Date.now();
    try {
      const tableRows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `;
      const migrationCount = await this.prisma.platformMigrationRecord.count().catch(() => 0);
      return {
        status: 'ONLINE',
        provider: 'PostgreSQL',
        environment: process.env.NODE_ENV ?? 'development',
        tables: Number(tableRows[0]?.count ?? 0),
        migrationsTracked: migrationCount,
        responseMs: Date.now() - started,
        credentials: 'masked',
      };
    } catch (err) {
      return {
        status: 'ERROR',
        provider: 'PostgreSQL',
        environment: process.env.NODE_ENV ?? 'development',
        tables: 0,
        migrationsTracked: 0,
        responseMs: Date.now() - started,
        message: (err as Error).message,
        credentials: 'masked',
      };
    }
  }

  private async syncCatalogData() {
    await this.ensureModuleCatalog();
    await this.ensurePlans();
    await this.ensureEnvironments();
  }

  private async ensureModuleCatalog() {
    const count = await this.prisma.platformModuleCatalog.count();
    if (count > 0) return;
    for (const module of PLATFORM_MODULES) {
      await this.prisma.platformModuleCatalog.upsert({
        where: { code: module.code },
        create: {
          code: module.code,
          name: module.name,
          description: module.description,
          category: module.category,
          icon: module.icon,
          route: module.route,
          version: module.version,
          dependencies: JSON.stringify(module.dependencies),
          technicalOwner: module.technicalOwner,
          experimental: module.experimental,
          availability: JSON.stringify(['ESSENCIAL', 'PROFISSIONAL', 'CORPORATIVO', 'ENTERPRISE']),
          documentation: module.route ? `docs:${module.route}` : null,
        },
        update: {},
      });
    }
  }

  private async ensurePlans() {
    const count = await this.prisma.platformPlan.count();
    if (count > 0) return;
    for (const plan of PLATFORM_PLANS) {
      const created = await this.prisma.platformPlan.upsert({
        where: { code: plan.code },
        create: {
          code: plan.code,
          name: plan.name,
          setupPriceCents: plan.setupPriceCents,
          monthlyPriceCents: plan.monthlyPriceCents,
          defaultUsers: plan.defaultUsers,
          defaultBranches: plan.defaultBranches,
          storageLimitMb: plan.storageLimitMb,
          supportLevel: plan.supportLevel,
          sla: plan.sla,
          trialDays: plan.trialDays,
        },
        update: {},
      });
      if (plan.modules.length > 0) {
        await this.prisma.platformPlanModule.createMany({
          data: plan.modules.map((moduleCode) => ({ planId: created.id, moduleCode, included: true })),
          skipDuplicates: true,
        });
      }
    }
  }

  private async ensureEnvironments() {
    const envs = [
      { code: 'development', name: 'Desenvolvimento' },
      { code: 'staging', name: 'Homologacao' },
      { code: 'production', name: 'Producao' },
    ];
    for (const env of envs) {
      await this.prisma.platformEnvironment.upsert({
        where: { code: env.code },
        create: { ...env, currentVersion: process.env.npm_package_version ?? '0.1.0' },
        update: {},
      });
    }
  }
}

function toDate(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stringOrNull(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function numberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0;
}
