import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ResultsService } from '../results/results.service';
import { PrizeEligibleService } from '../prize/prize-eligible.service';
import { AuthPayload } from '../auth/auth.types';
import { ExternalPrizeEligibleDto, ExternalPrizeEventsDto } from './external-api.dto';

interface ResultInput {
  indicatorCode?: string;
  periodRef?: string;
  value?: number;
  note?: string;
}

/** Identidade sintetica para trilha de auditoria das chamadas via chave de API. */
function apiActor(companyId: string): AuthPayload {
  return { sub: 'external-api', email: 'external-api@system', name: 'API Externa', role: 'ANALYST' as AuthPayload['role'], companyId };
}

@Injectable()
export class ExternalApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly results: ResultsService,
    private readonly prizeEligible: PrizeEligibleService,
  ) {}

  /** Resolve (ou cria) a competencia do premio por codigo do programa + ano/mes. */
  private async resolvePrizeCompetence(companyId: string, programCode: string, year: number, month: number) {
    const program = await this.prisma.prizeProgram.findFirst({ where: { companyId, code: programCode, deletedAt: null } });
    if (!program) throw new NotFoundException(`Programa de prêmio ${programCode} não encontrado`);
    const existing = await this.prisma.prizeCompetence.findFirst({ where: { programId: program.id, year, month } });
    if (existing) return existing;
    // Auto-cria a competencia: o push externo nao depende de passo manual previo.
    return this.prisma.prizeCompetence.create({
      data: {
        companyId, programId: program.id, year, month,
        label: `${year}-${String(month).padStart(2, '0')}`, status: 'FILLING',
      },
    });
  }

  /** Push da base elegivel (Apdata): snapshot imutavel por lote + conciliacao automatica. */
  async prizeEligiblePush(companyId: string, dto: ExternalPrizeEligibleDto) {
    const competence = await this.resolvePrizeCompetence(companyId, dto.programCode, dto.year, dto.month);
    const result = await this.prizeEligible.import(apiActor(companyId), competence.id, {
      source: 'API',
      rows: dto.employees,
      events: dto.events,
    });
    return {
      competenceId: competence.id,
      label: competence.label,
      job: { id: result.job.id, lotVersion: result.job.lotVersion, processed: result.job.processed },
      reconciliation: result.reconciliation,
    };
  }

  /** Push de eventos (faltas/atestados/medidas/acidentes) sem novo lote de snapshot. */
  async prizeEventsPush(companyId: string, dto: ExternalPrizeEventsDto) {
    const competence = await this.resolvePrizeCompetence(companyId, dto.programCode, dto.year, dto.month);
    const result = await this.prizeEligible.appendEvents(apiActor(companyId), competence.id, dto.events, 'API');
    return { competenceId: competence.id, label: competence.label, ...result };
  }

  /** Indicadores da empresa (código, definição, meta/realizado do último período). */
  async indicators(companyId: string) {
    const inds = await this.prisma.indicator.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        code: true,
        name: true,
        unit: true,
        direction: true,
        periodicity: true,
        type: true,
        ownerNode: { select: { name: true } },
        results: { orderBy: { periodDate: 'desc' }, take: 1, select: { periodRef: true, value: true, light: true, attainment: true } },
      },
    });
    return inds.map((i) => ({
      code: i.code,
      name: i.name,
      unit: i.unit,
      direction: i.direction,
      periodicity: i.periodicity,
      type: i.type,
      area: i.ownerNode?.name ?? null,
      last: i.results[0]
        ? { periodRef: i.results[0].periodRef, value: i.results[0].value, light: i.results[0].light, attainment: i.results[0].attainment }
        : null,
    }));
  }

  /** Estrutura organizacional (áreas/setores) da empresa. */
  async areas(companyId: string) {
    const nodes = await this.prisma.orgNode.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, code: true, type: true, parentId: true, active: true },
    });
    return nodes.map((n) => ({ id: n.id, name: n.name, code: n.code, type: n.type, parentId: n.parentId, active: n.active }));
  }

  /** Planos de ação da empresa (resumo). */
  async actionPlans(companyId: string) {
    const actions = await this.prisma.actionPlan.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true, title: true, status: true, priority: true, dueDate: true, progress: true,
        indicator: { select: { code: true } },
        ownerNode: { select: { name: true } },
        responsibleUser: { select: { name: true } },
      },
    });
    return actions.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      priority: a.priority,
      dueDate: a.dueDate,
      progress: a.progress,
      indicatorCode: a.indicator?.code ?? null,
      area: a.ownerNode?.name ?? null,
      responsible: a.responsibleUser?.name ?? null,
    }));
  }

  /** Importa realizados: [{ indicatorCode, periodRef, value, note? }]. Empresa vem da chave. */
  async upsertResults(companyId: string, items: ResultInput[]) {
    const actor = await this.resolveActor(companyId);
    let processed = 0;
    const errors: Array<{ indicatorCode?: string; periodRef?: string; error: string }> = [];
    for (const it of items ?? []) {
      const code = String(it.indicatorCode ?? '').trim();
      const periodRef = String(it.periodRef ?? '').trim();
      const value = Number(it.value);
      if (!code || !periodRef || !Number.isFinite(value)) {
        errors.push({ indicatorCode: it.indicatorCode, periodRef: it.periodRef, error: 'indicatorCode, periodRef e value são obrigatórios.' });
        continue;
      }
      const indicator = await this.prisma.indicator.findFirst({ where: { companyId, code, deletedAt: null }, select: { id: true } });
      if (!indicator) {
        errors.push({ indicatorCode: code, periodRef, error: 'Indicador não encontrado para este código nesta empresa.' });
        continue;
      }
      try {
        await this.results.upsertSystem(companyId, { indicatorId: indicator.id, periodRef, value, note: it.note }, actor);
        processed += 1;
      } catch (e) {
        errors.push({ indicatorCode: code, periodRef, error: (e as Error).message?.slice(0, 160) ?? 'Falha ao gravar.' });
      }
    }
    return { processed, errors };
  }

  /** userId válido (FK) para atribuir o lançamento recebido via API. */
  private async resolveActor(companyId: string): Promise<string> {
    const admin = await this.prisma.user.findFirst({
      where: { companyId, deletedAt: null, active: true, role: { in: ['COMPANY_ADMIN', 'SUPER_ADMIN', 'DIRECTOR'] } },
      select: { id: true },
    });
    if (!admin) throw new ForbiddenException('Nenhum usuário válido na empresa para registrar o lançamento.');
    return admin.id;
  }
}
