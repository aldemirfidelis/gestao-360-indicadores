-- Administração do Banco de Dados: tabelas administrativas dedicadas.
-- Migration ADITIVA — não altera nenhuma tabela existente.

-- CreateTable
CREATE TABLE "DbAdminAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "userRole" TEXT,
    "submenu" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "mode" TEXT,
    "targetTable" TEXT,
    "targetRecordId" TEXT,
    "sqlText" TEXT,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "rowsAffected" INTEGER,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "message" TEXT,
    "transactionId" TEXT,
    "backupId" TEXT,
    "origin" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DbAdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DbAdminBackup" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "relatedOperation" TEXT,
    "targetTables" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'json',
    "filePath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "important" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "integrityVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DbAdminBackup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DbAdminSavedQuery" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "DbAdminSavedQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DbAdminQueryHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sql" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'safe',
    "durationMs" INTEGER,
    "rowCount" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DbAdminQueryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DbAdminAuditLog_createdAt_idx" ON "DbAdminAuditLog"("createdAt");
CREATE INDEX "DbAdminAuditLog_userId_createdAt_idx" ON "DbAdminAuditLog"("userId", "createdAt");
CREATE INDEX "DbAdminAuditLog_submenu_action_idx" ON "DbAdminAuditLog"("submenu", "action");
CREATE INDEX "DbAdminAuditLog_targetTable_idx" ON "DbAdminAuditLog"("targetTable");
CREATE INDEX "DbAdminAuditLog_result_idx" ON "DbAdminAuditLog"("result");

-- CreateIndex
CREATE INDEX "DbAdminBackup_createdAt_idx" ON "DbAdminBackup"("createdAt");
CREATE INDEX "DbAdminBackup_type_idx" ON "DbAdminBackup"("type");
CREATE INDEX "DbAdminBackup_status_idx" ON "DbAdminBackup"("status");

-- CreateIndex
CREATE INDEX "DbAdminSavedQuery_userId_idx" ON "DbAdminSavedQuery"("userId");
CREATE INDEX "DbAdminSavedQuery_isFavorite_idx" ON "DbAdminSavedQuery"("isFavorite");

-- CreateIndex
CREATE INDEX "DbAdminQueryHistory_userId_createdAt_idx" ON "DbAdminQueryHistory"("userId", "createdAt");
CREATE INDEX "DbAdminQueryHistory_createdAt_idx" ON "DbAdminQueryHistory"("createdAt");
