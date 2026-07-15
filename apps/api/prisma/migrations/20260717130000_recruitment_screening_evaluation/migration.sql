-- F4: triagem, scorecard, entrevistas/testes e IA assistiva do ATS.

CREATE TABLE "recruit_screening_questions" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "postingId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "type" TEXT NOT NULL DEFAULT 'TEXT',
  "question" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "knockout" BOOLEAN NOT NULL DEFAULT false,
  "desiredAnswer" JSONB,
  "options" JSONB,
  "weight" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_screening_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruit_screening_answers" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "answer" JSONB,
  "passed" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_screening_answers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruit_scorecard_criteria" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "postingId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "scaleMin" INTEGER NOT NULL DEFAULT 1,
  "scaleMax" INTEGER NOT NULL DEFAULT 5,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_scorecard_criteria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruit_evaluations" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "evaluatorId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "recommendation" TEXT,
  "summary" TEXT,
  "blindUntilSubmitted" BOOLEAN NOT NULL DEFAULT true,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruit_evaluation_ratings" (
  "id" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "criterionId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "comment" TEXT,
  "evidence" TEXT,
  CONSTRAINT "recruit_evaluation_ratings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruit_interviews" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'RH',
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "location" TEXT,
  "meetingUrl" TEXT,
  "instructions" TEXT,
  "createdById" TEXT,
  "organizerId" TEXT,
  "candidateName" TEXT,
  "candidateEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_interviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruit_interview_participants" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'INTERVIEWER',
  "required" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "recruit_interview_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruit_assessments" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'TECHNICAL_TEST',
  "title" TEXT NOT NULL,
  "instructions" TEXT,
  "dueAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
  "score" INTEGER,
  "resultNotes" TEXT,
  "createdById" TEXT,
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruit_ai_settings" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "sensitiveFiltering" BOOLEAN NOT NULL DEFAULT true,
  "modelPreference" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruit_ai_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruit_ai_analyses" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'rules',
  "model" TEXT,
  "promptVersion" TEXT NOT NULL,
  "criteria" JSONB,
  "evidence" JSONB,
  "missingRequirements" JSONB,
  "risks" JSONB,
  "summary" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "humanReviewRequired" BOOLEAN NOT NULL DEFAULT true,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "humanDecision" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recruit_ai_analyses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recruit_screening_questions_companyId_postingId_idx" ON "recruit_screening_questions"("companyId", "postingId");
CREATE UNIQUE INDEX "recruit_screening_answers_applicationId_questionId_key" ON "recruit_screening_answers"("applicationId", "questionId");
CREATE INDEX "recruit_screening_answers_companyId_applicationId_idx" ON "recruit_screening_answers"("companyId", "applicationId");
CREATE INDEX "recruit_scorecard_criteria_companyId_postingId_idx" ON "recruit_scorecard_criteria"("companyId", "postingId");
CREATE UNIQUE INDEX "recruit_evaluations_applicationId_evaluatorId_key" ON "recruit_evaluations"("applicationId", "evaluatorId");
CREATE INDEX "recruit_evaluations_companyId_applicationId_idx" ON "recruit_evaluations"("companyId", "applicationId");
CREATE UNIQUE INDEX "recruit_evaluation_ratings_evaluationId_criterionId_key" ON "recruit_evaluation_ratings"("evaluationId", "criterionId");
CREATE INDEX "recruit_interviews_companyId_startsAt_idx" ON "recruit_interviews"("companyId", "startsAt");
CREATE INDEX "recruit_interviews_applicationId_idx" ON "recruit_interviews"("applicationId");
CREATE UNIQUE INDEX "recruit_interview_participants_interviewId_userId_key" ON "recruit_interview_participants"("interviewId", "userId");
CREATE INDEX "recruit_interview_participants_userId_idx" ON "recruit_interview_participants"("userId");
CREATE INDEX "recruit_assessments_companyId_applicationId_idx" ON "recruit_assessments"("companyId", "applicationId");
CREATE UNIQUE INDEX "recruit_ai_settings_companyId_key" ON "recruit_ai_settings"("companyId");
CREATE INDEX "recruit_ai_analyses_companyId_applicationId_idx" ON "recruit_ai_analyses"("companyId", "applicationId");

ALTER TABLE "recruit_screening_questions" ADD CONSTRAINT "recruit_screening_questions_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "recruit_job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_screening_answers" ADD CONSTRAINT "recruit_screening_answers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_screening_answers" ADD CONSTRAINT "recruit_screening_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "recruit_screening_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_scorecard_criteria" ADD CONSTRAINT "recruit_scorecard_criteria_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "recruit_job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_evaluations" ADD CONSTRAINT "recruit_evaluations_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_evaluation_ratings" ADD CONSTRAINT "recruit_evaluation_ratings_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "recruit_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_evaluation_ratings" ADD CONSTRAINT "recruit_evaluation_ratings_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "recruit_scorecard_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_interviews" ADD CONSTRAINT "recruit_interviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_interview_participants" ADD CONSTRAINT "recruit_interview_participants_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "recruit_interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_assessments" ADD CONSTRAINT "recruit_assessments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruit_ai_analyses" ADD CONSTRAINT "recruit_ai_analyses_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "recruit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
