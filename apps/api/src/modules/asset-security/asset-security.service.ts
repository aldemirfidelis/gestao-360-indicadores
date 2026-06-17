import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { AuthPayload } from '../auth/auth.types';

const MODULE = 'asset-security';

const PACKAGE_FEATURES = [
  'GATES',
  'VISITORS',
  'CONTRACTORS',
  'VEHICLES',
  'MATERIALS',
  'ROUNDS',
  'INCIDENTS',
  'LOGBOOK',
  'SHIFT_HANDOVER',
  'EXTERNAL_PORTAL',
  'OFFLINE_APP',
  'QR_CODE',
  'DASHBOARDS',
  'INTEGRATIONS',
] as const;

const RECORD_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED'] as const;
const PACKAGE_STATUSES = ['ENABLED', 'DISABLED', 'TRIAL', 'READ_ONLY', 'BLOCKED', 'EXPIRED'] as const;
const PERSON_TYPES = ['VISITOR', 'CONTRACTOR', 'DRIVER', 'PASSENGER', 'EMPLOYEE', 'THIRD_PARTY', 'SUPPLIER', 'REPRESENTATIVE', 'AUTHORITY', 'GUEST', 'BLOCKED'] as const;
const DOCUMENT_STATUSES = ['VALID', 'EXPIRING', 'EXPIRED', 'MISSING', 'IN_REVIEW', 'REJECTED', 'BLOCKED', 'NOT_REQUIRED'] as const;
const AUTH_STATUSES = ['DRAFT', 'REQUESTED', 'WAITING_DOCUMENTS', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'USED', 'PARTIALLY_USED'] as const;
const MOVEMENT_TYPES = ['PERSON_ENTRY', 'PERSON_EXIT', 'VEHICLE_ENTRY', 'VEHICLE_EXIT', 'MATERIAL_ENTRY', 'MATERIAL_EXIT', 'EQUIPMENT_ENTRY', 'EQUIPMENT_EXIT', 'CARGO', 'UNLOADING', 'CORRESPONDENCE', 'KEY_LOAN', 'KEY_RETURN', 'BADGE_DELIVERY', 'BADGE_RETURN'] as const;
const MOVEMENT_STATUSES = ['OPEN', 'CLOSED', 'PENDING', 'BLOCKED', 'CANCELLED', 'OVERDUE'] as const;
const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY'] as const;
const INCIDENT_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_ACTION', 'CLOSED', 'CANCELLED'] as const;
const ROUND_STATUSES = ['PLANNED', 'IN_PROGRESS', 'DONE', 'LATE', 'MISSED', 'CANCELLED'] as const;
const HANDOVER_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'WAITING_REVIEW', 'WAITING_ACCEPTANCE', 'COMPLETED', 'COMPLETED_WITH_PENDING'] as const;
const CUSTODY_TYPES = ['KEY', 'BADGE'] as const;
const CUSTODY_STATUSES = ['AVAILABLE', 'LOANED', 'OVERDUE', 'LOST', 'BLOCKED', 'MAINTENANCE', 'INACTIVE'] as const;
const QR_STATUSES = ['ACTIVE', 'EXPIRED', 'REVOKED', 'USED', 'BLOCKED'] as const;
const OFFLINE_STATUSES = ['PENDING', 'SYNCED', 'CONFLICT', 'ERROR'] as const;

type Query = Record<string, string | undefined>;
type JsonMap = Record<string, unknown>;

@Injectable()
export class AssetSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  async options(me: AuthPayload) {
    const [branches, orgNodes, users, gates, posts, people, contractorCompanies, vehicles, roundRoutes, templates] = await Promise.all([
      this.db.branch.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } }),
      this.db.orgNode.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, code: true, type: true, parentId: true },
      }),
      this.db.user.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true, role: true } }),
      this.db.securityGate.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true, unitId: true, status: true } }),
      this.db.securityPost.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true, gateId: true, status: true } }),
      this.db.securityPerson.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: { name: 'asc' }, take: 500, select: { id: true, name: true, type: true, documentMasked: true, status: true, documentStatus: true } }),
      this.db.securityContractorCompany.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: { tradeName: 'asc' }, select: { id: true, legalName: true, tradeName: true, documentStatus: true, status: true } }),
      this.db.securityVehicle.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: { plate: 'asc' }, take: 500, select: { id: true, plate: true, type: true, model: true, status: true, documentStatus: true } }),
      this.db.securityRoundRoute.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true, status: true } }),
      this.db.formTemplate.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: { title: 'asc' }, take: 200, select: { id: true, code: true, title: true, status: true, type: true } }).catch(() => []),
    ]);

    return {
      branches,
      orgNodes,
      users,
      gates,
      posts,
      people,
      contractorCompanies,
      vehicles,
      roundRoutes,
      formTemplates: templates,
      packageFeatures: PACKAGE_FEATURES,
      packageStatuses: PACKAGE_STATUSES,
      recordStatuses: RECORD_STATUSES,
      personTypes: PERSON_TYPES,
      documentStatuses: DOCUMENT_STATUSES,
      authorizationStatuses: AUTH_STATUSES,
      movementTypes: MOVEMENT_TYPES,
      movementStatuses: MOVEMENT_STATUSES,
      incidentSeverities: INCIDENT_SEVERITIES,
      incidentStatuses: INCIDENT_STATUSES,
      roundStatuses: ROUND_STATUSES,
      handoverStatuses: HANDOVER_STATUSES,
      custodyTypes: CUSTODY_TYPES,
      custodyStatuses: CUSTODY_STATUSES,
      qrStatuses: QR_STATUSES,
      offlineStatuses: OFFLINE_STATUSES,
      gateTypes: [
        'Portaria Principal',
        'Portaria de Colaboradores',
        'Portaria de Prestadores',
        'Portaria de Visitantes',
        'Portaria de Veiculos Leves',
        'Portaria de Cargas',
        'Portaria Agricola',
        'Portaria Administrativa',
        'Portaria Temporaria',
      ],
      vehicleTypes: ['Carro', 'Moto', 'Caminhao', 'Carreta', 'Bitrem', 'Onibus', 'Van', 'Maquina', 'Trator', 'Veiculo agricola', 'Outro'],
    };
  }

  async getPackage(me: AuthPayload, unitId?: string) {
    const found = await this.db.securityPackageActivation.findFirst({
      where: { companyId: me.companyId, unitId: unitId || null, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (found) return found;
    return {
      id: null,
      companyId: me.companyId,
      unitId: unitId || null,
      code: MODULE,
      status: 'ENABLED',
      enabledFeatures: [...PACKAGE_FEATURES],
      limits: { dailyMovements: null, gates: null, offlineDevices: null },
      settings: { documentAlertDays: 30, maxStayMinutes: 480 },
      virtual: true,
    };
  }

  async updatePackage(me: AuthPayload, body: JsonMap) {
    const unitId = await this.validateOrgNode(me.companyId, this.id(body.unitId));
    const before = await this.db.securityPackageActivation.findFirst({ where: { companyId: me.companyId, unitId, deletedAt: null } });
    const data = {
      companyId: me.companyId,
      unitId,
      code: this.text(body.code) || MODULE,
      status: this.enumValue(body.status, PACKAGE_STATUSES, 'ENABLED'),
      enabledFeatures: this.stringArray(body.enabledFeatures, [...PACKAGE_FEATURES]),
      limits: this.json(body.limits),
      settings: this.json(body.settings),
      trialStartedAt: this.date(body.trialStartedAt),
      trialEndsAt: this.date(body.trialEndsAt),
      activatedAt: this.date(body.activatedAt),
      blockedAt: this.date(body.blockedAt),
      blockReason: this.nullableText(body.blockReason),
      commercialPlanCode: this.nullableText(body.commercialPlanCode),
      configuredById: me.sub,
    };
    const saved = before
      ? await this.db.securityPackageActivation.update({ where: { id: before.id }, data })
      : await this.db.securityPackageActivation.create({ data });
    await this.audit(me, before ? 'UPDATE_PACKAGE' : 'CREATE_PACKAGE', 'SecurityPackageActivation', saved.id, saved.code, before, saved);
    return saved;
  }

  async summary(me: AuthPayload, filters: Query = {}) {
    const where = this.scopeWhere(me, filters);
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const [gates, posts, openMovements, todayEntries, todayExits, docsPeople, docsCompanies, docsVehicles, incidentsOpen, incidentsCritical, roundsLate, custodyPending, correspondenceWaiting, offlinePending, authorizationsPending, blockedAttempts] = await Promise.all([
      this.db.securityGate.count({ where: { companyId: me.companyId, deletedAt: null, status: 'ACTIVE', ...this.pick(where, ['unitId']) } }),
      this.db.securityPost.count({ where: { companyId: me.companyId, deletedAt: null, status: 'ACTIVE', ...this.pick(where, ['unitId', 'gateId']) } }),
      this.db.securityAccessMovement.findMany({ where: { companyId: me.companyId, deletedAt: null, status: 'OPEN', ...where }, select: { id: true, movementType: true, vehicleId: true, personId: true, expectedExitAt: true, maxStayMinutes: true, entryAt: true } }),
      this.db.securityAccessMovement.count({ where: { companyId: me.companyId, deletedAt: null, entryAt: { gte: dayStart }, ...where } }),
      this.db.securityAccessMovement.count({ where: { companyId: me.companyId, deletedAt: null, exitAt: { gte: dayStart }, ...where } }),
      this.db.securityPerson.count({ where: { companyId: me.companyId, deletedAt: null, documentStatus: { in: ['EXPIRED', 'MISSING', 'REJECTED', 'BLOCKED'] } } }),
      this.db.securityContractorCompany.count({ where: { companyId: me.companyId, deletedAt: null, documentStatus: { in: ['EXPIRED', 'MISSING', 'REJECTED', 'BLOCKED'] } } }),
      this.db.securityVehicle.count({ where: { companyId: me.companyId, deletedAt: null, documentStatus: { in: ['EXPIRED', 'MISSING', 'REJECTED', 'BLOCKED'] } } }),
      this.db.securityIncident.count({ where: { companyId: me.companyId, deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_ACTION'] }, ...where } }),
      this.db.securityIncident.count({ where: { companyId: me.companyId, deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_ACTION'] }, severity: { in: ['CRITICAL', 'EMERGENCY'] }, ...where } }),
      this.db.securityRoundExecution.count({ where: { companyId: me.companyId, deletedAt: null, status: { in: ['LATE', 'MISSED'] }, ...this.pick(where, ['postId']) } }),
      this.db.securityCustodyItem.count({ where: { companyId: me.companyId, deletedAt: null, status: { in: ['LOANED', 'OVERDUE'] }, ...this.pick(where, ['unitId', 'gateId']) } }),
      this.db.securityCorrespondence.count({ where: { companyId: me.companyId, deletedAt: null, pickedUpAt: null, status: 'ACTIVE', ...this.pick(where, ['unitId', 'gateId']) } }),
      this.db.securityOfflineSync.count({ where: { companyId: me.companyId, status: { in: ['PENDING', 'CONFLICT', 'ERROR'] } } }),
      this.db.securityAuthorization.count({ where: { companyId: me.companyId, deletedAt: null, status: { in: ['REQUESTED', 'WAITING_DOCUMENTS', 'WAITING_APPROVAL'] }, ...this.pick(where, ['unitId', 'gateId']) } }),
      this.db.securityBlocklist.count({ where: { companyId: me.companyId, deletedAt: null, status: 'ACTIVE' } }),
    ]);

    const now = Date.now();
    const peoplePresent = openMovements.filter((m: any) => m.personId).length;
    const vehiclesPresent = openMovements.filter((m: any) => m.vehicleId || String(m.movementType).includes('VEHICLE')).length;
    const overduePresence = openMovements.filter((m: any) => {
      if (m.expectedExitAt && new Date(m.expectedExitAt).getTime() < now) return true;
      if (m.entryAt && m.maxStayMinutes) return new Date(m.entryAt).getTime() + Number(m.maxStayMinutes) * 60_000 < now;
      return false;
    }).length;

    return {
      gates,
      posts,
      peoplePresent,
      vehiclesPresent,
      todayEntries,
      todayExits,
      pendingExits: openMovements.length,
      overduePresence,
      expiredOrInvalidDocuments: docsPeople + docsCompanies + docsVehicles,
      authorizationsPending,
      openIncidents: incidentsOpen,
      criticalIncidents: incidentsCritical,
      lateRounds: roundsLate,
      custodyPending,
      correspondenceWaiting,
      offlinePending,
      activeBlocklistItems: blockedAttempts,
      generatedAt: new Date().toISOString(),
    };
  }

  async listGates(me: AuthPayload, q: Query = {}) {
    const where = await this.areaScopedWhere(me, this.filterBase(me, q, ['status', 'unitId', 'branchId']));
    return this.db.securityGate.findMany({ where, orderBy: [{ status: 'asc' }, { name: 'asc' }] });
  }

  async createGate(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const unitId = await this.validateOrgNode(me.companyId, this.id(body.unitId));
    if (unitId) await this.access.assertCanWrite(me.sub, unitId, MODULE, 'create');
    const data = this.gateData(me, body, unitId);
    const saved = await this.db.securityGate.create({ data });
    await this.audit(me, 'CREATE', 'SecurityGate', saved.id, saved.name, null, saved, { unitId });
    return saved;
  }

  async updateGate(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityGate', me.companyId, id, 'Portaria nao encontrada');
    const unitId = 'unitId' in body ? await this.validateOrgNode(me.companyId, this.id(body.unitId)) : before.unitId;
    if (unitId) await this.access.assertCanWrite(me.sub, unitId, MODULE, 'edit');
    const saved = await this.db.securityGate.update({ where: { id }, data: this.gatePatch(body, unitId) });
    await this.audit(me, 'UPDATE', 'SecurityGate', saved.id, saved.name, before, saved);
    return saved;
  }

  async listPosts(me: AuthPayload, q: Query = {}) {
    const where = await this.areaScopedWhere(me, this.filterBase(me, q, ['status', 'unitId', 'gateId']));
    return this.db.securityPost.findMany({ where, orderBy: [{ status: 'asc' }, { name: 'asc' }] });
  }

  async createPost(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const unitId = await this.validateOrgNode(me.companyId, this.id(body.unitId));
    if (unitId) await this.access.assertCanWrite(me.sub, unitId, MODULE, 'create');
    const gateId = await this.validateGate(me.companyId, this.id(body.gateId));
    const data = this.postData(me, body, unitId, gateId);
    const saved = await this.db.securityPost.create({ data });
    await this.audit(me, 'CREATE', 'SecurityPost', saved.id, saved.name, null, saved);
    return saved;
  }

  async updatePost(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityPost', me.companyId, id, 'Posto nao encontrado');
    const unitId = 'unitId' in body ? await this.validateOrgNode(me.companyId, this.id(body.unitId)) : before.unitId;
    if (unitId) await this.access.assertCanWrite(me.sub, unitId, MODULE, 'edit');
    const gateId = 'gateId' in body ? await this.validateGate(me.companyId, this.id(body.gateId)) : before.gateId;
    const saved = await this.db.securityPost.update({ where: { id }, data: this.postPatch(body, unitId, gateId) });
    await this.audit(me, 'UPDATE', 'SecurityPost', saved.id, saved.name, before, saved);
    return saved;
  }

  async listPeople(me: AuthPayload, q: Query = {}) {
    const term = this.text(q.search);
    return this.db.securityPerson.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(q.type ? { type: q.type } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.documentStatus ? { documentStatus: q.documentStatus } : {}),
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { socialName: { contains: term, mode: 'insensitive' } },
                { documentNumber: { contains: this.onlyDigits(term), mode: 'insensitive' } },
                { email: { contains: term, mode: 'insensitive' } },
                { originCompanyName: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: this.take(q.take),
    });
  }

  async createPerson(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const saved = await this.db.securityPerson.create({ data: this.personData(me, body) });
    await this.audit(me, 'CREATE', 'SecurityPerson', saved.id, saved.name, null, this.maskPersonForAudit(saved));
    return saved;
  }

  async importPeople(me: AuthPayload, rows: JsonMap[]) {
    await this.assertPackageWrite(me);
    if (!Array.isArray(rows) || rows.length === 0) throw new BadRequestException('Informe as linhas da planilha para importar.');
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const samples: Array<{ row: number; reason: string }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] ?? {};
      const code = this.nullableText(this.sheetValue(row, ['Cadastro']));
      const name = this.text(this.sheetValue(row, ['Nome Colaborador', 'Nome', 'Colaborador']));
      const documentNumber = this.onlyDigits(this.text(this.sheetValue(row, ['CPF', 'Documento'])));
      const local = this.nullableText(this.sheetValue(row, ['Local']));
      const jobTitle = this.nullableText(this.sheetValue(row, ['Cargo']));
      const area = this.nullableText(this.sheetValue(row, ['Area de Atuacao', 'Área de Atuação', 'Area de Atuação', 'Área de Atuacao']));

      if (!name) {
        skipped += 1;
        if (samples.length < 10) samples.push({ row: index + 2, reason: 'Nome Colaborador vazio' });
        continue;
      }

      const lookup = [
        ...(code ? [{ code }] : []),
        ...(documentNumber ? [{ documentNumber }] : []),
      ];
      const existing = lookup.length > 0
        ? await this.db.securityPerson.findFirst({
            where: {
              companyId: me.companyId,
              deletedAt: null,
              OR: lookup,
            },
          })
        : null;
      const data = {
        type: 'EMPLOYEE',
        code,
        name,
        documentType: documentNumber ? 'CPF' : null,
        documentNumber: documentNumber || null,
        documentMasked: this.maskDocument(documentNumber),
        originCompanyName: local,
        jobTitle,
        notes: area ? `Area de Atuacao: ${area}` : null,
        documentStatus: 'NOT_REQUIRED',
        status: 'ACTIVE',
        updatedById: me.sub,
      };

      if (existing) {
        await this.db.securityPerson.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await this.db.securityPerson.create({ data: { ...data, companyId: me.companyId, createdById: me.sub } });
        created += 1;
      }
    }

    await this.audit(me, 'IMPORT_PEOPLE', 'SecurityPerson', null, 'Importacao de pessoas', null, { created, updated, skipped, samples });
    return { total: rows.length, created, updated, skipped, samples };
  }

  async updatePerson(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityPerson', me.companyId, id, 'Pessoa nao encontrada');
    const saved = await this.db.securityPerson.update({ where: { id }, data: this.personPatch(body) });
    await this.audit(me, 'UPDATE', 'SecurityPerson', saved.id, saved.name, this.maskPersonForAudit(before), this.maskPersonForAudit(saved));
    return saved;
  }

  async listContractorCompanies(me: AuthPayload, q: Query = {}) {
    const term = this.text(q.search);
    return this.db.securityContractorCompany.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(q.status ? { status: q.status } : {}),
        ...(q.documentStatus ? { documentStatus: q.documentStatus } : {}),
        ...(term ? { OR: [{ legalName: { contains: term, mode: 'insensitive' } }, { tradeName: { contains: term, mode: 'insensitive' } }, { cnpj: { contains: this.onlyDigits(term), mode: 'insensitive' } }] } : {}),
      },
      orderBy: [{ status: 'asc' }, { tradeName: 'asc' }, { legalName: 'asc' }],
      take: this.take(q.take),
    });
  }

  async createContractorCompany(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const saved = await this.db.securityContractorCompany.create({ data: this.contractorCompanyData(me, body) });
    await this.audit(me, 'CREATE', 'SecurityContractorCompany', saved.id, saved.tradeName || saved.legalName, null, saved);
    return saved;
  }

  async updateContractorCompany(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityContractorCompany', me.companyId, id, 'Empresa prestadora nao encontrada');
    const saved = await this.db.securityContractorCompany.update({ where: { id }, data: this.contractorCompanyPatch(body) });
    await this.audit(me, 'UPDATE', 'SecurityContractorCompany', saved.id, saved.tradeName || saved.legalName, before, saved);
    return saved;
  }

  async listVehicles(me: AuthPayload, q: Query = {}) {
    const term = this.text(q.search);
    return this.db.securityVehicle.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(q.status ? { status: q.status } : {}),
        ...(q.documentStatus ? { documentStatus: q.documentStatus } : {}),
        ...(term ? { OR: [{ plate: { contains: this.normalizePlate(term), mode: 'insensitive' } }, { model: { contains: term, mode: 'insensitive' } }, { ownerName: { contains: term, mode: 'insensitive' } }, { companyName: { contains: term, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { plate: 'asc' },
      take: this.take(q.take),
    });
  }

  async createVehicle(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const saved = await this.db.securityVehicle.create({ data: this.vehicleData(me, body) });
    await this.audit(me, 'CREATE', 'SecurityVehicle', saved.id, saved.plate, null, saved);
    return saved;
  }

  async updateVehicle(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityVehicle', me.companyId, id, 'Veiculo nao encontrado');
    const saved = await this.db.securityVehicle.update({ where: { id }, data: this.vehiclePatch(body) });
    await this.audit(me, 'UPDATE', 'SecurityVehicle', saved.id, saved.plate, before, saved);
    return saved;
  }

  async listDocumentRequirements(me: AuthPayload, q: Query = {}) {
    return this.db.securityDocumentRequirement.findMany({
      where: { companyId: me.companyId, deletedAt: null, ...(q.status ? { status: q.status } : {}), ...(q.scopeType ? { scopeType: q.scopeType } : {}) },
      orderBy: [{ scopeType: 'asc' }, { name: 'asc' }],
    });
  }

  async createDocumentRequirement(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const saved = await this.db.securityDocumentRequirement.create({ data: this.documentRequirementData(me, body) });
    await this.audit(me, 'CREATE', 'SecurityDocumentRequirement', saved.id, saved.name, null, saved);
    return saved;
  }

  async updateDocumentRequirement(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityDocumentRequirement', me.companyId, id, 'Documento obrigatorio nao encontrado');
    const saved = await this.db.securityDocumentRequirement.update({ where: { id }, data: this.documentRequirementPatch(body) });
    await this.audit(me, 'UPDATE', 'SecurityDocumentRequirement', saved.id, saved.name, before, saved);
    return saved;
  }

  async listAuthorizations(me: AuthPayload, q: Query = {}) {
    const where = await this.areaScopedWhere(me, {
      companyId: me.companyId,
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.gateId ? { gateId: q.gateId } : {}),
      ...(q.unitId ? { unitId: q.unitId } : {}),
      ...(q.personId ? { personId: q.personId } : {}),
    });
    const rows = await this.db.securityAuthorization.findMany({ where, orderBy: [{ scheduledStartAt: 'desc' }, { createdAt: 'desc' }], take: this.take(q.take) });
    return this.decorateAuthorizations(me, rows);
  }

  async createAuthorization(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const unitId = await this.validateOrgNode(me.companyId, this.id(body.unitId));
    const gateId = await this.validateGate(me.companyId, this.id(body.gateId));
    if (unitId) await this.access.assertCanWrite(me.sub, unitId, MODULE, 'create');
    await this.validatePerson(me.companyId, this.id(body.personId));
    await this.validateVehicle(me.companyId, this.id(body.vehicleId));
    await this.validateContractorCompany(me.companyId, this.id(body.contractorCompanyId));
    const qrToken = body.qrCodeToken === null ? null : this.token('asq');
    const saved = await this.db.securityAuthorization.create({
      data: {
        companyId: me.companyId,
        code: this.text(body.code) || (await this.nextCode('securityAuthorization', me.companyId, 'AUT')),
        personId: this.id(body.personId),
        contractorCompanyId: this.id(body.contractorCompanyId),
        unitId,
        gateId,
        requestedById: this.id(body.requestedById) || me.sub,
        internalResponsibleId: this.id(body.internalResponsibleId),
        vehicleId: this.id(body.vehicleId),
        approverId: this.id(body.approverId),
        status: this.enumValue(body.status, AUTH_STATUSES, 'REQUESTED'),
        source: this.recordOrigin(body.source),
        reason: this.nullableText(body.reason),
        destinationAreaId: await this.validateOrgNode(me.companyId, this.id(body.destinationAreaId)),
        scheduledStartAt: this.date(body.scheduledStartAt),
        scheduledEndAt: this.date(body.scheduledEndAt),
        maxStayMinutes: this.int(body.maxStayMinutes),
        allowedPeriodText: this.nullableText(body.allowedPeriodText),
        passengerPersonIds: this.stringArray(body.passengerPersonIds),
        materialRefs: this.json(body.materialRefs),
        documentRefs: this.json(body.documentRefs),
        attachments: this.json(body.attachments),
        qrCodeToken: qrToken,
        qrExpiresAt: this.date(body.qrExpiresAt) || this.date(body.scheduledEndAt),
        notes: this.nullableText(body.notes),
        createdById: me.sub,
        updatedById: me.sub,
      },
    });
    if (qrToken) await this.createQrInternal(me, 'SecurityAuthorization', saved.id, 'AUTHORIZATION', qrToken, saved.qrExpiresAt);
    await this.createWorkItemForAuthorization(me, saved);
    await this.audit(me, 'CREATE', 'SecurityAuthorization', saved.id, saved.code, null, saved);
    return this.decorateOneAuthorization(me, saved);
  }

  async updateAuthorization(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityAuthorization', me.companyId, id, 'Autorizacao nao encontrada');
    const patch = await this.authorizationPatch(me, body);
    const saved = await this.db.securityAuthorization.update({ where: { id }, data: patch });
    await this.createWorkItemForAuthorization(me, saved);
    await this.audit(me, 'UPDATE', 'SecurityAuthorization', saved.id, saved.code, before, saved);
    return this.decorateOneAuthorization(me, saved);
  }

  async decideAuthorization(me: AuthPayload, id: string, status: 'APPROVED' | 'REJECTED', body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityAuthorization', me.companyId, id, 'Autorizacao nao encontrada');
    const qrToken = before.qrCodeToken || this.token('asq');
    const data: JsonMap = status === 'APPROVED'
      ? { status, approverId: me.sub, approvedAt: new Date(), rejectedAt: null, qrCodeToken: qrToken, qrExpiresAt: this.date(body.qrExpiresAt) || before.qrExpiresAt || before.scheduledEndAt, notes: this.nullableText(body.notes) ?? before.notes, updatedById: me.sub }
      : { status, approverId: me.sub, rejectedAt: new Date(), cancelReason: this.nullableText(body.reason) || this.nullableText(body.cancelReason), updatedById: me.sub };
    const saved = await this.db.securityAuthorization.update({ where: { id }, data });
    if (status === 'APPROVED') await this.createQrInternal(me, 'SecurityAuthorization', saved.id, 'AUTHORIZATION', qrToken, saved.qrExpiresAt);
    await this.closeWorkItem(me.companyId, 'SecurityAuthorization', saved.id);
    await this.audit(me, status === 'APPROVED' ? 'APPROVE' : 'REJECT', 'SecurityAuthorization', saved.id, saved.code, before, saved, { reason: data.cancelReason });
    return this.decorateOneAuthorization(me, saved);
  }

  async createExternalInvite(me: AuthPayload, authorizationId: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const auth = await this.loadTenant('securityAuthorization', me.companyId, authorizationId, 'Autorizacao nao encontrada');
    const token = this.token('ext');
    const invite = await this.db.securityExternalInvite.create({
      data: {
        companyId: me.companyId,
        authorizationId,
        token,
        requesterName: this.nullableText(body.requesterName),
        requesterEmail: this.nullableText(body.requesterEmail),
        expiresAt: this.date(body.expiresAt) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await this.audit(me, 'CREATE_EXTERNAL_INVITE', 'SecurityExternalInvite', invite.id, auth.code, null, invite);
    return { ...invite, publicUrl: `/portal-seguranca/${token}` };
  }

  async getExternalInvite(token: string) {
    const invite = await this.db.securityExternalInvite.findFirst({ where: { token, deletedAt: null, status: 'ACTIVE' } });
    if (!invite || new Date(invite.expiresAt).getTime() < Date.now()) throw new NotFoundException('Convite expirado ou invalido.');
    const authorization = invite.authorizationId
      ? await this.db.securityAuthorization.findFirst({ where: { id: invite.authorizationId, companyId: invite.companyId, deletedAt: null } })
      : null;
    return {
      token,
      expiresAt: invite.expiresAt,
      requesterName: invite.requesterName,
      authorization: authorization
        ? {
            code: authorization.code,
            status: authorization.status,
            reason: authorization.reason,
            scheduledStartAt: authorization.scheduledStartAt,
            scheduledEndAt: authorization.scheduledEndAt,
            allowedPeriodText: authorization.allowedPeriodText,
            notes: authorization.notes,
          }
        : null,
      responseData: invite.responseData,
    };
  }

  async submitExternalInvite(token: string, body: JsonMap) {
    const invite = await this.db.securityExternalInvite.findFirst({ where: { token, deletedAt: null, status: 'ACTIVE' } });
    if (!invite || new Date(invite.expiresAt).getTime() < Date.now()) throw new NotFoundException('Convite expirado ou invalido.');
    const saved = await this.db.securityExternalInvite.update({
      where: { id: invite.id },
      data: {
        responseData: this.json(body.responseData) ?? body,
        acceptedTermsAt: body.acceptedTerms ? new Date() : invite.acceptedTermsAt,
        privacyAcceptedAt: body.privacyAccepted ? new Date() : invite.privacyAcceptedAt,
        submittedAt: new Date(),
      },
    });
    await this.auditPublic(invite.companyId, 'SUBMIT_EXTERNAL_INVITE', 'SecurityExternalInvite', saved.id, saved.requesterEmail, invite, saved);
    return { ok: true, submittedAt: saved.submittedAt };
  }

  async listMovements(me: AuthPayload, q: Query = {}) {
    const rows = await this.db.securityAccessMovement.findMany({
      where: this.movementWhere(me, q),
      orderBy: [{ entryAt: 'desc' }, { createdAt: 'desc' }],
      take: this.take(q.take),
    });
    return this.decorateMovements(me, rows);
  }

  async present(me: AuthPayload, q: Query = {}) {
    const rows = await this.db.securityAccessMovement.findMany({
      where: { ...this.movementWhere(me, q), status: 'OPEN', exitAt: null },
      orderBy: [{ expectedExitAt: 'asc' }, { entryAt: 'desc' }],
      take: this.take(q.take, 500),
    });
    return this.decorateMovements(me, rows);
  }

  async pendingExits(me: AuthPayload, q: Query = {}) {
    const now = new Date();
    const rows = await this.db.securityAccessMovement.findMany({
      where: {
        ...this.movementWhere(me, q),
        status: 'OPEN',
        exitAt: null,
        OR: [{ expectedExitAt: null }, { expectedExitAt: { lte: now } }],
      },
      orderBy: [{ expectedExitAt: 'asc' }, { entryAt: 'asc' }],
      take: this.take(q.take, 500),
    });
    return this.decorateMovements(me, rows);
  }

  async registerEntry(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const unitId = await this.validateOrgNode(me.companyId, this.id(body.unitId));
    const gateId = await this.validateGate(me.companyId, this.id(body.gateId));
    const postId = await this.validatePost(me.companyId, this.id(body.postId));
    const person = await this.resolveEntryPerson(me, body);
    const vehicle = await this.validateVehicle(me.companyId, this.id(body.vehicleId));
    const contractor = await this.validateContractorCompany(me.companyId, this.id(body.contractorCompanyId));
    const authorization = await this.validateAuthorization(me.companyId, this.id(body.authorizationId));
    await this.validateEntryRules(me, { person, vehicle, contractor, authorization, body });

    const entryAt = this.date(body.entryAt) || new Date();
    const maxStayMinutes = this.int(body.maxStayMinutes) ?? authorization?.maxStayMinutes ?? this.int((await this.getPackage(me, unitId ?? undefined)).settings?.maxStayMinutes) ?? 480;
    const expectedExitAt = this.date(body.expectedExitAt) || authorization?.scheduledEndAt || new Date(entryAt.getTime() + maxStayMinutes * 60_000);
    const movementType = this.enumValue(body.movementType, MOVEMENT_TYPES, vehicle ? 'VEHICLE_ENTRY' : 'PERSON_ENTRY');
    const saved = await this.db.securityAccessMovement.create({
      data: {
        companyId: me.companyId,
        unitId,
        gateId,
        postId,
        authorizationId: authorization?.id ?? null,
        personId: person?.id ?? null,
        vehicleId: vehicle?.id ?? null,
        contractorCompanyId: contractor?.id ?? person?.contractorCompanyId ?? null,
        code: this.text(body.code) || (await this.nextCode('securityAccessMovement', me.companyId, 'MOV')),
        movementType,
        category: this.nullableText(body.category) ?? person?.type ?? null,
        documentSnapshot: this.json(body.documentSnapshot) ?? this.documentSnapshot(person, vehicle, contractor),
        originCompanyName: this.nullableText(body.originCompanyName) ?? contractor?.tradeName ?? contractor?.legalName ?? person?.originCompanyName ?? null,
        reason: this.nullableText(body.reason) ?? authorization?.reason ?? null,
        internalResponsibleId: this.id(body.internalResponsibleId) || (authorization?.internalResponsibleId ?? null),
        destinationAreaId: await this.validateOrgNode(me.companyId, this.id(body.destinationAreaId) || (authorization?.destinationAreaId ?? null)),
        plate: this.normalizePlate(this.text(body.plate) || vehicle?.plate || ''),
        trailerPlate: this.nullableText(body.trailerPlate),
        driverPersonId: this.id(body.driverPersonId),
        passengerPersonIds: this.stringArray(body.passengerPersonIds),
        materialRefs: this.json(body.materialRefs) ?? authorization?.materialRefs ?? null,
        equipmentRefs: this.json(body.equipmentRefs),
        cargoRefs: this.json(body.cargoRefs),
        qrCodeToken: this.nullableText(body.qrCodeToken) ?? authorization?.qrCodeToken ?? null,
        expectedEntryAt: this.date(body.expectedEntryAt) ?? authorization?.scheduledStartAt ?? null,
        expectedExitAt,
        entryAt,
        maxStayMinutes,
        status: 'OPEN',
        exceptionReason: this.nullableText(body.exceptionReason),
        exceptionJustification: this.nullableText(body.exceptionJustification),
        exceptionApprovedById: this.id(body.exceptionApprovedById),
        notes: this.nullableText(body.notes),
        attachments: this.json(body.attachments),
        photoUrl: this.nullableText(body.photoUrl),
        evidenceRefs: this.json(body.evidenceRefs),
        registeredById: me.sub,
        origin: this.recordOrigin(body.origin),
        offlineSyncId: this.id(body.offlineSyncId),
        syncStatus: this.enumValue(body.syncStatus, OFFLINE_STATUSES, body.origin === 'OFFLINE' ? 'PENDING' : 'SYNCED'),
        deviceInfo: this.json(body.deviceInfo),
        logs: this.json(body.logs),
      },
    });
    if (authorization?.id) {
      await this.db.securityAuthorization.update({ where: { id: authorization.id }, data: { status: 'USED' } }).catch(() => undefined);
    }
    await this.audit(me, 'REGISTER_ENTRY', 'SecurityAccessMovement', saved.id, saved.code, null, saved, { gateId, postId, unitId });
    await this.createPresenceWorkItems(me, saved);
    return this.decorateOneMovement(me, saved);
  }

  async registerExit(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const movement = await this.findOpenMovementForExit(me, body);
    const exitAt = this.date(body.exitAt) || new Date();
    const entryAt = movement.entryAt ? new Date(movement.entryAt) : exitAt;
    const durationMinutes = Math.max(0, Math.round((exitAt.getTime() - entryAt.getTime()) / 60_000));
    const saved = await this.db.securityAccessMovement.update({
      where: { id: movement.id },
      data: {
        exitAt,
        durationMinutes,
        status: 'CLOSED',
        exitRegisteredById: me.sub,
        notes: this.nullableText(body.notes) ?? movement.notes,
        evidenceRefs: this.json(body.evidenceRefs) ?? movement.evidenceRefs,
      },
    });
    await this.closeWorkItem(me.companyId, 'SecurityAccessMovement', movement.id);
    await this.audit(me, 'REGISTER_EXIT', 'SecurityAccessMovement', saved.id, saved.code, movement, saved);
    return this.decorateOneMovement(me, saved);
  }

  async listMaterials(me: AuthPayload, q: Query = {}) {
    return this.db.securityMaterialMovement.findMany({
      where: { companyId: me.companyId, deletedAt: null, ...(q.status ? { status: q.status } : {}) },
      orderBy: [{ occurredAt: 'desc' }],
      take: this.take(q.take),
    });
  }

  async createMaterialMovement(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const saved = await this.db.securityMaterialMovement.create({ data: await this.materialData(me, body) });
    if (saved.alertCode) await this.createOperationalWorkItem(me, 'SecurityMaterialMovement', saved.id, saved.alertCode, saved.description, 'HIGH');
    await this.audit(me, 'CREATE', 'SecurityMaterialMovement', saved.id, saved.code || saved.description, null, saved);
    return saved;
  }

  async updateMaterialMovement(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityMaterialMovement', me.companyId, id, 'Movimentacao de material nao encontrada');
    const saved = await this.db.securityMaterialMovement.update({ where: { id }, data: await this.materialPatch(me, body) });
    await this.audit(me, 'UPDATE', 'SecurityMaterialMovement', saved.id, saved.code || saved.description, before, saved);
    return saved;
  }

  async listCustodyItems(me: AuthPayload, q: Query = {}) {
    return this.db.securityCustodyItem.findMany({
      where: { companyId: me.companyId, deletedAt: null, ...(q.itemType ? { itemType: q.itemType } : {}), ...(q.status ? { status: q.status } : {}) },
      orderBy: [{ itemType: 'asc' }, { code: 'asc' }],
      take: this.take(q.take),
    });
  }

  async createCustodyItem(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const saved = await this.db.securityCustodyItem.create({ data: await this.custodyData(me, body) });
    await this.audit(me, 'CREATE', 'SecurityCustodyItem', saved.id, saved.code, null, saved);
    return saved;
  }

  async updateCustodyItem(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityCustodyItem', me.companyId, id, 'Item nao encontrado');
    const saved = await this.db.securityCustodyItem.update({ where: { id }, data: await this.custodyPatch(me, body) });
    await this.audit(me, 'UPDATE', 'SecurityCustodyItem', saved.id, saved.code, before, saved);
    return saved;
  }

  async loanCustodyItem(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityCustodyItem', me.companyId, id, 'Item nao encontrado');
    if (!['AVAILABLE', 'OVERDUE'].includes(before.status)) throw new BadRequestException('Item nao esta disponivel para emprestimo.');
    const expectedReturnAt = this.date(body.expectedReturnAt) || new Date(Date.now() + 8 * 60 * 60 * 1000);
    const saved = await this.db.securityCustodyItem.update({
      where: { id },
      data: {
        holderPersonId: await this.validatePersonId(me.companyId, this.id(body.holderPersonId)),
        holderUserId: this.id(body.holderUserId),
        loanedAt: new Date(),
        expectedReturnAt,
        returnedAt: null,
        purpose: this.nullableText(body.purpose),
        authorizationId: this.id(body.authorizationId),
        notes: this.nullableText(body.notes) ?? before.notes,
        status: 'LOANED',
        updatedById: me.sub,
      },
    });
    await this.createOperationalWorkItem(me, 'SecurityCustodyItem', saved.id, `${saved.itemType}_PENDING`, `${saved.description} pendente de devolucao`, 'MEDIUM', expectedReturnAt);
    await this.audit(me, 'LOAN', 'SecurityCustodyItem', saved.id, saved.code, before, saved);
    return saved;
  }

  async returnCustodyItem(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityCustodyItem', me.companyId, id, 'Item nao encontrado');
    const saved = await this.db.securityCustodyItem.update({
      where: { id },
      data: {
        returnedAt: this.date(body.returnedAt) || new Date(),
        holderPersonId: null,
        holderUserId: null,
        purpose: null,
        authorizationId: null,
        status: 'AVAILABLE',
        notes: this.nullableText(body.notes) ?? before.notes,
        updatedById: me.sub,
      },
    });
    await this.closeWorkItem(me.companyId, 'SecurityCustodyItem', saved.id);
    await this.audit(me, 'RETURN', 'SecurityCustodyItem', saved.id, saved.code, before, saved);
    return saved;
  }

  async listCorrespondences(me: AuthPayload, q: Query = {}) {
    return this.db.securityCorrespondence.findMany({
      where: { companyId: me.companyId, deletedAt: null, ...(q.status ? { status: q.status } : {}), ...(q.gateId ? { gateId: q.gateId } : {}) },
      orderBy: { receivedAt: 'desc' },
      take: this.take(q.take),
    });
  }

  async createCorrespondence(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const saved = await this.db.securityCorrespondence.create({ data: await this.correspondenceData(me, body) });
    await this.audit(me, 'CREATE', 'SecurityCorrespondence', saved.id, saved.trackingCode || saved.recipient, null, saved);
    return saved;
  }

  async updateCorrespondence(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityCorrespondence', me.companyId, id, 'Correspondencia nao encontrada');
    const saved = await this.db.securityCorrespondence.update({ where: { id }, data: await this.correspondencePatch(me, body) });
    await this.audit(me, 'UPDATE', 'SecurityCorrespondence', saved.id, saved.trackingCode || saved.recipient, before, saved);
    return saved;
  }

  async pickupCorrespondence(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityCorrespondence', me.companyId, id, 'Correspondencia nao encontrada');
    const saved = await this.db.securityCorrespondence.update({
      where: { id },
      data: {
        pickedUpByName: this.requiredText(body.pickedUpByName, 'Quem retirou'),
        pickedUpById: this.id(body.pickedUpById),
        pickedUpAt: this.date(body.pickedUpAt) || new Date(),
        acknowledgement: this.nullableText(body.acknowledgement),
        evidence: this.json(body.evidence),
      },
    });
    await this.audit(me, 'PICKUP', 'SecurityCorrespondence', saved.id, saved.trackingCode || saved.recipient, before, saved);
    return saved;
  }

  async listBlocklist(me: AuthPayload, q: Query = {}) {
    return this.db.securityBlocklist.findMany({
      where: { companyId: me.companyId, deletedAt: null, ...(q.status ? { status: q.status } : {}) },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: this.take(q.take),
    });
  }

  async createBlocklist(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const saved = await this.db.securityBlocklist.create({ data: this.blocklistData(me, body) });
    await this.audit(me, 'BLOCK', 'SecurityBlocklist', saved.id, saved.reason, null, saved);
    return saved;
  }

  async updateBlocklist(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityBlocklist', me.companyId, id, 'Bloqueio nao encontrado');
    const saved = await this.db.securityBlocklist.update({ where: { id }, data: this.blocklistPatch(body) });
    await this.audit(me, 'UPDATE_BLOCK', 'SecurityBlocklist', saved.id, saved.reason, before, saved);
    return saved;
  }

  async listIncidents(me: AuthPayload, q: Query = {}) {
    const where = await this.areaScopedWhere(me, {
      companyId: me.companyId,
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.severity ? { severity: q.severity } : {}),
      ...(q.gateId ? { gateId: q.gateId } : {}),
      ...(q.unitId ? { unitId: q.unitId } : {}),
    });
    return this.db.securityIncident.findMany({ where, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: this.take(q.take) });
  }

  async createIncident(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const saved = await this.db.securityIncident.create({ data: await this.incidentData(me, body) });
    if (['HIGH', 'CRITICAL', 'EMERGENCY'].includes(saved.severity)) {
      await this.createOperationalWorkItem(me, 'SecurityIncident', saved.id, saved.type || 'INCIDENT', saved.title, saved.severity === 'HIGH' ? 'HIGH' : 'CRITICAL', saved.dueAt);
    }
    await this.audit(me, 'CREATE', 'SecurityIncident', saved.id, saved.title, null, saved);
    return saved;
  }

  async updateIncident(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityIncident', me.companyId, id, 'Ocorrencia nao encontrada');
    const saved = await this.db.securityIncident.update({ where: { id }, data: await this.incidentPatch(me, body) });
    await this.audit(me, 'UPDATE', 'SecurityIncident', saved.id, saved.title, before, saved);
    return saved;
  }

  async closeIncident(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityIncident', me.companyId, id, 'Ocorrencia nao encontrada');
    const saved = await this.db.securityIncident.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), closedById: me.sub, immediateAction: this.nullableText(body.immediateAction) ?? before.immediateAction, notes: this.nullableText(body.notes) ?? before.notes },
    });
    await this.closeWorkItem(me.companyId, 'SecurityIncident', id);
    await this.audit(me, 'CLOSE', 'SecurityIncident', saved.id, saved.title, before, saved);
    return saved;
  }

  async listRoundRoutes(me: AuthPayload, q: Query = {}) {
    const routes = await this.db.securityRoundRoute.findMany({
      where: await this.areaScopedWhere(me, { companyId: me.companyId, deletedAt: null, ...(q.status ? { status: q.status } : {}), ...(q.gateId ? { gateId: q.gateId } : {}), ...(q.unitId ? { unitId: q.unitId } : {}) }),
      orderBy: { name: 'asc' },
      take: this.take(q.take),
    });
    const checkpoints = await this.db.securityRoundCheckpoint.findMany({ where: { companyId: me.companyId, routeId: { in: routes.map((r: any) => r.id) }, deletedAt: null }, orderBy: { position: 'asc' } });
    const byRoute = this.groupBy(checkpoints, 'routeId');
    return routes.map((route: any) => ({ ...route, checkpoints: byRoute.get(route.id) ?? [] }));
  }

  async createRoundRoute(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const route = await this.db.securityRoundRoute.create({ data: await this.roundRouteData(me, body) });
    const checkpoints = Array.isArray(body.checkpoints) ? body.checkpoints : [];
    for (let i = 0; i < checkpoints.length; i++) {
      await this.db.securityRoundCheckpoint.create({ data: this.roundCheckpointData(me, route.id, checkpoints[i] as JsonMap, i + 1) });
    }
    await this.audit(me, 'CREATE', 'SecurityRoundRoute', route.id, route.name, null, route);
    return (await this.listRoundRoutes(me, { status: undefined })).find((r: any) => r.id === route.id) ?? route;
  }

  async updateRoundRoute(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityRoundRoute', me.companyId, id, 'Rota nao encontrada');
    const saved = await this.db.securityRoundRoute.update({ where: { id }, data: await this.roundRoutePatch(me, body) });
    await this.audit(me, 'UPDATE', 'SecurityRoundRoute', saved.id, saved.name, before, saved);
    return saved;
  }

  async createRoundCheckpoint(me: AuthPayload, routeId: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    await this.loadTenant('securityRoundRoute', me.companyId, routeId, 'Rota nao encontrada');
    const saved = await this.db.securityRoundCheckpoint.create({ data: this.roundCheckpointData(me, routeId, body) });
    await this.audit(me, 'CREATE', 'SecurityRoundCheckpoint', saved.id, saved.name, null, saved);
    return saved;
  }

  async listRoundExecutions(me: AuthPayload, q: Query = {}) {
    return this.db.securityRoundExecution.findMany({
      where: { companyId: me.companyId, deletedAt: null, ...(q.status ? { status: q.status } : {}), ...(q.routeId ? { routeId: q.routeId } : {}), ...(q.postId ? { postId: q.postId } : {}) },
      orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
      take: this.take(q.take),
    });
  }

  async createRoundExecution(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const routeId = await this.validateRoundRoute(me.companyId, this.id(body.routeId));
    const saved = await this.db.securityRoundExecution.create({
      data: {
        companyId: me.companyId,
        routeId,
        postId: await this.validatePost(me.companyId, this.id(body.postId)),
        assignedUserId: this.id(body.assignedUserId),
        startedById: body.startNow ? me.sub : null,
        scheduledAt: this.date(body.scheduledAt),
        startedAt: body.startNow ? new Date() : this.date(body.startedAt),
        status: body.startNow ? 'IN_PROGRESS' : this.enumValue(body.status, ROUND_STATUSES, 'PLANNED'),
        evidence: this.json(body.evidence),
        offlineSyncId: this.id(body.offlineSyncId),
        notes: this.nullableText(body.notes),
      },
    });
    await this.audit(me, 'CREATE', 'SecurityRoundExecution', saved.id, routeId, null, saved);
    return saved;
  }

  async updateRoundExecution(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityRoundExecution', me.companyId, id, 'Ronda nao encontrada');
    const saved = await this.db.securityRoundExecution.update({
      where: { id },
      data: {
        assignedUserId: this.id(body.assignedUserId) ?? before.assignedUserId,
        scheduledAt: this.date(body.scheduledAt) ?? before.scheduledAt,
        startedAt: this.date(body.startedAt) ?? before.startedAt,
        finishedAt: this.date(body.finishedAt) ?? before.finishedAt,
        status: 'status' in body ? this.enumValue(body.status, ROUND_STATUSES, before.status) : before.status,
        evidence: this.json(body.evidence) ?? before.evidence,
        notes: this.nullableText(body.notes) ?? before.notes,
      },
    });
    await this.audit(me, 'UPDATE', 'SecurityRoundExecution', saved.id, saved.routeId, before, saved);
    return saved;
  }

  async visitRoundCheckpoint(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityRoundExecution', me.companyId, id, 'Ronda nao encontrada');
    const checkpointId = this.requiredText(body.checkpointId, 'Ponto de ronda');
    const checkpoint = await this.db.securityRoundCheckpoint.findFirst({ where: { id: checkpointId, companyId: me.companyId, deletedAt: null } });
    if (!checkpoint) throw new NotFoundException('Ponto de ronda nao encontrado');
    const visited = Array.from(new Set([...(before.visitedCheckpointIds ?? []), checkpointId]));
    const saved = await this.db.securityRoundExecution.update({
      where: { id },
      data: { status: before.status === 'PLANNED' ? 'IN_PROGRESS' : before.status, startedAt: before.startedAt ?? new Date(), visitedCheckpointIds: visited, evidence: this.mergeJson(before.evidence, { [checkpointId]: body.evidence ?? true }) },
    });
    await this.audit(me, 'ROUND_CHECKPOINT_VISIT', 'SecurityRoundExecution', saved.id, checkpoint.name, before, saved);
    return saved;
  }

  async finishRoundExecution(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityRoundExecution', me.companyId, id, 'Ronda nao encontrada');
    const checkpoints = before.routeId
      ? await this.db.securityRoundCheckpoint.findMany({ where: { companyId: me.companyId, routeId: before.routeId, deletedAt: null, status: 'ACTIVE' }, select: { id: true } })
      : [];
    const expected = checkpoints.map((c: any) => c.id);
    const visited = new Set<string>(before.visitedCheckpointIds ?? []);
    const missed = expected.filter((checkpointId: string) => !visited.has(checkpointId));
    const saved = await this.db.securityRoundExecution.update({
      where: { id },
      data: {
        finishedAt: this.date(body.finishedAt) || new Date(),
        finishedById: me.sub,
        status: missed.length ? 'MISSED' : 'DONE',
        missedCheckpointIds: missed,
        evidence: this.json(body.evidence) ?? before.evidence,
        notes: this.nullableText(body.notes) ?? before.notes,
      },
    });
    if (missed.length) await this.createOperationalWorkItem(me, 'SecurityRoundExecution', saved.id, 'ROUND_MISSED_CHECKPOINTS', `Ronda com ${missed.length} ponto(s) nao visitado(s)`, 'HIGH');
    await this.audit(me, 'ROUND_FINISH', 'SecurityRoundExecution', saved.id, saved.routeId, before, saved);
    return saved;
  }

  async listShiftHandovers(me: AuthPayload, q: Query = {}) {
    return this.db.securityShiftHandover.findMany({
      where: { companyId: me.companyId, deletedAt: null, ...(q.status ? { status: q.status } : {}), ...(q.gateId ? { gateId: q.gateId } : {}), ...(q.postId ? { postId: q.postId } : {}) },
      orderBy: { startedAt: 'desc' },
      take: this.take(q.take),
    });
  }

  async createShiftHandover(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const saved = await this.db.securityShiftHandover.create({ data: await this.shiftHandoverData(me, body) });
    await this.audit(me, 'CREATE', 'SecurityShiftHandover', saved.id, saved.shiftName, null, saved);
    return saved;
  }

  async updateShiftHandover(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityShiftHandover', me.companyId, id, 'Troca de turno nao encontrada');
    const saved = await this.db.securityShiftHandover.update({ where: { id }, data: await this.shiftHandoverPatch(me, body) });
    await this.audit(me, 'UPDATE', 'SecurityShiftHandover', saved.id, saved.shiftName, before, saved);
    return saved;
  }

  async completeShiftHandover(me: AuthPayload, id: string, body: JsonMap) {
    await this.assertPackageWrite(me);
    const before = await this.loadTenant('securityShiftHandover', me.companyId, id, 'Troca de turno nao encontrada');
    const hasPending = Boolean(Array.isArray(body.pendingItems) ? body.pendingItems.length : body.pendingItems);
    const saved = await this.db.securityShiftHandover.update({
      where: { id },
      data: {
        status: hasPending ? 'COMPLETED_WITH_PENDING' : 'COMPLETED',
        finishedAt: new Date(),
        acceptedAt: new Date(),
        acceptedById: this.id(body.acceptedById) || me.sub,
        pendingItems: this.json(body.pendingItems) ?? before.pendingItems,
        summary: this.nullableText(body.summary) ?? before.summary,
        evidence: this.json(body.evidence) ?? before.evidence,
      },
    });
    if (hasPending) await this.createOperationalWorkItem(me, 'SecurityShiftHandover', saved.id, 'HANDOVER_PENDING', 'Troca de turno concluida com pendencias', 'MEDIUM');
    await this.audit(me, 'COMPLETE', 'SecurityShiftHandover', saved.id, saved.shiftName, before, saved);
    return saved;
  }

  async listLogbook(me: AuthPayload, q: Query = {}) {
    return this.db.securityLogBookEntry.findMany({
      where: { companyId: me.companyId, deletedAt: null, ...(q.status ? { status: q.status } : {}), ...(q.gateId ? { gateId: q.gateId } : {}), ...(q.postId ? { postId: q.postId } : {}) },
      orderBy: { occurredAt: 'desc' },
      take: this.take(q.take, 200),
    });
  }

  async createLogbookEntry(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const saved = await this.db.securityLogBookEntry.create({ data: await this.logbookData(me, body) });
    await this.audit(me, 'CREATE', 'SecurityLogBookEntry', saved.id, saved.title, null, saved);
    return saved;
  }

  async createQr(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const token = this.text(body.token) || this.token('qr');
    return this.createQrInternal(me, this.requiredText(body.entityType, 'Entidade'), this.requiredText(body.entityId, 'Identificador'), this.requiredText(body.purpose, 'Finalidade'), token, this.date(body.expiresAt), this.json(body.metadata));
  }

  async validateQr(me: AuthPayload, token: string) {
    const qr = await this.db.securityQrCode.findFirst({ where: { companyId: me.companyId, token, deletedAt: null } });
    if (!qr) throw new NotFoundException('QR Code nao encontrado.');
    if (qr.status !== 'ACTIVE') return { valid: false, reason: qr.status, qr };
    if (qr.expiresAt && new Date(qr.expiresAt).getTime() < Date.now()) return { valid: false, reason: 'EXPIRED', qr };
    return { valid: true, qr };
  }

  async listOfflineSyncs(me: AuthPayload, q: Query = {}) {
    return this.db.securityOfflineSync.findMany({
      where: { companyId: me.companyId, ...(q.status ? { status: q.status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: this.take(q.take, 200),
    });
  }

  async syncOffline(me: AuthPayload, body: JsonMap) {
    await this.assertPackageWrite(me);
    const records = Array.isArray(body.records) ? body.records : [];
    if (!records.length) throw new BadRequestException('Informe registros offline para sincronizar.');
    const results: Array<{ localId: string; status: string; entityId?: string | null; error?: string }> = [];
    for (const record of records) {
      const item = record as JsonMap;
      const localId = this.requiredText(item.localId, 'localId');
      const existing = await this.db.securityOfflineSync.findFirst({ where: { companyId: me.companyId, localId } });
      if (existing?.status === 'SYNCED') {
        results.push({ localId, status: 'DUPLICATE', entityId: existing.entityId });
        continue;
      }
      const sync = existing ?? await this.db.securityOfflineSync.create({
        data: {
          companyId: me.companyId,
          localId,
          entityType: this.requiredText(item.entityType, 'entityType'),
          operation: this.requiredText(item.operation, 'operation'),
          payload: this.json(item.payload) ?? {},
          localCreatedAt: this.date(item.localCreatedAt),
          deviceId: this.nullableText(item.deviceId),
          deviceInfo: this.json(item.deviceInfo),
          createdById: me.sub,
        },
      });
      try {
        const entityId = await this.applyOfflineRecord(me, sync, item);
        await this.db.securityOfflineSync.update({ where: { id: sync.id }, data: { entityId, status: 'SYNCED', syncedAt: new Date(), errorMessage: null, conflictReason: null } });
        results.push({ localId, status: 'SYNCED', entityId });
      } catch (err) {
        const message = (err as Error).message;
        await this.db.securityOfflineSync.update({ where: { id: sync.id }, data: { status: message.includes('duplic') ? 'CONFLICT' : 'ERROR', errorMessage: message } });
        results.push({ localId, status: 'ERROR', error: message });
      }
    }
    return { total: records.length, results };
  }

  async assistantInsights(me: AuthPayload, q: Query = {}) {
    const [summary, incidents, pendingExits, lateRounds, invalidDocs] = await Promise.all([
      this.summary(me, q),
      this.db.securityIncident.findMany({ where: { companyId: me.companyId, deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_ACTION'] } }, orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }], take: 10 }),
      this.pendingExits(me, { ...q, take: '20' }),
      this.db.securityRoundExecution.findMany({ where: { companyId: me.companyId, deletedAt: null, status: { in: ['LATE', 'MISSED'] } }, take: 10, orderBy: { scheduledAt: 'asc' } }),
      this.db.securityPerson.findMany({ where: { companyId: me.companyId, deletedAt: null, documentStatus: { in: ['EXPIRED', 'MISSING', 'REJECTED', 'BLOCKED'] } }, take: 10, orderBy: { updatedAt: 'desc' } }),
    ]);
    const insights: Array<{ severity: string; title: string; description: string; recommendation: string; humanDecisionRequired: boolean }> = [];
    if (summary.criticalIncidents > 0) {
      insights.push({ severity: 'CRITICAL', title: 'Ocorrencias criticas abertas', description: `${summary.criticalIncidents} ocorrencia(s) criticas/emergenciais aguardam tratativa.`, recommendation: 'Priorizar responsavel, evidencias e plano de acao. A IA nao encerra nem reclassifica ocorrencias automaticamente.', humanDecisionRequired: true });
    }
    if (summary.overduePresence > 0) {
      insights.push({ severity: 'HIGH', title: 'Permanencia excedida', description: `${summary.overduePresence} pessoa(s) ou veiculo(s) ultrapassaram a previsao de saida.`, recommendation: 'Acionar responsavel interno, confirmar localizacao e registrar saida ou excecao formal.', humanDecisionRequired: true });
    }
    if (lateRounds.length > 0) {
      insights.push({ severity: 'HIGH', title: 'Rondas atrasadas ou incompletas', description: `${lateRounds.length} ronda(s) recentes estao atrasadas ou com ponto nao visitado.`, recommendation: 'Verificar posto/escala, registrar justificativa e abrir plano se houver recorrencia.', humanDecisionRequired: true });
    }
    if (invalidDocs.length > 0) {
      insights.push({ severity: 'MEDIUM', title: 'Documentos pendentes', description: `${invalidDocs.length} cadastro(s) amostrados possuem documentos vencidos, ausentes ou reprovados.`, recommendation: 'Bloquear acesso conforme regra parametrizada ou solicitar regularizacao antes da proxima entrada.', humanDecisionRequired: true });
    }
    if (pendingExits.length > 0) {
      insights.push({ severity: 'MEDIUM', title: 'Saidas pendentes', description: `${pendingExits.length} registro(s) precisam de conciliacao de saida.`, recommendation: 'Conciliar com livro eletronico, chaves/crachas e responsavel interno.', humanDecisionRequired: true });
    }
    if (insights.length === 0) {
      insights.push({ severity: 'LOW', title: 'Operacao sem sinais criticos', description: 'Os indicadores operacionais nao apontam acumulacao critica neste momento.', recommendation: 'Manter rondas, checklists e conciliacao de saida por turno.', humanDecisionRequired: false });
    }
    return { generatedAt: new Date().toISOString(), summary, insights, samples: { incidents, pendingExits, lateRounds, invalidDocs } };
  }

  async exportData(me: AuthPayload, dataset: string, q: Query = {}) {
    if (dataset === 'present') {
      const rows = await this.present(me, q);
      return this.csv('asset-security-presentes.csv', ['codigo', 'pessoa', 'placa', 'portaria', 'entrada', 'saida_prevista', 'status'], rows.map((r: any) => [r.code, r.person?.name, r.plate || r.vehicle?.plate, r.gate?.name, r.entryAt, r.expectedExitAt, r.status]));
    }
    if (dataset === 'incidents') {
      const rows = await this.listIncidents(me, q);
      return this.csv('asset-security-ocorrencias.csv', ['codigo', 'titulo', 'tipo', 'criticidade', 'status', 'abertura'], rows.map((r: any) => [r.code, r.title, r.type, r.severity, r.status, r.createdAt]));
    }
    if (dataset === 'rounds') {
      const rows = await this.listRoundExecutions(me, q);
      return this.csv('asset-security-rondas.csv', ['rota', 'posto', 'status', 'agendada', 'inicio', 'fim', 'pontos_visitados', 'pontos_pendentes'], rows.map((r: any) => [r.routeId, r.postId, r.status, r.scheduledAt, r.startedAt, r.finishedAt, (r.visitedCheckpointIds ?? []).length, (r.missedCheckpointIds ?? []).length]));
    }
    const rows = await this.listMovements(me, q);
    return this.csv('asset-security-movimentacoes.csv', ['codigo', 'tipo', 'categoria', 'pessoa', 'placa', 'entrada', 'saida', 'status'], rows.map((r: any) => [r.code, r.movementType, r.category, r.person?.name, r.plate || r.vehicle?.plate, r.entryAt, r.exitAt, r.status]));
  }

  async listAuditLogs(me: AuthPayload, q: Query = {}) {
    return this.db.securityAuditLog.findMany({
      where: {
        companyId: me.companyId,
        ...(q.entity ? { entity: q.entity } : {}),
        ...(q.entityId ? { entityId: q.entityId } : {}),
        ...(q.action ? { action: q.action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: this.take(q.take, 200),
    });
  }

  private gateData(me: AuthPayload, body: JsonMap, unitId: string | null) {
    return {
      companyId: me.companyId,
      branchId: this.id(body.branchId),
      unitId,
      code: this.nullableText(body.code),
      name: this.requiredText(body.name, 'Nome da portaria'),
      address: this.nullableText(body.address),
      location: this.nullableText(body.location),
      type: this.text(body.type) || 'Portaria Principal',
      workingHours: this.json(body.workingHours),
      shifts: this.json(body.shifts),
      responsibleUserIds: this.stringArray(body.responsibleUserIds),
      supervisorUserIds: this.stringArray(body.supervisorUserIds),
      allowedAccessTypes: this.stringArray(body.allowedAccessTypes),
      flowCapabilities: this.stringArray(body.flowCapabilities),
      authorizedAreaIds: this.stringArray(body.authorizedAreaIds),
      rules: this.json(body.rules),
      requiredDocumentIds: this.stringArray(body.requiredDocumentIds),
      checklistTemplateIds: this.stringArray(body.checklistTemplateIds),
      contacts: this.json(body.contacts),
      notes: this.nullableText(body.notes),
      status: this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE'),
      activatedAt: this.date(body.activatedAt),
      createdById: me.sub,
      updatedById: me.sub,
    };
  }

  private gatePatch(body: JsonMap, unitId: string | null) {
    return this.clean({
      branchId: 'branchId' in body ? this.id(body.branchId) : undefined,
      unitId: 'unitId' in body ? unitId : undefined,
      code: 'code' in body ? this.nullableText(body.code) : undefined,
      name: 'name' in body ? this.requiredText(body.name, 'Nome da portaria') : undefined,
      address: 'address' in body ? this.nullableText(body.address) : undefined,
      location: 'location' in body ? this.nullableText(body.location) : undefined,
      type: 'type' in body ? (this.text(body.type) || 'Portaria Principal') : undefined,
      workingHours: 'workingHours' in body ? this.json(body.workingHours) : undefined,
      shifts: 'shifts' in body ? this.json(body.shifts) : undefined,
      responsibleUserIds: 'responsibleUserIds' in body ? this.stringArray(body.responsibleUserIds) : undefined,
      supervisorUserIds: 'supervisorUserIds' in body ? this.stringArray(body.supervisorUserIds) : undefined,
      allowedAccessTypes: 'allowedAccessTypes' in body ? this.stringArray(body.allowedAccessTypes) : undefined,
      flowCapabilities: 'flowCapabilities' in body ? this.stringArray(body.flowCapabilities) : undefined,
      authorizedAreaIds: 'authorizedAreaIds' in body ? this.stringArray(body.authorizedAreaIds) : undefined,
      rules: 'rules' in body ? this.json(body.rules) : undefined,
      requiredDocumentIds: 'requiredDocumentIds' in body ? this.stringArray(body.requiredDocumentIds) : undefined,
      checklistTemplateIds: 'checklistTemplateIds' in body ? this.stringArray(body.checklistTemplateIds) : undefined,
      contacts: 'contacts' in body ? this.json(body.contacts) : undefined,
      notes: 'notes' in body ? this.nullableText(body.notes) : undefined,
      status: 'status' in body ? this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE') : undefined,
      activatedAt: 'activatedAt' in body ? this.date(body.activatedAt) : undefined,
    });
  }

  private postData(me: AuthPayload, body: JsonMap, unitId: string | null, gateId: string | null) {
    return {
      companyId: me.companyId,
      unitId,
      gateId,
      code: this.nullableText(body.code),
      name: this.requiredText(body.name, 'Nome do posto'),
      location: this.nullableText(body.location),
      type: this.nullableText(body.type),
      schedule: this.nullableText(body.schedule),
      criticality: this.text(body.criticality) || 'MEDIUM',
      responsibleUserId: this.id(body.responsibleUserId),
      equipmentRequired: this.stringArray(body.equipmentRequired),
      radio: this.nullableText(body.radio),
      phone: this.nullableText(body.phone),
      qrCodeToken: this.nullableText(body.qrCodeToken) ?? this.token('post'),
      checklistTemplateId: this.id(body.checklistTemplateId),
      instructions: this.nullableText(body.instructions),
      emergencyContacts: this.json(body.emergencyContacts),
      notes: this.nullableText(body.notes),
      status: this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE'),
      createdById: me.sub,
      updatedById: me.sub,
    };
  }

  private postPatch(body: JsonMap, unitId: string | null, gateId: string | null) {
    return this.clean({
      unitId: 'unitId' in body ? unitId : undefined,
      gateId: 'gateId' in body ? gateId : undefined,
      code: 'code' in body ? this.nullableText(body.code) : undefined,
      name: 'name' in body ? this.requiredText(body.name, 'Nome do posto') : undefined,
      location: 'location' in body ? this.nullableText(body.location) : undefined,
      type: 'type' in body ? this.nullableText(body.type) : undefined,
      schedule: 'schedule' in body ? this.nullableText(body.schedule) : undefined,
      criticality: 'criticality' in body ? (this.text(body.criticality) || 'MEDIUM') : undefined,
      responsibleUserId: 'responsibleUserId' in body ? this.id(body.responsibleUserId) : undefined,
      equipmentRequired: 'equipmentRequired' in body ? this.stringArray(body.equipmentRequired) : undefined,
      radio: 'radio' in body ? this.nullableText(body.radio) : undefined,
      phone: 'phone' in body ? this.nullableText(body.phone) : undefined,
      checklistTemplateId: 'checklistTemplateId' in body ? this.id(body.checklistTemplateId) : undefined,
      instructions: 'instructions' in body ? this.nullableText(body.instructions) : undefined,
      emergencyContacts: 'emergencyContacts' in body ? this.json(body.emergencyContacts) : undefined,
      notes: 'notes' in body ? this.nullableText(body.notes) : undefined,
      status: 'status' in body ? this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE') : undefined,
    });
  }

  private personData(me: AuthPayload, body: JsonMap) {
    const documentNumber = this.onlyDigits(this.text(body.documentNumber));
    return {
      companyId: me.companyId,
      type: this.enumValue(body.type, PERSON_TYPES, 'VISITOR'),
      code: this.nullableText(body.code),
      name: this.requiredText(body.name, 'Nome'),
      socialName: this.nullableText(body.socialName),
      documentType: this.nullableText(body.documentType),
      documentNumber: documentNumber || null,
      documentMasked: this.maskDocument(documentNumber),
      birthDate: this.date(body.birthDate),
      contractorCompanyId: this.id(body.contractorCompanyId),
      originCompanyName: this.nullableText(body.originCompanyName),
      jobTitle: this.nullableText(body.jobTitle),
      phone: this.nullableText(body.phone),
      email: this.nullableText(body.email),
      photoUrl: this.nullableText(body.photoUrl),
      notes: this.nullableText(body.notes),
      vehicleIds: this.stringArray(body.vehicleIds),
      documentIds: this.stringArray(body.documentIds),
      documentStatus: this.enumValue(body.documentStatus, DOCUMENT_STATUSES, 'NOT_REQUIRED'),
      documentValidUntil: this.date(body.documentValidUntil),
      restrictions: this.json(body.restrictions),
      status: this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE'),
      lgpdConsentAt: this.date(body.lgpdConsentAt),
      createdById: me.sub,
      updatedById: me.sub,
    };
  }

  private personPatch(body: JsonMap) {
    const documentNumber = 'documentNumber' in body ? this.onlyDigits(this.text(body.documentNumber)) : undefined;
    return this.clean({
      type: 'type' in body ? this.enumValue(body.type, PERSON_TYPES, 'VISITOR') : undefined,
      code: 'code' in body ? this.nullableText(body.code) : undefined,
      name: 'name' in body ? this.requiredText(body.name, 'Nome') : undefined,
      socialName: 'socialName' in body ? this.nullableText(body.socialName) : undefined,
      documentType: 'documentType' in body ? this.nullableText(body.documentType) : undefined,
      documentNumber: documentNumber === undefined ? undefined : (documentNumber || null),
      documentMasked: documentNumber === undefined ? undefined : this.maskDocument(documentNumber),
      birthDate: 'birthDate' in body ? this.date(body.birthDate) : undefined,
      contractorCompanyId: 'contractorCompanyId' in body ? this.id(body.contractorCompanyId) : undefined,
      originCompanyName: 'originCompanyName' in body ? this.nullableText(body.originCompanyName) : undefined,
      jobTitle: 'jobTitle' in body ? this.nullableText(body.jobTitle) : undefined,
      phone: 'phone' in body ? this.nullableText(body.phone) : undefined,
      email: 'email' in body ? this.nullableText(body.email) : undefined,
      photoUrl: 'photoUrl' in body ? this.nullableText(body.photoUrl) : undefined,
      notes: 'notes' in body ? this.nullableText(body.notes) : undefined,
      vehicleIds: 'vehicleIds' in body ? this.stringArray(body.vehicleIds) : undefined,
      documentIds: 'documentIds' in body ? this.stringArray(body.documentIds) : undefined,
      documentStatus: 'documentStatus' in body ? this.enumValue(body.documentStatus, DOCUMENT_STATUSES, 'NOT_REQUIRED') : undefined,
      documentValidUntil: 'documentValidUntil' in body ? this.date(body.documentValidUntil) : undefined,
      restrictions: 'restrictions' in body ? this.json(body.restrictions) : undefined,
      status: 'status' in body ? this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE') : undefined,
      lgpdConsentAt: 'lgpdConsentAt' in body ? this.date(body.lgpdConsentAt) : undefined,
    });
  }

  private contractorCompanyData(me: AuthPayload, body: JsonMap) {
    return {
      companyId: me.companyId,
      legalName: this.requiredText(body.legalName, 'Razao social'),
      tradeName: this.nullableText(body.tradeName),
      cnpj: this.onlyDigits(this.text(body.cnpj)) || null,
      contractCode: this.nullableText(body.contractCode),
      managerUserId: this.id(body.managerUserId),
      unitIds: this.stringArray(body.unitIds),
      serviceTypes: this.stringArray(body.serviceTypes),
      requiredDocuments: this.json(body.requiredDocuments),
      deliveredDocuments: this.json(body.deliveredDocuments),
      documentStatus: this.enumValue(body.documentStatus, DOCUMENT_STATUSES, 'MISSING'),
      alertDaysBefore: this.int(body.alertDaysBefore) ?? 30,
      blockReason: this.nullableText(body.blockReason),
      notes: this.nullableText(body.notes),
      status: this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE'),
      createdById: me.sub,
      updatedById: me.sub,
    };
  }

  private contractorCompanyPatch(body: JsonMap) {
    return this.clean({
      legalName: 'legalName' in body ? this.requiredText(body.legalName, 'Razao social') : undefined,
      tradeName: 'tradeName' in body ? this.nullableText(body.tradeName) : undefined,
      cnpj: 'cnpj' in body ? (this.onlyDigits(this.text(body.cnpj)) || null) : undefined,
      contractCode: 'contractCode' in body ? this.nullableText(body.contractCode) : undefined,
      managerUserId: 'managerUserId' in body ? this.id(body.managerUserId) : undefined,
      unitIds: 'unitIds' in body ? this.stringArray(body.unitIds) : undefined,
      serviceTypes: 'serviceTypes' in body ? this.stringArray(body.serviceTypes) : undefined,
      requiredDocuments: 'requiredDocuments' in body ? this.json(body.requiredDocuments) : undefined,
      deliveredDocuments: 'deliveredDocuments' in body ? this.json(body.deliveredDocuments) : undefined,
      documentStatus: 'documentStatus' in body ? this.enumValue(body.documentStatus, DOCUMENT_STATUSES, 'MISSING') : undefined,
      alertDaysBefore: 'alertDaysBefore' in body ? (this.int(body.alertDaysBefore) ?? 30) : undefined,
      blockReason: 'blockReason' in body ? this.nullableText(body.blockReason) : undefined,
      notes: 'notes' in body ? this.nullableText(body.notes) : undefined,
      status: 'status' in body ? this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE') : undefined,
    });
  }

  private vehicleData(me: AuthPayload, body: JsonMap) {
    return {
      companyId: me.companyId,
      type: this.text(body.type) || 'Carro',
      plate: this.normalizePlate(this.requiredText(body.plate, 'Placa')),
      model: this.nullableText(body.model),
      brand: this.nullableText(body.brand),
      color: this.nullableText(body.color),
      year: this.int(body.year),
      companyName: this.nullableText(body.companyName),
      ownerName: this.nullableText(body.ownerName),
      defaultDriverPersonId: this.id(body.defaultDriverPersonId),
      documentStatus: this.enumValue(body.documentStatus, DOCUMENT_STATUSES, 'NOT_REQUIRED'),
      documentValidUntil: this.date(body.documentValidUntil),
      notes: this.nullableText(body.notes),
      blockReason: this.nullableText(body.blockReason),
      status: this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE'),
      createdById: me.sub,
      updatedById: me.sub,
    };
  }

  private vehiclePatch(body: JsonMap) {
    return this.clean({
      type: 'type' in body ? (this.text(body.type) || 'Carro') : undefined,
      plate: 'plate' in body ? this.normalizePlate(this.requiredText(body.plate, 'Placa')) : undefined,
      model: 'model' in body ? this.nullableText(body.model) : undefined,
      brand: 'brand' in body ? this.nullableText(body.brand) : undefined,
      color: 'color' in body ? this.nullableText(body.color) : undefined,
      year: 'year' in body ? this.int(body.year) : undefined,
      companyName: 'companyName' in body ? this.nullableText(body.companyName) : undefined,
      ownerName: 'ownerName' in body ? this.nullableText(body.ownerName) : undefined,
      defaultDriverPersonId: 'defaultDriverPersonId' in body ? this.id(body.defaultDriverPersonId) : undefined,
      documentStatus: 'documentStatus' in body ? this.enumValue(body.documentStatus, DOCUMENT_STATUSES, 'NOT_REQUIRED') : undefined,
      documentValidUntil: 'documentValidUntil' in body ? this.date(body.documentValidUntil) : undefined,
      notes: 'notes' in body ? this.nullableText(body.notes) : undefined,
      blockReason: 'blockReason' in body ? this.nullableText(body.blockReason) : undefined,
      status: 'status' in body ? this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE') : undefined,
    });
  }

  private documentRequirementData(me: AuthPayload, body: JsonMap) {
    return {
      companyId: me.companyId,
      scopeType: this.requiredText(body.scopeType, 'Escopo'),
      scopeId: this.id(body.scopeId),
      personType: body.personType ? this.enumValue(body.personType, PERSON_TYPES, 'VISITOR') : null,
      vehicleType: this.nullableText(body.vehicleType),
      serviceType: this.nullableText(body.serviceType),
      cargoType: this.nullableText(body.cargoType),
      criticality: this.nullableText(body.criticality),
      name: this.requiredText(body.name, 'Nome do documento'),
      documentKind: this.requiredText(body.documentKind, 'Tipo de documento'),
      required: body.required === undefined ? true : Boolean(body.required),
      blockOnMissing: Boolean(body.blockOnMissing),
      warningDays: this.int(body.warningDays) ?? 30,
      rules: this.json(body.rules),
      status: this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE'),
      createdById: me.sub,
      updatedById: me.sub,
    };
  }

  private documentRequirementPatch(body: JsonMap) {
    return this.clean({
      scopeType: 'scopeType' in body ? this.requiredText(body.scopeType, 'Escopo') : undefined,
      scopeId: 'scopeId' in body ? this.id(body.scopeId) : undefined,
      personType: 'personType' in body ? (body.personType ? this.enumValue(body.personType, PERSON_TYPES, 'VISITOR') : null) : undefined,
      vehicleType: 'vehicleType' in body ? this.nullableText(body.vehicleType) : undefined,
      serviceType: 'serviceType' in body ? this.nullableText(body.serviceType) : undefined,
      cargoType: 'cargoType' in body ? this.nullableText(body.cargoType) : undefined,
      criticality: 'criticality' in body ? this.nullableText(body.criticality) : undefined,
      name: 'name' in body ? this.requiredText(body.name, 'Nome do documento') : undefined,
      documentKind: 'documentKind' in body ? this.requiredText(body.documentKind, 'Tipo de documento') : undefined,
      required: 'required' in body ? Boolean(body.required) : undefined,
      blockOnMissing: 'blockOnMissing' in body ? Boolean(body.blockOnMissing) : undefined,
      warningDays: 'warningDays' in body ? (this.int(body.warningDays) ?? 30) : undefined,
      rules: 'rules' in body ? this.json(body.rules) : undefined,
      status: 'status' in body ? this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE') : undefined,
    });
  }

  private async authorizationPatch(me: AuthPayload, body: JsonMap) {
    return this.clean({
      personId: 'personId' in body ? await this.validatePersonId(me.companyId, this.id(body.personId)) : undefined,
      contractorCompanyId: 'contractorCompanyId' in body ? await this.validateContractorCompanyId(me.companyId, this.id(body.contractorCompanyId)) : undefined,
      unitId: 'unitId' in body ? await this.validateOrgNode(me.companyId, this.id(body.unitId)) : undefined,
      gateId: 'gateId' in body ? await this.validateGate(me.companyId, this.id(body.gateId)) : undefined,
      requestedById: 'requestedById' in body ? this.id(body.requestedById) : undefined,
      internalResponsibleId: 'internalResponsibleId' in body ? this.id(body.internalResponsibleId) : undefined,
      vehicleId: 'vehicleId' in body ? await this.validateVehicleId(me.companyId, this.id(body.vehicleId)) : undefined,
      approverId: 'approverId' in body ? this.id(body.approverId) : undefined,
      status: 'status' in body ? this.enumValue(body.status, AUTH_STATUSES, 'REQUESTED') : undefined,
      reason: 'reason' in body ? this.nullableText(body.reason) : undefined,
      destinationAreaId: 'destinationAreaId' in body ? await this.validateOrgNode(me.companyId, this.id(body.destinationAreaId)) : undefined,
      scheduledStartAt: 'scheduledStartAt' in body ? this.date(body.scheduledStartAt) : undefined,
      scheduledEndAt: 'scheduledEndAt' in body ? this.date(body.scheduledEndAt) : undefined,
      maxStayMinutes: 'maxStayMinutes' in body ? this.int(body.maxStayMinutes) : undefined,
      allowedPeriodText: 'allowedPeriodText' in body ? this.nullableText(body.allowedPeriodText) : undefined,
      passengerPersonIds: 'passengerPersonIds' in body ? this.stringArray(body.passengerPersonIds) : undefined,
      materialRefs: 'materialRefs' in body ? this.json(body.materialRefs) : undefined,
      documentRefs: 'documentRefs' in body ? this.json(body.documentRefs) : undefined,
      attachments: 'attachments' in body ? this.json(body.attachments) : undefined,
      qrExpiresAt: 'qrExpiresAt' in body ? this.date(body.qrExpiresAt) : undefined,
      cancelReason: 'cancelReason' in body ? this.nullableText(body.cancelReason) : undefined,
      notes: 'notes' in body ? this.nullableText(body.notes) : undefined,
      updatedById: me.sub,
    });
  }

  private async materialData(me: AuthPayload, body: JsonMap) {
    return {
      companyId: me.companyId,
      movementId: this.id(body.movementId),
      authorizationId: this.id(body.authorizationId),
      vehicleId: await this.validateVehicleId(me.companyId, this.id(body.vehicleId)),
      driverPersonId: await this.validatePersonId(me.companyId, this.id(body.driverPersonId)),
      responsibleUserId: this.id(body.responsibleUserId),
      type: this.enumValue(body.type, MOVEMENT_TYPES, 'MATERIAL_ENTRY'),
      code: this.nullableText(body.code),
      description: this.requiredText(body.description, 'Descricao'),
      quantity: this.float(body.quantity),
      unit: this.nullableText(body.unit),
      origin: this.nullableText(body.origin),
      destination: this.nullableText(body.destination),
      supplierName: this.nullableText(body.supplierName),
      carrierName: this.nullableText(body.carrierName),
      fiscalDocument: this.nullableText(body.fiscalDocument),
      purchaseOrder: this.nullableText(body.purchaseOrder),
      workOrder: this.nullableText(body.workOrder),
      photos: this.json(body.photos),
      documents: this.json(body.documents),
      alertCode: this.nullableText(body.alertCode),
      status: this.enumValue(body.status, MOVEMENT_STATUSES, 'PENDING'),
      notes: this.nullableText(body.notes),
      occurredAt: this.date(body.occurredAt) || new Date(),
      createdById: me.sub,
      updatedById: me.sub,
    };
  }

  private async materialPatch(me: AuthPayload, body: JsonMap) {
    return this.clean({
      movementId: 'movementId' in body ? this.id(body.movementId) : undefined,
      authorizationId: 'authorizationId' in body ? this.id(body.authorizationId) : undefined,
      vehicleId: 'vehicleId' in body ? await this.validateVehicleId(me.companyId, this.id(body.vehicleId)) : undefined,
      driverPersonId: 'driverPersonId' in body ? await this.validatePersonId(me.companyId, this.id(body.driverPersonId)) : undefined,
      responsibleUserId: 'responsibleUserId' in body ? this.id(body.responsibleUserId) : undefined,
      type: 'type' in body ? this.enumValue(body.type, MOVEMENT_TYPES, 'MATERIAL_ENTRY') : undefined,
      code: 'code' in body ? this.nullableText(body.code) : undefined,
      description: 'description' in body ? this.requiredText(body.description, 'Descricao') : undefined,
      quantity: 'quantity' in body ? this.float(body.quantity) : undefined,
      unit: 'unit' in body ? this.nullableText(body.unit) : undefined,
      origin: 'origin' in body ? this.nullableText(body.origin) : undefined,
      destination: 'destination' in body ? this.nullableText(body.destination) : undefined,
      supplierName: 'supplierName' in body ? this.nullableText(body.supplierName) : undefined,
      carrierName: 'carrierName' in body ? this.nullableText(body.carrierName) : undefined,
      fiscalDocument: 'fiscalDocument' in body ? this.nullableText(body.fiscalDocument) : undefined,
      purchaseOrder: 'purchaseOrder' in body ? this.nullableText(body.purchaseOrder) : undefined,
      workOrder: 'workOrder' in body ? this.nullableText(body.workOrder) : undefined,
      photos: 'photos' in body ? this.json(body.photos) : undefined,
      documents: 'documents' in body ? this.json(body.documents) : undefined,
      alertCode: 'alertCode' in body ? this.nullableText(body.alertCode) : undefined,
      status: 'status' in body ? this.enumValue(body.status, MOVEMENT_STATUSES, 'PENDING') : undefined,
      notes: 'notes' in body ? this.nullableText(body.notes) : undefined,
      occurredAt: 'occurredAt' in body ? this.date(body.occurredAt) : undefined,
      updatedById: me.sub,
    });
  }

  private async custodyData(me: AuthPayload, body: JsonMap) {
    return {
      companyId: me.companyId,
      unitId: await this.validateOrgNode(me.companyId, this.id(body.unitId)),
      gateId: await this.validateGate(me.companyId, this.id(body.gateId)),
      itemType: this.enumValue(body.itemType, CUSTODY_TYPES, 'KEY'),
      code: this.requiredText(body.code, 'Codigo'),
      description: this.requiredText(body.description, 'Descricao'),
      location: this.nullableText(body.location),
      responsibleUserId: this.id(body.responsibleUserId),
      purpose: this.nullableText(body.purpose),
      notes: this.nullableText(body.notes),
      status: this.enumValue(body.status, CUSTODY_STATUSES, 'AVAILABLE'),
      createdById: me.sub,
      updatedById: me.sub,
    };
  }

  private async custodyPatch(me: AuthPayload, body: JsonMap) {
    return this.clean({
      unitId: 'unitId' in body ? await this.validateOrgNode(me.companyId, this.id(body.unitId)) : undefined,
      gateId: 'gateId' in body ? await this.validateGate(me.companyId, this.id(body.gateId)) : undefined,
      itemType: 'itemType' in body ? this.enumValue(body.itemType, CUSTODY_TYPES, 'KEY') : undefined,
      code: 'code' in body ? this.requiredText(body.code, 'Codigo') : undefined,
      description: 'description' in body ? this.requiredText(body.description, 'Descricao') : undefined,
      location: 'location' in body ? this.nullableText(body.location) : undefined,
      responsibleUserId: 'responsibleUserId' in body ? this.id(body.responsibleUserId) : undefined,
      notes: 'notes' in body ? this.nullableText(body.notes) : undefined,
      status: 'status' in body ? this.enumValue(body.status, CUSTODY_STATUSES, 'AVAILABLE') : undefined,
      updatedById: me.sub,
    });
  }

  private async correspondenceData(me: AuthPayload, body: JsonMap) {
    return {
      companyId: me.companyId,
      unitId: await this.validateOrgNode(me.companyId, this.id(body.unitId)),
      gateId: await this.validateGate(me.companyId, this.id(body.gateId)),
      sender: this.nullableText(body.sender),
      recipient: this.requiredText(body.recipient, 'Destinatario'),
      recipientUserId: this.id(body.recipientUserId),
      carrierName: this.nullableText(body.carrierName),
      trackingCode: this.nullableText(body.trackingCode),
      type: this.nullableText(body.type),
      receivedById: me.sub,
      receivedAt: this.date(body.receivedAt) || new Date(),
      acknowledgement: this.nullableText(body.acknowledgement),
      evidence: this.json(body.evidence),
      photoUrl: this.nullableText(body.photoUrl),
      notes: this.nullableText(body.notes),
      status: this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE'),
    };
  }

  private async correspondencePatch(me: AuthPayload, body: JsonMap) {
    return this.clean({
      unitId: 'unitId' in body ? await this.validateOrgNode(me.companyId, this.id(body.unitId)) : undefined,
      gateId: 'gateId' in body ? await this.validateGate(me.companyId, this.id(body.gateId)) : undefined,
      sender: 'sender' in body ? this.nullableText(body.sender) : undefined,
      recipient: 'recipient' in body ? this.requiredText(body.recipient, 'Destinatario') : undefined,
      recipientUserId: 'recipientUserId' in body ? this.id(body.recipientUserId) : undefined,
      carrierName: 'carrierName' in body ? this.nullableText(body.carrierName) : undefined,
      trackingCode: 'trackingCode' in body ? this.nullableText(body.trackingCode) : undefined,
      type: 'type' in body ? this.nullableText(body.type) : undefined,
      acknowledgement: 'acknowledgement' in body ? this.nullableText(body.acknowledgement) : undefined,
      evidence: 'evidence' in body ? this.json(body.evidence) : undefined,
      photoUrl: 'photoUrl' in body ? this.nullableText(body.photoUrl) : undefined,
      notes: 'notes' in body ? this.nullableText(body.notes) : undefined,
      status: 'status' in body ? this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE') : undefined,
    });
  }

  private blocklistData(me: AuthPayload, body: JsonMap) {
    return {
      companyId: me.companyId,
      personId: this.id(body.personId),
      vehicleId: this.id(body.vehicleId),
      documentNumber: this.onlyDigits(this.text(body.documentNumber)) || null,
      plate: this.normalizePlate(this.text(body.plate)),
      reason: this.requiredText(body.reason, 'Motivo'),
      severity: this.enumValue(body.severity, INCIDENT_SEVERITIES, 'HIGH'),
      startsAt: this.date(body.startsAt) || new Date(),
      endsAt: this.date(body.endsAt),
      approvedById: this.id(body.approvedById) || me.sub,
      evidence: this.json(body.evidence),
      notes: this.nullableText(body.notes),
      status: this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE'),
      createdById: me.sub,
      updatedById: me.sub,
    };
  }

  private blocklistPatch(body: JsonMap) {
    return this.clean({
      personId: 'personId' in body ? this.id(body.personId) : undefined,
      vehicleId: 'vehicleId' in body ? this.id(body.vehicleId) : undefined,
      documentNumber: 'documentNumber' in body ? (this.onlyDigits(this.text(body.documentNumber)) || null) : undefined,
      plate: 'plate' in body ? this.normalizePlate(this.text(body.plate)) : undefined,
      reason: 'reason' in body ? this.requiredText(body.reason, 'Motivo') : undefined,
      severity: 'severity' in body ? this.enumValue(body.severity, INCIDENT_SEVERITIES, 'HIGH') : undefined,
      startsAt: 'startsAt' in body ? this.date(body.startsAt) : undefined,
      endsAt: 'endsAt' in body ? this.date(body.endsAt) : undefined,
      approvedById: 'approvedById' in body ? this.id(body.approvedById) : undefined,
      evidence: 'evidence' in body ? this.json(body.evidence) : undefined,
      notes: 'notes' in body ? this.nullableText(body.notes) : undefined,
      status: 'status' in body ? this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE') : undefined,
    });
  }

  private async incidentData(me: AuthPayload, body: JsonMap) {
    return {
      companyId: me.companyId,
      unitId: await this.validateOrgNode(me.companyId, this.id(body.unitId)),
      gateId: await this.validateGate(me.companyId, this.id(body.gateId)),
      postId: await this.validatePost(me.companyId, this.id(body.postId)),
      movementId: this.id(body.movementId),
      roundExecutionId: this.id(body.roundExecutionId),
      actionPlanId: this.id(body.actionPlanId),
      code: this.text(body.code) || (await this.nextCode('securityIncident', me.companyId, 'OCO')),
      title: this.requiredText(body.title, 'Titulo'),
      type: this.nullableText(body.type),
      severity: this.enumValue(body.severity, INCIDENT_SEVERITIES, 'MEDIUM'),
      status: this.enumValue(body.status, INCIDENT_STATUSES, 'OPEN'),
      description: this.nullableText(body.description),
      immediateAction: this.nullableText(body.immediateAction),
      rootCauseHypothesis: this.nullableText(body.rootCauseHypothesis),
      responsibleUserId: this.id(body.responsibleUserId),
      dueAt: this.date(body.dueAt),
      evidence: this.json(body.evidence),
      aiSummary: this.nullableText(body.aiSummary),
      notes: this.nullableText(body.notes),
      createdById: me.sub,
      updatedById: me.sub,
    };
  }

  private async incidentPatch(me: AuthPayload, body: JsonMap) {
    return this.clean({
      unitId: 'unitId' in body ? await this.validateOrgNode(me.companyId, this.id(body.unitId)) : undefined,
      gateId: 'gateId' in body ? await this.validateGate(me.companyId, this.id(body.gateId)) : undefined,
      postId: 'postId' in body ? await this.validatePost(me.companyId, this.id(body.postId)) : undefined,
      title: 'title' in body ? this.requiredText(body.title, 'Titulo') : undefined,
      type: 'type' in body ? this.nullableText(body.type) : undefined,
      severity: 'severity' in body ? this.enumValue(body.severity, INCIDENT_SEVERITIES, 'MEDIUM') : undefined,
      status: 'status' in body ? this.enumValue(body.status, INCIDENT_STATUSES, 'OPEN') : undefined,
      description: 'description' in body ? this.nullableText(body.description) : undefined,
      immediateAction: 'immediateAction' in body ? this.nullableText(body.immediateAction) : undefined,
      rootCauseHypothesis: 'rootCauseHypothesis' in body ? this.nullableText(body.rootCauseHypothesis) : undefined,
      responsibleUserId: 'responsibleUserId' in body ? this.id(body.responsibleUserId) : undefined,
      dueAt: 'dueAt' in body ? this.date(body.dueAt) : undefined,
      evidence: 'evidence' in body ? this.json(body.evidence) : undefined,
      aiSummary: 'aiSummary' in body ? this.nullableText(body.aiSummary) : undefined,
      notes: 'notes' in body ? this.nullableText(body.notes) : undefined,
      updatedById: me.sub,
    });
  }

  private async roundRouteData(me: AuthPayload, body: JsonMap) {
    return {
      companyId: me.companyId,
      unitId: await this.validateOrgNode(me.companyId, this.id(body.unitId)),
      gateId: await this.validateGate(me.companyId, this.id(body.gateId)),
      code: this.nullableText(body.code),
      name: this.requiredText(body.name, 'Nome da rota'),
      description: this.nullableText(body.description),
      frequencyMinutes: this.int(body.frequencyMinutes),
      toleranceMinutes: this.int(body.toleranceMinutes) ?? 10,
      responsibleUserId: this.id(body.responsibleUserId),
      checklistTemplateId: this.id(body.checklistTemplateId),
      instructions: this.nullableText(body.instructions),
      status: this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE'),
      createdById: me.sub,
      updatedById: me.sub,
    };
  }

  private async roundRoutePatch(me: AuthPayload, body: JsonMap) {
    return this.clean({
      unitId: 'unitId' in body ? await this.validateOrgNode(me.companyId, this.id(body.unitId)) : undefined,
      gateId: 'gateId' in body ? await this.validateGate(me.companyId, this.id(body.gateId)) : undefined,
      code: 'code' in body ? this.nullableText(body.code) : undefined,
      name: 'name' in body ? this.requiredText(body.name, 'Nome da rota') : undefined,
      description: 'description' in body ? this.nullableText(body.description) : undefined,
      frequencyMinutes: 'frequencyMinutes' in body ? this.int(body.frequencyMinutes) : undefined,
      toleranceMinutes: 'toleranceMinutes' in body ? (this.int(body.toleranceMinutes) ?? 10) : undefined,
      responsibleUserId: 'responsibleUserId' in body ? this.id(body.responsibleUserId) : undefined,
      checklistTemplateId: 'checklistTemplateId' in body ? this.id(body.checklistTemplateId) : undefined,
      instructions: 'instructions' in body ? this.nullableText(body.instructions) : undefined,
      status: 'status' in body ? this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE') : undefined,
      updatedById: me.sub,
    });
  }

  private roundCheckpointData(me: AuthPayload, routeId: string, body: JsonMap, fallbackPosition?: number) {
    return {
      companyId: me.companyId,
      routeId,
      postId: this.id(body.postId),
      code: this.nullableText(body.code),
      name: this.requiredText(body.name, 'Nome do ponto'),
      location: this.nullableText(body.location),
      position: this.int(body.position) ?? fallbackPosition ?? 0,
      qrCodeToken: this.nullableText(body.qrCodeToken) ?? this.token('chk'),
      requiredEvidence: Boolean(body.requiredEvidence),
      instructions: this.nullableText(body.instructions),
      status: this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE'),
    };
  }

  private async shiftHandoverData(me: AuthPayload, body: JsonMap) {
    return {
      companyId: me.companyId,
      unitId: await this.validateOrgNode(me.companyId, this.id(body.unitId)),
      gateId: await this.validateGate(me.companyId, this.id(body.gateId)),
      postId: await this.validatePost(me.companyId, this.id(body.postId)),
      outgoingUserId: this.id(body.outgoingUserId) || me.sub,
      incomingUserId: this.id(body.incomingUserId),
      shiftName: this.nullableText(body.shiftName),
      startedAt: this.date(body.startedAt) || new Date(),
      status: this.enumValue(body.status, HANDOVER_STATUSES, 'IN_PROGRESS'),
      summary: this.nullableText(body.summary),
      pendingItems: this.json(body.pendingItems),
      checklistSubmissionId: this.id(body.checklistSubmissionId),
      evidence: this.json(body.evidence),
      notes: this.nullableText(body.notes),
    };
  }

  private async shiftHandoverPatch(me: AuthPayload, body: JsonMap) {
    return this.clean({
      unitId: 'unitId' in body ? await this.validateOrgNode(me.companyId, this.id(body.unitId)) : undefined,
      gateId: 'gateId' in body ? await this.validateGate(me.companyId, this.id(body.gateId)) : undefined,
      postId: 'postId' in body ? await this.validatePost(me.companyId, this.id(body.postId)) : undefined,
      outgoingUserId: 'outgoingUserId' in body ? this.id(body.outgoingUserId) : undefined,
      incomingUserId: 'incomingUserId' in body ? this.id(body.incomingUserId) : undefined,
      shiftName: 'shiftName' in body ? this.nullableText(body.shiftName) : undefined,
      finishedAt: 'finishedAt' in body ? this.date(body.finishedAt) : undefined,
      status: 'status' in body ? this.enumValue(body.status, HANDOVER_STATUSES, 'IN_PROGRESS') : undefined,
      summary: 'summary' in body ? this.nullableText(body.summary) : undefined,
      pendingItems: 'pendingItems' in body ? this.json(body.pendingItems) : undefined,
      checklistSubmissionId: 'checklistSubmissionId' in body ? this.id(body.checklistSubmissionId) : undefined,
      evidence: 'evidence' in body ? this.json(body.evidence) : undefined,
      notes: 'notes' in body ? this.nullableText(body.notes) : undefined,
    });
  }

  private async logbookData(me: AuthPayload, body: JsonMap) {
    return {
      companyId: me.companyId,
      unitId: await this.validateOrgNode(me.companyId, this.id(body.unitId)),
      gateId: await this.validateGate(me.companyId, this.id(body.gateId)),
      postId: await this.validatePost(me.companyId, this.id(body.postId)),
      occurredAt: this.date(body.occurredAt) || new Date(),
      title: this.requiredText(body.title, 'Titulo'),
      entryType: this.requiredText(body.entryType, 'Tipo'),
      description: this.nullableText(body.description),
      attachments: this.json(body.attachments),
      acknowledgedByIds: this.stringArray(body.acknowledgedByIds),
      status: this.enumValue(body.status, RECORD_STATUSES, 'ACTIVE'),
      createdById: me.sub,
      updatedById: me.sub,
    };
  }

  private async validateEntryRules(me: AuthPayload, input: { person: any | null; vehicle: any | null; contractor: any | null; authorization: any | null; body: JsonMap }) {
    const { person, vehicle, contractor, authorization, body } = input;
    const exceptionJustification = this.nullableText(body.exceptionJustification);
    const exceptionApprovedById = this.id(body.exceptionApprovedById);
    const hasException = Boolean(exceptionJustification && exceptionApprovedById);
    const activeBlock = await this.findActiveBlock(me.companyId, {
      personId: person?.id ?? null,
      vehicleId: vehicle?.id ?? null,
      documentNumber: person?.documentNumber ?? this.onlyDigits(this.text(body.documentNumber)),
      plate: vehicle?.plate ?? this.normalizePlate(this.text(body.plate)),
    });
    if (activeBlock && !hasException) {
      await this.audit(me, 'BLOCKED_ENTRY_ATTEMPT', 'SecurityBlocklist', activeBlock.id, activeBlock.reason, null, activeBlock, { personId: person?.id, vehicleId: vehicle?.id });
      throw new ForbiddenException(`Acesso bloqueado: ${activeBlock.reason}`);
    }
    if (authorization && !['APPROVED', 'PARTIALLY_USED'].includes(authorization.status) && !hasException) {
      throw new BadRequestException('Autorizacao nao aprovada para entrada.');
    }
    for (const row of [person, vehicle, contractor]) {
      if (!row) continue;
      if (['EXPIRED', 'MISSING', 'REJECTED', 'BLOCKED'].includes(row.documentStatus) && !hasException) {
        throw new BadRequestException(`Documentacao impede acesso (${row.documentStatus}).`);
      }
      if (row.status === 'BLOCKED' && !hasException) throw new ForbiddenException('Cadastro bloqueado para acesso.');
      if (row.status === 'INACTIVE' && !hasException) throw new ForbiddenException('Cadastro inativo para acesso.');
    }
  }

  private async resolveEntryPerson(me: AuthPayload, body: JsonMap) {
    const personId = this.id(body.personId);
    if (personId) return this.validatePerson(me.companyId, personId);

    const term = this.text(body.personSearch ?? body.personName ?? body.personCode);
    if (!term) throw new BadRequestException('Informe a pessoa da entrada por cadastro, CPF ou nome.');
    const digits = this.onlyDigits(term);
    const found = await this.db.securityPerson.findFirst({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        OR: [
          { code: term },
          ...(digits ? [{ documentNumber: digits }] : []),
          { name: { contains: term, mode: 'insensitive' } },
          { socialName: { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
    });
    if (found) return found;
    if (digits && !/[a-zA-ZÀ-ÿ]/.test(term)) {
      throw new NotFoundException('Pessoa nao encontrada. Importe o cadastro ou digite o nome completo.');
    }
    const saved = await this.db.securityPerson.create({
      data: {
        companyId: me.companyId,
        type: 'VISITOR',
        name: term,
        documentStatus: 'NOT_REQUIRED',
        status: 'ACTIVE',
        createdById: me.sub,
        updatedById: me.sub,
      },
    });
    await this.audit(me, 'CREATE_FROM_ENTRY', 'SecurityPerson', saved.id, saved.name, null, this.maskPersonForAudit(saved));
    return saved;
  }

  private sheetValue(row: JsonMap, candidates: string[]) {
    const normalized = new Map<string, unknown>();
    for (const [key, value] of Object.entries(row)) {
      normalized.set(this.sheetKey(key), value);
    }
    for (const candidate of candidates) {
      const value = normalized.get(this.sheetKey(candidate));
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
  }

  private sheetKey(value: string) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private async findOpenMovementForExit(me: AuthPayload, body: JsonMap) {
    if (body.id) {
      const byId = await this.db.securityAccessMovement.findFirst({ where: { id: this.text(body.id), companyId: me.companyId, deletedAt: null, status: 'OPEN' } });
      if (byId) return byId;
    }
    const personId = this.id(body.personId);
    const vehicleId = this.id(body.vehicleId);
    const plate = this.normalizePlate(this.text(body.plate));
    const movement = await this.db.securityAccessMovement.findFirst({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        status: 'OPEN',
        exitAt: null,
        OR: [
          ...(personId ? [{ personId }] : []),
          ...(vehicleId ? [{ vehicleId }] : []),
          ...(plate ? [{ plate }] : []),
          ...(body.code ? [{ code: this.text(body.code) }] : []),
        ],
      },
      orderBy: { entryAt: 'desc' },
    });
    if (!movement) throw new NotFoundException('Entrada aberta nao encontrada.');
    return movement;
  }

  private async applyOfflineRecord(me: AuthPayload, sync: any, item: JsonMap) {
    const entityType = this.text(item.entityType).toUpperCase();
    const payload = (item.payload && typeof item.payload === 'object' ? item.payload : {}) as JsonMap;
    if (entityType === 'MOVEMENT_ENTRY') {
      const saved = await this.registerEntry(me, { ...payload, origin: 'OFFLINE', offlineSyncId: sync.id, syncStatus: 'PENDING' });
      return saved.id;
    }
    if (entityType === 'MOVEMENT_EXIT') {
      const saved = await this.registerExit(me, payload);
      return saved.id;
    }
    if (entityType === 'INCIDENT') {
      const saved = await this.createIncident(me, { ...payload, origin: 'OFFLINE' });
      return saved.id;
    }
    if (entityType === 'ROUND_EXECUTION') {
      const saved = await this.createRoundExecution(me, { ...payload, offlineSyncId: sync.id });
      return saved.id;
    }
    throw new BadRequestException(`Tipo offline nao suportado: ${entityType}`);
  }

  private movementWhere(me: AuthPayload, q: Query) {
    const term = this.text(q.search);
    return {
      companyId: me.companyId,
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.movementType ? { movementType: q.movementType } : {}),
      ...(q.gateId ? { gateId: q.gateId } : {}),
      ...(q.unitId ? { unitId: q.unitId } : {}),
      ...(q.personId ? { personId: q.personId } : {}),
      ...(q.vehicleId ? { vehicleId: q.vehicleId } : {}),
      ...(term ? { OR: [{ code: { contains: term, mode: 'insensitive' } }, { plate: { contains: this.normalizePlate(term), mode: 'insensitive' } }, { reason: { contains: term, mode: 'insensitive' } }] } : {}),
    };
  }

  private async decorateMovements(me: AuthPayload, rows: any[]) {
    const people = await this.mapById('securityPerson', me.companyId, rows.flatMap((r) => [r.personId, r.driverPersonId]).filter(Boolean));
    const vehicles = await this.mapById('securityVehicle', me.companyId, rows.map((r) => r.vehicleId).filter(Boolean));
    const gates = await this.mapById('securityGate', me.companyId, rows.map((r) => r.gateId).filter(Boolean));
    const posts = await this.mapById('securityPost', me.companyId, rows.map((r) => r.postId).filter(Boolean));
    const contractors = await this.mapById('securityContractorCompany', me.companyId, rows.map((r) => r.contractorCompanyId).filter(Boolean));
    return rows.map((row) => ({
      ...row,
      person: row.personId ? this.maskPersonForView(people.get(row.personId)) : null,
      driver: row.driverPersonId ? this.maskPersonForView(people.get(row.driverPersonId)) : null,
      vehicle: row.vehicleId ? vehicles.get(row.vehicleId) : null,
      gate: row.gateId ? gates.get(row.gateId) : null,
      post: row.postId ? posts.get(row.postId) : null,
      contractorCompany: row.contractorCompanyId ? contractors.get(row.contractorCompanyId) : null,
      overdue: this.isMovementOverdue(row),
    }));
  }

  private async decorateOneMovement(me: AuthPayload, row: any) {
    const [decorated] = await this.decorateMovements(me, [row]);
    return decorated;
  }

  private async decorateAuthorizations(me: AuthPayload, rows: any[]) {
    const people = await this.mapById('securityPerson', me.companyId, rows.map((r) => r.personId).filter(Boolean));
    const vehicles = await this.mapById('securityVehicle', me.companyId, rows.map((r) => r.vehicleId).filter(Boolean));
    const gates = await this.mapById('securityGate', me.companyId, rows.map((r) => r.gateId).filter(Boolean));
    const contractors = await this.mapById('securityContractorCompany', me.companyId, rows.map((r) => r.contractorCompanyId).filter(Boolean));
    return rows.map((row) => ({
      ...row,
      person: row.personId ? this.maskPersonForView(people.get(row.personId)) : null,
      vehicle: row.vehicleId ? vehicles.get(row.vehicleId) : null,
      gate: row.gateId ? gates.get(row.gateId) : null,
      contractorCompany: row.contractorCompanyId ? contractors.get(row.contractorCompanyId) : null,
    }));
  }

  private async decorateOneAuthorization(me: AuthPayload, row: any) {
    const [decorated] = await this.decorateAuthorizations(me, [row]);
    return decorated;
  }

  private async mapById(model: string, companyId: string, ids: string[]) {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return new Map<string, any>();
    const rows = await this.db[model].findMany({ where: { companyId, id: { in: unique }, deletedAt: null } });
    return new Map(rows.map((row: any) => [row.id, row]));
  }

  private async loadTenant(model: string, companyId: string, id: string, message: string) {
    const row = await this.db[model].findFirst({ where: { id, companyId, deletedAt: null } });
    if (!row) throw new NotFoundException(message);
    return row;
  }

  private async validateOrgNode(companyId: string, id: string | null) {
    if (!id) return null;
    const row = await this.db.orgNode.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
    if (!row) throw new NotFoundException('Unidade/area nao encontrada');
    return row.id;
  }

  private async validateGate(companyId: string, id: string | null) {
    if (!id) return null;
    const row = await this.db.securityGate.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
    if (!row) throw new NotFoundException('Portaria nao encontrada');
    return row.id;
  }

  private async validatePost(companyId: string, id: string | null) {
    if (!id) return null;
    const row = await this.db.securityPost.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
    if (!row) throw new NotFoundException('Posto nao encontrado');
    return row.id;
  }

  private async validatePerson(companyId: string, id: string | null) {
    if (!id) return null;
    const row = await this.db.securityPerson.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!row) throw new NotFoundException('Pessoa nao encontrada');
    return row;
  }

  private async validatePersonId(companyId: string, id: string | null) {
    return (await this.validatePerson(companyId, id))?.id ?? null;
  }

  private async validateVehicle(companyId: string, id: string | null) {
    if (!id) return null;
    const row = await this.db.securityVehicle.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!row) throw new NotFoundException('Veiculo nao encontrado');
    return row;
  }

  private async validateVehicleId(companyId: string, id: string | null) {
    return (await this.validateVehicle(companyId, id))?.id ?? null;
  }

  private async validateContractorCompany(companyId: string, id: string | null) {
    if (!id) return null;
    const row = await this.db.securityContractorCompany.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!row) throw new NotFoundException('Empresa prestadora nao encontrada');
    return row;
  }

  private async validateContractorCompanyId(companyId: string, id: string | null) {
    return (await this.validateContractorCompany(companyId, id))?.id ?? null;
  }

  private async validateAuthorization(companyId: string, id: string | null) {
    if (!id) return null;
    const row = await this.db.securityAuthorization.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!row) throw new NotFoundException('Autorizacao nao encontrada');
    return row;
  }

  private async validateRoundRoute(companyId: string, id: string | null) {
    if (!id) return null;
    const row = await this.db.securityRoundRoute.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
    if (!row) throw new NotFoundException('Rota de ronda nao encontrada');
    return row.id;
  }

  private async assertPackageWrite(me: AuthPayload) {
    const config = await this.getPackage(me);
    if (['DISABLED', 'BLOCKED', 'EXPIRED'].includes(String(config.status))) throw new ForbiddenException('Modulo de Seguranca Patrimonial indisponivel para esta empresa.');
    if (config.status === 'READ_ONLY') throw new ForbiddenException('Modulo de Seguranca Patrimonial esta em modo somente leitura.');
  }

  private async areaScopedWhere(me: AuthPayload, where: JsonMap) {
    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view').catch(() => null);
    if (!permitted) return where;
    const areaFilter = { OR: [{ unitId: null }, { unitId: { in: permitted } }] };
    return { ...where, AND: [...((where.AND as unknown[]) ?? []), areaFilter] };
  }

  private scopeWhere(_me: AuthPayload, q: Query) {
    return { ...(q.unitId ? { unitId: q.unitId } : {}), ...(q.gateId ? { gateId: q.gateId } : {}), ...(q.postId ? { postId: q.postId } : {}) };
  }

  private filterBase(me: AuthPayload, q: Query, keys: string[]) {
    const where: JsonMap = { companyId: me.companyId, deletedAt: null };
    for (const key of keys) if (q[key]) where[key] = q[key];
    const term = this.text(q.search);
    if (term) where.OR = [{ name: { contains: term, mode: 'insensitive' } }, { code: { contains: term, mode: 'insensitive' } }];
    return where;
  }

  private pick(src: JsonMap, keys: string[]) {
    const out: JsonMap = {};
    for (const key of keys) if (src[key] !== undefined) out[key] = src[key];
    return out;
  }

  private async nextCode(model: string, companyId: string, prefix: string) {
    const count = await this.db[model].count({ where: { companyId } });
    return `${prefix}-${String(count + 1).padStart(6, '0')}`;
  }

  private async findActiveBlock(companyId: string, input: { personId?: string | null; vehicleId?: string | null; documentNumber?: string | null; plate?: string | null }) {
    const or = [
      input.personId ? { personId: input.personId } : null,
      input.vehicleId ? { vehicleId: input.vehicleId } : null,
      input.documentNumber ? { documentNumber: input.documentNumber } : null,
      input.plate ? { plate: input.plate } : null,
    ].filter(Boolean);
    if (!or.length) return null;
    const now = new Date();
    return this.db.securityBlocklist.findFirst({
      where: { companyId, deletedAt: null, status: 'ACTIVE', startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }], AND: [{ OR: or }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async createQrInternal(me: AuthPayload, entityType: string, entityId: string, purpose: string, token: string, expiresAt?: Date | null, metadata?: unknown) {
    return this.db.securityQrCode.upsert({
      where: { token },
      create: { companyId: me.companyId, token, entityType, entityId, purpose, expiresAt: expiresAt ?? null, issuedById: me.sub, metadata: this.json(metadata) },
      update: { entityType, entityId, purpose, expiresAt: expiresAt ?? null, status: 'ACTIVE', issuedById: me.sub, metadata: this.json(metadata) },
    });
  }

  private async audit(me: AuthPayload, action: string, entity: string, entityId: string | null, label?: string | null, before?: unknown, after?: unknown, extra?: JsonMap) {
    await Promise.all([
      this.db.securityAuditLog.create({
        data: {
          companyId: me.companyId,
          unitId: this.id(extra?.unitId),
          gateId: this.id(extra?.gateId),
          postId: this.id(extra?.postId),
          userId: me.sub,
          userRole: String(me.role),
          action,
          entity,
          entityId,
          recordLabel: label ?? null,
          beforeValue: this.json(before),
          afterValue: this.json(after),
          reason: this.nullableText(extra?.reason),
          justification: this.nullableText(extra?.justification),
          approverId: this.id(extra?.approverId),
          evidence: this.json(extra?.evidence),
          origin: this.recordOrigin(extra?.origin),
          offline: extra?.origin === 'OFFLINE',
          syncedAt: this.date(extra?.syncedAt),
        },
      }).catch(() => undefined),
      this.db.auditLog.create({
        data: {
          companyId: me.companyId,
          userId: me.sub,
          action,
          module: MODULE,
          entity,
          entityId,
          recordLabel: label ?? null,
          payload: JSON.stringify({ before: this.safeJson(before), after: this.safeJson(after), extra: this.safeJson(extra) }),
          result: 'SUCCESS',
        },
      }).catch(() => undefined),
    ]);
  }

  private async auditPublic(companyId: string, action: string, entity: string, entityId: string | null, label?: string | null, before?: unknown, after?: unknown) {
    await this.db.securityAuditLog.create({ data: { companyId, action, entity, entityId, recordLabel: label ?? null, beforeValue: this.json(before), afterValue: this.json(after), origin: 'PORTAL' } }).catch(() => undefined);
  }

  private async createWorkItemForAuthorization(me: AuthPayload, authorization: any) {
    if (!['REQUESTED', 'WAITING_DOCUMENTS', 'WAITING_APPROVAL'].includes(authorization.status)) return;
    await this.createOperationalWorkItem(me, 'SecurityAuthorization', authorization.id, authorization.status, `Autorizacao ${authorization.code ?? ''} aguardando tratativa`, 'MEDIUM', authorization.scheduledStartAt);
  }

  private async createPresenceWorkItems(me: AuthPayload, movement: any) {
    if (!movement.expectedExitAt) return;
    const dueAt = new Date(movement.expectedExitAt);
    await this.createOperationalWorkItem(me, 'SecurityAccessMovement', movement.id, 'PENDING_EXIT', `Saida prevista para ${movement.code}`, 'LOW', dueAt);
  }

  private async createOperationalWorkItem(me: AuthPayload, entity: string, entityId: string, itemType: string, title: string, priority: string, dueAt?: Date | string | null) {
    const dedupeKey = `${MODULE}:${entity}:${entityId}:${itemType}:*`;
    await this.db.workItemIndex.upsert({
      where: { dedupeKey },
      create: {
        companyId: me.companyId,
        dedupeKey,
        sourceModule: MODULE,
        sourceEntityType: entity,
        sourceEntityId: entityId,
        itemType,
        title,
        status: 'OPEN',
        priority,
        priorityScore: priority === 'CRITICAL' ? 100 : priority === 'HIGH' ? 80 : priority === 'MEDIUM' ? 50 : 20,
        priorityReason: 'Gerado pelo modulo de Seguranca Patrimonial',
        dueAt: dueAt ? new Date(dueAt) : null,
        sourceCreatedAt: new Date(),
        contextData: { module: MODULE, entity, entityId },
      },
      update: { title, status: 'OPEN', priority, dueAt: dueAt ? new Date(dueAt) : null, refreshedAt: new Date() },
    }).catch(() => undefined);
  }

  private async closeWorkItem(companyId: string, entity: string, entityId: string) {
    await this.db.workItemIndex.updateMany({
      where: { companyId, sourceModule: MODULE, sourceEntityType: entity, sourceEntityId: entityId, status: { not: 'DONE' } },
      data: { status: 'DONE', completedAt: new Date(), refreshedAt: new Date() },
    }).catch(() => undefined);
  }

  private documentSnapshot(person: any | null, vehicle: any | null, contractor: any | null) {
    return {
      personDocumentStatus: person?.documentStatus ?? null,
      personDocumentValidUntil: person?.documentValidUntil ?? null,
      vehicleDocumentStatus: vehicle?.documentStatus ?? null,
      vehicleDocumentValidUntil: vehicle?.documentValidUntil ?? null,
      contractorDocumentStatus: contractor?.documentStatus ?? null,
    };
  }

  private maskPersonForAudit(person: any) {
    if (!person) return person;
    return { ...person, documentNumber: person.documentMasked ?? this.maskDocument(person.documentNumber) };
  }

  private maskPersonForView(person: any) {
    if (!person) return null;
    return { id: person.id, name: person.name, type: person.type, documentMasked: person.documentMasked ?? this.maskDocument(person.documentNumber), documentStatus: person.documentStatus, status: person.status, originCompanyName: person.originCompanyName };
  }

  private isMovementOverdue(row: any) {
    const now = Date.now();
    if (row.status !== 'OPEN') return false;
    if (row.expectedExitAt && new Date(row.expectedExitAt).getTime() < now) return true;
    if (row.entryAt && row.maxStayMinutes) return new Date(row.entryAt).getTime() + Number(row.maxStayMinutes) * 60_000 < now;
    return false;
  }

  private csv(filename: string, headers: string[], rows: unknown[][]) {
    const content = [headers.map((h) => this.csvValue(h)).join(';'), ...rows.map((row) => row.map((value) => this.csvValue(value)).join(';'))].join('\n');
    return { filename, mimeType: 'text/csv;charset=utf-8', encoding: 'utf8', content, rowCount: rows.length };
  }

  private csvValue(value: unknown) {
    if (value === null || value === undefined) return '';
    return `"${String(value).replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;
  }

  private text(value: unknown) {
    return String(value ?? '').trim();
  }

  private nullableText(value: unknown) {
    if (value === undefined) return undefined;
    const text = this.text(value);
    return text ? text : null;
  }

  private requiredText(value: unknown, field: string) {
    const text = this.text(value);
    if (!text) throw new BadRequestException(`${field} e obrigatorio.`);
    return text;
  }

  private id(value: unknown): string | null {
    const text = this.text(value);
    return text ? text : null;
  }

  private date(value: unknown): Date | null {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private int(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException('Valor numerico invalido.');
    return Math.round(parsed);
  }

  private float(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException('Valor numerico invalido.');
    return parsed;
  }

  private json(value: unknown): unknown | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    }
    return value;
  }

  private safeJson(value: unknown) {
    return value === undefined ? null : value;
  }

  private stringArray(value: unknown, fallback: string[] = []) {
    if (value === undefined) return fallback;
    if (Array.isArray(value)) return value.map((item) => this.text(item)).filter(Boolean);
    const text = this.text(value);
    if (!text) return [];
    return text.split(',').map((item) => item.trim()).filter(Boolean);
  }

  private enumValue<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
    const text = this.text(value).toUpperCase();
    return (allowed as readonly string[]).includes(text) ? (text as T[number]) : fallback;
  }

  private recordOrigin(value: unknown) {
    return this.enumValue(value, ['WEB', 'MOBILE', 'PORTAL', 'API', 'IMPORT', 'OFFLINE'] as const, 'WEB');
  }

  private onlyDigits(value: string) {
    return value.replace(/\D/g, '');
  }

  private normalizePlate(value: string) {
    return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  private maskDocument(value: string | null | undefined) {
    const digits = this.onlyDigits(String(value ?? ''));
    if (!digits) return null;
    if (digits.length <= 4) return '*'.repeat(digits.length);
    return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
  }

  private token(prefix: string) {
    return `${prefix}_${randomBytes(18).toString('base64url')}`;
  }

  private clean<T extends JsonMap>(obj: T) {
    return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
  }

  private mergeJson(before: unknown, patch: JsonMap) {
    const base = before && typeof before === 'object' && !Array.isArray(before) ? (before as JsonMap) : {};
    return { ...base, ...patch };
  }

  private groupBy(rows: any[], field: string) {
    const map = new Map<string, any[]>();
    for (const row of rows) {
      const key = String(row[field] ?? '');
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }

  private take(value: unknown, max = 100) {
    const parsed = this.int(value);
    if (parsed == null) return max;
    return Math.min(Math.max(parsed, 1), Math.max(max, 1));
  }
}
