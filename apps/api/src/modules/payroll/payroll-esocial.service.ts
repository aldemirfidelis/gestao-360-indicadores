import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import {
  buildEventId,
  buildInternalBatchXml,
  buildS1010Xml,
  buildS1200Xml,
  buildS1299Xml,
  ESOCIAL_LAYOUT_VERSION,
  ESOCIAL_SOURCE_URL,
  hashXml,
  onlyDigits,
  sanitizeEsocialCode,
  type EsocialEnvironment,
} from './payroll-esocial.logic';

const MODULE = 'payroll';
const ALLOWED_CERT_STORAGE = ['EXTERNAL_REF', 'ENV_REF'];
const GENERATABLE_RUN_STATUSES = ['CALCULATED', 'APPROVED', 'CLOSED'];
const FORBIDDEN_SECRET_KEYS = ['pfx', 'pfxBase64', 'password', 'senha', 'privateKey', 'certificate', 'certificado', 'file', 'content'];

interface CertificateLike {
  pfxSecretRef: string | null;
  passwordSecretRef: string | null;
}

@Injectable()
export class PayrollEsocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  // ------------------------------ certificados ------------------------------

  async listCertificates(me: AuthPayload) {
    const rows = await this.prisma.payrollDigitalCertificate.findMany({
      where: { companyId: me.companyId },
      orderBy: [{ status: 'asc' }, { validUntil: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.redactCertificate(row));
  }

  async createCertificate(me: AuthPayload, body: any = {}) {
    const payload = this.objectBody(body);
    this.rejectInlineSecrets(payload);
    const name = this.requiredText(payload.name, 'Nome do certificado');
    const storageMode = String(payload.storageMode ?? 'EXTERNAL_REF').trim().toUpperCase();
    if (!ALLOWED_CERT_STORAGE.includes(storageMode)) {
      throw new BadRequestException('Modo de armazenamento invalido.');
    }
    const created = await this.prisma.payrollDigitalCertificate.create({
      data: {
        companyId: me.companyId,
        name,
        holderName: this.optionalText(payload.holderName),
        holderCpfCnpj: this.optionalText(payload.holderCpfCnpj),
        kind: this.optionalText(payload.kind)?.toUpperCase() || 'A1',
        storageMode,
        pfxSecretRef: this.optionalText(payload.pfxSecretRef),
        passwordSecretRef: this.optionalText(payload.passwordSecretRef),
        serialNumber: this.optionalText(payload.serialNumber),
        validFrom: this.optionalDate(payload.validFrom),
        validUntil: this.optionalDate(payload.validUntil),
        status: this.optionalText(payload.status)?.toUpperCase() || 'ACTIVE',
        notes: this.optionalText(payload.notes),
        createdById: me.sub,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollDigitalCertificate',
      entityId: created.id,
      action: 'CREATE',
      message: 'Certificado digital referenciado para eSocial',
      after: this.redactCertificate(created),
    });
    return this.redactCertificate(created);
  }

  async testCertificate(me: AuthPayload, id: string) {
    const cert = await this.certificateOf(me.companyId, id);
    const checks = [
      { key: 'pfx_ref', ok: Boolean(cert.pfxSecretRef), detail: cert.pfxSecretRef ? 'Referencia do PFX cadastrada' : 'Referencia do PFX ausente' },
      { key: 'password_ref', ok: Boolean(cert.passwordSecretRef), detail: cert.passwordSecretRef ? 'Referencia da senha cadastrada' : 'Referencia da senha ausente' },
      { key: 'validity', ok: !cert.validUntil || cert.validUntil.getTime() >= Date.now(), detail: cert.validUntil ? `Valido ate ${cert.validUntil.toISOString().slice(0, 10)}` : 'Validade nao informada' },
    ];
    if (cert.storageMode === 'ENV_REF') {
      checks.push({
        key: 'env_pfx',
        ok: Boolean(cert.pfxSecretRef && process.env[cert.pfxSecretRef]),
        detail: cert.pfxSecretRef ? 'Variavel externa do PFX verificada sem expor valor' : 'Referencia do PFX ausente',
      });
      checks.push({
        key: 'env_password',
        ok: Boolean(cert.passwordSecretRef && process.env[cert.passwordSecretRef]),
        detail: cert.passwordSecretRef ? 'Variavel externa da senha verificada sem expor valor' : 'Referencia da senha ausente',
      });
    }
    const ok = checks.every((check) => check.ok);
    const updated = await this.prisma.payrollDigitalCertificate.update({
      where: { id },
      data: { lastTestedAt: new Date(), lastTestStatus: ok ? 'OK' : 'WARN' },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollDigitalCertificate',
      entityId: id,
      action: 'TEST',
      message: ok ? 'Referencia de certificado validada' : 'Referencia de certificado com pendencias',
      after: { ok, checks: checks.map((check) => ({ ...check, detail: check.detail.replace(/[A-Za-z0-9_:-]{24,}/g, '***') })) },
    });
    return { ok, certificate: this.redactCertificate(updated), checks };
  }

  // ------------------------------ eventos eSocial ------------------------------

  async listEvents(me: AuthPayload, runId?: string) {
    return this.prisma.payrollEsocialEvent.findMany({
      where: { companyId: me.companyId, ...(runId ? { runId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        eventId: true,
        eventType: true,
        periodRef: true,
        environment: true,
        layoutVersion: true,
        status: true,
        xmlHash: true,
        runId: true,
        runWorkerId: true,
        employeeId: true,
        batchId: true,
        issues: true,
        createdAt: true,
      },
    });
  }

  async generateRunEvents(me: AuthPayload, runId: string, body: any = {}) {
    const environment = this.resolveEnvironment(body?.environment);
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, companyId: me.companyId },
      include: {
        competence: true,
        workers: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!run) throw new NotFoundException('Processamento de folha nao encontrado.');
    if (!GENERATABLE_RUN_STATUSES.includes(run.status)) {
      throw new ConflictException('Gere eventos eSocial apenas apos calcular a folha sem pendencias.');
    }
    if (!run.workers.length) throw new BadRequestException('Processamento sem colaboradores calculados.');

    const company = await this.prisma.company.findUnique({
      where: { id: me.companyId },
      select: { name: true, cnpj: true },
    });
    const employerRegistration = onlyDigits(company?.cnpj);
    if (!employerRegistration) throw new BadRequestException('CNPJ da empresa ausente. Cadastre antes de gerar eventos eSocial.');

    const employeeIds = run.workers.map((worker) => worker.employeeId);
    const employees = await this.prisma.orgEmployee.findMany({
      where: { companyId: me.companyId, id: { in: employeeIds } },
      select: {
        id: true,
        name: true,
        registrationId: true,
        personnelProfile: { select: { cpf: true, contractType: true } },
      },
    });
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const periodRef = `${run.competence.year}-${String(run.competence.month).padStart(2, '0')}`;
    const createdAt = new Date();
    const batchedEvents = await this.prisma.payrollEsocialEvent.count({
      where: { companyId: me.companyId, runId: run.id, environment, batchId: { not: null } },
    });
    if (batchedEvents > 0) {
      throw new ConflictException('Este processamento ja possui eventos eSocial em lote. Reabra/cancele o fluxo antes de regenerar.');
    }
    const skipped: Array<{ workerId: string; employeeId: string; reason: string }> = [];
    const eventRows: Array<{
      companyId: string;
      runId: string;
      runWorkerId: string;
      employeeId: string;
      competenceId: string;
      periodRef: string;
      eventType: string;
      environment: string;
      layoutVersion: string;
      eventId: string;
      status: string;
      xml: string;
      xmlHash: string;
      payload: Prisma.InputJsonValue;
      issues?: Prisma.InputJsonValue;
      createdById: string;
    }> = [];

    for (const worker of run.workers) {
      const employee = employeeById.get(worker.employeeId);
      const cpf = onlyDigits(employee?.personnelProfile?.cpf);
      if (!employee || !cpf) {
        skipped.push({ workerId: worker.id, employeeId: worker.employeeId, reason: 'CPF do trabalhador ausente no prontuario.' });
        continue;
      }
      if (worker.status !== 'CALCULATED') {
        skipped.push({ workerId: worker.id, employeeId: worker.employeeId, reason: 'Colaborador do processamento possui pendencias.' });
        continue;
      }
      const eventType = run.kind === 'RESCISAO' ? 'S-2299' : 'S-1200';
      if (eventType !== 'S-1200') {
        skipped.push({ workerId: worker.id, employeeId: worker.employeeId, reason: `${eventType} ainda nao implementado nesta fatia da Fase 4.` });
        continue;
      }
      const issues = this.eventIssues(worker.items.length, employee.personnelProfile?.contractType);
      const eventId = buildEventId({
        employerRegistration,
        createdAt,
        seed: `${run.id}:${worker.id}:${eventType}:${environment}`,
      });
      const paymentId = sanitizeEsocialCode(`${run.kind}-${periodRef}-${worker.id.slice(0, 8)}`, 'G360', 30);
      const payload = {
        source: 'payroll-run',
        sourceUrl: ESOCIAL_SOURCE_URL,
        runId: run.id,
        runKind: run.kind,
        workerId: worker.id,
        employeeId: worker.employeeId,
        employeeName: employee.name,
        periodRef,
        layoutVersion: ESOCIAL_LAYOUT_VERSION,
        environment,
      };
      const xml = buildS1200Xml({
        eventId,
        environment,
        periodRef,
        employerRegistration,
        establishmentRegistration: employerRegistration,
        lotationCode: this.optionalText(body?.lotationCode) || 'G360-GERAL',
        workerCpf: cpf,
        workerRegistration: employee.registrationId || worker.employeeId,
        categoryCode: this.categoryForContract(employee.personnelProfile?.contractType),
        paymentId,
        items: worker.items
          .filter((item) => item.nature === 'PROVENTO' || item.nature === 'DESCONTO')
          .map((item) => ({ code: item.rubricCode, reference: item.reference, amount: item.amount.toString() })),
      });
      eventRows.push({
        companyId: me.companyId,
        runId: run.id,
        runWorkerId: worker.id,
        employeeId: worker.employeeId,
        competenceId: run.competenceId,
        periodRef,
        eventType,
        environment,
        layoutVersion: ESOCIAL_LAYOUT_VERSION,
        eventId,
        status: issues.length ? 'XML_GENERATED_WITH_WARNINGS' : 'XML_GENERATED',
        xml,
        xmlHash: hashXml(xml),
        payload: payload as Prisma.InputJsonValue,
        issues: issues.length ? issues : undefined,
        createdById: me.sub,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payrollEsocialEvent.deleteMany({
        where: { companyId: me.companyId, runId: run.id, environment, batchId: null },
      });
      if (eventRows.length) {
        await tx.payrollEsocialEvent.createMany({ data: eventRows });
      }
    }, { timeout: 120_000, maxWait: 20_000 });

    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollEsocialEvent',
      entityId: run.id,
      action: 'GENERATE',
      message: `Eventos eSocial gerados para ${periodRef}`,
      after: { created: eventRows.length, skipped: skipped.length, environment, layoutVersion: ESOCIAL_LAYOUT_VERSION },
    });
    return {
      created: eventRows.length,
      skipped,
      environment,
      layoutVersion: ESOCIAL_LAYOUT_VERSION,
      events: await this.listEvents(me, run.id),
    };
  }

  /**
   * S-1010 (Tabela de Rubricas): um evento com todas as rubricas ativas da
   * empresa, válidas a partir da competência do processamento. Pré-requisito
   * dos eventos de remuneração; gerado para conferência interna.
   */
  async generateRubricTableEvent(me: AuthPayload, runId: string, body: any = {}) {
    const environment = this.resolveEnvironment(body?.environment);
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, companyId: me.companyId },
      include: { competence: true },
    });
    if (!run) throw new NotFoundException('Processamento de folha nao encontrado.');
    const employerRegistration = await this.employerRegistrationOf(me.companyId);
    const periodRef = `${run.competence.year}-${String(run.competence.month).padStart(2, '0')}`;

    const rubrics = await this.prisma.payrollRubricDef.findMany({
      where: { companyId: me.companyId, active: true },
      orderBy: { code: 'asc' },
      select: { code: true, name: true, nature: true },
    });
    if (!rubrics.length) throw new BadRequestException('Nenhuma rubrica interna cadastrada. Calcule uma folha para semear as rubricas padrao.');

    const createdAt = new Date();
    const eventId = buildEventId({ employerRegistration, createdAt, seed: `${me.companyId}:S-1010:${periodRef}:${environment}` });
    const xml = buildS1010Xml({
      eventId,
      environment,
      employerRegistration,
      rubrics: rubrics.map((rubric) => ({ code: rubric.code, description: rubric.name, nature: rubric.nature, validityRef: periodRef })),
    });
    const issues = ['S-1010 simplificado: natRubr e codIncCP/IRRF/FGTS ficam em branco e exigem parametrizacao/validacao contabil antes de qualquer transmissao.'];

    await this.upsertSingletonEvent(me, {
      runId: run.id,
      competenceId: run.competenceId,
      periodRef,
      eventType: 'S-1010',
      environment,
      eventId,
      xml,
      payload: { source: 'rubric-table', rubricCount: rubrics.length, periodRef, environment, sourceUrl: ESOCIAL_SOURCE_URL },
      issues,
    });
    return { created: 1, eventType: 'S-1010', rubricCount: rubrics.length, environment, layoutVersion: ESOCIAL_LAYOUT_VERSION, events: await this.listEvents(me, run.id) };
  }

  /**
   * S-1299 (Fechamento dos Eventos Periódicos): encerra a apuração do período
   * para conferência interna. Exige eventos de remuneração já gerados no run.
   */
  async generateClosingEvent(me: AuthPayload, runId: string, body: any = {}) {
    const environment = this.resolveEnvironment(body?.environment);
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, companyId: me.companyId },
      include: { competence: true },
    });
    if (!run) throw new NotFoundException('Processamento de folha nao encontrado.');
    const periodRef = `${run.competence.year}-${String(run.competence.month).padStart(2, '0')}`;
    const remunCount = await this.prisma.payrollEsocialEvent.count({
      where: { companyId: me.companyId, runId: run.id, environment, eventType: 'S-1200' },
    });
    if (remunCount === 0) throw new ConflictException('Gere os eventos de remuneracao (S-1200) antes de fechar o periodo.');

    const employerRegistration = await this.employerRegistrationOf(me.companyId);
    const [responsible, responsibleProfile] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: me.sub, companyId: me.companyId }, select: { name: true } }),
      // CPF do responsável vem do prontuário vinculado ao login (via OrgEmployee.userId).
      this.prisma.personnelEmployeeProfile.findFirst({ where: { companyId: me.companyId, userId: me.sub }, select: { cpf: true } }),
    ]);
    const responsibleCpf = onlyDigits(responsibleProfile?.cpf ?? body?.responsibleCpf);

    const createdAt = new Date();
    const eventId = buildEventId({ employerRegistration, createdAt, seed: `${me.companyId}:S-1299:${periodRef}:${environment}` });
    const xml = buildS1299Xml({
      eventId,
      environment,
      periodRef,
      employerRegistration,
      responsibleName: responsible?.name ?? 'Responsavel pela folha',
      responsibleCpf,
      hasRemuneration: true,
    });
    const issues = ['Fechamento interno (S-1299) para conferencia. Nao substitui o fechamento oficial no ambiente do eSocial.'];
    if (!responsibleCpf) issues.push('CPF do responsavel ausente (prontuario sem CPF) — informe antes de transmitir.');

    await this.upsertSingletonEvent(me, {
      runId: run.id,
      competenceId: run.competenceId,
      periodRef,
      eventType: 'S-1299',
      environment,
      eventId,
      xml,
      payload: { source: 'period-closing', periodRef, environment, remunCount, sourceUrl: ESOCIAL_SOURCE_URL },
      issues,
    });
    return { created: 1, eventType: 'S-1299', environment, layoutVersion: ESOCIAL_LAYOUT_VERSION, events: await this.listEvents(me, run.id) };
  }

  /**
   * Upsert idempotente de um evento "singleton" do run (S-1010/S-1299): remove
   * a versão anterior não empacotada e recria; bloqueia se já está em lote.
   */
  private async upsertSingletonEvent(me: AuthPayload, input: {
    runId: string;
    competenceId: string;
    periodRef: string;
    eventType: string;
    environment: EsocialEnvironment;
    eventId: string;
    xml: string;
    payload: Record<string, unknown>;
    issues: string[];
  }) {
    const batched = await this.prisma.payrollEsocialEvent.findFirst({
      where: { companyId: me.companyId, runId: input.runId, eventType: input.eventType, environment: input.environment, batchId: { not: null } },
      select: { id: true },
    });
    if (batched) throw new ConflictException(`Ja existe ${input.eventType} em lote para este processamento. Reabra/cancele antes de regenerar.`);

    await this.prisma.$transaction(async (tx) => {
      await tx.payrollEsocialEvent.deleteMany({
        where: { companyId: me.companyId, runId: input.runId, eventType: input.eventType, environment: input.environment, batchId: null },
      });
      await tx.payrollEsocialEvent.create({
        data: {
          companyId: me.companyId,
          runId: input.runId,
          competenceId: input.competenceId,
          periodRef: input.periodRef,
          eventType: input.eventType,
          environment: input.environment,
          layoutVersion: ESOCIAL_LAYOUT_VERSION,
          eventId: input.eventId,
          status: input.issues.length ? 'XML_GENERATED_WITH_WARNINGS' : 'XML_GENERATED',
          xml: input.xml,
          xmlHash: hashXml(input.xml),
          payload: input.payload as Prisma.InputJsonValue,
          issues: input.issues.length ? input.issues : undefined,
          createdById: me.sub,
        },
      });
    }, { timeout: 60_000, maxWait: 20_000 });

    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollEsocialEvent',
      entityId: input.runId,
      action: 'GENERATE',
      message: `Evento ${input.eventType} gerado para ${input.periodRef}`,
      after: { eventType: input.eventType, environment: input.environment },
    });
  }

  private async employerRegistrationOf(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { cnpj: true } });
    const registration = onlyDigits(company?.cnpj);
    if (!registration) throw new BadRequestException('CNPJ da empresa ausente. Cadastre antes de gerar eventos eSocial.');
    return registration;
  }

  // ------------------------------ lotes ------------------------------

  async listBatches(me: AuthPayload, runId?: string) {
    return this.prisma.payrollEsocialBatch.findMany({
      where: { companyId: me.companyId, ...(runId ? { runId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { certificate: true, events: { select: { id: true, eventId: true, eventType: true, status: true } } },
    }).then((rows) => rows.map((row) => ({
      ...row,
      certificate: row.certificate ? this.redactCertificate(row.certificate) : null,
    })));
  }

  async createBatch(me: AuthPayload, body: any = {}) {
    const ids = Array.isArray(body?.eventIds) ? body.eventIds.map((id: unknown) => String(id)).filter(Boolean) : [];
    if (!ids.length) throw new BadRequestException('Selecione ao menos um evento para montar o lote.');
    const events = await this.prisma.payrollEsocialEvent.findMany({
      where: { companyId: me.companyId, id: { in: ids } },
      orderBy: { createdAt: 'asc' },
    });
    if (events.length !== ids.length) throw new BadRequestException('Algum evento selecionado nao existe nesta empresa.');
    const alreadyBatched = events.find((event) => event.batchId);
    if (alreadyBatched) throw new ConflictException('Um ou mais eventos ja pertencem a um lote.');
    const environments = new Set(events.map((event) => event.environment));
    if (environments.size !== 1) throw new BadRequestException('Nao misture ambientes no mesmo lote.');

    const certificateId = this.optionalText(body?.certificateId);
    let certificate: { id: string; status: string } | null = null;
    if (certificateId) {
      certificate = await this.certificateOf(me.companyId, certificateId);
      if (certificate.status !== 'ACTIVE') throw new ConflictException('Certificado nao esta ativo.');
    }
    const issues = [
      'Lote interno sem assinatura digital. Nao transmitir ao governo.',
      certificate ? 'Certificado referenciado; assinatura real depende de cofre/assinador aprovado.' : 'Nenhum certificado referenciado ao lote.',
    ];
    const runId = events[0]?.runId ?? null;
    const competenceId = events[0]?.competenceId ?? null;
    const periodRef = events[0]?.periodRef ?? null;
    const environment = events[0]?.environment as EsocialEnvironment;

    const created = await this.prisma.$transaction(async (tx) => {
      const batch = await tx.payrollEsocialBatch.create({
        data: {
          companyId: me.companyId,
          runId,
          competenceId,
          periodRef,
          certificateId: certificate?.id ?? null,
          environment,
          layoutVersion: ESOCIAL_LAYOUT_VERSION,
          status: 'STAGED_UNSIGNED',
          eventCount: events.length,
          issues,
          createdById: me.sub,
        },
      });
      const xml = buildInternalBatchXml({
        batchId: batch.id,
        environment,
        layoutVersion: ESOCIAL_LAYOUT_VERSION,
        events: events.map((event) => ({ eventId: event.eventId, eventType: event.eventType, xml: event.xml, xmlHash: event.xmlHash })),
      });
      const updated = await tx.payrollEsocialBatch.update({
        where: { id: batch.id },
        data: { xml, xmlHash: hashXml(xml) },
        include: { certificate: true, events: true },
      });
      await tx.payrollEsocialEvent.updateMany({
        where: { id: { in: events.map((event) => event.id) }, companyId: me.companyId },
        data: { batchId: batch.id, status: 'BATCHED_UNSIGNED' },
      });
      return tx.payrollEsocialBatch.findUniqueOrThrow({
        where: { id: updated.id },
        include: { certificate: true, events: true },
      });
    }, { timeout: 120_000, maxWait: 20_000 });

    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollEsocialBatch',
      entityId: created.id,
      action: 'CREATE',
      message: `Lote eSocial interno montado com ${events.length} evento(s)`,
      after: { eventCount: events.length, status: created.status, environment },
    });
    return { ...created, certificate: created.certificate ? this.redactCertificate(created.certificate) : null };
  }

  async batchXml(me: AuthPayload, batchId: string) {
    const batch = await this.prisma.payrollEsocialBatch.findFirst({
      where: { id: batchId, companyId: me.companyId },
      select: { id: true, status: true, xml: true, xmlHash: true, environment: true, layoutVersion: true, issues: true },
    });
    if (!batch) throw new NotFoundException('Lote eSocial nao encontrado.');
    return batch;
  }

  private resolveEnvironment(value: unknown): EsocialEnvironment {
    const requested = String(value ?? 'PRODUCTION_RESTRICTED').trim().toUpperCase();
    if (requested === 'PRODUCTION') {
      if (process.env.PAYROLL_ESOCIAL_PRODUCTION_ENABLED !== 'true') {
        throw new BadRequestException('Ambiente de producao bloqueado. Use producao restrita ou habilite PAYROLL_ESOCIAL_PRODUCTION_ENABLED=true.');
      }
      return 'PRODUCTION';
    }
    return 'PRODUCTION_RESTRICTED';
  }

  private categoryForContract(contractType: string | null | undefined): string {
    if (contractType === 'APRENDIZ') return '103';
    return '101';
  }

  private eventIssues(itemCount: number, contractType: string | null | undefined): string[] {
    const issues = ['Rubricas internas devem estar espelhadas no S-1010 antes de qualquer transmissao oficial.'];
    if (!contractType) issues.push('Categoria eSocial presumida por ausencia de tipo de contrato no prontuario.');
    if (itemCount === 0) issues.push('Colaborador sem itens de folha no processamento.');
    return issues;
  }

  private async certificateOf(companyId: string, id: string) {
    const cert = await this.prisma.payrollDigitalCertificate.findFirst({ where: { id, companyId } });
    if (!cert) throw new NotFoundException('Certificado digital nao encontrado.');
    return cert;
  }

  private redactCertificate<T extends CertificateLike>(row: T) {
    return {
      ...row,
      pfxSecretRef: undefined,
      passwordSecretRef: undefined,
      hasPfxRef: Boolean(row.pfxSecretRef),
      hasPasswordRef: Boolean(row.passwordSecretRef),
    };
  }

  private rejectInlineSecrets(body: Record<string, unknown>) {
    for (const key of FORBIDDEN_SECRET_KEYS) {
      if (body[key] !== undefined) {
        throw new BadRequestException('Nao envie PFX, senha ou chave privada para a API. Cadastre apenas referencias externas.');
      }
    }
  }

  private objectBody(body: unknown): Record<string, unknown> {
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  }

  private requiredText(value: unknown, label: string): string {
    const text = this.optionalText(value);
    if (!text) throw new BadRequestException(`${label} e obrigatorio.`);
    return text;
  }

  private optionalText(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private optionalDate(value: unknown): Date | null {
    const text = this.optionalText(value);
    if (!text) return null;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Data invalida.');
    return date;
  }
}
