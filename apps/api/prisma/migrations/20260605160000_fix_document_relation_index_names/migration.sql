-- Alinha os nomes dos índices de `document_relations` ao que o Prisma gera a
-- partir do schema. A migration de fundação GED criou os índices com nomes que
-- o Postgres truncou para 63 caracteres de forma diferente da truncagem do
-- Prisma, gerando drift (cosmético) entre schema e banco. Renomeia para casar.

-- RenameIndex
ALTER INDEX "document_relations_companyId_relatedEntityType_relatedEntityId_" RENAME TO "document_relations_companyId_relatedEntityType_relatedEntit_idx";

-- RenameIndex
ALTER INDEX "document_relations_documentId_relatedEntityType_relatedEntityId" RENAME TO "document_relations_documentId_relatedEntityType_relatedEnti_key";
