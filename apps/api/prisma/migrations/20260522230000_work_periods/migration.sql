-- Annual working periods for Gestao 360.
CREATE TYPE "WorkPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');

CREATE TABLE "WorkPeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "WorkPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WorkPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkPeriod_companyId_year_key" ON "WorkPeriod"("companyId", "year");
CREATE UNIQUE INDEX "WorkPeriod_one_current_per_company_idx" ON "WorkPeriod"("companyId") WHERE "isCurrent" = true AND "deletedAt" IS NULL;
CREATE INDEX "WorkPeriod_companyId_isCurrent_idx" ON "WorkPeriod"("companyId", "isCurrent");
CREATE INDEX "WorkPeriod_companyId_status_idx" ON "WorkPeriod"("companyId", "status");

ALTER TABLE "WorkPeriod" ADD CONSTRAINT "WorkPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
