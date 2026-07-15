-- Recrutamento — Fase 2: vaga (posting) + pipeline (template/stages) + canais.
-- Aditiva.

CREATE TABLE IF NOT EXISTS "recruit_pipeline_templates" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_pipeline_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "recruit_pipeline_templates_companyId_idx" ON "recruit_pipeline_templates"("companyId");

CREATE TABLE IF NOT EXISTS "recruit_pipeline_stages" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'STANDARD',
  "config" JSONB,
  CONSTRAINT "recruit_pipeline_stages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "recruit_pipeline_stages_companyId_templateId_idx" ON "recruit_pipeline_stages"("companyId", "templateId");
ALTER TABLE "recruit_pipeline_stages" ADD CONSTRAINT "recruit_pipeline_stages_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "recruit_pipeline_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "recruit_job_postings" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "requisitionId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "publicDescription" TEXT,
  "publicRequirements" TEXT,
  "benefitsText" TEXT,
  "processStepsText" TEXT,
  "location" TEXT,
  "city" TEXT,
  "workMode" TEXT,
  "contractType" TEXT,
  "orgNodeId" TEXT,
  "areaName" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
  "pcd" BOOLEAN NOT NULL DEFAULT false,
  "showSalary" BOOLEAN NOT NULL DEFAULT false,
  "salaryText" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "closesAt" TIMESTAMP(3),
  "applicationLimit" INTEGER,
  "pipelineTemplateId" TEXT,
  "protectedSnapshot" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "recruit_job_postings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "recruit_job_postings_companyId_slug_key" ON "recruit_job_postings"("companyId", "slug");
CREATE INDEX IF NOT EXISTS "recruit_job_postings_companyId_status_idx" ON "recruit_job_postings"("companyId", "status");
CREATE INDEX IF NOT EXISTS "recruit_job_postings_companyId_requisitionId_idx" ON "recruit_job_postings"("companyId", "requisitionId");
ALTER TABLE "recruit_job_postings" ADD CONSTRAINT "recruit_job_postings_pipelineTemplateId_fkey"
  FOREIGN KEY ("pipelineTemplateId") REFERENCES "recruit_pipeline_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "recruit_posting_channels" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "postingId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "externalUrl" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recruit_posting_channels_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "recruit_posting_channels_companyId_postingId_idx" ON "recruit_posting_channels"("companyId", "postingId");
ALTER TABLE "recruit_posting_channels" ADD CONSTRAINT "recruit_posting_channels_postingId_fkey"
  FOREIGN KEY ("postingId") REFERENCES "recruit_job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
