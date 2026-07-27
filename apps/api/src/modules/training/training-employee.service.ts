import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TrainingAttendanceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { TrainingMatrixService } from './training-matrix.service';

/**
 * Meus Treinamentos — visão do próprio colaborador.
 *
 * O colaborador CONSULTA e confirma participação; ele nunca altera resultado,
 * presença, nota ou validade (regra 3.5 do plano). Por isso este serviço não
 * expõe nenhuma escrita sobre a matriz além da confirmação de presença.
 */
@Injectable()
export class TrainingEmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Colaborador vinculado ao login (mesmo elo usado por férias e ponto). */
  private async myEmployee(me: AuthPayload) {
    const profile = await this.prisma.personnelEmployeeProfile.findFirst({
      where: { companyId: me.companyId, userId: me.sub },
      select: { employeeId: true },
    });
    return profile?.employeeId ?? null;
  }

  async myTrainings(me: AuthPayload) {
    const employeeId = await this.myEmployee(me);
    if (!employeeId) {
      // Sem cadastro funcional vinculado não há matriz — estado vazio honesto.
      return { linked: false, compliance: null, workloadHours: 0, items: [], classes: [], certificates: [] };
    }

    const [assignments, classes, certificates] = await Promise.all([
      this.prisma.trainingAssignment.findMany({
        where: { companyId: me.companyId, employeeId, deletedAt: null, status: { not: 'NOT_APPLICABLE' } },
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
        include: {
          training: {
            select: {
              id: true, code: true, name: true, description: true, modality: true, workloadMinutes: true,
              allowsOnline: true, requiresCertificate: true, requiresAssessment: true,
              document: { select: { id: true, code: true, title: true, version: true } },
            },
          },
          class: { select: { id: true, startsAt: true, endsAt: true, location: true, meetingUrl: true, status: true } },
        },
      }),
      this.prisma.trainingClassParticipant.findMany({
        where: {
          companyId: me.companyId,
          employeeId,
          class: { status: { in: ['PLANNED', 'OPEN', 'IN_PROGRESS'] }, deletedAt: null },
        },
        include: {
          class: {
            select: {
              id: true, startsAt: true, endsAt: true, location: true, meetingUrl: true, status: true,
              training: { select: { id: true, code: true, name: true } },
              instructor: { select: { name: true } },
            },
          },
        },
        orderBy: { class: { startsAt: 'asc' } },
      }),
      this.prisma.trainingCertificate.findMany({
        where: { companyId: me.companyId, employeeId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { training: { select: { id: true, code: true, name: true } } },
      }),
    ]);

    const settled = assignments.filter((row) => TrainingMatrixService.SETTLED.includes(row.status)).length;
    const workloadMinutes = assignments
      .filter((row) => row.completedAt)
      .reduce((sum, row) => sum + row.training.workloadMinutes, 0);

    return {
      linked: true,
      compliance: assignments.length > 0 ? settled / assignments.length : null,
      workloadHours: Math.round(workloadMinutes / 60),
      counters: {
        pending: assignments.filter((row) => TrainingMatrixService.OPEN.includes(row.status)).length,
        expired: assignments.filter((row) => row.status === 'EXPIRED').length,
        dueSoon: assignments.filter((row) => row.status === 'DUE_SOON').length,
        scheduled: classes.length,
      },
      items: assignments.map((row) => ({
        id: row.id,
        training: row.training,
        status: row.status,
        mandatory: row.mandatory,
        dueAt: row.dueAt,
        completedAt: row.completedAt,
        validUntil: row.validUntil,
        score: row.score ? Number(row.score) : null,
        result: row.result,
        class: row.class,
      })),
      classes: classes.map((participant) => ({
        participantId: participant.id,
        attendance: participant.attendance,
        waitlisted: participant.waitlisted,
        class: participant.class,
      })),
      certificates: certificates.map((certificate) => ({
        id: certificate.id,
        training: certificate.training,
        status: certificate.status,
        number: certificate.number,
        institution: certificate.institution,
        issuedAt: certificate.issuedAt,
        validUntil: certificate.validUntil,
        fileUrl: certificate.fileUrl,
        fileName: certificate.fileName,
      })),
    };
  }

  /** Confirmar participação na turma — a única escrita permitida ao colaborador. */
  async confirmAttendance(me: AuthPayload, participantId: string) {
    const employeeId = await this.myEmployee(me);
    if (!employeeId) throw new BadRequestException('Seu login não está vinculado a um cadastro de colaborador.');

    const participant = await this.prisma.trainingClassParticipant.findFirst({
      where: { id: participantId, companyId: me.companyId, employeeId },
      include: { class: { select: { status: true } } },
    });
    if (!participant) throw new NotFoundException('Convocação não encontrada.');
    if (participant.class.status === 'CANCELLED' || participant.class.status === 'DONE') {
      throw new BadRequestException('Esta turma não aceita mais confirmação.');
    }
    if (participant.attendance !== TrainingAttendanceStatus.INVITED) {
      throw new BadRequestException('Sua participação já foi registrada.');
    }

    await this.prisma.trainingClassParticipant.update({
      where: { id: participantId },
      data: { attendance: TrainingAttendanceStatus.CONFIRMED },
    });
    if (participant.assignmentId) {
      await this.prisma.trainingAssignment.updateMany({
        where: { id: participant.assignmentId, status: 'SCHEDULED' },
        data: { status: 'CONFIRMED' },
      });
    }
    await this.prisma.trainingHistoryEntry.create({
      data: {
        companyId: me.companyId,
        employeeId,
        assignmentId: participant.assignmentId,
        classId: participant.classId,
        event: 'ENROLLED',
        description: 'Participação confirmada pelo colaborador',
        actorUserId: me.sub,
        source: 'training-employee',
      },
    });
    return { confirmed: true };
  }

  /** Justificar ausência antecipadamente. */
  async justifyAbsence(me: AuthPayload, participantId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Informe o motivo da ausência.');
    const employeeId = await this.myEmployee(me);
    if (!employeeId) throw new BadRequestException('Seu login não está vinculado a um cadastro de colaborador.');

    const participant = await this.prisma.trainingClassParticipant.findFirst({
      where: { id: participantId, companyId: me.companyId, employeeId },
      include: { class: { select: { status: true } } },
    });
    if (!participant) throw new NotFoundException('Convocação não encontrada.');
    if (participant.class.status === 'DONE') throw new BadRequestException('Turma já concluída.');

    await this.prisma.trainingClassParticipant.update({
      where: { id: participantId },
      data: { attendance: TrainingAttendanceStatus.EXCUSED, absenceReason: reason.trim() },
    });
    await this.prisma.trainingHistoryEntry.create({
      data: {
        companyId: me.companyId,
        employeeId,
        assignmentId: participant.assignmentId,
        classId: participant.classId,
        event: 'ABSENT',
        description: `Ausência justificada pelo colaborador: ${reason.trim()}`,
        actorUserId: me.sub,
        source: 'training-employee',
      },
    });
    return { justified: true };
  }
}
