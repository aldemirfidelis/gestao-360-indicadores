import { z } from 'zod';

const id = z.string().uuid();
const text = (min = 1, max = 500) => z.string().trim().min(min).max(max);
const optionalText = (max = 1000) => z.string().trim().max(max).optional().nullable();
const decimal = z.union([z.number(), z.string().trim()]).refine((value) => Number.isFinite(Number(value)), 'Número inválido');
const positiveDecimal = decimal.refine((value) => Number(value) > 0, 'O valor deve ser maior que zero');
const nonNegativeDecimal = decimal.refine((value) => Number(value) >= 0, 'O valor não pode ser negativo');
const optionalDate = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), 'Data inválida').optional().nullable();

export const warehouseCreateSchema = z.object({
  code: text(1, 30),
  name: text(2, 120),
  description: optionalText(1000),
  orgNodeId: id.optional().nullable(),
  managerUserId: id.optional().nullable(),
  address: optionalText(500),
  allowNegative: z.boolean().optional(),
  active: z.boolean().optional(),
}).strict();
export const warehouseUpdateSchema = warehouseCreateSchema.partial();

const stockItemBaseSchema = z.object({
  code: text(1, 40),
  name: text(2, 180),
  description: optionalText(2000),
  kind: z.enum(['MATERIAL', 'SERVICE']),
  unit: text(1, 20),
  groupName: optionalText(100),
  minimumStock: nonNegativeDecimal.optional().nullable(),
  maximumStock: nonNegativeDecimal.optional().nullable(),
  qrCodeToken: optionalText(120),
  active: z.boolean().optional(),
}).strict();
const validStockRange = (value: { minimumStock?: unknown; maximumStock?: unknown }) =>
  value.maximumStock == null || value.minimumStock == null || Number(value.maximumStock) >= Number(value.minimumStock);
export const stockItemCreateSchema = stockItemBaseSchema.refine(validStockRange, {
  message: 'Estoque máximo deve ser maior ou igual ao mínimo.',
  path: ['maximumStock'],
});
export const stockItemUpdateSchema = stockItemBaseSchema.partial().refine(validStockRange, {
  message: 'Estoque máximo deve ser maior ou igual ao mínimo.', path: ['maximumStock'],
});

export const stockAdjustmentSchema = z.object({
  warehouseId: id,
  itemId: id,
  quantityDelta: decimal.refine((value) => Number(value) !== 0, 'A variação não pode ser zero'),
  unitCost: nonNegativeDecimal.optional(),
  reason: text(3, 500),
  reference: optionalText(120),
  idempotencyKey: text(6, 120),
}).strict();

export const stockTransferSchema = z.object({
  sourceWarehouseId: id,
  destinationWarehouseId: id,
  itemId: id,
  quantity: positiveDecimal,
  reason: text(3, 500),
  reference: optionalText(120),
  idempotencyKey: text(6, 120),
}).strict().refine((value) => value.sourceWarehouseId !== value.destinationWarehouseId, {
  message: 'Origem e destino devem ser diferentes.', path: ['destinationWarehouseId'],
});

const withdrawalLine = z.object({ itemId: id, quantity: positiveDecimal, note: optionalText(500) }).strict();
export const withdrawalCreateSchema = z.object({
  warehouseId: id,
  orgNodeId: id.optional().nullable(),
  justification: text(3, 1000),
  neededAt: optionalDate,
  items: z.array(withdrawalLine).min(1).max(100),
}).strict();
export const withdrawalDecisionSchema = z.object({ note: optionalText(1000) }).strict();
export const withdrawalFulfillSchema = z.object({
  idempotencyKey: text(6, 120),
  items: z.array(z.object({ withdrawalItemId: id, quantity: positiveDecimal }).strict()).min(1).max(100),
}).strict();

export const catalogImportSchema = z.object({
  xlsxBase64: z.string().min(20).max(15_000_000),
  warehouseId: id.optional().nullable(),
  idempotencyKey: text(6, 100),
}).strict();

export const supplierCreateSchema = z.object({
  code: text(1, 30), legalName: text(2, 180), tradeName: optionalText(180), documentNumber: optionalText(30),
  contactName: optionalText(120), email: z.string().trim().email().optional().nullable(), phone: optionalText(40),
  paymentTerms: optionalText(300), rating: nonNegativeDecimal.optional().nullable(), notes: optionalText(2000), active: z.boolean().optional(),
}).strict();
export const supplierUpdateSchema = supplierCreateSchema.partial();

const approvalRuleBaseSchema = z.object({
  name: text(2, 120), level: z.number().int().min(1).max(20), minimumAmount: nonNegativeDecimal,
  maximumAmount: nonNegativeDecimal.optional().nullable(), approverUserId: id.optional().nullable(),
  approverRole: z.enum(['COMPANY_ADMIN', 'DIRECTOR', 'MANAGER']).optional().nullable(), active: z.boolean().optional(),
}).strict();
const hasApprover = (value: { approverUserId?: unknown; approverRole?: unknown }) => !!value.approverUserId || !!value.approverRole;
const validApprovalRange = (value: { minimumAmount?: unknown; maximumAmount?: unknown }) =>
  value.maximumAmount == null || value.minimumAmount == null || Number(value.maximumAmount) >= Number(value.minimumAmount);
export const approvalRuleCreateSchema = approvalRuleBaseSchema.refine(hasApprover, {
  message: 'Informe um usuário aprovador ou um papel aprovador.', path: ['approverUserId'],
}).refine(validApprovalRange, {
  message: 'Valor máximo deve ser maior ou igual ao mínimo.', path: ['maximumAmount'],
});
export const approvalRuleUpdateSchema = approvalRuleBaseSchema.partial().refine(validApprovalRange, {
  message: 'Valor máximo deve ser maior ou igual ao mínimo.', path: ['maximumAmount'],
});

const requisitionLine = z.object({ itemId: id, quantity: positiveDecimal, estimatedUnitCost: nonNegativeDecimal.optional().nullable(), note: optionalText(500) }).strict();
export const requisitionCreateSchema = z.object({
  title: text(3, 180), warehouseId: id, orgNodeId: id.optional().nullable(), urgency: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
  justification: text(3, 2000), neededAt: optionalDate, submit: z.boolean().optional(), items: z.array(requisitionLine).min(1).max(100),
}).strict();
export const requisitionUpdateSchema = requisitionCreateSchema.omit({ submit: true }).partial();
export const requisitionRejectSchema = z.object({ reason: text(3, 1000) }).strict();
export const cancellationSchema = z.object({ reason: text(3, 1000) }).strict();

export const purchaseOrderCreateSchema = z.object({
  requisitionId: id, supplierId: id, paymentTerms: optionalText(300), expectedDeliveryAt: optionalDate,
  freightAmount: nonNegativeDecimal.optional(), discountAmount: nonNegativeDecimal.optional(), notes: optionalText(2000),
  items: z.array(z.object({ requisitionItemId: id, quantity: positiveDecimal, unitPrice: nonNegativeDecimal }).strict()).min(1).max(100),
}).strict();
export const approvalDecisionSchema = z.object({ note: optionalText(1000) }).strict();
export const rejectionDecisionSchema = z.object({ note: text(3, 1000) }).strict();
export const purchaseReceiptSchema = z.object({
  idempotencyKey: text(6, 120), deliveryNote: optionalText(120), notes: optionalText(1000),
  items: z.array(z.object({ purchaseOrderItemId: id, quantity: positiveDecimal }).strict()).min(1).max(100),
}).strict();

// ---------------- Fase 3: Cotações e NF de entrada ----------------

const quoteLine = z.object({ requisitionItemId: id, quantity: positiveDecimal, unitPrice: nonNegativeDecimal, note: optionalText(500) }).strict();
export const quotationCreateSchema = z.object({ requisitionId: id, dueAt: optionalDate, notes: optionalText(2000) }).strict();
export const supplierQuoteCreateSchema = z.object({
  supplierId: id, paymentTerms: optionalText(300), deliveryDays: z.number().int().min(0).max(3650).optional().nullable(),
  freightAmount: nonNegativeDecimal.optional(), discountAmount: nonNegativeDecimal.optional(), validUntil: optionalDate,
  notes: optionalText(2000), items: z.array(quoteLine).min(1).max(100),
}).strict();
export const quotationAwardSchema = z.object({ supplierQuoteId: id, justification: text(3, 2000) }).strict();

export const materialInvoiceCreateSchema = z.object({
  purchaseOrderId: id, receiptId: id, invoiceNumber: text(1, 60), series: optionalText(20), accessKey: optionalText(60),
  issuedAt: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), 'Data inválida'),
  attachmentDocumentId: id.optional().nullable(), notes: optionalText(2000),
  items: z.array(z.object({ purchaseOrderItemId: id, quantity: positiveDecimal, unitPrice: nonNegativeDecimal }).strict()).min(1).max(100),
}).strict();
export const invoiceReturnSchema = z.object({ reason: text(3, 1000) }).strict();

export const measurementCreateSchema = z.object({
  purchaseOrderId: id, fiscalUserId: id, periodStart: z.string().datetime(), periodEnd: z.string().datetime(), notes: optionalText(2000),
  items: z.array(z.object({ purchaseOrderItemId: id, quantity: positiveDecimal, note: optionalText(500) }).strict()).min(1).max(100),
}).strict().refine((v) => new Date(v.periodEnd) >= new Date(v.periodStart), { message: 'Período final deve ser posterior ao inicial.', path: ['periodEnd'] });
export const measurementDecisionSchema = z.object({ note: optionalText(1000) }).strict();
export const measurementContestSchema = z.object({ reason: text(3, 1000) }).strict();
export const serviceInvoiceCreateSchema = z.object({
  serviceMeasurementId: id, invoiceNumber: text(1, 60), series: optionalText(20), accessKey: optionalText(60), issuedAt: z.string().datetime(),
  attachmentDocumentId: id.optional().nullable(), notes: optionalText(2000),
}).strict();

export const inventoryCountCreateSchema = z.object({ warehouseId: id, scheduledAt: optionalDate, itemIds: z.array(id).max(2000).optional(), reason: optionalText(1000) }).strict();
export const inventoryCountRecordSchema = z.object({ items: z.array(z.object({ inventoryCountItemId: id, countedQuantity: nonNegativeDecimal, note: optionalText(500) }).strict()).min(1).max(2000) }).strict();
export const inventoryCountCompleteSchema = z.object({ idempotencyKey: text(6, 120) }).strict();
export const withdrawalPolicySchema = z.object({ name: text(2, 120), orgNodeId: id.optional().nullable(), minimumAmount: nonNegativeDecimal.optional(), approverUserId: id.optional().nullable(), approverRole: z.enum(['COMPANY_ADMIN', 'DIRECTOR', 'MANAGER']).optional().nullable(), active: z.boolean().optional() }).strict()
  .refine((v) => !!v.approverUserId || !!v.approverRole, { message: 'Informe aprovador ou papel.', path: ['approverUserId'] });
