-- Folha / eSocial: campos de transmissão SOAP no lote (protocolo já existia).
-- Aditiva. A transmissão real fica atrás de flag; guarda auditoria do envio.

ALTER TABLE "payroll_esocial_batches" ADD COLUMN IF NOT EXISTS "transmissionStatus" TEXT;
ALTER TABLE "payroll_esocial_batches" ADD COLUMN IF NOT EXISTS "transmittedAt" TIMESTAMP(3);
ALTER TABLE "payroll_esocial_batches" ADD COLUMN IF NOT EXISTS "transmitEndpoint" TEXT;
ALTER TABLE "payroll_esocial_batches" ADD COLUMN IF NOT EXISTS "transmitRequestXml" TEXT;
ALTER TABLE "payroll_esocial_batches" ADD COLUMN IF NOT EXISTS "transmitResponseXml" TEXT;
