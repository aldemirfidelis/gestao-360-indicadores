-- Editable strategic map workspace, many-to-many indicator links and versioning.

ALTER TABLE "StrategicMap"
  ADD COLUMN "publishedVersionId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedById" TEXT;

ALTER TABLE "Perspective"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "icon" TEXT,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedById" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "StrategicObjective"
  ADD COLUMN "responsibleUserId" TEXT,
  ADD COLUMN "ownerNodeId" TEXT,
  ADD COLUMN "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedById" TEXT;

ALTER TABLE "ObjectiveRelation"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'impacta',
  ADD COLUMN "label" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE TABLE "StrategicObjectiveIndicator" (
  "id" TEXT NOT NULL,
  "objectiveId" TEXT NOT NULL,
  "indicatorId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "StrategicObjectiveIndicator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategicObjectiveOrgNode" (
  "id" TEXT NOT NULL,
  "objectiveId" TEXT NOT NULL,
  "orgNodeId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'responsavel',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "StrategicObjectiveOrgNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategicMapVersion" (
  "id" TEXT NOT NULL,
  "mapId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "snapshot" JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "StrategicMapVersion_pkey" PRIMARY KEY ("id")
);

INSERT INTO "StrategicObjectiveIndicator" ("id", "objectiveId", "indicatorId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || "id"), "strategicObjectiveId", "id", CURRENT_TIMESTAMP
FROM "Indicator"
WHERE "strategicObjectiveId" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "StrategicObjectiveIndicator_objectiveId_indicatorId_key" ON "StrategicObjectiveIndicator"("objectiveId", "indicatorId");
CREATE INDEX "StrategicObjectiveIndicator_indicatorId_idx" ON "StrategicObjectiveIndicator"("indicatorId");

CREATE UNIQUE INDEX "StrategicObjectiveOrgNode_objectiveId_orgNodeId_kind_key" ON "StrategicObjectiveOrgNode"("objectiveId", "orgNodeId", "kind");
CREATE INDEX "StrategicObjectiveOrgNode_orgNodeId_idx" ON "StrategicObjectiveOrgNode"("orgNodeId");

CREATE UNIQUE INDEX "StrategicMapVersion_mapId_version_key" ON "StrategicMapVersion"("mapId", "version");
CREATE INDEX "StrategicMapVersion_mapId_status_idx" ON "StrategicMapVersion"("mapId", "status");

CREATE INDEX "StrategicMap_publishedVersionId_idx" ON "StrategicMap"("publishedVersionId");
CREATE INDEX "Perspective_active_idx" ON "Perspective"("active");
CREATE INDEX "StrategicObjective_responsibleUserId_idx" ON "StrategicObjective"("responsibleUserId");
CREATE INDEX "StrategicObjective_ownerNodeId_idx" ON "StrategicObjective"("ownerNodeId");
CREATE INDEX "StrategicObjective_active_idx" ON "StrategicObjective"("active");
CREATE INDEX "ObjectiveRelation_active_idx" ON "ObjectiveRelation"("active");

ALTER TABLE "StrategicMap" ADD CONSTRAINT "StrategicMap_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StrategicMap" ADD CONSTRAINT "StrategicMap_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Perspective" ADD CONSTRAINT "Perspective_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Perspective" ADD CONSTRAINT "Perspective_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StrategicObjective" ADD CONSTRAINT "StrategicObjective_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StrategicObjective" ADD CONSTRAINT "StrategicObjective_ownerNodeId_fkey" FOREIGN KEY ("ownerNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StrategicObjective" ADD CONSTRAINT "StrategicObjective_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StrategicObjective" ADD CONSTRAINT "StrategicObjective_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StrategicObjectiveIndicator" ADD CONSTRAINT "StrategicObjectiveIndicator_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "StrategicObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StrategicObjectiveIndicator" ADD CONSTRAINT "StrategicObjectiveIndicator_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StrategicObjectiveOrgNode" ADD CONSTRAINT "StrategicObjectiveOrgNode_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "StrategicObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StrategicObjectiveOrgNode" ADD CONSTRAINT "StrategicObjectiveOrgNode_orgNodeId_fkey" FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StrategicMapVersion" ADD CONSTRAINT "StrategicMapVersion_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "StrategicMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StrategicMapVersion" ADD CONSTRAINT "StrategicMapVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
