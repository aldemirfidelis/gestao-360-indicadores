-- AlterTable
ALTER TABLE "personnel_employee_profiles" ADD COLUMN     "photoMimeType" TEXT,
ADD COLUMN     "photoStorageKey" TEXT,
ADD COLUMN     "photoUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "personnel_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "autoGenerateRegistration" BOOLEAN NOT NULL DEFAULT true,
    "allowManualRegistration" BOOLEAN NOT NULL DEFAULT true,
    "registrationPrefix" TEXT NOT NULL DEFAULT '',
    "registrationSuffix" TEXT NOT NULL DEFAULT '',
    "registrationWidth" INTEGER NOT NULL DEFAULT 5,
    "registrationPadChar" TEXT NOT NULL DEFAULT '0',
    "registrationNextSequence" INTEGER NOT NULL DEFAULT 1,
    "badgeAccentColor" TEXT NOT NULL DEFAULT '#0ea5e9',
    "badgeOrientation" TEXT NOT NULL DEFAULT 'PORTRAIT',
    "badgeShowPhoto" BOOLEAN NOT NULL DEFAULT true,
    "badgeShowQr" BOOLEAN NOT NULL DEFAULT true,
    "badgeShowJob" BOOLEAN NOT NULL DEFAULT true,
    "badgeShowAdmission" BOOLEAN NOT NULL DEFAULT false,
    "badgeShowRegistration" BOOLEAN NOT NULL DEFAULT true,
    "badgeFooterText" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personnel_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personnel_settings_companyId_key" ON "personnel_settings"("companyId");

