# Auditoria de Seguranca - Gestao 360

**Data original:** 2026-05-30
**Atualizacao operacional:** 2026-06-20
**Escopo:** monorepo completo (`apps/api`, `apps/web`, `packages/shared`), Postgres local no droplet, Neon legado, Gemini, Docker/Caddy e gestao de segredos.

## Resumo executivo

| Severidade | Achados | Status |
|-----------|---------|--------|
| Alta | 2 | Corrigido em codigo |
| Media | 6 | Corrigido em codigo |
| Baixa / operacional | 5 | Requer verificacao manual recorrente |

Boas noticias confirmadas:

- `.env`, `.env.droplet-ready` e demais segredos reais continuam ignorados por Git e Docker.
- `.gitignore` e `.dockerignore` excluem `.env*`, preservando apenas `*.example`.
- Sem SQL bruto amplo no caminho operacional; o acesso principal usa Prisma.
- Guards globais protegem rotas por padrao; `login`, `refresh` e `health` sao publicos.
- Senhas usam bcrypt e refresh tokens sao armazenados como hash SHA-256.
- No droplet, somente o Caddy deve expor portas publicas; API, Web e Postgres ficam na rede Docker.
- Producao atual usa Postgres local no droplet (`postgres:5432`). Neon e legado/desenvolvimento, salvo decisao explicita.

## Alta - corrigido em codigo

### A1. Fallback de segredo JWT permitia tokens forjaveis

Antes, JWT podia cair em valor de exemplo. A API agora usa `requireSecret` e falha no boot quando `JWT_ACCESS_SECRET` esta ausente ou fraco em producao.

Arquivos envolvidos:

- `apps/api/src/common/env.ts`
- `apps/api/src/modules/auth/jwt.strategy.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/auth.service.ts`

### A2. Escalonamento COMPANY_ADMIN -> SUPER_ADMIN

`users.service.ts` agora bloqueia atores que nao sao `SUPER_ADMIN` ao tentar criar/alterar usuarios com papel `SUPER_ADMIN`.

## Media - corrigido em codigo

### M1. CORS coringa com credenciais

Quando `API_CORS_ORIGIN=*`, a API desabilita `credentials`. Em producao, a configuracao recomendada e:

```text
API_CORS_ORIGIN=https://gestao360.org
```

### M2. Brute force no login

`auth.controller.ts` usa throttle especifico para login e refresh.

### M3. Vazamento de erro 500

`http-exception.filter.ts` retorna mensagem generica em producao e deixa detalhe apenas em log.

### M4. IDOR em erros de importacao

`imports.service.ts` valida `companyId` antes de retornar erros de jobs de importacao.

### M5. Container da API como root

`apps/api/Dockerfile` roda runtime com `USER node`.

### M6. Headers de seguranca no frontend

`apps/web/next.config.mjs` define headers de seguranca e remove `X-Powered-By`.

## Baixa / operacional - verificar manualmente

### O1. Segredos e rotacao

Arquivos reais `.env*` nao devem ser publicados. Foi encontrado um diff historico versionado com URL antiga da Neon; o artefato foi sanitizado nesta rodada, mas a credencial antiga deve ser tratada como exposta se o repo ja foi enviado para fora da maquina.

Acoes:

- Postgres local: trocar `POSTGRES_PASSWORD` em janela controlada se o `.env` foi compartilhado.
- Neon legado: se ainda existir/for usado, rotacionar senha do role no painel Neon.
- Gemini: revogar/recriar `GEMINI_API_KEY` se a chave foi compartilhada.
- JWT: gerar novos `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` se houve compartilhamento de `.env`; isso invalida sessoes ativas.

### O2. CORS do droplet

No `.env` do servidor:

```text
API_CORS_ORIGIN=https://gestao360.org
```

### O3. Firewall

Expor apenas:

- `22/tcp` para SSH.
- `80/tcp` e `443/tcp` para Caddy.

Postgres (`5432`), API (`3333`) e Web (`3000`) devem ficar sem porta publica.

### O4. SSH e host hardening

Recomendado:

- SSH apenas por chave.
- `PasswordAuthentication no`.
- `PermitRootLogin prohibit-password` ou usuario administrativo sem root direto, conforme politica operacional.
- fail2ban ativo.

### O5. Tokens no navegador

JWT ainda fica em `localStorage`, o que aumenta impacto de XSS. Mitigacoes atuais: React, sem `dangerouslySetInnerHTML` relevante, headers de seguranca. Evolucao recomendada: migrar access/refresh para cookies `httpOnly` com CSRF protection.

### O6. Dependencias e upgrades

`pnpm audit` deve ser executado de forma recorrente antes de releases maiores e em janelas de manutencao. Resultado local de 2026-06-20:

- Total: 39 vulnerabilidades.
- Severidade: 1 critica, 13 altas, 19 moderadas, 6 baixas.
- Principais pacotes reportados: `vitest`, `xlsx`, `multer`, `glob`, `lodash`, `nodemailer`, `vite`, `picomatch`, `dompurify`, `webpack`, `esbuild`.

Plano recomendado:

- Atualizar `vitest` em todos os workspaces e validar a suite local.
- Substituir ou isolar uso de `xlsx`, pois o advisory reporta ausencia de versao corrigida na linha publicada.
- Avaliar overrides transitivos para `multer`, `lodash`, `glob`, `picomatch`, `dompurify`, `webpack` e `esbuild` apenas em branch propria, com `pnpm install`, typecheck, testes e build completos.
- Nao aplicar overrides diretamente em producao sem validar compatibilidade de Nest/Next/Vite.
- Prisma atual: `@prisma/client`/`prisma` 5.x. Upgrade para Prisma 7 deve ser planejado em etapas: 5 -> 6 -> 7, seguindo os guias oficiais:
  - https://www.prisma.io/docs/guides/upgrade-prisma-orm/v6
  - https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7

## Validacoes recomendadas antes de deploy

```bash
pnpm --filter @g360/api exec prisma validate
pnpm --filter @g360/api exec tsc --noEmit --pretty false
pnpm --filter @g360/web exec tsc --noEmit
pnpm audit
pnpm --filter @g360/api test
pnpm test:e2e
```

No droplet:

```bash
cd /opt/gestao-360-indicadores
grep -E '^(DATABASE_URL|DIRECT_URL)=' .env | grep '@postgres:5432'
docker compose -f docker-compose.droplet.yml exec -T api ./node_modules/.bin/prisma migrate status
docker compose -f docker-compose.droplet.yml ps
```
