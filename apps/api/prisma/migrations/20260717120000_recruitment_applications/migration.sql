-- CreateTable
CREATE TABLE "recruit_candidates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT,
    "headline" TEXT,
    "city" TEXT,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "profileData" JSONB,
    "emailVerifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "recruit_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruit_candidate_otps" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruit_candidate_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruit_applications" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "postingId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "requisitionId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'CARREIRAS',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentStageId" TEXT,
    "coverLetter" TEXT,
    "answers" JSONB,
    "score" INTEGER,
    "rejectionReason" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "recruit_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruit_application_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT,
    "note" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruit_application_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruit_candidate_documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "scanStatus" TEXT NOT NULL DEFAULT 'SKIPPED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "recruit_candidate_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruit_consents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT,
    "purpose" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "ip" TEXT,
    "userAgent" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "recruit_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruit_data_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "details" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "recruit_data_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recruit_candidates_companyId_status_idx" ON "recruit_candidates"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "recruit_candidates_companyId_emailNormalized_key" ON "recruit_candidates"("companyId", "emailNormalized");

-- CreateIndex
CREATE INDEX "recruit_candidate_otps_candidateId_purpose_idx" ON "recruit_candidate_otps"("candidateId", "purpose");

-- CreateIndex
CREATE INDEX "recruit_applications_companyId_status_idx" ON "recruit_applications"("companyId", "status");

-- CreateIndex
CREATE INDEX "recruit_applications_postingId_currentStageId_idx" ON "recruit_applications"("postingId", "currentStageId");

-- CreateIndex
CREATE UNIQUE INDEX "recruit_applications_postingId_candidateId_key" ON "recruit_applications"("postingId", "candidateId");

-- CreateIndex
CREATE INDEX "recruit_application_events_applicationId_idx" ON "recruit_application_events"("applicationId");

-- CreateIndex
CREATE INDEX "recruit_candidate_documents_candidateId_idx" ON "recruit_candidate_documents"("candidateId");

-- CreateIndex
CREATE INDEX "recruit_candidate_documents_applicationId_idx" ON "recruit_candidate_documents"("applicationId");

-- CreateIndex
CREATE INDEX "recruit_consents_candidateId_idx" ON "recruit_consents"("candidateId");

-- CreateIndex
CREATE INDEX "recruit_data_requests_companyId_status_idx" ON "recruit_data_requests"("companyId", "status");

-- AddForeignKey
ALTER TABLE "recruit_candidate_otps" ADD CONSTRAINT "recruit_candidate_otps_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "recruit_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruit_applications" ADD CONSTRAINT "recruit_applications_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "recruit_job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruit_applications" ADD CONSTRAINT "recruit_applications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "recruit_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruit_applications" ADD CONSTRAINT "recruit_applications_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "recruit_pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruit_application_events" ADD CONSTRAINT "recruit_application_events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruit_candidate_documents" ADD CONSTRAINT "recruit_candidate_documents_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "recruit_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruit_candidate_documents" ADD CONSTRAINT "recruit_candidate_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruit_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruit_consents" ADD CONSTRAINT "recruit_consents_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "recruit_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruit_consents" ADD CONSTRAINT "recruit_consents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruit_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruit_data_requests" ADD CONSTRAINT "recruit_data_requests_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "recruit_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

