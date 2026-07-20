import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import { EmployeesService } from '../personnel/employees.service';
import { LifecycleService } from '../personnel/lifecycle.service';
import { PayrollEsocialService } from '../payroll/payroll-esocial.service';
import { evaluateAdmissionReadiness, normalizeCpfRequired, probationReviewDueDates } from './recruit-admission.logic';
import { RecruitCommunicationService, resolveCompanyDisplayName } from './recruit-communication.service';

const MODULE = 'recruitment';

@Injectable()
export class RecruitAdmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly employees: EmployeesService,
    private readonly lifecycle: LifecycleService,
    private readonly esocial: PayrollEsocialService,
    private readonly communication: RecruitCommunicationService,
  ) {}

  async getAdmission(me: AuthPayload, applicationId: string) {
    await this.applicationExists(me.companyId, applicationId);
    return this.prisma.recruitAdmission.findFirst({
      where: { companyId: me.companyId, applicationId },
      include: { probationReviews: { orderBy: { cycleDay: 'asc' } } },
    });
  }

  async authorizeAdmission(me: AuthPayload, applicationId: string, body: any = {}) {
    const existing = await this.prisma.recruitAdmission.findFirst({
      where: { companyId: me.companyId, applicationId },
      include: { probationReviews: { orderBy: { cycleDay: 'asc' } } },
    });
    if (existing?.employeeId) return existing;

    const ctx = await this.loadContext(me.companyId, applicationId);
    const offer = this.acceptedOffer(ctx, text(body?.offerId));
    const pre = this.readyPreAdmission(ctx, text(body?.preAdmissionId), offer.id);
    const aso = this.clearedAso(pre);
    const readiness = evaluateAdmissionReadiness({
      applicationStatus: ctx.status,
      offerStatus: offer.status,
      preAdmissionStatus: pre.status,
      asoResult: aso.result,
    });
    if (!readiness.ready) throw new ConflictException(readiness.blocks.join(' '));

    const profileData = objectRecord(ctx.candidate.profileData);
    const cpf = normalizeCpfRequired(body?.cpf ?? profileData.cpf);
    if (!cpf) throw new BadRequestException('CPF valido e obrigatorio para autorizar a admissao.');
    const admissionDate = parseDate(body?.admissionDate ?? offer.startDate ?? pre.admissionTargetDate, 'Data de admissao e obrigatoria.');
    const requisition = await this.requisitionFor(me.companyId, ctx.posting.requisitionId);
    const opening = await this.nextOpening(me.companyId, requisition.id);
    const plannedPositionId = opening?.positionId ?? requisition.positionId ?? null;
    if (plannedPositionId) await this.assertPositionAvailable(me.companyId, plannedPositionId);

    const salary = centsToDecimal(offer.salaryAmountCents);
    const employee = await this.employees.create(me, {
      name: text(body?.name) ?? ctx.candidate.name,
      registrationId: text(body?.registrationId),
      jobId: requisition.orgJobId ?? undefined,
      jobName: requisition.orgJobId ? undefined : ctx.posting.title,
      orgNodeId: requisition.orgNodeId ?? undefined,
      profile: {
        cpf,
        admissionDate,
        birthDate: body?.birthDate ?? profileData.birthDate,
        personalEmail: body?.personalEmail ?? ctx.candidate.email,
        phone: body?.phone ?? ctx.candidate.phone,
        city: body?.city ?? ctx.candidate.city,
        address: body?.address ?? profileData.address,
        state: body?.state ?? profileData.state,
        zipCode: body?.zipCode ?? profileData.zipCode,
        sex: body?.sex ?? profileData.sex,
        raceColor: body?.raceColor ?? profileData.raceColor,
        maritalStatus: body?.maritalStatus ?? profileData.maritalStatus,
        educationLevel: body?.educationLevel ?? profileData.educationLevel,
        pisPasep: body?.pisPasep ?? profileData.pisPasep,
        contractType: body?.contractType ?? offer.contractType ?? requisition.contractType ?? 'CLT',
        workRegime: body?.workRegime ?? offer.workMode ?? requisition.workMode,
        bankCode: body?.bankCode ?? profileData.bankCode,
        bankAgency: body?.bankAgency ?? profileData.bankAgency,
        bankAccount: body?.bankAccount ?? profileData.bankAccount,
        bankAccountDigit: body?.bankAccountDigit ?? profileData.bankAccountDigit,
        pixKey: body?.pixKey ?? profileData.pixKey,
        notes: text(body?.notes) ?? 'Admissao originada pelo recrutamento.',
      },
    });

    const employeeId = employee.id as string;
    const employeeJobId = employee.jobId as string;
    const admission = await this.prisma.$transaction(async (tx) => {
      const positionId = await this.occupyOrCreatePosition(tx, me, {
        requisition,
        opening,
        plannedPositionId,
        employeeId,
        employeeJobId,
        salary,
        admissionDate,
      });
      const openingId = await this.fillOpening(tx, me.companyId, requisition, opening?.id ?? null, positionId, employeeId, offer.salaryAmountCents);
      await tx.compensationSalarySnapshot.create({
        data: {
          companyId: me.companyId,
          employeeId,
          orgJobId: employeeJobId,
          jobCatalogId: requisition.jobCatalogId,
          currentSalary: salary,
          effectiveFrom: admissionDate,
          reason: 'Admissao via recrutamento',
          createdById: me.sub,
        },
      });
      const dossierCount = await this.copyApprovedDocumentsToDossier(tx, me.companyId, employeeId, pre.documents, me.sub);
      await tx.medicalExam.create({
        data: {
          companyId: me.companyId,
          employeeId,
          type: 'ADMISSIONAL',
          examDate: aso.examDate,
          validUntil: aso.validUntil,
          result: aso.result,
          physician: aso.physicianName,
          notes: 'ASO admissional originado do recrutamento.',
          createdById: me.sub,
        },
      });
      const saved = await tx.recruitAdmission.create({
        data: {
          companyId: me.companyId,
          applicationId,
          preAdmissionId: pre.id,
          offerId: offer.id,
          status: 'EMPLOYEE_CREATED',
          employeeId,
          positionId,
          openingId,
          admissionDate,
          authorizedById: me.sub,
          notes: text(body?.notes),
          payload: {
            salaryAmountCents: offer.salaryAmountCents,
            dossierFilesCreated: dossierCount,
            candidateId: ctx.candidateId,
          } as Prisma.InputJsonValue,
          probationReviews: {
            create: probationReviewDueDates(admissionDate).map((review) => ({
              companyId: me.companyId,
              employeeId,
              cycleDay: review.cycleDay,
              dueAt: review.dueAt,
            })),
          },
        },
      });
      await tx.recruitApplication.update({
        where: { id: applicationId },
        data: { status: 'HIRED', currentStageId: await this.finalStageId(tx, me.companyId, ctx.posting.pipelineTemplateId) },
      });
      await tx.recruitPreAdmission.update({ where: { id: pre.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
      await tx.recruitApplicationEvent.create({
        data: { companyId: me.companyId, applicationId, type: 'ADMISSION_AUTHORIZED', note: `Colaborador ${employeeId}`, actorType: 'USER', actorId: me.sub },
      });
      return saved;
    }, { timeout: 120_000, maxWait: 20_000 });

    const process = await this.lifecycle.startProcess(me, {
      employeeId,
      kind: 'ONBOARDING',
      dueDate: body?.onboardingDueDate ?? addDays(admissionDate, 15),
      notes: `Onboarding iniciado pelo recrutamento (${ctx.posting.title}).`,
    });
    await this.prisma.recruitAdmission.update({
      where: { id: admission.id },
      data: { onboardingProcessId: process.id, status: 'ONBOARDING_STARTED' },
    });

    await this.generateEsocialSafe(me, admission.id, employeeId, offer.salaryAmountCents, body);
    await this.audit.record(me, {
      module: MODULE,
      entity: 'RecruitAdmission',
      entityId: admission.id,
      action: 'AUTHORIZE',
      message: `Admissao autorizada para ${ctx.candidate.name}`,
      after: { applicationId, employeeId },
    });
    const companyName = await resolveCompanyDisplayName(this.prisma, me.companyId);
    void this.communication.sendEvent(me.companyId, 'ADMISSION_AUTHORIZED', ctx.candidate.email, {
      candidato: ctx.candidate.name,
      vaga: ctx.posting.title,
      empresa: companyName,
    });
    return this.getAdmission(me, applicationId);
  }

  async completeProbationReview(me: AuthPayload, id: string, body: any = {}) {
    const review = await this.prisma.recruitProbationReview.findFirst({
      where: { id, companyId: me.companyId },
      include: { admission: true },
    });
    if (!review) throw new NotFoundException('Avaliacao de experiencia nao encontrada.');
    if (review.status !== 'PENDING') throw new ConflictException('Esta avaliacao ja foi encerrada.');
    const recommendation = text(body?.recommendation) ?? 'CONTINUAR';
    const saved = await this.prisma.recruitProbationReview.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        reviewerId: me.sub,
        completedAt: new Date(),
        recommendation,
        notes: text(body?.notes),
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'RecruitProbationReview',
      entityId: id,
      action: 'COMPLETE',
      message: `Avaliacao de experiencia D+${review.cycleDay}: ${recommendation}`,
    });
    return saved;
  }

  private async generateEsocialSafe(me: AuthPayload, admissionId: string, employeeId: string, salaryAmountCents: number, body: any) {
    try {
      const result = await this.esocial.generateAdmissionEventForEmployee(me, employeeId, {
        environment: body?.environment,
        baseSalaryCents: salaryAmountCents,
      });
      const event = result.event as { id?: string } | null;
      await this.prisma.recruitAdmission.update({
        where: { id: admissionId },
        data: {
          esocialEventId: event?.id ?? null,
          esocialStatus: result.created > 0 ? 'GENERATED' : 'SKIPPED',
          status: result.created > 0 ? 'ESOCIAL_GENERATED' : 'ESOCIAL_PENDING',
        },
      });
    } catch (error) {
      await this.prisma.recruitAdmission.update({
        where: { id: admissionId },
        data: {
          esocialStatus: 'ERROR',
          status: 'ESOCIAL_PENDING',
          payload: { esocialError: String((error as Error).message ?? error) } as Prisma.InputJsonValue,
        },
      });
    }
  }

  private async loadContext(companyId: string, applicationId: string) {
    const app = await this.prisma.recruitApplication.findFirst({
      where: { id: applicationId, companyId },
      include: {
        candidate: true,
        posting: { select: { id: true, title: true, requisitionId: true, pipelineTemplateId: true } },
        offers: { orderBy: { createdAt: 'desc' } },
        preAdmissions: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'desc' },
          include: {
            documents: { include: { candidateDocument: true }, orderBy: { createdAt: 'asc' } },
            occupationalExamRequests: { include: { asoRecord: true }, orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });
    if (!app) throw new NotFoundException('Candidatura nao encontrada.');
    return app;
  }

  private acceptedOffer(app: { offers: Array<any> }, offerId: string | null) {
    const offer = offerId ? app.offers.find((item) => item.id === offerId) : app.offers.find((item) => item.status === 'ACCEPTED');
    if (!offer || offer.status !== 'ACCEPTED') throw new ConflictException('A candidatura precisa ter uma proposta aceita.');
    return offer;
  }

  private readyPreAdmission(app: { preAdmissions: Array<any> }, preAdmissionId: string | null, offerId: string) {
    const pre = preAdmissionId
      ? app.preAdmissions.find((item) => item.id === preAdmissionId)
      : app.preAdmissions.find((item) => item.offerId === offerId && item.status === 'ASO_CLEARED') ?? app.preAdmissions.find((item) => item.status === 'ASO_CLEARED');
    if (!pre) throw new ConflictException('Pre-admissao liberada pelo ASO nao encontrada.');
    return pre;
  }

  private clearedAso(pre: { occupationalExamRequests?: Array<{ status: string; asoRecord: any }> }) {
    const record = (pre.occupationalExamRequests ?? []).find((item) => item.status === 'COMPLETED' && item.asoRecord)?.asoRecord;
    if (!record || !['APTO', 'APTO_COM_RESTRICAO'].includes(record.result)) {
      throw new ConflictException('ASO admissional precisa estar apto para autorizar a admissao.');
    }
    return record;
  }

  private async requisitionFor(companyId: string, id: string) {
    const req = await this.prisma.recruitRequisition.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!req) throw new NotFoundException('Requisicao da vaga nao encontrada.');
    return req;
  }

  private async nextOpening(companyId: string, requisitionId: string) {
    return this.prisma.recruitRequisitionOpening.findFirst({
      where: { companyId, requisitionId, status: { in: ['OPEN', 'RESERVED'] } },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async assertPositionAvailable(companyId: string, positionId: string) {
    const position = await this.prisma.compensationPosition.findFirst({
      where: { id: positionId, companyId, deletedAt: null },
      select: { id: true, currentEmployeeId: true },
    });
    if (!position) throw new NotFoundException('Posicao nao encontrada.');
    if (position.currentEmployeeId) throw new ConflictException('Posicao ja ocupada por outro colaborador.');
  }

  private async occupyOrCreatePosition(tx: Prisma.TransactionClient, me: AuthPayload, input: {
    requisition: Awaited<ReturnType<RecruitAdmissionService['requisitionFor']>>;
    opening: Awaited<ReturnType<RecruitAdmissionService['nextOpening']>>;
    plannedPositionId: string | null;
    employeeId: string;
    employeeJobId: string;
    salary: Prisma.Decimal;
    admissionDate: Date;
  }) {
    if (input.plannedPositionId) {
      const result = await tx.compensationPosition.updateMany({
        where: {
          id: input.plannedPositionId,
          companyId: me.companyId,
          deletedAt: null,
          OR: [{ currentEmployeeId: null }, { currentEmployeeId: input.employeeId }],
        },
        data: {
          currentEmployeeId: input.employeeId,
          orgJobId: input.employeeJobId,
          orgNodeId: input.requisition.orgNodeId,
          status: 'OCCUPIED',
          plannedSalary: input.salary,
          activeFrom: input.admissionDate,
          updatedById: me.sub,
        },
      });
      if (result.count === 0) throw new ConflictException('Posicao nao esta disponivel para ocupacao.');
      await this.allocationHistory(tx, me, input.plannedPositionId, input.employeeId, null, input.employeeJobId, input.admissionDate);
      return input.plannedPositionId;
    }
    const position = await tx.compensationPosition.create({
      data: {
        companyId: me.companyId,
        code: await this.nextPositionCode(tx, me.companyId, input.requisition.code),
        jobCatalogId: input.requisition.jobCatalogId,
        orgJobId: input.employeeJobId,
        orgNodeId: input.requisition.orgNodeId,
        costCenter: input.requisition.costCenter,
        shift: input.requisition.shift,
        plannedSalary: input.salary,
        budgetAmount: input.salary,
        status: 'OCCUPIED',
        positionType: input.requisition.vacancyType === 'TEMPORARIA' ? 'TEMPORARY' : 'PERMANENT',
        budgetStatus: 'IN_BUDGET',
        currentEmployeeId: input.employeeId,
        activeFrom: input.admissionDate,
        createdById: me.sub,
        updatedById: me.sub,
      },
    });
    await this.allocationHistory(tx, me, position.id, input.employeeId, null, input.employeeJobId, input.admissionDate);
    return position.id;
  }

  private async fillOpening(tx: Prisma.TransactionClient, companyId: string, requisition: Awaited<ReturnType<RecruitAdmissionService['requisitionFor']>>, openingId: string | null, positionId: string, employeeId: string, salaryAmountCents: number) {
    let filledOpeningId = openingId;
    if (!filledOpeningId) {
      const opening = await tx.recruitRequisitionOpening.findFirst({
        where: { companyId, requisitionId: requisition.id, status: { in: ['OPEN', 'RESERVED'] } },
        orderBy: { createdAt: 'asc' },
      });
      filledOpeningId = opening?.id ?? null;
    }
    if (filledOpeningId) {
      await tx.recruitRequisitionOpening.update({
        where: { id: filledOpeningId },
        data: { status: 'FILLED', positionId, filledByEmployeeId: employeeId, filledAt: new Date() },
      });
    }
    const remaining = await tx.recruitRequisitionOpening.count({
      where: { companyId, requisitionId: requisition.id, status: { in: ['OPEN', 'RESERVED'] } },
    });
    await tx.recruitRequisition.update({
      where: { id: requisition.id },
      data: {
        status: remaining === 0 ? 'FILLED' : requisition.status,
        reservedHeadcount: Math.max(0, requisition.reservedHeadcount - 1),
        reservedBudgetCents: Math.max(0, (requisition.reservedBudgetCents ?? 0) - salaryAmountCents),
      },
    });
    if (remaining === 0) {
      await tx.recruitJobPosting.updateMany({
        where: { companyId, requisitionId: requisition.id, deletedAt: null },
        data: { status: 'CLOSED', closesAt: new Date() },
      });
    }
    return filledOpeningId;
  }

  private async copyApprovedDocumentsToDossier(tx: Prisma.TransactionClient, companyId: string, employeeId: string, documents: Array<any>, userId: string) {
    const approved = documents.filter((doc) => doc.status === 'APPROVED' && doc.candidateDocument && !doc.candidateDocument.deletedAt);
    if (!approved.length) return 0;
    await tx.employeeDossierFile.createMany({
      data: approved.map((doc) => ({
        companyId,
        employeeId,
        kind: dossierKind(doc.kind),
        name: doc.title,
        fileName: doc.candidateDocument.fileName,
        mimeType: doc.candidateDocument.mimeType,
        sizeBytes: doc.candidateDocument.sizeBytes,
        hashSha256: doc.candidateDocument.hashSha256,
        storageKey: doc.candidateDocument.storageKey,
        note: 'Documento validado na pre-admissao.',
        createdById: userId,
      })),
    });
    return approved.length;
  }

  private async allocationHistory(tx: Prisma.TransactionClient, me: AuthPayload, positionId: string, employeeId: string, fromJobId: string | null, toJobId: string, effectiveAt: Date) {
    await tx.compensationAllocationHistory.create({
      data: {
        companyId: me.companyId,
        positionId,
        employeeId,
        fromJobId,
        toJobId,
        toPositionId: positionId,
        reason: 'ADMISSAO_RECRUTAMENTO',
        justification: 'Admissao autorizada pelo ATS.',
        effectiveAt,
        changedById: me.sub,
      },
    });
  }

  private async finalStageId(tx: Prisma.TransactionClient, companyId: string, templateId: string | null) {
    if (!templateId) return null;
    const stage = await tx.recruitPipelineStage.findFirst({
      where: { companyId, templateId, type: 'FINAL' },
      orderBy: { order: 'desc' },
      select: { id: true },
    });
    return stage?.id ?? null;
  }

  private async nextPositionCode(tx: Prisma.TransactionClient, companyId: string, reqCode: string) {
    let n = 1;
    let code = `ATS-${reqCode}`;
    while (await tx.compensationPosition.findFirst({ where: { companyId, code }, select: { id: true } })) {
      n += 1;
      code = `ATS-${reqCode}-${n}`;
    }
    return code;
  }

  private async applicationExists(companyId: string, applicationId: string) {
    const exists = await this.prisma.recruitApplication.findFirst({ where: { id: applicationId, companyId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Candidatura nao encontrada.');
  }
}

function text(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}

function objectRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function parseDate(value: unknown, message: string): Date {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  if (!Number.isFinite(date.getTime())) throw new BadRequestException(message);
  return date;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function centsToDecimal(cents: number): Prisma.Decimal {
  return new Prisma.Decimal((Math.round(cents) / 100).toFixed(2));
}

function dossierKind(kind: string): string {
  const map: Record<string, string> = {
    IDENTITY: 'RG',
    CPF: 'CPF',
    PROOF_OF_ADDRESS: 'COMPROVANTE_RESIDENCIA',
    BANK: 'OUTRO',
    EDUCATION: 'CERTIFICADO',
    CERTIFICATE: 'CERTIFICADO',
  };
  return map[kind] ?? 'OUTRO';
}
