-- CreateTable
CREATE TABLE "supply_quotations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "buyerId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "awardedQuoteId" TEXT,
    "awardJustification" TEXT,
    "awardedById" TEXT,
    "awardedAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_supplier_quotes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "paymentTerms" TEXT,
    "deliveryDays" INTEGER,
    "freightAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_supplier_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_supplier_quote_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierQuoteId" TEXT NOT NULL,
    "requisitionItemId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "totalPrice" DECIMAL(20,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_supplier_quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_supplier_invoices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "series" TEXT,
    "accessKey" TEXT,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "receiptId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(20,2) NOT NULL,
    "attachmentDocumentId" TEXT,
    "notes" TEXT,
    "postedById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "returnedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_supplier_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_supplier_invoice_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT,
    "itemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "totalPrice" DECIMAL(20,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_supplier_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supply_quotations_awardedQuoteId_key" ON "supply_quotations"("awardedQuoteId");

-- CreateIndex
CREATE INDEX "supply_quotations_companyId_status_createdAt_idx" ON "supply_quotations"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "supply_quotations_companyId_requisitionId_idx" ON "supply_quotations"("companyId", "requisitionId");

-- CreateIndex
CREATE UNIQUE INDEX "supply_quotations_companyId_number_key" ON "supply_quotations"("companyId", "number");

-- CreateIndex
CREATE INDEX "supply_supplier_quotes_companyId_supplierId_idx" ON "supply_supplier_quotes"("companyId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "supply_supplier_quotes_quotationId_supplierId_key" ON "supply_supplier_quotes"("quotationId", "supplierId");

-- CreateIndex
CREATE INDEX "supply_supplier_quote_items_companyId_itemId_idx" ON "supply_supplier_quote_items"("companyId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "supply_supplier_quote_items_supplierQuoteId_requisitionItem_key" ON "supply_supplier_quote_items"("supplierQuoteId", "requisitionItemId");

-- CreateIndex
CREATE INDEX "supply_supplier_invoices_companyId_status_issuedAt_idx" ON "supply_supplier_invoices"("companyId", "status", "issuedAt");

-- CreateIndex
CREATE INDEX "supply_supplier_invoices_companyId_purchaseOrderId_idx" ON "supply_supplier_invoices"("companyId", "purchaseOrderId");

-- CreateIndex
CREATE INDEX "supply_supplier_invoices_companyId_receiptId_idx" ON "supply_supplier_invoices"("companyId", "receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "supply_supplier_invoices_companyId_accessKey_key" ON "supply_supplier_invoices"("companyId", "accessKey");

-- CreateIndex
CREATE UNIQUE INDEX "supply_supplier_invoices_companyId_supplierId_invoiceNumber_key" ON "supply_supplier_invoices"("companyId", "supplierId", "invoiceNumber", "series");

-- CreateIndex
CREATE INDEX "supply_supplier_invoice_items_companyId_invoiceId_idx" ON "supply_supplier_invoice_items"("companyId", "invoiceId");

-- AddForeignKey
ALTER TABLE "supply_quotations" ADD CONSTRAINT "supply_quotations_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "supply_purchase_requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_quotations" ADD CONSTRAINT "supply_quotations_awardedQuoteId_fkey" FOREIGN KEY ("awardedQuoteId") REFERENCES "supply_supplier_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_supplier_quotes" ADD CONSTRAINT "supply_supplier_quotes_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "supply_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_supplier_quotes" ADD CONSTRAINT "supply_supplier_quotes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supply_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_supplier_quote_items" ADD CONSTRAINT "supply_supplier_quote_items_supplierQuoteId_fkey" FOREIGN KEY ("supplierQuoteId") REFERENCES "supply_supplier_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_supplier_quote_items" ADD CONSTRAINT "supply_supplier_quote_items_requisitionItemId_fkey" FOREIGN KEY ("requisitionItemId") REFERENCES "supply_purchase_requisition_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_supplier_quote_items" ADD CONSTRAINT "supply_supplier_quote_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "supply_stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_supplier_invoices" ADD CONSTRAINT "supply_supplier_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supply_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_supplier_invoices" ADD CONSTRAINT "supply_supplier_invoices_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "supply_purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_supplier_invoices" ADD CONSTRAINT "supply_supplier_invoices_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "supply_purchase_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_supplier_invoice_items" ADD CONSTRAINT "supply_supplier_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "supply_supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_supplier_invoice_items" ADD CONSTRAINT "supply_supplier_invoice_items_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "supply_purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_supplier_invoice_items" ADD CONSTRAINT "supply_supplier_invoice_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "supply_stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "supply_purchase_order_approvals_companyId_status_approverUserId" RENAME TO "supply_purchase_order_approvals_companyId_status_approverUs_idx";

-- RenameIndex
ALTER INDEX "supply_purchase_receipts_companyId_purchaseOrderId_receivedAt_i" RENAME TO "supply_purchase_receipts_companyId_purchaseOrderId_received_idx";

-- RenameIndex
ALTER INDEX "supply_stock_movements_companyId_warehouseId_itemId_occurredAt_" RENAME TO "supply_stock_movements_companyId_warehouseId_itemId_occurre_idx";

