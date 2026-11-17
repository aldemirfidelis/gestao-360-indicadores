-- Documentos (GED) na demonstração pública.
--
-- O perfil DEMO_PUBLIC foi criado quando o GED estava suspenso, por isso ficou
-- sem nenhuma permissão `doc:*`. Recebe agora as permissões de consulta e
-- exportação da família `doc`, a mesma regra do seed da demonstração e do
-- acesso dado a Processos: doc:view, doc:audit, doc:download_pdf e
-- doc:download_docx. A escrita continua bloqueada pelo ProductScopeGuard (o
-- visitante só faz GET/HEAD).
--
-- Aditiva e idempotente: as linhas do catálogo só entram se faltarem (mesmas
-- descrições de permission-catalog.ts) e a concessão não faz nada sem a
-- empresa `demonstracao` ou sem o perfil.

INSERT INTO "Permission" ("id", "key", "description", "module", "action")
VALUES
  (gen_random_uuid()::text, 'doc:view', 'Visualizar documentos', 'Documentos', 'view'),
  (gen_random_uuid()::text, 'doc:audit', 'Visualizar auditoria documental', 'Documentos', 'view'),
  (gen_random_uuid()::text, 'doc:download_pdf', 'Baixar PDF oficial', 'Documentos', 'export'),
  (gen_random_uuid()::text, 'doc:download_docx', 'Baixar DOCX editável', 'Documentos', 'export')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "ProfilePermission" ("profileId", "permissionId")
SELECT ap."id", p."id"
FROM "AccessProfile" ap
JOIN "Company" c ON c."id" = ap."companyId"
JOIN "Permission" p ON p."key" IN ('doc:view', 'doc:audit', 'doc:download_pdf', 'doc:download_docx')
WHERE ap."code" = 'DEMO_PUBLIC'
  AND ap."deletedAt" IS NULL
  AND c."slug" = 'demonstracao'
  AND c."deletedAt" IS NULL
ON CONFLICT ("profileId", "permissionId") DO NOTHING;
