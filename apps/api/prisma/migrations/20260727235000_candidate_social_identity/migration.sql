-- Contas sociais (Google/LinkedIn) ligadas ao candidato do portal de vagas.
-- O vínculo é pelo id do provedor; o e-mail fica só para diagnóstico.
CREATE TABLE IF NOT EXISTS "recruit_candidate_identities" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastLoginAt" TIMESTAMP(3),
  CONSTRAINT "recruit_candidate_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recruit_candidate_identities_provider_providerAccountId_key"
  ON "recruit_candidate_identities" ("provider", "providerAccountId");

CREATE INDEX IF NOT EXISTS "recruit_candidate_identities_candidateId_idx"
  ON "recruit_candidate_identities" ("candidateId");

DO $$
BEGIN
  ALTER TABLE "recruit_candidate_identities"
    ADD CONSTRAINT "recruit_candidate_identities_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "recruit_candidates" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
