# Guia de testes

## Comandos principais

| Escopo | Comando |
| --- | --- |
| Tudo | `pnpm test` |
| API | `pnpm --filter @g360/api test` |
| API typecheck | `pnpm --filter @g360/api exec tsc --noEmit --pretty false` |
| Web typecheck | `pnpm --filter @g360/web exec tsc --noEmit` |
| Shared | `pnpm --filter @g360/shared test` |
| Prisma validate | `pnpm --filter @g360/api exec prisma validate` |
| Prisma status | `pnpm --filter @g360/api exec prisma migrate status` |

## Validação atual

Última validação executada durante a FASE 7 documental:

- API tests: 26 arquivos, 184 testes passando.
- API typecheck: verde.
- Web typecheck: verde.
- Prisma schema: válido.

## Cobertura existente

Os testes unitários de serviço cobrem os fluxos críticos de:

- isolamento por empresa e área;
- validação de vínculos cross-company;
- listagem com filtros;
- criação/atualização/exclusão lógica;
- rastreabilidade;
- fluxos específicos como CAPA, auditoria -> NC, SIPOC e formulários com campos obrigatórios.

## E2E

Ainda não há Playwright/Cypress configurado no repo.

Recomendação para a próxima etapa:

1. Adicionar Playwright em workspace root.
2. Criar fixture de login com empresa demo.
3. Cobrir smoke flows:
   - login;
   - indicador fora da meta -> desvio -> ação -> eficácia;
   - risco vinculado a indicador;
   - auditoria -> constatação -> NC;
   - processo/SIPOC com etapa;
   - formulário/checklist com preenchimento.
4. Rodar E2E contra ambiente local sem tocar no Neon de produção.

## Cuidados

- Não aplicar migrations em banco compartilhado durante testes sem autorização.
- Preferir fixtures isoladas por empresa.
- Para testes de área, sempre verificar tanto visibilidade quanto escrita.
