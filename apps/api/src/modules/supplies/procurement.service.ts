import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { WorkItemEventBus } from '../my-day/work-item-event-bus';
import { InventoryService } from './inventory.service';
import {
  PURCHASE_ORDER_TRANSITIONS,
  REQUISITION_TRANSITIONS,
  assertTransition,
  businessNumber,
  orderStatusFromQuantities,
  orderTotals,
  requisitionStatusFromQuantities,
} from './supplies.logic';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditWriterService,
    private readonly workItems: WorkItemEventBus,
  ) {}

  async dashboard(me: AuthPayload) {
    const [openRequisitions, buyerQueue, pendingApprovals, openOrders, overdueOrders, receiptsThisMonth, spend] = await Promise.all([
      this.prisma.purchaseRequisition.count({ where: { companyId: me.companyId, status: { in: ['SUBMITTED', 'IN_TRIAGE', 'IN_QUOTATION', 'ORDER_CREATED', 'PARTIALLY_FULFILLED'] } } }),
      this.prisma.purchaseRequisition.count({ where: { companyId: me.companyId, buyerId: null, status: 'SUBMITTED' } }),
      this.prisma.purchaseOrderApproval.count({ where: { companyId: me.companyId, status: 'PENDING', purchaseOrder: { status: 'PENDING_APPROVAL' } } }),
      this.prisma.purchaseOrder.count({ where: { companyId: me.companyId, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_DELIVERED'] } } }),
      this.prisma.purchaseOrder.count({ where: { companyId: me.companyId, status: { in: ['SENT', 'PARTIALLY_DELIVERED'] }, expectedDeliveryAt: { lt: new Date() } } }),
      this.prisma.purchaseReceipt.count({ where: { companyId: me.companyId, receivedAt: { gte: monthStart() } } }),
      this.prisma.purchaseOrder.aggregate({ where: { companyId: me.companyId, status: { notIn: ['DRAFT', 'REJECTED', 'CANCELLED'] }, createdAt: { gte: monthStart() } }, _sum: { totalAmount: true } }),
    ]);
    return { openRequisitions, buyerQueue, pendingApprovals, openOrders, overdueOrders, receiptsThisMonth, spendThisMonth: spend._sum.totalAmount ?? dec(0) };
  }

  async options(me: AuthPayload) {
    const [warehouses, items, suppliers, users, orgNodes] = await Promise.all([
      this.prisma.warehouse.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, select: { id: true, code: true, name: true, managerUserId: true }, orderBy: { name: 'asc' } }),
      this.prisma.stockItem.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, select: { id: true, code: true, name: true, kind: true, unit: true, averageCost: true }, orderBy: { name: 'asc' }, take: 2000 }),
      this.prisma.supplier.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, select: { id: true, code: true, legalName: true, tradeName: true, paymentTerms: true }, orderBy: { legalName: 'asc' }, take: 1000 }),
      this.prisma.user.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' }, take: 2000 }),
      this.prisma.orgNode.findMany({ where: { companyId: me.companyId, deletedAt: null, active: true }, select: { id: true, name: true, code: true, type: true }, orderBy: { name: 'asc' }, take: 2000 }),
    ]);
    return { warehouses, items, suppliers, users, orgNodes };
  }

  async listSuppliers(me: AuthPayload, includeInactive = false) {
    return this.prisma.supplier.findMany({ where: { companyId: me.companyId, deletedAt: null, ...(includeInactive ? {} : { active: true }) }, orderBy: [{ active: 'desc' }, { legalName: 'asc' }], take: 2000 });
  }

  async createSupplier(me: AuthPayload, body: any) {
    const created = await this.prisma.supplier.create({ data: supplierData(me, body) }).catch(uniqueConflict('Já existe um fornecedor com este código ou documento.'));
    await this.audit.record(me, { module: 'Suprimentos', entity: 'Supplier', entityId: created.id, action: 'CREATE', message: `Fornecedor ${created.code} criado`, after: created });
    return created;
  }

  async updateSupplier(me: AuthPayload, id: string, body: any) {
    const current = await this.supplierOrThrow(me.companyId, id);
    const updated = await this.prisma.supplier.update({ where: { id }, data: supplierPatch(body) }).catch(uniqueConflict('Já existe um fornecedor com este código ou documento.'));
    await this.audit.record(me, { module: 'Suprimentos', entity: 'Supplier', entityId: id, action: 'UPDATE', message: `Fornecedor ${updated.code} atualizado`, before: current, after: updated });
    return updated;
  }

  async listApprovalRules(me: AuthPayload) {
    const rows = await this.prisma.purchaseApprovalRule.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: [{ level: 'asc' }, { minimumAmount: 'asc' }] });
    return this.attachUsers(me.companyId, rows, ['approverUserId']);
  }

  async createApprovalRule(me: AuthPayload, body: any) {
    await this.validateApprover(me.companyId, body.approverUserId);
    const created = await this.prisma.purchaseApprovalRule.create({ data: {
      companyId: me.companyId, name: body.name, level: body.level, minimumAmount: dec(body.minimumAmount), maximumAmount: nullableDec(body.maximumAmount),
      approverUserId: body.approverUserId ?? null, approverRole: body.approverRole ?? null, active: body.active ?? true, createdById: me.sub,
    } });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseApprovalRule', entityId: created.id, action: 'CREATE', message: `Alçada ${created.name} criada`, after: created });
    return created;
  }

  async updateApprovalRule(me: AuthPayload, id: string, body: any) {
    const current = await this.prisma.purchaseApprovalRule.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!current) throw new NotFoundException('Alçada não encontrada.');
    const approverUserId = body.approverUserId !== undefined ? body.approverUserId : current.approverUserId;
    const approverRole = body.approverRole !== undefined ? body.approverRole : current.approverRole;
    if (!approverUserId && !approverRole) throw new BadRequestException('A alçada precisa de usuário ou papel aprovador.');
    await this.validateApprover(me.companyId, approverUserId);
    const minimum = body.minimumAmount !== undefined ? dec(body.minimumAmount) : current.minimumAmount;
    const maximum = body.maximumAmount !== undefined ? nullableDec(body.maximumAmount) : current.maximumAmount;
    if (maximum && maximum.lt(minimum)) throw new BadRequestException('Valor máximo deve ser maior ou igual ao mínimo.');
    const updated = await this.prisma.purchaseApprovalRule.update({ where: { id }, data: {
      ...(body.name !== undefined ? { name: body.name } : {}), ...(body.level !== undefined ? { level: body.level } : {}),
      minimumAmount: minimum, maximumAmount: maximum, approverUserId, approverRole,
      ...(body.active !== undefined ? { active: body.active } : {}),
    } });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseApprovalRule', entityId: id, action: 'UPDATE', message: `Alçada ${updated.name} atualizada`, before: current, after: updated });
    return updated;
  }

  async listRequisitions(me: AuthPayload, query: { scope?: string; status?: string } = {}) {
    const where: Prisma.PurchaseRequisitionWhereInput = { companyId: me.companyId };
    if (query.scope === 'mine') where.requesterId = me.sub;
    else if (query.scope === 'queue') Object.assign(where, { buyerId: null, status: 'SUBMITTED' });
    else if (query.scope === 'assigned') Object.assign(where, { buyerId: me.sub, status: { in: ['IN_TRIAGE', 'IN_QUOTATION', 'ORDER_CREATED', 'PARTIALLY_FULFILLED'] } });
    if (query.status) where.status = query.status;
    const rows = await this.prisma.purchaseRequisition.findMany({
      where, include: { warehouse: { select: { id: true, code: true, name: true } }, items: { include: { item: true } }, purchaseOrders: { select: { id: true, number: true, status: true, totalAmount: true } } },
      orderBy: { createdAt: 'desc' }, take: 1000,
    });
    return this.attachUsers(me.companyId, rows, ['requesterId', 'buyerId']);
  }

  async createRequisition(me: AuthPayload, body: any) {
    await this.validateRequisitionRefs(me.companyId, body);
    assertNoDuplicates(body.items.map((line: any) => line.itemId), 'Um item não pode aparecer duas vezes na requisição.');
    const status = body.submit ? 'SUBMITTED' : 'DRAFT';
    const created = await this.prisma.purchaseRequisition.create({
      data: {
        companyId: me.companyId, number: businessNumber('RC'), title: body.title, status, urgency: body.urgency ?? 'NORMAL', warehouseId: body.warehouseId,
        requesterId: me.sub, orgNodeId: body.orgNodeId ?? null, justification: body.justification, neededAt: toDate(body.neededAt), submittedAt: body.submit ? new Date() : null,
        items: { create: body.items.map((line: any) => ({ companyId: me.companyId, itemId: line.itemId, requestedQuantity: dec(line.quantity), estimatedUnitCost: nullableDec(line.estimatedUnitCost), note: clean(line.note) })) },
      }, include: { warehouse: true, items: { include: { item: true } } },
    });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseRequisition', entityId: created.id, action: body.submit ? 'CREATE_AND_SUBMIT' : 'CREATE', message: `Requisição ${created.number} criada`, after: created });
    this.workItems.markDirty(me.companyId, [me.sub], 'requisition-created');
    return created;
  }

  async updateRequisition(me: AuthPayload, id: string, body: any) {
    const current = await this.requisitionOrThrow(me.companyId, id);
    if (current.status !== 'DRAFT') throw new ConflictException('Somente requisições em rascunho podem ser editadas.');
    if (current.requesterId !== me.sub && !isAdmin(me)) throw new ForbiddenException('Somente o solicitante pode editar este rascunho.');
    const merged = { warehouseId: body.warehouseId ?? current.warehouseId, orgNodeId: body.orgNodeId !== undefined ? body.orgNodeId : current.orgNodeId, items: body.items ?? current.items.map((line) => ({ itemId: line.itemId })) };
    await this.validateRequisitionRefs(me.companyId, merged);
    if (body.items) assertNoDuplicates(body.items.map((line: any) => line.itemId), 'Um item não pode aparecer duas vezes na requisição.');
    const updated = await this.prisma.$transaction(async (tx) => {
      if (body.items) {
        await tx.purchaseRequisitionItem.deleteMany({ where: { requisitionId: id } });
        await tx.purchaseRequisitionItem.createMany({ data: body.items.map((line: any) => ({ companyId: me.companyId, requisitionId: id, itemId: line.itemId, requestedQuantity: dec(line.quantity), estimatedUnitCost: nullableDec(line.estimatedUnitCost), note: clean(line.note) })) });
      }
      return tx.purchaseRequisition.update({ where: { id }, data: {
        ...(body.title !== undefined ? { title: body.title } : {}), ...(body.warehouseId !== undefined ? { warehouseId: body.warehouseId } : {}),
        ...(body.orgNodeId !== undefined ? { orgNodeId: body.orgNodeId } : {}), ...(body.urgency !== undefined ? { urgency: body.urgency } : {}),
        ...(body.justification !== undefined ? { justification: body.justification } : {}), ...(body.neededAt !== undefined ? { neededAt: toDate(body.neededAt) } : {}),
      }, include: { warehouse: true, items: { include: { item: true } } } });
    });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseRequisition', entityId: id, action: 'UPDATE', message: `Requisição ${updated.number} atualizada`, before: current, after: updated });
    return updated;
  }

  async submitRequisition(me: AuthPayload, id: string) {
    const current = await this.requisitionOrThrow(me.companyId, id);
    if (current.requesterId !== me.sub && !isAdmin(me)) throw new ForbiddenException('Somente o solicitante pode enviar a requisição.');
    assertTransition(REQUISITION_TRANSITIONS, current.status, 'SUBMITTED', 'Requisição');
    if (!current.items.length) throw new ConflictException('Inclua ao menos um item antes de enviar.');
    const updated = await this.prisma.purchaseRequisition.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: new Date() }, include: { warehouse: true, items: { include: { item: true } } } });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseRequisition', entityId: id, action: 'SUBMIT', message: `Requisição ${updated.number} enviada`, before: { status: current.status }, after: { status: updated.status } });
    this.workItems.markDirty(me.companyId, [me.sub], 'requisition-submitted');
    return updated;
  }

  async claimRequisition(me: AuthPayload, id: string) {
    const claimed = await this.prisma.purchaseRequisition.updateMany({ where: { id, companyId: me.companyId, status: 'SUBMITTED', buyerId: null }, data: { buyerId: me.sub, status: 'IN_TRIAGE', triagedAt: new Date() } });
    if (!claimed.count) {
      const current = await this.requisitionOrThrow(me.companyId, id);
      if (current.buyerId === me.sub) return current;
      throw new ConflictException('A requisição já foi assumida por outro comprador ou saiu da fila.');
    }
    const updated = await this.requisitionOrThrow(me.companyId, id);
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseRequisition', entityId: id, action: 'CLAIM', message: `Requisição ${updated.number} assumida pelo comprador`, after: { buyerId: me.sub, status: updated.status } });
    this.workItems.markDirty(me.companyId, [me.sub, updated.requesterId], 'requisition-claimed');
    return updated;
  }

  async rejectRequisition(me: AuthPayload, id: string, body: any) {
    const current = await this.requisitionOrThrow(me.companyId, id);
    if (!['SUBMITTED', 'IN_TRIAGE', 'IN_QUOTATION'].includes(current.status)) throw new ConflictException('Esta requisição não pode ser recusada.');
    if (current.buyerId && current.buyerId !== me.sub && !isAdmin(me)) throw new ForbiddenException('A requisição pertence a outro comprador.');
    const updated = await this.prisma.purchaseRequisition.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: body.reason, closedAt: new Date() }, include: { items: true, warehouse: true } });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseRequisition', entityId: id, action: 'REJECT', message: `Requisição ${updated.number} recusada`, before: current, after: updated });
    this.workItems.markDirty(me.companyId, [updated.requesterId, me.sub], 'requisition-rejected');
    return updated;
  }

  async cancelRequisition(me: AuthPayload, id: string, body: any) {
    const current = await this.requisitionOrThrow(me.companyId, id);
    if (current.requesterId !== me.sub && !isAdmin(me)) throw new ForbiddenException('Somente o solicitante pode cancelar a requisição.');
    assertTransition(REQUISITION_TRANSITIONS, current.status, 'CANCELLED', 'Requisição');
    if (current.purchaseOrders.some((order) => !['CANCELLED', 'REJECTED'].includes(order.status))) {
      throw new ConflictException('Cancele os pedidos ativos vinculados antes de cancelar a requisição.');
    }
    const updated = await this.prisma.purchaseRequisition.update({
      where: { id }, data: { status: 'CANCELLED', rejectionReason: body.reason, closedAt: new Date() },
      include: { items: { include: { item: true } }, warehouse: true, purchaseOrders: true },
    });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseRequisition', entityId: id, action: 'CANCEL', message: `Requisição ${updated.number} cancelada`, before: current, after: updated });
    this.workItems.markDirty(me.companyId, [updated.requesterId, updated.buyerId], 'requisition-cancelled');
    return updated;
  }

  async listOrders(me: AuthPayload, status?: string) {
    const rows = await this.prisma.purchaseOrder.findMany({
      where: { companyId: me.companyId, ...(status ? { status } : {}) },
      include: { supplier: true, warehouse: true, requisition: { select: { id: true, number: true, title: true, requesterId: true, buyerId: true } }, items: { include: { item: true } }, approvals: { orderBy: { level: 'asc' } }, receipts: { select: { id: true, number: true, receivedAt: true } } },
      orderBy: { createdAt: 'desc' }, take: 1000,
    });
    return this.attachUsers(me.companyId, rows, ['createdById']);
  }

  async createOrder(me: AuthPayload, body: any) {
    const requisition = await this.requisitionOrThrow(me.companyId, body.requisitionId);
    if (!['IN_TRIAGE', 'IN_QUOTATION', 'ORDER_CREATED'].includes(requisition.status)) throw new ConflictException('A requisição precisa estar em triagem para gerar pedido.');
    if (requisition.buyerId !== me.sub && !isAdmin(me)) throw new ForbiddenException('Somente o comprador responsável pode gerar o pedido.');
    const supplier = await this.supplierOrThrow(me.companyId, body.supplierId);
    assertNoDuplicates(body.items.map((line: any) => line.requisitionItemId), 'Uma linha da requisição não pode aparecer duas vezes no pedido.');
    const lines: Array<{ reqLine: (typeof requisition.items)[number]; quantity: unknown; unitPrice: unknown }> = body.items.map((line: any) => {
      const reqLine = requisition.items.find((candidate) => candidate.id === line.requisitionItemId);
      if (!reqLine) throw new NotFoundException('Item da requisição não encontrado.');
      if (reqLine.item.kind !== 'MATERIAL') throw new ConflictException('Pedidos de serviço serão liberados na Fase 4, com medição obrigatória.');
      const remaining = reqLine.requestedQuantity.minus(reqLine.orderedQuantity);
      if (dec(line.quantity).gt(remaining)) throw new ConflictException(`Quantidade do item ${reqLine.item.code} supera o saldo não pedido.`);
      return { reqLine, quantity: line.quantity, unitPrice: line.unitPrice };
    });
    const totals = orderTotals(lines, body.freightAmount, body.discountAmount);
    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.create({ data: {
        companyId: me.companyId, number: businessNumber('PC'), requisitionId: requisition.id, supplierId: supplier.id, warehouseId: requisition.warehouseId,
        subtotal: dec(totals.subtotal), freightAmount: dec(totals.freight), discountAmount: dec(totals.discount), totalAmount: dec(totals.total),
        paymentTerms: clean(body.paymentTerms) ?? supplier.paymentTerms, expectedDeliveryAt: toDate(body.expectedDeliveryAt), notes: clean(body.notes), createdById: me.sub,
        items: { create: lines.map(({ reqLine, quantity, unitPrice }) => ({ companyId: me.companyId, requisitionItemId: reqLine.id, itemId: reqLine.itemId, kindSnapshot: reqLine.item.kind, description: reqLine.description ?? reqLine.item.name, unit: reqLine.item.unit, orderedQuantity: dec(quantity), unitPrice: dec(unitPrice), totalPrice: dec(quantity).mul(dec(unitPrice)) })) },
      }, include: { supplier: true, warehouse: true, items: { include: { item: true } }, approvals: true } });
      for (const { reqLine, quantity } of lines) await tx.purchaseRequisitionItem.update({ where: { id: reqLine.id }, data: { orderedQuantity: { increment: dec(quantity) } } });
      await tx.purchaseRequisition.update({ where: { id: requisition.id }, data: { status: 'ORDER_CREATED' } });
      return order;
    });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseOrder', entityId: created.id, action: 'CREATE', message: `Pedido ${created.number} gerado`, after: created });
    this.workItems.markDirty(me.companyId, [me.sub, requisition.requesterId], 'purchase-order-created');
    return created;
  }

  async submitOrder(me: AuthPayload, id: string) {
    const current = await this.orderOrThrow(me.companyId, id);
    if (!['DRAFT', 'REJECTED'].includes(current.status)) throw new ConflictException('Somente pedido em rascunho ou devolvido pode ser enviado para aprovação.');
    if (current.createdById !== me.sub && !isAdmin(me)) throw new ForbiddenException('Somente o comprador responsável pode enviar o pedido.');
    const rules = await this.prisma.purchaseApprovalRule.findMany({
      where: { companyId: me.companyId, deletedAt: null, active: true, minimumAmount: { lte: current.totalAmount }, OR: [{ maximumAmount: null }, { maximumAmount: { gte: current.totalAmount } }] },
      orderBy: { level: 'asc' },
    });
    const byLevel = new Map<number, typeof rules>();
    for (const rule of rules) byLevel.set(rule.level, [...(byLevel.get(rule.level) ?? []), rule]);
    const ambiguous = [...byLevel.entries()].find(([, levelRules]) => levelRules.length > 1);
    if (ambiguous) throw new ConflictException(`Há mais de uma alçada aplicável no nível ${ambiguous[0]}. Ajuste as faixas antes de enviar.`);
    const snapshots = rules.length ? rules : [{ id: null, name: 'Aprovação de compras', level: 1, minimumAmount: dec(0), maximumAmount: null, approverUserId: null, approverRole: null }];
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrderApproval.deleteMany({ where: { purchaseOrderId: id } });
      await tx.purchaseOrderApproval.createMany({ data: snapshots.map((rule) => ({
        companyId: me.companyId, purchaseOrderId: id, ruleId: rule.id, ruleName: rule.name, minimumAmount: rule.minimumAmount,
        maximumAmount: rule.maximumAmount, orderAmount: current.totalAmount, level: rule.level, approverUserId: rule.approverUserId, approverRole: rule.approverRole,
      })) });
      return tx.purchaseOrder.update({ where: { id }, data: { status: 'PENDING_APPROVAL', submittedAt: new Date(), approvedAt: null }, include: { supplier: true, warehouse: true, items: { include: { item: true } }, approvals: { orderBy: { level: 'asc' } } } });
    });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseOrder', entityId: id, action: 'SUBMIT_APPROVAL', message: `Pedido ${updated.number} enviado para alçada`, before: { status: current.status }, after: { status: updated.status, approvals: updated.approvals } });
    this.workItems.markDirty(me.companyId, [me.sub, ...updated.approvals.map((step) => step.approverUserId)], 'purchase-order-submitted');
    return updated;
  }

  async decideOrder(me: AuthPayload, id: string, decision: 'APPROVED' | 'REJECTED', body: any) {
    const result = await this.serializable(async (tx) => {
      const order = await tx.purchaseOrder.findFirst({ where: { id, companyId: me.companyId }, include: { approvals: { orderBy: { level: 'asc' } }, items: { include: { item: true } }, supplier: true, warehouse: true } });
      if (!order) throw new NotFoundException('Pedido não encontrado.');
      if (order.status !== 'PENDING_APPROVAL') throw new ConflictException('O pedido não está aguardando aprovação.');
      const pending = order.approvals.find((step) => step.status === 'PENDING');
      if (!pending) throw new ConflictException('Não há etapa de aprovação pendente.');
      if (pending.approverUserId && pending.approverUserId !== me.sub && !isAdmin(me)) throw new ForbiddenException('Esta etapa está atribuída a outro aprovador.');
      if (!pending.approverUserId && pending.approverRole && pending.approverRole !== String(me.role) && !isAdmin(me)) throw new ForbiddenException(`Esta etapa exige o papel ${pending.approverRole}.`);
      const claimed = await tx.purchaseOrderApproval.updateMany({ where: { id: pending.id, status: 'PENDING' }, data: { status: decision, decidedById: me.sub, decisionNote: clean(body.note), decidedAt: new Date() } });
      if (!claimed.count) throw new ConflictException('Esta etapa já foi decidida por outro usuário.');
      const remaining = decision === 'APPROVED' ? await tx.purchaseOrderApproval.count({ where: { purchaseOrderId: id, status: 'PENDING' } }) : 0;
      const status = decision === 'REJECTED' ? 'REJECTED' : remaining === 0 ? 'APPROVED' : 'PENDING_APPROVAL';
      return tx.purchaseOrder.update({ where: { id }, data: { status, ...(status === 'APPROVED' ? { approvedAt: new Date() } : {}) }, include: { supplier: true, warehouse: true, items: { include: { item: true } }, approvals: { orderBy: { level: 'asc' } } } });
    });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseOrder', entityId: id, action: decision, message: `Pedido ${result.number}: ${decision}`, after: result });
    this.workItems.markDirty(me.companyId, [result.createdById, me.sub, ...result.approvals.map((step) => step.approverUserId)], 'purchase-order-decided');
    return result;
  }

  async sendOrder(me: AuthPayload, id: string) {
    const current = await this.orderOrThrow(me.companyId, id);
    assertTransition(PURCHASE_ORDER_TRANSITIONS, current.status, 'SENT', 'Pedido');
    const updated = await this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() }, include: { supplier: true, warehouse: true, items: { include: { item: true } }, approvals: true } });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseOrder', entityId: id, action: 'SEND', message: `Pedido ${updated.number} marcado como enviado`, before: { status: current.status }, after: { status: updated.status } });
    return updated;
  }

  async cancelOrder(me: AuthPayload, id: string, body: any) {
    const current = await this.orderOrThrow(me.companyId, id);
    if (current.createdById !== me.sub && !isAdmin(me)) throw new ForbiddenException('Somente o comprador responsável pode cancelar o pedido.');
    assertTransition(PURCHASE_ORDER_TRANSITIONS, current.status, 'CANCELLED', 'Pedido');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrderApproval.updateMany({ where: { purchaseOrderId: id, status: 'PENDING' }, data: { status: 'SKIPPED', decisionNote: body.reason, decidedById: me.sub, decidedAt: new Date() } });
      return tx.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED', cancellationReason: body.reason, cancelledAt: new Date() }, include: { supplier: true, warehouse: true, items: { include: { item: true } }, approvals: { orderBy: { level: 'asc' } } } });
    });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseOrder', entityId: id, action: 'CANCEL', message: `Pedido ${updated.number} cancelado`, before: current, after: updated });
    this.workItems.markDirty(me.companyId, [updated.createdById, ...updated.approvals.map((step) => step.approverUserId)], 'purchase-order-cancelled');
    return updated;
  }

  async closeOrder(me: AuthPayload, id: string) {
    const current = await this.orderOrThrow(me.companyId, id);
    assertTransition(PURCHASE_ORDER_TRANSITIONS, current.status, 'CLOSED', 'Pedido');
    const updated = await this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() }, include: { supplier: true, warehouse: true, items: { include: { item: true } }, approvals: true } });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseOrder', entityId: id, action: 'CLOSE', message: `Pedido ${updated.number} encerrado`, before: { status: current.status }, after: { status: updated.status } });
    return updated;
  }

  async receiveOrder(me: AuthPayload, id: string, body: any) {
    const result = await this.serializable(async (tx) => {
      const duplicate = await tx.purchaseReceipt.findUnique({ where: { companyId_idempotencyKey: { companyId: me.companyId, idempotencyKey: body.idempotencyKey } }, include: { items: { include: { item: true, movement: true } }, warehouse: true, purchaseOrder: true } });
      if (duplicate) return duplicate;
      const order = await tx.purchaseOrder.findFirst({ where: { id, companyId: me.companyId }, include: { items: true, requisition: { include: { items: true } } } });
      if (!order) throw new NotFoundException('Pedido não encontrado.');
      if (!['SENT', 'PARTIALLY_DELIVERED'].includes(order.status)) throw new ConflictException('O pedido precisa estar enviado para receber material.');
      assertNoDuplicates(body.items.map((line: any) => line.purchaseOrderItemId), 'Uma linha não pode aparecer duas vezes no recebimento.');
      const receipt = await tx.purchaseReceipt.create({ data: { companyId: me.companyId, number: businessNumber('RE'), purchaseOrderId: order.id, warehouseId: order.warehouseId, receivedById: me.sub, deliveryNote: clean(body.deliveryNote), idempotencyKey: body.idempotencyKey, notes: clean(body.notes) } });
      const orderedReceiptLines = [...body.items].sort((a: any, b: any) => {
        const itemA = order.items.find((candidate) => candidate.id === a.purchaseOrderItemId)?.itemId ?? '';
        const itemB = order.items.find((candidate) => candidate.id === b.purchaseOrderItemId)?.itemId ?? '';
        return itemA.localeCompare(itemB);
      });
      for (const line of orderedReceiptLines) {
        const orderLine = order.items.find((candidate) => candidate.id === line.purchaseOrderItemId);
        if (!orderLine) throw new NotFoundException('Item do pedido não encontrado.');
        if (orderLine.kindSnapshot !== 'MATERIAL') throw new ConflictException('Serviço só pode ser faturado após medição aprovada (Fase 4).');
        const remaining = orderLine.orderedQuantity.minus(orderLine.receivedQuantity);
        if (dec(line.quantity).gt(remaining)) throw new ConflictException('Quantidade recebida supera o saldo aberto do pedido.');
        const movement = await this.inventory.applyMovementTx(tx, {
          companyId: me.companyId, warehouseId: order.warehouseId, itemId: orderLine.itemId, type: 'IN', quantity: line.quantity,
          unitCost: orderLine.unitPrice, originType: 'PURCHASE_RECEIPT', originId: receipt.id, reference: `${order.number}/${receipt.number}`,
          reason: 'Recebimento de pedido de compra', idempotencyKey: `${body.idempotencyKey}:${orderLine.id}`, actorId: me.sub,
          metadata: { purchaseOrderId: order.id, supplierId: order.supplierId, deliveryNote: body.deliveryNote ?? null },
        }, 1);
        await tx.purchaseReceiptItem.create({ data: { companyId: me.companyId, receiptId: receipt.id, purchaseOrderItemId: orderLine.id, itemId: orderLine.itemId, quantity: dec(line.quantity), unitCost: orderLine.unitPrice, movementId: movement.id } });
        await tx.purchaseOrderItem.update({ where: { id: orderLine.id }, data: { receivedQuantity: { increment: dec(line.quantity) } } });
        if (orderLine.requisitionItemId) await tx.purchaseRequisitionItem.update({ where: { id: orderLine.requisitionItemId }, data: { receivedQuantity: { increment: dec(line.quantity) } } });
      }
      const refreshedLines = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: order.id, kindSnapshot: 'MATERIAL' } });
      const nextStatus = orderStatusFromQuantities(refreshedLines.map((line) => ({ ordered: line.orderedQuantity, received: line.receivedQuantity })));
      await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: nextStatus, ...(nextStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}) } });
      if (order.requisitionId) {
        const reqLines = await tx.purchaseRequisitionItem.findMany({ where: { requisitionId: order.requisitionId } });
        const reqStatus = requisitionStatusFromQuantities(reqLines.map((line) => ({ requested: line.requestedQuantity, received: line.receivedQuantity })));
        await tx.purchaseRequisition.update({ where: { id: order.requisitionId }, data: { status: reqStatus, ...(reqStatus === 'FULFILLED' ? { closedAt: new Date() } : {}) } });
      }
      return tx.purchaseReceipt.findUniqueOrThrow({ where: { id: receipt.id }, include: { items: { include: { item: true, movement: true } }, warehouse: true, purchaseOrder: true } });
    });
    await this.audit.record(me, { module: 'Suprimentos', entity: 'PurchaseReceipt', entityId: result.id, action: 'RECEIVE', message: `Recebimento ${result.number} processado`, after: result });
    this.workItems.markDirty(me.companyId, [me.sub, result.purchaseOrder.createdById], 'purchase-order-received');
    return result;
  }

  async listReceipts(me: AuthPayload) {
    return this.prisma.purchaseReceipt.findMany({ where: { companyId: me.companyId }, include: { warehouse: true, purchaseOrder: { include: { supplier: true } }, items: { include: { item: true, movement: true } } }, orderBy: { receivedAt: 'desc' }, take: 1000 });
  }

  private async validateRequisitionRefs(companyId: string, body: { warehouseId: string; orgNodeId?: string | null; items: Array<{ itemId: string }> }) {
    const itemIds = [...new Set(body.items.map((line) => line.itemId))];
    const [warehouse, org, itemCount] = await Promise.all([
      this.prisma.warehouse.findFirst({ where: { id: body.warehouseId, companyId, deletedAt: null, active: true }, select: { id: true } }),
      body.orgNodeId ? this.prisma.orgNode.findFirst({ where: { id: body.orgNodeId, companyId, deletedAt: null }, select: { id: true } }) : Promise.resolve({ id: '' }),
      this.prisma.stockItem.count({ where: { id: { in: itemIds }, companyId, deletedAt: null, active: true } }),
    ]);
    if (!warehouse) throw new NotFoundException('Almoxarifado de destino não encontrado.');
    if (body.orgNodeId && !org) throw new NotFoundException('Centro de custo/área não encontrado.');
    if (itemCount !== itemIds.length) throw new NotFoundException('Um ou mais itens não foram encontrados.');
  }

  private validateApprover(companyId: string, userId?: string | null) {
    if (!userId) return Promise.resolve();
    return this.prisma.user.findFirst({ where: { id: userId, companyId, deletedAt: null, active: true }, select: { id: true } }).then((user) => {
      if (!user) throw new NotFoundException('Usuário aprovador não encontrado.');
    });
  }

  private supplierOrThrow(companyId: string, id: string) {
    return this.prisma.supplier.findFirst({ where: { id, companyId, deletedAt: null, active: true } }).then((row) => { if (!row) throw new NotFoundException('Fornecedor não encontrado.'); return row; });
  }

  private requisitionOrThrow(companyId: string, id: string) {
    return this.prisma.purchaseRequisition.findFirst({ where: { id, companyId }, include: { warehouse: true, items: { include: { item: true } }, purchaseOrders: true } }).then((row) => { if (!row) throw new NotFoundException('Requisição não encontrada.'); return row; });
  }

  private orderOrThrow(companyId: string, id: string) {
    return this.prisma.purchaseOrder.findFirst({ where: { id, companyId }, include: { supplier: true, warehouse: true, requisition: true, items: { include: { item: true } }, approvals: { orderBy: { level: 'asc' } }, receipts: true } }).then((row) => { if (!row) throw new NotFoundException('Pedido não encontrado.'); return row; });
  }

  private async attachUsers<T extends Record<string, any>>(companyId: string, rows: T[], fields: string[]): Promise<Array<T & { users: Record<string, { id: string; name: string; email: string } | null> }>> {
    const ids = [...new Set(rows.flatMap((row) => fields.map((field) => row[field])).filter(Boolean))] as string[];
    const users = ids.length ? await this.prisma.user.findMany({ where: { companyId, id: { in: ids } }, select: { id: true, name: true, email: true } }) : [];
    const byId = new Map(users.map((user) => [user.id, user]));
    return rows.map((row) => ({ ...row, users: Object.fromEntries(fields.map((field) => [field, row[field] ? byId.get(row[field]) ?? null : null])) }));
  }

  private serializable<T>(operation: (tx: Tx) => Promise<T>, attempt = 1): Promise<T> {
    return this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 }).catch((error) => {
      if (attempt < 4 && error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code)) return this.serializable(operation, attempt + 1);
      throw error;
    });
  }
}

function supplierData(me: AuthPayload, body: any): Prisma.SupplierUncheckedCreateInput {
  return { companyId: me.companyId, createdById: me.sub, code: code(body.code), legalName: body.legalName, tradeName: clean(body.tradeName), documentNumber: digits(body.documentNumber), contactName: clean(body.contactName), email: clean(body.email), phone: clean(body.phone), paymentTerms: clean(body.paymentTerms), rating: nullableDec(body.rating), notes: clean(body.notes), active: body.active ?? true };
}
function supplierPatch(body: any): Prisma.SupplierUncheckedUpdateInput {
  return { ...(body.code !== undefined ? { code: code(body.code) } : {}), ...(body.legalName !== undefined ? { legalName: body.legalName } : {}), ...(body.tradeName !== undefined ? { tradeName: clean(body.tradeName) } : {}), ...(body.documentNumber !== undefined ? { documentNumber: digits(body.documentNumber) } : {}), ...(body.contactName !== undefined ? { contactName: clean(body.contactName) } : {}), ...(body.email !== undefined ? { email: clean(body.email) } : {}), ...(body.phone !== undefined ? { phone: clean(body.phone) } : {}), ...(body.paymentTerms !== undefined ? { paymentTerms: clean(body.paymentTerms) } : {}), ...(body.rating !== undefined ? { rating: nullableDec(body.rating) } : {}), ...(body.notes !== undefined ? { notes: clean(body.notes) } : {}), ...(body.active !== undefined ? { active: body.active } : {}) };
}
function dec(value: unknown) { return new Prisma.Decimal(String(value ?? 0)); }
function nullableDec(value: unknown) { return value === undefined || value === null || value === '' ? null : dec(value); }
function clean(value: unknown): string | null { const result = String(value ?? '').trim(); return result || null; }
function code(value: unknown): string { return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '-'); }
function digits(value: unknown): string | null { const result = String(value ?? '').replace(/\D/g, ''); return result || null; }
function toDate(value: unknown): Date | null { return value ? new Date(String(value)) : null; }
function monthStart() { const now = new Date(); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); }
function isAdmin(me: AuthPayload) { return ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(String(me.role)); }
function assertNoDuplicates(values: string[], message: string) { if (new Set(values).size !== values.length) throw new BadRequestException(message); }
function uniqueConflict(message: string) { return (error: unknown) => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message); throw error; }; }
