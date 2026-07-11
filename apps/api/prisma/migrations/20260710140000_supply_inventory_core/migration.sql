-- Suprimentos — Fase 1: estoque básico, kardex e retiradas.
-- Migração estritamente aditiva; não contém seed nem movimenta saldo existente.

ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'STOCK_MINIMUM_ALERT';

CREATE TABLE "supply_warehouses" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orgNodeId" TEXT,
    "managerUserId" TEXT,
    "address" TEXT,
    "allowNegative" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "supply_warehouses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_stock_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'MATERIAL',
    "unit" TEXT NOT NULL,
    "groupName" TEXT,
    "minimumStock" DECIMAL(18,4),
    "maximumStock" DECIMAL(18,4),
    "averageCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "qrCodeToken" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "supply_stock_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_stock_balances" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "averageCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "lastMovementAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "supply_stock_balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_stock_movements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "counterpartyWarehouseId" TEXT,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "balanceBefore" DECIMAL(18,4) NOT NULL,
    "balanceAfter" DECIMAL(18,4) NOT NULL,
    "averageCostAfter" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "originType" TEXT NOT NULL,
    "originId" TEXT,
    "reference" TEXT,
    "reason" TEXT,
    "transferGroupId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supply_stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_material_withdrawals" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "orgNodeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "justification" TEXT NOT NULL,
    "neededAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "fulfilledById" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "supply_material_withdrawals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_material_withdrawal_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "withdrawalId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "requestedQuantity" DECIMAL(18,4) NOT NULL,
    "approvedQuantity" DECIMAL(18,4),
    "fulfilledQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "supply_material_withdrawal_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supply_warehouses_companyId_code_key" ON "supply_warehouses"("companyId", "code");
CREATE INDEX "supply_warehouses_companyId_active_idx" ON "supply_warehouses"("companyId", "active");
CREATE INDEX "supply_warehouses_companyId_orgNodeId_idx" ON "supply_warehouses"("companyId", "orgNodeId");

CREATE UNIQUE INDEX "supply_stock_items_companyId_code_key" ON "supply_stock_items"("companyId", "code");
CREATE UNIQUE INDEX "supply_stock_items_companyId_qrCodeToken_key" ON "supply_stock_items"("companyId", "qrCodeToken");
CREATE INDEX "supply_stock_items_companyId_kind_active_idx" ON "supply_stock_items"("companyId", "kind", "active");
CREATE INDEX "supply_stock_items_companyId_groupName_idx" ON "supply_stock_items"("companyId", "groupName");

CREATE UNIQUE INDEX "supply_stock_balances_companyId_warehouseId_itemId_key" ON "supply_stock_balances"("companyId", "warehouseId", "itemId");
CREATE INDEX "supply_stock_balances_companyId_itemId_idx" ON "supply_stock_balances"("companyId", "itemId");
CREATE INDEX "supply_stock_balances_companyId_warehouseId_idx" ON "supply_stock_balances"("companyId", "warehouseId");

CREATE UNIQUE INDEX "supply_stock_movements_companyId_idempotencyKey_key" ON "supply_stock_movements"("companyId", "idempotencyKey");
CREATE INDEX "supply_stock_movements_companyId_warehouseId_itemId_occurredAt_idx" ON "supply_stock_movements"("companyId", "warehouseId", "itemId", "occurredAt");
CREATE INDEX "supply_stock_movements_companyId_originType_originId_idx" ON "supply_stock_movements"("companyId", "originType", "originId");
CREATE INDEX "supply_stock_movements_companyId_transferGroupId_idx" ON "supply_stock_movements"("companyId", "transferGroupId");

CREATE UNIQUE INDEX "supply_material_withdrawals_companyId_number_key" ON "supply_material_withdrawals"("companyId", "number");
CREATE INDEX "supply_material_withdrawals_companyId_status_createdAt_idx" ON "supply_material_withdrawals"("companyId", "status", "createdAt");
CREATE INDEX "supply_material_withdrawals_companyId_requesterId_idx" ON "supply_material_withdrawals"("companyId", "requesterId");
CREATE INDEX "supply_material_withdrawals_companyId_warehouseId_idx" ON "supply_material_withdrawals"("companyId", "warehouseId");

CREATE UNIQUE INDEX "supply_material_withdrawal_items_withdrawalId_itemId_key" ON "supply_material_withdrawal_items"("withdrawalId", "itemId");
CREATE INDEX "supply_material_withdrawal_items_companyId_itemId_idx" ON "supply_material_withdrawal_items"("companyId", "itemId");

ALTER TABLE "supply_stock_balances" ADD CONSTRAINT "supply_stock_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "supply_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_stock_balances" ADD CONSTRAINT "supply_stock_balances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "supply_stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_stock_movements" ADD CONSTRAINT "supply_stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "supply_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_stock_movements" ADD CONSTRAINT "supply_stock_movements_counterpartyWarehouseId_fkey" FOREIGN KEY ("counterpartyWarehouseId") REFERENCES "supply_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_stock_movements" ADD CONSTRAINT "supply_stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "supply_stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_material_withdrawals" ADD CONSTRAINT "supply_material_withdrawals_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "supply_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_material_withdrawal_items" ADD CONSTRAINT "supply_material_withdrawal_items_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "supply_material_withdrawals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supply_material_withdrawal_items" ADD CONSTRAINT "supply_material_withdrawal_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "supply_stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
