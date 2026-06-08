-- CreateEnum
CREATE TYPE "FoodSafetySupplierStatus" AS ENUM ('PROSPECT', 'APPROVED', 'CONDITIONAL', 'BLOCKED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FoodSafetySupplierCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FoodSafetyMaterialCategory" AS ENUM ('RAW_MATERIAL', 'INGREDIENT', 'PACKAGING', 'PROCESS_AID', 'FINISHED_PRODUCT', 'OTHER');

-- CreateEnum
CREATE TYPE "FoodSafetyMaterialStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'BLOCKED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FoodSafetyLotType" AS ENUM ('RECEIVED', 'PRODUCED', 'SHIPPED', 'INTERNAL_TRANSFER');

-- CreateEnum
CREATE TYPE "FoodSafetyLotStatus" AS ENUM ('QUARANTINED', 'RELEASED', 'BLOCKED', 'CONSUMED', 'EXPIRED', 'RECALLED');

-- CreateEnum
CREATE TYPE "FoodSafetyTraceEventType" AS ENUM ('RECEIPT', 'CONSUMPTION', 'PRODUCTION', 'TRANSFER', 'SHIPMENT', 'RETURN', 'DISPOSAL');

-- CreateEnum
CREATE TYPE "FoodSafetyRecallStatus" AS ENUM ('DRAFT', 'SIMULATION', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FoodSafetyRecallSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FoodSafetyRecallItemStatus" AS ENUM ('PENDING', 'NOTIFIED', 'RETURNED', 'DISPOSED', 'RELEASED');

-- CreateTable
CREATE TABLE "FoodSafetySupplier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT,
    "orgNodeId" TEXT,
    "responsibleUserId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "suppliedCategories" TEXT,
    "criticality" "FoodSafetySupplierCriticality" NOT NULL DEFAULT 'MEDIUM',
    "status" "FoodSafetySupplierStatus" NOT NULL DEFAULT 'PROSPECT',
    "score" DOUBLE PRECISION,
    "documentsStatus" TEXT,
    "lastAuditAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetySupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSafetyMaterial" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT,
    "supplierId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "category" "FoodSafetyMaterialCategory" NOT NULL DEFAULT 'RAW_MATERIAL',
    "unit" TEXT,
    "specification" TEXT,
    "storageCondition" TEXT,
    "allergens" TEXT,
    "hazards" TEXT,
    "requiredDocuments" TEXT,
    "shelfLifeDays" INTEGER,
    "status" "FoodSafetyMaterialStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSafetyLot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT,
    "materialId" TEXT,
    "supplierId" TEXT,
    "processId" TEXT,
    "code" TEXT NOT NULL,
    "type" "FoodSafetyLotType" NOT NULL DEFAULT 'RECEIVED',
    "status" "FoodSafetyLotStatus" NOT NULL DEFAULT 'QUARANTINED',
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "receivedAt" TIMESTAMP(3),
    "producedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "storageLocation" TEXT,
    "customerName" TEXT,
    "destination" TEXT,
    "certificateUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSafetyTraceLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromLotId" TEXT,
    "toLotId" TEXT,
    "processId" TEXT,
    "stepId" TEXT,
    "eventType" "FoodSafetyTraceEventType" NOT NULL DEFAULT 'PRODUCTION',
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyTraceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSafetyRecall" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT,
    "rootLotId" TEXT,
    "responsibleUserId" TEXT,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "severity" "FoodSafetyRecallSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "FoodSafetyRecallStatus" NOT NULL DEFAULT 'SIMULATION',
    "scopeDescription" TEXT,
    "affectedQuantity" DOUBLE PRECISION,
    "unit" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "actions" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyRecall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSafetyRecallItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "recallId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "status" "FoodSafetyRecallItemStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "disposition" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyRecallItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodSafetySupplier_companyId_idx" ON "FoodSafetySupplier"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetySupplier_programId_idx" ON "FoodSafetySupplier"("programId");

-- CreateIndex
CREATE INDEX "FoodSafetySupplier_orgNodeId_idx" ON "FoodSafetySupplier"("orgNodeId");

-- CreateIndex
CREATE INDEX "FoodSafetySupplier_status_idx" ON "FoodSafetySupplier"("status");

-- CreateIndex
CREATE INDEX "FoodSafetySupplier_criticality_idx" ON "FoodSafetySupplier"("criticality");

-- CreateIndex
CREATE UNIQUE INDEX "FoodSafetySupplier_companyId_code_key" ON "FoodSafetySupplier"("companyId", "code");

-- CreateIndex
CREATE INDEX "FoodSafetyMaterial_companyId_idx" ON "FoodSafetyMaterial"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyMaterial_programId_idx" ON "FoodSafetyMaterial"("programId");

-- CreateIndex
CREATE INDEX "FoodSafetyMaterial_supplierId_idx" ON "FoodSafetyMaterial"("supplierId");

-- CreateIndex
CREATE INDEX "FoodSafetyMaterial_category_idx" ON "FoodSafetyMaterial"("category");

-- CreateIndex
CREATE INDEX "FoodSafetyMaterial_status_idx" ON "FoodSafetyMaterial"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FoodSafetyMaterial_companyId_code_key" ON "FoodSafetyMaterial"("companyId", "code");

-- CreateIndex
CREATE INDEX "FoodSafetyLot_companyId_idx" ON "FoodSafetyLot"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyLot_programId_idx" ON "FoodSafetyLot"("programId");

-- CreateIndex
CREATE INDEX "FoodSafetyLot_materialId_idx" ON "FoodSafetyLot"("materialId");

-- CreateIndex
CREATE INDEX "FoodSafetyLot_supplierId_idx" ON "FoodSafetyLot"("supplierId");

-- CreateIndex
CREATE INDEX "FoodSafetyLot_processId_idx" ON "FoodSafetyLot"("processId");

-- CreateIndex
CREATE INDEX "FoodSafetyLot_status_idx" ON "FoodSafetyLot"("status");

-- CreateIndex
CREATE INDEX "FoodSafetyLot_type_idx" ON "FoodSafetyLot"("type");

-- CreateIndex
CREATE UNIQUE INDEX "FoodSafetyLot_companyId_code_key" ON "FoodSafetyLot"("companyId", "code");

-- CreateIndex
CREATE INDEX "FoodSafetyTraceLink_companyId_idx" ON "FoodSafetyTraceLink"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyTraceLink_fromLotId_idx" ON "FoodSafetyTraceLink"("fromLotId");

-- CreateIndex
CREATE INDEX "FoodSafetyTraceLink_toLotId_idx" ON "FoodSafetyTraceLink"("toLotId");

-- CreateIndex
CREATE INDEX "FoodSafetyTraceLink_processId_idx" ON "FoodSafetyTraceLink"("processId");

-- CreateIndex
CREATE INDEX "FoodSafetyTraceLink_eventType_idx" ON "FoodSafetyTraceLink"("eventType");

-- CreateIndex
CREATE INDEX "FoodSafetyRecall_companyId_idx" ON "FoodSafetyRecall"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyRecall_programId_idx" ON "FoodSafetyRecall"("programId");

-- CreateIndex
CREATE INDEX "FoodSafetyRecall_rootLotId_idx" ON "FoodSafetyRecall"("rootLotId");

-- CreateIndex
CREATE INDEX "FoodSafetyRecall_status_idx" ON "FoodSafetyRecall"("status");

-- CreateIndex
CREATE INDEX "FoodSafetyRecall_severity_idx" ON "FoodSafetyRecall"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "FoodSafetyRecall_companyId_code_key" ON "FoodSafetyRecall"("companyId", "code");

-- CreateIndex
CREATE INDEX "FoodSafetyRecallItem_companyId_idx" ON "FoodSafetyRecallItem"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyRecallItem_recallId_idx" ON "FoodSafetyRecallItem"("recallId");

-- CreateIndex
CREATE INDEX "FoodSafetyRecallItem_lotId_idx" ON "FoodSafetyRecallItem"("lotId");

-- CreateIndex
CREATE INDEX "FoodSafetyRecallItem_status_idx" ON "FoodSafetyRecallItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FoodSafetyRecallItem_recallId_lotId_key" ON "FoodSafetyRecallItem"("recallId", "lotId");

-- AddForeignKey
ALTER TABLE "FoodSafetySupplier" ADD CONSTRAINT "FoodSafetySupplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetySupplier" ADD CONSTRAINT "FoodSafetySupplier_programId_fkey" FOREIGN KEY ("programId") REFERENCES "FoodSafetyProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetySupplier" ADD CONSTRAINT "FoodSafetySupplier_orgNodeId_fkey" FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetySupplier" ADD CONSTRAINT "FoodSafetySupplier_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyMaterial" ADD CONSTRAINT "FoodSafetyMaterial_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyMaterial" ADD CONSTRAINT "FoodSafetyMaterial_programId_fkey" FOREIGN KEY ("programId") REFERENCES "FoodSafetyProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyMaterial" ADD CONSTRAINT "FoodSafetyMaterial_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "FoodSafetySupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyLot" ADD CONSTRAINT "FoodSafetyLot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyLot" ADD CONSTRAINT "FoodSafetyLot_programId_fkey" FOREIGN KEY ("programId") REFERENCES "FoodSafetyProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyLot" ADD CONSTRAINT "FoodSafetyLot_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "FoodSafetyMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyLot" ADD CONSTRAINT "FoodSafetyLot_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "FoodSafetySupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyLot" ADD CONSTRAINT "FoodSafetyLot_processId_fkey" FOREIGN KEY ("processId") REFERENCES "FoodSafetyProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyTraceLink" ADD CONSTRAINT "FoodSafetyTraceLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyTraceLink" ADD CONSTRAINT "FoodSafetyTraceLink_fromLotId_fkey" FOREIGN KEY ("fromLotId") REFERENCES "FoodSafetyLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyTraceLink" ADD CONSTRAINT "FoodSafetyTraceLink_toLotId_fkey" FOREIGN KEY ("toLotId") REFERENCES "FoodSafetyLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyTraceLink" ADD CONSTRAINT "FoodSafetyTraceLink_processId_fkey" FOREIGN KEY ("processId") REFERENCES "FoodSafetyProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyTraceLink" ADD CONSTRAINT "FoodSafetyTraceLink_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "FoodSafetyProcessStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyRecall" ADD CONSTRAINT "FoodSafetyRecall_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyRecall" ADD CONSTRAINT "FoodSafetyRecall_programId_fkey" FOREIGN KEY ("programId") REFERENCES "FoodSafetyProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyRecall" ADD CONSTRAINT "FoodSafetyRecall_rootLotId_fkey" FOREIGN KEY ("rootLotId") REFERENCES "FoodSafetyLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyRecall" ADD CONSTRAINT "FoodSafetyRecall_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyRecallItem" ADD CONSTRAINT "FoodSafetyRecallItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyRecallItem" ADD CONSTRAINT "FoodSafetyRecallItem_recallId_fkey" FOREIGN KEY ("recallId") REFERENCES "FoodSafetyRecall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyRecallItem" ADD CONSTRAINT "FoodSafetyRecallItem_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "FoodSafetyLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
