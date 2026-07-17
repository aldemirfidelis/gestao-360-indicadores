-- AlterTable
ALTER TABLE "personnel_employee_profiles" ADD COLUMN     "allowPortalPunch" BOOLEAN;

-- AlterTable
ALTER TABLE "personnel_settings" ADD COLUMN     "portalPunchDefault" BOOLEAN NOT NULL DEFAULT true;

