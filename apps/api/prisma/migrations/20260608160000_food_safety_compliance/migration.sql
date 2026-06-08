-- CreateEnum
CREATE TYPE "FoodSafetyStandardVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "FoodSafetyComplianceResult" AS ENUM ('PENDING', 'MET', 'PARTIAL', 'NOT_MET', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "FoodSafetyRequirementCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "FoodSafetyStandard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "origin" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSafetyStandardVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "status" "FoodSafetyStandardVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyStandardVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSafetyRequirement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "standardVersionId" TEXT NOT NULL,
    "responsibleUserId" TEXT,
    "code" TEXT,
    "chapter" TEXT,
    "item" TEXT,
    "subitem" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "applicability" TEXT,
    "evidenceRequired" TEXT,
    "criticality" "FoodSafetyRequirementCriticality" NOT NULL DEFAULT 'MEDIUM',
    "periodicityDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSafetyRequirementAssessment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "responsibleUserId" TEXT,
    "result" "FoodSafetyComplianceResult" NOT NULL DEFAULT 'PENDING',
    "evidence" TEXT,
    "notes" TEXT,
    "assessedAt" TIMESTAMP(3),
    "nextAssessmentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FoodSafetyRequirementAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodSafetyStandard_companyId_idx" ON "FoodSafetyStandard"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyStandardVersion_companyId_idx" ON "FoodSafetyStandardVersion"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyStandardVersion_standardId_idx" ON "FoodSafetyStandardVersion"("standardId");

-- CreateIndex
CREATE INDEX "FoodSafetyRequirement_companyId_idx" ON "FoodSafetyRequirement"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyRequirement_standardVersionId_idx" ON "FoodSafetyRequirement"("standardVersionId");

-- CreateIndex
CREATE INDEX "FoodSafetyRequirementAssessment_companyId_idx" ON "FoodSafetyRequirementAssessment"("companyId");

-- CreateIndex
CREATE INDEX "FoodSafetyRequirementAssessment_requirementId_idx" ON "FoodSafetyRequirementAssessment"("requirementId");

-- CreateIndex
CREATE INDEX "FoodSafetyRequirementAssessment_result_idx" ON "FoodSafetyRequirementAssessment"("result");

-- AddForeignKey
ALTER TABLE "FoodSafetyStandard" ADD CONSTRAINT "FoodSafetyStandard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyStandardVersion" ADD CONSTRAINT "FoodSafetyStandardVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyStandardVersion" ADD CONSTRAINT "FoodSafetyStandardVersion_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "FoodSafetyStandard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyRequirement" ADD CONSTRAINT "FoodSafetyRequirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyRequirement" ADD CONSTRAINT "FoodSafetyRequirement_standardVersionId_fkey" FOREIGN KEY ("standardVersionId") REFERENCES "FoodSafetyStandardVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyRequirement" ADD CONSTRAINT "FoodSafetyRequirement_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyRequirementAssessment" ADD CONSTRAINT "FoodSafetyRequirementAssessment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyRequirementAssessment" ADD CONSTRAINT "FoodSafetyRequirementAssessment_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "FoodSafetyRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodSafetyRequirementAssessment" ADD CONSTRAINT "FoodSafetyRequirementAssessment_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

