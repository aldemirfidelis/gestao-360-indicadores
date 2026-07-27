import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TrainingCertificateOrigin, TrainingCertificateStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { TrainingMatrixService } from './training-matrix.service';

const MODULE = 'Treinamento';

/**
 * Certificados e evidências externas.
 *
 * Regra do plano: certificado externo NÃO conta na matriz automaticamente —
 * precisa passar por validação. Só ao ser validado ele conclui a pendência e
 * define a validade.
 */
@Injectable()
export class TrainingCertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matrix: TrainingMatrixService,
    private readonly audit: AuditWriterService,
  ) {}

  async list(companyId: string, query: { status?: string; employeeId?: string; trainingId?: string }) {
    const where: Prisma.TrainingCertificateWhereInput = { companyId, deletedAt: null };
    if (query.status && Object.values(TrainingCertificateStatus).includes(query.status as TrainingCertificateStatus)) {
      where.status = query.status as TrainingCertificateStatus;
    }
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.trainingId) where.trainingId = query.trainingId;

    const rows = await this.prisma.trainingCertificate.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        employee: { select: { id: true, name: true, registrationId: true, orgNode: { select: { name: true } } } },
        training: { select: { id: true, code: true, name: true } },
      },
      take: 500,
    });
    return rows.map((row) => this.toCertificate(row));
  }

  async create(me: AuthPayload, body: any) {
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { id: String(body?.employeeId ?? ''), companyId: me.companyId },
      select: { id: true, name: true },
    });
    if (!employee) throw new BadRequestException('Colaborador não encontrado nesta empresa.');

    if (body.trainingId) {
      const training = await this.prisma.training.findFirst({
        where: { id: body.trainingId, companyId: me.companyId, deletedAt: null },
        select: { id: true },
      });
      if (!training) throw new BadRequestException('Treinamento inválido.');
    }

    const issuedAt = this.toDate(body?.issuedAt);
    const validUntil = this.toDate(body?.validUntil);
    if (issuedAt && validUntil && validUntil.getTime() <= issuedAt.getTime()) {
      throw new BadRequestException('A validade precisa ser posterior à data de realização.');
    }

    const origin = body.origin === 'INTERNAL' ? TrainingCertificateOrigin.INTERNAL : TrainingCertificateOrigin.EXTERNAL;
    const created = await this.prisma.trainingCertificate.create({
      data: {
        companyId: me.companyId,
        employeeId: employee.id,
        trainingId: body.trainingId || null,
        assignmentId: body.assignmentId || null,
        origin,
        // Interno emitido pelo próprio sistema já nasce válido; externo aguarda validação.
        status: origin === TrainingCertificateOrigin.INTERNAL ? TrainingCertificateStatus.VALID : TrainingCertificateStatus.PENDING_VALIDATION,
        number: body.number?.trim() || null,
        institution: body.institution?.trim() || null,
        workloadMinutes: this.toInt(body.workloadMinutes),
        issuedAt,
        validUntil,
        documentId: body.documentId || null,
        fileUrl: body.fileUrl || null,
        fileName: body.fileName?.trim() || null,
        createdById: me.sub,
      },
      select: { id: true },
    });

    await this.prisma.trainingHistoryEntry.create({
      data: {
        companyId: me.companyId,
        employeeId: employee.id,
        assignmentId: body.assignmentId || null,
        trainingId: body.trainingId || null,
        event: 'CERTIFIED',
        description: origin === TrainingCertificateOrigin.EXTERNAL ? 'Certificado externo enviado para validação' : 'Certificado emitido',
        actorUserId: me.sub,
        source: 'training-certificates',
      },
    });
    await this.audit.record(me, { action: 'CREATE', module: MODULE, entity: 'TrainingCertificate', entityId: created.id, message: employee.name });

    return this.detail(me.companyId, created.id);
  }

  /**
   * Validação do certificado externo. Aprovar é o que conclui a pendência da
   * matriz — antes disso o treinamento não conta como realizado.
   */
  async decide(me: AuthPayload, id: string, action: 'approve' | 'reject', note?: string) {
    const certificate = await this.prisma.trainingCertificate.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: { training: { select: { id: true, name: true } } },
    });
    if (!certificate) throw new NotFoundException('Certificado não encontrado.');
    if (certificate.status !== TrainingCertificateStatus.PENDING_VALIDATION) {
      throw new BadRequestException('Este certificado já foi avaliado.');
    }
    if (action === 'reject' && !note?.trim()) {
      throw new BadRequestException('Informe o motivo da recusa.');
    }

    const now = new Date();
    await this.prisma.trainingCertificate.update({
      where: { id },
      data: {
        status: action === 'approve' ? TrainingCertificateStatus.VALID : TrainingCertificateStatus.REJECTED,
        validatedById: me.sub,
        validatedAt: now,
        rejectionNote: action === 'reject' ? note!.trim() : null,
      },
    });

    if (action === 'approve' && certificate.assignmentId) {
      // O certificado comprova a realização: fecha a célula da matriz.
      await this.matrix.completeAssignment(certificate.assignmentId, {
        completedAt: certificate.issuedAt ?? now,
        approved: true,
        actorUserId: me.sub,
      });
      // Certificado com validade própria manda na data de vencimento.
      if (certificate.validUntil) {
        await this.prisma.trainingAssignment.update({
          where: { id: certificate.assignmentId },
          data: { validUntil: certificate.validUntil },
        });
      }
    }

    await this.prisma.trainingHistoryEntry.create({
      data: {
        companyId: me.companyId,
        employeeId: certificate.employeeId,
        assignmentId: certificate.assignmentId,
        trainingId: certificate.trainingId,
        event: action === 'approve' ? 'CERTIFIED' : 'FAILED',
        description: action === 'approve' ? 'Certificado validado' : `Certificado recusado: ${note}`,
        actorUserId: me.sub,
        source: 'training-certificates',
      },
    });
    await this.audit.record(me, {
      action: action === 'approve' ? 'VALIDATE' : 'REJECT',
      module: MODULE,
      entity: 'TrainingCertificate',
      entityId: id,
      message: certificate.training?.name ?? 'Certificado',
      after: { status: action === 'approve' ? 'VALID' : 'REJECTED', note: note ?? null },
    });

    return this.detail(me.companyId, id);
  }

  async detail(companyId: string, id: string) {
    const row = await this.prisma.trainingCertificate.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        employee: { select: { id: true, name: true, registrationId: true, orgNode: { select: { name: true } } } },
        training: { select: { id: true, code: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException('Certificado não encontrado.');
    return this.toCertificate(row);
  }

  private toCertificate(row: any) {
    return {
      id: row.id,
      employee: row.employee,
      training: row.training,
      assignmentId: row.assignmentId,
      origin: row.origin,
      status: row.status,
      number: row.number,
      institution: row.institution,
      workloadMinutes: row.workloadMinutes,
      issuedAt: row.issuedAt,
      validUntil: row.validUntil,
      fileName: row.fileName,
      fileUrl: row.fileUrl,
      validatedAt: row.validatedAt,
      rejectionNote: row.rejectionNote,
      createdAt: row.createdAt,
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
