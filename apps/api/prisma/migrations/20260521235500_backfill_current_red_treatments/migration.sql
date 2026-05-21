-- Backfill current off-target indicators that existed before the treatment flow.
-- Only the latest result per active indicator is considered, so historical reds
-- already followed by a green result do not flood the operation queue.
WITH latest_result AS (
  SELECT DISTINCT ON (r."indicatorId")
    r."id" AS "resultId",
    r."indicatorId",
    r."periodRef",
    r."value",
    r."deviationPct",
    i."companyId",
    i."name" AS "indicatorName"
  FROM "IndicatorResult" r
  INNER JOIN "Indicator" i ON i."id" = r."indicatorId"
  WHERE i."deletedAt" IS NULL
    AND i."status" = 'ACTIVE'
  ORDER BY r."indicatorId", r."periodDate" DESC
),
inserted_treatments AS (
  INSERT INTO "TreatmentCase" (
    "id",
    "companyId",
    "indicatorId",
    "resultId",
    "periodRef",
    "title",
    "problem",
    "status",
    "createdAt",
    "updatedAt"
  )
  SELECT
    'trt_backfill_' || substr(md5(lr."resultId"), 1, 20),
    lr."companyId",
    lr."indicatorId",
    lr."resultId",
    lr."periodRef",
    'Tratativa - ' || lr."indicatorName" || ' (' || lr."periodRef" || ')',
    'Resultado ' || lr."value"::text || ' fora da meta no periodo ' || lr."periodRef" || '.',
    'AWAITING_CAUSE_ANALYSIS',
    NOW(),
    NOW()
  FROM latest_result lr
  WHERE EXISTS (
      SELECT 1 FROM "IndicatorResult" r
      WHERE r."id" = lr."resultId" AND r."light" = 'RED'
    )
    AND NOT EXISTS (
      SELECT 1 FROM "TreatmentCase" tc
      WHERE tc."indicatorId" = lr."indicatorId"
        AND tc."periodRef" = lr."periodRef"
    )
  ON CONFLICT ("indicatorId", "periodRef") DO NOTHING
  RETURNING "id", "companyId", "indicatorId", "resultId", "periodRef", "title", "status"
)
INSERT INTO "TraceabilityEvent" (
  "id",
  "companyId",
  "indicatorId",
  "eventType",
  "entityType",
  "entityId",
  "title",
  "description",
  "statusTo",
  "metadata",
  "occurredAt",
  "createdAt"
)
SELECT
  'tev_backfill_' || substr(md5(it."id"), 1, 20),
  it."companyId",
  it."indicatorId",
  'TREATMENT_STARTED',
  'INDICATOR_RESULT',
  it."resultId",
  'Tratativa criada automaticamente para indicador fora da meta',
  it."title",
  it."status",
  jsonb_build_object('treatmentId', it."id", 'periodRef', it."periodRef", 'source', 'migration_backfill_current_red'),
  NOW(),
  NOW()
FROM inserted_treatments it
ON CONFLICT ("id") DO NOTHING;
