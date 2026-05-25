import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AdminRecordStatus, UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_PROFILES, PERMISSION_CATALOG } from '../users/permission-catalog';
import { AuthPayload } from '../auth/auth.types';

const PARAMETER_CATEGORIES: Array<{ code: string; name: string; module: string; description: string; items?: Array<{ code: string; name: string; description?: string }> }> = [
  { code: 'UNIDADES', name: 'Unidades', module: 'Estrutura', description: 'Unidades operacionais e administrativas.' },
  { code: 'SETORES', name: 'Setores', module: 'Estrutura', description: 'Setores organizacionais usados em filtros e indicadores.' },
  { code: 'AREAS', name: 'Areas', module: 'Estrutura', description: 'Areas corporativas e de gestão.' },
  { code: 'SUBAREAS', name: 'Subareas', module: 'Estrutura', description: 'Subdivisoes de areas.' },
  { code: 'CARGOS', name: 'Cargos', module: 'Usuários', description: 'Cargos e funções dos usuários.' },
  { code: 'DEPARTAMENTOS', name: 'Departamentos', module: 'Estrutura', description: 'Departamentos da empresa.' },
  { code: 'CENTROS_CUSTO', name: 'Centros de custo', module: 'Financeiro', description: 'Centros de custo para planos e indicadores.' },
  { code: 'PROCESSOS', name: 'Processos', module: 'Processos', description: 'Processos controlados pelo sistema.' },
  { code: 'MACROPROCESSOS', name: 'Macroprocessos', module: 'Processos', description: 'Agrupadores de processos.' },
  { code: 'DIRETRIZES', name: 'Diretrizes', module: 'Estratégia', description: 'Diretrizes estratégicas.' },
  { code: 'PILARES_ESTRATEGICOS', name: 'Pilares estratégicos', module: 'Estratégia', description: 'Pilares e temas estratégicos.' },
  {
    code: 'TIPOS_INDICADOR',
    name: 'Tipos de indicadores',
    module: 'Indicadores',
    description: 'Classificacao dos indicadores.',
    items: [
      { code: 'STRATEGIC', name: 'Estratégico' },
      { code: 'TACTICAL', name: 'Tático' },
      { code: 'OPERATIONAL', name: 'Operacional' },
      { code: 'PROCESS', name: 'Processo' },
      { code: 'CUSTOM', name: 'Personalizado' },
    ],
  },
  { code: 'CATEGORIAS_INDICADOR', name: 'Categorias de indicadores', module: 'Indicadores', description: 'Categorias livres para KPIs.' },
  {
    code: 'PERIODICIDADES',
    name: 'Periodicidades de medicao',
    module: 'Indicadores',
    description: 'Frequencias de apuracao.',
    items: [
      { code: 'DAILY', name: 'Diária' },
      { code: 'WEEKLY', name: 'Semanal' },
      { code: 'BIWEEKLY', name: 'Quinzenal' },
      { code: 'MONTHLY', name: 'Mensal' },
      { code: 'QUARTERLY', name: 'Trimestral' },
      { code: 'SEMIANNUAL', name: 'Semestral' },
      { code: 'ANNUAL', name: 'Anual' },
    ],
  },
  {
    code: 'UNIDADES_MEDIDA',
    name: 'Unidades de medida',
    module: 'Indicadores',
    description: 'Unidades usadas nos indicadores.',
    items: [
      { code: 'PERCENT', name: 'Percentual' },
      { code: 'CURRENCY', name: 'Moeda' },
      { code: 'QUANTITY', name: 'Quantidade' },
      { code: 'HOURS', name: 'Horas' },
      { code: 'DAYS', name: 'Dias' },
      { code: 'CUSTOM', name: 'Personalizada' },
    ],
  },
  { code: 'TIPOS_META', name: 'Tipos de metas', module: 'Indicadores', description: 'Modelos de alvo e faixa.' },
  { code: 'STATUS_INDICADOR', name: 'Status de indicadores', module: 'Indicadores', description: 'Estados operacionais de indicadores.' },
  { code: 'STATUS_PLANO_ACAO', name: 'Status de planos de ação', module: 'Planos de ação', description: 'Estados de planos de ação.' },
  { code: 'CRITICIDADES', name: 'Criticidades', module: 'Governanca', description: 'Níveis de criticidade.' },
  { code: 'PRIORIDADES', name: 'Prioridades', module: 'Governanca', description: 'Prioridades corporativas.' },
  { code: 'TIPOS_REUNIAO', name: 'Tipos de reunião', module: 'Reuniões', description: 'Classificacoes de reuniões.' },
  { code: 'TIPOS_ANALISE_CAUSA', name: 'Tipos de análise de causa', module: 'Tratativas', description: 'Tipos de análise.' },
  {
    code: 'METODOS_ANALISE_CAUSA',
    name: 'Metodos de análise de causa',
    module: 'Tratativas',
    description: 'Metodos como 5 Porques, Ishikawa, Pareto, PDCA e FCA.',
    items: [
      { code: 'FIVE_WHYS', name: '5 Porques' },
      { code: 'ISHIKAWA', name: 'Ishikawa' },
      { code: 'PARETO', name: 'Pareto' },
      { code: 'PDCA', name: 'PDCA' },
      { code: 'FCA', name: 'FCA' },
      { code: 'MASP', name: 'MASP' },
      { code: 'DMAIC', name: 'DMAIC' },
    ],
  },
  { code: 'MODELOS_PLANO_ACAO', name: 'Modelos de plano de ação', module: 'Planos de ação', description: 'Templates para abertura de ações.' },
  { code: 'TIPOS_EVIDENCIA', name: 'Tipos de evidencia', module: 'Evidencias', description: 'Tipos de anexo e comprovacao.' },
  { code: 'PARAMETROS_NOTIFICACAO', name: 'Parametros de notificação', module: 'Sistema', description: 'Regras e canais de notificação.' },
  { code: 'PARAMETROS_APROVACAO', name: 'Parametros de aprovação', module: 'Sistema', description: 'Regras de aprovação.' },
  { code: 'PARAMETROS_GERAIS', name: 'Parametros gerais do sistema', module: 'Sistema', description: 'Configurações gerais.' },
];

@Injectable()
export class AdminService {
  private permissionsReady = false;
  private readonly catalogReadyCompanies = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(me: AuthPayload) {
    await this.ensureCatalog(me.companyId, me.sub);
    const whereCompany = me.role === UserRoleEnum.SUPER_ADMIN ? { deletedAt: null } : { id: me.companyId, deletedAt: null };
    const [companies, branches] = await Promise.all([
      this.prisma.company.findMany({ where: whereCompany, include: { branches: { where: { deletedAt: null } } }, orderBy: { name: 'asc' } }),
      this.prisma.branch.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: { name: 'asc' } }),
    ]);
    const [orgNodes, users] = await Promise.all([
      this.prisma.orgNode.findMany({
        where: { companyId: me.companyId, deletedAt: null },
        include: { responsibleUser: { select: { id: true, name: true } }, _count: { select: { children: true, indicatorsOwned: true } } },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null },
        select: { id: true, name: true, email: true, role: true, status: true, active: true, lastLoginAt: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const [categories, profiles] = await Promise.all([
      this.prisma.parameterCategory.findMany({
        where: { OR: [{ companyId: null }, { companyId: me.companyId }], deletedAt: null },
        include: { items: { where: { deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.accessProfile.findMany({
        where: { OR: [{ companyId: null }, { companyId: me.companyId }], deletedAt: null },
        include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
        orderBy: [{ system: 'desc' }, { name: 'asc' }],
      }),
    ]);
    const [permissions, settings] = await Promise.all([
      this.listPermissions({ ensure: false }),
      this.prisma.appSetting.findMany({ where: { OR: [{ companyId: null }, { companyId: me.companyId }] }, orderBy: [{ group: 'asc' }, { key: 'asc' }] }),
    ]);
    const auditCount = await this.prisma.auditLog.count({ where: { companyId: me.companyId } });
    return { companies, branches, orgNodes, users, categories, profiles, permissions, settings, auditCount };
  }

  async listPermissions(options: { ensure?: boolean } = {}) {
    if (options.ensure !== false) await this.ensurePermissions();
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }, { key: 'asc' }] });
  }

  async ensureCatalog(companyId: string, userId?: string) {
    if (this.catalogReadyCompanies.has(companyId)) return;
    await this.ensurePermissions();
    const categoryCodes = PARAMETER_CATEGORIES.map((category) => category.code);
    const profileCodes = DEFAULT_PROFILES.map((profile) => profile.code);
    const [categoryCount, profileCount] = await Promise.all([
      this.prisma.parameterCategory.count({ where: { companyId, code: { in: categoryCodes }, deletedAt: null } }),
      this.prisma.accessProfile.count({ where: { companyId, code: { in: profileCodes }, deletedAt: null } }),
    ]);
    if (categoryCount >= PARAMETER_CATEGORIES.length && profileCount >= DEFAULT_PROFILES.length) {
      this.catalogReadyCompanies.add(companyId);
      return;
    }

    await this.prisma.parameterCategory.createMany({
      data: PARAMETER_CATEGORIES.map((category, sortOrder) => ({
        companyId,
        code: category.code,
        name: category.name,
        description: category.description,
        module: category.module,
        system: true,
        sortOrder,
        createdById: userId ?? null,
      })),
      skipDuplicates: true,
    });

    const savedCategories = await this.prisma.parameterCategory.findMany({
      where: { companyId, code: { in: PARAMETER_CATEGORIES.map((category) => category.code) } },
      select: { id: true, code: true },
    });
    const categoryByCode = new Map(savedCategories.map((category) => [category.code, category.id]));
    const parameterItems = PARAMETER_CATEGORIES.flatMap((category) => {
      const categoryId = categoryByCode.get(category.code);
      if (!categoryId) return [];
      return (category.items ?? []).map((item, sortOrder) => ({
        companyId,
        categoryId,
        code: item.code,
        name: item.name,
        description: item.description ?? null,
        sortOrder,
        createdById: userId ?? null,
      }));
    });
    if (parameterItems.length > 0) {
      await this.prisma.parameterItem.createMany({ data: parameterItems, skipDuplicates: true });
    }

    await this.prisma.accessProfile.createMany({
      data: DEFAULT_PROFILES.map((profile) => ({
        companyId,
        code: profile.code,
        name: profile.name,
        description: profile.description,
        role: profile.role as UserRoleEnum,
        system: true,
        createdById: userId ?? null,
      })),
      skipDuplicates: true,
    });

    const permissions = await this.prisma.permission.findMany({ select: { id: true, key: true } });
    const permissionByKey = new Map(permissions.map((p) => [p.key, p.id]));
    const savedProfiles = await this.prisma.accessProfile.findMany({
      where: { companyId, code: { in: DEFAULT_PROFILES.map((profile) => profile.code) } },
      select: { id: true, code: true },
    });
    const profileByCode = new Map(savedProfiles.map((profile) => [profile.code, profile.id]));
    const profilePermissions = DEFAULT_PROFILES.flatMap((profile) => {
      const profileId = profileByCode.get(profile.code);
      if (!profileId) return [];
      return profile.permissions
        .map((key) => permissionByKey.get(key))
        .filter(Boolean)
        .map((permissionId) => ({ profileId, permissionId: permissionId as string }));
    });
    if (profilePermissions.length > 0) {
      await this.prisma.profilePermission.createMany({ data: profilePermissions, skipDuplicates: true });
    }
    this.catalogReadyCompanies.add(companyId);
  }

  async createCompany(me: AuthPayload, body: any) {
    this.requireSuperAdmin(me);
    await this.assertCompanyUnique(body.name, body.cnpj);
    const created = await this.prisma.company.create({
      data: { name: body.name, tradeName: body.tradeName ?? null, cnpj: body.cnpj ?? null, logoUrl: body.logoUrl ?? null, active: body.active ?? true },
    });
    await this.audit(me, 'CREATE', 'Empresas', 'Company', created.id, null, created);
    return created;
  }

  async updateCompany(me: AuthPayload, id: string, body: any) {
    this.requireCompanyAccess(me, id);
    const before = await this.getCompanyOrThrow(id);
    if ((body.name && body.name !== before.name) || (body.cnpj && body.cnpj !== before.cnpj)) {
      await this.assertCompanyUnique(body.name ?? before.name, body.cnpj ?? before.cnpj, id);
    }
    const updated = await this.prisma.company.update({
      where: { id },
      data: { name: body.name, tradeName: body.tradeName, cnpj: body.cnpj, logoUrl: body.logoUrl, active: body.active },
    });
    await this.audit(me, 'UPDATE', 'Empresas', 'Company', id, before, updated);
    return updated;
  }

  async removeCompany(me: AuthPayload, id: string) {
    this.requireSuperAdmin(me);
    const before = await this.getCompanyOrThrow(id);
    const usage = await this.prisma.$transaction([
      this.prisma.user.count({ where: { companyId: id, deletedAt: null } }),
      this.prisma.indicator.count({ where: { companyId: id, deletedAt: null } }),
      this.prisma.actionPlan.count({ where: { companyId: id, deletedAt: null } }),
      this.prisma.branch.count({ where: { companyId: id, deletedAt: null } }),
    ]);
    if (usage.some((count) => count > 0)) throw new ConflictException('Empresa em uso nao pode ser excluida. Inative o cadastro.');
    const updated = await this.prisma.company.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await this.audit(me, 'DELETE', 'Empresas', 'Company', id, before, updated);
    return updated;
  }

  async createBranch(me: AuthPayload, body: any) {
    const companyId = body.companyId ?? me.companyId;
    this.requireCompanyAccess(me, companyId);
    await this.assertBranchUnique(companyId, body.name, body.code);
    const created = await this.prisma.branch.create({
      data: { companyId, name: body.name, code: body.code ?? null, city: body.city ?? null, state: body.state ?? null, active: body.active ?? true },
    });
    await this.audit(me, 'CREATE', 'Filiais', 'Branch', created.id, null, created);
    return created;
  }

  async updateBranch(me: AuthPayload, id: string, body: any) {
    const before = await this.getBranchOrThrow(id);
    this.requireCompanyAccess(me, before.companyId);
    if ((body.name && body.name !== before.name) || (body.code && body.code !== before.code)) {
      await this.assertBranchUnique(before.companyId, body.name ?? before.name, body.code ?? before.code, id);
    }
    const updated = await this.prisma.branch.update({
      where: { id },
      data: { name: body.name, code: body.code, city: body.city, state: body.state, active: body.active },
    });
    await this.audit(me, 'UPDATE', 'Filiais', 'Branch', id, before, updated);
    return updated;
  }

  async removeBranch(me: AuthPayload, id: string) {
    const before = await this.getBranchOrThrow(id);
    this.requireCompanyAccess(me, before.companyId);
    const [orgNodes, users] = await Promise.all([
      this.prisma.orgNode.count({ where: { branchId: id, deletedAt: null } }),
      this.prisma.user.count({ where: { branchId: id, deletedAt: null } }),
    ]);
    if (orgNodes + users > 0) throw new ConflictException('Filial em uso nao pode ser excluida. Inative o cadastro.');
    const updated = await this.prisma.branch.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await this.audit(me, 'DELETE', 'Filiais', 'Branch', id, before, updated);
    return updated;
  }

  async createCategory(me: AuthPayload, body: any) {
    if (!body.code || !body.name) throw new BadRequestException('Código e nome sao obrigatorios');
    const companyId = body.global ? null : me.companyId;
    const created = await this.prisma.parameterCategory.create({
      data: {
        companyId,
        code: normalizeCode(body.code),
        name: body.name,
        description: body.description ?? null,
        module: body.module ?? null,
        status: body.status ?? AdminRecordStatus.ACTIVE,
        sortOrder: body.sortOrder ?? 0,
        createdById: me.sub,
      },
    });
    await this.audit(me, 'CREATE', 'Parametros', 'ParameterCategory', created.id, null, created);
    return created;
  }

  async updateCategory(me: AuthPayload, id: string, body: any) {
    const before = await this.getCategoryOrThrow(id, me.companyId);
    const updated = await this.prisma.parameterCategory.update({
      where: { id },
      data: {
        code: body.code ? normalizeCode(body.code) : undefined,
        name: body.name,
        description: body.description,
        module: body.module,
        status: body.status,
        sortOrder: body.sortOrder,
        updatedById: me.sub,
      },
    });
    await this.audit(me, 'UPDATE', 'Parametros', 'ParameterCategory', id, before, updated);
    return updated;
  }

  async removeCategory(me: AuthPayload, id: string) {
    const before = await this.getCategoryOrThrow(id, me.companyId);
    const items = await this.prisma.parameterItem.count({ where: { categoryId: id, deletedAt: null } });
    if (items > 0) throw new ConflictException('Categoria possui itens vinculados. Inative ou exclua os itens antes.');
    const updated = await this.prisma.parameterCategory.update({ where: { id }, data: { deletedAt: new Date(), status: AdminRecordStatus.ARCHIVED, updatedById: me.sub } });
    await this.audit(me, 'DELETE', 'Parametros', 'ParameterCategory', id, before, updated);
    return updated;
  }

  async createItem(me: AuthPayload, body: any) {
    if (!body.categoryId || !body.code || !body.name) throw new BadRequestException('Categoria, código e nome sao obrigatorios');
    const category = await this.getCategoryOrThrow(body.categoryId, me.companyId);
    if (body.parentId) await this.ensureParameterParent(body.parentId, category.id);
    const created = await this.prisma.parameterItem.create({
      data: {
        companyId: category.companyId ?? me.companyId,
        categoryId: category.id,
        parentId: body.parentId ?? null,
        code: normalizeCode(body.code),
        name: body.name,
        description: body.description ?? null,
        status: body.status ?? AdminRecordStatus.ACTIVE,
        sortOrder: body.sortOrder ?? 0,
        metadata: body.metadata ?? undefined,
        createdById: me.sub,
      },
    });
    await this.audit(me, 'CREATE', 'Parametros', 'ParameterItem', created.id, null, created);
    return created;
  }

  async updateItem(me: AuthPayload, id: string, body: any) {
    const before = await this.getItemOrThrow(id, me.companyId);
    const category = body.categoryId ? await this.getCategoryOrThrow(body.categoryId, me.companyId) : null;
    if (body.parentId) await this.ensureParameterParent(body.parentId, category?.id ?? before.categoryId, id);
    const updated = await this.prisma.parameterItem.update({
      where: { id },
      data: {
        categoryId: body.categoryId,
        companyId: category ? category.companyId ?? me.companyId : undefined,
        parentId: body.parentId,
        code: body.code ? normalizeCode(body.code) : undefined,
        name: body.name,
        description: body.description,
        status: body.status,
        sortOrder: body.sortOrder,
        metadata: body.metadata ?? undefined,
        updatedById: me.sub,
      },
    });
    await this.audit(me, 'UPDATE', 'Parametros', 'ParameterItem', id, before, updated);
    return updated;
  }

  async removeItem(me: AuthPayload, id: string) {
    const before = await this.getItemOrThrow(id, me.companyId);
    const children = await this.prisma.parameterItem.count({ where: { parentId: id, deletedAt: null } });
    if (children > 0) throw new ConflictException('Parametro possui itens filhos. Remova os vínculos antes.');
    const updated = await this.prisma.parameterItem.update({ where: { id }, data: { deletedAt: new Date(), status: AdminRecordStatus.ARCHIVED, updatedById: me.sub } });
    await this.audit(me, 'DELETE', 'Parametros', 'ParameterItem', id, before, updated);
    return updated;
  }

  async createProfile(me: AuthPayload, body: any) {
    if (!body.code || !body.name) throw new BadRequestException('Código e nome sao obrigatorios');
    const created = await this.prisma.accessProfile.create({
      data: {
        companyId: me.companyId,
        code: normalizeCode(body.code),
        name: body.name,
        description: body.description ?? null,
        role: body.role ?? null,
        status: body.status ?? AdminRecordStatus.ACTIVE,
        createdById: me.sub,
      },
    });
    await this.setProfilePermissions(me, created.id, body.permissionKeys ?? []);
    await this.audit(me, 'CREATE', 'Seguranca', 'AccessProfile', created.id, null, created);
    return this.getProfile(created.id, me.companyId);
  }

  async updateProfile(me: AuthPayload, id: string, body: any) {
    const before = await this.getProfile(id, me.companyId);
    const updated = await this.prisma.accessProfile.update({
      where: { id },
      data: {
        code: body.code ? normalizeCode(body.code) : undefined,
        name: body.name,
        description: body.description,
        role: body.role,
        status: body.status,
        updatedById: me.sub,
      },
    });
    if (body.permissionKeys) await this.setProfilePermissions(me, id, body.permissionKeys);
    await this.audit(me, 'UPDATE', 'Seguranca', 'AccessProfile', id, before, updated);
    return this.getProfile(id, me.companyId);
  }

  async setProfilePermissions(me: AuthPayload, id: string, permissionKeys: string[]) {
    await this.getProfile(id, me.companyId);
    await this.ensurePermissions();
    const permissions = await this.prisma.permission.findMany({ where: { key: { in: permissionKeys } }, select: { id: true } });
    await this.prisma.$transaction([
      this.prisma.profilePermission.deleteMany({ where: { profileId: id } }),
      ...permissions.map((permission) => this.prisma.profilePermission.create({ data: { profileId: id, permissionId: permission.id } })),
    ]);
    await this.audit(me, 'PERMISSION_CHANGE', 'Seguranca', 'AccessProfile', id, null, { permissionKeys });
    return this.getProfile(id, me.companyId);
  }

  async removeProfile(me: AuthPayload, id: string) {
    const before = await this.getProfile(id, me.companyId);
    const users = await this.prisma.user.count({ where: { accessProfileId: id, deletedAt: null } });
    if (users > 0) throw new ConflictException('Perfil em uso por usuários. Remova os vínculos antes.');
    const updated = await this.prisma.accessProfile.update({ where: { id }, data: { deletedAt: new Date(), status: AdminRecordStatus.ARCHIVED, updatedById: me.sub } });
    await this.audit(me, 'DELETE', 'Seguranca', 'AccessProfile', id, before, updated);
    return updated;
  }

  async upsertSetting(me: AuthPayload, body: any) {
    if (!body.key) throw new BadRequestException('Chave obrigatoria');
    const companyId = me.companyId;
    const before = await this.prisma.appSetting.findUnique({ where: { companyId_key: { companyId, key: body.key } } }).catch(() => null);
    const saved = await this.prisma.appSetting.upsert({
      where: { companyId_key: { companyId, key: body.key } },
      create: {
        companyId,
        key: body.key,
        value: String(body.value ?? ''),
        description: body.description ?? null,
        valueType: body.valueType ?? 'text',
        group: body.group ?? 'Sistema',
        active: body.active ?? true,
      },
      update: {
        value: String(body.value ?? ''),
        description: body.description,
        valueType: body.valueType,
        group: body.group,
        active: body.active,
      },
    });
    await this.audit(me, before ? 'UPDATE' : 'CREATE', 'Sistema', 'AppSetting', saved.id, before, saved);
    return saved;
  }

  private async ensurePermissions() {
    if (this.permissionsReady) return;
    const keys = PERMISSION_CATALOG.map(([key]) => key);
    const existing = await this.prisma.permission.findMany({ where: { key: { in: keys } }, select: { key: true } });
    const existingKeys = new Set(existing.map((permission) => permission.key));
    const missing = PERMISSION_CATALOG.filter(([key]) => !existingKeys.has(key));
    if (missing.length > 0) {
      await this.prisma.permission.createMany({
        data: missing.map(([key, description, module, action]) => ({ key, description, module, action })),
        skipDuplicates: true,
      });
    }
    this.permissionsReady = true;
  }

  private async ensureParameterParent(parentId: string, categoryId: string, currentId?: string) {
    if (parentId === currentId) throw new ConflictException('Um parametro nao pode ser pai dele mesmo');
    const parent = await this.prisma.parameterItem.findFirst({ where: { id: parentId, categoryId, deletedAt: null }, select: { id: true } });
    if (!parent) throw new NotFoundException('Parametro pai nao encontrado na categoria informada');
  }

  private async getCompanyOrThrow(id: string) {
    const company = await this.prisma.company.findFirst({ where: { id, deletedAt: null } });
    if (!company) throw new NotFoundException('Empresa nao encontrada');
    return company;
  }

  private async getBranchOrThrow(id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, deletedAt: null } });
    if (!branch) throw new NotFoundException('Filial nao encontrada');
    return branch;
  }

  private async getCategoryOrThrow(id: string, companyId: string) {
    const category = await this.prisma.parameterCategory.findFirst({ where: { id, deletedAt: null, OR: [{ companyId }, { companyId: null }] } });
    if (!category) throw new NotFoundException('Categoria nao encontrada');
    return category;
  }

  private async getItemOrThrow(id: string, companyId: string) {
    const item = await this.prisma.parameterItem.findFirst({ where: { id, deletedAt: null, OR: [{ companyId }, { companyId: null }] } });
    if (!item) throw new NotFoundException('Parametro nao encontrado');
    return item;
  }

  private async getProfile(id: string, companyId: string) {
    const profile = await this.prisma.accessProfile.findFirst({
      where: { id, deletedAt: null, OR: [{ companyId }, { companyId: null }] },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });
    if (!profile) throw new NotFoundException('Perfil nao encontrado');
    return profile;
  }

  private requireSuperAdmin(me: AuthPayload) {
    if (me.role !== UserRoleEnum.SUPER_ADMIN) throw new ConflictException('Somente Super Admin pode executar esta ação.');
  }

  private requireCompanyAccess(me: AuthPayload, companyId: string) {
    if (me.role !== UserRoleEnum.SUPER_ADMIN && me.companyId !== companyId) {
      throw new ConflictException('Empresa fora do escopo do usuário.');
    }
  }

  private async assertCompanyUnique(name: string, cnpj?: string | null, ignoreId?: string) {
    const found = await this.prisma.company.findFirst({
      where: { deletedAt: null, id: ignoreId ? { not: ignoreId } : undefined, OR: [{ name }, ...(cnpj ? [{ cnpj }] : [])] },
      select: { id: true },
    });
    if (found) throw new ConflictException('Empresa com nome ou CNPJ ja cadastrada');
  }

  private async assertBranchUnique(companyId: string, name: string, code?: string | null, ignoreId?: string) {
    const found = await this.prisma.branch.findFirst({
      where: {
        companyId,
        deletedAt: null,
        id: ignoreId ? { not: ignoreId } : undefined,
        OR: [{ name }, ...(code ? [{ code }] : [])],
      },
      select: { id: true },
    });
    if (found) throw new ConflictException('Filial com nome ou código ja cadastrada');
  }

  private async audit(me: AuthPayload, action: string, module: string, entity: string, entityId: string, beforeValue: unknown, afterValue: unknown) {
    await this.prisma.auditLog.create({
      data: {
        companyId: me.companyId,
        userId: me.sub,
        action,
        module,
        entity,
        entityId,
        beforeValue: stringify(beforeValue),
        afterValue: stringify(afterValue),
        payload: stringify({ source: 'admin-service' }),
        result: 'SUCCESS',
      },
    });
  }
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '_');
}

function stringify(value: unknown) {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}
