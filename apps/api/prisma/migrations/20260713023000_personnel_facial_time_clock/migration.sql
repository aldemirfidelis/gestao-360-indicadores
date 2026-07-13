ALTER TABLE "time_clock_entries" ADD COLUMN "biometricAttemptId" TEXT;

CREATE TABLE "personnel_biometric_profiles" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "descriptorEnc" TEXT NOT NULL,
  "descriptorVersion" TEXT NOT NULL DEFAULT 'face-api-128-v1',
  "sampleCount" INTEGER NOT NULL DEFAULT 3,
  "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.48,
  "legalBasis" TEXT NOT NULL,
  "privacyNoticeHash" TEXT NOT NULL,
  "consentAt" TIMESTAMP(3) NOT NULL,
  "consentById" TEXT NOT NULL,
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastVerifiedAt" TIMESTAMP(3),
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "revocationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "personnel_biometric_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "personnel_biometric_profiles_companyId_userId_key" ON "personnel_biometric_profiles"("companyId", "userId");
CREATE INDEX "personnel_biometric_profiles_companyId_status_idx" ON "personnel_biometric_profiles"("companyId", "status");

CREATE TABLE "personnel_biometric_challenges" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "livenessAction" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "personnel_biometric_challenges_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "personnel_biometric_challenges_companyId_userId_purpose_expiresAt_idx" ON "personnel_biometric_challenges"("companyId", "userId", "purpose", "expiresAt");

CREATE TABLE "personnel_biometric_attempts" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "distance" DOUBLE PRECISION,
  "threshold" DOUBLE PRECISION,
  "livenessAction" TEXT,
  "livenessPassed" BOOLEAN NOT NULL DEFAULT false,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "accuracy" DOUBLE PRECISION,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "personnel_biometric_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "personnel_biometric_attempts_companyId_userId_createdAt_idx" ON "personnel_biometric_attempts"("companyId", "userId", "createdAt");
CREATE INDEX "personnel_biometric_attempts_challengeId_idx" ON "personnel_biometric_attempts"("challengeId");
