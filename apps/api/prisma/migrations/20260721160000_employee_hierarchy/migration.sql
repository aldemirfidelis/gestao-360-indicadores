-- Hierarquia por cargo/pessoa: superior imediato do colaborador.
ALTER TABLE "OrgEmployee" ADD COLUMN "superiorEmployeeId" TEXT;
ALTER TABLE "OrgEmployee" ADD CONSTRAINT "OrgEmployee_superiorEmployeeId_fkey" FOREIGN KEY ("superiorEmployeeId") REFERENCES "OrgEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "OrgEmployee_superiorEmployeeId_idx" ON "OrgEmployee"("superiorEmployeeId");
