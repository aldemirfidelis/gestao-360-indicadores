-- GED foundation for Gestao > Documentos.
-- Additive migration: expands the existing document register without dropping current data.

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'INTERNAL_STANDARD';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'GUIDELINE';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'REGULATION';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'FLOWCHART';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'PLAN';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'REPORT';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'CHECKLIST';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'TECHNICAL_SPECIFICATION';

ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'IN_DEVELOPMENT';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'WAITING_REVIEW';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'ADJUSTMENTS_REQUESTED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'REVIEWED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'WAITING_APPROVAL';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'IN_APPROVAL';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED_PUBLICATION';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'NEAR_EXPIRATION';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'PERIODIC_REVIEW';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'REPLACED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TYPE "DocumentFileKind" AS ENUM ('DOCX', 'PDF', 'TEMPLATE', 'ATTACHMENT', 'EVIDENCE', 'IMAGE', 'TEMPORARY');
CREATE TYPE "DocumentApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ADJUSTMENTS_REQUESTED', 'DELEGATED');

CREATE UNIQUE INDEX "Document_companyId_code_active_key" ON "Document"("companyId", "code") WHERE "code" IS NOT NULL AND "deletedAt" IS NULL;

CREATE TABLE "document_types" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "description" TEXT,
    "category" "DocumentType" NOT NULL DEFAULT 'PROCEDURE',
    "prefix" TEXT NOT NULL,
    "codePattern" TEXT NOT NULL DEFAULT '{{PREFIX}}-{{SEQ}}',
    "sequenceScope" TEXT NOT NULL DEFAULT 'TYPE',
    "digits" INTEGER NOT NULL DEFAULT 3,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "resetYearly" BOOLEAN NOT NULL DEFAULT false,
    "currentYear" INTEGER,
    "defaultTemplateId" TEXT,
    "defaultValidityDays" INTEGER,
    "alertDays" INTEGER NOT NULL DEFAULT 30,
    "requiresPeriodicReview" BOOLEAN NOT NULL DEFAULT true,
    "editable" BOOLEAN NOT NULL DEFAULT true,
    "allowManualCode" BOOLEAN NOT NULL DEFAULT false,
    "createOnlyByRequest" BOOLEAN NOT NULL DEFAULT false,
    "approvalFlow" JSONB,
    "customFields" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_code_rules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "typeConfigId" TEXT,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "pattern" TEXT NOT NULL DEFAULT '{{PREFIX}}-{{SEQ}}',
    "sequenceScope" TEXT NOT NULL DEFAULT 'TYPE',
    "digits" INTEGER NOT NULL DEFAULT 3,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "resetYearly" BOOLEAN NOT NULL DEFAULT false,
    "currentYear" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "document_code_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "typeConfigId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "storageKey" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "hashSha256" TEXT,
    "content" TEXT,
    "placeholders" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "changeReason" TEXT,
    "changeSummary" TEXT,
    "docxFileId" TEXT,
    "pdfFileId" TEXT,
    "publicationDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "createdById" TEXT,
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_files" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT,
    "versionId" TEXT,
    "templateId" TEXT,
    "kind" "DocumentFileKind" NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL',
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "hashSha256" TEXT,
    "contentText" TEXT,
    "protected" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "document_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_status_history" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "userId" TEXT,
    "statusFrom" TEXT,
    "statusTo" TEXT NOT NULL,
    "comment" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_workflows" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT,
    "typeConfigId" TEXT,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SEQUENTIAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "steps" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "document_workflows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_workflow_steps" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workflowId" TEXT,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "stepOrder" INTEGER NOT NULL DEFAULT 1,
    "role" TEXT,
    "userId" TEXT,
    "dueAt" TIMESTAMP(3),
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_workflow_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_approvals" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "approverUserId" TEXT,
    "approverRole" TEXT,
    "approvalOrder" INTEGER NOT NULL DEFAULT 1,
    "decision" "DocumentApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "statusFrom" TEXT,
    "statusTo" TEXT,
    "comment" TEXT,
    "ip" TEXT,
    "sessionId" TEXT,
    "evidenceFileId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_review_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "reviewerUserId" TEXT,
    "authorUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "comment" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "answer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_review_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_comments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "parentId" TEXT,
    "userId" TEXT,
    "body" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_comment_mentions" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_comment_mentions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_relations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "relatedEntityType" TEXT NOT NULL,
    "relatedEntityId" TEXT NOT NULL,
    "relationKind" TEXT NOT NULL DEFAULT 'RELATED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_relations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_permissions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT,
    "typeConfigId" TEXT,
    "userId" TEXT,
    "orgNodeId" TEXT,
    "groupId" TEXT,
    "permission" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_access_groups" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "document_access_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_access_group_users" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_access_group_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_distributions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "userId" TEXT,
    "orgNodeId" TEXT,
    "groupId" TEXT,
    "dueAt" TIMESTAMP(3),
    "requireConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "requireQuiz" BOOLEAN NOT NULL DEFAULT false,
    "trainingRef" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "document_distributions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_read_confirmations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "distributionId" TEXT,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "quizScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'READ',
    CONSTRAINT "document_read_confirmations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_download_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "fileId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL DEFAULT 'DOWNLOAD',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_download_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_view_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "fileId" TEXT,
    "userId" TEXT,
    "origin" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_view_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_share_links" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'VIEW',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_share_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_notifications" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "kind" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_audit_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "beforeValue" JSONB,
    "afterValue" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "origin" TEXT,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_external_metadata" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "issuer" TEXT,
    "responsibleAgency" TEXT,
    "externalNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "sourceLink" TEXT,
    "internalOwnerUserId" TEXT,
    "requiresRenewal" BOOLEAN NOT NULL DEFAULT false,
    "alertDays" INTEGER,
    "metadata" JSONB,
    CONSTRAINT "document_external_metadata_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_retention_rules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "typeConfigId" TEXT,
    "name" TEXT NOT NULL,
    "retentionDays" INTEGER,
    "disposition" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_retention_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_editor_sessions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,
    CONSTRAINT "document_editor_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_autosave_checkpoints" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "userId" TEXT,
    "content" TEXT,
    "fileId" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_autosave_checkpoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_tags" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_tag_relations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_tag_relations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_types_companyId_sigla_key" ON "document_types"("companyId", "sigla");
CREATE INDEX "document_types_companyId_active_idx" ON "document_types"("companyId", "active");
CREATE INDEX "document_types_companyId_prefix_idx" ON "document_types"("companyId", "prefix");

CREATE UNIQUE INDEX "document_code_rules_companyId_name_key" ON "document_code_rules"("companyId", "name");
CREATE INDEX "document_code_rules_companyId_active_idx" ON "document_code_rules"("companyId", "active");
CREATE INDEX "document_code_rules_typeConfigId_idx" ON "document_code_rules"("typeConfigId");

CREATE INDEX "document_templates_companyId_active_idx" ON "document_templates"("companyId", "active");
CREATE INDEX "document_templates_typeConfigId_isDefault_idx" ON "document_templates"("typeConfigId", "isDefault");

CREATE UNIQUE INDEX "document_versions_documentId_revisionNumber_key" ON "document_versions"("documentId", "revisionNumber");
CREATE INDEX "document_versions_companyId_status_idx" ON "document_versions"("companyId", "status");
CREATE INDEX "document_versions_documentId_createdAt_idx" ON "document_versions"("documentId", "createdAt");

CREATE INDEX "document_files_companyId_kind_idx" ON "document_files"("companyId", "kind");
CREATE INDEX "document_files_documentId_kind_idx" ON "document_files"("documentId", "kind");
CREATE INDEX "document_files_versionId_idx" ON "document_files"("versionId");
CREATE INDEX "document_files_storageKey_idx" ON "document_files"("storageKey");

CREATE INDEX "document_status_history_companyId_createdAt_idx" ON "document_status_history"("companyId", "createdAt");
CREATE INDEX "document_status_history_documentId_createdAt_idx" ON "document_status_history"("documentId", "createdAt");

CREATE INDEX "document_workflows_companyId_active_idx" ON "document_workflows"("companyId", "active");
CREATE INDEX "document_workflows_documentId_idx" ON "document_workflows"("documentId");

CREATE INDEX "document_workflow_steps_companyId_decision_idx" ON "document_workflow_steps"("companyId", "decision");
CREATE INDEX "document_workflow_steps_documentId_stepOrder_idx" ON "document_workflow_steps"("documentId", "stepOrder");

CREATE INDEX "document_approvals_companyId_decision_idx" ON "document_approvals"("companyId", "decision");
CREATE INDEX "document_approvals_documentId_approvalOrder_idx" ON "document_approvals"("documentId", "approvalOrder");
CREATE INDEX "document_approvals_approverUserId_decision_idx" ON "document_approvals"("approverUserId", "decision");

CREATE INDEX "document_review_requests_companyId_status_idx" ON "document_review_requests"("companyId", "status");
CREATE INDEX "document_review_requests_documentId_createdAt_idx" ON "document_review_requests"("documentId", "createdAt");
CREATE INDEX "document_review_requests_reviewerUserId_status_idx" ON "document_review_requests"("reviewerUserId", "status");

CREATE INDEX "document_comments_companyId_createdAt_idx" ON "document_comments"("companyId", "createdAt");
CREATE INDEX "document_comments_documentId_createdAt_idx" ON "document_comments"("documentId", "createdAt");

CREATE UNIQUE INDEX "document_comment_mentions_commentId_userId_key" ON "document_comment_mentions"("commentId", "userId");

CREATE UNIQUE INDEX "document_relations_documentId_relatedEntityType_relatedEntityId_relationKind_key" ON "document_relations"("documentId", "relatedEntityType", "relatedEntityId", "relationKind");
CREATE INDEX "document_relations_companyId_relatedEntityType_relatedEntityId_idx" ON "document_relations"("companyId", "relatedEntityType", "relatedEntityId");

CREATE INDEX "document_permissions_companyId_permission_idx" ON "document_permissions"("companyId", "permission");
CREATE INDEX "document_permissions_documentId_idx" ON "document_permissions"("documentId");
CREATE INDEX "document_permissions_userId_idx" ON "document_permissions"("userId");

CREATE UNIQUE INDEX "document_access_groups_companyId_name_key" ON "document_access_groups"("companyId", "name");
CREATE UNIQUE INDEX "document_access_group_users_groupId_userId_key" ON "document_access_group_users"("groupId", "userId");

CREATE INDEX "document_distributions_companyId_dueAt_idx" ON "document_distributions"("companyId", "dueAt");
CREATE INDEX "document_distributions_documentId_idx" ON "document_distributions"("documentId");
CREATE INDEX "document_distributions_userId_idx" ON "document_distributions"("userId");

CREATE INDEX "document_read_confirmations_companyId_status_idx" ON "document_read_confirmations"("companyId", "status");
CREATE INDEX "document_read_confirmations_documentId_userId_idx" ON "document_read_confirmations"("documentId", "userId");

CREATE INDEX "document_download_logs_companyId_createdAt_idx" ON "document_download_logs"("companyId", "createdAt");
CREATE INDEX "document_download_logs_documentId_createdAt_idx" ON "document_download_logs"("documentId", "createdAt");

CREATE INDEX "document_view_logs_companyId_createdAt_idx" ON "document_view_logs"("companyId", "createdAt");
CREATE INDEX "document_view_logs_documentId_createdAt_idx" ON "document_view_logs"("documentId", "createdAt");

CREATE UNIQUE INDEX "document_share_links_tokenHash_key" ON "document_share_links"("tokenHash");
CREATE INDEX "document_share_links_companyId_expiresAt_idx" ON "document_share_links"("companyId", "expiresAt");
CREATE INDEX "document_share_links_documentId_idx" ON "document_share_links"("documentId");

CREATE INDEX "document_notifications_companyId_createdAt_idx" ON "document_notifications"("companyId", "createdAt");
CREATE INDEX "document_notifications_userId_readAt_idx" ON "document_notifications"("userId", "readAt");

CREATE INDEX "document_audit_logs_companyId_createdAt_idx" ON "document_audit_logs"("companyId", "createdAt");
CREATE INDEX "document_audit_logs_documentId_createdAt_idx" ON "document_audit_logs"("documentId", "createdAt");
CREATE INDEX "document_audit_logs_action_result_idx" ON "document_audit_logs"("action", "result");

CREATE UNIQUE INDEX "document_external_metadata_documentId_key" ON "document_external_metadata"("documentId");
CREATE INDEX "document_external_metadata_companyId_expirationDate_idx" ON "document_external_metadata"("companyId", "expirationDate");

CREATE INDEX "document_retention_rules_companyId_active_idx" ON "document_retention_rules"("companyId", "active");

CREATE INDEX "document_editor_sessions_companyId_status_idx" ON "document_editor_sessions"("companyId", "status");
CREATE INDEX "document_editor_sessions_documentId_startedAt_idx" ON "document_editor_sessions"("documentId", "startedAt");

CREATE INDEX "document_autosave_checkpoints_companyId_createdAt_idx" ON "document_autosave_checkpoints"("companyId", "createdAt");
CREATE INDEX "document_autosave_checkpoints_documentId_createdAt_idx" ON "document_autosave_checkpoints"("documentId", "createdAt");

CREATE UNIQUE INDEX "document_tags_companyId_name_key" ON "document_tags"("companyId", "name");
CREATE UNIQUE INDEX "document_tag_relations_documentId_tagId_key" ON "document_tag_relations"("documentId", "tagId");
CREATE INDEX "document_tag_relations_companyId_tagId_idx" ON "document_tag_relations"("companyId", "tagId");

ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_status_history" ADD CONSTRAINT "document_status_history_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_workflows" ADD CONSTRAINT "document_workflows_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_workflow_steps" ADD CONSTRAINT "document_workflow_steps_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_approvals" ADD CONSTRAINT "document_approvals_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_review_requests" ADD CONSTRAINT "document_review_requests_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_distributions" ADD CONSTRAINT "document_distributions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_read_confirmations" ADD CONSTRAINT "document_read_confirmations_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_download_logs" ADD CONSTRAINT "document_download_logs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_view_logs" ADD CONSTRAINT "document_view_logs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_share_links" ADD CONSTRAINT "document_share_links_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_notifications" ADD CONSTRAINT "document_notifications_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_external_metadata" ADD CONSTRAINT "document_external_metadata_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_editor_sessions" ADD CONSTRAINT "document_editor_sessions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_autosave_checkpoints" ADD CONSTRAINT "document_autosave_checkpoints_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_tag_relations" ADD CONSTRAINT "document_tag_relations_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_tag_relations" ADD CONSTRAINT "document_tag_relations_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "document_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
