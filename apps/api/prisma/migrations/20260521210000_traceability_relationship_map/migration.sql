-- CreateEnum
CREATE TYPE "TraceEventType" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'RESULT_RECORDED', 'OFF_TARGET_ALERT', 'CAUSE_CREATED', 'ANALYSIS_CREATED', 'MEETING_CREATED', 'MEETING_DECISION', 'ACTION_CREATED', 'ACTION_STATUS_CHANGED', 'TASK_UPDATED', 'EVIDENCE_ADDED', 'COMMENT_ADDED', 'LINK_CREATED', 'LINK_REMOVED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "TraceEntityType" AS ENUM ('COMPANY', 'ORG_NODE', 'STRATEGIC_OBJECTIVE', 'OKR_OBJECTIVE', 'INDICATOR', 'INDICATOR_RESULT', 'DEVIATION', 'DEVIATION_CAUSE', 'DEVIATION_ANALYSIS', 'MEETING', 'MEETING_DECISION', 'ACTION_PLAN', 'ACTION_TASK', 'PROJECT', 'PROJECT_TASK', 'ATTACHMENT', 'COMMENT', 'MAP_NODE', 'MAP_EDGE');

-- CreateEnum
CREATE TYPE "MapNodeType" AS ENUM ('COMPANY', 'GUIDELINE', 'SECTOR', 'AREA', 'PROCESS', 'INDICATOR', 'DEVIATION', 'MEETING', 'ACTION', 'EXECUTION', 'FOLLOW_UP', 'CONCLUSION', 'OBJECTIVE', 'OKR', 'PROJECT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MapMode" AS ENUM ('FREE', 'TREE', 'TIMELINE', 'INDICATOR', 'ACTION', 'TRACEABILITY', 'PRESENTATION');

-- CreateTable
CREATE TABLE "TraceabilityEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "indicatorId" TEXT,
    "userId" TEXT,
    "eventType" "TraceEventType" NOT NULL,
    "entityType" "TraceEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "relatedType" "TraceEntityType",
    "relatedId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "statusFrom" TEXT,
    "statusTo" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraceabilityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" "TraceEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "statusFrom" TEXT,
    "statusTo" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationshipMap" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" "MapMode" NOT NULL DEFAULT 'TRACEABILITY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RelationshipMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapNode" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "type" "MapNodeType" NOT NULL,
    "refTable" TEXT,
    "refId" TEXT,
    "label" TEXT NOT NULL,
    "status" TEXT,
    "responsible" TEXT,
    "dueDate" TIMESTAMP(3),
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "collapsed" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapEdge" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'relates_to',
    "label" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapLayout" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "mode" "MapMode" NOT NULL DEFAULT 'TRACEABILITY',
    "viewport" JSONB,
    "nodesJson" JSONB,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TraceabilityEvent_companyId_occurredAt_idx" ON "TraceabilityEvent"("companyId", "occurredAt");
CREATE INDEX "TraceabilityEvent_indicatorId_occurredAt_idx" ON "TraceabilityEvent"("indicatorId", "occurredAt");
CREATE INDEX "TraceabilityEvent_entityType_entityId_idx" ON "TraceabilityEvent"("entityType", "entityId");
CREATE INDEX "TraceabilityEvent_relatedType_relatedId_idx" ON "TraceabilityEvent"("relatedType", "relatedId");
CREATE INDEX "StatusHistory_companyId_createdAt_idx" ON "StatusHistory"("companyId", "createdAt");
CREATE INDEX "StatusHistory_entityType_entityId_idx" ON "StatusHistory"("entityType", "entityId");
CREATE INDEX "RelationshipMap_companyId_idx" ON "RelationshipMap"("companyId");
CREATE INDEX "MapNode_mapId_idx" ON "MapNode"("mapId");
CREATE INDEX "MapNode_refTable_refId_idx" ON "MapNode"("refTable", "refId");
CREATE UNIQUE INDEX "MapEdge_mapId_sourceNodeId_targetNodeId_kind_key" ON "MapEdge"("mapId", "sourceNodeId", "targetNodeId", "kind");
CREATE INDEX "MapEdge_mapId_idx" ON "MapEdge"("mapId");
CREATE UNIQUE INDEX "MapLayout_mapId_mode_key" ON "MapLayout"("mapId", "mode");

-- AddForeignKey
ALTER TABLE "TraceabilityEvent" ADD CONSTRAINT "TraceabilityEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TraceabilityEvent" ADD CONSTRAINT "TraceabilityEvent_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TraceabilityEvent" ADD CONSTRAINT "TraceabilityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RelationshipMap" ADD CONSTRAINT "RelationshipMap_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MapNode" ADD CONSTRAINT "MapNode_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "RelationshipMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MapEdge" ADD CONSTRAINT "MapEdge_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "RelationshipMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MapEdge" ADD CONSTRAINT "MapEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "MapNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MapEdge" ADD CONSTRAINT "MapEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "MapNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MapLayout" ADD CONSTRAINT "MapLayout_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "RelationshipMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MapLayout" ADD CONSTRAINT "MapLayout_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
