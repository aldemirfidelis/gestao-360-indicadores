CREATE TABLE "ProjectProgressSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "measuredOn" DATE NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "ProjectProgressSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProjectProgressSnapshot_progress_check" CHECK ("progress" BETWEEN 0 AND 100)
);

CREATE UNIQUE INDEX "ProjectProgressSnapshot_projectId_measuredOn_key"
    ON "ProjectProgressSnapshot"("projectId", "measuredOn");

ALTER TABLE "ProjectProgressSnapshot" ADD CONSTRAINT "ProjectProgressSnapshot_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Primeira medição no dia da ativação. Não inventa histórico anterior.
INSERT INTO "ProjectProgressSnapshot" ("id", "projectId", "measuredOn", "progress")
SELECT 'initial:' || p."id", p."id", (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date,
    ROUND((CASE
        WHEN t.progress IS NOT NULL AND m.progress IS NOT NULL THEN (t.progress + m.progress) / 2
        ELSE COALESCE(t.progress, m.progress, 0)
    END)::numeric)::double precision
FROM "Project" p
LEFT JOIN LATERAL (
    SELECT AVG(LEAST(100, GREATEST(0, "progress"))) AS progress
    FROM "ProjectTask" WHERE "projectId" = p."id"
) t ON TRUE
LEFT JOIN LATERAL (
    SELECT AVG(CASE WHEN "done" THEN 100.0 ELSE 0.0 END) AS progress
    FROM "ProjectMilestone" WHERE "projectId" = p."id"
) m ON TRUE
WHERE p."deletedAt" IS NULL;
