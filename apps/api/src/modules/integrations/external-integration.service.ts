import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ResultsService } from '../results/results.service';
import { AuthPayload } from '../auth/auth.types';
import { decryptJson, encryptJson, generateApiKey } from '../../common/crypto';
import { makeConnector, ConnectorContext } from './connectors';
import { CreateApiKeyDto, CreateExternalIntegrationDto, UpdateExternalIntegrationDto } from './external-integration.dto';

@Injectable()
export class ExternalIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly results: ResultsService,
  ) {}

  // -------------------- Conectores (outbound/inbound config) --------------------

  async listConnectors(companyId: string) {
    const rows = await this.prisma.externalIntegration.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.serialize(r));
  }

  async getConnector(companyId: string, id: string) {
    const row = await this.findOwned(companyId, id);
    return this.serialize(row);
  }

  async createConnector(me: AuthPayload, dto: CreateExternalIntegrationDto) {
    const created = await this.prisma.externalIntegration.create({
      data: {
        companyId: me.companyId,
        name: dto.name,
        provider: dto.provider,
        direction: dto.direction,
        authType: dto.authType,
        baseUrl: dto.baseUrl ?? null,
        status: dto.enabled === false ? 'disabled' : 'enabled',
        credentialsEnc: dto.credentials ? encryptJson(dto.credentials) : null,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        createdById: me.sub,
      },
    });
    await this.audit(me, 'CREATE', 'ExternalIntegration', created.id, { name: dto.name, provider: dto.provider });
    return this.serialize(created);
  }

  async updateConnector(me: AuthPayload, id: string, dto: UpdateExternalIntegrationDto) {
    await this.findOwned(me.companyId, id);
    const data: Prisma.ExternalIntegrationUpdateInput = {
      name: dto.name,
      direction: dto.direction,
      authType: dto.authType,
      baseUrl: dto.baseUrl,
      status: dto.enabled === undefined ? undefined : dto.enabled ? 'enabled' : 'disabled',
      config: dto.config === undefined ? undefined : (dto.config as Prisma.InputJsonValue),
    };
    // Só re-cifra se vierem credenciais novas (não apaga as existentes ao editar outros campos).
    if (dto.credentials !== undefined) data.credentialsEnc = encryptJson(dto.credentials);
    const updated = await this.prisma.externalIntegration.update({ where: { id }, data });
    await this.audit(me, 'UPDATE', 'ExternalIntegration', id, { name: dto.name });
    return this.serialize(updated);
  }

  async removeConnector(me: AuthPayload, id: string) {
    await this.findOwned(me.companyId, id);
    await this.prisma.externalIntegration.update({ where: { id }, data: { deletedAt: new Date(), status: 'disabled' } });
    await this.audit(me, 'DELETE', 'ExternalIntegration', id, null);
    return { ok: true };
  }

  async testConnector(me: AuthPayload, id: string) {
    const row = await this.findOwned(me.companyId, id);
    const connector = makeConnector(row.provider, this.contextFor(row));
    const started = Date.now();
    const res = await connector.testConnection();
    const latency = Date.now() - started;
    await this.recordRun(row.id, row.companyId, row.direction, 'test', res.ok, res.httpStatus, res.message, latency);
    await this.audit(me, 'TEST', 'ExternalIntegration', id, { ok: res.ok });
    return { ok: res.ok, httpStatus: res.httpStatus, message: res.message, latencyMs: latency };
  }

  async runConnector(me: AuthPayload, id: string, operation: string) {
    const row = await this.findOwned(me.companyId, id);
    if (row.direction === 'INBOUND') {
      throw new BadRequestException('Conector somente de entrada (INBOUND). Use chaves de API para receber dados.');
    }
    const connector = makeConnector(row.provider, this.contextFor(row));
    const started = Date.now();
    let res;
    if (operation === 'push:indicators') {
      res = await connector.push('indicators', await this.collectIndicators(row.companyId));
    } else if (operation === 'push:results') {
      res = await connector.push('results', await this.collectResults(row.companyId));
    } else if (operation === 'pull:results') {
      res = await connector.pull('results');
      if (res.ok) await this.ingestPulledResults(row.companyId, row.createdById, res.data);
    } else {
      throw new BadRequestException('Operação inválida.');
    }
    const latency = Date.now() - started;
    await this.recordRun(row.id, row.companyId, row.direction, operation, res.ok, res.httpStatus, res.message, latency);
    await this.audit(me, 'RUN', 'ExternalIntegration', id, { operation, ok: res.ok });
    return { ok: res.ok, httpStatus: res.httpStatus, message: res.message, latencyMs: latency };
  }

  async listLogs(companyId: string, id: string) {
    await this.findOwned(companyId, id);
    return this.prisma.externalIntegrationLog.findMany({
      where: { integrationId: id, companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // -------------------- Chaves de API (inbound) --------------------

  async listApiKeys(companyId: string) {
    const keys = await this.prisma.inboundApiKey.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
    // Nunca retorna keyHash.
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes,
      status: k.status,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    }));
  }

  async createApiKey(me: AuthPayload, dto: CreateApiKeyDto) {
    const { token, hash, prefix } = generateApiKey();
    const created = await this.prisma.inboundApiKey.create({
      data: {
        companyId: me.companyId,
        name: dto.name,
        keyHash: hash,
        keyPrefix: prefix,
        scopes: dedupeScopes(dto.scopes),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById: me.sub,
      },
    });
    await this.audit(me, 'CREATE', 'InboundApiKey', created.id, { name: dto.name, scopes: dto.scopes });
    // token mostrado UMA única vez.
    return { id: created.id, name: created.name, scopes: created.scopes, keyPrefix: prefix, token };
  }

  async revokeApiKey(me: AuthPayload, id: string) {
    const key = await this.prisma.inboundApiKey.findFirst({ where: { id, companyId: me.companyId } });
    if (!key) throw new NotFoundException('Chave não encontrada.');
    await this.prisma.inboundApiKey.update({ where: { id }, data: { status: 'revoked' } });
    await this.audit(me, 'REVOKE', 'InboundApiKey', id, null);
    return { ok: true };
  }

  // -------------------- helpers --------------------

  private async findOwned(companyId: string, id: string) {
    const row = await this.prisma.externalIntegration.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!row) throw new NotFoundException('Conector não encontrado.');
    return row;
  }

  private contextFor(row: { baseUrl: string | null; authType: string; credentialsEnc: string | null; config: Prisma.JsonValue }): ConnectorContext {
    return {
      baseUrl: row.baseUrl,
      authType: row.authType,
      credentials: decryptJson(row.credentialsEnc),
      config: (row.config as ConnectorContext['config']) ?? {},
    };
  }

  /** Projeção SEGURA (nunca expõe credenciais). */
  private serialize(r: {
    id: string; name: string; provider: string; direction: string; authType: string; baseUrl: string | null;
    status: string; credentialsEnc: string | null; config: Prisma.JsonValue; lastRunAt: Date | null;
    lastStatus: string | null; lastError: string | null; lastLatencyMs: number | null; createdAt: Date; updatedAt: Date;
  }) {
    return {
      id: r.id,
      name: r.name,
      provider: r.provider,
      direction: r.direction,
      authType: r.authType,
      baseUrl: r.baseUrl,
      status: r.status,
      hasCredentials: Boolean(r.credentialsEnc),
      config: r.config ?? {},
      lastRunAt: r.lastRunAt,
      lastStatus: r.lastStatus,
      lastError: r.lastError,
      lastLatencyMs: r.lastLatencyMs,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private async collectIndicators(companyId: string) {
    const inds = await this.prisma.indicator.findMany({
      where: { companyId, deletedAt: null },
      select: { code: true, name: true, unit: true, direction: true, periodicity: true, type: true },
    });
    return inds.map((i) => ({ code: i.code, name: i.name, unit: i.unit, direction: i.direction, periodicity: i.periodicity, type: i.type }));
  }

  private async collectResults(companyId: string) {
    const inds = await this.prisma.indicator.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, code: true },
    });
    const byId = new Map(inds.map((i) => [i.id, i.code]));
    const results = await this.prisma.indicatorResult.findMany({
      where: { indicatorId: { in: inds.map((i) => i.id) } },
      orderBy: { periodDate: 'desc' },
      take: 2000,
      select: { indicatorId: true, periodRef: true, value: true, light: true, attainment: true },
    });
    return results.map((r) => ({
      indicatorCode: byId.get(r.indicatorId) ?? null,
      periodRef: r.periodRef,
      value: r.value,
      light: r.light,
      attainment: r.attainment,
    }));
  }

  /** Ingestão de resultados puxados de fora: { items: [{ indicatorCode, periodRef, value }] }. */
  private async ingestPulledResults(companyId: string, createdById: string | null, data: unknown) {
    const items = extractItems(data);
    if (items.length === 0) return;
    const actor = await this.resolveActor(companyId, createdById);
    for (const it of items) {
      const code = String((it as any).indicatorCode ?? (it as any).code ?? '').trim();
      const periodRef = String((it as any).periodRef ?? '').trim();
      const value = Number((it as any).value);
      if (!code || !periodRef || !Number.isFinite(value)) continue;
      const indicator = await this.prisma.indicator.findFirst({
        where: { companyId, code, deletedAt: null },
        select: { id: true },
      });
      if (!indicator) continue;
      await this.results.upsert({ indicatorId: indicator.id, periodRef, value }, actor).catch(() => undefined);
    }
  }

  /** Garante um userId válido (FK) para atribuir lançamentos vindos de integração. */
  private async resolveActor(companyId: string, createdById: string | null): Promise<string> {
    if (createdById) {
      const u = await this.prisma.user.findFirst({ where: { id: createdById, companyId }, select: { id: true } });
      if (u) return u.id;
    }
    const admin = await this.prisma.user.findFirst({
      where: { companyId, deletedAt: null, active: true, role: { in: ['COMPANY_ADMIN', 'SUPER_ADMIN', 'DIRECTOR'] } },
      select: { id: true },
    });
    if (!admin) throw new ForbiddenException('Nenhum usuário válido para registrar a integração.');
    return admin.id;
  }

  private async recordRun(
    integrationId: string,
    companyId: string,
    direction: 'INBOUND' | 'OUTBOUND' | 'BOTH',
    operation: string,
    ok: boolean,
    httpStatus: number | undefined,
    message: string | undefined,
    latencyMs: number,
  ) {
    await this.prisma.$transaction([
      this.prisma.externalIntegrationLog.create({
        data: {
          integrationId,
          companyId,
          direction: direction as any,
          operation,
          status: ok ? 'SUCCESS' : 'ERROR',
          httpStatus: httpStatus ?? null,
          message: message?.slice(0, 500) ?? null,
          latencyMs,
        },
      }),
      this.prisma.externalIntegration.update({
        where: { id: integrationId },
        data: { lastRunAt: new Date(), lastStatus: ok ? 'SUCCESS' : 'ERROR', lastError: ok ? null : (message?.slice(0, 500) ?? null), lastLatencyMs: latencyMs },
      }),
    ]).catch(() => undefined);
  }

  private async audit(me: AuthPayload, action: string, entity: string, entityId: string, after: unknown) {
    await this.prisma.auditLog
      .create({
        data: {
          companyId: me.companyId,
          userId: me.sub,
          action,
          module: 'integrations',
          entity,
          entityId,
          afterValue: after ? JSON.stringify(after) : null,
          result: 'SUCCESS',
        },
      })
      .catch(() => undefined);
  }
}

function dedupeScopes(scopes: string[]): string[] {
  const allowed = new Set(['indicators:read', 'results:read', 'results:write']);
  return Array.from(new Set((scopes ?? []).filter((s) => allowed.has(s))));
}

function extractItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as any).items)) return (data as any).items;
  return [];
}
