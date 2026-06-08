-- CreateTable
CREATE TABLE "RelationshipLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "targetEntityType" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'DIRECT',
    "criticality" TEXT NOT NULL DEFAULT 'MEDIUM',
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "originType" TEXT NOT NULL DEFAULT 'MANUAL',
    "originReference" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RelationshipLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactAnalysis" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "previousValues" TEXT,
    "newValues" TEXT,
    "impactLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "affectedRecordsCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "justification" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "ImpactAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactAnalysisItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "impactAnalysisId" TEXT NOT NULL,
    "affectedEntityType" TEXT NOT NULL,
    "affectedEntityId" TEXT NOT NULL,
    "relationshipPath" TEXT,
    "impactReason" TEXT,
    "impactLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "recommendedAction" TEXT,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "requiresTask" BOOLEAN NOT NULL DEFAULT false,
    "responsibleUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactAnalysisItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationshipAuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousValues" TEXT,
    "newValues" TEXT,
    "performedById" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "notes" TEXT,

    CONSTRAINT "RelationshipAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'COMPANY',
    "scopeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeVersionId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workflowDefinitionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "canvasData" TEXT NOT NULL,
    "configurationSnapshot" TEXT NOT NULL,
    "changeSummary" TEXT,
    "createdById" TEXT,
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowNode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL,
    "nodeKey" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "blockType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "configuration" TEXT NOT NULL,
    "inputSchema" TEXT,
    "outputSchema" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEdge" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL,
    "sourceNodeKey" TEXT NOT NULL,
    "targetNodeKey" TEXT NOT NULL,
    "sourceHandle" TEXT,
    "targetHandle" TEXT,
    "conditionLabel" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workflowDefinitionId" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "currentState" TEXT NOT NULL DEFAULT '{}',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowNodeExecution" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "nodeKey" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "inputData" TEXT,
    "outputData" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowNodeExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventPayload" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTimer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "nodeKey" TEXT NOT NULL,
    "timerType" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowTimer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowApproval" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "nodeKey" TEXT NOT NULL,
    "approvalType" TEXT NOT NULL,
    "requesterId" TEXT,
    "approverId" TEXT,
    "approverGroupId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decision" TEXT,
    "comments" TEXT,
    "dueAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTask" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "nodeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'OPERATIONAL',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "criticity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "responsibleId" TEXT,
    "responsibleSubstituteId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "requiredEvidence" BOOLEAN NOT NULL DEFAULT false,
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "originType" TEXT,
    "originId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "templateData" TEXT NOT NULL,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecutionLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "nodeExecutionId" TEXT,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDeadLetter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "nodeExecutionId" TEXT,
    "errorType" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UNRESOLVED',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowDeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowIntegration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "integrationType" TEXT NOT NULL,
    "configurationReference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelationshipLink_companyId_idx" ON "RelationshipLink"("companyId");

-- CreateIndex
CREATE INDEX "RelationshipLink_sourceEntityType_sourceEntityId_idx" ON "RelationshipLink"("sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE INDEX "RelationshipLink_targetEntityType_targetEntityId_idx" ON "RelationshipLink"("targetEntityType", "targetEntityId");

-- CreateIndex
CREATE INDEX "ImpactAnalysis_companyId_idx" ON "ImpactAnalysis"("companyId");

-- CreateIndex
CREATE INDEX "ImpactAnalysis_sourceEntityType_sourceEntityId_idx" ON "ImpactAnalysis"("sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE INDEX "ImpactAnalysisItem_companyId_idx" ON "ImpactAnalysisItem"("companyId");

-- CreateIndex
CREATE INDEX "ImpactAnalysisItem_impactAnalysisId_idx" ON "ImpactAnalysisItem"("impactAnalysisId");

-- CreateIndex
CREATE INDEX "ImpactAnalysisItem_affectedEntityType_affectedEntityId_idx" ON "ImpactAnalysisItem"("affectedEntityType", "affectedEntityId");

-- CreateIndex
CREATE INDEX "RelationshipAuditLog_companyId_idx" ON "RelationshipAuditLog"("companyId");

-- CreateIndex
CREATE INDEX "RelationshipAuditLog_entityType_entityId_idx" ON "RelationshipAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "WorkflowDefinition_companyId_idx" ON "WorkflowDefinition"("companyId");

-- CreateIndex
CREATE INDEX "WorkflowDefinition_status_idx" ON "WorkflowDefinition"("status");

-- CreateIndex
CREATE INDEX "WorkflowVersion_companyId_idx" ON "WorkflowVersion"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVersion_workflowDefinitionId_versionNumber_key" ON "WorkflowVersion"("workflowDefinitionId", "versionNumber");

-- CreateIndex
CREATE INDEX "WorkflowNode_companyId_idx" ON "WorkflowNode"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowNode_workflowVersionId_nodeKey_key" ON "WorkflowNode"("workflowVersionId", "nodeKey");

-- CreateIndex
CREATE INDEX "WorkflowEdge_companyId_idx" ON "WorkflowEdge"("companyId");

-- CreateIndex
CREATE INDEX "WorkflowEdge_workflowVersionId_idx" ON "WorkflowEdge"("workflowVersionId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_companyId_idx" ON "WorkflowInstance"("companyId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_status_idx" ON "WorkflowInstance"("status");

-- CreateIndex
CREATE INDEX "WorkflowInstance_sourceEntityType_sourceEntityId_idx" ON "WorkflowInstance"("sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE INDEX "WorkflowNodeExecution_companyId_idx" ON "WorkflowNodeExecution"("companyId");

-- CreateIndex
CREATE INDEX "WorkflowNodeExecution_workflowInstanceId_nodeKey_idx" ON "WorkflowNodeExecution"("workflowInstanceId", "nodeKey");

-- CreateIndex
CREATE INDEX "WorkflowNodeExecution_status_idx" ON "WorkflowNodeExecution"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowEvent_idempotencyKey_key" ON "WorkflowEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WorkflowEvent_companyId_idx" ON "WorkflowEvent"("companyId");

-- CreateIndex
CREATE INDEX "WorkflowEvent_status_idx" ON "WorkflowEvent"("status");

-- CreateIndex
CREATE INDEX "WorkflowTimer_companyId_idx" ON "WorkflowTimer"("companyId");

-- CreateIndex
CREATE INDEX "WorkflowTimer_status_scheduledAt_idx" ON "WorkflowTimer"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "WorkflowTimer_workflowInstanceId_idx" ON "WorkflowTimer"("workflowInstanceId");

-- CreateIndex
CREATE INDEX "WorkflowApproval_companyId_idx" ON "WorkflowApproval"("companyId");

-- CreateIndex
CREATE INDEX "WorkflowApproval_status_idx" ON "WorkflowApproval"("status");

-- CreateIndex
CREATE INDEX "WorkflowApproval_workflowInstanceId_idx" ON "WorkflowApproval"("workflowInstanceId");

-- CreateIndex
CREATE INDEX "WorkflowApproval_approverId_idx" ON "WorkflowApproval"("approverId");

-- CreateIndex
CREATE INDEX "WorkflowTask_companyId_idx" ON "WorkflowTask"("companyId");

-- CreateIndex
CREATE INDEX "WorkflowTask_status_idx" ON "WorkflowTask"("status");

-- CreateIndex
CREATE INDEX "WorkflowTask_workflowInstanceId_idx" ON "WorkflowTask"("workflowInstanceId");

-- CreateIndex
CREATE INDEX "WorkflowTask_responsibleId_idx" ON "WorkflowTask"("responsibleId");

-- CreateIndex
CREATE INDEX "WorkflowTemplate_companyId_idx" ON "WorkflowTemplate"("companyId");

-- CreateIndex
CREATE INDEX "WorkflowTemplate_status_idx" ON "WorkflowTemplate"("status");

-- CreateIndex
CREATE INDEX "WorkflowExecutionLog_companyId_idx" ON "WorkflowExecutionLog"("companyId");

-- CreateIndex
CREATE INDEX "WorkflowExecutionLog_workflowInstanceId_idx" ON "WorkflowExecutionLog"("workflowInstanceId");

-- CreateIndex
CREATE INDEX "WorkflowDeadLetter_companyId_idx" ON "WorkflowDeadLetter"("companyId");

-- CreateIndex
CREATE INDEX "WorkflowDeadLetter_status_idx" ON "WorkflowDeadLetter"("status");

-- CreateIndex
CREATE INDEX "WorkflowIntegration_companyId_idx" ON "WorkflowIntegration"("companyId");

-- AddForeignKey
ALTER TABLE "RelationshipLink" ADD CONSTRAINT "RelationshipLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipLink" ADD CONSTRAINT "RelationshipLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactAnalysis" ADD CONSTRAINT "ImpactAnalysis_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactAnalysis" ADD CONSTRAINT "ImpactAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactAnalysis" ADD CONSTRAINT "ImpactAnalysis_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactAnalysisItem" ADD CONSTRAINT "ImpactAnalysisItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactAnalysisItem" ADD CONSTRAINT "ImpactAnalysisItem_impactAnalysisId_fkey" FOREIGN KEY ("impactAnalysisId") REFERENCES "ImpactAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactAnalysisItem" ADD CONSTRAINT "ImpactAnalysisItem_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipAuditLog" ADD CONSTRAINT "RelationshipAuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipAuditLog" ADD CONSTRAINT "RelationshipAuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEdge" ADD CONSTRAINT "WorkflowEdge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEdge" ADD CONSTRAINT "WorkflowEdge_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNodeExecution" ADD CONSTRAINT "WorkflowNodeExecution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNodeExecution" ADD CONSTRAINT "WorkflowNodeExecution_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTimer" ADD CONSTRAINT "WorkflowTimer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTimer" ADD CONSTRAINT "WorkflowTimer_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowApproval" ADD CONSTRAINT "WorkflowApproval_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowApproval" ADD CONSTRAINT "WorkflowApproval_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowApproval" ADD CONSTRAINT "WorkflowApproval_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowApproval" ADD CONSTRAINT "WorkflowApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_responsibleSubstituteId_fkey" FOREIGN KEY ("responsibleSubstituteId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecutionLog" ADD CONSTRAINT "WorkflowExecutionLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecutionLog" ADD CONSTRAINT "WorkflowExecutionLog_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecutionLog" ADD CONSTRAINT "WorkflowExecutionLog_nodeExecutionId_fkey" FOREIGN KEY ("nodeExecutionId") REFERENCES "WorkflowNodeExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDeadLetter" ADD CONSTRAINT "WorkflowDeadLetter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDeadLetter" ADD CONSTRAINT "WorkflowDeadLetter_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDeadLetter" ADD CONSTRAINT "WorkflowDeadLetter_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowIntegration" ADD CONSTRAINT "WorkflowIntegration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

