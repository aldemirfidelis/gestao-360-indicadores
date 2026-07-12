-- Suprimentos fases 4 e 5: medição de serviços, inventário cíclico e políticas de retirada.
ALTER TABLE "supply_supplier_invoices" ADD COLUMN "serviceMeasurementId" TEXT;
CREATE UNIQUE INDEX "supply_supplier_invoices_companyId_serviceMeasurementId_key" ON "supply_supplier_invoices"("companyId", "serviceMeasurementId");

CREATE TABLE "supply_service_measurements" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "number" TEXT NOT NULL, "purchaseOrderId" TEXT NOT NULL,
 "fiscalUserId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT', "periodStart" TIMESTAMP(3) NOT NULL,
 "periodEnd" TIMESTAMP(3) NOT NULL, "notes" TEXT, "submittedAt" TIMESTAMP(3), "approvedAt" TIMESTAMP(3),
 "approvedById" TEXT, "contestedAt" TIMESTAMP(3), "contestedById" TEXT, "contestReason" TEXT,
 "invoicedAt" TIMESTAMP(3), "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "supply_service_measurements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "supply_service_measurements_companyId_number_key" ON "supply_service_measurements"("companyId", "number");
CREATE INDEX "supply_service_measurements_companyId_status_createdAt_idx" ON "supply_service_measurements"("companyId", "status", "createdAt");
CREATE INDEX "supply_service_measurements_companyId_purchaseOrderId_idx" ON "supply_service_measurements"("companyId", "purchaseOrderId");

CREATE TABLE "supply_service_measurement_items" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "measurementId" TEXT NOT NULL, "purchaseOrderItemId" TEXT NOT NULL,
 "description" TEXT NOT NULL, "quantity" DECIMAL(18,4) NOT NULL, "unitPrice" DECIMAL(18,6) NOT NULL,
 "totalPrice" DECIMAL(20,2) NOT NULL, "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "supply_service_measurement_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "supply_service_measurement_items_measurementId_purchaseOrderItemId_key" ON "supply_service_measurement_items"("measurementId", "purchaseOrderItemId");
CREATE INDEX "supply_service_measurement_items_companyId_purchaseOrderItemId_idx" ON "supply_service_measurement_items"("companyId", "purchaseOrderItemId");
ALTER TABLE "supply_service_measurement_items" ADD CONSTRAINT "supply_service_measurement_items_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "supply_service_measurements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "supply_inventory_counts" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "number" TEXT NOT NULL, "warehouseId" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'DRAFT', "scheduledAt" TIMESTAMP(3), "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
 "cancelledAt" TIMESTAMP(3), "reason" TEXT, "createdById" TEXT NOT NULL, "completedById" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "supply_inventory_counts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "supply_inventory_counts_companyId_number_key" ON "supply_inventory_counts"("companyId", "number");
CREATE INDEX "supply_inventory_counts_companyId_warehouseId_status_idx" ON "supply_inventory_counts"("companyId", "warehouseId", "status");

CREATE TABLE "supply_inventory_count_items" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "inventoryCountId" TEXT NOT NULL, "itemId" TEXT NOT NULL,
 "expectedQuantity" DECIMAL(18,4) NOT NULL, "countedQuantity" DECIMAL(18,4), "differenceQuantity" DECIMAL(18,4),
 "movementId" TEXT, "countedById" TEXT, "countedAt" TIMESTAMP(3), "note" TEXT,
 CONSTRAINT "supply_inventory_count_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "supply_inventory_count_items_inventoryCountId_itemId_key" ON "supply_inventory_count_items"("inventoryCountId", "itemId");
CREATE INDEX "supply_inventory_count_items_companyId_itemId_idx" ON "supply_inventory_count_items"("companyId", "itemId");
ALTER TABLE "supply_inventory_count_items" ADD CONSTRAINT "supply_inventory_count_items_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "supply_inventory_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "supply_withdrawal_approval_policies" (
 "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "name" TEXT NOT NULL, "orgNodeId" TEXT,
 "minimumAmount" DECIMAL(20,2) NOT NULL DEFAULT 0, "approverUserId" TEXT, "approverRole" TEXT,
 "active" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3), CONSTRAINT "supply_withdrawal_approval_policies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "supply_withdrawal_approval_policies_companyId_active_orgNodeId_idx" ON "supply_withdrawal_approval_policies"("companyId", "active", "orgNodeId");
