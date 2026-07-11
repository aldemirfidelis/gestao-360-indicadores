import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { WorkItemEventBus } from '../my-day/work-item-event-bus';
import { AuthPayload } from '../auth/auth.types';
import { EmployeesService } from './employees.service';
import { parseFlexibleDate } from './employee.logic';
import {
  EXAM_RESULTS,
  EXAM_TYPES,
  PROCESS_KINDS,
  defaultExamValidity,
  defaultItemsFor,
  examStatus,
} from './lifecycle.logic';

const MODULE = 'personnel';

@Injectable()
export class LifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly workItems: WorkItemEventBus,
    private readonly employees: EmployeesService,
  ) {}

  // ------------------------------ Processos ------------------------------

  async listProcesses(me: AuthPayload, filters: { kind?: string; status?: string } = {}) {
    const processes = await this.prisma.employeeProcess.findMany({
      where: {
        companyId: me.companyId,
        ...(filters.kind ? { kind: filters.kind.toUpperCase() } : {}),
        ...(filters.status ? { status: filters.status.toUpperCase() } : {}),
      },
      include: {
        employee: { select: { id: true, name: true, registrationId: true, status: true } },
        items: { select: { id: true, required: true, doneAt: true }, orderBy: { order: 'asc' } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return processes.map((process) => ({
      ...process,
      items: undefined,
      totalItems: process.items.length,
      doneItems: process.items.filter((item) => item.doneAt).length,
      pendingRequired: process.items.filter((item) => item.required && !item.doneAt).length,
    }));
  }

  async startProcess(me: AuthPayload, body: any = {}) {
    const kind = String(body?.kind ?? '').trim().toUpperCase();
    if (!PROCESS_KINDS.includes(kind as any)) throw new BadRequestException('Tipo de processo inválido (ONBOARDING/OFFBOARDING).');
    const employeeId = String(body?.employeeId ?? '').trim();
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { id: employeeId, companyId: me.companyId },
      select: { id: true, name: true, status: true },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado.');
    if (kind === 'OFFBOARDING' && employee.status !== 'ACTIVE') {
      throw new ConflictException('Colaborador já está desligado.');
    }
    const open = await this.prisma.employeeProcess.findFirst({
      where: { companyId: me.companyId, employeeId, kind, status: 'IN_PROGRESS' },
      select: { id: true },
    });
    if (open) throw new ConflictException('Já existe um processo em andamento deste tipo para o colaborador.');

    const templates = defaultItemsFor(kind);
    const process = await this.prisma.employeeProcess.create({
      data: {
        companyId: me.companyId,
        employeeId,
        kind,
        dueDate: parseFlexibleDate(body?.dueDate),
        notes: text(body?.notes),
        createdById: me.sub,
        items: {
          create: templates.map((template, index) => ({
            companyId: me.companyId,
            title: template.title,
            required: template.required,
            dossierKind: template.dossierKind ?? null,
            order: index,
          })),
        },
      },
      include: { employee: { select: { id: true, name: true } } },
    });
    await this.prisma.employmentEvent.create({
      data: {
        companyId: me.companyId,
        employeeId,
        type: 'PROCESSO',
        title: kind === 'ONBOARDING' ? 'Admissão digital iniciada' : 'Processo de desligamento iniciado',
        effectiveDate: new Date(),
        createdById: me.sub,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'EmployeeProcess',
      entityId: process.id,
      action: 'PROCESS_STARTED',
      message: `${kind === 'ONBOARDING' ? 'Admissão' : 'Desligamento'} iniciado p/ ${employee.name}`,
      after: { kind, employeeId },
    });
    this.workItems.markDirty(me.companyId, [me.sub], 'personnel-process');
    return this.getProcess(me, process.id);
  }

  async getProcess(me: AuthPayload, id: string) {
    const process = await this.prisma.employeeProcess.findFirst({
      where: { id, companyId: me.companyId },
      include: {
        employee: { select: { id: true, name: true, registrationId: true, status: true } },
        items: { orderBy: { order: 'asc' } },
      },
    });
    if (!process) throw new NotFoundException('Processo não encontrado.');
    // Badge automático: o dossiê já tem documento do tipo exigido pelo item?
    const kinds = [...new Set(process.items.map((item) => item.dossierKind).filter(Boolean))] as string[];
    const files = kinds.length
      ? await this.prisma.employeeDossierFile.findMany({
          where: { companyId: me.companyId, employeeId: process.employeeId, kind: { in: kinds }, deletedAt: null },
          select: { kind: true },
        })
      : [];
    const dossierKinds = new Set(files.map((file) => file.kind));
    return {
      ...process,
      items: process.items.map((item) => ({
        ...item,
        dossierSatisfied: item.dossierKind ? dossierKinds.has(item.dossierKind) : null,
      })),
    };
  }

  async toggleItem(me: AuthPayload, processId: string, itemId: string, body: any = {}) {
    const process = await this.loadOpenProcess(me, processId);
    const item = await this.prisma.employeeProcessItem.findFirst({
      where: { id: itemId, processId: process.id, companyId: me.companyId },
    });
    if (!item) throw new NotFoundException('Item do checklist não encontrado.');
    const done = body?.done === undefined ? !item.doneAt : Boolean(body.done);
    await this.prisma.employeeProcessItem.update({
      where: { id: itemId },
      data: {
        doneAt: done ? new Date() : null,
        doneById: done ? me.sub : null,
        note: text(body?.note) ?? item.note,
      },
    });
    return this.getProcess(me, processId);
  }

  async completeProcess(me: AuthPayload, id: string, body: any = {}) {
    const process = await this.loadOpenProcess(me, id);
    const pendingRequired = await this.prisma.employeeProcessItem.count({
      where: { processId: id, companyId: me.companyId, required: true, doneAt: null },
    });
    if (pendingRequired > 0) {
      throw new ConflictException(`Há ${pendingRequired} item(ns) obrigatório(s) pendente(s) no checklist.`);
    }
    const note = text(body?.note);
    await this.prisma.employeeProcess.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date(), completedById: me.sub, notes: note ?? process.notes },
    });
    if (process.kind === 'OFFBOARDING') {
      // Reusa o fluxo do prontuário: gera evento DESLIGAMENTO + terminationDate.
      await this.employees.update(me, process.employeeId, { status: 'INACTIVE', reason: note ?? 'Desligamento concluído (checklist)' });
    } else {
      await this.prisma.employmentEvent.create({
        data: {
          companyId: me.companyId,
          employeeId: process.employeeId,
          type: 'PROCESSO',
          title: 'Admissão digital concluída',
          effectiveDate: new Date(),
          createdById: me.sub,
        },
      });
    }
    await this.audit.record(me, {
      module: MODULE,
      entity: 'EmployeeProcess',
      entityId: id,
      action: 'PROCESS_COMPLETED',
      message: `${process.kind === 'ONBOARDING' ? 'Admissão' : 'Desligamento'} concluído`,
    });
    this.workItems.markDirty(me.companyId, [me.sub], 'personnel-process');
    return this.getProcess(me, id);
  }

  async cancelProcess(me: AuthPayload, id: string, body: any = {}) {
    const process = await this.loadOpenProcess(me, id);
    const note = text(body?.note ?? body?.justification);
    if (!note) throw new BadRequestException('Justificativa é obrigatória para cancelar.');
    await this.prisma.employeeProcess.update({
      where: { id },
      data: { status: 'CANCELLED', notes: note, completedById: me.sub, completedAt: new Date() },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'EmployeeProcess',
      entityId: id,
      action: 'PROCESS_CANCELLED',
      message: `Processo ${process.kind} cancelado: ${note}`,
    });
    return { cancelled: true };
  }

  // ------------------------------ ASO ------------------------------

  async listExams(me: AuthPayload, filters: { employeeId?: string; expiring?: string } = {}) {
    const today = new Date();
    const exams = await this.prisma.medicalExam.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      },
      include: { employee: { select: { id: true, name: true, registrationId: true, status: true } } },
      orderBy: [{ examDate: 'desc' }],
      take: 300,
    });
    const rows = exams.map((exam) => ({ ...exam, status: examStatus(exam.validUntil, today) }));
    const filtered = filters.expiring === 'true' ? rows.filter((row) => row.status === 'EXPIRING' || row.status === 'EXPIRED') : rows;
    return {
      items: filtered,
      kpis: {
        total: rows.length,
        expiring: rows.filter((row) => row.status === 'EXPIRING').length,
        expired: rows.filter((row) => row.status === 'EXPIRED').length,
      },
    };
  }

  async createExam(me: AuthPayload, body: any = {}) {
    const employeeId = String(body?.employeeId ?? '').trim();
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { id: employeeId, companyId: me.companyId },
      select: { id: true, name: true },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado.');
    const type = String(body?.type ?? '').trim().toUpperCase();
    if (!EXAM_TYPES.includes(type as any)) throw new BadRequestException('Tipo de exame inválido.');
    const result = (String(body?.result ?? 'APTO').trim().toUpperCase() || 'APTO') as string;
    if (!EXAM_RESULTS.includes(result as any)) throw new BadRequestException('Resultado inválido (APTO/APTO_COM_RESTRICAO/INAPTO).');
    const examDate = parseFlexibleDate(body?.examDate);
    if (!examDate) throw new BadRequestException('Data do exame é obrigatória.');
    const validUntil = parseFlexibleDate(body?.validUntil) ?? defaultExamValidity(type, examDate);
    if (validUntil && validUntil.getTime() < examDate.getTime()) throw new BadRequestException('Validade anterior à data do exame.');

    const exam = await this.prisma.medicalExam.create({
      data: {
        companyId: me.companyId,
        employeeId,
        type,
        examDate,
        validUntil,
        result,
        physician: text(body?.physician),
        notes: text(body?.notes),
        dossierFileId: text(body?.dossierFileId),
        createdById: me.sub,
      },
    });
    await this.prisma.employmentEvent.create({
      data: {
        companyId: me.companyId,
        employeeId,
        type: 'ASO',
        title: `ASO ${type.toLowerCase()} — ${result === 'APTO' ? 'apto' : result === 'INAPTO' ? 'inapto' : 'apto com restrição'}`,
        effectiveDate: examDate,
        createdById: me.sub,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'MedicalExam',
      entityId: exam.id,
      action: 'EXAM_CREATED',
      message: `ASO ${type} registrado p/ ${employee.name}`,
      after: { type, result, examDate, validUntil },
    });
    return { ...exam, status: examStatus(exam.validUntil, new Date()) };
  }

  async removeExam(me: AuthPayload, id: string) {
    const exam = await this.prisma.medicalExam.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!exam) throw new NotFoundException('Exame não encontrado.');
    await this.prisma.medicalExam.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'MedicalExam',
      entityId: id,
      action: 'EXAM_REMOVED',
      message: 'Exame removido (registro lógico)',
    });
    return { removed: true };
  }

  // ------------------------------ Internos ------------------------------

  private async loadOpenProcess(me: AuthPayload, id: string) {
    const process = await this.prisma.employeeProcess.findFirst({ where: { id, companyId: me.companyId } });
    if (!process) throw new NotFoundException('Processo não encontrado.');
    if (process.status !== 'IN_PROGRESS') throw new ConflictException('Processo já foi concluído ou cancelado.');
    return process;
  }
}

function text(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}
