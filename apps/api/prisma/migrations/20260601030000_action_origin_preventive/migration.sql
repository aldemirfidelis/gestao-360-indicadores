-- Nova origem de plano de acao: PREVENTIVE (acao preventiva de um indicador, para acompanhamento).
-- ADD VALUE e idempotente com IF NOT EXISTS (Postgres 12+ / Neon).
ALTER TYPE "ActionOrigin" ADD VALUE IF NOT EXISTS 'PREVENTIVE';
