import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrizeConnectorType } from '@prisma/client';
import { Workbook, Worksheet } from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';
import { EligibleRow, generateMockEligible, maskCpf, reconcile, SnapshotLike } from './prize-eligible.util';
import {
  ELIGIBLE_TEMPLATE_HEADERS,
  EVENT_TEMPLATE_HEADERS,
  KNOWN_EVENT_TYPES,
  parseEligibleRows,
  parseEventRows,
} from './prize-eligible-import.util';

export interface ImportEligibleDto {
  source?: PrizeConnectorType;
  configId?: string | null;
  rows?: EligibleRow[];
  useMock?: boolean;
  mockCount?: number;
  events?: Array<{ registration: string; type: string; date?: string; days?: number; value?: number; description?: string }>;
}

/**
 * Payload da importacao manual por arquivo (contingencia do Apdata):
 * CSV ja parseado no cliente (papaparse) OU XLSX bruto em base64 (parse aqui).
 * O commit SEMPRE revalida no servidor — nunca confia no preview do cliente.
 */
export interface FileImportPayload {
  fileName?: string;
  rawRows?: Array<Record<string, unknown>>;
  rawEvents?: Array<Record<string, unknown>>;
  xlsxBase64?: string;
}

@Injectable()
export class PrizeEligibleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
  ) {}

  async canSeeSalary(me: AuthPayload): Promise<boolean> {
    if (me.role === 'SUPER_ADMIN' || me.role === 'COMPANY_ADMIN') return true;
    const user = await this.prisma.user.findUnique({
      where: { id: me.sub },
      select: {
        permissions: { select: { permission: { select: { key: true } } } },
        accessProfile: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
      },
    });
    const keys = new Set<string>();
    user?.permissions.forEach((i) => keys.add(i.permission.key));
    user?.accessProfile?.permissions.forEach((i) => keys.add(i.permission.key));
    return keys.has('prize:salary:view');
  }

  private async getCompetence(companyId: string, competenceId: string) {
    const c = await this.prisma.prizeCompetence.findFirst({ where: { id: competenceId, companyId } });
    if (!c) throw new NotFoundException('Competência não encontrada');
    return c;
  }

  /**
   * Importa a base elegivel de uma competencia (snapshot imutavel por lote).
   * Aceita linhas ja parseadas (arquivo CSV/XLSX/JSON) ou base ficticia (mock)
   * para homologacao. Marca o lote anterior como nao-corrente e concilia.
   */
  async import(me: AuthPayload, competenceId: string, dto: ImportEligibleDto) {
    await this.getCompetence(me.companyId, competenceId);
    const source = dto.source ?? 'MANUAL';
    const rows: EligibleRow[] = dto.rows?.length ? dto.rows : dto.useMock ? generateMockEligible(dto.mockCount ?? 12) : [];
    if (!rows.length) throw new BadRequestException('Nenhuma linha para importar (envie rows ou useMock=true)');

    const lastLot = await this.prisma.prizeEmployeeSnapshot.aggregate({
      where: { competenceId },
      _max: { lotVersion: true },
    });
    const lotVersion = (lastLot._max.lotVersion ?? 0) + 1;

    // snapshot atual (lote corrente) para conciliacao
    const previous = await this.prisma.prizeEmployeeSnapshot.findMany({
      where: { competenceId, current: true },
      select: { registration: true, positionRef: true, areaRef: true, costCenterRef: true, situation: true, baseSalary: true },
    });
    const prevLike: SnapshotLike[] = previous.map((p) => ({ ...p, baseSalary: p.baseSalary ? Number(p.baseSalary) : null }));
    const recon = reconcile(prevLike, rows.map((r) => ({
      registration: r.registration, positionRef: r.positionRef ?? null, areaRef: r.areaRef ?? null,
      costCenterRef: r.costCenterRef ?? null, situation: r.situation ?? null, baseSalary: r.baseSalary ?? null,
    })));

    const job = await this.prisma.prizeIntegrationJob.create({
      data: {
        companyId: me.companyId, configId: dto.configId ?? null, kind: 'APDATA_ELIGIBLE', competenceId,
        type: source, status: 'RUNNING', lotVersion, startedAt: new Date(), createdById: me.sub,
      },
    });

    try {
      // Insercao em LOTE (createMany) em vez de 1 create por linha: com ~2700
      // colaboradores, o loop por linha estourava o timeout de 5s da transacao
      // interativa do Prisma ("Transaction already closed"). createMany faz um
      // unico round-trip e o timeout ampliado cobre lotes grandes.
      await this.prisma.$transaction(async (tx) => {
        await tx.prizeEmployeeSnapshot.updateMany({ where: { competenceId, current: true }, data: { current: false } });
        await tx.prizeEmployeeSnapshot.createMany({
          data: rows.map((r) => ({
            companyId: me.companyId, competenceId, batchId: job.id, lotVersion, current: true,
            registration: r.registration, name: r.name, cpfMasked: maskCpf(r.cpf), bond: r.bond ?? null,
            branchRef: r.branchRef ?? null, unitRef: r.unitRef ?? null, positionRef: r.positionRef ?? null,
            functionRef: r.functionRef ?? null, areaRef: r.areaRef ?? null, sectorRef: r.sectorRef ?? null,
            costCenterRef: r.costCenterRef ?? null, baseSalary: r.baseSalary ?? null,
            admissionDate: r.admissionDate ? new Date(r.admissionDate) : null,
            terminationDate: r.terminationDate ? new Date(r.terminationDate) : null,
            situation: r.situation ?? 'ACTIVE', workedDays: r.workedDays ?? null, source,
          })),
        });
        const events = dto.events ?? [];
        if (events.length) {
          const snaps = await tx.prizeEmployeeSnapshot.findMany({ where: { competenceId, lotVersion }, select: { id: true, registration: true } });
          const idByReg = new Map(snaps.map((s) => [s.registration, s.id]));
          await tx.prizeEmployeeEvent.createMany({
            data: events.map((ev) => ({
              companyId: me.companyId, competenceId, snapshotId: idByReg.get(ev.registration) ?? null, registration: ev.registration,
              type: ev.type, date: ev.date ? new Date(ev.date) : null, days: ev.days ?? null, value: ev.value ?? null,
              description: ev.description ?? null, source, batchId: job.id,
            })),
          });
        }
      }, { timeout: 120_000, maxWait: 20_000 });

      const updatedJob = await this.prisma.prizeIntegrationJob.update({
        where: { id: job.id },
        data: { status: 'SUCCESS', processed: rows.length, finishedAt: new Date(), summary: recon as unknown as Prisma.InputJsonValue },
      });
      await this.audit.log(me, { action: 'IMPORT_ELIGIBLE', entityType: 'ELIGIBLE_BATCH', entityId: job.id, competenceId, after: { lotVersion, processed: rows.length } });
      return { job: updatedJob, reconciliation: recon };
    } catch (e: any) {
      await this.prisma.prizeIntegrationJob.update({ where: { id: job.id }, data: { status: 'ERROR', errorsCount: 1, finishedAt: new Date(), log: String(e?.message ?? e) } });
      throw e;
    }
  }

  // ---- importacao manual por arquivo (CSV/XLSX) — contingencia do Apdata ----

  private sheetToRecords(ws: Worksheet): Array<Record<string, unknown>> {
    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
      headers[col] = String(cell.value ?? '').trim();
    });
    const out: Array<Record<string, unknown>> = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rec: Record<string, unknown> = {};
      let hasValue = false;
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const h = headers[col];
        if (!h) return;
        let v: unknown = cell.value;
        if (v && typeof v === 'object' && !(v instanceof Date)) {
          const o = v as { richText?: Array<{ text: string }>; text?: unknown; result?: unknown };
          if (o.richText) v = o.richText.map((r) => r.text).join('');
          else if (o.text !== undefined) v = o.text;
          else if (o.result !== undefined) v = o.result;
        }
        if (v !== null && v !== undefined && String(v).trim() !== '') hasValue = true;
        rec[h] = v;
      });
      if (hasValue) out.push(rec);
    });
    return out;
  }

  /** Extrai linhas cruas do payload: XLSX (abas Colaboradores/Eventos) ou CSV pre-parseado. */
  private async extractRaw(payload: FileImportPayload): Promise<{ rawRows: Array<Record<string, unknown>>; rawEvents: Array<Record<string, unknown>> }> {
    if (payload.xlsxBase64) {
      let wb: Workbook;
      try {
        wb = new Workbook();
        await wb.xlsx.load(Buffer.from(payload.xlsxBase64, 'base64') as unknown as ArrayBuffer);
      } catch {
        throw new BadRequestException('Arquivo XLSX inválido ou corrompido');
      }
      const eligibleSheet =
        wb.worksheets.find((w) => w.name.toLowerCase().startsWith('colaborador')) ?? wb.worksheets[0];
      const eventsSheet = wb.worksheets.find((w) => w.name.toLowerCase().startsWith('evento'));
      return {
        rawRows: eligibleSheet ? this.sheetToRecords(eligibleSheet) : [],
        rawEvents: eventsSheet ? this.sheetToRecords(eventsSheet) : [],
      };
    }
    return { rawRows: payload.rawRows ?? [], rawEvents: payload.rawEvents ?? [] };
  }

  /**
   * Valida o arquivo e simula a importacao SEM gravar nada: retorna linhas
   * aceitas, erros/avisos por linha e a conciliacao contra o snapshot atual.
   */
  async previewImport(me: AuthPayload, competenceId: string, payload: FileImportPayload) {
    await this.getCompetence(me.companyId, competenceId);
    const { rawRows, rawEvents } = await this.extractRaw(payload);
    if (!rawRows.length && !rawEvents.length) {
      throw new BadRequestException('Arquivo vazio: nenhuma linha de colaborador ou evento encontrada');
    }

    const eligible = parseEligibleRows(rawRows);

    // Eventos validam matricula contra: base do proprio arquivo OU snapshot corrente (append).
    let knownRegs: Set<string>;
    if (eligible.rows.length) {
      knownRegs = new Set(eligible.rows.map((r) => r.registration));
    } else {
      const current = await this.prisma.prizeEmployeeSnapshot.findMany({
        where: { competenceId, current: true },
        select: { registration: true },
      });
      knownRegs = new Set(current.map((c) => c.registration));
    }
    const events = parseEventRows(rawEvents, knownRegs);

    // Conciliacao simulada (dry-run) contra o snapshot corrente.
    let reconciliation = null;
    if (eligible.rows.length) {
      const previous = await this.prisma.prizeEmployeeSnapshot.findMany({
        where: { competenceId, current: true },
        select: { registration: true, positionRef: true, areaRef: true, costCenterRef: true, situation: true, baseSalary: true },
      });
      const prevLike: SnapshotLike[] = previous.map((p) => ({ ...p, baseSalary: p.baseSalary ? Number(p.baseSalary) : null }));
      reconciliation = reconcile(prevLike, eligible.rows.map((r) => ({
        registration: r.registration, positionRef: r.positionRef ?? null, areaRef: r.areaRef ?? null,
        costCenterRef: r.costCenterRef ?? null, situation: r.situation ?? null, baseSalary: r.baseSalary ?? null,
      })));
    }

    const errorCount = eligible.errors.length + events.errors.length;
    return {
      fileName: payload.fileName ?? null,
      mode: eligible.rows.length || eligible.errors.length ? 'FULL_IMPORT' : 'EVENTS_APPEND',
      eligible: { total: rawRows.length, ok: eligible.rows.length, errors: eligible.errors, warnings: eligible.warnings, unknownColumns: eligible.unknownColumns },
      events: { total: rawEvents.length, ok: events.events.length, errors: events.errors, warnings: events.warnings, unknownColumns: events.unknownColumns, knownTypes: KNOWN_EVENT_TYPES },
      reconciliation,
      canCommit: errorCount === 0,
    };
  }

  /**
   * Importa o arquivo (commit). REVALIDA tudo no servidor e rejeita o arquivo
   * inteiro se houver QUALQUER erro — em pagamento, importacao parcial e
   * silenciosa nao e aceitavel.
   */
  async importFromFile(me: AuthPayload, competenceId: string, payload: FileImportPayload) {
    const preview = await this.previewImport(me, competenceId, payload);
    if (!preview.canCommit) {
      throw new BadRequestException({
        message: `Arquivo rejeitado: ${preview.eligible.errors.length + preview.events.errors.length} erro(s) de validação. Corrija e reenvie.`,
        eligibleErrors: preview.eligible.errors,
        eventErrors: preview.events.errors,
      });
    }
    const { rawRows, rawEvents } = await this.extractRaw(payload);
    const eligible = parseEligibleRows(rawRows);
    const events = parseEventRows(rawEvents);
    const source: PrizeConnectorType = payload.xlsxBase64 ? 'FILE_XLSX' : 'FILE_CSV';

    if (preview.mode === 'EVENTS_APPEND') {
      return this.appendEvents(
        me,
        competenceId,
        events.events.map((e) => ({ ...e, date: e.date ?? undefined, days: e.days ?? undefined, value: e.value ?? undefined, description: e.description ?? undefined })),
        source,
      );
    }
    return this.import(me, competenceId, {
      source,
      rows: eligible.rows,
      events: events.events.map((e) => ({ ...e, date: e.date ?? undefined, days: e.days ?? undefined, value: e.value ?? undefined, description: e.description ?? undefined })),
    });
  }

  /** Modelo XLSX oficial: abas Colaboradores + Eventos + Instruções (dados de exemplo fictícios). */
  async buildTemplate(): Promise<Buffer> {
    const wb = new Workbook();
    const ws = wb.addWorksheet('Colaboradores');
    ws.addRow([...ELIGIBLE_TEMPLATE_HEADERS]);
    ws.addRow(['1001', 'Ana Silva (EXEMPLO — apague esta linha)', '529.982.247-25', 'CLT', 'Matriz', 'Usina', 'Operador I', 'Operacao', 'Producao', 'Moagem', 'CC-100', '3.500,75', '10/01/2022', '', 'ATIVO', 30]);
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => { c.width = 18; });

    const we = wb.addWorksheet('Eventos');
    we.addRow([...EVENT_TEMPLATE_HEADERS]);
    we.addRow(['1001', 'FALTA', '05/03/2026', 1, '', 'Exemplo — apague esta linha']);
    we.getRow(1).font = { bold: true };
    we.columns.forEach((c) => { c.width = 18; });

    const wi = wb.addWorksheet('Instrucoes');
    [
      'IMPORTAÇÃO MANUAL DA BASE ELEGÍVEL (contingência do Apdata)',
      '',
      'Aba "Colaboradores": um colaborador por linha. Obrigatórios: matricula e nome.',
      'CPF: com ou sem máscara; o dígito verificador é validado e o CPF é gravado mascarado (LGPD).',
      'salario_base: aceita 3.500,75 / 3500.75. Sem salário o colaborador não é apurado.',
      'Datas: dd/mm/aaaa. situacao: ATIVO, DESLIGADO, AFASTADO, FERIAS ou TREINAMENTO.',
      'dias_trabalhados: inteiro entre 0 e 31 (proporcionalidade).',
      '',
      `Aba "Eventos": tipos aceitos: ${KNOWN_EVENT_TYPES.join(', ')}.`,
      'Tipo de evento fora da lista é REJEITADO (não casaria com as regras de moderador).',
      '',
      'A importação é tudo-ou-nada: qualquer erro rejeita o arquivo inteiro (prévia mostra cada linha).',
      'Cada importação gera um NOVO lote (snapshot imutável) e a conciliação contra o lote anterior.',
    ].forEach((l) => wi.addRow([l]));
    wi.getColumn(1).width = 110;

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /** Anexa eventos (faltas/atestados/etc.) ao snapshot corrente sem gerar novo lote — usado pela API externa. */
  async appendEvents(
    me: AuthPayload,
    competenceId: string,
    events: Array<{ registration: string; type: string; date?: string; days?: number; value?: number; description?: string }>,
    source: PrizeConnectorType = 'API',
  ) {
    await this.getCompetence(me.companyId, competenceId);
    if (!events?.length) throw new BadRequestException('Nenhum evento para registrar');
    let created = 0;
    for (const ev of events) {
      if (!ev.registration?.trim() || !ev.type?.trim()) continue;
      const snap = await this.prisma.prizeEmployeeSnapshot.findFirst({
        where: { competenceId, registration: ev.registration, current: true },
      });
      await this.prisma.prizeEmployeeEvent.create({
        data: {
          companyId: me.companyId, competenceId, snapshotId: snap?.id ?? null, registration: ev.registration,
          type: ev.type, date: ev.date ? new Date(ev.date) : null, days: ev.days ?? null, value: ev.value ?? null,
          description: ev.description ?? null, source,
        },
      });
      created++;
    }
    await this.audit.log(me, { action: 'APPEND_EVENTS', entityType: 'ELIGIBLE_BATCH', entityId: competenceId, competenceId, after: { created, source } });
    return { created };
  }

  async listSnapshot(me: AuthPayload, competenceId: string) {
    await this.getCompetence(me.companyId, competenceId);
    const canSalary = await this.canSeeSalary(me);
    const rows = await this.prisma.prizeEmployeeSnapshot.findMany({
      where: { companyId: me.companyId, competenceId, current: true },
      orderBy: [{ name: 'asc' }],
      include: { _count: { select: { events: true } } },
    });
    return {
      canSeeSalary: canSalary,
      total: rows.length,
      employees: rows.map((r) => ({
        id: r.id, registration: r.registration, name: r.name, cpfMasked: r.cpfMasked,
        positionRef: r.positionRef, areaRef: r.areaRef, costCenterRef: r.costCenterRef,
        situation: r.situation, workedDays: r.workedDays, eligible: r.eligible, blocked: r.blocked,
        lotVersion: r.lotVersion, events: r._count.events,
        baseSalary: canSalary ? (r.baseSalary ? Number(r.baseSalary) : null) : null,
      })),
    };
  }

  async lastReconciliation(companyId: string, competenceId: string) {
    await this.getCompetence(companyId, competenceId);
    const job = await this.prisma.prizeIntegrationJob.findFirst({
      where: { companyId, competenceId, kind: 'APDATA_ELIGIBLE', status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
    });
    return { job, reconciliation: job?.summary ?? null };
  }

  async listEvents(companyId: string, competenceId: string, registration?: string) {
    await this.getCompetence(companyId, competenceId);
    return this.prisma.prizeEmployeeEvent.findMany({
      where: { companyId, competenceId, ...(registration ? { registration } : {}) },
      orderBy: [{ registration: 'asc' }, { date: 'asc' }],
    });
  }

  async setEligibility(me: AuthPayload, snapshotId: string, eligible: boolean, justification: string) {
    const snap = await this.prisma.prizeEmployeeSnapshot.findFirst({ where: { id: snapshotId, companyId: me.companyId } });
    if (!snap) throw new NotFoundException('Colaborador não encontrado no snapshot');
    if (!justification?.trim()) throw new BadRequestException('Justificativa é obrigatória');
    const updated = await this.prisma.prizeEmployeeSnapshot.update({ where: { id: snapshotId }, data: { eligible, blocked: !eligible } });
    await this.audit.log(me, {
      action: 'SET_ELIGIBILITY', entityType: 'ELIGIBLE_EMPLOYEE', entityId: snapshotId, competenceId: snap.competenceId,
      before: { eligible: snap.eligible }, after: { eligible }, justification,
    });
    return updated;
  }
}
