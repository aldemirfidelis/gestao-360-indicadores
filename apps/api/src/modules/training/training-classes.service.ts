import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  TrainingAssignmentStatus,
  TrainingAttendanceMethod,
  TrainingAttendanceStatus,
  TrainingClassStatus,
  TrainingResult,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { TrainingMatrixService } from './training-matrix.service';

const MODULE = 'Treinamento';

/**
 * Turmas: agenda, participantes, presença e resultado.
 *
 * Concluir a turma é o evento que fecha a pendência da matriz — presença e nota
 * viram conclusão, validade e (quando exigido) avaliação de eficácia agendada.
 */
@Injectable()
export class TrainingClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matrix: TrainingMatrixService,
    private readonly audit: AuditWriterService,
  ) {}

  async list(companyId: string, query: { status?: string; trainingId?: string; from?: string; to?: string }) {
    const where: Prisma.TrainingClassWhereInput = { companyId, deletedAt: null };
    if (query.status && Object.values(TrainingClassStatus).includes(query.status as TrainingClassStatus)) {
      where.status = query.status as TrainingClassStatus;
    }
    if (query.trainingId) where.trainingId = query.trainingId;
    const from = this.toDate(query.from);
    const to = this.toDate(query.to);
    if (from || to) where.startsAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

    const rows = await this.prisma.trainingClass.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      include: {
        training: { select: { id: true, code: true, name: true, workloadMinutes: true, requiresAttendance: true } },
        instructor: { select: { id: true, name: true } },
        _count: { select: { participants: true } },
      },
      take: 300,
    });
    return rows.map((row) => this.toClass(row));
  }

  async detail(companyId: string, id: string) {
    const row = await this.prisma.trainingClass.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        training: {
          select: {
            id: true, code: true, name: true, workloadMinutes: true, requiresAttendance: true,
            requiresAssessment: true, minimumScore: true, requiresCertificate: true,
            document: { select: { id: true, code: true, title: true, version: true } },
          },
        },
        instructor: { select: { id: true, name: true } },
        participants: {
          orderBy: { createdAt: 'asc' },
          include: {
            employee: {
              select: {
                id: true, name: true, registrationId: true,
                job: { select: { name: true } },
                orgNode: { select: { name: true } },
              },
            },
          },
        },
        evidences: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException('Turma não encontrada.');

    return {
      ...this.toClass(row),
      document: row.training.document,
      requiresAssessment: row.training.requiresAssessment,
      minimumScore: row.training.minimumScore ? Number(row.training.minimumScore) : null,
      requiresCertificate: row.training.requiresCertificate,
      participants: row.participants.map((participant) => ({
        id: participant.id,
        employeeId: participant.employeeId,
        name: participant.employee.name,
        registrationId: participant.employee.registrationId,
        job: participant.employee.job?.name ?? null,
        area: participant.employee.orgNode?.name ?? null,
        attendance: participant.attendance,
        attendanceMethod: participant.attendanceMethod,
        attendedAt: participant.attendedAt,
        score: participant.score ? Number(participant.score) : null,
        result: participant.result,
        absenceReason: participant.absenceReason,
        waitlisted: participant.waitlisted,
        assignmentId: participant.assignmentId,
      })),
      evidences: row.evidences,
    };
  }

  async create(me: AuthPayload, body: any) {
    const training = await this.prisma.training.findFirst({
      where: { id: String(body?.trainingId ?? ''), companyId: me.companyId, deletedAt: null },
      select: { id: true, name: true, defaultInstructorId: true },
    });
    if (!training) throw new BadRequestException('Treinamento inválido.');

    const startsAt = this.toDate(body?.startsAt);
    if (!startsAt) throw new BadRequestException('Informe a data e a hora da turma.');
    const endsAt = this.toDate(body?.endsAt);
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('O término da turma precisa ser depois do início.');
    }
    const capacity = this.toInt(body?.capacity);
    if (capacity !== null && capacity <= 0) throw new BadRequestException('A capacidade deve ser maior que zero.');

    const created = await this.prisma.trainingClass.create({
      data: {
        companyId: me.companyId,
        trainingId: training.id,
        code: body.code?.trim() || null,
        instructorId: body.instructorId || training.defaultInstructorId || null,
        startsAt,
        endsAt,
        location: body.location?.trim() || null,
        meetingUrl: body.meetingUrl?.trim() || null,
        capacity,
        attendanceMethod: body.attendanceMethod || TrainingAttendanceMethod.INSTRUCTOR,
        notes: body.notes?.trim() || null,
        createdById: me.sub,
      },
      select: { id: true },
    });

    await this.audit.record(me, { action: 'CREATE', module: MODULE, entity: 'TrainingClass', entityId: created.id, message: training.name });

    // Conveniência do plano: "todos os colaboradores pendentes deste treinamento".
    if (body.addPendingParticipants) {
      await this.addPendingParticipants(me, created.id);
    } else if (Array.isArray(body.employeeIds) && body.employeeIds.length > 0) {
      await this.addParticipants(me, created.id, body.employeeIds);
    }

    return this.detail(me.companyId, created.id);
  }

  async update(me: AuthPayload, id: string, body: any) {
    const current = await this.assertOpen(me.companyId, id);
    const startsAt = body.startsAt !== undefined ? this.toDate(body.startsAt) : undefined;
    const endsAt = body.endsAt !== undefined ? this.toDate(body.endsAt) : undefined;
    if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('O término da turma precisa ser depois do início.');
    }

    await this.prisma.trainingClass.update({
      where: { id },
      data: {
        ...(startsAt ? { startsAt } : {}),
        ...(body.endsAt !== undefined ? { endsAt } : {}),
        ...(body.instructorId !== undefined ? { instructorId: body.instructorId || null } : {}),
        ...(body.location !== undefined ? { location: body.location?.trim() || null } : {}),
        ...(body.meetingUrl !== undefined ? { meetingUrl: body.meetingUrl?.trim() || null } : {}),
        ...(body.capacity !== undefined ? { capacity: this.toInt(body.capacity) } : {}),
        ...(body.attendanceMethod !== undefined ? { attendanceMethod: body.attendanceMethod } : {}),
        ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.actualCostCents !== undefined ? { actualCostCents: this.toInt(body.actualCostCents) } : {}),
      },
    });
    await this.audit.record(me, { action: 'UPDATE', module: MODULE, entity: 'TrainingClass', entityId: id, before: { startsAt: current.startsAt, status: current.status } });
    return this.detail(me.companyId, id);
  }

  /** Inclui todos os colaboradores com pendência aberta neste treinamento. */
  async addPendingParticipants(me: AuthPayload, classId: string) {
    const turma = await this.assertOpen(me.companyId, classId);
    const pending = await this.prisma.trainingAssignment.findMany({
      where: {
        companyId: me.companyId,
        trainingId: turma.trainingId,
        deletedAt: null,
        status: { in: TrainingMatrixService.OPEN },
        employee: { status: 'ACTIVE' },
      },
      select: { id: true, employeeId: true },
      take: 500,
    });
    if (pending.length === 0) return { added: 0 };
    return this.attachParticipants(me, turma, pending.map((row) => ({ employeeId: row.employeeId, assignmentId: row.id })));
  }

  async addParticipants(me: AuthPayload, classId: string, employeeIds: string[]) {
    const turma = await this.assertOpen(me.companyId, classId);
    const ids = Array.from(new Set(employeeIds.filter(Boolean)));
    if (ids.length === 0) throw new BadRequestException('Selecione ao menos um colaborador.');

    const employees = await this.prisma.orgEmployee.findMany({
      where: { id: { in: ids }, companyId: me.companyId },
      select: { id: true },
    });
    if (employees.length !== ids.length) throw new BadRequestException('Algum colaborador não pertence a esta empresa.');

    // Liga o participante à pendência que a turma resolve, quando existir.
    const assignments = await this.prisma.trainingAssignment.findMany({
      where: {
        companyId: me.companyId,
        trainingId: turma.trainingId,
        employeeId: { in: ids },
        deletedAt: null,
        status: { in: TrainingMatrixService.OPEN },
      },
      select: { id: true, employeeId: true },
    });
    const assignmentByEmployee = new Map(assignments.map((row) => [row.employeeId, row.id]));

    return this.attachParticipants(
      me,
      turma,
      ids.map((employeeId) => ({ employeeId, assignmentId: assignmentByEmployee.get(employeeId) ?? null })),
    );
  }

  private async attachParticipants(
    me: AuthPayload,
    turma: { id: string; capacity: number | null; trainingId: string },
    rows: Array<{ employeeId: string; assignmentId: string | null }>,
  ) {
    const existing = await this.prisma.trainingClassParticipant.findMany({
      where: { classId: turma.id },
      select: { employeeId: true },
    });
    const already = new Set(existing.map((row) => row.employeeId));
    const fresh = rows.filter((row) => !already.has(row.employeeId));
    if (fresh.length === 0) return { added: 0 };

    // Capacidade excedida entra em lista de espera em vez de barrar a operação.
    const free = turma.capacity ? Math.max(0, turma.capacity - already.size) : fresh.length;

    await this.prisma.trainingClassParticipant.createMany({
      data: fresh.map((row, index) => ({
        companyId: me.companyId,
        classId: turma.id,
        employeeId: row.employeeId,
        assignmentId: row.assignmentId,
        waitlisted: index >= free,
      })),
      skipDuplicates: true,
    });

    // A pendência passa a "programada" e aponta para a turma.
    const assignmentIds = fresh.map((row) => row.assignmentId).filter((id): id is string => Boolean(id));
    if (assignmentIds.length > 0) {
      await this.prisma.trainingAssignment.updateMany({
        where: { id: { in: assignmentIds } },
        data: { status: TrainingAssignmentStatus.SCHEDULED, classId: turma.id },
      });
      await this.prisma.trainingHistoryEntry.createMany({
        data: fresh
          .filter((row) => row.assignmentId)
          .map((row) => ({
            companyId: me.companyId,
            employeeId: row.employeeId,
            assignmentId: row.assignmentId,
            trainingId: turma.trainingId,
            classId: turma.id,
            event: 'ENROLLED',
            description: 'Inscrito em turma',
            actorUserId: me.sub,
            source: 'training-classes',
          })),
      });
    }

    return { added: fresh.length, waitlisted: Math.max(0, fresh.length - free) };
  }

  async removeParticipant(me: AuthPayload, classId: string, participantId: string) {
    const turma = await this.assertOpen(me.companyId, classId);
    const participant = await this.prisma.trainingClassParticipant.findFirst({
      where: { id: participantId, classId, companyId: me.companyId },
    });
    if (!participant) throw new NotFoundException('Participante não encontrado.');

    await this.prisma.trainingClassParticipant.delete({ where: { id: participantId } });
    if (participant.assignmentId) {
      // Volta a pendência para a fila.
      await this.prisma.trainingAssignment.updateMany({
        where: { id: participant.assignmentId, status: TrainingAssignmentStatus.SCHEDULED },
        data: { status: TrainingAssignmentStatus.PENDING, classId: null },
      });
    }
    await this.audit.record(me, { action: 'DELETE', module: MODULE, entity: 'TrainingClassParticipant', entityId: participantId, message: turma.id });
    return { removed: true };
  }

  /** Presença e nota, um participante por vez ou em lote. */
  async setAttendance(
    me: AuthPayload,
    classId: string,
    entries: Array<{ participantId: string; attendance: TrainingAttendanceStatus; score?: number | null; absenceReason?: string }>,
  ) {
    const turma = await this.assertOpen(me.companyId, classId);
    if (!Array.isArray(entries) || entries.length === 0) throw new BadRequestException('Informe ao menos um registro de presença.');

    const now = new Date();
    for (const entry of entries) {
      const participant = await this.prisma.trainingClassParticipant.findFirst({
        where: { id: entry.participantId, classId, companyId: me.companyId },
      });
      if (!participant) continue;
      if (entry.attendance === TrainingAttendanceStatus.ABSENT && !entry.absenceReason?.trim()) {
        throw new BadRequestException('Informe o motivo da ausência.');
      }
      await this.prisma.trainingClassParticipant.update({
        where: { id: participant.id },
        data: {
          attendance: entry.attendance,
          attendanceMethod: turma.attendanceMethod,
          attendedAt: entry.attendance === TrainingAttendanceStatus.PRESENT ? now : null,
          score: entry.score === undefined || entry.score === null ? participant.score : new Prisma.Decimal(entry.score),
          absenceReason: entry.absenceReason?.trim() || null,
        },
      });
    }

    await this.prisma.trainingClass.update({
      where: { id: classId },
      data: { status: TrainingClassStatus.IN_PROGRESS },
    });
    await this.audit.record(me, { action: 'ATTENDANCE', module: MODULE, entity: 'TrainingClass', entityId: classId, message: `${entries.length} registro(s)` });
    return this.detail(me.companyId, classId);
  }

  /**
   * Conclui a turma: aplica a regra de aprovação, fecha as pendências e calcula
   * a validade de cada participante aprovado.
   */
  async close(me: AuthPayload, classId: string) {
    const turma = await this.prisma.trainingClass.findFirst({
      where: { id: classId, companyId: me.companyId, deletedAt: null },
      include: {
        training: { select: { id: true, name: true, requiresAttendance: true, requiresAssessment: true, minimumScore: true } },
        participants: true,
      },
    });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (turma.status === TrainingClassStatus.DONE) throw new ConflictException('Esta turma já foi concluída.');
    if (turma.status === TrainingClassStatus.CANCELLED) throw new ConflictException('Turma cancelada não pode ser concluída.');
    if (turma.participants.length === 0) throw new BadRequestException('Inclua participantes antes de concluir a turma.');

    const minimum = turma.training.minimumScore ? Number(turma.training.minimumScore) : null;
    const pendingAttendance = turma.participants.filter((p) => p.attendance === TrainingAttendanceStatus.INVITED || p.attendance === TrainingAttendanceStatus.CONFIRMED);
    if (turma.training.requiresAttendance && pendingAttendance.length > 0) {
      throw new BadRequestException(`Registre a presença de ${pendingAttendance.length} participante(s) antes de concluir.`);
    }

    const now = new Date();
    let approved = 0;
    let failed = 0;

    for (const participant of turma.participants) {
      const present = participant.attendance === TrainingAttendanceStatus.PRESENT;
      const score = participant.score ? Number(participant.score) : null;

      // Regra de aprovação: presença quando exigida + nota mínima quando exigida.
      let isApproved = present;
      if (turma.training.requiresAttendance && !present) isApproved = false;
      if (turma.training.requiresAssessment) {
        if (score === null) {
          throw new BadRequestException('Este treinamento exige avaliação: informe a nota de todos os presentes.');
        }
        if (minimum !== null && score < minimum) isApproved = false;
      }

      await this.prisma.trainingClassParticipant.update({
        where: { id: participant.id },
        data: { result: isApproved ? TrainingResult.APPROVED : TrainingResult.FAILED },
      });

      if (participant.assignmentId) {
        await this.matrix.completeAssignment(participant.assignmentId, {
          completedAt: now,
          score,
          approved: isApproved,
          classId,
          actorUserId: me.sub,
        });
      }

      await this.prisma.trainingHistoryEntry.create({
        data: {
          companyId: me.companyId,
          employeeId: participant.employeeId,
          assignmentId: participant.assignmentId,
          trainingId: turma.trainingId,
          classId,
          event: present ? 'ATTENDED' : 'ABSENT',
          description: present ? 'Participou da turma' : `Ausente${participant.absenceReason ? `: ${participant.absenceReason}` : ''}`,
          newValue: isApproved ? 'APPROVED' : 'FAILED',
          actorUserId: me.sub,
          source: 'training-classes',
        },
      });

      if (isApproved) approved += 1;
      else failed += 1;
    }

    await this.prisma.trainingClass.update({
      where: { id: classId },
      data: { status: TrainingClassStatus.DONE, closedAt: now, closedById: me.sub },
    });
    await this.audit.record(me, {
      action: 'CLOSE',
      module: MODULE,
      entity: 'TrainingClass',
      entityId: classId,
      message: turma.training.name,
      after: { approved, failed },
    });

    return { closed: true, approved, failed };
  }

  async cancel(me: AuthPayload, classId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Informe o motivo do cancelamento.');
    const turma = await this.prisma.trainingClass.findFirst({ where: { id: classId, companyId: me.companyId, deletedAt: null } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (turma.status === TrainingClassStatus.DONE) throw new ConflictException('Turma concluída não pode ser cancelada.');

    await this.prisma.trainingClass.update({
      where: { id: classId },
      data: { status: TrainingClassStatus.CANCELLED, notes: reason.trim() },
    });
    // Pendências programadas voltam para a fila.
    await this.prisma.trainingAssignment.updateMany({
      where: { classId, status: TrainingAssignmentStatus.SCHEDULED },
      data: { status: TrainingAssignmentStatus.PENDING, classId: null },
    });
    await this.audit.record(me, { action: 'CANCEL', module: MODULE, entity: 'TrainingClass', entityId: classId, message: reason });
    return { cancelled: true };
  }

  // ---------------------------------------------------------------- helpers

  private async assertOpen(companyId: string, id: string) {
    const turma = await this.prisma.trainingClass.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    if (turma.status === TrainingClassStatus.DONE) throw new ConflictException('Turma concluída não pode ser alterada.');
    if (turma.status === TrainingClassStatus.CANCELLED) throw new ConflictException('Turma cancelada não pode ser alterada.');
    return turma;
  }

  private toClass(row: any) {
    return {
      id: row.id,
      code: row.code,
      training: row.training,
      instructor: row.instructor,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      location: row.location,
      meetingUrl: row.meetingUrl,
      capacity: row.capacity,
      status: row.status,
      attendanceMethod: row.attendanceMethod,
      actualCostCents: row.actualCostCents,
      notes: row.notes,
      closedAt: row.closedAt,
      participantCount: row._count?.participants ?? row.participants?.length ?? 0,
    };
  }

  private toDate(value: unknown): Date | null {
    if (!value) return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Data inválida.');
    return date;
  }

  private toInt(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
}
