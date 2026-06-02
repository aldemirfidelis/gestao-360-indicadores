# Administração do Banco de Dados (Configurações > Banco de Dados)

> Funcionalidade administrativa para o Super Admin operar o banco diretamente pelo
> Gestão 360 (visualizar/editar tabelas, registros, estrutura, índices, SQL, importação/
> exportação, backups, auditoria e diagnósticos), sem depender de DBeaver/pgAdmin.

## 1. Objetivo
Centralizar a administração do banco em uma área protegida, segura e auditável,
exclusiva do perfil **Super Admin**.

## 2. Banco e arquitetura (estado real)
- **Banco**: PostgreSQL gerenciado (Neon). Apesar do nome do repositório, **não há SQLite**.
- A camada de adaptação é **PostgreSQL-first**; `SqliteAdapter` é um stub documentado para o futuro.
- **Backend**: módulo NestJS `apps/api/src/modules/database-admin`.
- **Frontend**: rotas `apps/web/app/(app)/settings/database/*` + componentes em `apps/web/components/database-admin`.
- O SQL administrativo usa um **PrismaClient dedicado apontando para `DIRECT_URL`** (conexão não-pooled),
  evitando as limitações do pooler (pgBouncer) com transações/DDL/SET de sessão.

## 3. Segurança (defesa em profundidade)
- **Acesso**: gate no backend via `SuperAdminDbGuard` (controller-level) — exige `role = SUPER_ADMIN`
  e **registra toda tentativa (inclusive `DENIED`)** em `DbAdminAuditLog`. Bloqueia acesso direto por URL/endpoint.
- **Frontend**: 3 camadas — `RoutePermissionGate` (permissão `database:admin`, nunca concedida → só Super Admin pelo bypass),
  guarda de role no `layout.tsx` e o card só aparece para Super Admin em Configurações.
- **SQL injection**: identificadores (tabela/coluna) validados por regex estrita **+ allowlist da introspecção**
  e quotados; valores sempre via **bind parametrizado (`$1,$2…`)**. Ver `util/identifier.util.ts`.
- **Leitura segura**: toda leitura roda em transação `READ ONLY` com `statement_timeout` (mesmo que a
  classificação fosse burlada, o Postgres recusa escrita).
- **Redação**: SQL/valores gravados na auditoria têm `password/token/secret/...` redigidos. Nunca se expõe
  string de conexão/credenciais (a Visão Geral mostra só o nome lógico e a versão do engine).
- **Tabelas críticas** (`User`, `Permission`, `AuditLog`, `_prisma_migrations`, `DbAdmin*`, …): proteção
  adicional para ações destrutivas (ver `database-admin.constants.ts`).

## 4. Tabelas administrativas (migration `20260602000000_database_admin`, aditiva)
- `DbAdminAuditLog` — auditoria de todas as ações (inclui acessos negados).
- `DbAdminBackup` — metadados de snapshots lógicos.
- `DbAdminSavedQuery` — consultas salvas/favoritas.
- `DbAdminQueryHistory` — histórico de execuções do editor SQL.

## 5. Telas (12 submenus em acordeon)
| Submenu | Rota | Status |
|---|---|---|
| Visão Geral | `/settings/database` | ✅ implementada |
| Tabelas | `/settings/database/tables` | ✅ implementada (listagem, busca, ordenação, flags de protegida) |
| Estrutura por tabela | `/settings/database/tables/[table]` | ✅ implementada (colunas, constraints, índices) |
| Estrutura e Relacionamentos (ER) | `/settings/database/structure` | ✅ implementada (ReactFlow + export PNG/PDF) |
| Índices e Constraints | `/settings/database/indexes` | ✅ implementada (visualização) |
| Integridade e Diagnóstico | `/settings/database/diagnostics` | ✅ implementada (análise read-only) |
| Editor de Registros | `/settings/database/records` | ⏳ Fase C |
| Editor SQL | `/settings/database/sql` | ⏳ Fase D |
| Construtor Visual de Consultas | `/settings/database/query-builder` | ⏳ Fase D |
| Importar e Exportar | `/settings/database/import-export` | ⏳ Fase F |
| Backup e Restauração | `/settings/database/backups` | ⏳ Fase G |
| Auditoria administrativa | `/settings/database/audit` | ⏳ Fase G |
| Configurações Avançadas | `/settings/database/advanced` | ⏳ Fase G |

## 6. Endpoints implementados
- `GET /api/admin/database/overview`
- `GET /api/admin/database/tables`
- `GET /api/admin/database/tables/:table/schema`
- `GET /api/admin/database/schema` · `GET /api/admin/database/relationships` · `GET /api/admin/database/indexes`
- `GET /api/admin/database/diagnostics` · `POST /api/admin/database/diagnostics/run`

(Endpoints de registros, query, import/export, backup e audit serão adicionados nas Fases C–G,
seguindo o mesmo guard e auditoria.)

## 7. Serviços (backend)
`PostgreSQLAdapter`, `SchemaInspectionService`, `OverviewService`, `DiagnosticsService`,
`DbAdminAuditService`, `SuperAdminDbGuard` (+ `SqliteAdapter` stub). Demais serviços
(`RecordManagementService`, `QueryValidationService`, `QueryExecutionService`, `TableManagementService`,
`BackupService`, `ImportService`, `ExportService`) entram nas próximas fases.

## 8. Backup/Restauração — PostgreSQL/Neon
- Backup/restore de **banco inteiro** **não** é executado pela tela. Para recuperação completa use o
  **branching/Point-in-Time-Recovery (PITR) da Neon** (procedimento documentado/operacional).
- Snapshots **lógicos por operação** (JSON/SQL das tabelas/linhas afetadas) serão gerados automaticamente
  antes de operações destrutivas (Fases C/E/F/G), permitindo rollback no nível da operação.
- Diretório de backups: `DB_ADMIN_BACKUP_DIR` (default `apps/api/storage/db-admin-backups`, fora do banco e
  gitignored). **No Droplet, montar um volume persistente** (container é efêmero).

## 9. Limitações do PostgreSQL gerenciado
- Pooler (pgBouncer) não suporta de forma confiável DDL/transações interativas → usamos `DIRECT_URL`.
- `pg_dump`/`pg_restore` não estão disponíveis no container de runtime → backup/restore total via Neon (PITR).

## 10. Como testar (banco de desenvolvimento isolado em Docker)
> **Nunca** rodar operações destrutivas contra a Neon de produção.
```bash
# 1) Sobe o Postgres local (serviço já existe no docker-compose.yml)
docker compose up -d postgres
# 2) Aponta o ambiente de teste para o banco local
#    DATABASE_URL=postgresql://g360:g360@localhost:5432/g360
#    DIRECT_URL=postgresql://g360:g360@localhost:5432/g360
# 3) Aplica as migrations e seed
pnpm --filter @g360/api prisma migrate deploy
pnpm --filter @g360/api prisma:seed
# 4) Sobe API + Web e acesse como Super Admin: Configurações > Banco de Dados
```
Testes unitários da lógica de segurança (sem banco):
```bash
pnpm --filter @g360/api exec vitest run src/modules/database-admin/util/security.spec.ts
```

## 11. Roadmap (próximas fases)
- **C** — Editor de Registros (CRUD parametrizado, exclusão em massa, snapshot+auditoria).
- **D** — Editor SQL (modo seguro/avançado com confirmação reforçada) + `QueryValidationService` + Construtor Visual.
- **E** — Edição estrutural (DDL) com SQL preview, snapshot, transação, rollback e auditoria.
- **F** — Importar/Exportar (CSV/JSON/Excel/SQL) com prévia, mapeamento e estratégias.
- **G** — Backups (snapshots lógicos), Auditoria administrativa e Configurações Avançadas.
