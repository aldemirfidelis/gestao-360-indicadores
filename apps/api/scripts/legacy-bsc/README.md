# Migração BSC legado → gestão-360

ETL do app Windows **"Balanced Scorecard" (SQL Server)** para o gestão-360 (Postgres).

## Princípios de segurança

- **Nunca** apontar para o banco de **produção** da usina. Trabalhar sempre sobre
  um **backup `.bak` restaurado em uma instância isolada** (Docker/SQL Express local).
- Usar um login **somente leitura** (`db_datareader`). O ETL é **unidirecional**:
  SQL Server (leitura) → transformação → Postgres. Nunca escreve no legado.
- Credenciais **somente via variáveis de ambiente** — não commitar segredos.
- A carga roda em **DRY-RUN por padrão** (`BSC_DRY_RUN=true`). Só grava quando
  você define `BSC_DRY_RUN=false` explicitamente.

## Pré-requisitos

1. Backup do BSC restaurado em um SQL Server acessível (ex.: container
   `mcr.microsoft.com/mssql/server` ou SQL Express).
2. `pnpm install` (instala o driver `mssql`).
3. Migration `externalId/externalSource` aplicada no Postgres:
   `pnpm --filter @g360/api prisma:deploy` (ou `prisma migrate dev`).
4. O `Company.id` de destino no gestão-360 (a empresa que receberá os dados).

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `BSC_SQL_SERVER` | sim | host do SQL Server (backup) |
| `BSC_SQL_PORT` | não (1433) | porta |
| `BSC_SQL_DATABASE` | sim | nome do banco restaurado |
| `BSC_SQL_USER` / `BSC_SQL_PASSWORD` | sim | login read-only |
| `BSC_SQL_ENCRYPT` | não (false) | TLS; geralmente off em backup local |
| `BSC_TARGET_COMPANY_ID` | sim (migrate) | `Company.id` destino no Postgres |
| `BSC_SOURCE_LABEL` | não ("BSC 1.43") | rótulo gravado em `externalSource` |
| `BSC_DRY_RUN` | não (true) | `false` para efetivar a gravação |
| `BSC_TARGET_DATABASE_URL` | não | destino do Postgres; se ausente usa o `DATABASE_URL` da app. No Neon, use a conexão **direta** (sem `-pooler`). |

## Estratégia de destino (local → Neon → banco novo)

O mesmo ETL idempotente serve a todos os ambientes, trocando só `BSC_TARGET_DATABASE_URL`:

1. **Local** (`pnpm db:up`): construir, validar e iterar à vontade. `BSC_TARGET_DATABASE_URL`
   aponta para o Postgres do Docker (ou deixe vazio se o `.env` já apontar local).
2. **Neon atual**: com os dados OK, rodar de novo apontando para a **conexão direta** do Neon.
   Como o casamento é por `externalSource`+`externalId`, não duplica.
3. **Banco novo/dedicado** (após aprovação do projeto da usina): mesmo run, nova URL.

Em produção (Neon) prefira rodar antes contra uma **branch do Neon** para validar sem risco.

## Passo a passo

### 1. Introspecção (mapear o banco deles)

```bash
BSC_SQL_SERVER=localhost BSC_SQL_DATABASE=BSC \
BSC_SQL_USER=ro_user BSC_SQL_PASSWORD=*** \
pnpm --filter @g360/api exec tsx scripts/legacy-bsc/introspect.ts
```

Gera `scripts/legacy-bsc/output/introspect-<timestamp>.json` com tabelas, colunas,
FKs, contagem de linhas e amostras. **É o insumo para o próximo passo.**

### 2. Mapear as queries de extração

Com o JSON em mãos, preencher as três queries marcadas com
`__PREENCHER_APOS_INTROSPECCAO__` em `migrate.ts` (`extractAreas`,
`extractIndicators`, `extractValues`) e confirmar o **De-Para** em `de-para.ts`
(valores reais de unidade, cardinalidade e periodicidade).

### 3. Dry-run (validar sem gravar)

```bash
BSC_SQL_SERVER=localhost BSC_SQL_DATABASE=BSC \
BSC_SQL_USER=ro_user BSC_SQL_PASSWORD=*** \
BSC_TARGET_COMPANY_ID=<uuid-da-empresa> \
pnpm --filter @g360/api exec tsx scripts/legacy-bsc/migrate.ts
```

Mostra os contadores (áreas, indicadores, metas, resultados) e lista qualquer
valor **não mapeado** no De-Para. Revisar antes de gravar.

### 4. Carga efetiva (idempotente)

```bash
... BSC_DRY_RUN=false pnpm --filter @g360/api exec tsx scripts/legacy-bsc/migrate.ts
```

Casamento por `(companyId, externalSource, externalId)` — pode rodar quantas
vezes precisar sem duplicar. Indicadores ficam marcados com
`feedKind=DATABASE` e `source="BSC 1.43"`.

## Arquivos

- `config.ts` — conexão SQL Server + parâmetros do ETL (via env).
- `introspect.ts` — dump do schema legado (passo 1).
- `de-para.ts` — tradução unidade/cardinalidade/periodicidade → enums do gestão-360.
- `migrate.ts` — extração → transformação → carga idempotente.
