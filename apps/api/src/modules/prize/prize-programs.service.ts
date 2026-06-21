import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrizeProgramStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';

export interface UpsertProgramDto {
  code?: string;
  name?: string;
  description?: string | null;
  orgNodeId?: string | null;
  programType?: string | null;
  periodicity?: string;
  currency?: string;
  validFrom?: string | null;
  validTo?: string | null;
  status?: PrizeProgramStatus;
  roundingRule?: string | null;
  closeDay?: number | null;
  approvalDeadlineDay?: number | null;
  payrollDeadlineDay?: number | null;
  defaultRubric?: string | null;
  ownerUserId?: string | null;
  approvers?: unknown;
  eligibility?: unknown;
  notes?: string | null;
}

const EDITABLE_PERIODICITY = ['MONTHLY', 'WEEKLY', 'DAILY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'];

@Injectable()
export class PrizeProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
  ) {}

  async list(companyId: string, query: { status?: string; q?: string } = {}) {
    const programs = await this.prisma.prizeProgram.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(query.status ? { status: query.status as PrizeProgramStatus } : {}),
        ...(query.q
          ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q, mode: 'insensitive' } }] }
          : {}),
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { competences: true, annexes: true, indicators: true, versions: true } },
      },
    });
    return programs;
  }

  async get(companyId: string, id: string) {
    const program = await this.prisma.prizeProgram.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 10 },
        _count: { select: { competences: true, annexes: true, indicators: true } },
      },
    });
    if (!program) throw new NotFoundException('Programa de prêmio não encontrado');
    return program;
  }

  async create(me: AuthPayload, dto: UpsertProgramDto) {
    const code = (dto.code ?? '').trim() || (await this.nextCode(me.companyId));
    if (!dto.name?.trim()) throw new BadRequestException('Nome do programa é obrigatório');
    if (dto.periodicity && !EDITABLE_PERIODICITY.includes(dto.periodicity)) {
      throw new BadRequestException('Periodicidade inválida');
    }
    await this.assertUniqueCode(me.companyId, code);

    const program = await this.prisma.prizeProgram.create({
      data: {
        companyId: me.companyId,
        code,
        name: dto.name.trim(),
        description: dto.description ?? null,
        orgNodeId: dto.orgNodeId ?? null,
        programType: dto.programType ?? null,
        periodicity: (dto.periodicity as any) ?? 'MONTHLY',
        currency: dto.currency ?? 'BRL',
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
        status: dto.status ?? 'DRAFT',
        roundingRule: dto.roundingRule ?? 'HALF_UP_2',
        closeDay: dto.closeDay ?? null,
        approvalDeadlineDay: dto.approvalDeadlineDay ?? null,
        payrollDeadlineDay: dto.payrollDeadlineDay ?? null,
        defaultRubric: dto.defaultRubric ?? null,
        ownerUserId: dto.ownerUserId ?? null,
        approvers: (dto.approvers as Prisma.InputJsonValue) ?? undefined,
        eligibility: (dto.eligibility as Prisma.InputJsonValue) ?? undefined,
        notes: dto.notes ?? null,
        createdById: me.sub,
      },
    });
    await this.snapshot(me.companyId, program.id, me.sub, 'Criação do programa');
    await this.audit.log(me, { action: 'CREATE', entityType: 'PROGRAM', entityId: program.id, after: program });
    return program;
  }

  async update(me: AuthPayload, id: string, dto: UpsertProgramDto) {
    const current = await this.get(me.companyId, id);
    if (dto.code && dto.code.trim() !== current.code) {
      await this.assertUniqueCode(me.companyId, dto.code.trim());
    }
    const updated = await this.prisma.prizeProgram.update({
      where: { id },
      data: {
        code: dto.code?.trim() ?? undefined,
        name: dto.name?.trim() ?? undefined,
        description: dto.description ?? undefined,
        orgNodeId: dto.orgNodeId ?? undefined,
        programType: dto.programType ?? undefined,
        periodicity: (dto.periodicity as any) ?? undefined,
        currency: dto.currency ?? undefined,
        validFrom: dto.validFrom !== undefined ? (dto.validFrom ? new Date(dto.validFrom) : null) : undefined,
        validTo: dto.validTo !== undefined ? (dto.validTo ? new Date(dto.validTo) : null) : undefined,
        status: dto.status ?? undefined,
        roundingRule: dto.roundingRule ?? undefined,
        closeDay: dto.closeDay ?? undefined,
        approvalDeadlineDay: dto.approvalDeadlineDay ?? undefined,
        payrollDeadlineDay: dto.payrollDeadlineDay ?? undefined,
        defaultRubric: dto.defaultRubric ?? undefined,
        ownerUserId: dto.ownerUserId ?? undefined,
        approvers: (dto.approvers as Prisma.InputJsonValue) ?? undefined,
        eligibility: (dto.eligibility as Prisma.InputJsonValue) ?? undefined,
        notes: dto.notes ?? undefined,
      },
    });
    await this.snapshot(me.companyId, id, me.sub, 'Atualização da configuração');
    await this.audit.log(me, { action: 'UPDATE', entityType: 'PROGRAM', entityId: id, before: current, after: updated });
    return updated;
  }

  async duplicate(me: AuthPayload, id: string) {
    const src = await this.get(me.companyId, id);
    const code = await this.nextCode(me.companyId);
    const clone = await this.prisma.prizeProgram.create({
      data: {
        companyId: me.companyId,
        code,
        name: `${src.name} (cópia)`,
        description: src.description,
        orgNodeId: src.orgNodeId,
        programType: src.programType,
        periodicity: src.periodicity,
        currency: src.currency,
        status: 'DRAFT',
        roundingRule: src.roundingRule,
        closeDay: src.closeDay,
        approvalDeadlineDay: src.approvalDeadlineDay,
        payrollDeadlineDay: src.payrollDeadlineDay,
        defaultRubric: src.defaultRubric,
        ownerUserId: src.ownerUserId,
        approvers: (src.approvers as Prisma.InputJsonValue) ?? undefined,
        eligibility: (src.eligibility as Prisma.InputJsonValue) ?? undefined,
        notes: src.notes,
        createdById: me.sub,
      },
    });
    await this.snapshot(me.companyId, clone.id, me.sub, `Duplicado de ${src.code}`);
    await this.audit.log(me, { action: 'DUPLICATE', entityType: 'PROGRAM', entityId: clone.id, after: clone });
    return clone;
  }

  async setStatus(me: AuthPayload, id: string, status: PrizeProgramStatus) {
    const current = await this.get(me.companyId, id);
    const updated = await this.prisma.prizeProgram.update({ where: { id }, data: { status } });
    await this.audit.log(me, {
      action: 'STATUS',
      entityType: 'PROGRAM',
      entityId: id,
      before: { status: current.status },
      after: { status },
    });
    return updated;
  }

  async remove(me: AuthPayload, id: string) {
    const current = await this.get(me.companyId, id);
    const counts = await this.prisma.prizeCompetence.count({ where: { programId: id } });
    if (counts > 0) throw new ConflictException('Programa possui competências e não pode ser excluído. Arquive-o.');
    await this.prisma.prizeProgram.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
    await this.audit.log(me, { action: 'DELETE', entityType: 'PROGRAM', entityId: id, before: current });
    return { ok: true };
  }

  // ---- helpers ----
  private async nextCode(companyId: string) {
    const count = await this.prisma.prizeProgram.count({ where: { companyId } });
    return `PRG-${String(count + 1).padStart(3, '0')}`;
  }

  private async assertUniqueCode(companyId: string, code: string) {
    const exists = await this.prisma.prizeProgram.findFirst({ where: { companyId, code, deletedAt: null } });
    if (exists) throw new ConflictException(`Já existe um programa com o código ${code}`);
  }

  private async snapshot(companyId: string, programId: string, userId: string, note: string) {
    const program = await this.prisma.prizeProgram.findFirst({ where: { id: programId, companyId } });
    if (!program) return;
    const last = await this.prisma.prizeProgramVersion.findFirst({
      where: { programId },
      orderBy: { version: 'desc' },
    });
    await this.prisma.prizeProgramVersion.create({
      data: {
        programId,
        version: (last?.version ?? 0) + 1,
        snapshot: program as unknown as Prisma.InputJsonValue,
        note,
        createdById: userId,
      },
    });
  }
}
