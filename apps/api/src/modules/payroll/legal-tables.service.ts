import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import type { FgtsTableData, InssTableData, IrrfTableData, LegalTables } from './payroll-calc.logic';

const MODULE = 'payroll';
export const LEGAL_KINDS = ['INSS', 'IRRF', 'FGTS', 'SALARIO_MINIMO', 'SALARIO_FAMILIA'] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

const SEED_SOURCE = 'Seed inicial (tabelas oficiais vigentes 2025) — CONFERIR/ATUALIZAR com a contabilidade antes do uso real';

/**
 * Seed das tabelas nacionais (companyId nulo). Valores em CENTAVOS e basis
 * points. São DADOS versionados, não constantes do motor: qualquer atualização
 * legal entra como NOVA versão com vigência via POST /payroll/legal-tables.
 */
const SEED_TABLES: Array<{ kind: LegalKind; effectiveFrom: string; data: unknown }> = [
  {
    kind: 'INSS',
    effectiveFrom: '2025-01-01',
    data: {
      brackets: [
        { upToCents: 151800, rateBp: 750 },
        { upToCents: 279388, rateBp: 900 },
        { upToCents: 419083, rateBp: 1200 },
        { upToCents: 815741, rateBp: 1400 },
      ],
    } satisfies InssTableData,
  },
  {
    kind: 'IRRF',
    effectiveFrom: '2025-05-01',
    data: {
      brackets: [
        { upToCents: 242880, rateBp: 0, deductionCents: 0 },
        { upToCents: 282665, rateBp: 750, deductionCents: 18216 },
        { upToCents: 375105, rateBp: 1500, deductionCents: 39416 },
        { upToCents: 466468, rateBp: 2250, deductionCents: 67549 },
        { upToCents: null, rateBp: 2750, deductionCents: 90873 },
      ],
      dependentDeductionCents: 18959,
      simplifiedDiscountCents: 60720,
    } satisfies IrrfTableData,
  },
  { kind: 'FGTS', effectiveFrom: '2025-01-01', data: { rateBp: 800, apprenticeRateBp: 200 } satisfies FgtsTableData },
  { kind: 'SALARIO_MINIMO', effectiveFrom: '2025-01-01', data: { valueCents: 151800 } },
  { kind: 'SALARIO_FAMILIA', effectiveFrom: '2025-01-01', data: { quotaCents: 6500, remunerationCapCents: 190604 } },
];

@Injectable()
export class PayrollLegalTablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  /** Garante o seed nacional (roda uma vez; nunca sobrescreve versões). */
  private async ensureSeed() {
    const count = await this.prisma.payrollLegalTableVersion.count({ where: { companyId: null } });
    if (count > 0) return;
    await this.prisma.payrollLegalTableVersion.createMany({
      data: SEED_TABLES.map((seed) => ({
        companyId: null,
        kind: seed.kind,
        effectiveFrom: seed.effectiveFrom,
        data: seed.data as object,
        source: SEED_SOURCE,
      })),
      skipDuplicates: true,
    });
  }

  /** Lista versões visíveis (nacionais + overrides da empresa), mais novas primeiro. */
  async list(me: AuthPayload, kind?: string) {
    await this.ensureSeed();
    return this.prisma.payrollLegalTableVersion.findMany({
      where: {
        OR: [{ companyId: null }, { companyId: me.companyId }],
        ...(kind ? { kind } : {}),
      },
      orderBy: [{ kind: 'asc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Nova versão de parâmetro legal (nunca edita versão existente). Overrides
   * são sempre da empresa do usuário; a tabela nacional só muda por seed/ops.
   */
  async createVersion(me: AuthPayload, body: any = {}) {
    const kind = String(body?.kind ?? '');
    if (!LEGAL_KINDS.includes(kind as LegalKind)) throw new BadRequestException(`Tipo inválido (use ${LEGAL_KINDS.join(', ')}).`);
    const effectiveFrom = String(body?.effectiveFrom ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw new BadRequestException('Vigência inválida (use YYYY-MM-DD).');
    if (!body?.data || typeof body.data !== 'object') throw new BadRequestException('Payload da tabela é obrigatório.');
    this.validatePayload(kind as LegalKind, body.data);
    const created = await this.prisma.payrollLegalTableVersion.create({
      data: {
        companyId: me.companyId,
        kind,
        effectiveFrom,
        data: body.data,
        source: String(body?.source ?? '').trim() || null,
        createdById: me.sub,
      },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PayrollLegalTableVersion',
      entityId: created.id,
      action: 'CREATE',
      message: `Parâmetro legal ${kind} com vigência ${effectiveFrom} criado`,
      after: { kind, effectiveFrom },
    });
    return created;
  }

  private validatePayload(kind: LegalKind, data: any) {
    const isBracketed = kind === 'INSS' || kind === 'IRRF';
    if (isBracketed) {
      if (!Array.isArray(data.brackets) || data.brackets.length === 0) throw new BadRequestException('Tabela precisa de faixas (brackets).');
      let previous = 0;
      for (const bracket of data.brackets) {
        if (bracket.upToCents !== null && (!Number.isInteger(bracket.upToCents) || bracket.upToCents <= previous)) {
          throw new BadRequestException('Faixas devem ser crescentes, em centavos inteiros.');
        }
        if (!Number.isInteger(bracket.rateBp) || bracket.rateBp < 0) throw new BadRequestException('Alíquotas em basis points inteiros (1% = 100).');
        previous = bracket.upToCents ?? previous;
      }
    }
    if (kind === 'FGTS' && (!Number.isInteger(data.rateBp) || !Number.isInteger(data.apprenticeRateBp))) {
      throw new BadRequestException('FGTS exige rateBp e apprenticeRateBp inteiros.');
    }
  }

  /** Versão vigente de um kind na data (override da empresa vence a nacional). */
  private async effectiveVersion(companyId: string, kind: LegalKind, dateKey: string) {
    const base = { kind, active: true, effectiveFrom: { lte: dateKey } };
    const order = [{ effectiveFrom: 'desc' as const }, { createdAt: 'desc' as const }];
    const version =
      (await this.prisma.payrollLegalTableVersion.findFirst({ where: { ...base, companyId }, orderBy: order })) ??
      (await this.prisma.payrollLegalTableVersion.findFirst({ where: { ...base, companyId: null }, orderBy: order }));
    if (!version) throw new BadRequestException(`Sem tabela legal ${kind} vigente em ${dateKey}. Cadastre em Parâmetros Legais.`);
    return version;
  }

  /** Conjunto de tabelas usado pelo motor; o cálculo grava os versionIds. */
  async tablesFor(companyId: string, dateKey: string): Promise<LegalTables> {
    await this.ensureSeed();
    const [inss, irrf, fgts] = await Promise.all([
      this.effectiveVersion(companyId, 'INSS', dateKey),
      this.effectiveVersion(companyId, 'IRRF', dateKey),
      this.effectiveVersion(companyId, 'FGTS', dateKey),
    ]);
    return {
      inss: { versionId: inss.id, data: inss.data as unknown as InssTableData },
      irrf: { versionId: irrf.id, data: irrf.data as unknown as IrrfTableData },
      fgts: { versionId: fgts.id, data: fgts.data as unknown as FgtsTableData },
    };
  }
}
