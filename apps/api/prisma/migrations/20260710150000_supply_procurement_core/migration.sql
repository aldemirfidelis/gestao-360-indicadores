-- Suprimentos — Fase 2: requisição, fila do comprador, pedido, alçada e recebimento.
-- Migração estritamente aditiva; recebimentos só serão criados por ação explícita.

ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'PURCHASE_ORDER_OVERDUE';

CREATE TABLE "supply_suppliers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "documentNumber" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "paymentTerms" TEXT,
    "rating" DECIMAL(5,2),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "supply_suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_purchase_approval_rules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "minimumAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "maximumAmount" DECIMAL(20,2),
    "approverUserId" TEXT,
    "approverRole" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "supply_purchase_approval_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_purchase_requisitions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "warehouseId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "buyerId" TEXT,
    "orgNodeId" TEXT,
    "justification" TEXT NOT NULL,
    "neededAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "triagedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "supply_purchase_requisitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_purchase_requisition_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" TEXT,
    "requestedQuantity" DECIMAL(18,4) NOT NULL,
    "estimatedUnitCost" DECIMAL(18,6),
    "orderedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "receivedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "supply_purchase_requisition_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_purchase_orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "requisitionId" TEXT,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "subtotal" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "freightAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "paymentTerms" TEXT,
    "expectedDeliveryAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "supply_purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_purchase_order_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "requisitionItemId" TEXT,
    "itemId" TEXT NOT NULL,
    "kindSnapshot" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "orderedQuantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "totalPrice" DECIMAL(20,2) NOT NULL,
    "receivedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "supply_purchase_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_purchase_order_approvals" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "ruleId" TEXT,
    "ruleName" TEXT,
    "minimumAmount" DECIMAL(20,2),
    "maximumAmount" DECIMAL(20,2),
    "orderAmount" DECIMAL(20,2) NOT NULL,
    "level" INTEGER NOT NULL,
    "approverUserId" TEXT,
    "approverRole" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "supply_purchase_order_approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_purchase_receipts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryNote" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supply_purchase_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_purchase_receipt_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,6) NOT NULL,
    "movementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supply_purchase_receipt_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supply_suppliers_companyId_code_key" ON "supply_suppliers"("companyId", "code");
CREATE UNIQUE INDEX "supply_suppliers_companyId_documentNumber_key" ON "supply_suppliers"("companyId", "documentNumber");
CREATE INDEX "supply_suppliers_companyId_active_idx" ON "supply_suppliers"("companyId", "active");

CREATE INDEX "supply_purchase_approval_rules_companyId_active_level_idx" ON "supply_purchase_approval_rules"("companyId", "active", "level");

CREATE UNIQUE INDEX "supply_purchase_requisitions_companyId_number_key" ON "supply_purchase_requisitions"("companyId", "number");
CREATE INDEX "supply_purchase_requisitions_companyId_status_createdAt_idx" ON "supply_purchase_requisitions"("companyId", "status", "createdAt");
CREATE INDEX "supply_purchase_requisitions_companyId_requesterId_idx" ON "supply_purchase_requisitions"("companyId", "requesterId");
CREATE INDEX "supply_purchase_requisitions_companyId_buyerId_status_idx" ON "supply_purchase_requisitions"("companyId", "buyerId", "status");
CREATE INDEX "supply_purchase_requisitions_companyId_orgNodeId_idx" ON "supply_purchase_requisitions"("companyId", "orgNodeId");

CREATE UNIQUE INDEX "supply_purchase_requisition_items_requisitionId_itemId_key" ON "supply_purchase_requisition_items"("requisitionId", "itemId");
CREATE INDEX "supply_purchase_requisition_items_companyId_itemId_idx" ON "supply_purchase_requisition_items"("companyId", "itemId");

CREATE UNIQUE INDEX "supply_purchase_orders_companyId_number_key" ON "supply_purchase_orders"("companyId", "number");
CREATE INDEX "supply_purchase_orders_companyId_status_createdAt_idx" ON "supply_purchase_orders"("companyId", "status", "createdAt");
CREATE INDEX "supply_purchase_orders_companyId_supplierId_idx" ON "supply_purchase_orders"("companyId", "supplierId");
CREATE INDEX "supply_purchase_orders_companyId_requisitionId_idx" ON "supply_purchase_orders"("companyId", "requisitionId");

CREATE INDEX "supply_purchase_order_items_companyId_purchaseOrderId_idx" ON "supply_purchase_order_items"("companyId", "purchaseOrderId");
CREATE INDEX "supply_purchase_order_items_companyId_itemId_idx" ON "supply_purchase_order_items"("companyId", "itemId");

CREATE UNIQUE INDEX "supply_purchase_order_approvals_purchaseOrderId_level_key" ON "supply_purchase_order_approvals"("purchaseOrderId", "level");
CREATE INDEX "supply_purchase_order_approvals_companyId_status_approverUserId_idx" ON "supply_purchase_order_approvals"("companyId", "status", "approverUserId");

CREATE UNIQUE INDEX "supply_purchase_receipts_companyId_number_key" ON "supply_purchase_receipts"("companyId", "number");
CREATE UNIQUE INDEX "supply_purchase_receipts_companyId_idempotencyKey_key" ON "supply_purchase_receipts"("companyId", "idempotencyKey");
CREATE INDEX "supply_purchase_receipts_companyId_purchaseOrderId_receivedAt_idx" ON "supply_purchase_receipts"("companyId", "purchaseOrderId", "receivedAt");

CREATE UNIQUE INDEX "supply_purchase_receipt_items_movementId_key" ON "supply_purchase_receipt_items"("movementId");
CREATE UNIQUE INDEX "supply_purchase_receipt_items_receiptId_purchaseOrderItemId_key" ON "supply_purchase_receipt_items"("receiptId", "purchaseOrderItemId");
CREATE INDEX "supply_purchase_receipt_items_companyId_itemId_idx" ON "supply_purchase_receipt_items"("companyId", "itemId");

ALTER TABLE "supply_purchase_requisitions" ADD CONSTRAINT "supply_purchase_requisitions_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "supply_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_requisition_items" ADD CONSTRAINT "supply_purchase_requisition_items_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "supply_purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_requisition_items" ADD CONSTRAINT "supply_purchase_requisition_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "supply_stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_orders" ADD CONSTRAINT "supply_purchase_orders_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "supply_purchase_requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_orders" ADD CONSTRAINT "supply_purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supply_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_orders" ADD CONSTRAINT "supply_purchase_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "supply_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_order_items" ADD CONSTRAINT "supply_purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "supply_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_order_items" ADD CONSTRAINT "supply_purchase_order_items_requisitionItemId_fkey" FOREIGN KEY ("requisitionItemId") REFERENCES "supply_purchase_requisition_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_order_items" ADD CONSTRAINT "supply_purchase_order_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "supply_stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_order_approvals" ADD CONSTRAINT "supply_purchase_order_approvals_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "supply_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_receipts" ADD CONSTRAINT "supply_purchase_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "supply_purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_receipts" ADD CONSTRAINT "supply_purchase_receipts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "supply_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_receipt_items" ADD CONSTRAINT "supply_purchase_receipt_items_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "supply_purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_receipt_items" ADD CONSTRAINT "supply_purchase_receipt_items_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "supply_purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_receipt_items" ADD CONSTRAINT "supply_purchase_receipt_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "supply_stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_purchase_receipt_items" ADD CONSTRAINT "supply_purchase_receipt_items_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "supply_stock_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
