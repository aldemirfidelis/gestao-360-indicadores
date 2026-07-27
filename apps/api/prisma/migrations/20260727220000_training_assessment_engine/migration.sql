-- =====================================================================
-- T&D — Avaliacao de aprendizagem aplicada pelo portal
--
-- Migracao ADITIVA. A nota minima continua no proprio treinamento: nao existem
-- dois lugares definindo aprovacao.
-- =====================================================================

CREATE TYPE "TrainingQuestionType" AS ENUM ('SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'TEXT');
CREATE TYPE "TrainingAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "training_assessments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "timeLimitMinutes" INTEGER,
    "questionCount" INTEGER,
    "randomizeQuestions" BOOLEAN NOT NULL DEFAULT true,
    "randomizeOptions" BOOLEAN NOT NULL DEFAULT true,
    "showResult" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "training_assessments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "training_assessments_trainingId_key" ON "training_assessments"("trainingId");
CREATE INDEX "training_assessments_companyId_active_idx" ON "training_assessments"("companyId", "active");
ALTER TABLE "training_assessments" ADD CONSTRAINT "training_assessments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_assessments" ADD CONSTRAINT "training_assessments_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "training_assessment_questions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "type" "TrainingQuestionType" NOT NULL DEFAULT 'SINGLE',
    "points" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "explanation" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_assessment_questions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_assessment_questions_assessmentId_active_idx" ON "training_assessment_questions"("assessmentId", "active");
ALTER TABLE "training_assessment_questions" ADD CONSTRAINT "training_assessment_questions_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "training_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "training_assessment_options" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "training_assessment_options_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_assessment_options_questionId_idx" ON "training_assessment_options"("questionId");
ALTER TABLE "training_assessment_options" ADD CONSTRAINT "training_assessment_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "training_assessment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "training_assessment_attempts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "employeeId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "TrainingAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "score" DECIMAL(5,2),
    "maxScore" INTEGER,
    "passed" BOOLEAN,
    "gradedById" TEXT,
    "questionOrder" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_assessment_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_assessment_attempts_companyId_status_idx" ON "training_assessment_attempts"("companyId", "status");
CREATE INDEX "training_assessment_attempts_employeeId_idx" ON "training_assessment_attempts"("employeeId");
CREATE INDEX "training_assessment_attempts_assignmentId_idx" ON "training_assessment_attempts"("assignmentId");
ALTER TABLE "training_assessment_attempts" ADD CONSTRAINT "training_assessment_attempts_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "training_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_assessment_attempts" ADD CONSTRAINT "training_assessment_attempts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "OrgEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "training_assessment_answers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionIds" JSONB,
    "text" TEXT,
    "correct" BOOLEAN,
    "points" INTEGER NOT NULL DEFAULT 0,
    "gradedById" TEXT,
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_assessment_answers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "training_assessment_answers_attemptId_questionId_key" ON "training_assessment_answers"("attemptId", "questionId");
ALTER TABLE "training_assessment_answers" ADD CONSTRAINT "training_assessment_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "training_assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_assessment_answers" ADD CONSTRAINT "training_assessment_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "training_assessment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
