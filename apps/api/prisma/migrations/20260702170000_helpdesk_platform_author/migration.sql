-- HelpDesk do Portal Global: respostas de atendentes da plataforma
-- (platformAdminUser, modelo separado de User). Torna userId opcional e
-- adiciona o autor textual da plataforma. Aditivo e retrocompatível.
ALTER TABLE "SupportTicketMessage" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "SupportTicketMessage" ADD COLUMN "authorName" TEXT;
ALTER TABLE "SupportTicketMessage" ADD COLUMN "authorRole" TEXT;

-- A FK de userId passa a permitir NULL (mantém integridade quando preenchida).
ALTER TABLE "SupportTicketMessage" DROP CONSTRAINT IF EXISTS "SupportTicketMessage_userId_fkey";
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
