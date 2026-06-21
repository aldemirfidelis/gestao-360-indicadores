# Documentacao - fonte de verdade viva

Ultima atualizacao: 2026-06-20.

Leia esta pagina primeiro quando entrar no projeto. Ela consolida o estado operacional atual e aponta para os documentos que ainda valem para build, testes, deploy e decisoes de produto.

## Stack atual

| Camada | Estado atual |
| --- | --- |
| Monorepo | `pnpm` workspaces com `apps/api`, `apps/web` e `packages/shared` |
| Frontend | Next.js 15.5, React 18, TypeScript, Tailwind, Recharts, React Flow, TanStack Query |
| Backend | NestJS 10.4, Prisma 5, Passport JWT, Helmet, Throttler |
| Banco | PostgreSQL 17 em producao no droplet; schema Prisma com ~370 models e ~167 enums (371/167 em 2026-06-20) |
| Cache/Fila | Redis 7 |
| Infra | Docker Compose no droplet, Caddy como proxy reverso/SSL |

Observacao importante: o nome local `gestao-indicadores-sqlite` e historico. O produto atual nao usa SQLite como banco operacional.

## Producao

Producao fica em um Droplet DigitalOcean com os containers definidos em `docker-compose.droplet.yml`.

- Dominio principal: `https://gestao360.org`.
- Diretorio no servidor: `/opt/gestao-360-indicadores`.
- Banco de producao: PostgreSQL local no proprio droplet, host interno `postgres:5432`.
- Redis: container local no mesmo compose.
- Deploy padrao: rodar o gate local/CI, depois `bash scripts/deploy.sh` no droplet.

Neon foi origem/legado de migracao. Nao trate Neon como banco padrao de producao sem uma decisao explicita nova.

## Como subir local

```bash
pnpm install
cp .env.example .env
pnpm shared:build
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

No Windows, use `Copy-Item .env.example .env` no lugar de `cp`. Antes de rodar E2E local, confirme que `.env` aponta para um banco local de teste, nao para producao.

## Gate antes de deploy

Antes de qualquer deploy, use o checklist de producao e rode:

```bash
pnpm --filter @g360/api exec prisma validate
pnpm --filter @g360/api exec tsc --noEmit --pretty false
pnpm --filter @g360/web exec tsc --noEmit
pnpm --filter @g360/api test
pnpm e2e:install
pnpm test:e2e
pnpm build
```

Nota do ambiente: no Windows, o build standalone do Next pode falhar na etapa final de symlink. O criterio de producao e o build em Linux/Docker/CI.

## Deploy e verificacao

```bash
ssh root@159.89.91.222
cd /opt/gestao-360-indicadores
grep DATABASE_URL .env
docker compose -f docker-compose.droplet.yml exec api pnpm exec prisma migrate status
bash scripts/deploy.sh
```

O `DATABASE_URL` de producao deve apontar para `postgres:5432`. O deploy so fica aprovado quando `prisma migrate status` nao mostra pendencias e os modulos FASE 6 continuam respondendo em producao.

## Docs essenciais

- [README raiz](../README.md): visao geral, setup rapido, modulos e comandos.
- [Memoria operacional do Codex](./CODEX_MEMORIA_OPERACIONAL.md): contexto obrigatorio antes de qualquer tarefa neste repo.
- [Checklist de producao](./CHECKLIST_PRODUCAO.md): gate antes de deploy e verificacoes no droplet.
- [Deploy no droplet](../DEPLOY-DROPLET.md): provisionamento e rotina operacional do servidor.
- [Auditoria de seguranca](./SECURITY-AUDIT.md): acoes manuais e hardening.
- [Arquitetura Gestao 360](./arquitetura-gestao-360.md): decisoes de arquitetura e rastreabilidade.
- [Fluxo de tratativa](./fluxo-tratativa-indicador-fora-meta.md): decisao atual `/treatments -> /actions`.
- [Portal Admin](./portal-admin.md): modulos por empresa, flags, guardas e overlay de navegacao.

## Decisoes atuais de produto

- Tratativa de indicador fora da meta existe como orquestracao tecnica (`TreatmentCase`), mas a experiencia do usuario fica em Plano de Acao: `/treatments` redireciona para `/actions`.
- Mapa de relacoes pertence ao contexto de estrategia/mapa estrategico; nao deve virar modulo de produto separado.
- Modulos por empresa sao controlados pelo Portal Admin/Platform Admin via planos, overrides e feature flags.
- Producao usa Postgres local no droplet. Neon e historico.

## Docs que precisam revisao antes de virar referencia

| Documento | Motivo |
| --- | --- |
| `docs/BANCO_LOCAL_DROPLET.md` | Historico da migracao; pode conter comparativos com Neon e estados antigos. |
| `docs/database-admin.md` | Ainda descreve backup/PITR e administracao como se Neon fosse padrao. |
| `docs/DER_BANCO_DADOS.md` | Pode listar pendencias antigas de migrations e volume de entidades desatualizado. |
| `docs/DIAGNOSTICO_COMPLETO_ESTADO_ATUAL.md` | Registro historico; nao usar como estado atual de producao. |
| `docs/fluxograma-completo.md` | Grande e visual; conferir contra as decisoes recentes antes de usar como fonte unica. |
| `docs/plano-acao-avancado.md` | Revisar contra a decisao de tratativa incorporada em `/actions`. |
| `docs/status-evolucao-gestao-360.md` | Pode conter marco historico, nao necessariamente estado atual. |

Quando houver conflito entre documentos, considere esta pagina, `docs/CODEX_MEMORIA_OPERACIONAL.md`, `docs/CHECKLIST_PRODUCAO.md` e `docker-compose.droplet.yml` como fonte operacional mais recente.
