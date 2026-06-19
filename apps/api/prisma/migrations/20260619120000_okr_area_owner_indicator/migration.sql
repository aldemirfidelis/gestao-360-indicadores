-- AlterTable
ALTER TABLE "OKRObjective" ADD COLUMN     "ownerNodeId" TEXT,
ADD COLUMN     "ownerUserId" TEXT;

-- AlterTable
ALTER TABLE "KeyResult" ADD COLUMN     "indicatorId" TEXT;

-- CreateIndex
CREATE INDEX "OKRObjective_ownerNodeId_idx" ON "OKRObjective"("ownerNodeId");

-- CreateIndex
CREATE INDEX "OKRObjective_ownerUserId_idx" ON "OKRObjective"("ownerUserId");

-- CreateIndex
CREATE INDEX "KeyResult_indicatorId_idx" ON "KeyResult"("indicatorId");

-- AddForeignKey
ALTER TABLE "OKRObjective" ADD CONSTRAINT "OKRObjective_ownerNodeId_fkey" FOREIGN KEY ("ownerNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OKRObjective" ADD CONSTRAINT "OKRObjective_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
