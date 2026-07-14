-- Unificação das férias: o módulo Folha passa a consumir a fonte canônica
-- VacationRequest (Serviço Pessoal). Adiciona insumos de folha nela e remove
-- as tabelas paralelas criadas na Fase 3. Aditiva + remoção de tabelas órfãs.

ALTER TABLE "vacation_requests" ADD COLUMN IF NOT EXISTS "sellDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "vacation_requests" ADD COLUMN IF NOT EXISTS "advanceThirteenth" BOOLEAN NOT NULL DEFAULT false;

DROP TABLE IF EXISTS "payroll_vacation_requests";
DROP TABLE IF EXISTS "payroll_vacation_periods";
