import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Workbook } from 'exceljs';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { WorkItemEventBus } from '../my-day/work-item-event-bus';
import {
  WITHDRAWAL_TRANSITIONS,
  assertTransition,
  businessNumber,
} from './supplies.logic';

type Tx = Prisma.TransactionClient;
type MovementType = 'IN' | 'OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUST';

interface MovementInput {
  companyId: string;
  warehouseId: string;
  counterpartyWarehouseId?: string | null;
  itemId: string;
  type: MovementType;
  quantity: number | string | Prisma.Decimal;
  unitCost?: number | string | Prisma.Decimal;
  originType: string;
  originId?: string | null;
  reference?: string | null;
  reason?: string | null;
  transferGroupId?: string | null;
  idempotencyKey: string;
  actorId: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly workItems: WorkItemEventBus,
  ) {}

  async dashboard(me: AuthPayload) {
    const [warehouses, items, balances, pendingWithdrawals, recentMovements] = await Promise.all([
      this.prisma.warehouse.count({ where: { companyId: me.companyId, deletedAt: null, active: true } }),
      this.prisma.stockItem.count({ where: { companyId: me.companyId, deletedAt: null, active: true } }),
      this.prisma.stockBalance.findMany({
        where: { companyId: me.companyId },
        select: { quantity: true, totalValue: true, item: { select: { minimumStock: true, kind: true } } },
      }),
      this.prisma.materialWithdrawal.count({ where: { companyId: me.companyId, status: { in: ['REQUESTED', 'APPROVED', 'PARTIALLY_FULFILLED'] } } }),
      this.prisma.stockMovement.findMany({
        where: { companyId: me.companyId }, orderBy: { occurredAt: 'desc' }, take: 8,
        include: { item: { select: { code: true, name: true, unit: true } }, warehouse: { select: { code: true, name: true } } },
      }),
    ]);
    const materialBalances = balances.filter((row) => row.item.kind === 'MATERIAL');
    const belowMinimum = materialBalances.filter((row) => row.item.minimumStock != null && row.quantity.lt(row.item.minimumStock)).length;
    const inventoryValue = materialBalances.reduce((sum, row) => sum.add(row.totalValue), new Prisma.Decimal(0));
    return { warehouses, items, belowMinimum, pendingWithdrawals, inventoryValue, recentMovements };
  }

  async listWarehouses(me: AuthPayload, includeInactive = false) {
    return this.prisma.warehouse.findMany({
      where: { companyId: me.companyId, deletedAt: null, ...(includeInactive ? {} : { active: true }) },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { balances: true, withdrawals: true } } },
    });
  }

  async createWarehouse(me: AuthPayload, body: any) {
    await this.validateOrgAndUser(me.companyId, body.orgNodeId, body.managerUserId);
    const created = await this.prisma.warehouse.create({
      data: {
        companyId: me.companyId, code: normalizeCode(body.code), name: body.name.trim(), description: clean(body.description),
        orgNodeId: body.orgNodeId ?? null, managerUserId: body.managerUserId ?? null, address: clean(body.address),
        allowNegative: body.allowNegative ?? false, active: body.active ?? true, createdById: me.sub,
      },
    }).catch(uniqueConflict('Já existe um almoxarifado com este código.'));
    await this.audit.record(me, { module: 'Suprimentos', entity: 'Warehouse', entityId: created.id, action: 'CREATE', message: `Almoxarifado ${created.code} criado`, after: created });
    return created;
  }

  async updateWarehouse(me: AuthPayload, id: string, body: any) {
    const current = await this.warehouseOrThrow(me.companyId, id);
    await this.validateOrgAndUser(me.companyId, body.orgNodeId, body.managerUserId);
    const updated = await this.prisma.warehouse.update({
      where: { id }, data: {
        ...(body.code !== undefined ? { code: normalizeCode(body.code) } : {}),
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: clean(body.description) } : {}),
        ...(body.orgNodeId !== undefined ? { orgNodeId: body.orgNodeId } : {}),
        ...(body.managerUserId !== undefined ? { managerUserId: body.managerUserId } : {}),
        ...(body.address !== undefined ? { address: clean(body.address) } : {}),
        ...(body.allowNegative !== undefined ? { allowNegative: body.allowNegative } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    }).catch(uniqueConflict('Já existe um almoxarifado com este código.'));
    await this.audit.record(me, { module: 'Suprimentos', entity: 'Warehouse', entityId: id, action: 'UPDATE', message: `Almoxarifado ${updated.code} atualizado`, before: current, after: updated });
    return updated;
  }

  async listItems(me: AuthPayload, query: { kind?: string; includeInactive?: string; search?: string } = {}) {
    const search = clean(query.search);
    return this.prisma.stockItem.findMany({
      where: {
        companyId: me.companyId, deletedAt: null,
        ...(query.includeInactive === 'true' ? {} : { active: true }),
        ...(query.kind && ['MATERIAL', 'SERVICE'].includes(query.kind) ? { kind: query.kind } : {}),
        ...(search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }, { groupName: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }], take: 1000,
    });
  }

  async createItem(me: AuthPayload, body: any) {
    const created = await this.prisma.stockItem.create({ data: itemData(me, body) }).catch(uniqueConflict('Já existe um item com este código ou QR Code.'));
    await this.audit.record(me, { module: 'Suprimentos', entity: 'StockItem', entityId: created.id, action: 'CREATE', message: `Item ${created.code} criado`, after: created });
    return created;
  }

  async updateItem(me: AuthPayload, id: string, body: any) {
    const current = await this.itemOrThrow(me.companyId, id);
    if (body.kind && body.kind !== current.kind) {
      const movementCount = await this.prisma.stockMovement.count({ where: { companyId: me.companyId, itemId: id } });
      if (movementCount) throw new ConflictException('Não é possível alterar o tipo de um item que já possui movimentações.');
    }
    const updated = await this.prisma.stockItem.update({ where: { id }, data: itemPatch(body) }).catch(uniqueConflict('Já existe um item com este código ou QR Code.'));
    await this.audit.record(me, { module: 'Suprimentos', entity: 'StockItem', entityId: id, action: 'UPDATE', message: `Item ${updated.code} atualizado`, before: current, after: updated });
    return updated;
  }

  async listBalances(me: AuthPayload, query: { warehouseId?: string; itemId?: string; lowStock?: string } = {}) {
    const rows = await this.prisma.stockBalance.findMany({
      where: { companyId: me.companyId, ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}), ...(query.itemId ? { itemId: query.itemId } : {}) },
      include: { warehouse: { select: { id: true, code: true, name: true } }, item: true },
      orderBy: [{ warehouse: { name: 'asc' } }, { item: { name: 'asc' } }], take: 5000,
    });
    return query.lowStock === 'true' ? rows.filter((row) => row.item.minimumStock != null && row.quantity.lt(row.item.minimumStock)) : rows;
  }

  async listMovements(me: AuthPayload, query: { warehouseId?: string; itemId?: string; type?: string; take?: string } = {}) {
    const take = Math.min(Math.max(Number(query.take) || 100, 1), 500);
    return this.prisma.stockMovement.findMany({
      where: {
        companyId: me.companyId,
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.itemId ? { itemId: query.itemId } : {}),
        ...(query.type ? { type: query.type } : {}),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        counterpartyWarehouse: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, code: true, name: true, unit: true } },
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take,
    });
  }

  async adjustStock(me: AuthPayload, body: any) {
    const delta = Number(body.quantityDelta);
    const movement = await this.serializable((tx) => this.applyMovementTx(tx, {
      companyId: me.companyId, warehouseId: body.warehouseId, itemId: body.itemId, type: 'ADJUST',
      quantity: Math.abs(delta), unitCost: body.unitCost ?? 0, originType: 'ADJUSTMENT', reference: clean(body.reference),
      reason: body.reason, idempotencyKey: body.idempotencyKey, actorId: me.sub,
      metadata: { direction: delta > 0 ? 'INCREASE' : 'DECREASE' },
    }, delta > 0 ? 1 : -1));
    await this.audit.record(me, { module: 'Suprimentos', entity: 'StockMovement', entityId: movement.id, action: 'STOCK_ADJUST', message: `Ajuste de estoque: saldo ${movement.balanceAfter}`, after: movement });
    return movement;
  }

  async transferStock(me: AuthPayload, body: any) {
    const transferGroupId = cryptoId();
    const result = await this.serializable(async (tx) => {
      await this.lockBalancesTx(tx, me.companyId, body.itemId, [body.sourceWarehouseId, body.destinationWarehouseId]);
      const source = await this.applyMovementTx(tx, {
        companyId: me.companyId, warehouseId: body.sourceWarehouseId, counterpartyWarehouseId: body.destinationWarehouseId,
        itemId: body.itemId, type: 'TRANSFER_OUT', quantity: body.quantity, originType: 'TRANSFER', transferGroupId,
        reference: clean(body.reference), reason: body.reason, idempotencyKey: `${body.idempotencyKey}:out`, actorId: me.sub,
      }, -1);
      const destination = await this.applyMovementTx(tx, {
        companyId: me.companyId, warehouseId: body.destinationWarehouseId, counterpartyWarehouseId: body.sourceWarehouseId,
        itemId: body.itemId, type: 'TRANSFER_IN', quantity: body.quantity, unitCost: source.averageCostAfter,
        originType: 'TRANSFER', transferGroupId, reference: clean(body.reference), reason: body.reason,
        idempotencyKey: `${body.idempotencyKey}:in`, actorId: me.sub,
      }, 1);
      return { transferGroupId, source, destination };
    });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'StockMovement', entityId: transferGroupId, action: 'STOCK_TRANSFER', message: 'Transferência entre almoxarifados', after: result });
    return result;
  }

  async listWithdrawals(me: AuthPayload, scope = 'mine') {
    const where: Prisma.MaterialWithdrawalWhereInput = { companyId: me.companyId };
    if (scope === 'mine') where.requesterId = me.sub;
    else if (scope === 'queue') where.status = { in: ['REQUESTED', 'APPROVED', 'PARTIALLY_FULFILLED'] };
    return this.prisma.materialWithdrawal.findMany({
      where, include: { warehouse: { select: { id: true, code: true, name: true, managerUserId: true } }, items: { include: { item: true } } },
      orderBy: { createdAt: 'desc' }, take: 500,
    });
  }

  async createWithdrawal(me: AuthPayload, body: any) {
    await this.warehouseOrThrow(me.companyId, body.warehouseId);
    await this.assertItems(me.companyId, body.items.map((line: any) => line.itemId), 'MATERIAL');
    assertNoDuplicates(body.items.map((line: any) => line.itemId), 'Um item não pode aparecer duas vezes na retirada.');
    if (body.orgNodeId) await this.validateOrgAndUser(me.companyId, body.orgNodeId, null);
    const created = await this.prisma.materialWithdrawal.create({
      data: {
        companyId: me.companyId, number: businessNumber('RT'), warehouseId: body.warehouseId, requesterId: me.sub,
        orgNodeId: body.orgNodeId ?? null, justification: body.justification, neededAt: toDate(body.neededAt),
        items: { create: body.items.map((line: any) => ({ companyId: me.companyId, itemId: line.itemId, requestedQuantity: dec(line.quantity), note: clean(line.note) })) },
      },
      include: { warehouse: true, items: { include: { item: true } } },
    });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'MaterialWithdrawal', entityId: created.id, action: 'REQUEST', message: `Retirada ${created.number} solicitada`, after: created });
    this.workItems.markDirty(me.companyId, [me.sub, created.warehouse.managerUserId], 'withdrawal-requested');
    return created;
  }

  async decideWithdrawal(me: AuthPayload, id: string, decision: 'APPROVED' | 'REJECTED', body: any) {
    const current = await this.withdrawalOrThrow(me.companyId, id);
    assertTransition(WITHDRAWAL_TRANSITIONS, current.status, decision, 'Retirada');
    if (decision === 'REJECTED' && !clean(body.note)) throw new BadRequestException('Informe o motivo da recusa.');
    const updated = await this.prisma.materialWithdrawal.update({
      where: { id }, data: {
        status: decision, approvedById: decision === 'APPROVED' ? me.sub : null, approvedAt: decision === 'APPROVED' ? new Date() : null,
        decisionNote: clean(body.note),
      }, include: { items: true, warehouse: true },
    });
    // Prisma não aceita copiar coluna em updateMany; quantidade aprovada nula significa "igual à solicitada".
    await this.audit.record(me, { module: 'Suprimentos', entity: 'MaterialWithdrawal', entityId: id, action: decision, message: `Retirada ${current.number}: ${decision}`, before: current, after: updated });
    this.workItems.markDirty(me.companyId, [current.requesterId, me.sub], 'withdrawal-decided');
    return updated;
  }

  async cancelWithdrawal(me: AuthPayload, id: string, body: any) {
    const current = await this.withdrawalOrThrow(me.companyId, id);
    if (current.requesterId !== me.sub && !isAdmin(me)) throw new ForbiddenException('Somente o solicitante pode cancelar a retirada.');
    assertTransition(WITHDRAWAL_TRANSITIONS, current.status, 'CANCELLED', 'Retirada');
    const updated = await this.prisma.materialWithdrawal.update({ where: { id }, data: { status: 'CANCELLED', decisionNote: body.reason }, include: { items: { include: { item: true } }, warehouse: true } });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'MaterialWithdrawal', entityId: id, action: 'CANCEL', message: `Retirada ${updated.number} cancelada`, before: current, after: updated });
    this.workItems.markDirty(me.companyId, [updated.requesterId, updated.warehouse.managerUserId], 'withdrawal-cancelled');
    return updated;
  }

  async fulfillWithdrawal(me: AuthPayload, id: string, body: any) {
    const result = await this.serializable(async (tx) => {
      const withdrawal = await tx.materialWithdrawal.findFirst({
        where: { id, companyId: me.companyId }, include: { items: true, warehouse: true },
      });
      if (!withdrawal) throw new NotFoundException('Solicitação de retirada não encontrada.');
      assertNoDuplicates(body.items.map((line: any) => line.withdrawalItemId), 'Uma linha não pode ser atendida duas vezes na mesma operação.');
      const operationKeys = body.items.map((line: any) => `${body.idempotencyKey}:${line.withdrawalItemId}`);
      const replayed = await tx.stockMovement.findMany({ where: { companyId: me.companyId, idempotencyKey: { in: operationKeys } } });
      if (replayed.length === operationKeys.length) {
        const saved = await tx.materialWithdrawal.findUniqueOrThrow({ where: { id }, include: { items: { include: { item: true } }, warehouse: true } });
        return { withdrawal: saved, movements: replayed };
      }
      if (replayed.length) throw new ConflictException('Atendimento parcialmente processado com esta chave. Consulte o kardex antes de tentar novamente.');
      if (!['REQUESTED', 'APPROVED', 'PARTIALLY_FULFILLED'].includes(withdrawal.status)) throw new ConflictException('Esta retirada não pode mais ser atendida.');
      const movements = [];
      const orderedLines = [...body.items].sort((a: any, b: any) => {
        const itemA = withdrawal.items.find((candidate) => candidate.id === a.withdrawalItemId)?.itemId ?? '';
        const itemB = withdrawal.items.find((candidate) => candidate.id === b.withdrawalItemId)?.itemId ?? '';
        return itemA.localeCompare(itemB);
      });
      for (const line of orderedLines) {
        const itemLine = withdrawal.items.find((candidate) => candidate.id === line.withdrawalItemId);
        if (!itemLine) throw new NotFoundException('Item da retirada não encontrado.');
        const limit = itemLine.approvedQuantity ?? itemLine.requestedQuantity;
        const remaining = limit.minus(itemLine.fulfilledQuantity);
        if (dec(line.quantity).gt(remaining)) throw new ConflictException('Quantidade atendida supera o saldo pendente da retirada.');
        const movement = await this.applyMovementTx(tx, {
          companyId: me.companyId, warehouseId: withdrawal.warehouseId, itemId: itemLine.itemId, type: 'OUT', quantity: line.quantity,
          originType: 'WITHDRAWAL', originId: withdrawal.id, reference: withdrawal.number, reason: withdrawal.justification,
          idempotencyKey: `${body.idempotencyKey}:${itemLine.id}`, actorId: me.sub,
          metadata: { requesterId: withdrawal.requesterId, orgNodeId: withdrawal.orgNodeId },
        }, -1);
        await tx.materialWithdrawalItem.update({ where: { id: itemLine.id }, data: { fulfilledQuantity: { increment: dec(line.quantity) } } });
        movements.push(movement);
      }
      const refreshed = await tx.materialWithdrawalItem.findMany({ where: { withdrawalId: id } });
      const complete = refreshed.every((line) => line.fulfilledQuantity.gte(line.approvedQuantity ?? line.requestedQuantity));
      const any = refreshed.some((line) => line.fulfilledQuantity.gt(0));
      const status = complete ? 'FULFILLED' : any ? 'PARTIALLY_FULFILLED' : withdrawal.status;
      const saved = await tx.materialWithdrawal.update({
        where: { id }, data: { status, fulfilledById: me.sub, ...(complete ? { fulfilledAt: new Date() } : {}) },
        include: { items: { include: { item: true } }, warehouse: true },
      });
      return { withdrawal: saved, movements };
    });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'MaterialWithdrawal', entityId: id, action: 'FULFILL', message: `Retirada ${result.withdrawal.number} atendida`, after: result });
    this.workItems.markDirty(me.companyId, [result.withdrawal.requesterId, me.sub], 'withdrawal-fulfilled');
    return result;
  }

  async importCatalog(me: AuthPayload, body: any) {
    const workbook = new Workbook();
    try {
      await workbook.xlsx.load(Buffer.from(body.xlsxBase64, 'base64') as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('Não foi possível ler o XLSX. Use o modelo de importação do módulo.');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('A planilha não possui abas.');
    const headers = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, col) => headers.set(String(cell.text).trim().toLowerCase(), col));
    for (const required of ['codigo', 'nome', 'tipo', 'unidade']) if (!headers.has(required)) throw new BadRequestException(`Coluna obrigatória ausente: ${required}.`);
    const rows: Array<{ row: number; code: string; name: string; kind: string; unit: string; groupName?: string; min?: number; max?: number; initial?: number; cost?: number }> = [];
    for (let index = 2; index <= sheet.rowCount; index++) {
      const row = sheet.getRow(index);
      const code = valueAt(row, headers.get('codigo'));
      const name = valueAt(row, headers.get('nome'));
      if (!code && !name) continue;
      const kindRaw = valueAt(row, headers.get('tipo')).toUpperCase();
      const kind = ['SERVICO', 'SERVIÇO', 'SERVICE'].includes(kindRaw) ? 'SERVICE' : 'MATERIAL';
      const initial = numberAt(row, headers.get('saldo_inicial'));
      if (initial && initial > 0 && !body.warehouseId) throw new BadRequestException(`Linha ${index}: informe o almoxarifado para importar saldo inicial.`);
      rows.push({ row: index, code: normalizeCode(code), name, kind, unit: valueAt(row, headers.get('unidade')), groupName: valueAt(row, headers.get('grupo')) || undefined, min: numberAt(row, headers.get('estoque_minimo')), max: numberAt(row, headers.get('estoque_maximo')), initial, cost: numberAt(row, headers.get('custo_unitario')) });
    }
    if (!rows.length) throw new BadRequestException('Nenhum item válido foi encontrado.');
    if (rows.length > 1000) throw new BadRequestException('A importação aceita no máximo 1.000 itens por arquivo.');
    if (body.warehouseId) await this.warehouseOrThrow(me.companyId, body.warehouseId);
    const result = await this.serializable(async (tx) => {
      let created = 0; let updated = 0; let initialMovements = 0;
      for (const row of rows) {
        if (!row.code || !row.name || !row.unit) throw new BadRequestException(`Linha ${row.row}: código, nome e unidade são obrigatórios.`);
        const existing = await tx.stockItem.findUnique({ where: { companyId_code: { companyId: me.companyId, code: row.code } } });
        const item = await tx.stockItem.upsert({
          where: { companyId_code: { companyId: me.companyId, code: row.code } },
          create: { companyId: me.companyId, code: row.code, name: row.name, kind: row.kind, unit: row.unit.toUpperCase(), groupName: row.groupName, minimumStock: nullableDec(row.min), maximumStock: nullableDec(row.max), createdById: me.sub },
          update: { name: row.name, kind: row.kind, unit: row.unit.toUpperCase(), groupName: row.groupName, minimumStock: nullableDec(row.min), maximumStock: nullableDec(row.max), active: true, deletedAt: null },
        });
        if (existing) updated += 1;
        else created += 1;
        if (body.warehouseId && row.kind === 'MATERIAL' && row.initial && row.initial > 0) {
          await this.applyMovementTx(tx, { companyId: me.companyId, warehouseId: body.warehouseId, itemId: item.id, type: 'IN', quantity: row.initial, unitCost: row.cost ?? 0, originType: 'IMPORT', reference: `XLSX linha ${row.row}`, reason: 'Saldo inicial importado', idempotencyKey: `${body.idempotencyKey}:${row.code}`, actorId: me.sub }, 1);
          initialMovements++;
        }
      }
      return { total: rows.length, created, updated, initialMovements };
    });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'StockItem', action: 'IMPORT', message: `${result.total} itens processados via XLSX`, after: result });
    return result;
  }

  async importTemplate(): Promise<Buffer> {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Catalogo');
    sheet.addRow(['codigo', 'nome', 'tipo', 'unidade', 'grupo', 'estoque_minimo', 'estoque_maximo', 'saldo_inicial', 'custo_unitario']);
    sheet.addRow(['MAT-001', 'Luva nitrílica', 'MATERIAL', 'CX', 'EPI', 10, 100, 25, 42.5]);
    sheet.addRow(['SRV-001', 'Manutenção preventiva', 'SERVICO', 'UN', 'Serviços', '', '', '', '']);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column) => { column.width = 22; });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** Razão + saldo na mesma transação. Chamado também pelo recebimento de compras. */
  async applyMovementTx(tx: Tx, input: MovementInput, direction: 1 | -1) {
    const existing = await tx.stockMovement.findUnique({ where: { companyId_idempotencyKey: { companyId: input.companyId, idempotencyKey: input.idempotencyKey } } });
    if (existing) return existing;
    const [warehouse, item] = await Promise.all([
      tx.warehouse.findFirst({ where: { id: input.warehouseId, companyId: input.companyId, deletedAt: null, active: true } }),
      tx.stockItem.findFirst({ where: { id: input.itemId, companyId: input.companyId, deletedAt: null, active: true } }),
    ]);
    if (!warehouse) throw new NotFoundException('Almoxarifado não encontrado.');
    if (!item) throw new NotFoundException('Item não encontrado.');
    if (item.kind !== 'MATERIAL') throw new ConflictException('Serviços não movimentam estoque físico.');
    const quantity = dec(input.quantity);
    if (quantity.lte(0)) throw new BadRequestException('Quantidade da movimentação deve ser maior que zero.');
    await tx.stockBalance.upsert({
      where: { companyId_warehouseId_itemId: { companyId: input.companyId, warehouseId: input.warehouseId, itemId: input.itemId } },
      create: { companyId: input.companyId, warehouseId: input.warehouseId, itemId: input.itemId }, update: {},
    });
    const locked = await tx.$queryRaw<Array<{ id: string; quantity: Prisma.Decimal; averageCost: Prisma.Decimal }>>(Prisma.sql`
      SELECT "id", "quantity", "averageCost"
      FROM "supply_stock_balances"
      WHERE "companyId" = ${input.companyId} AND "warehouseId" = ${input.warehouseId} AND "itemId" = ${input.itemId}
      FOR UPDATE
    `);
    const balance = locked[0];
    if (!balance) throw new ConflictException('Não foi possível bloquear o saldo para movimentação.');
    const before = dec(balance.quantity);
    const after = direction === 1 ? before.add(quantity) : before.sub(quantity);
    if (after.lt(0) && !warehouse.allowNegative) throw new ConflictException(`Saldo insuficiente. Disponível: ${before.toString()}.`);
    const unitCost = input.unitCost == null ? dec(balance.averageCost) : dec(input.unitCost);
    const nextAverage = direction === 1
      ? (before.mul(dec(balance.averageCost)).add(quantity.mul(unitCost))).div(after)
      : dec(balance.averageCost);
    const totalValue = after.mul(nextAverage);
    await tx.stockBalance.update({ where: { id: balance.id }, data: { quantity: after, averageCost: nextAverage, totalValue, lastMovementAt: new Date() } });
    const movement = await tx.stockMovement.create({ data: {
      companyId: input.companyId, warehouseId: input.warehouseId, counterpartyWarehouseId: input.counterpartyWarehouseId ?? null,
      itemId: input.itemId, type: input.type, quantity, unitCost, totalCost: quantity.mul(unitCost), balanceBefore: before,
      balanceAfter: after, averageCostAfter: nextAverage, originType: input.originType, originId: input.originId ?? null,
      reference: input.reference ?? null, reason: input.reason ?? null, transferGroupId: input.transferGroupId ?? null,
      idempotencyKey: input.idempotencyKey, actorId: input.actorId, metadata: input.metadata,
    } });
    const allBalances = await tx.stockBalance.findMany({ where: { companyId: input.companyId, itemId: input.itemId }, select: { quantity: true, totalValue: true } });
    const totalQuantity = allBalances.reduce((sum, row) => sum.add(row.quantity), dec(0));
    const consolidatedValue = allBalances.reduce((sum, row) => sum.add(row.totalValue), dec(0));
    await tx.stockItem.update({ where: { id: input.itemId }, data: { averageCost: totalQuantity.gt(0) ? consolidatedValue.div(totalQuantity) : nextAverage } });
    return movement;
  }

  private async lockBalancesTx(tx: Tx, companyId: string, itemId: string, warehouseIds: string[]) {
    const ordered = [...new Set(warehouseIds)].sort();
    for (const warehouseId of ordered) {
      await tx.stockBalance.upsert({
        where: { companyId_warehouseId_itemId: { companyId, warehouseId, itemId } },
        create: { companyId, warehouseId, itemId }, update: {},
      });
    }
    await tx.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "supply_stock_balances"
      WHERE "companyId" = ${companyId} AND "itemId" = ${itemId} AND "warehouseId" IN (${Prisma.join(ordered)})
      ORDER BY "warehouseId", "itemId"
      FOR UPDATE
    `);
  }

  private serializable<T>(operation: (tx: Tx) => Promise<T>, attempt = 1): Promise<T> {
    return this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 }).catch((error) => {
      if (attempt < 4 && error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code)) return this.serializable(operation, attempt + 1);
      throw error;
    });
  }

  private warehouseOrThrow(companyId: string, id: string) {
    return this.prisma.warehouse.findFirst({ where: { id, companyId, deletedAt: null } }).then((row) => {
      if (!row) throw new NotFoundException('Almoxarifado não encontrado.'); return row;
    });
  }

  private itemOrThrow(companyId: string, id: string) {
    return this.prisma.stockItem.findFirst({ where: { id, companyId, deletedAt: null } }).then((row) => {
      if (!row) throw new NotFoundException('Item não encontrado.'); return row;
    });
  }

  private withdrawalOrThrow(companyId: string, id: string) {
    return this.prisma.materialWithdrawal.findFirst({ where: { id, companyId }, include: { items: true, warehouse: true } }).then((row) => {
      if (!row) throw new NotFoundException('Solicitação de retirada não encontrada.'); return row;
    });
  }

  private async assertItems(companyId: string, ids: string[], requiredKind?: string) {
    const count = await this.prisma.stockItem.count({ where: { companyId, id: { in: [...new Set(ids)] }, deletedAt: null, active: true, ...(requiredKind ? { kind: requiredKind } : {}) } });
    if (count !== new Set(ids).size) throw new NotFoundException(requiredKind === 'MATERIAL' ? 'Um ou mais materiais não foram encontrados.' : 'Um ou mais itens não foram encontrados.');
  }

  private async validateOrgAndUser(companyId: string, orgNodeId?: string | null, userId?: string | null) {
    const [org, user] = await Promise.all([
      orgNodeId ? this.prisma.orgNode.findFirst({ where: { id: orgNodeId, companyId, deletedAt: null }, select: { id: true } }) : Promise.resolve({ id: '' }),
      userId ? this.prisma.user.findFirst({ where: { id: userId, companyId, deletedAt: null, active: true }, select: { id: true } }) : Promise.resolve({ id: '' }),
    ]);
    if (orgNodeId && !org) throw new NotFoundException('Área do organograma não encontrada.');
    if (userId && !user) throw new NotFoundException('Responsável não encontrado.');
  }
}

function itemData(me: AuthPayload, body: any): Prisma.StockItemUncheckedCreateInput {
  return { companyId: me.companyId, createdById: me.sub, code: normalizeCode(body.code), name: body.name.trim(), description: clean(body.description), kind: body.kind, unit: body.unit.trim().toUpperCase(), groupName: clean(body.groupName), minimumStock: nullableDec(body.minimumStock), maximumStock: nullableDec(body.maximumStock), qrCodeToken: clean(body.qrCodeToken), active: body.active ?? true };
}

function itemPatch(body: any): Prisma.StockItemUncheckedUpdateInput {
  return {
    ...(body.code !== undefined ? { code: normalizeCode(body.code) } : {}), ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.description !== undefined ? { description: clean(body.description) } : {}), ...(body.kind !== undefined ? { kind: body.kind } : {}),
    ...(body.unit !== undefined ? { unit: body.unit.trim().toUpperCase() } : {}), ...(body.groupName !== undefined ? { groupName: clean(body.groupName) } : {}),
    ...(body.minimumStock !== undefined ? { minimumStock: nullableDec(body.minimumStock) } : {}), ...(body.maximumStock !== undefined ? { maximumStock: nullableDec(body.maximumStock) } : {}),
    ...(body.qrCodeToken !== undefined ? { qrCodeToken: clean(body.qrCodeToken) } : {}), ...(body.active !== undefined ? { active: body.active } : {}),
  };
}

function dec(value: unknown) { return new Prisma.Decimal(String(value ?? 0)); }
function nullableDec(value: unknown) { return value === null || value === undefined || value === '' ? null : dec(value); }
function clean(value: unknown): string | null { const result = String(value ?? '').trim(); return result || null; }
function normalizeCode(value: unknown): string { return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '-'); }
function toDate(value: unknown): Date | null { return value ? new Date(String(value)) : null; }
function cryptoId(): string { return `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
function assertNoDuplicates(values: string[], message: string) { if (new Set(values).size !== values.length) throw new BadRequestException(message); }
function uniqueConflict(message: string) { return (error: unknown) => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message); throw error; }; }
function isAdmin(me: AuthPayload) { return ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(String(me.role)); }
function valueAt(row: import('exceljs').Row, column?: number): string { return column ? String(row.getCell(column).text ?? '').trim() : ''; }
function numberAt(row: import('exceljs').Row, column?: number): number | undefined { const raw = valueAt(row, column).replace(',', '.'); if (!raw) return undefined; const parsed = Number(raw); if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestException(`Linha ${row.number}: valor numérico inválido.`); return parsed; }
