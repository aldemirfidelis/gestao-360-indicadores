# Guia de testes

## Comandos principais

| Escopo | Comando |
| --- | --- |
| Tudo | `pnpm test` |
| API | `pnpm --filter @g360/api test` |
| API typecheck | `pnpm --filter @g360/api exec tsc --noEmit --pretty false` |
| Web typecheck | `pnpm --filter @g360/web exec tsc --noEmit` |
| Shared | `pnpm --filter @g360/shared test` |
| E2E smoke | `pnpm test:e2e` |
| Instalar Chromium E2E | `pnpm e2e:install` |
| Prisma validate | `pnpm --filter @g360/api exec prisma validate` |
| Prisma status | `pnpm --filter @g360/api exec prisma migrate status` |

## Validação atual

Última validação executada durante a FASE 7:

- API tests: 26 arquivos, 184 testes passando.
- API typecheck: verde.
- Web typecheck: verde.
- E2E smoke: 4 testes passando.
- Prisma schema: válido.

## Cobertura unitária existente

Os testes unitários de serviço cobrem os fluxos críticos de:

- isolamento por empresa e área;
- validação de vínculos cross-company;
- listagem com filtros;
- criação/atualização/exclusão lógica;
- rastreabilidade;
- fluxos específicos como CAPA, auditoria -> NC, SIPOC e formulários com campos obrigatórios.

## E2E

Playwright está configurado no workspace root em `playwright.config.ts`.

Cobertura smoke atual:

- `GET /api/health` sem autenticação;
- landing pública;
- página `/login`;
- rota privada sem token redirecionando para `/login`.

Comandos:

1. `pnpm e2e:install` para baixar Chromium na máquina.
2. `pnpm test:e2e` para rodar os smoke tests.
3. `pnpm e2e:ui` para depuração interativa.

Próxima expansão recomendada após aplicar as migrations pendentes no banco de teste:

- indicador fora da meta -> desvio -> ação -> eficácia;
- risco vinculado a indicador;
- auditoria -> constatação -> NC;
- processo/SIPOC com etapa;
- formulário/checklist com preenchimento.

## Cuidados

- Não aplicar migrations em banco compartilhado durante testes sem autorização.
- Preferir fixtures isoladas por empresa.
- Para testes de área, sempre verificar tanto visibilidade quanto escrita.
