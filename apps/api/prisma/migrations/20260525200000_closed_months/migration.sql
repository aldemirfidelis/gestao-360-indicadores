-- Closed months: bloqueio mensal de lancamento de realizado por empresa.
CREATE TABLE "ClosedMonth" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodRef" TEXT NOT NULL,
    "reason" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClosedMonth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClosedMonth_companyId_periodRef_key" ON "ClosedMonth"("companyId", "periodRef");
CREATE INDEX "ClosedMonth_companyId_idx" ON "ClosedMonth"("companyId");

ALTER TABLE "ClosedMonth" ADD CONSTRAINT "ClosedMonth_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClosedMonth" ADD CONSTRAINT "ClosedMonth_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClosedMonth" ADD CONSTRAINT "ClosedMonth_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
