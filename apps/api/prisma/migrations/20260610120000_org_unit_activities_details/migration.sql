-- Atividades institucionais por unidade organizacional.
-- Migration aditiva: cria as tabelas reutilizaveis, carrega Remuneracao quando existir
-- e tenta limpar a area provisoria da GOIASA somente quando nao houver vinculos bloqueantes.

CREATE TABLE "organizational_unit_activities" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "organizational_unit_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "organizational_unit_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organizational_unit_activity_items" (
  "id" TEXT NOT NULL,
  "activity_id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "organizational_unit_activity_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "org_unit_activities_company_unit_order_idx"
  ON "organizational_unit_activities" ("company_id", "organizational_unit_id", "order_index");
CREATE INDEX "org_unit_activities_company_active_idx"
  ON "organizational_unit_activities" ("company_id", "is_active");
CREATE INDEX "org_unit_activity_items_activity_order_idx"
  ON "organizational_unit_activity_items" ("activity_id", "order_index");
CREATE INDEX "org_unit_activity_items_activity_active_idx"
  ON "organizational_unit_activity_items" ("activity_id", "is_active");

CREATE UNIQUE INDEX "org_unit_activities_active_title_uq"
  ON "organizational_unit_activities" ("company_id", "organizational_unit_id", lower(trim("title")))
  WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "org_unit_activity_items_active_description_uq"
  ON "organizational_unit_activity_items" ("activity_id", lower(trim("description")))
  WHERE "deleted_at" IS NULL;

ALTER TABLE "organizational_unit_activities"
  ADD CONSTRAINT "organizational_unit_activities_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organizational_unit_activities"
  ADD CONSTRAINT "organizational_unit_activities_org_unit_id_fkey"
  FOREIGN KEY ("organizational_unit_id") REFERENCES "OrgNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organizational_unit_activity_items"
  ADD CONSTRAINT "organizational_unit_activity_items_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "organizational_unit_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A carga usa comparacao por prefixo para nao depender da extensao unaccent.
WITH target_units AS (
  SELECT n.id AS unit_id, n."companyId" AS company_id
  FROM "OrgNode" n
  WHERE n."deletedAt" IS NULL
    AND (
      lower(n.name) LIKE 'remunera%'
      OR lower(n.name) LIKE 'remuner%'
    )
),
activity_blocks(order_index, title) AS (
  VALUES
    (1, 'Estrutura de Cargos e Salarios'),
    (2, 'Pesquisas Salariais'),
    (3, 'Administracao Salarial'),
    (4, 'Remuneracao Variavel'),
    (5, 'Orcamento de Pessoal'),
    (6, 'Beneficios, quando a area for integrada'),
    (7, 'Indicadores'),
    (8, 'Governanca'),
    (9, 'Suporte as Liderancas')
)
INSERT INTO "organizational_unit_activities" (
  "id", "company_id", "organizational_unit_id", "title", "order_index", "is_active", "created_at", "updated_at"
)
SELECT
  'seed-rem-' || md5(t.company_id || ':' || t.unit_id || ':' || b.order_index::text),
  t.company_id,
  t.unit_id,
  b.title,
  b.order_index,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM target_units t
CROSS JOIN activity_blocks b
WHERE NOT EXISTS (
  SELECT 1
  FROM "organizational_unit_activities" existing
  WHERE existing."company_id" = t.company_id
    AND existing."organizational_unit_id" = t.unit_id
    AND existing."deleted_at" IS NULL
);

WITH target_units AS (
  SELECT n.id AS unit_id, n."companyId" AS company_id
  FROM "OrgNode" n
  WHERE n."deletedAt" IS NULL
    AND (
      lower(n.name) LIKE 'remunera%'
      OR lower(n.name) LIKE 'remuner%'
    )
),
seed_items(activity_order, item_order, description) AS (
  VALUES
    (1, 1, 'Elaborar e manter o plano de cargos e salarios.'),
    (1, 2, 'Realizar descricao e avaliacao de cargos.'),
    (1, 3, 'Definir enquadramentos salariais.'),
    (1, 4, 'Construir e revisar tabelas salariais.'),
    (1, 5, 'Garantir a equidade salarial entre cargos e areas.'),
    (2, 1, 'Participar e analisar pesquisas salariais de mercado.'),
    (2, 2, 'Comparar a remuneracao interna com o mercado.'),
    (2, 3, 'Identificar defasagens e oportunidades de ajuste.'),
    (2, 4, 'Realizar regionalizacao salarial quando necessario.'),
    (2, 5, 'Recomendar posicionamento salarial da empresa, como 105% do mercado.'),
    (3, 1, 'Analisar propostas de admissao, promocao e transferencia.'),
    (3, 2, 'Avaliar solicitacoes de reajustes salariais.'),
    (3, 3, 'Controlar movimentacoes salariais.'),
    (3, 4, 'Monitorar compressao salarial e distorcoes internas.'),
    (3, 5, 'Emitir pareceres tecnicos sobre remuneracao.'),
    (4, 1, 'Desenvolver programas de participacao nos resultados, como PPR e PLR.'),
    (4, 2, 'Estruturar bonus anuais e incentivos de curto prazo.'),
    (4, 3, 'Definir indicadores, metas e pesos.'),
    (4, 4, 'Acompanhar resultados e calcular pagamentos.'),
    (4, 5, 'Avaliar a efetividade dos programas de incentivo.'),
    (5, 1, 'Elaborar projecoes de folha de pagamento.'),
    (5, 2, 'Simular impactos financeiros de reajustes.'),
    (5, 3, 'Apoiar o planejamento orcamentario anual.'),
    (5, 4, 'Monitorar custos com mao de obra.'),
    (5, 5, 'Realizar estudos de cenarios salariais.'),
    (6, 1, 'Avaliar a competitividade dos beneficios.'),
    (6, 2, 'Apoiar negociacoes com fornecedores.'),
    (6, 3, 'Analisar custos e utilizacao dos beneficios.'),
    (6, 4, 'Propor melhorias no pacote de remuneracao total.'),
    (7, 1, 'Monitorar indicadores de remuneracao.'),
    (7, 2, 'Produzir dashboards gerenciais.'),
    (7, 3, 'Analisar turnover relacionado a remuneracao.'),
    (7, 4, 'Avaliar o posicionamento salarial dos colaboradores.'),
    (7, 5, 'Gerar informacoes para a tomada de decisao da lideranca.'),
    (8, 1, 'Garantir conformidade com a legislacao trabalhista.'),
    (8, 2, 'Apoiar processos relacionados a Lei da Igualdade Salarial.'),
    (8, 3, 'Elaborar politicas e procedimentos de remuneracao.'),
    (8, 4, 'Participar de auditorias internas e externas.'),
    (8, 5, 'Assegurar criterios tecnicos e transparentes nas decisoes salariais.'),
    (9, 1, 'Orientar gestores sobre politicas salariais.'),
    (9, 2, 'Apoiar decisoes de promocao e merito.'),
    (9, 3, 'Fornecer analises de competitividade salarial.'),
    (9, 4, 'Conduzir treinamentos sobre remuneracao.')
)
INSERT INTO "organizational_unit_activity_items" (
  "id", "activity_id", "description", "order_index", "is_active", "created_at", "updated_at"
)
SELECT
  'seed-rem-item-' || md5(t.company_id || ':' || t.unit_id || ':' || i.activity_order::text || ':' || i.item_order::text),
  'seed-rem-' || md5(t.company_id || ':' || t.unit_id || ':' || i.activity_order::text),
  i.description,
  i.item_order,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM target_units t
JOIN seed_items i ON true
WHERE EXISTS (
  SELECT 1
  FROM "organizational_unit_activities" a
  WHERE a.id = 'seed-rem-' || md5(t.company_id || ':' || t.unit_id || ':' || i.activity_order::text)
)
AND NOT EXISTS (
  SELECT 1
  FROM "organizational_unit_activity_items" existing
  WHERE existing."activity_id" = 'seed-rem-' || md5(t.company_id || ':' || t.unit_id || ':' || i.activity_order::text)
    AND existing."deleted_at" IS NULL
    AND lower(trim(existing."description")) = lower(trim(i.description))
);

DO $$
DECLARE
  target RECORD;
  blocking_count INTEGER;
  cleared_users INTEGER;
  cleared_assignments INTEGER;
  cleared_employees INTEGER;
BEGIN
  FOR target IN
    WITH unclassified AS (
      SELECT n.id, n.name, n."companyId" AS company_id, 1 AS order_key
      FROM "OrgNode" n
      JOIN "Company" c ON c.id = n."companyId"
      WHERE n."deletedAt" IS NULL
        AND (lower(c.name) LIKE '%goiasa%' OR lower(coalesce(c."tradeName", '')) LIKE '%goiasa%')
        AND lower(n.name) LIKE '%classificada%'
    )
    SELECT child.id, child.name, child."companyId" AS company_id, 0 AS order_key
    FROM "OrgNode" child
    JOIN unclassified u ON u.id = child."parentId"
    WHERE child."deletedAt" IS NULL
      AND lower(child.name) LIKE '%victor rafael de assis claudino%'
    UNION ALL
    SELECT id, name, company_id, order_key FROM unclassified
    ORDER BY order_key ASC
  LOOP
    cleared_users := 0;
    cleared_assignments := 0;
    cleared_employees := 0;

    IF lower(target.name) LIKE '%classificada%' THEN
      UPDATE "User"
      SET "defaultNodeId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "companyId" = target.company_id
        AND "defaultNodeId" = target.id
        AND "deletedAt" IS NULL;
      GET DIAGNOSTICS cleared_users = ROW_COUNT;

      DELETE FROM "UserAreaAssignment"
      WHERE "companyId" = target.company_id
        AND "orgNodeId" = target.id;
      GET DIAGNOSTICS cleared_assignments = ROW_COUNT;

      UPDATE "OrgEmployee"
      SET "orgNodeId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "companyId" = target.company_id
        AND "orgNodeId" = target.id
        AND lower("name") = 'victor rafael de assis claudino';
      GET DIAGNOSTICS cleared_employees = ROW_COUNT;
    END IF;

    SELECT
      (SELECT count(*) FROM "OrgNode" WHERE "parentId" = target.id AND "deletedAt" IS NULL) +
      (SELECT count(*) FROM "Indicator" WHERE ("ownerNodeId" = target.id OR "guidelineNodeId" = target.id) AND "deletedAt" IS NULL) +
      (SELECT count(*) FROM "ActionPlan" WHERE "ownerNodeId" = target.id AND "deletedAt" IS NULL) +
      (SELECT count(*) FROM "RiskRegister" WHERE "orgNodeId" = target.id AND "deletedAt" IS NULL) +
      (SELECT count(*) FROM "NonConformity" WHERE "orgNodeId" = target.id AND "deletedAt" IS NULL) +
      (SELECT count(*) FROM "Document" WHERE "orgNodeId" = target.id AND "deletedAt" IS NULL) +
      (SELECT count(*) FROM "Audit" WHERE "orgNodeId" = target.id AND "deletedAt" IS NULL) +
      (SELECT count(*) FROM "Process" WHERE "orgNodeId" = target.id AND "deletedAt" IS NULL) +
      (SELECT count(*) FROM "FormTemplate" WHERE "orgNodeId" = target.id AND "deletedAt" IS NULL) +
      (SELECT count(*) FROM "FormSubmission" WHERE "orgNodeId" = target.id AND "deletedAt" IS NULL) +
      (SELECT count(*) FROM "StrategicObjective" WHERE "ownerNodeId" = target.id AND "deletedAt" IS NULL) +
      (SELECT count(*) FROM "StrategicObjectiveOrgNode" WHERE "orgNodeId" = target.id AND "deletedAt" IS NULL) +
      (SELECT count(*) FROM "OrgEmployee" WHERE "orgNodeId" = target.id) +
      (SELECT count(*) FROM "User" WHERE "defaultNodeId" = target.id AND "deletedAt" IS NULL) +
      (SELECT count(*) FROM "UserAreaAssignment" WHERE "orgNodeId" = target.id)
    INTO blocking_count;

    IF blocking_count = 0 THEN
      UPDATE "OrgNode"
      SET "deletedAt" = CURRENT_TIMESTAMP, "active" = false, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = target.id;

      INSERT INTO "AuditLog" ("id", "companyId", "action", "module", "entity", "entityId", "recordLabel", "payload", "result", "createdAt")
      VALUES (
        'audit-org-clean-' || md5(target.company_id || ':' || target.id || ':' || CURRENT_TIMESTAMP::text),
        target.company_id,
        'ORG_INVALID_NODE_CLEANUP_SUCCESS',
        'org',
        'OrgNode',
        target.id,
        target.name,
        json_build_object('clearedUsers', cleared_users, 'clearedAssignments', cleared_assignments, 'clearedEmployees', cleared_employees)::text,
        'SUCCESS',
        CURRENT_TIMESTAMP
      );
    ELSE
      INSERT INTO "AuditLog" ("id", "companyId", "action", "module", "entity", "entityId", "recordLabel", "payload", "result", "createdAt")
      VALUES (
        'audit-org-clean-blocked-' || md5(target.company_id || ':' || target.id || ':' || CURRENT_TIMESTAMP::text),
        target.company_id,
        'ORG_INVALID_NODE_CLEANUP_BLOCKED',
        'org',
        'OrgNode',
        target.id,
        target.name,
        json_build_object('blockingRelationships', blocking_count, 'clearedUsers', cleared_users, 'clearedAssignments', cleared_assignments, 'clearedEmployees', cleared_employees)::text,
        'BLOCKED',
        CURRENT_TIMESTAMP
      );
    END IF;
  END LOOP;
END $$;
