import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PersonnelService } from './personnel.service';
import {
  EmployeeLifecycleRow,
  absenteeismRate,
  activeAtDate,
  assertPeriodRef,
  businessDaysInMonth,
  computeTurnover,
  monthEnd,
  overlapDays,
  round2,
} from './reports.logic';

interface EmployeeContext {
  id: string;
  name: string;
  registrationId: string | null;
  orgNodeId: string | null;
  orgNodeName: string;
  userId: string | null;
  admissionDate: Date | null;
  terminationDate: Date | null;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personnel: PersonnelService,
  ) {}

  async overview(me: AuthPayload, ref?: string) {
    const period = ref ?? currentRef();
    assertPeriodRef(period);
    const employees = await this.loadEmployees(me.companyId);
    const end = monthEnd(period);
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    const headcount = employees.filter((row) => activeAtDate(row.admissionDate, row.terminationDate, end)).length;
    const rolling = this.turnoverFromRows(employees, addMonths(start, -11), end);
    const monthTurnover = this.turnoverFromRows(employees, start, end);
    const absence = await this.absenteeismFor(me, period, employees);
    const overtime = await this.overtimeFor(me, period);
    return {
      periodRef: period,
      headcount,
      admissionsMonth: monthTurnover.admissions,
      terminationsMonth: monthTurnover.terminations,
      turnoverRate12m: rolling.turnoverRate,
      absenteeismRate: absence.absenteeismRate,
      leaveDaysMonth: absence.totalLeaveDays,
      overtimeHoursMonth: overtime.totalOvertimeHours,
      pontoFaltasMonth: overtime.totalAbsentDays,
    };
  }

  async turnover(me: AuthPayload, from?: string, to?: string) {
    const employees = await this.loadEmployees(me.companyId);
    const toDate = to ? parseDate(to, 'final') : new Date();
    const fromDate = from ? parseDate(from, 'inicial') : new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth() - 11, 1));
    return this.turnoverFromRows(employees, fromDate, toDate);
  }

  async absenteeism(me: AuthPayload, ref?: string) {
    const period = ref ?? currentRef();
    assertPeriodRef(period);
    const employees = await this.loadEmployees(me.companyId);
    return this.absenteeismFor(me, period, employees);
  }

  async overtime(me: AuthPayload, ref?: string) {
    const period = ref ?? currentRef();
    assertPeriodRef(period);
    return this.overtimeFor(me, period);
  }

  /** Exporta o consolidado da competência p/ folha (ponto + afastamentos) em CSV ou XLSX. */
  async payrollExport(me: AuthPayload, ref: string, format: 'csv' | 'xlsx') {
    assertPeriodRef(ref);
    const employees = await this.loadEmployees(me.companyId);
    const byUserId = new Map(employees.filter((row) => row.userId).map((row) => [row.userId as string, row]));
    const report = await this.personnel.periodReport(me, ref);
    const leaves = await this.loadLeaves(me.companyId, ref);
    const leaveDaysByEmployee = new Map<string, number>();
    const { first, last } = monthWindow(ref);
    for (const leave of leaves) {
      const days = overlapDays(leave.startDate, leave.endDate, first, last);
      leaveDaysByEmployee.set(leave.employeeId, (leaveDaysByEmployee.get(leave.employeeId) ?? 0) + days);
    }
    const rows = (report.rows as PeriodRow[]).map((row) => {
      const employee = byUserId.get(row.user.id);
      return {
        registrationId: employee?.registrationId ?? '',
        name: employee?.name ?? row.user.name,
        area: employee?.orgNodeName ?? '',
        plannedHours: round2(row.plannedMinutes / 60),
        workedHours: round2(row.workedMinutes / 60),
        overtimeHours: round2(Math.max(0, row.balanceMinutes) / 60),
        balanceMinutes: row.balanceMinutes,
        absentDays: row.absentDays,
        leaveDays: employee ? leaveDaysByEmployee.get(employee.id) ?? 0 : 0,
      };
    });

    if (format === 'csv') {
      const header = 'matricula;colaborador;area;horas_previstas;horas_trabalhadas;horas_extras;saldo_minutos;faltas_ponto;dias_afastamento';
      const lines = rows.map((row) => [
        csvSafe(row.registrationId), csvSafe(row.name), csvSafe(row.area),
        num(row.plannedHours), num(row.workedHours), num(row.overtimeHours),
        String(row.balanceMinutes), String(row.absentDays), String(row.leaveDays),
      ].join(';'));
      const content = Buffer.from(`﻿${[header, ...lines].join('\r\n')}\r\n`, 'utf8');
      return { fileName: `folha-${ref}.csv`, content, mimeType: 'text/csv; charset=utf-8' };
    }

    const workbook = new Workbook();
    const sheet = workbook.addWorksheet(`Folha ${ref}`);
    sheet.columns = [
      { header: 'Matrícula', key: 'registrationId', width: 16 },
      { header: 'Colaborador', key: 'name', width: 32 },
      { header: 'Área', key: 'area', width: 24 },
      { header: 'Horas previstas', key: 'plannedHours', width: 16 },
      { header: 'Horas trabalhadas', key: 'workedHours', width: 18 },
      { header: 'Horas extras', key: 'overtimeHours', width: 14 },
      { header: 'Saldo (min)', key: 'balanceMinutes', width: 12 },
      { header: 'Faltas (ponto)', key: 'absentDays', width: 14 },
      { header: 'Dias de afastamento', key: 'leaveDays', width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
    const content = Buffer.from(await workbook.xlsx.writeBuffer());
    return { fileName: `folha-${ref}.xlsx`, content, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  // ------------------------------ internos ------------------------------

  private turnoverFromRows(employees: EmployeeContext[], from: Date, to: Date) {
    const rows: EmployeeLifecycleRow[] = employees.map((row) => ({
      employeeId: row.id, orgNodeId: row.orgNodeId, orgNodeName: row.orgNodeName,
      admissionDate: row.admissionDate, terminationDate: row.terminationDate,
    }));
    return computeTurnover(rows, from, to);
  }

  private async absenteeismFor(me: AuthPayload, ref: string, employees: EmployeeContext[]) {
    const { first, last } = monthWindow(ref);
    const leaves = await this.loadLeaves(me.companyId, ref);
    const employeeById = new Map(employees.map((row) => [row.id, row]));
    const byType = new Map<string, number>();
    const byArea = new Map<string, { key: string; label: string; days: number }>();
    const detail: Array<{ id: string; employee: string; area: string; type: string; startDate: string; endDate: string | null; days: number; cid: string | null }> = [];
    let totalLeaveDays = 0;
    for (const leave of leaves) {
      const days = overlapDays(leave.startDate, leave.endDate, first, last);
      if (days <= 0) continue;
      totalLeaveDays += days;
      byType.set(leave.type, (byType.get(leave.type) ?? 0) + days);
      const employee = employeeById.get(leave.employeeId);
      const areaKey = employee?.orgNodeId ?? 'sem-area';
      const areaLabel = employee?.orgNodeName ?? 'Sem área';
      const areaBucket = byArea.get(areaKey) ?? { key: areaKey, label: areaLabel, days: 0 };
      areaBucket.days += days;
      byArea.set(areaKey, areaBucket);
      detail.push({
        id: leave.id, employee: employee?.name ?? 'Colaborador', area: areaLabel, type: leave.type,
        startDate: leave.startDate.toISOString().slice(0, 10), endDate: leave.endDate ? leave.endDate.toISOString().slice(0, 10) : null,
        days, cid: leave.cid,
      });
    }
    const headcount = employees.filter((row) => activeAtDate(row.admissionDate, row.terminationDate, last)).length;
    const businessDays = businessDaysInMonth(ref);
    // Faltas de ponto (não necessariamente cobertas por afastamento) como indicador complementar.
    const ponto = await this.overtimeFor(me, ref);
    return {
      periodRef: ref,
      headcount,
      businessDays,
      totalLeaveDays,
      pontoFaltas: ponto.totalAbsentDays,
      absenteeismRate: absenteeismRate(totalLeaveDays, headcount, businessDays),
      byType: [...byType.entries()].map(([type, days]) => ({ type, days })).sort((a, b) => b.days - a.days),
      byArea: [...byArea.values()].sort((a, b) => b.days - a.days),
      detail: detail.sort((a, b) => b.days - a.days),
    };
  }

  private async overtimeFor(me: AuthPayload, ref: string) {
    const report = await this.personnel.periodReport(me, ref);
    const profiles = await this.prisma.personnelEmployeeProfile.findMany({
      where: { companyId: me.companyId, userId: { not: null } },
      select: { userId: true, employee: { select: { id: true, name: true, registrationId: true, orgNodeId: true, orgNode: { select: { name: true } } } } },
    });
    const byUserId = new Map(profiles.map((profile) => [profile.userId as string, profile.employee]));
    const byArea = new Map<string, { key: string; label: string; overtimeHours: number }>();
    let totalOvertimeHours = 0;
    let totalAbsentDays = 0;
    const rows = (report.rows as PeriodRow[]).map((row) => {
      const employee = byUserId.get(row.user.id);
      const overtimeHours = round2(Math.max(0, row.balanceMinutes) / 60);
      totalOvertimeHours += overtimeHours;
      totalAbsentDays += row.absentDays;
      const areaKey = employee?.orgNodeId ?? 'sem-area';
      const areaLabel = employee?.orgNode?.name ?? 'Sem área';
      if (overtimeHours > 0) {
        const bucket = byArea.get(areaKey) ?? { key: areaKey, label: areaLabel, overtimeHours: 0 };
        bucket.overtimeHours = round2(bucket.overtimeHours + overtimeHours);
        byArea.set(areaKey, bucket);
      }
      return {
        employee: employee?.name ?? row.user.name,
        registrationId: employee?.registrationId ?? null,
        area: areaLabel,
        overtimeHours,
        balanceMinutes: row.balanceMinutes,
        workedHours: round2(row.workedMinutes / 60),
        absentDays: row.absentDays,
        inconsistentDays: row.inconsistentDays,
      };
    });
    return {
      periodRef: ref,
      status: report.status,
      totalOvertimeHours: round2(totalOvertimeHours),
      totalAbsentDays,
      byArea: [...byArea.values()].sort((a, b) => b.overtimeHours - a.overtimeHours),
      rows: rows.sort((a, b) => b.overtimeHours - a.overtimeHours),
    };
  }

  private async loadEmployees(companyId: string): Promise<EmployeeContext[]> {
    const employees = await this.prisma.orgEmployee.findMany({
      where: { companyId },
      select: {
        id: true, name: true, registrationId: true, status: true, updatedAt: true, orgNodeId: true,
        orgNode: { select: { name: true } },
        personnelProfile: { select: { admissionDate: true, terminationDate: true, userId: true } },
        compensationProfile: { select: { admissionDate: true } },
      },
      take: 20000,
    });
    return employees.map((employee) => {
      const admissionDate = employee.personnelProfile?.admissionDate ?? employee.compensationProfile?.admissionDate ?? null;
      const terminationDate = employee.personnelProfile?.terminationDate ?? (employee.status === 'INACTIVE' ? employee.updatedAt : null);
      return {
        id: employee.id,
        name: employee.name,
        registrationId: employee.registrationId,
        orgNodeId: employee.orgNodeId,
        orgNodeName: employee.orgNode?.name ?? 'Sem área',
        userId: employee.personnelProfile?.userId ?? null,
        admissionDate,
        terminationDate,
      };
    });
  }

  private loadLeaves(companyId: string, ref: string) {
    const { first, last } = monthWindow(ref);
    return this.prisma.leaveRecord.findMany({
      where: {
        companyId, deletedAt: null,
        startDate: { lte: last },
        OR: [{ endDate: null }, { endDate: { gte: first } }],
      },
      select: { id: true, employeeId: true, type: true, startDate: true, endDate: true, cid: true },
      take: 20000,
    });
  }
}

interface PeriodRow {
  user: { id: string; name: string; email: string };
  plannedMinutes: number;
  workedMinutes: number;
  balanceMinutes: number;
  absentDays: number;
  inconsistentDays: number;
  punches?: number;
}

function currentRef(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthWindow(ref: string): { first: Date; last: Date } {
  const [year, month] = ref.split('-').map(Number);
  return { first: new Date(Date.UTC(year, month - 1, 1)), last: monthEnd(ref) };
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function parseDate(value: string, label: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`Data ${label} inválida.`);
  return parsed;
}

function csvSafe(value: string): string {
  const text = String(value ?? '');
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function num(value: number): string {
  return value.toFixed(2).replace('.', ',');
}
