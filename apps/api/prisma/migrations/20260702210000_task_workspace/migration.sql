-- Tarefas — Central de Trabalho Visual.
-- Os registros automaticos guardam apenas o vinculo com a fonte oficial.

CREATE TABLE "TaskBoard" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TEAM',
    "areaId" TEXT,
    "ownerId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'COMPANY',
    "wikiContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskBoard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskBoardColumn" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "statusKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT,
    "isDoneColumn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskBoardColumn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceTask" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "createdById" TEXT,
    "areaId" TEXT,
    "projectId" TEXT,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT 'yellow',
    "icon" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "dependencies" JSONB NOT NULL DEFAULT '[]',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "sourceKey" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceModule" TEXT,
    "sourceEntityId" TEXT,
    "sourceEntityLabel" TEXT,
    "sourceUrl" TEXT,
    "automationRuleId" TEXT,
    "generatedBy" TEXT NOT NULL DEFAULT 'USER',
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mentions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskAttachment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskChecklistItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskActivity" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskLink" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskBoard_key_key" ON "TaskBoard"("key");
CREATE INDEX "TaskBoard_companyId_type_idx" ON "TaskBoard"("companyId", "type");
CREATE INDEX "TaskBoard_companyId_areaId_idx" ON "TaskBoard"("companyId", "areaId");
CREATE UNIQUE INDEX "TaskBoardColumn_boardId_statusKey_key" ON "TaskBoardColumn"("boardId", "statusKey");
CREATE INDEX "TaskBoardColumn_boardId_position_idx" ON "TaskBoardColumn"("boardId", "position");
CREATE UNIQUE INDEX "WorkspaceTask_sourceKey_key" ON "WorkspaceTask"("sourceKey");
CREATE INDEX "WorkspaceTask_companyId_boardId_isArchived_idx" ON "WorkspaceTask"("companyId", "boardId", "isArchived");
CREATE INDEX "WorkspaceTask_companyId_assigneeId_status_idx" ON "WorkspaceTask"("companyId", "assigneeId", "status");
CREATE INDEX "WorkspaceTask_companyId_areaId_status_idx" ON "WorkspaceTask"("companyId", "areaId", "status");
CREATE INDEX "WorkspaceTask_columnId_position_idx" ON "WorkspaceTask"("columnId", "position");
CREATE INDEX "WorkspaceTask_dueDate_idx" ON "WorkspaceTask"("dueDate");
CREATE INDEX "WorkspaceTask_sourceType_sourceEntityId_idx" ON "WorkspaceTask"("sourceType", "sourceEntityId");
CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");
CREATE INDEX "TaskComment_userId_idx" ON "TaskComment"("userId");
CREATE INDEX "TaskAttachment_taskId_createdAt_idx" ON "TaskAttachment"("taskId", "createdAt");
CREATE INDEX "TaskChecklistItem_taskId_position_idx" ON "TaskChecklistItem"("taskId", "position");
CREATE INDEX "TaskActivity_taskId_createdAt_idx" ON "TaskActivity"("taskId", "createdAt");
CREATE INDEX "TaskActivity_userId_idx" ON "TaskActivity"("userId");
CREATE UNIQUE INDEX "TaskLink_taskId_entityType_entityId_key" ON "TaskLink"("taskId", "entityType", "entityId");
CREATE INDEX "TaskLink_entityType_entityId_idx" ON "TaskLink"("entityType", "entityId");

ALTER TABLE "TaskBoardColumn"
  ADD CONSTRAINT "TaskBoardColumn_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "TaskBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceTask"
  ADD CONSTRAINT "WorkspaceTask_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "TaskBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceTask"
  ADD CONSTRAINT "WorkspaceTask_columnId_fkey"
  FOREIGN KEY ("columnId") REFERENCES "TaskBoardColumn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaskComment"
  ADD CONSTRAINT "TaskComment_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "WorkspaceTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskAttachment"
  ADD CONSTRAINT "TaskAttachment_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "WorkspaceTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskChecklistItem"
  ADD CONSTRAINT "TaskChecklistItem_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "WorkspaceTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskActivity"
  ADD CONSTRAINT "TaskActivity_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "WorkspaceTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskLink"
  ADD CONSTRAINT "TaskLink_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "WorkspaceTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
