-- CreateEnum
CREATE TYPE "ProcessArtifactKind" AS ENUM ('SIPOC', 'BPMN', 'RACI');

-- CreateEnum
CREATE TYPE "ProcessArtifactState" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProcessScenario" AS ENUM ('AS_IS', 'TO_BE');

-- CreateEnum
CREATE TYPE "ProcessRaciRole" AS ENUM ('R', 'A', 'C', 'I');

-- CreateTable
CREATE TABLE "ProcessArtifact" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "kind" "ProcessArtifactKind" NOT NULL,
    "name" TEXT NOT NULL,
    "scenario" "ProcessScenario" NOT NULL DEFAULT 'AS_IS',
    "state" "ProcessArtifactState" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL DEFAULT '{}',
    "bpmnXml" TEXT,
    "reviewDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessArtifactVersion" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "state" "ProcessArtifactState" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeNote" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessArtifactVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessActivity" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "elementType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orgNodeId" TEXT,
    "ownerUserId" TEXT,
    "orgJobId" TEXT,
    "expectedMinutes" INTEGER,
    "slaMinutes" INTEGER,
    "systems" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessRaciRow" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "activityId" TEXT,
    "processStepId" TEXT,
    "projectTaskId" TEXT,
    "workspaceTaskId" TEXT,
    "actionPlanId" TEXT,

    CONSTRAINT "ProcessRaciRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessRaciAssignment" (
    "id" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "role" "ProcessRaciRole" NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "userId" TEXT,
    "orgNodeId" TEXT,
    "orgJobId" TEXT,
    "subjectSnapshot" JSONB NOT NULL,

    CONSTRAINT "ProcessRaciAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessIntegration" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "activityId" TEXT,
    "artifactId" TEXT,
    "scopeKey" TEXT NOT NULL DEFAULT 'PROCESS',
    "targetKey" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indicatorId" TEXT,
    "projectId" TEXT,
    "projectTaskId" TEXT,
    "workspaceTaskId" TEXT,
    "actionPlanId" TEXT,
    "deviationId" TEXT,
    "documentId" TEXT,
    "formTemplateId" TEXT,
    "riskId" TEXT,
    "auditId" TEXT,
    "trainingId" TEXT,
    "meetingId" TEXT,
    "objectiveId" TEXT,
    "relatedProcessId" TEXT,
    "orgNodeId" TEXT,

    CONSTRAINT "ProcessIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessArtifact_processId_kind_state_idx" ON "ProcessArtifact"("processId", "kind", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessArtifactVersion_artifactId_version_key" ON "ProcessArtifactVersion"("artifactId", "version");

-- CreateIndex
CREATE INDEX "ProcessActivity_processId_active_idx" ON "ProcessActivity"("processId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessActivity_artifactId_elementId_key" ON "ProcessActivity"("artifactId", "elementId");

-- CreateIndex
CREATE INDEX "ProcessRaciRow_artifactId_position_idx" ON "ProcessRaciRow"("artifactId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessRaciAssignment_rowId_subjectKey_role_key" ON "ProcessRaciAssignment"("rowId", "subjectKey", "role");

-- CreateIndex
CREATE INDEX "ProcessIntegration_indicatorId_idx" ON "ProcessIntegration"("indicatorId");

-- CreateIndex
CREATE INDEX "ProcessIntegration_projectId_idx" ON "ProcessIntegration"("projectId");

-- CreateIndex
CREATE INDEX "ProcessIntegration_projectTaskId_idx" ON "ProcessIntegration"("projectTaskId");

-- CreateIndex
CREATE INDEX "ProcessIntegration_actionPlanId_idx" ON "ProcessIntegration"("actionPlanId");

-- CreateIndex
CREATE INDEX "ProcessIntegration_deviationId_idx" ON "ProcessIntegration"("deviationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessIntegration_processId_scopeKey_targetKey_key" ON "ProcessIntegration"("processId", "scopeKey", "targetKey");

-- AddForeignKey
ALTER TABLE "ProcessArtifact" ADD CONSTRAINT "ProcessArtifact_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessArtifactVersion" ADD CONSTRAINT "ProcessArtifactVersion_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ProcessArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessArtifactVersion" ADD CONSTRAINT "ProcessArtifactVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessActivity" ADD CONSTRAINT "ProcessActivity_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessActivity" ADD CONSTRAINT "ProcessActivity_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ProcessArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessActivity" ADD CONSTRAINT "ProcessActivity_orgNodeId_fkey" FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessActivity" ADD CONSTRAINT "ProcessActivity_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessActivity" ADD CONSTRAINT "ProcessActivity_orgJobId_fkey" FOREIGN KEY ("orgJobId") REFERENCES "OrgJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRaciRow" ADD CONSTRAINT "ProcessRaciRow_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ProcessArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRaciRow" ADD CONSTRAINT "ProcessRaciRow_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ProcessActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRaciRow" ADD CONSTRAINT "ProcessRaciRow_processStepId_fkey" FOREIGN KEY ("processStepId") REFERENCES "ProcessStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRaciRow" ADD CONSTRAINT "ProcessRaciRow_projectTaskId_fkey" FOREIGN KEY ("projectTaskId") REFERENCES "ProjectTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRaciRow" ADD CONSTRAINT "ProcessRaciRow_workspaceTaskId_fkey" FOREIGN KEY ("workspaceTaskId") REFERENCES "WorkspaceTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRaciRow" ADD CONSTRAINT "ProcessRaciRow_actionPlanId_fkey" FOREIGN KEY ("actionPlanId") REFERENCES "ActionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRaciAssignment" ADD CONSTRAINT "ProcessRaciAssignment_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "ProcessRaciRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRaciAssignment" ADD CONSTRAINT "ProcessRaciAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRaciAssignment" ADD CONSTRAINT "ProcessRaciAssignment_orgNodeId_fkey" FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRaciAssignment" ADD CONSTRAINT "ProcessRaciAssignment_orgJobId_fkey" FOREIGN KEY ("orgJobId") REFERENCES "OrgJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ProcessActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ProcessArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_projectTaskId_fkey" FOREIGN KEY ("projectTaskId") REFERENCES "ProjectTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_workspaceTaskId_fkey" FOREIGN KEY ("workspaceTaskId") REFERENCES "WorkspaceTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_actionPlanId_fkey" FOREIGN KEY ("actionPlanId") REFERENCES "ActionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "Deviation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_formTemplateId_fkey" FOREIGN KEY ("formTemplateId") REFERENCES "FormTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "RiskRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "StrategicObjective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_relatedProcessId_fkey" FOREIGN KEY ("relatedProcessId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_orgNodeId_fkey" FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_one_target_check" CHECK (num_nonnulls("indicatorId","projectId","projectTaskId","workspaceTaskId","actionPlanId","deviationId","documentId","formTemplateId","riskId","auditId","trainingId","meetingId","objectiveId","relatedProcessId","orgNodeId") = 1);
ALTER TABLE "ProcessIntegration" ADD CONSTRAINT "ProcessIntegration_scope_check" CHECK ("scopeKey" = COALESCE("activityId", 'ARTIFACT:' || "artifactId", 'PROCESS'));
ALTER TABLE "ProcessRaciAssignment" ADD CONSTRAINT "ProcessRaciAssignment_one_subject_check" CHECK (num_nonnulls("userId","orgNodeId","orgJobId") = 1);
ALTER TABLE "ProcessRaciRow" ADD CONSTRAINT "ProcessRaciRow_one_target_check" CHECK (num_nonnulls("activityId","processStepId","projectTaskId","workspaceTaskId","actionPlanId") <= 1);
ALTER TABLE "ProcessArtifact" ADD CONSTRAINT "ProcessArtifact_revision_check" CHECK (revision > 0 AND version >= 0);
