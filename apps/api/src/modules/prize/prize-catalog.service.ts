import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrizeOrgRefKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { PrizeAuditService } from './prize-audit.service';
import { normalizeRuleKey } from './prize-rule-matrix.util';

/**
 * Catalogo canonico de Areas/Cargos com ID estavel (`code`). E a fonte de
 * verdade para o casamento (área×cargo) da apuracao: combinacoes e colaboradores
 * referenciam os mesmos IDs, eliminando a fragilidade do match por nome.
 *
 * - Auto-derivado do import de elegiveis (ensureOrgRefs/ensureCargoRefs).
 * - Importavel direto (importCatalog) e reconstruivel do historico (rebuildFromHistory).
 */
@Injectable()
export class PrizeCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PrizeAuditService,
  ) {}

  // ---- resolucao em lote (usado no import de elegiveis e no backfill) ----

  /** Garante PrizeOrgRef para cada nome distinto; retorna normalizedKey -> id. */
  async ensureOrgRefs(companyId: string, items: Array<{ name: string; kind: PrizeOrgRefKind }>, userId?: string | null): Promise<Map<string, string>> {
    const byKey = new Map<string, { name: string; kind: PrizeOrgRefKind }>();
    for (const it of items) {
      const key = normalizeRuleKey(it.name);
      if (key && !byKey.has(key)) byKey.set(key, { name: it.name.trim(), kind: it.kind });
    }
    const map = new Map<string, string>();
    if (byKey.size === 0) return map;
    const existing = await this.prisma.prizeOrgRef.findMany({
      where: { companyId, normalizedKey: { in: [...byKey.keys()] } },
      select: { id: true, normalizedKey: true },
    });
    for (const e of existing) map.set(e.normalizedKey, e.id);
    const missing = [...byKey.entries()].filter(([k]) => !map.has(k));
    if (missing.length) {
      const agg = await this.prisma.prizeOrgRef.aggregate({ where: { companyId }, _max: { code: true } });
      let next = (agg._max.code ?? 0) + 1;
      const rows = missing.map(([key, v]) => ({ id: randomUUID(), companyId, code: next++, name: v.name, normalizedKey: key, kind: v.kind, source: 'IMPORT', createdById: userId ?? null }));
      await this.prisma.prizeOrgRef.createMany({ data: rows, skipDuplicates: true });
      for (const r of rows) map.set(r.normalizedKey, r.id);
    }
    return map;
  }

  /** Garante PrizeCargoRef para cada nome distinto; retorna normalizedKey -> id. */
  async ensureCargoRefs(companyId: string, names: Array<string | null | undefined>, userId?: string | null): Promise<Map<string, string>> {
    const byKey = new Map<string, string>();
    for (const n of names) {
      const key = normalizeRuleKey(n);
      if (key && !byKey.has(key)) byKey.set(key, (n as string).trim());
    }
    const map = new Map<string, string>();
    if (byKey.size === 0) return map;
    const existing = await this.prisma.prizeCargoRef.findMany({
      where: { companyId, normalizedKey: { in: [...byKey.keys()] } },
      select: { id: true, normalizedKey: true },
    });
    for (const e of existing) map.set(e.normalizedKey, e.id);
    const missing = [...byKey.entries()].filter(([k]) => !map.has(k));
    if (missing.length) {
      const agg = await this.prisma.prizeCargoRef.aggregate({ where: { companyId }, _max: { code: true } });
      let next = (agg._max.code ?? 0) + 1;
      const rows = missing.map(([key, name]) => ({ id: randomUUID(), companyId, code: next++, name, normalizedKey: key, source: 'IMPORT', createdById: userId ?? null }));
      await this.prisma.prizeCargoRef.createMany({ data: rows, skipDuplicates: true });
      for (const r of rows) map.set(r.normalizedKey, r.id);
    }
    return map;
  }

  // ---- leitura / edicao ----

  listAreas(companyId: string) {
    return this.prisma.prizeOrgRef.findMany({ where: { companyId, deletedAt: null }, orderBy: [{ active: 'desc' }, { code: 'asc' }] });
  }
  listCargos(companyId: string) {
    return this.prisma.prizeCargoRef.findMany({ where: { companyId, deletedAt: null }, orderBy: [{ active: 'desc' }, { code: 'asc' }] });
  }

  async renameArea(me: AuthPayload, id: string, name: string) {
    if (!name?.trim()) throw new BadRequestException('Nome obrigatorio');
    const cur = await this.prisma.prizeOrgRef.findFirst({ where: { id, companyId: me.companyId } });
    if (!cur) throw new NotFoundException('Area nao encontrada');
    const updated = await this.prisma.prizeOrgRef.update({ where: { id }, data: { name: name.trim(), normalizedKey: normalizeRuleKey(name) } });
    await this.audit.log(me, { action: 'RENAME', entityType: 'ORG_REF', entityId: id, before: cur, after: updated });
    return updated;
  }
  async renameCargo(me: AuthPayload, id: string, name: string) {
    if (!name?.trim()) throw new BadRequestException('Nome obrigatorio');
    const cur = await this.prisma.prizeCargoRef.findFirst({ where: { id, companyId: me.companyId } });
    if (!cur) throw new NotFoundException('Cargo nao encontrado');
    const updated = await this.prisma.prizeCargoRef.update({ where: { id }, data: { name: name.trim(), normalizedKey: normalizeRuleKey(name) } });
    await this.audit.log(me, { action: 'RENAME', entityType: 'CARGO_REF', entityId: id, before: cur, after: updated });
    return updated;
  }

  /** Mescla `sourceId` em `targetId`: repoint de snapshots e combinacoes, soft-delete da origem. */
  async mergeArea(me: AuthPayload, targetId: string, sourceId: string) {
    if (targetId === sourceId) throw new BadRequestException('Selecione áreas diferentes');
    const [target, source] = await Promise.all([
      this.prisma.prizeOrgRef.findFirst({ where: { id: targetId, companyId: me.companyId, deletedAt: null } }),
      this.prisma.prizeOrgRef.findFirst({ where: { id: sourceId, companyId: me.companyId, deletedAt: null } }),
    ]);
    if (!target || !source) throw new NotFoundException('Área de origem ou destino não encontrada');
    await this.prisma.$transaction(async (tx) => {
      await tx.prizeEmployeeSnapshot.updateMany({ where: { companyId: me.companyId, areaRefId: sourceId }, data: { areaRefId: targetId } });
      await tx.prizeEmployeeSnapshot.updateMany({ where: { companyId: me.companyId, sectorRefId: sourceId }, data: { sectorRefId: targetId } });
      const groups = await tx.prizeRuleGroup.findMany({ where: { companyId: me.companyId, areaRefIds: { has: sourceId } }, select: { id: true, areaRefIds: true } });
      for (const g of groups) {
        const next = Array.from(new Set(g.areaRefIds.map((x) => (x === sourceId ? targetId : x))));
        await tx.prizeRuleGroup.update({ where: { id: g.id }, data: { areaRefIds: next } });
      }
      await tx.prizeOrgRef.update({ where: { id: sourceId }, data: { deletedAt: new Date(), active: false } });
    });
    await this.audit.log(me, { action: 'MERGE', entityType: 'ORG_REF', entityId: targetId, before: source, after: target });
    return { ok: true };
  }

  async mergeCargo(me: AuthPayload, targetId: string, sourceId: string) {
    if (targetId === sourceId) throw new BadRequestException('Selecione cargos diferentes');
    const [target, source] = await Promise.all([
      this.prisma.prizeCargoRef.findFirst({ where: { id: targetId, companyId: me.companyId, deletedAt: null } }),
      this.prisma.prizeCargoRef.findFirst({ where: { id: sourceId, companyId: me.companyId, deletedAt: null } }),
    ]);
    if (!target || !source) throw new NotFoundException('Cargo de origem ou destino não encontrado');
    await this.prisma.$transaction(async (tx) => {
      await tx.prizeEmployeeSnapshot.updateMany({ where: { companyId: me.companyId, cargoRefId: sourceId }, data: { cargoRefId: targetId } });
      const groups = await tx.prizeRuleGroup.findMany({ where: { companyId: me.companyId, cargoRefIds: { has: sourceId } }, select: { id: true, cargoRefIds: true } });
      for (const g of groups) {
        const next = Array.from(new Set(g.cargoRefIds.map((x) => (x === sourceId ? targetId : x))));
        await tx.prizeRuleGroup.update({ where: { id: g.id }, data: { cargoRefIds: next } });
      }
      await tx.prizeCargoRef.update({ where: { id: sourceId }, data: { deletedAt: new Date(), active: false } });
    });
    await this.audit.log(me, { action: 'MERGE', entityType: 'CARGO_REF', entityId: targetId, before: source, after: target });
    return { ok: true };
  }

  // ---- import dedicado ("os dois") ----

  async importCatalog(me: AuthPayload, dto: { areas?: string[]; sectors?: string[]; cargos?: string[] }) {
    const areas = (dto.areas ?? []).map((s) => String(s)).filter((s) => s.trim());
    const sectors = (dto.sectors ?? []).map((s) => String(s)).filter((s) => s.trim());
    const cargos = (dto.cargos ?? []).map((s) => String(s)).filter((s) => s.trim());
    if (!areas.length && !sectors.length && !cargos.length) throw new BadRequestException('Informe pelo menos uma área ou cargo');
    const orgMap = await this.ensureOrgRefs(me.companyId, [
      ...areas.map((name) => ({ name, kind: 'AREA' as PrizeOrgRefKind })),
      ...sectors.map((name) => ({ name, kind: 'SECTOR' as PrizeOrgRefKind })),
    ], me.sub);
    const cargoMap = await this.ensureCargoRefs(me.companyId, cargos, me.sub);
    await this.audit.log(me, { action: 'IMPORT', entityType: 'CATALOG', entityId: me.companyId, after: { areas: areas.length + sectors.length, cargos: cargos.length } });
    return { areas: orgMap.size, cargos: cargoMap.size };
  }

  // ---- backfill a partir do historico (snapshots + combinacoes ja existentes) ----

  async rebuildFromHistory(me: AuthPayload) {
    const companyId = me.companyId;
    const snaps = await this.prisma.prizeEmployeeSnapshot.findMany({
      where: { companyId },
      select: { areaRef: true, sectorRef: true, positionRef: true },
    });
    await this.ensureOrgRefs(companyId, [
      ...snaps.map((s) => ({ name: s.areaRef ?? '', kind: 'AREA' as PrizeOrgRefKind })),
      ...snaps.map((s) => ({ name: s.sectorRef ?? '', kind: 'SECTOR' as PrizeOrgRefKind })),
    ], me.sub);
    await this.ensureCargoRefs(companyId, snaps.map((s) => s.positionRef), me.sub);

    const [orgs, cargos] = await Promise.all([
      this.prisma.prizeOrgRef.findMany({ where: { companyId, deletedAt: null }, select: { id: true, normalizedKey: true } }),
      this.prisma.prizeCargoRef.findMany({ where: { companyId, deletedAt: null }, select: { id: true, normalizedKey: true } }),
    ]);
    const orgByKey = new Map(orgs.map((o) => [o.normalizedKey, o.id]));
    const cargoByKey = new Map(cargos.map((c) => [c.normalizedKey, c.id]));
    const orgId = (v: string | null | undefined) => orgByKey.get(normalizeRuleKey(v)) ?? null;
    const cargoId = (v: string | null | undefined) => cargoByKey.get(normalizeRuleKey(v)) ?? null;

    // Linka snapshots por valor cru distinto (poucas chamadas updateMany).
    const distinctSnap = await this.prisma.prizeEmployeeSnapshot.findMany({
      where: { companyId },
      distinct: ['areaRef', 'sectorRef', 'positionRef'],
      select: { areaRef: true, sectorRef: true, positionRef: true },
    });
    let linked = 0;
    for (const d of distinctSnap) {
      const r = await this.prisma.prizeEmployeeSnapshot.updateMany({
        where: { companyId, areaRef: d.areaRef, sectorRef: d.sectorRef, positionRef: d.positionRef },
        data: { areaRefId: orgId(d.areaRef), sectorRefId: orgId(d.sectorRef), cargoRefId: cargoId(d.positionRef) },
      });
      linked += r.count;
    }

    // Linka combinacoes existentes (resolve areaRefs/positionRefs -> IDs).
    const groups = await this.prisma.prizeRuleGroup.findMany({ where: { companyId, deletedAt: null }, select: { id: true, areaRefs: true, positionRefs: true } });
    let groupsLinked = 0;
    for (const g of groups) {
      const areaRefIds = Array.from(new Set(g.areaRefs.map(orgId).filter((x): x is string => !!x)));
      const cargoRefIds = Array.from(new Set(g.positionRefs.map(cargoId).filter((x): x is string => !!x)));
      await this.prisma.prizeRuleGroup.update({ where: { id: g.id }, data: { areaRefIds, cargoRefIds } });
      groupsLinked += 1;
    }
    await this.audit.log(me, { action: 'REBUILD', entityType: 'CATALOG', entityId: companyId, after: { snapshots: linked, groups: groupsLinked, areas: orgs.length, cargos: cargos.length } });
    return { snapshots: linked, groups: groupsLinked, areas: orgs.length, cargos: cargos.length };
  }
}
