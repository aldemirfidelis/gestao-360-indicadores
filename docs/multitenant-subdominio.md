# Multi-tenant por subdomínio — Fase 1

Cada empresa pode acessar a plataforma por um endereço próprio
(`goiasa.gestao360.org`) ou domínio próprio white-label
(`indicadores.goiasa.com.br`). O **isolamento de dados continua igual**: o tenant
é derivado da **identidade** do usuário no backend (`effective-company.ts`). O host
serve para **branding da tela de login** e para **validar** que o usuário pertence
à empresa daquele endereço (defesa em profundidade — não é controle de acesso a dados).

## O que foi implementado (código)

- **`Company.slug`** (subdomínio) e **`Company.customDomain`** (white-label), únicos e
  nullable — migration `20260625120000_company_tenant_slug`.
- **Resolução por host**: `src/common/tenant-host.ts` + `modules/public/tenant.service.ts`.
- **Endpoint público** (`@Public`, sem auth):
  - `GET /api/public/tenant?host=<host>` → `{ tenant: { companyId, name, slug, logoUrl } | null }` (branding).
  - `GET /api/public/tenant/allow?domain=<host>` → 2xx só para hosts de um tenant conhecido (endpoint *ask* do TLS on-demand do Caddy).
- **Login por host**: `POST /api/auth/login` aceita `host`; se o host mapear um tenant e o
  usuário não for desse tenant, login é recusado. `SUPER_ADMIN` é isento.
- **Frontend**: a tela de `/login` busca o branding por host (`lib/tenant.ts`) e envia o
  `host` no login (`auth-provider.tsx`).
- **Caddy**: bloco global `on_demand_tls { ask ... }` + site `*.gestao360.org` (mesmos
  containers do apex). Hostnames exatos (apex, `www`, `collabora`) têm precedência.
- **Env**: `PLATFORM_ROOT_DOMAIN` (default `gestao360.org`).

## Passos manuais para ativar (produção)

1. **DNS**: criar registro curinga `*.gestao360.org` → IP do droplet (mesmo IP do apex).
2. **Migration**: aplicar `20260625120000_company_tenant_slug` no Postgres de produção
   (`prisma migrate deploy`). **Ainda não aplicada** — requer autorização.
3. **Backfill de slug** das empresas existentes:
   `pnpm -C apps/api exec tsx prisma/backfill-company-slug.ts`
   (idempotente; só preenche slug nulo. Ex.: Goiasa → `goiasa`).
4. **Deploy do Caddyfile** atualizado (recarrega o proxy).
5. **Validar**: acessar `https://goiasa.gestao360.org` → tela de login com a marca da Goiasa;
   login de usuário de outra empresa deve ser recusado.

## Domínio próprio (white-label)

O endpoint *ask* já resolve `customDomain`. Para ativar um domínio de cliente:
- o cliente aponta um CNAME (ex.: `indicadores.goiasa.com.br`) para o droplet;
- preencher `Company.customDomain` com o host completo;
- adicionar um bloco de site no Caddy para esse host (ou um catch-all com `on_demand`).
O TLS é emitido automaticamente no primeiro acesso (validado pelo *ask*).

## Follow-ups (próximas fases)

- Expor `slug`/`customDomain` no cadastro/edição de empresa (hoje via backfill/DB).
- SSO/SAML por tenant (o subdomínio é o roteador para o IdP do cliente).
- Catch-all de domínios próprios no Caddy, se a quantidade crescer.
