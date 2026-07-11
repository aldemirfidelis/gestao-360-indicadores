import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { WorkItemEventBus } from '../my-day/work-item-event-bus';
import { AuthPayload } from '../auth/auth.types';
import { parseFlexibleDate } from './employee.logic';
import {
  LEAVE_TYPES,
  VACATION_ACTIVE_STATUSES,
  acquisitivePeriods,
  allocateVacations,
  calendarDaysInclusive,
  rangesOverlap,
  validateVacationRange,
} from './vacation.logic';

const MODULE = 'personnel';
/** Coberturas de dia usadas pelo espelho do ponto. */
export type DayCoverage = 'VACATION' | 'LEAVE';

@Injectable()
export class VacationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly workItems: WorkItemEventBus,
  ) {}

  // ------------------------------ Autoatendimento ------------------------------

  /** Colaborador vinculado ao usuário logado (perfil.userId). */
  async myEmployee(me: AuthPayload) {
    const profile = await this.prisma.personnelEmployeeProfile.findFirst({
      where: { companyId: me.companyId, userId: me.sub },
      select: { employeeId: true, admissionDate: true, employee: { select: { id: true, name: true, status: true } } },
    });
    return profile;
  }

  async myOverview(me: AuthPayload) {
    const profile = await this.myEmployee(me);
    if (!profile) {
      return { linked: false, employee: null, balance: null, requests: [] };
    }
    const [balance, requests] = await Promise.all([
      this.balanceForEmployee(me.companyId, profile.employeeId, profile.admissionDate),
      this.prisma.vacationRequest.findMany({
        where: { companyId: me.companyId, employeeId: profile.employeeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { linked: true, employee: profile.employee, balance, requests };
  }

  async createMyRequest(me: AuthPayload, body: any = {}) {
    const profile = await this.myEmployee(me);
    if (!profile) throw new NotFoundException('Seu usuário não está vinculado a um colaborador. Procure o DP.');
    return this.createRequest(me, { ...body, employeeId: profile.employeeId }, { selfService: true });
  }

  async cancelMyRequest(me: AuthPayload, id: string) {
    const profile = await this.myEmployee(me);
    if (!profile) throw new NotFoundException('Seu usuário não está vinculado a um colaborador.');
    const request = await this.loadRequest(me.companyId, id);
    if (request.employeeId !== profile.employeeId) throw new ForbiddenException('Esta solicitação não é sua.');
    return this.cancelRequest(me, id);
  }

  // ------------------------------ Solicitações ------------------------------

  async listRequests(me: AuthPayload, filters: { status?: string } = {}) {
    const requests = await this.prisma.vacationRequest.findMany({
      where: {
        companyId: me.companyId,
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: { employee: { select: { id: true, name: true, registrationId: true } } },
      orderBy: [{ status: 'asc' }, { startDate: 'asc' }],
      take: 300,
    });
    return requests;
  }

  async createRequest(me: AuthPayload, body: any = {}, opts: { selfService?: boolean } = {}) {
    const employeeId = String(body?.employeeId ?? '').trim();
    if (!employeeId) throw new BadRequestException('Colaborador é obrigatório.');
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { id: employeeId, companyId: me.companyId },
      include: { personnelProfile: { select: { admissionDate: true } } },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado.');
    if (employee.status !== 'ACTIVE') throw new ConflictException('Colaborador não está ativo.');

    const startDate = parseFlexibleDate(body?.startDate);
    const endDate = parseFlexibleDate(body?.endDate);
    if (!startDate || !endDate) throw new BadRequestException('Informe início e fim das férias.');
    const rangeError = validateVacationRange(startDate, endDate, new Date());
    if (rangeError) throw new BadRequestException(rangeError);
    const days = calendarDaysInclusive(startDate, endDate);

    const balance = await this.balanceForEmployee(me.companyId, employeeId, employee.personnelProfile?.admissionDate ?? null);
    if (!balance.periods.length) throw new ConflictException('Colaborador ainda não completou o primeiro período aquisitivo (ou está sem data de admissão no prontuário).');
    if (days > balance.totalBalance) throw new ConflictException(`Saldo insuficiente: ${balance.totalBalance} dia(s) disponível(is).`);

    // Sem sobreposição com férias ativas ou afastamentos
    const [vacations, leaves] = await Promise.all([
      this.prisma.vacationRequest.findMany({
        where: { companyId: me.companyId, employeeId, status: { in: [...VACATION_ACTIVE_STATUSES] } },
        select: { startDate: true, endDate: true },
      }),
      this.prisma.leaveRecord.findMany({
        where: { companyId: me.companyId, employeeId, deletedAt: null },
        select: { startDate: true, endDate: true },
      }),
    ]);
    for (const other of vacations) {
      if (rangesOverlap(startDate, endDate, other.startDate, other.endDate)) {
        throw new ConflictException('Período conflita com outra solicitação de férias.');
      }
    }
    for (const leave of leaves) {
      if (rangesOverlap(startDate, endDate, leave.startDate, leave.endDate ?? endDate)) {
        throw new ConflictException('Período conflita com um afastamento registrado.');
      }
    }

    const oldestOpen = balance.periods.find((period) => period.balanceDays > 0);
    const request = await this.prisma.vacationRequest.create({
      data: {
        companyId: me.companyId,
        employeeId,
        startDate,
        endDate,
        days,
        periodRef: oldestOpen?.ref ?? null,
        notes: text(body?.notes),
        createdById: me.sub,
      },
      include: { employee: { select: { id: true, name: true } } },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'VacationRequest',
      entityId: request.id,
      action: 'VACATION_REQUESTED',
      message: `Férias solicitadas p/ ${request.employee.name}: ${days} dia(s)`,
      after: { employeeId, startDate, endDate, days, selfService: Boolean(opts.selfService) },
    });
    this.workItems.markDirty(me.companyId, [me.sub], 'vacation-requested');
    return request;
  }

  /** Aprovação em 2 níveis: REQUESTED → MANAGER_APPROVED → APPROVED. */
  async approveRequest(me: AuthPayload, id: string, body: any = {}) {
    const request = await this.loadRequest(me.companyId, id);
    if (!['REQUESTED', 'MANAGER_APPROVED'].includes(request.status)) {
      throw new ConflictException('Esta solicitação não está pendente de aprovação.');
    }
    const toFinal = request.status === 'MANAGER_APPROVED';
    const updated = await this.prisma.vacationRequest.update({
      where: { id },
      data: toFinal
        ? { status: 'APPROVED', finalDecidedById: me.sub, finalDecidedAt: new Date(), decisionNote: text(body?.note) ?? request.decisionNote }
        : { status: 'MANAGER_APPROVED', managerDecidedById: me.sub, managerDecidedAt: new Date() },
    });
    if (toFinal) {
      await this.prisma.employmentEvent.create({
        data: {
          companyId: me.companyId,
          employeeId: request.employeeId,
          type: 'FERIAS',
          title: `Férias aprovadas: ${formatRange(request.startDate, request.endDate)} (${request.days} dias)`,
          effectiveDate: request.startDate,
          createdById: me.sub,
        },
      });
    }
    await this.audit.record(me, {
      module: MODULE,
      entity: 'VacationRequest',
      entityId: id,
      action: toFinal ? 'VACATION_APPROVED' : 'VACATION_MANAGER_APPROVED',
      message: toFinal ? 'Férias aprovadas (DP)' : 'Férias aprovadas pelo gestor',
    });
    this.notifyRequester(me.companyId, request.employeeId);
    return updated;
  }

  async rejectRequest(me: AuthPayload, id: string, body: any = {}) {
    const request = await this.loadRequest(me.companyId, id);
    if (!['REQUESTED', 'MANAGER_APPROVED'].includes(request.status)) {
      throw new ConflictException('Esta solicitação não está pendente.');
    }
    const note = text(body?.note ?? body?.justification);
    if (!note) throw new BadRequestException('Justificativa é obrigatória para rejeitar.');
    const updated = await this.prisma.vacationRequest.update({
      where: { id },
      data: { status: 'REJECTED', finalDecidedById: me.sub, finalDecidedAt: new Date(), decisionNote: note },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'VacationRequest',
      entityId: id,
      action: 'VACATION_REJECTED',
      message: `Férias rejeitadas: ${note}`,
    });
    this.notifyRequester(me.companyId, request.employeeId);
    return updated;
  }

  async cancelRequest(me: AuthPayload, id: string) {
    const request = await this.loadRequest(me.companyId, id);
    if (!['REQUESTED', 'MANAGER_APPROVED', 'APPROVED'].includes(request.status)) {
      throw new ConflictException('Esta solicitação não pode mais ser cancelada.');
    }
    if (request.startDate.getTime() <= Date.now()) {
      throw new ConflictException('Férias já iniciadas não podem ser canceladas por aqui.');
    }
    const updated = await this.prisma.vacationRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'VacationRequest',
      entityId: id,
      action: 'VACATION_CANCELLED',
      message: 'Solicitação de férias cancelada',
    });
    this.notifyRequester(me.companyId, request.employeeId);
    return updated;
  }

  // ------------------------------ Saldos ------------------------------

  async balances(me: AuthPayload) {
    const employees = await this.prisma.orgEmployee.findMany({
      where: { companyId: me.companyId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        registrationId: true,
        personnelProfile: { select: { admissionDate: true } },
        orgNode: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
      take: 500,
    });
    const requests = await this.prisma.vacationRequest.findMany({
      where: { companyId: me.companyId, status: { in: [...VACATION_ACTIVE_STATUSES] } },
      select: { employeeId: true, days: true },
    });
    const daysByEmployee = new Map<string, Array<{ days: number }>>();
    for (const request of requests) {
      const list = daysByEmployee.get(request.employeeId) ?? [];
      list.push({ days: request.days });
      daysByEmployee.set(request.employeeId, list);
    }
    const today = new Date();
    return employees.map((employee) => {
      const periods = acquisitivePeriods(employee.personnelProfile?.admissionDate ?? null, today);
      const allocation = allocateVacations(periods, daysByEmployee.get(employee.id) ?? [], today);
      return {
        employee: { id: employee.id, name: employee.name, registrationId: employee.registrationId, orgNode: employee.orgNode },
        admissionDate: employee.personnelProfile?.admissionDate ?? null,
        totalBalance: allocation.totalBalance,
        nextDeadline: allocation.nextDeadline,
        expiring: allocation.expiring,
        overdue: allocation.overdue,
        periods: allocation.periods,
      };
    });
  }

  private async balanceForEmployee(companyId: string, employeeId: string, admissionDate: Date | null) {
    const requests = await this.prisma.vacationRequest.findMany({
      where: { companyId, employeeId, status: { in: [...VACATION_ACTIVE_STATUSES] } },
      select: { days: true },
    });
    const today = new Date();
    return allocateVacations(acquisitivePeriods(admissionDate, today), requests, today);
  }

  // ------------------------------ Afastamentos ------------------------------

  async listLeaves(me: AuthPayload, filters: { employeeId?: string; active?: string } = {}) {
    const today = new Date();
    const leaves = await this.prisma.leaveRecord.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.active === 'true' ? { OR: [{ endDate: null }, { endDate: { gte: today } }] } : {}),
      },
      include: { employee: { select: { id: true, name: true, registrationId: true } } },
      orderBy: { startDate: 'desc' },
      take: 300,
    });
    // CID é sensível: fora do detalhe, informa apenas se existe.
    return leaves.map((leave) => ({ ...leave, cid: undefined, hasCid: Boolean(leave.cid) }));
  }

  async createLeave(me: AuthPayload, body: any = {}) {
    const employeeId = String(body?.employeeId ?? '').trim();
    const employee = await this.prisma.orgEmployee.findFirst({ where: { id: employeeId, companyId: me.companyId }, select: { id: true, name: true } });
    if (!employee) throw new NotFoundException('Colaborador não encontrado.');
    const type = String(body?.type ?? '').trim().toUpperCase();
    if (!LEAVE_TYPES.includes(type as any)) throw new BadRequestException('Tipo de afastamento inválido.');
    const startDate = parseFlexibleDate(body?.startDate);
    if (!startDate) throw new BadRequestException('Data de início é obrigatória.');
    const endDate = parseFlexibleDate(body?.endDate);
    if (endDate && endDate.getTime() < startDate.getTime()) throw new BadRequestException('Fim do afastamento antes do início.');

    const leave = await this.prisma.leaveRecord.create({
      data: {
        companyId: me.companyId,
        employeeId,
        type,
        startDate,
        endDate,
        cid: text(body?.cid),
        description: text(body?.description),
        dossierFileId: text(body?.dossierFileId),
        createdById: me.sub,
      },
    });
    await this.prisma.employmentEvent.create({
      data: {
        companyId: me.companyId,
        employeeId,
        type: 'AFASTAMENTO',
        title: `Afastamento (${type}): ${formatRange(startDate, endDate ?? startDate)}${endDate ? '' : ' — em aberto'}`,
        effectiveDate: startDate,
        createdById: me.sub,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'LeaveRecord',
      entityId: leave.id,
      action: 'LEAVE_CREATED',
      message: `Afastamento ${type} registrado p/ ${employee.name}`,
      after: { type, startDate, endDate },
    });
    return leave;
  }

  async closeLeave(me: AuthPayload, id: string, body: any = {}) {
    const leave = await this.prisma.leaveRecord.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!leave) throw new NotFoundException('Afastamento não encontrado.');
    const endDate = parseFlexibleDate(body?.endDate) ?? new Date();
    if (endDate.getTime() < leave.startDate.getTime()) throw new BadRequestException('Fim do afastamento antes do início.');
    const updated = await this.prisma.leaveRecord.update({ where: { id }, data: { endDate } });
    await this.prisma.employmentEvent.create({
      data: {
        companyId: me.companyId,
        employeeId: leave.employeeId,
        type: 'AFASTAMENTO',
        title: `Retorno de afastamento (${leave.type})`,
        effectiveDate: endDate,
        createdById: me.sub,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'LeaveRecord',
      entityId: id,
      action: 'LEAVE_CLOSED',
      message: 'Afastamento encerrado',
      after: { endDate },
    });
    return updated;
  }

  async removeLeave(me: AuthPayload, id: string) {
    const leave = await this.prisma.leaveRecord.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!leave) throw new NotFoundException('Afastamento não encontrado.');
    await this.prisma.leaveRecord.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'LeaveRecord',
      entityId: id,
      action: 'LEAVE_REMOVED',
      message: 'Afastamento removido (registro lógico)',
    });
    return { removed: true };
  }

  // ------------------------------ Cobertura p/ o espelho do ponto ------------------------------

  /**
   * Mapa userId -> (dayKey -> VACATION|LEAVE) no intervalo. Usado pelo espelho:
   * dia coberto não conta jornada prevista (abono automático).
   */
  async coverageForUsers(companyId: string, userIds: string[] | null, fromKey: string, toKey: string): Promise<Map<string, Map<string, DayCoverage>>> {
    const from = new Date(`${fromKey}T00:00:00.000Z`);
    const to = new Date(`${toKey}T23:59:59.999Z`);
    const profiles = await this.prisma.personnelEmployeeProfile.findMany({
      where: { companyId, userId: userIds ? { in: userIds } : { not: null } },
      select: { userId: true, employeeId: true },
    });
    if (!profiles.length) return new Map();
    const employeeIds = profiles.map((profile) => profile.employeeId);
    const userByEmployee = new Map(profiles.map((profile) => [profile.employeeId, profile.userId as string]));

    const [vacations, leaves] = await Promise.all([
      this.prisma.vacationRequest.findMany({
        where: {
          companyId,
          employeeId: { in: employeeIds },
          status: { in: ['APPROVED', 'DONE'] },
          startDate: { lte: to },
          endDate: { gte: from },
        },
        select: { employeeId: true, startDate: true, endDate: true },
      }),
      this.prisma.leaveRecord.findMany({
        where: {
          companyId,
          employeeId: { in: employeeIds },
          deletedAt: null,
          startDate: { lte: to },
          OR: [{ endDate: null }, { endDate: { gte: from } }],
        },
        select: { employeeId: true, startDate: true, endDate: true },
      }),
    ]);

    const result = new Map<string, Map<string, DayCoverage>>();
    const mark = (employeeId: string, start: Date, end: Date, kind: DayCoverage) => {
      const userId = userByEmployee.get(employeeId);
      if (!userId) return;
      const days = result.get(userId) ?? new Map<string, DayCoverage>();
      const cursor = new Date(Math.max(start.getTime(), from.getTime()));
      const stop = Math.min(end.getTime(), to.getTime());
      for (let i = 0; i < 400 && cursor.getTime() <= stop; i++) {
        const key = cursor.toISOString().slice(0, 10);
        // Férias prevalecem sobre afastamento no rótulo do dia.
        if (kind === 'VACATION' || !days.has(key)) days.set(key, kind);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      result.set(userId, days);
    };
    for (const leave of leaves) mark(leave.employeeId, leave.startDate, leave.endDate ?? to, 'LEAVE');
    for (const vacation of vacations) mark(vacation.employeeId, vacation.startDate, vacation.endDate, 'VACATION');
    return result;
  }

  // ------------------------------ Internos ------------------------------

  private async loadRequest(companyId: string, id: string) {
    const request = await this.prisma.vacationRequest.findFirst({
      where: { id, companyId },
      include: { employee: { select: { id: true, name: true } } },
    });
    if (!request) throw new NotFoundException('Solicitação de férias não encontrada.');
    return request;
  }

  /** Marca o Meu Dia do usuário vinculado ao colaborador (se houver). */
  private notifyRequester(companyId: string, employeeId: string) {
    void this.prisma.personnelEmployeeProfile
      .findFirst({ where: { companyId, employeeId }, select: { userId: true } })
      .then((profile) => {
        if (profile?.userId) this.workItems.markDirty(companyId, [profile.userId], 'vacation-decided');
      })
      .catch(() => undefined);
  }
}

function text(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}

function formatRange(start: Date, end: Date): string {
  const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  return `${fmt(start)} a ${fmt(end)}`;
}
