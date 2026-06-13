-- Migration: fluxo de edicao online Microsoft/WOPI com tarefas de liberacao.

CREATE TABLE "document_edit_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "requesterUserId" TEXT NOT NULL,
    "operatorUserId" TEXT,
    "decidedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "decisionNote" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_edit_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_edit_requests_companyId_status_idx" ON "document_edit_requests"("companyId", "status");
CREATE INDEX "document_edit_requests_documentId_status_idx" ON "document_edit_requests"("documentId", "status");
CREATE INDEX "document_edit_requests_requesterUserId_status_idx" ON "document_edit_requests"("requesterUserId", "status");
CREATE INDEX "document_edit_requests_operatorUserId_status_idx" ON "document_edit_requests"("operatorUserId", "status");

ALTER TABLE "document_edit_requests" ADD CONSTRAINT "document_edit_requests_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_edit_requests" ADD CONSTRAINT "document_edit_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_edit_requests" ADD CONSTRAINT "document_edit_requests_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_edit_requests" ADD CONSTRAINT "document_edit_requests_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_edit_requests" ADD CONSTRAINT "document_edit_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
