import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { DocumentStorageService } from '../documents/document-storage.service';
import { PersonnelSettingsService } from './personnel-settings.service';
import { AuthPayload } from '../auth/auth.types';
import {
  CONTRACT_TYPES,
  DEPENDENT_RELATIONSHIPS,
  DOSSIER_KINDS,
  WORK_REGIMES,
  isValidCpf,
  maskCpf,
  normalizeCpf,
  parseFlexibleDate,
} from './employee.logic';

const MODULE = 'personnel';
const MAX_DOSSIER_BYTES = 8 * 1024 * 1024;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const MAX_IMPORT_ROWS = 1000;

/** Campos do perfil aceitos no create/update/import (texto simples). */
const PROFILE_TEXT_FIELDS = [
  'rg',
  'pisPasep',
  'ctpsNumber',
  'phone',
  'personalEmail',
  'address',
  'city',
  'state',
  'zipCode',
  'maritalStatus',
  'educationLevel',
  'sex',
  'raceColor',
  'bankCode',
  'bankAgency',
  'bankAccount',
  'bankAccountDigit',
  'pixKey',
  'emergencyContactName',
  'emergencyContactPhone',
  'notes',
] as const;

type Tx = Prisma.TransactionClient;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly storage: DocumentStorageService,
    private readonly settings: PersonnelSettingsService,
  ) {}

  // ------------------------------ Listagem ------------------------------

  async list(me: AuthPayload, filters: { search?: string; orgNodeId?: string; status?: string } = {}) {
    const where: Prisma.OrgEmployeeWhereInput = {
      companyId: me.companyId,
      ...(filters.orgNodeId ? { orgNodeId: filters.orgNodeId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const term = filters.search?.trim();
    if (term) {
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { registrationId: { contains: term, mode: 'insensitive' } },
        { personnelProfile: { cpf: { contains: term.replace(/\D/g, '') || term } } },
      ];
    }

    const [items, active, inactive, profilesWithCpf, monthStart] = await Promise.all([
      this.prisma.orgEmployee.findMany({
        where,
        include: {
          orgNode: { select: { id: true, name: true } },
          job: { select: { id: true, name: true } },
          personnelProfile: {
            select: { cpf: true, admissionDate: true, contractType: true, userId: true, phone: true, terminationDate: true },
          },
        },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      this.prisma.orgEmployee.count({ where: { companyId: me.companyId, status: 'ACTIVE' } }),
      this.prisma.orgEmployee.count({ where: { companyId: me.companyId, status: { not: 'ACTIVE' } } }),
      this.prisma.orgEmployee.count({
        where: { companyId: me.companyId, status: 'ACTIVE', personnelProfile: { cpf: { not: null } } },
      }),
      Promise.resolve(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    ]);
    const admittedThisMonth = await this.prisma.personnelEmployeeProfile.count({
      where: { companyId: me.companyId, admissionDate: { gte: monthStart } },
    });

    return {
      items: items.map((employee) => ({
        id: employee.id,
        registrationId: employee.registrationId,
        name: employee.name,
        status: employee.status,
        orgNode: employee.orgNode,
        job: employee.job,
        cpfMasked: maskCpf(employee.personnelProfile?.cpf),
        admissionDate: employee.personnelProfile?.admissionDate ?? null,
        terminationDate: employee.personnelProfile?.terminationDate ?? null,
        contractType: employee.personnelProfile?.contractType ?? null,
        phone: employee.personnelProfile?.phone ?? null,
        hasUserLink: Boolean(employee.personnelProfile?.userId),
        profileComplete: Boolean(employee.personnelProfile?.cpf && employee.personnelProfile?.admissionDate),
      })),
      kpis: {
        active,
        inactive,
        missingProfile: Math.max(0, active - profilesWithCpf),
        admittedThisMonth,
      },
    };
  }

  async options(me: AuthPayload) {
    const [orgNodes, jobs, users] = await Promise.all([
      this.prisma.orgNode.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, type: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.orgJob.findMany({
        where: { companyId: me.companyId, active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      orgNodes,
      jobs,
      users,
      contractTypes: CONTRACT_TYPES,
      workRegimes: WORK_REGIMES,
      dependentRelationships: DEPENDENT_RELATIONSHIPS,
      dossierKinds: DOSSIER_KINDS,
    };
  }

  // ------------------------------ Prontuário ------------------------------

  async getById(me: AuthPayload, id: string) {
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { id, companyId: me.companyId },
      include: {
        orgNode: { select: { id: true, name: true } },
        job: { select: { id: true, name: true, cbo: true } },
        personnelProfile: true,
        dependents: { orderBy: { name: 'asc' } },
        employmentEvents: { orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }], take: 100 },
        dossierFiles: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado.');

    const linkedUser = employee.personnelProfile?.userId
      ? await this.prisma.user.findFirst({
          where: { id: employee.personnelProfile.userId, companyId: me.companyId },
          select: { id: true, name: true, email: true, active: true },
        })
      : null;

    return {
      ...employee,
      linkedUser,
      photoAvailable: Boolean(employee.personnelProfile?.photoStorageKey),
      photoUpdatedAt: employee.personnelProfile?.photoUpdatedAt ?? null,
      dossierFiles: employee.dossierFiles.map((file) => ({
        id: file.id,
        kind: file.kind,
        name: file.name,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        validUntil: file.validUntil,
        note: file.note,
        createdAt: file.createdAt,
      })),
    };
  }

  async create(me: AuthPayload, body: any = {}) {
    const name = text(body?.name);
    if (!name) throw new BadRequestException('Nome do colaborador é obrigatório.');
    const jobId = await this.resolveJobId(me.companyId, body?.jobId, body?.jobName, me.sub);
    const orgNodeId = await this.validateOrgNode(me.companyId, text(body?.orgNodeId));
    // Matrícula informada tem prioridade; sem ela, gera pelo formato configurado
    // (Serviço Pessoal → Configurações). Assim tanto a admissão do recrutamento
    // quanto o cadastro direto ganham a numeração automática por um único caminho.
    let registrationId = text(body?.registrationId);
    if (registrationId) {
      const duplicate = await this.prisma.orgEmployee.findFirst({
        where: { companyId: me.companyId, registrationId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Já existe colaborador ativo com esta matrícula.');
    } else {
      registrationId = await this.settings.allocateRegistration(me.companyId);
    }
    const profileData = await this.buildProfileData(me, body?.profile ?? body, null);

    const created = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.orgEmployee.create({
        data: {
          companyId: me.companyId,
          name,
          registrationId,
          jobId,
          orgNodeId,
          status: 'ACTIVE',
          approvalStatus: 'APROVADO',
        },
      });
      await tx.personnelEmployeeProfile.create({
        data: { companyId: me.companyId, employeeId: employee.id, createdById: me.sub, ...profileData },
      });
      const admissionDate = (profileData.admissionDate as Date | null) ?? new Date();
      await tx.employmentEvent.create({
        data: {
          companyId: me.companyId,
          employeeId: employee.id,
          type: 'ADMISSAO',
          title: 'Admissão',
          description: null,
          effectiveDate: admissionDate,
          createdById: me.sub,
        },
      });
      // Base única do colaborador: o perfil de remuneração (Cargos e Salários)
      // nasce junto com a admissão para manter os módulos conectados.
      await tx.compensationEmployeeProfile.create({
        data: { companyId: me.companyId, employeeId: employee.id, admissionDate, updatedById: me.sub },
      });
      return employee;
    }).catch(this.rethrowCpfConflict);

    // CBO é do cargo (OrgJob) — exigido no eSocial. Atualiza o cargo resolvido.
    await this.applyJobCbo(jobId, body?.cbo);

    await this.audit.record(me, {
      module: MODULE,
      entity: 'OrgEmployee',
      entityId: created.id,
      action: 'EMPLOYEE_CREATED',
      message: `Colaborador "${name}" cadastrado`,
      after: { name, registrationId, jobId, orgNodeId },
    });
    return this.getById(me, created.id);
  }

  async update(me: AuthPayload, id: string, patch: any = {}) {
    const before = await this.prisma.orgEmployee.findFirst({
      where: { id, companyId: me.companyId },
      include: {
        personnelProfile: true,
        job: { select: { id: true, name: true } },
        orgNode: { select: { id: true, name: true } },
      },
    });
    if (!before) throw new NotFoundException('Colaborador não encontrado.');

    const core: Prisma.OrgEmployeeUpdateInput = {};
    if ('name' in patch) {
      const name = text(patch.name);
      if (!name) throw new BadRequestException('Nome do colaborador é obrigatório.');
      core.name = name;
    }
    if ('registrationId' in patch) core.registrationId = text(patch.registrationId);
    let jobChanged: { from: string; to: string } | null = null;
    if ('jobId' in patch || 'jobName' in patch) {
      const jobId = await this.resolveJobId(me.companyId, patch?.jobId, patch?.jobName, me.sub);
      if (jobId !== before.jobId) {
        const job = await this.prisma.orgJob.findFirst({ where: { id: jobId }, select: { name: true } });
        jobChanged = { from: before.job?.name ?? '—', to: job?.name ?? '—' };
        core.job = { connect: { id: jobId } };
        core.approvalStatus = 'APROVADO';
      }
    }
    let nodeChanged: { from: string; to: string } | null = null;
    if ('orgNodeId' in patch) {
      const orgNodeId = await this.validateOrgNode(me.companyId, text(patch.orgNodeId));
      if ((orgNodeId ?? null) !== (before.orgNodeId ?? null)) {
        const node = orgNodeId
          ? await this.prisma.orgNode.findFirst({ where: { id: orgNodeId }, select: { name: true } })
          : null;
        nodeChanged = { from: before.orgNode?.name ?? 'Sem área', to: node?.name ?? 'Sem área' };
        core.orgNode = orgNodeId ? { connect: { id: orgNodeId } } : { disconnect: true };
      }
    }
    let statusChanged: { from: string; to: string } | null = null;
    if ('status' in patch) {
      const status = text(patch.status);
      if (status && !['ACTIVE', 'INACTIVE'].includes(status)) throw new BadRequestException('Status inválido (ACTIVE/INACTIVE).');
      if (status && status !== before.status) {
        statusChanged = { from: before.status, to: status };
        core.status = status;
      }
    }

    const profileData = await this.buildProfileData(me, patch?.profile ?? patch, before.personnelProfile);
    const terminationNow = statusChanged?.to === 'INACTIVE' ? ((profileData.terminationDate as Date | null) ?? new Date()) : undefined;
    if (terminationNow) profileData.terminationDate = terminationNow;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(core).length) await tx.orgEmployee.update({ where: { id }, data: core });
      await tx.personnelEmployeeProfile.upsert({
        where: { employeeId: id },
        create: { companyId: me.companyId, employeeId: id, createdById: me.sub, ...profileData },
        update: profileData,
      });
      // Mantém a data de admissão espelhada no perfil de remuneração
      // (Cargos e Salários) sem tocar nos demais campos do perfil.
      if (profileData.admissionDate !== undefined) {
        const admissionDate = profileData.admissionDate as Date | null;
        await tx.compensationEmployeeProfile.upsert({
          where: { employeeId: id },
          create: { companyId: me.companyId, employeeId: id, admissionDate, updatedById: me.sub },
          update: { admissionDate, updatedById: me.sub },
        });
      }
      const events: Array<{ type: string; title: string; description?: string | null }> = [];
      if (jobChanged) events.push({ type: 'MUDANCA_CARGO', title: `Mudança de cargo: ${jobChanged.from} → ${jobChanged.to}` });
      if (nodeChanged) events.push({ type: 'TRANSFERENCIA', title: `Transferência: ${nodeChanged.from} → ${nodeChanged.to}` });
      if (statusChanged?.to === 'INACTIVE') events.push({ type: 'DESLIGAMENTO', title: 'Desligamento', description: text(patch?.reason) });
      if (statusChanged?.to === 'ACTIVE') events.push({ type: 'MUDANCA_STATUS', title: 'Reativação do vínculo' });
      for (const event of events) {
        await tx.employmentEvent.create({
          data: {
            companyId: me.companyId,
            employeeId: id,
            type: event.type,
            title: event.title,
            description: event.description ?? null,
            effectiveDate: new Date(),
            createdById: me.sub,
          },
        });
      }
    }).catch(this.rethrowCpfConflict);

    // CBO do cargo atual (eSocial).
    if ('cbo' in patch) {
      const currentJobId = (core.job as { connect?: { id: string } } | undefined)?.connect?.id ?? before.jobId;
      await this.applyJobCbo(currentJobId, patch.cbo);
    }

    await this.audit.record(me, {
      module: MODULE,
      entity: 'OrgEmployee',
      entityId: id,
      action: 'EMPLOYEE_UPDATED',
      message: `Prontuário de "${before.name}" atualizado`,
      before: { jobId: before.jobId, orgNodeId: before.orgNodeId, status: before.status },
      after: { jobChanged, nodeChanged, statusChanged },
    });
    return this.getById(me, id);
  }

  // ------------------------------ Dependentes ------------------------------

  async addDependent(me: AuthPayload, employeeId: string, body: any = {}) {
    await this.assertEmployee(me, employeeId);
    const name = text(body?.name);
    if (!name) throw new BadRequestException('Nome do dependente é obrigatório.');
    const relationship = text(body?.relationship)?.toUpperCase() ?? 'OUTRO';
    if (!DEPENDENT_RELATIONSHIPS.includes(relationship as any)) throw new BadRequestException('Parentesco inválido.');
    const cpf = this.validateOptionalCpf(body?.cpf);
    const dependent = await this.prisma.employeeDependent.create({
      data: {
        companyId: me.companyId,
        employeeId,
        name,
        relationship,
        birthDate: parseFlexibleDate(body?.birthDate),
        cpf,
        isIrDependent: Boolean(body?.isIrDependent),
        notes: text(body?.notes),
        createdById: me.sub,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'EmployeeDependent',
      entityId: dependent.id,
      action: 'DEPENDENT_ADDED',
      message: `Dependente "${name}" adicionado`,
    });
    return dependent;
  }

  async removeDependent(me: AuthPayload, employeeId: string, dependentId: string) {
    const dependent = await this.prisma.employeeDependent.findFirst({
      where: { id: dependentId, employeeId, companyId: me.companyId },
    });
    if (!dependent) throw new NotFoundException('Dependente não encontrado.');
    await this.prisma.employeeDependent.delete({ where: { id: dependentId } });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'EmployeeDependent',
      entityId: dependentId,
      action: 'DEPENDENT_REMOVED',
      message: `Dependente "${dependent.name}" removido`,
      before: { name: dependent.name, relationship: dependent.relationship },
    });
    return { removed: true };
  }

  // ------------------------------ Timeline ------------------------------

  async addEvent(me: AuthPayload, employeeId: string, body: any = {}) {
    await this.assertEmployee(me, employeeId);
    const title = text(body?.title);
    if (!title) throw new BadRequestException('Título do evento é obrigatório.');
    const event = await this.prisma.employmentEvent.create({
      data: {
        companyId: me.companyId,
        employeeId,
        type: text(body?.type)?.toUpperCase() ?? 'OBSERVACAO',
        title,
        description: text(body?.description),
        effectiveDate: parseFlexibleDate(body?.effectiveDate) ?? new Date(),
        createdById: me.sub,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'EmploymentEvent',
      entityId: event.id,
      action: 'EVENT_ADDED',
      message: `Evento "${title}" registrado no prontuário`,
    });
    return event;
  }

  // ------------------------------ Dossiê ------------------------------

  async uploadDossierFile(me: AuthPayload, employeeId: string, body: any = {}) {
    await this.assertEmployee(me, employeeId);
    const kind = text(body?.kind)?.toUpperCase() ?? 'OUTRO';
    if (!DOSSIER_KINDS.includes(kind as any)) throw new BadRequestException('Tipo de documento inválido.');
    const fileName = text(body?.fileName);
    const base64 = text(body?.contentBase64);
    if (!fileName || !base64) throw new BadRequestException('Arquivo (nome + conteúdo) é obrigatório.');
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) throw new BadRequestException('Arquivo vazio.');
    if (buffer.length > MAX_DOSSIER_BYTES) throw new BadRequestException('Arquivo excede o limite de 8 MB.');

    const stored = await this.storage.putBinary(
      me.companyId,
      `personnel/${employeeId}`,
      fileName,
      buffer,
      text(body?.mimeType) ?? 'application/octet-stream',
    );
    const file = await this.prisma.employeeDossierFile.create({
      data: {
        companyId: me.companyId,
        employeeId,
        kind,
        name: text(body?.name) ?? fileName,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        hashSha256: stored.hashSha256,
        storageKey: stored.storageKey,
        validUntil: parseFlexibleDate(body?.validUntil),
        note: text(body?.note),
        createdById: me.sub,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'EmployeeDossierFile',
      entityId: file.id,
      action: 'DOSSIER_UPLOAD',
      message: `Documento "${file.name}" (${kind}) anexado ao dossiê`,
    });
    return file;
  }

  async downloadDossierFile(me: AuthPayload, employeeId: string, fileId: string) {
    const file = await this.prisma.employeeDossierFile.findFirst({
      where: { id: fileId, employeeId, companyId: me.companyId, deletedAt: null },
    });
    if (!file) throw new NotFoundException('Arquivo não encontrado.');
    const content = await this.storage.readBinary(file.storageKey);
    await this.audit.record(me, {
      module: MODULE,
      entity: 'EmployeeDossierFile',
      entityId: file.id,
      action: 'DOSSIER_DOWNLOAD',
      message: `Download de "${file.name}" do dossiê`,
    });
    return { fileName: file.fileName, mimeType: file.mimeType ?? 'application/octet-stream', content };
  }

  async removeDossierFile(me: AuthPayload, employeeId: string, fileId: string) {
    const file = await this.prisma.employeeDossierFile.findFirst({
      where: { id: fileId, employeeId, companyId: me.companyId, deletedAt: null },
    });
    if (!file) throw new NotFoundException('Arquivo não encontrado.');
    await this.prisma.employeeDossierFile.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'EmployeeDossierFile',
      entityId: fileId,
      action: 'DOSSIER_REMOVED',
      message: `Documento "${file.name}" removido do dossiê`,
    });
    return { removed: true };
  }

  // ------------------------------ Importação ------------------------------

  /** Import em lote (linhas já normalizadas pelo frontend a partir de CSV/XLSX). */
  async importEmployees(me: AuthPayload, body: any = {}) {
    const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) throw new BadRequestException('Nenhuma linha para importar.');
    if (rows.length > MAX_IMPORT_ROWS) throw new BadRequestException(`Máximo de ${MAX_IMPORT_ROWS} linhas por importação.`);

    const [orgNodes, jobs, users, employees] = await Promise.all([
      this.prisma.orgNode.findMany({
        where: { companyId: me.companyId, deletedAt: null },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.orgJob.findMany({ where: { companyId: me.companyId }, select: { id: true, name: true } }),
      this.prisma.user.findMany({
        where: { companyId: me.companyId, deletedAt: null },
        select: { id: true, email: true },
      }),
      this.prisma.orgEmployee.findMany({
        where: { companyId: me.companyId },
        select: { id: true, name: true, registrationId: true, personnelProfile: { select: { cpf: true } } },
      }),
    ]);
    const nodeByName = new Map<string, string>();
    for (const node of orgNodes) {
      nodeByName.set(node.name.toLowerCase(), node.id);
      if (node.code) nodeByName.set(node.code.toLowerCase(), node.id);
    }
    const jobByName = new Map(jobs.map((j) => [j.name.toLowerCase(), j.id]));
    const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
    const byCpf = new Map(employees.filter((e) => e.personnelProfile?.cpf).map((e) => [e.personnelProfile!.cpf as string, e.id]));
    const byRegistration = new Map(employees.filter((e) => e.registrationId).map((e) => [e.registrationId as string, e.id]));
    const byName = new Map(employees.map((e) => [e.name.trim().toLowerCase(), e.id]));

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index] ?? {};
      const line = index + 2; // 1-based + cabeçalho
      try {
        const name = text(row.name);
        if (!name) throw new Error('nome é obrigatório');
        const cpf = this.validateOptionalCpf(row.cpf);
        const registrationId = text(row.registrationId);
        const jobName = text(row.jobName);
        const orgNodeName = text(row.orgNodeName)?.toLowerCase();
        const orgNodeId = orgNodeName ? nodeByName.get(orgNodeName) : undefined;
        if (orgNodeName && !orgNodeId) throw new Error(`área "${row.orgNodeName}" não encontrada`);
        const userId = text(row.email) ? userByEmail.get(String(row.email).toLowerCase()) : undefined;

        let jobId = jobName ? jobByName.get(jobName.toLowerCase()) : undefined;
        if (jobName && !jobId) {
          const job = await this.prisma.orgJob.create({ data: { companyId: me.companyId, name: jobName } });
          jobByName.set(jobName.toLowerCase(), job.id);
          jobId = job.id;
        }

        const profile: Record<string, unknown> = {
          cpf,
          admissionDate: parseFlexibleDate(row.admissionDate),
          birthDate: parseFlexibleDate(row.birthDate),
          phone: text(row.phone),
          personalEmail: text(row.personalEmail),
          contractType: this.validateEnum(row.contractType, CONTRACT_TYPES, 'tipo de contrato'),
          userId: userId ?? undefined,
        };
        for (const key of Object.keys(profile)) if (profile[key] === undefined || profile[key] === null) delete profile[key];

        const existingId = (cpf && byCpf.get(cpf)) || (registrationId && byRegistration.get(registrationId)) || byName.get(name.toLowerCase());
        if (existingId) {
          await this.prisma.$transaction(async (tx) => {
            await tx.orgEmployee.update({
              where: { id: existingId },
              data: {
                ...(registrationId ? { registrationId } : {}),
                ...(jobId ? { jobId } : {}),
                ...(orgNodeId ? { orgNodeId } : {}),
              },
            });
            await tx.personnelEmployeeProfile.upsert({
              where: { employeeId: existingId },
              create: { companyId: me.companyId, employeeId: existingId, createdById: me.sub, ...profile },
              update: profile,
            });
          });
          updated += 1;
        } else {
          if (!jobId) {
            jobId = jobByName.get('cargo não definido');
            if (!jobId) {
              const job = await this.prisma.orgJob.create({ data: { companyId: me.companyId, name: 'Cargo não definido' } });
              jobByName.set('cargo não definido', job.id);
              jobId = job.id;
            }
          }
          await this.prisma.$transaction(async (tx) => {
            const employee = await tx.orgEmployee.create({
              data: {
                companyId: me.companyId,
                name,
                registrationId,
                jobId: jobId!,
                orgNodeId: orgNodeId ?? null,
                status: 'ACTIVE',
                approvalStatus: 'APROVADO',
              },
            });
            await tx.personnelEmployeeProfile.create({
              data: { companyId: me.companyId, employeeId: employee.id, createdById: me.sub, ...profile },
            });
            await tx.employmentEvent.create({
              data: {
                companyId: me.companyId,
                employeeId: employee.id,
                type: 'ADMISSAO',
                title: 'Admissão (importação)',
                effectiveDate: (profile.admissionDate as Date | undefined) ?? new Date(),
                createdById: me.sub,
              },
            });
            await tx.compensationEmployeeProfile.create({
              data: {
                companyId: me.companyId,
                employeeId: employee.id,
                admissionDate: (profile.admissionDate as Date | undefined) ?? new Date(),
                updatedById: me.sub,
              },
            });
            if (cpf) byCpf.set(cpf, employee.id);
            if (registrationId) byRegistration.set(registrationId, employee.id);
            byName.set(name.toLowerCase(), employee.id);
          });
          created += 1;
        }
      } catch (error: any) {
        const message = error?.code === 'P2002' ? 'CPF já cadastrado em outro colaborador' : (error?.message ?? 'erro desconhecido');
        errors.push(`Linha ${line}: ${message}`);
      }
    }

    await this.audit.record(me, {
      module: MODULE,
      entity: 'OrgEmployee',
      action: 'EMPLOYEES_IMPORTED',
      message: `Importação de colaboradores: ${created} criados, ${updated} atualizados, ${errors.length} erros`,
      after: { created, updated, errorList: errors.slice(0, 20) },
    });
    return { created, updated, errors };
  }

  // ------------------------------ Internos ------------------------------

  // ------------------------------ Foto / Crachá ------------------------------

  async uploadPhoto(me: AuthPayload, employeeId: string, body: any = {}) {
    await this.assertEmployee(me, employeeId);
    const base64 = text(body?.contentBase64);
    const mimeType = text(body?.mimeType) ?? 'image/jpeg';
    if (!base64) throw new BadRequestException('Foto (conteúdo) é obrigatória.');
    if (!mimeType.startsWith('image/')) throw new BadRequestException('A foto deve ser uma imagem.');
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) throw new BadRequestException('Foto vazia.');
    if (buffer.length > MAX_PHOTO_BYTES) throw new BadRequestException('A foto excede o limite de 4 MB.');

    const stored = await this.storage.putBinary(me.companyId, `personnel/${employeeId}/photo`, `foto-${employeeId}.img`, buffer, mimeType);
    const now = new Date();
    await this.prisma.personnelEmployeeProfile.upsert({
      where: { employeeId },
      create: { companyId: me.companyId, employeeId, createdById: me.sub, photoStorageKey: stored.storageKey, photoMimeType: stored.mimeType, photoUpdatedAt: now },
      update: { photoStorageKey: stored.storageKey, photoMimeType: stored.mimeType, photoUpdatedAt: now },
    });
    await this.audit.record(me, { module: MODULE, entity: 'OrgEmployee', entityId: employeeId, action: 'PHOTO_UPDATE', message: 'Foto do colaborador atualizada' });
    return { photoUpdatedAt: now, mimeType: stored.mimeType };
  }

  async getPhoto(me: AuthPayload, employeeId: string) {
    await this.assertEmployee(me, employeeId);
    const profile = await this.prisma.personnelEmployeeProfile.findUnique({
      where: { employeeId },
      select: { companyId: true, photoStorageKey: true, photoMimeType: true },
    });
    if (!profile || profile.companyId !== me.companyId || !profile.photoStorageKey) throw new NotFoundException('Foto não cadastrada.');
    const content = await this.storage.readBinary(profile.photoStorageKey);
    return { mimeType: profile.photoMimeType ?? 'image/jpeg', contentBase64: content.toString('base64') };
  }

  /** Dados consolidados para o gerador de crachá (colaborador + empresa + template). */
  async getBadgeData(me: AuthPayload, employeeId: string) {
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { id: employeeId, companyId: me.companyId },
      include: {
        orgNode: { select: { name: true } },
        job: { select: { name: true } },
        personnelProfile: { select: { admissionDate: true, photoStorageKey: true, photoMimeType: true } },
      },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado.');

    const [company, settings] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: me.companyId }, select: { name: true, tradeName: true, logoUrl: true } }),
      this.settings.get(me.companyId),
    ]);

    let photo: { mimeType: string; contentBase64: string } | null = null;
    if (settings.badgeShowPhoto && employee.personnelProfile?.photoStorageKey) {
      const buffer = await this.storage.readBinary(employee.personnelProfile.photoStorageKey).catch(() => null);
      if (buffer) photo = { mimeType: employee.personnelProfile.photoMimeType ?? 'image/jpeg', contentBase64: buffer.toString('base64') };
    }

    return {
      employee: {
        id: employee.id,
        name: employee.name,
        registrationId: employee.registrationId,
        jobName: employee.job?.name ?? null,
        areaName: employee.orgNode?.name ?? null,
        admissionDate: employee.personnelProfile?.admissionDate ?? null,
      },
      company: { name: company?.tradeName || company?.name || 'Empresa', logoUrl: company?.logoUrl ?? null },
      photo,
      template: {
        accentColor: settings.badgeAccentColor,
        orientation: settings.badgeOrientation,
        showPhoto: settings.badgeShowPhoto,
        showQr: settings.badgeShowQr,
        showJob: settings.badgeShowJob,
        showAdmission: settings.badgeShowAdmission,
        showRegistration: settings.badgeShowRegistration,
        footerText: settings.badgeFooterText,
      },
    };
  }

  private async assertEmployee(me: AuthPayload, employeeId: string) {
    const exists = await this.prisma.orgEmployee.findFirst({
      where: { id: employeeId, companyId: me.companyId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Colaborador não encontrado.');
  }

  private async resolveJobId(companyId: string, jobId: unknown, jobName: unknown, userId: string): Promise<string> {
    const id = text(jobId);
    if (id) {
      const job = await this.prisma.orgJob.findFirst({ where: { id, companyId }, select: { id: true } });
      if (!job) throw new NotFoundException('Cargo não encontrado.');
      return job.id;
    }
    const name = text(jobName);
    if (name) {
      const existing = await this.prisma.orgJob.findFirst({
        where: { companyId, name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) return existing.id;
      const job = await this.prisma.orgJob.create({ data: { companyId, name } });
      return job.id;
    }
    // Sem cargo informado: usa/cria o cargo genérico (OrgEmployee.jobId é obrigatório).
    const fallback = await this.prisma.orgJob.findFirst({
      where: { companyId, name: { equals: 'Cargo não definido', mode: 'insensitive' } },
      select: { id: true },
    });
    if (fallback) return fallback.id;
    const job = await this.prisma.orgJob.create({ data: { companyId, name: 'Cargo não definido' } });
    return job.id;
  }

  /** Grava o CBO (só dígitos) no cargo (OrgJob) — dado do cargo, exigido no eSocial. */
  private async applyJobCbo(jobId: string | undefined | null, cbo: unknown): Promise<void> {
    if (!jobId || cbo === undefined) return;
    const digits = String(cbo ?? '').replace(/\D/g, '').slice(0, 6);
    await this.prisma.orgJob.update({ where: { id: jobId }, data: { cbo: digits || null } });
  }

  private async validateOrgNode(companyId: string, orgNodeId: string | null): Promise<string | null> {
    if (!orgNodeId) return null;
    const node = await this.prisma.orgNode.findFirst({ where: { id: orgNodeId, companyId, deletedAt: null }, select: { id: true } });
    if (!node) throw new NotFoundException('Área não encontrada.');
    return node.id;
  }

  /** Monta os dados do perfil validando CPF, datas, enums e vínculo de usuário. */
  private async buildProfileData(me: AuthPayload, source: any, before: { cpf: string | null } | null) {
    const data: Record<string, unknown> = {};
    if (source && 'cpf' in source) {
      const cpf = this.validateOptionalCpf(source.cpf);
      if (cpf !== (before?.cpf ?? null) || !before) data.cpf = cpf;
    }
    for (const field of PROFILE_TEXT_FIELDS) {
      if (source && field in source) data[field] = text(source[field]);
    }
    for (const field of ['birthDate', 'admissionDate', 'terminationDate'] as const) {
      if (source && field in source) {
        const raw = text(source[field]);
        if (raw) {
          const date = parseFlexibleDate(raw);
          if (!date) throw new BadRequestException(`Data inválida em ${field}.`);
          data[field] = date;
        } else {
          data[field] = null;
        }
      }
    }
    if (source && 'contractType' in source) data.contractType = this.validateEnum(source.contractType, CONTRACT_TYPES, 'tipo de contrato');
    if (source && 'workRegime' in source) data.workRegime = this.validateEnum(source.workRegime, WORK_REGIMES, 'regime de trabalho');
    // Override tri-estado do ponto pelo portal: '' / null → herda a empresa.
    if (source && 'allowPortalPunch' in source) {
      const raw = source.allowPortalPunch;
      data.allowPortalPunch = raw === '' || raw === null || raw === undefined ? null : Boolean(raw === true || raw === 'true' || raw === 'SIM');
    }
    if (source && 'userId' in source) {
      const userId = text(source.userId);
      if (userId) {
        const user = await this.prisma.user.findFirst({ where: { id: userId, companyId: me.companyId }, select: { id: true } });
        if (!user) throw new NotFoundException('Usuário para vínculo não encontrado.');
        data.userId = user.id;
      } else {
        data.userId = null;
      }
    }
    // Antifraude: marca quando os dados bancários mudaram.
    if (['bankCode', 'bankAgency', 'bankAccount', 'bankAccountDigit', 'pixKey'].some((f) => f in data)) {
      data.bankUpdatedAt = new Date();
    }
    return data;
  }

  private validateOptionalCpf(value: unknown): string | null {
    const cpf = normalizeCpf(value);
    if (!cpf) return null;
    if (!isValidCpf(cpf)) throw new BadRequestException(`CPF inválido: ${value}`);
    return cpf;
  }

  private validateEnum(value: unknown, allowed: readonly string[], label: string): string | null {
    const item = text(value)?.toUpperCase() ?? null;
    if (!item) return null;
    if (!allowed.includes(item)) throw new BadRequestException(`Valor inválido para ${label}: ${value}`);
    return item;
  }

  private rethrowCpfConflict = (error: any): never => {
    if (error?.code === 'P2002') throw new ConflictException('CPF já cadastrado para outro colaborador desta empresa.');
    throw error;
  };
}

function text(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}
