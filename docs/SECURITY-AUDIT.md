# Auditoria de Segurança — Gestão 360

**Data:** 2026-05-30
**Escopo:** Monorepo completo (`apps/api` NestJS, `apps/web` Next.js, `packages/shared`),
conexões (Neon Postgres, Gemini), arquivos versionados no GitHub, configuração de
deploy no Droplet DigitalOcean e gestão de segredos.

---

## Resumo executivo

| Severidade | Achados | Status |
|-----------|---------|--------|
| 🔴 Alta | 2 | ✅ Corrigido em código |
| 🟠 Média | 6 | ✅ Corrigido em código |
| 🟡 Baixa / Operacional | 4 | ⚠️ Ações manuais necessárias (abaixo) |

**Boas notícias confirmadas:**
- ✅ `.env`, `.env.droplet-ready` e demais segredos **nunca** foram commitados no Git (verificado em todo o histórico). Só vão para o GitHub os arquivos `*.example`.
- ✅ `.gitignore` e `.dockerignore` excluem corretamente `.env*` — segredos **não** entram na imagem Docker.
- ✅ Sem SQL bruto (`$queryRaw`/`$executeRaw`): todo acesso via Prisma (sem SQL Injection).
- ✅ Sem `eval`/`child_process`/`exec` no código.
- ✅ Isolamento multi-tenant consistente: queries escopadas por `companyId` derivado do token JWT (não do body/params).
- ✅ Guards globais (`JwtAuthGuard` + `RolesGuard`) → tudo autenticado por padrão; apenas `login`, `refresh` e `health` são `@Public()`.
- ✅ Conexão com Neon usa `sslmode=require` + `channel_binding=require` (SCRAM).
- ✅ Senhas com bcrypt; refresh tokens armazenados como hash SHA-256.
- ✅ No Droplet só o Caddy expõe portas (80/443); API e Web ficam internas à rede Docker.

---

## 🔴 ALTA — corrigido

### A1. Fallback de segredo JWT (`'change-me'`) permitia tokens forjáveis
**Onde:** `jwt.strategy.ts`, `auth.module.ts`, `auth.service.ts`.
O segredo de verificação/assinatura usava `process.env.JWT_ACCESS_SECRET ?? 'change-me'`.
Se a variável faltasse em produção, a API subia silenciosamente com o segredo público
`change-me` — qualquer pessoa poderia **forjar JWTs válidos** e se autenticar como
qualquer usuário (inclusive SUPER_ADMIN).

**Correção:** novo helper `common/env.ts` (`requireSecret`) faz *fail-fast* — a API
não inicia se `JWT_ACCESS_SECRET` estiver ausente ou, em produção, for fraco/valor de
exemplo (<32 chars ou padrões conhecidos). `JwtModule` migrado para `registerAsync`
para resolver o segredo após o carregamento do `.env`.

### A2. Escalonamento de privilégio: COMPANY_ADMIN → SUPER_ADMIN
**Onde:** `users.service.ts` (`create`/`update`), `users.controller.ts`.
O endpoint de update aceitava `@Body() input: any` sem validação e repassava `input.role`
direto ao Prisma. Um COMPANY_ADMIN (com `users:manage`) podia promover a si mesmo ou a
outro usuário a **SUPER_ADMIN** — papel que ignora o escopo de `companyId` e dá acesso a
**todas as empresas** (quebra de isolamento multi-tenant).

**Correção:** `create` e `update` agora lançam `ForbiddenException` se um ator que não é
SUPER_ADMIN tentar atribuir/gerenciar o papel SUPER_ADMIN.

---

## 🟠 MÉDIA — corrigido

### M1. CORS coringa (`*`) combinado com `credentials: true`
**Onde:** `main.ts` + `.env.droplet-ready` (`API_CORS_ORIGIN=*`).
Com origem `*`, o NestJS refletia qualquer origem **com credenciais habilitadas** —
qualquer site poderia fazer requisições credenciadas à API.
**Correção:** quando a origem é coringa, `credentials` agora é desativado e um aviso é
logado em produção. **Ação manual:** definir `API_CORS_ORIGIN=https://gestao360.org` no Droplet (ver abaixo).

### M2. Sem limite anti brute-force no login
**Onde:** `auth.controller.ts`. O throttle global era 200 req/min — permitia ~200 tentativas
de senha por minuto/IP.
**Correção:** `@Throttle` específico → **5 tentativas/min** no `login` e 20/min no `refresh`.

### M3. Vazamento de detalhes internos em erros 500
**Onde:** `http-exception.filter.ts`. Erros não-HTTP retornavam `exception.message` cru ao
cliente (podendo vazar SQL, caminhos, internals).
**Correção:** em produção retorna `"Internal server error"`; detalhe vai só para o log.

### M4. IDOR nos erros de importação
**Onde:** `imports.service.ts`/`imports.controller.ts`. `GET /imports/jobs/:id/errors`
não checava `companyId` — um usuário podia ler payloads de importação de **outra empresa**
enumerando `jobId`.
**Correção:** `jobErrors` agora valida que o job pertence à empresa do usuário.

### M5. Container da API rodando como root
**Onde:** `apps/api/Dockerfile`. A imagem de runtime não trocava de usuário (o Web já fazia).
**Correção:** adicionado `USER node` (não-root) no estágio de runtime.

### M6. Faltavam cabeçalhos de segurança no frontend
**Onde:** `apps/web/next.config.mjs`. O Next não enviava `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, `HSTS`, e expunha `X-Powered-By`.
**Correção:** `headers()` + `poweredByHeader: false` adicionados.

---

## 🟡 BAIXA / OPERACIONAL — requer ação manual

### O1. ⚠️ Segredos reais em arquivos locais — avaliar rotação
`.env` e `.env.droplet-ready` contêm credenciais **reais** de produção (senha do Neon,
segredos JWT de prod, `GEMINI_API_KEY`). Eles **não** estão no Git, então não vazaram pelo
GitHub. Porém, **se** esses arquivos já foram compartilhados (chat, backup, e-mail), faça a
rotação:
- **Neon:** rotacionar a senha do role `neondb_owner` no painel Neon e atualizar `DATABASE_URL`/`DIRECT_URL`.
- **Gemini:** revogar/recriar a `GEMINI_API_KEY` no Google AI Studio.
- **JWT:** gerar novos `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (`openssl rand -base64 48`) — invalida sessões ativas.

### O2. ⚠️ Definir `API_CORS_ORIGIN` no Droplet
No `.env` do servidor, troque `API_CORS_ORIGIN=*` por `API_CORS_ORIGIN=https://gestao360.org`.
(No deploy atual o front chama `/api` na mesma origem via Caddy, então CORS nem é necessário.)

### O3. Dependências vulneráveis — parcialmente resolvido nesta auditoria

Evolução do `pnpm audit`:

| Momento | Crítica | Alta | Moderada | Baixa |
|---------|--------:|-----:|---------:|------:|
| Antes | 2 | 21 | 27 | 5 |
| jspdf@4.2.1 + next@14.2.35 | 0 | 13 | 18 | 5 |
| **Final** (+ next@15.5.18) | **0** | **7** | **11** | **3** |

**Feito (verificado com `tsc --noEmit` + smoke test de geração de PDF):**
- ✅ **jspdf** `2.5.2 → 4.2.1` + **jspdf-autotable** `3.8.4 → 5.0.8` → elimina as **2 críticas** (HTML/PDF injection, path traversal) e o XSS do dompurify transitivo. API usada (`new jsPDF`, `text`, `autoTable`, `lastAutoTable.finalY`, `save`) validada em runtime.
- ✅ **next** `14.2.13 → 14.2.35 → 15.5.18` → **zera todas as CVEs do `next`** (DoS Image Optimizer, SSRF WebSocket upgrade, bypass middleware i18n, cache poisoning, XSS CSP nonce). React mantido em 18.3.1 (peer do Next 15 aceita ^18). Migração sem breaking changes de código (app é client-side com Bearer token; sem `cookies()`/`headers()`/`params` async). `next.config`: `outputFileTracingRoot` movido para top-level.

**Deployado em produção** (gestao360.org) e verificado: api+web `healthy`, `/api/health` 200, headers de segurança ativos, web rodando Next 15.5.18.

**Pendente (baixo risco — opcional):**
- ⚠️ Transitivas fora do caminho de exploração do app (7 high restantes): `multer` (não usamos upload), `lodash`/`glob`/`picomatch`/`tmp` (uso interno/build). Podem ser tratadas com `pnpm.overrides` no `package.json` raiz, testando o build a cada override.
- `esbuild`/`vite`/`webpack` — apenas dev-server; sem impacto no runtime de produção.

> Nota de build: o passo `RUN chown -R node:node /app` no Dockerfile da API adiciona ~3min ao build (chown do node_modules). Otimização futura: usar `COPY --chown` nos estágios em vez de chown recursivo.

### O4. ⚠️ Endurecimento operacional do Droplet (recomendado)
- Firewall (ufw/DO Cloud Firewall): permitir só 22, 80, 443; **bloquear acesso direto** a portas internas.
- SSH: apenas chave (sem senha), `PermitRootLogin no`, fail2ban.
- `request_body max_size 50MB` no Caddy é alto para JSON de import — considerar limite menor por rota.
- Tokens JWT ficam em `localStorage` (exposição a XSS). Mitigado por React (sem `dangerouslySetInnerHTML`) e pelos headers de M6; avaliar cookies httpOnly como reforço futuro.

---

## Arquivos alterados nesta auditoria
- `apps/api/src/common/env.ts` *(novo)* — `requireSecret` fail-fast.
- `apps/api/src/modules/auth/{jwt.strategy,auth.module,auth.service,auth.controller}.ts`
- `apps/api/src/modules/users/{users.service,users.controller}.ts`
- `apps/api/src/modules/imports/{imports.service,imports.controller}.ts`
- `apps/api/src/common/filters/http-exception.filter.ts`
- `apps/api/src/main.ts`
- `apps/api/Dockerfile`
- `apps/web/next.config.mjs`

Validação: `tsc --noEmit` da API passou sem erros.
