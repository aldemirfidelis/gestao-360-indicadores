import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ResultsService } from '../results/results.service';

interface ResultInput {
  indicatorCode?: string;
  periodRef?: string;
  value?: number;
  note?: string;
}

@Injectable()
export class ExternalApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly results: ResultsService,
  ) {}

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
        await this.results.upsert({ indicatorId: indicator.id, periodRef, value, note: it.note }, actor);
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
