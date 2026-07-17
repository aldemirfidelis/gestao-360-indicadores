-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SecurityRecordOrigin" ADD VALUE 'LPR';
ALTER TYPE "SecurityRecordOrigin" ADD VALUE 'TOTEM';
ALTER TYPE "SecurityRecordOrigin" ADD VALUE 'FACIAL';
ALTER TYPE "SecurityRecordOrigin" ADD VALUE 'BIOMETRIC';

-- AlterTable
ALTER TABLE "SecurityPackageActivation" ADD COLUMN     "antiPassback" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SecurityGate" ADD COLUMN     "personCapacity" INTEGER,
ADD COLUMN     "vehicleCapacity" INTEGER;

-- AlterTable
ALTER TABLE "SecurityPerson" ADD COLUMN     "biometricRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "facialId" TEXT,
ADD COLUMN     "integrationSource" TEXT,
ADD COLUMN     "pinCode" TEXT,
ADD COLUMN     "rfidCardNumber" TEXT;

-- AlterTable
ALTER TABLE "SecurityVehicle" ADD COLUMN     "lprRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rfidTagNumber" TEXT;

-- AlterTable
ALTER TABLE "SecurityAccessMovement" ADD COLUMN     "currentAreaId" TEXT;

-- AlterTable
ALTER TABLE "SecurityIncident" ADD COLUMN     "checkpointId" TEXT;

-- CreateTable
CREATE TABLE "SecurityEquipment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "gateId" TEXT,
    "postId" TEXT,
    "areaId" TEXT,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "name" TEXT NOT NULL,
    "status" "SecurityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastPingAt" TIMESTAMP(3),
    "hardwareVersion" TEXT,
    "firmwareVersion" TEXT,
    "settings" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SecurityEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityEquipment_companyId_idx" ON "SecurityEquipment"("companyId");

-- CreateIndex
CREATE INDEX "SecurityEquipment_gateId_idx" ON "SecurityEquipment"("gateId");

-- CreateIndex
CREATE INDEX "SecurityEquipment_postId_idx" ON "SecurityEquipment"("postId");

