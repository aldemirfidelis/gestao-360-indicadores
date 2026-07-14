import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import { PersonnelService } from './personnel.service';
import {
  DEFAULT_RUBRICS,
  aggregatePayrollEvents,
  eventsToRubricQuantities,
  type PayrollEvents,
} from './payroll.logic';

const MODULE = 'personnel';
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Motor de eventos para a folha: deriva rubricas da apuração (horas normais,
 * HE por faixa, adicional noturno, faltas, banco), mapeia para os códigos da
 * folha da empresa e exporta (CSV/JSON/TXT) com histórico para conciliação.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly personnel: PersonnelService,
  ) {}

  // ------------------------------ Rubricas ------------------------------

  /** Mapa de rubricas da empresa; semeia o catálogo padrão na primeira leitura. */
  async listRubrics(companyId: string) {
    const existing = await this.prisma.payrollRubricMap.findMany({ where: { companyId }, orderBy: { eventKey: 'asc' } });
    const byKey = new Map(existing.map((row) => [row.eventKey, row]));
    const missing = DEFAULT_RUBRICS.filter((rubric) => !byKey.has(rubric.eventKey));
    if (missing.length) {
      await this.prisma.payrollRubricMap.createMany({
        data: missing.map((rubric) => ({
          companyId,
          eventKey: rubric.eventKey,
          payrollCode: rubric.defaultCode,
          description: rubric.description,
          unit: rubric.unit,
        })),
        skipDuplicates: true,
      });
      return this.prisma.payrollRubricMap.findMany({ where: { companyId }, orderBy: { eventKey: 'asc' } });
    }
    return existing;
  }

  async setRubric(me: AuthPayload, body: any = {}) {
    const eventKey = String(body?.eventKey ?? '');
    if (!DEFAULT_RUBRICS.some((rubric) => rubric.eventKey === eventKey)) {
      throw new BadRequestException('Rubrica interna desconhecida.');
    }
    const payrollCode = String(body?.payrollCode ?? '').trim();
    if (!payrollCode) throw new BadRequestException('Código da folha é obrigatório.');
    const defaults = DEFAULT_RUBRICS.find((rubric) => rubric.eventKey === eventKey)!;
    const saved = await this.prisma.payrollRubricMap.upsert({
      where: { companyId_eventKey: { companyId: me.companyId, eventKey } },
      create: {
        companyId: me.companyId,
        eventKey,
        payrollCode,
        description: String(body?.description ?? defaults.description),
        unit: ['HORAS', 'DIAS', 'VALOR'].includes(body?.unit) ? body.unit : defaults.unit,
        active: body?.active !== false,
        updatedById: me.sub,
      },
      update: {
        payrollCode,
        ...(body?.description !== undefined ? { description: String(body.description) } : {}),
        ...(['HORAS', 'DIAS', 'VALOR'].includes(body?.unit) ? { unit: body.unit } : {}),
        ...(body?.active !== undefined ? { active: Boolean(body.active) } : {}),
        updatedById: me.sub,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollRubricMap',
      entityId: saved.id,
      action: 'UPDATE',
      message: `Rubrica ${eventKey} mapeada para o código ${payrollCode}`,
      after: { eventKey, payrollCode, active: saved.active },
    });
    return saved;
  }

  // ------------------------------ Eventos ------------------------------

  /** Eventos da competência por colaborador (fonte da exportação). */
  async computeEvents(me: AuthPayload, ref: string) {
    if (!PERIOD_RE.test(ref)) throw new BadRequestException('Competência inválida (use YYYY-MM).');
    const report = await this.personnel.periodReport(me, ref); // aplica escopo por área
    const rows: Array<{ user: { id: string; name: string; email: string }; events: PayrollEvents; quantities: Record<string, number> }> = [];
    for (const row of report.rows as Array<{ user: { id: string; name: string; email: string } }>) {
      const days = await this.personnel.payrollDaysForUser(me.companyId, row.user.id, ref);
      const events = aggregatePayrollEvents(days);
      rows.push({ user: row.user, events, quantities: eventsToRubricQuantities(events) });
    }
    return { periodRef: ref, status: report.status, rows };
  }

  // ------------------------------ Exportação ------------------------------

  async export(me: AuthPayload, ref: string, format: 'CSV' | 'JSON' | 'TXT') {
    const { periodRef, rows } = await this.computeEvents(me, ref);
    const rubrics = await this.listRubrics(me.companyId);
    const active = rubrics.filter((rubric) => rubric.active);

    const lines: Array<{ userId: string; name: string; email: string; eventKey: string; payrollCode: string; unit: string; quantity: number }> = [];
    for (const row of rows) {
      for (const rubric of active) {
        const quantity = row.quantities[rubric.eventKey] ?? 0;
        if (quantity === 0) continue;
        lines.push({
          userId: row.user.id,
          name: row.user.name,
          email: row.user.email,
          eventKey: rubric.eventKey,
          payrollCode: rubric.payrollCode,
          unit: rubric.unit,
          quantity,
        });
      }
    }

    const content = format === 'JSON' ? this.toJson(periodRef, lines) : format === 'TXT' ? this.toTxt(lines) : this.toCsv(lines);
    const payloadHash = createHash('sha256').update(content).digest('hex');
    const totals = this.summarize(lines);

    await this.prisma.payrollExport.create({
      data: {
        companyId: me.companyId,
        periodRef,
        format,
        employees: rows.length,
        lineCount: lines.length,
        totalsJson: totals,
        payloadHash,
        createdById: me.sub,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollExport',
      action: 'EXPORT',
      message: `Exportação de folha ${periodRef} (${format}): ${lines.length} lançamentos, ${rows.length} colaboradores`,
      after: { periodRef, format, lineCount: lines.length, payloadHash },
    });

    const mime = format === 'JSON' ? 'application/json' : 'text/plain; charset=utf-8';
    const ext = format === 'JSON' ? 'json' : format === 'TXT' ? 'txt' : 'csv';
    return { fileName: `folha-${periodRef}.${ext}`, content: Buffer.from(content, 'utf8'), mimeType: format === 'CSV' ? 'text/csv; charset=utf-8' : mime };
  }

  async listExports(me: AuthPayload, ref?: string) {
    return this.prisma.payrollExport.findMany({
      where: { companyId: me.companyId, ...(ref && PERIOD_RE.test(ref) ? { periodRef: ref } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private toCsv(lines: Array<{ name: string; email: string; payrollCode: string; eventKey: string; unit: string; quantity: number }>): string {
    const header = 'colaborador;email;codigo_folha;evento;unidade;quantidade';
    const body = lines.map((line) =>
      [csv(line.name), csv(line.email), csv(line.payrollCode), csv(line.eventKey), csv(line.unit), String(line.quantity).replace('.', ',')].join(';'),
    );
    return `﻿${[header, ...body].join('\r\n')}\r\n`;
  }

  private toTxt(lines: Array<{ userId: string; payrollCode: string; quantity: number; unit: string }>): string {
    // Posicional simples: matrícula/ID (16) + código (8) + quantidade*100 (10, zero-fill).
    return (
      lines
        .map((line) => {
          const id = line.userId.replace(/-/g, '').slice(0, 16).padEnd(16, ' ');
          const code = line.payrollCode.slice(0, 8).padEnd(8, ' ');
          const qty = String(Math.round(line.quantity * 100)).padStart(10, '0');
          return `${id}${code}${qty}`;
        })
        .join('\r\n') + '\r\n'
    );
  }

  private toJson(periodRef: string, lines: unknown[]): string {
    return JSON.stringify({ periodRef, generatedAt: new Date().toISOString(), lines }, null, 2);
  }

  private summarize(lines: Array<{ eventKey: string; quantity: number }>): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const line of lines) totals[line.eventKey] = Math.round(((totals[line.eventKey] ?? 0) + line.quantity) * 100) / 100;
    return totals;
  }
}

function csv(value: string): string {
  return String(value ?? '').replaceAll(';', ',').replaceAll(/\r?\n/g, ' ');
}
