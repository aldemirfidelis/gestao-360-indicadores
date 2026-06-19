import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrizeConnectorType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';

export interface UpsertConnectorDto {
  kind?: string; // APDATA_ELIGIBLE | APDATA_EVENTS | PAYROLL
  name?: string;
  type?: PrizeConnectorType;
  active?: boolean;
  config?: unknown;
  secretRef?: string | null;
  schedule?: string | null;
  notes?: string | null;
}

const KINDS = ['APDATA_ELIGIBLE', 'APDATA_EVENTS', 'PAYROLL'];

/**
 * Conectores configuraveis por empresa. Segredos NUNCA sao armazenados: guardamos
 * apenas a referencia (nome de env var / cofre) em secretRef. O "test" verifica a
 * presenca da credencial referenciada e a coerencia da config, sem expor valores.
 */
@Injectable()
export class PrizeConnectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
  ) {}

  list(companyId: string) {
    return this.prisma.prizeIntegrationConfig.findMany({
      where: { companyId },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { jobs: true } } },
    });
  }

  async upsert(me: AuthPayload, id: string | null, dto: UpsertConnectorDto) {
    if (!id) {
      if (!dto.kind || !KINDS.includes(dto.kind)) throw new BadRequestException('Tipo de conector inválido');
      if (!dto.name?.trim()) throw new BadRequestException('Nome do conector é obrigatório');
      const created = await this.prisma.prizeIntegrationConfig.create({
        data: {
          companyId: me.companyId, kind: dto.kind, name: dto.name.trim(), type: dto.type ?? 'MANUAL',
          active: dto.active ?? true, config: (dto.config as Prisma.InputJsonValue) ?? undefined,
          secretRef: dto.secretRef ?? null, schedule: dto.schedule ?? null, notes: dto.notes ?? null, createdById: me.sub,
        },
      });
      await this.audit.log(me, { action: 'CREATE', entityType: 'CONNECTOR', entityId: created.id, after: this.redact(created) });
      return this.redact(created);
    }
    const current = await this.prisma.prizeIntegrationConfig.findFirst({ where: { id, companyId: me.companyId } });
    if (!current) throw new NotFoundException('Conector não encontrado');
    const updated = await this.prisma.prizeIntegrationConfig.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined, type: dto.type ?? undefined, active: dto.active ?? undefined,
        config: (dto.config as Prisma.InputJsonValue) ?? undefined, secretRef: dto.secretRef ?? undefined,
        schedule: dto.schedule ?? undefined, notes: dto.notes ?? undefined,
      },
    });
    await this.audit.log(me, { action: 'UPDATE', entityType: 'CONNECTOR', entityId: id, after: this.redact(updated) });
    return this.redact(updated);
  }

  async remove(me: AuthPayload, id: string) {
    const current = await this.prisma.prizeIntegrationConfig.findFirst({ where: { id, companyId: me.companyId } });
    if (!current) throw new NotFoundException('Conector não encontrado');
    await this.prisma.prizeIntegrationConfig.delete({ where: { id } });
    await this.audit.log(me, { action: 'DELETE', entityType: 'CONNECTOR', entityId: id, before: this.redact(current) });
    return { ok: true };
  }

  /** Testa o conector: valida presenca da credencial referenciada (sem expor valor). */
  async test(me: AuthPayload, id: string) {
    const cfg = await this.prisma.prizeIntegrationConfig.findFirst({ where: { id, companyId: me.companyId } });
    if (!cfg) throw new NotFoundException('Conector não encontrado');
    const checks: Array<{ key: string; ok: boolean; detail: string }> = [];
    checks.push({ key: 'active', ok: cfg.active, detail: cfg.active ? 'Conector ativo' : 'Conector inativo' });
    if (cfg.type === 'API' || cfg.type === 'DB_BRIDGE') {
      const present = !!cfg.secretRef && !!process.env[cfg.secretRef];
      checks.push({ key: 'credential', ok: present, detail: present ? `Credencial ${cfg.secretRef} presente` : 'Credencial ausente (configure a variável de ambiente referenciada)' });
      const hasEndpoint = !!(cfg.config as any)?.endpoint;
      checks.push({ key: 'endpoint', ok: hasEndpoint, detail: hasEndpoint ? 'Endpoint configurado' : 'Endpoint ausente na config' });
    } else {
      checks.push({ key: 'mode', ok: true, detail: 'Modo manual/arquivo: importação assistida disponível' });
    }
    const ok = checks.every((c) => c.ok);
    await this.prisma.prizeIntegrationConfig.update({ where: { id }, data: { lastStatus: ok ? 'OK' : 'WARN', lastRunAt: new Date() } });
    await this.audit.log(me, { action: 'TEST', entityType: 'CONNECTOR', entityId: id, after: { ok } });
    return { ok, checks };
  }

  listJobs(companyId: string, kind?: string, competenceId?: string) {
    return this.prisma.prizeIntegrationJob.findMany({
      where: { companyId, ...(kind ? { kind } : {}), ...(competenceId ? { competenceId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // Nunca expor secretRef em respostas (apenas indicar se existe).
  private redact<T extends { secretRef: string | null }>(cfg: T) {
    return { ...cfg, secretRef: undefined, hasSecret: !!cfg.secretRef };
  }
}
