import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import {
  canRecordAso,
  canRequestAso,
  canScheduleAso,
  normalizeAsoResult,
  preAdmissionStatusAfterAso,
  redactAsoForRecruitment,
} from './recruit-occupational-health.logic';

const MODULE = 'recruitment';

@Injectable()
export class RecruitOccupationalHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  // ------------------------------ visao operacional ------------------------------

  async listForApplication(me: AuthPayload, applicationId: string) {
    await this.applicationOrFail(me.companyId, applicationId);
    const rows = await this.prisma.recruitOccupationalExamRequest.findMany({
      where: { companyId: me.companyId, applicationId },
      orderBy: { createdAt: 'desc' },
      include: safeAsoInclude(),
    });
    return rows.map(toRecruitmentView);
  }

  async requestAso(me: AuthPayload, applicationId: string, body: any = {}) {
    const app = await this.applicationOrFail(me.companyId, applicationId);
    const pre = await this.pickPreAdmission(me.companyId, applicationId, text(body?.preAdmissionId));
    if (!canRequestAso(pre.status)) {
      throw new ConflictException('A pre-admissao precisa estar pronta para ASO antes da solicitacao.');
    }
    const active = await this.prisma.recruitOccupationalExamRequest.findFirst({
      where: { companyId: me.companyId, preAdmissionId: pre.id, status: { in: ['REQUESTED', 'SCHEDULED'] } },
    });
    if (active) throw new ConflictException('Ja existe ASO admissional em aberto para esta pre-admissao.');

    const dueAt = body?.dueAt ? parseDate(body.dueAt, 'Prazo do ASO invalido.') : null;
    const saved = await this.prisma.$transaction(async (tx) => {
      const request = await tx.recruitOccupationalExamRequest.create({
        data: {
          companyId: me.companyId,
          applicationId: app.id,
          preAdmissionId: pre.id,
          status: 'REQUESTED',
          examType: 'ADMISSIONAL',
          dueAt,
          operationalNotes: text(body?.operationalNotes ?? body?.notes),
          requestedById: me.sub,
        },
      });
      await tx.recruitPreAdmission.update({ where: { id: pre.id }, data: { status: 'IN_ASO' } });
      await tx.recruitApplicationEvent.create({
        data: { companyId: me.companyId, applicationId: app.id, type: 'ASO_REQUESTED', note: dueAt ? `Prazo: ${dueAt.toISOString().slice(0, 10)}` : null, actorType: 'USER', actorId: me.sub },
      });
      return request;
    });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitOccupationalExamRequest', entityId: saved.id, action: 'CREATE', message: 'ASO admissional solicitado', after: { applicationId, preAdmissionId: pre.id } });
    return this.recruitmentViewOrFail(me.companyId, saved.id);
  }

  async cancelAso(me: AuthPayload, id: string, body: any = {}) {
    const request = await this.requestOrFail(me.companyId, id, true);
    if (request.status === 'COMPLETED') throw new ConflictException('ASO ja concluido nao pode ser cancelado.');
    if (request.status === 'CANCELLED') return toRecruitmentView(request);
    const reason = text(body?.reason);
    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.recruitOccupationalExamRequest.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledById: me.sub, cancelledAt: new Date(), cancellationReason: reason },
        include: safeAsoInclude(),
      });
      if (request.appointment) {
        await tx.recruitOccupationalAppointment.update({ where: { requestId: id }, data: { status: 'CANCELLED' } });
      }
      if (request.preAdmissionId && request.preAdmission?.status === 'IN_ASO') {
        await tx.recruitPreAdmission.update({ where: { id: request.preAdmissionId }, data: { status: 'READY_FOR_ASO' } });
      }
      await tx.recruitApplicationEvent.create({ data: { companyId: me.companyId, applicationId: request.applicationId, type: 'ASO_CANCELLED', note: reason, actorType: 'USER', actorId: me.sub } });
      return updated;
    });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitOccupationalExamRequest', entityId: id, action: 'CANCEL', message: reason ? `ASO cancelado: ${reason}` : 'ASO cancelado' });
    return toRecruitmentView(saved);
  }

  // ------------------------------ saude ocupacional ------------------------------

  async listHealthQueue(me: AuthPayload, filters: { status?: string } = {}) {
    const status = text(filters.status)?.toUpperCase();
    const rows = await this.prisma.recruitOccupationalExamRequest.findMany({
      where: { companyId: me.companyId, ...(status ? { status } : {}) },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 300,
      include: healthAsoInclude(),
    });
    return rows;
  }

  async getMedicalRecord(me: AuthPayload, id: string) {
    return this.requestOrFail(me.companyId, id, true, true);
  }

  async scheduleAso(me: AuthPayload, id: string, body: any = {}) {
    const request = await this.requestOrFail(me.companyId, id, true);
    if (!canScheduleAso(request.status)) throw new ConflictException('Este ASO nao pode ser agendado.');
    const scheduledAt = parseDate(body?.scheduledAt, 'Data/hora do agendamento e obrigatoria.');
    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.recruitOccupationalAppointment.upsert({
        where: { requestId: id },
        update: {
          status: 'SCHEDULED',
          scheduledAt,
          location: text(body?.location),
          providerName: text(body?.providerName),
          instructions: text(body?.instructions),
        },
        create: {
          companyId: me.companyId,
          requestId: id,
          status: 'SCHEDULED',
          scheduledAt,
          location: text(body?.location),
          providerName: text(body?.providerName),
          instructions: text(body?.instructions),
          createdById: me.sub,
        },
      });
      const updated = await tx.recruitOccupationalExamRequest.update({ where: { id }, data: { status: 'SCHEDULED' }, include: safeAsoInclude() });
      await tx.recruitApplicationEvent.create({
        data: { companyId: me.companyId, applicationId: request.applicationId, type: 'ASO_SCHEDULED', note: scheduledAt.toISOString(), actorType: 'USER', actorId: me.sub },
      });
      return updated;
    });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitOccupationalExamRequest', entityId: id, action: 'SCHEDULE', message: 'ASO admissional agendado', after: { scheduledAt } });
    return toRecruitmentView(saved);
  }

  async recordAsoResult(me: AuthPayload, id: string, body: any = {}) {
    const request = await this.requestOrFail(me.companyId, id, true);
    if (!canRecordAso(request.status)) throw new ConflictException('Este ASO nao pode receber resultado.');
    const result = normalizeAsoResult(body?.result);
    if (!result) throw new BadRequestException('Resultado invalido (APTO/APTO_COM_RESTRICAO/INAPTO).');
    const examDate = parseDate(body?.examDate, 'Data do exame e obrigatoria.');
    const validUntil = body?.validUntil ? parseDate(body.validUntil, 'Validade invalida.') : null;
    if (validUntil && validUntil.getTime() < examDate.getTime()) throw new BadRequestException('Validade anterior a data do exame.');
    const nextPreAdmissionStatus = preAdmissionStatusAfterAso(result);

    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.recruitAsoRecord.upsert({
        where: { requestId: id },
        update: {
          result,
          examDate,
          validUntil,
          physicianName: text(body?.physicianName),
          physicianRegistry: text(body?.physicianRegistry),
          clinicalNotes: text(body?.clinicalNotes),
          restrictionNotes: text(body?.restrictionNotes),
          cidCodes: normalizeCidCodes(body?.cidCodes),
          reportedById: me.sub,
          reportedAt: new Date(),
        },
        create: {
          companyId: me.companyId,
          requestId: id,
          result,
          examDate,
          validUntil,
          physicianName: text(body?.physicianName),
          physicianRegistry: text(body?.physicianRegistry),
          clinicalNotes: text(body?.clinicalNotes),
          restrictionNotes: text(body?.restrictionNotes),
          cidCodes: normalizeCidCodes(body?.cidCodes),
          reportedById: me.sub,
        },
      });
      if (request.appointment) {
        await tx.recruitOccupationalAppointment.update({ where: { requestId: id }, data: { status: 'COMPLETED' } });
      }
      const updated = await tx.recruitOccupationalExamRequest.update({ where: { id }, data: { status: 'COMPLETED' }, include: safeAsoInclude() });
      if (request.preAdmissionId) {
        await tx.recruitPreAdmission.update({ where: { id: request.preAdmissionId }, data: { status: nextPreAdmissionStatus } });
      }
      await tx.recruitApplicationEvent.create({
        data: { companyId: me.companyId, applicationId: request.applicationId, type: nextPreAdmissionStatus === 'ASO_CLEARED' ? 'ASO_CLEARED' : 'ASO_BLOCKED', note: result, actorType: 'USER', actorId: me.sub },
      });
      return updated;
    });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitAsoRecord', entityId: id, action: 'RESULT', message: `Resultado do ASO: ${result}`, after: { result, examDate, validUntil, preAdmissionStatus: nextPreAdmissionStatus } });
    return toRecruitmentView(saved);
  }

  // ------------------------------ helpers ------------------------------

  private async applicationOrFail(companyId: string, id: string) {
    const app = await this.prisma.recruitApplication.findFirst({ where: { id, companyId }, select: { id: true, status: true } });
    if (!app) throw new NotFoundException('Candidatura nao encontrada.');
    return app;
  }

  private async pickPreAdmission(companyId: string, applicationId: string, preAdmissionId: string | null) {
    const where = preAdmissionId
      ? { id: preAdmissionId, companyId, applicationId }
      : { companyId, applicationId, status: { not: 'CANCELLED' } };
    const pre = await this.prisma.recruitPreAdmission.findFirst({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });
    if (!pre) throw new NotFoundException('Pre-admissao nao encontrada para solicitar ASO.');
    return pre;
  }

  private async requestOrFail(companyId: string, id: string, includeSafe = false, includeSensitive = false) {
    const request = await this.prisma.recruitOccupationalExamRequest.findFirst({
      where: { id, companyId },
      include: includeSensitive ? healthAsoInclude() : includeSafe ? safeAsoInclude() : undefined,
    });
    if (!request) throw new NotFoundException('ASO admissional nao encontrado.');
    return request as typeof request & {
      appointment?: { id: string } | null;
      preAdmission?: { status: string } | null;
      preAdmissionId?: string | null;
    };
  }

  private async recruitmentViewOrFail(companyId: string, id: string) {
    const request = await this.prisma.recruitOccupationalExamRequest.findFirst({
      where: { id, companyId },
      include: safeAsoInclude(),
    });
    if (!request) throw new NotFoundException('ASO admissional nao encontrado.');
    return toRecruitmentView(request);
  }
}

export function safeAsoInclude() {
  return {
    preAdmission: { select: { id: true, status: true } },
    appointment: {
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        location: true,
        providerName: true,
        instructions: true,
        candidateNotifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },
    asoRecord: {
      select: {
        id: true,
        result: true,
        examDate: true,
        validUntil: true,
        reportedAt: true,
      },
    },
  } satisfies Prisma.RecruitOccupationalExamRequestInclude;
}

function healthAsoInclude() {
  return {
    application: {
      include: {
        candidate: { select: { id: true, name: true, email: true, phone: true, city: true } },
        posting: { select: { id: true, title: true, slug: true } },
      },
    },
    preAdmission: true,
    appointment: true,
    asoRecord: true,
  } satisfies Prisma.RecruitOccupationalExamRequestInclude;
}

function toRecruitmentView(request: any) {
  return {
    id: request.id,
    companyId: request.companyId,
    applicationId: request.applicationId,
    preAdmissionId: request.preAdmissionId,
    status: request.status,
    examType: request.examType,
    dueAt: request.dueAt,
    requestedAt: request.requestedAt,
    cancelledAt: request.cancelledAt,
    operationalNotes: request.operationalNotes,
    appointment: request.appointment ?? null,
    asoRecord: redactAsoForRecruitment(request.asoRecord),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

function text(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}

function parseDate(value: unknown, message: string): Date {
  const date = new Date(String(value ?? ''));
  if (!Number.isFinite(date.getTime())) throw new BadRequestException(message);
  return date;
}

function normalizeCidCodes(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  return value as Prisma.InputJsonValue;
}
