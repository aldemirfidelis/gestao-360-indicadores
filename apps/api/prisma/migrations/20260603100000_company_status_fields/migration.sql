-- Multiempresa: status e dados cadastrais da empresa + flag de acesso por área.

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "areaAccessEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "maxUsers" INTEGER,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "segment" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill: empresas previamente inativadas (active=false) viram INACTIVE.
UPDATE "Company" SET "status" = 'INACTIVE' WHERE "active" = false;
