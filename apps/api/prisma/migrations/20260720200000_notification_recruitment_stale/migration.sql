-- Alerta de vaga (requisição) parada além do SLA configurado — ativa o campo
-- RecruitRequisition.slaDays, que já existia mas nunca era lido em lugar nenhum.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'RECRUITMENT_REQUISITION_STALE';
