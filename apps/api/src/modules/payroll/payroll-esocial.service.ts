import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import { encryptJson, decryptJson } from '../../common/crypto';
import { parsePkcs12, signEsocialXml } from './payroll-cert.util';
import {
  buildEventId,
  buildInternalBatchXml,
  buildS1010Xml,
  buildS1200Xml,
  buildS1299Xml,
  buildS2200Xml,
  buildS2299Xml,
  ESOCIAL_LAYOUT_VERSION,
  ESOCIAL_SOURCE_URL,
  hashXml,
  onlyDigits,
  sanitizeEsocialCode,
  terminationMotiveCode,
  type EsocialEnvironment,
} from './payroll-esocial.logic';

const MODULE = 'payroll';
const ALLOWED_CERT_STORAGE = ['EXTERNAL_REF', 'ENV_REF'];
const GENERATABLE_RUN_STATUSES = ['CALCULATED', 'APPROVED', 'CLOSED'];
const FORBIDDEN_SECRET_KEYS = ['pfx', 'pfxBase64', 'password', 'senha', 'privateKey', 'certificate', 'certificado', 'file', 'content'];

interface CertificateLike {
  pfxSecretRef?: string | null;
  passwordSecretRef?: string | null;
  encryptedPfx?: string | null;
  encryptedPassword?: string | null;
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
      { key: 'validity', ok: !cert.validUntil || cert.validUntil.getTime() >= Date.now(), detail: cert.validUntil ? `Valido ate ${cert.validUntil.toISOString().slice(0, 10)}` : 'Validade nao informada' },
    ];
    if (cert.storageMode === 'ENCRYPTED_DB') {
      // Decifra e parseia de verdade (sem expor nada) para confirmar que assina.
      let signable = false;
      let detail = 'PFX cifrado ausente';
      try {
        this.resolveSigningMaterial(cert);
        signable = true;
        detail = 'PFX cifrado decifra e parseia — pronto para assinar';
      } catch (error) {
        detail = `Falha ao abrir o PFX cifrado: ${(error as Error).message}`;
      }
      checks.push({ key: 'encrypted_pfx', ok: signable, detail });
    } else {
      checks.push({ key: 'pfx_ref', ok: Boolean(cert.pfxSecretRef), detail: cert.pfxSecretRef ? 'Referencia do PFX cadastrada' : 'Referencia do PFX ausente' });
      checks.push({ key: 'password_ref', ok: Boolean(cert.passwordSecretRef), detail: cert.passwordSecretRef ? 'Referencia da senha cadastrada' : 'Referencia da senha ausente' });
    }
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

  /**
   * Upload do certificado A1 (.pfx) com custódia CIFRADA (modo ENCRYPTED_DB):
   * valida a senha parseando o PKCS#12, extrai metadados (titular/validade),
   * cifra PFX+senha (AES-256-GCM) e guarda. O material sensível nunca volta ao
   * cliente e é decifrado apenas em memória no momento da assinatura.
   */
  async uploadCertificate(me: AuthPayload, body: any = {}) {
    const name = this.requiredText(body?.name, 'Nome do certificado');
    const pfxBase64 = String(body?.pfxBase64 ?? '').replace(/\s+/g, '');
    const password = String(body?.password ?? '');
    if (!pfxBase64) throw new BadRequestException('Envie o arquivo .pfx (base64).');
    if (!password) throw new BadRequestException('Informe a senha do certificado.');

    const parsed = parsePkcs12(pfxBase64, password); // lança se senha/arquivo inválidos
    const created = await this.prisma.payrollDigitalCertificate.create({
      data: {
        companyId: me.companyId,
        name,
        holderName: this.optionalText(body?.holderName) ?? parsed.subjectName,
        holderCpfCnpj: this.optionalText(body?.holderCpfCnpj),
        kind: 'A1',
        storageMode: 'ENCRYPTED_DB',
        encryptedPfx: encryptJson(pfxBase64),
        encryptedPassword: encryptJson(password),
        subjectName: parsed.subjectName,
        serialNumber: parsed.serialNumber,
        validFrom: parsed.validFrom,
        validUntil: parsed.validUntil,
        status: 'ACTIVE',
        notes: this.optionalText(body?.notes),
        createdById: me.sub,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollDigitalCertificate',
      entityId: created.id,
      action: 'CREATE',
      message: `Certificado A1 "${name}" enviado (custódia cifrada)`,
      after: { subjectName: parsed.subjectName, validUntil: parsed.validUntil, storageMode: 'ENCRYPTED_DB' },
    });
    return this.redactCertificate(created);
  }

  /**
   * Material de assinatura (chave/cert em PEM) resolvido conforme o modo de
   * custódia. Só decifra em memória; nada é logado. Adaptador para os modos
   * futuros (procuração, provedor em nuvem) entra aqui.
   */
  private resolveSigningMaterial(cert: {
    storageMode: string;
    encryptedPfx: string | null;
    encryptedPassword: string | null;
    pfxSecretRef: string | null;
    passwordSecretRef: string | null;
  }): { privateKeyPem: string; certPem: string } {
    let pfxBase64: string;
    let password: string;
    if (cert.storageMode === 'ENCRYPTED_DB') {
      if (!cert.encryptedPfx || !cert.encryptedPassword) throw new BadRequestException('Certificado sem PFX cifrado. Reenvie o arquivo.');
      pfxBase64 = decryptJson<string>(cert.encryptedPfx);
      password = decryptJson<string>(cert.encryptedPassword);
    } else if (cert.storageMode === 'ENV_REF') {
      const pfxEnv = cert.pfxSecretRef ? process.env[cert.pfxSecretRef] : undefined;
      const pwdEnv = cert.passwordSecretRef ? process.env[cert.passwordSecretRef] : undefined;
      if (!pfxEnv || !pwdEnv) throw new BadRequestException('Variáveis de ambiente do certificado ausentes na droplet.');
      pfxBase64 = pfxEnv.replace(/\s+/g, '');
      password = pwdEnv;
    } else {
      throw new BadRequestException('Modo de custódia sem material local para assinar (use ENCRYPTED_DB ou ENV_REF).');
    }
    const parsed = parsePkcs12(pfxBase64, password);
    return { privateKeyPem: parsed.privateKeyPem, certPem: parsed.certPem };
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
    // Rescisões dos colaboradores (só quando a run é RESCISAO) — dão motivo e data ao S-2299.
    const terminationByEmployee = new Map<string, { terminationDate: Date; kind: string }>();
    if (run.kind === 'RESCISAO') {
      const terminations = await this.prisma.payrollTermination.findMany({
        where: { companyId: me.companyId, employeeId: { in: employeeIds } },
        select: { employeeId: true, terminationDate: true, kind: true },
      });
      for (const termination of terminations) terminationByEmployee.set(termination.employeeId, termination);
    }
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
      const eventId = buildEventId({
        employerRegistration,
        createdAt,
        seed: `${run.id}:${worker.id}:${eventType}:${environment}`,
      });
      const paymentId = sanitizeEsocialCode(`${run.kind}-${periodRef}-${worker.id.slice(0, 8)}`, 'G360', 30);
      const remunItems = worker.items
        .filter((item) => item.nature === 'PROVENTO' || item.nature === 'DESCONTO')
        .map((item) => ({ code: item.rubricCode, reference: item.reference, amount: item.amount.toString() }));

      let xml: string;
      let issues: string[];
      if (eventType === 'S-2299') {
        const termination = terminationByEmployee.get(worker.employeeId);
        if (!termination) {
          skipped.push({ workerId: worker.id, employeeId: worker.employeeId, reason: 'Sem registro de rescisao (aba Rescisoes) para gerar o S-2299.' });
          continue;
        }
        issues = ['S-2299 simplificado para conferencia: nao projeta aviso/estabilidade nem substitui a homologacao.'];
        xml = buildS2299Xml({
          eventId,
          environment,
          periodRef,
          employerRegistration,
          workerCpf: cpf,
          workerRegistration: employee.registrationId || worker.employeeId,
          terminationDate: termination.terminationDate.toISOString().slice(0, 10),
          motiveCode: terminationMotiveCode(termination.kind),
          paymentId,
          items: remunItems,
        });
      } else {
        issues = this.eventIssues(worker.items.length, employee.personnelProfile?.contractType);
        xml = buildS1200Xml({
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
          items: remunItems,
        });
      }
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

  /**
   * S-2200 (Admissão) para os colaboradores do processamento que ainda não têm
   * o evento. Idempotente: pula quem já possui S-2200 no ambiente. Dados vêm do
   * prontuário (CPF, nascimento, admissão) e do salário-base do processamento.
   */
  async generateAdmissionEvents(me: AuthPayload, runId: string, body: any = {}) {
    const environment = this.resolveEnvironment(body?.environment);
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, companyId: me.companyId },
      include: { competence: true, workers: { select: { employeeId: true, baseSalary: true, status: true } } },
    });
    if (!run) throw new NotFoundException('Processamento de folha nao encontrado.');
    const employerRegistration = await this.employerRegistrationOf(me.companyId);
    const employeeIds = run.workers.map((worker) => worker.employeeId);
    const [employees, existing] = await Promise.all([
      this.prisma.orgEmployee.findMany({
        where: { companyId: me.companyId, id: { in: employeeIds } },
        select: {
          id: true,
          name: true,
          registrationId: true,
          personnelProfile: { select: { cpf: true, birthDate: true, admissionDate: true, contractType: true } },
        },
      }),
      this.prisma.payrollEsocialEvent.findMany({
        where: { companyId: me.companyId, employeeId: { in: employeeIds }, eventType: 'S-2200', environment },
        select: { employeeId: true },
      }),
    ]);
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const alreadyDone = new Set(existing.map((event) => event.employeeId));
    const periodRef = `${run.competence.year}-${String(run.competence.month).padStart(2, '0')}`;
    const createdAt = new Date();
    const skipped: Array<{ employeeId: string; reason: string }> = [];
    const eventRows: Prisma.PayrollEsocialEventCreateManyInput[] = [];

    for (const worker of run.workers) {
      if (alreadyDone.has(worker.employeeId)) {
        skipped.push({ employeeId: worker.employeeId, reason: 'Ja possui S-2200 neste ambiente.' });
        continue;
      }
      const employee = employeeById.get(worker.employeeId);
      const cpf = onlyDigits(employee?.personnelProfile?.cpf);
      const admissionDate = employee?.personnelProfile?.admissionDate;
      if (!employee || !cpf || !admissionDate) {
        skipped.push({ employeeId: worker.employeeId, reason: 'Prontuario sem CPF ou data de admissao.' });
        continue;
      }
      const eventId = buildEventId({ employerRegistration, createdAt, seed: `${me.companyId}:S-2200:${worker.employeeId}:${environment}` });
      const issues = ['S-2200 simplificado: sexo, raca/cor, estado civil, grau de instrucao e CBO ficam em branco e exigem complemento cadastral antes de transmitir.'];
      const xml = buildS2200Xml({
        eventId,
        environment,
        employerRegistration,
        workerCpf: cpf,
        workerName: employee.name,
        birthDate: employee.personnelProfile?.birthDate ? employee.personnelProfile.birthDate.toISOString().slice(0, 10) : null,
        admissionDate: admissionDate.toISOString().slice(0, 10),
        workerRegistration: employee.registrationId || worker.employeeId,
        categoryCode: this.categoryForContract(employee.personnelProfile?.contractType),
        cboCode: null,
        monthlySalary: worker.baseSalary.toString(),
      });
      eventRows.push({
        companyId: me.companyId,
        runId: run.id,
        employeeId: worker.employeeId,
        competenceId: run.competenceId,
        periodRef,
        eventType: 'S-2200',
        environment,
        layoutVersion: ESOCIAL_LAYOUT_VERSION,
        eventId,
        status: 'XML_GENERATED_WITH_WARNINGS',
        xml,
        xmlHash: hashXml(xml),
        payload: { source: 'admission', employeeId: worker.employeeId, employeeName: employee.name, sourceUrl: ESOCIAL_SOURCE_URL } as Prisma.InputJsonValue,
        issues,
        createdById: me.sub,
      });
    }

    if (eventRows.length) {
      await this.prisma.payrollEsocialEvent.createMany({ data: eventRows });
      await this.audit.record(me, {
        module: MODULE,
        entity: 'PayrollEsocialEvent',
        entityId: run.id,
        action: 'GENERATE',
        message: `Eventos S-2200 (admissao) gerados: ${eventRows.length}`,
        after: { created: eventRows.length, environment },
      });
    }
    return { created: eventRows.length, skipped, eventType: 'S-2200', environment, layoutVersion: ESOCIAL_LAYOUT_VERSION, events: await this.listEvents(me, run.id) };
  }

  /**
   * Reconciliação de totalizadores: como não há transmissão, deriva dos eventos
   * gerados do processamento a "prévia" das bases que o governo retornaria
   * (S-5001 base CP/INSS, S-5002 base IRRF) e compara com os totais internos do
   * cálculo. Divergência deve ser zero (mesma fonte) — serve de verificação da
   * extração do XML e de base para a conciliação real após transmissão futura.
   */
  async reconcileTotalizers(me: AuthPayload, runId: string, body: any = {}) {
    const environment = this.resolveEnvironment(body?.environment);
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, companyId: me.companyId },
      include: { workers: { select: { employeeId: true, inssBase: true, inssValue: true, irrfBase: true, irrfValue: true, fgtsBase: true, fgtsValue: true, status: true } } },
    });
    if (!run) throw new NotFoundException('Processamento de folha nao encontrado.');
    const events = await this.prisma.payrollEsocialEvent.findMany({
      where: { companyId: me.companyId, runId: run.id, environment, eventType: { in: ['S-1200', 'S-2299'] } },
      select: { employeeId: true, eventType: true },
    });
    const withEvent = new Set(events.map((event) => event.employeeId));

    const toNumber = (value: { toString(): string }) => Number(value.toString());
    let inssBase = 0;
    let inssValue = 0;
    let irrfBase = 0;
    let irrfValue = 0;
    let fgtsBase = 0;
    let fgtsValue = 0;
    let workersWithoutEvent = 0;
    for (const worker of run.workers) {
      if (worker.status !== 'CALCULATED') continue;
      inssBase += toNumber(worker.inssBase);
      inssValue += toNumber(worker.inssValue);
      irrfBase += toNumber(worker.irrfBase);
      irrfValue += toNumber(worker.irrfValue);
      fgtsBase += toNumber(worker.fgtsBase);
      fgtsValue += toNumber(worker.fgtsValue);
      if (!withEvent.has(worker.employeeId)) workersWithoutEvent += 1;
    }
    const round2 = (value: number) => Math.round(value * 100) / 100;
    const totalizers = {
      s5001CpBase: round2(inssBase),
      s5001CpValue: round2(inssValue),
      s5002IrrfBase: round2(irrfBase),
      s5002IrrfValue: round2(irrfValue),
      fgtsBase: round2(fgtsBase),
      fgtsValue: round2(fgtsValue),
    };
    const issues: string[] = ['Prévia dos totalizadores derivada do cálculo interno — o governo não retornou S-5001/S-5002 (nada foi transmitido).'];
    if (workersWithoutEvent > 0) issues.push(`${workersWithoutEvent} colaborador(es) calculado(s) sem evento eSocial gerado — gere os eventos antes de conciliar.`);

    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollEsocialEvent',
      entityId: run.id,
      action: 'RECONCILE',
      message: `Prévia de totalizadores conciliada para ${run.workers.length} colaborador(es)`,
      after: { ...totalizers, environment },
    });
    return {
      runId: run.id,
      environment,
      eventCount: events.length,
      workersCalculated: run.workers.filter((worker) => worker.status === 'CALCULATED').length,
      workersWithoutEvent,
      totalizers,
      issues,
    };
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

  /**
   * Assina os eventos de um lote com XML-DSig (enveloped, SHA-256/RSA) usando o
   * certificado A1 em custódia cifrada. Assinar NÃO transmite nem tem efeito
   * legal — é o passo local que prepara o lote; a transmissão SOAP é etapa
   * seguinte e permanece não implementada.
   */
  async signBatch(me: AuthPayload, batchId: string) {
    const batch = await this.prisma.payrollEsocialBatch.findFirst({
      where: { id: batchId, companyId: me.companyId },
      include: { events: true },
    });
    if (!batch) throw new NotFoundException('Lote eSocial nao encontrado.');
    if (!batch.certificateId) throw new BadRequestException('Vincule um certificado ao lote antes de assinar.');
    if (batch.status === 'SIGNED') throw new ConflictException('Lote ja assinado.');
    const cert = await this.certificateOf(me.companyId, batch.certificateId);
    if (cert.status !== 'ACTIVE') throw new ConflictException('Certificado nao esta ativo.');
    if (cert.validUntil && cert.validUntil.getTime() < Date.now()) throw new ConflictException('Certificado vencido.');
    if (!batch.events.length) throw new BadRequestException('Lote sem eventos.');

    // Decifra e parseia UMA vez; a chave privada só existe nesta chamada.
    const { privateKeyPem, certPem } = this.resolveSigningMaterial(cert);

    const signedEvents: Array<{ eventId: string; eventType: string; xml: string; xmlHash: string }> = [];
    await this.prisma.$transaction(async (tx) => {
      for (const event of batch.events) {
        const signedXml = signEsocialXml(event.xml, privateKeyPem, certPem);
        const xmlHash = hashXml(signedXml);
        await tx.payrollEsocialEvent.update({
          where: { id: event.id },
          data: { xml: signedXml, xmlHash, status: 'SIGNED' },
        });
        signedEvents.push({ eventId: event.eventId, eventType: event.eventType, xml: signedXml, xmlHash });
      }
      const batchXml = buildInternalBatchXml({
        batchId: batch.id,
        environment: batch.environment as EsocialEnvironment,
        layoutVersion: ESOCIAL_LAYOUT_VERSION,
        events: signedEvents,
      });
      await tx.payrollEsocialBatch.update({
        where: { id: batch.id },
        data: {
          status: 'SIGNED',
          xml: batchXml,
          xmlHash: hashXml(batchXml),
          issues: [
            'Lote assinado (XML-DSig) para conferência. NÃO transmitido: a transmissão SOAP ao eSocial é etapa seguinte.',
            'Valide o XML assinado no validador oficial antes de qualquer envio em produção.',
          ],
        },
      });
    }, { timeout: 120_000, maxWait: 20_000 });

    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollEsocialBatch',
      entityId: batch.id,
      action: 'SIGN',
      message: `Lote eSocial assinado (${signedEvents.length} evento(s)) com o certificado ${cert.name}`,
      after: { eventCount: signedEvents.length, certificateId: cert.id, subjectName: cert.subjectName },
    });
    return { signed: signedEvents.length, batchId: batch.id, status: 'SIGNED' };
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
      // Material sensível NUNCA volta ao cliente — só flags de presença.
      pfxSecretRef: undefined,
      passwordSecretRef: undefined,
      encryptedPfx: undefined,
      encryptedPassword: undefined,
      hasPfxRef: Boolean(row.pfxSecretRef),
      hasPasswordRef: Boolean(row.passwordSecretRef),
      hasEncryptedPfx: Boolean(row.encryptedPfx),
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
