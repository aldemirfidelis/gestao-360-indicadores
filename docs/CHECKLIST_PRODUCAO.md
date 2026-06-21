# Checklist de producao

## Antes do deploy

- Confirmar branch e commits a publicar.
- Rodar `git status --short` e garantir arvore limpa.
- Rodar `pnpm --filter @g360/api exec prisma validate`.
- Rodar `pnpm --filter @g360/api exec tsc --noEmit --pretty false`.
- Rodar `pnpm --filter @g360/web exec tsc --noEmit`.
- Rodar `pnpm audit` e registrar/aceitar explicitamente qualquer pendencia antes do deploy.
- Rodar `pnpm --filter @g360/api test`.
- Rodar `pnpm e2e:install` quando o Chromium do Playwright ainda nao estiver instalado.
- Rodar `pnpm test:e2e`.
- Rodar `pnpm build` quando o ambiente local tiver recursos suficientes para build completo. No Windows, o build web pode falhar no passo final de standalone por permissao de symlink; o build real de producao deve rodar em Linux/Docker.

## Migrations

Producao vigente: Postgres local no droplet (`postgres:5432` na rede Docker), nao Neon.

Antes de deploy, confirmar no servidor:

```bash
cd /opt/gestao-360-indicadores
grep -E '^(DATABASE_URL|DIRECT_URL)=' .env | grep '@postgres:5432'
docker compose -f docker-compose.droplet.yml exec -T api ./node_modules/.bin/prisma migrate status
```

O status esperado e `Database schema is up to date!` com todas as migrations do repo.

Aplicar migrations apenas pelo fluxo de deploy ou por janela controlada:

```bash
bash scripts/deploy.sh
# ou, manualmente no droplet:
docker compose -f docker-compose.droplet.yml exec -T api ./node_modules/.bin/prisma migrate deploy
```

## Variaveis de ambiente

Conferir:

- `DATABASE_URL` e `DIRECT_URL` apontando para `postgres:5432`.
- `API_CORS_ORIGIN=https://gestao360.org`.
- `JWT_ACCESS_SECRET`.
- `JWT_REFRESH_SECRET`.
- `NEXT_PUBLIC_API_URL`.
- credenciais SMTP, se envio de e-mail estiver ativo.
- chaves de IA/Google/Microsoft, quando integracoes estiverem habilitadas.

## Seguranca

- Confirmar que o usuario Super Admin esta protegido por senha forte.
- Confirmar firewall expondo somente 22, 80 e 443.
- Confirmar SSH apenas por chave e fail2ban ativo.
- Revisar vulnerabilidades de dependencias (`pnpm audit`); overrides transitivos so entram com typecheck, testes e build completos.
- Planejar upgrade Prisma 5 -> 6 -> 7 em branch propria, seguindo os guias oficiais e validando migrations em ambiente clone antes de producao.
- Verificar perfis padrao em `permission-catalog.ts`.
- Validar bloqueios de `/settings/database` e `/settings/portal`.
- Conferir `AccessService` em modulos novos quando houver area/indicador/processo.
- Conferir `docs/SEGURANCA.md` e `docs/ARQUITETURA_MULTIEMPRESA_E_PERMISSOES.md`.
- Nao expor `.env`, tokens ou credenciais em logs de CI/CD.

## Pos-deploy

- Conferir `/api/health`.
- Entrar com usuario administrativo.
- Verificar navegacao dos modulos FASE 6.
- Validar Auditorias, Processos/SIPOC e Formularios/Checklists.
- Validar pelo menos um deep-link da timeline do indicador.
- Conferir `prisma migrate status`.
- Monitorar logs da API durante os primeiros acessos.
- Registrar resultado final em `docs/GATES_FASES_IMPLEMENTADAS.md` se houver novo deploy ou validacao completa.
