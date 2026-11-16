# Guia técnico — Gestão 360

Referência: 16/11/2026. A [memória operacional](CODEX_MEMORIA_OPERACIONAL.md) rege a operação do ambiente. As instruções históricas de Neon ou DigitalOcean em documentos antigos não descrevem a produção atual na Vultr.

## Estrutura e ambiente

| Caminho | Responsabilidade |
|---|---|
| apps/web/app | Rotas App Router |
| apps/web/components | Componentes por domínio e kit UI |
| apps/api/src/modules | Controllers, serviços e autorização de domínio |
| apps/api/src/common | Guardas, auditoria, validação e filtros |
| apps/api/prisma | Schema e migrations |
| packages/shared/src | Tipos, schemas Zod e cálculos compartilhados |
| scripts | Build, deploy, inventário e ensaios |
| tests | Testes de interface e fixtures isoladas |

Use Node ≥20 e pnpm 9.7.0; Dockerfiles fixam sua versão de Node. `pnpm install --frozen-lockfile` instala o workspace. `pnpm shared:build` gera contratos usados pela API. `pnpm db:up` inicia o ambiente de desenvolvimento; nunca copie dados reais para ele.

Consulte `.env.example`: DATABASE_URL/DIRECT_URL, API_PORT, NEXT_PUBLIC_API_URL, API_CORS_ORIGIN, JWT_ACCESS_SECRET/JWT_REFRESH_SECRET e TTLs. Há famílias opcionais de SMTP, IA, Redis/WORKERS_ENABLED, storage, push e editor documental. Use valores locais próprios; não coloque segredos em logs/documentação. `NEXT_PUBLIC_*` é incorporado ao bundle e não serve para segredo.

## Inicialização e banco

```powershell
pnpm install --frozen-lockfile
pnpm shared:build
pnpm db:up
pnpm --filter @g360/api exec prisma generate
pnpm --filter @g360/api exec prisma migrate deploy
pnpm dev:api
# Em outro terminal:
pnpm dev:web
```

Confirme o alvo da conexão antes de qualquer migration. Para nova alteração de schema, desenvolva a migration no banco local e revise o SQL. Não use `db push` para substituir o histórico de produção. Não execute `prisma reset` ou seed geral em produção.

Nova migration: `20261116140000_process_governance`, aditiva, seis tabelas de governança/atividades/RACI/vínculos e quatro enums. Preserva Process/ProcessStep e os dados antigos. Os CHECKs adicionais estão no SQL e não são representados integralmente pelo Prisma. São 156 migrations na árvore atual. No ambiente descartável, todas aplicaram do zero.

## Desenvolvimento de processos

Contratos: `packages/shared/src/process-governance.ts`. API: `modules/processes/{processes,process-governance,process-links}.service.ts`, controllers e `bpmn.ts`. UI: `components/processes` e `app/(app)/processes/[id]`.

Toda referência deve ser validada antes da gravação: empresa, registro ativo, módulo ativo, permissão e área. Não confiar em companyId, rótulo ou objeto enviado pelo cliente. Atualizações exigem revisão atual e estado permitido. Conteúdo protegido só muda após revisão; versão/auditoria são transacionais. A atribuição RACI conserva o snapshot da organização, sem alterar o ACL.

bpmn-js 18.31.1 é carregado apenas no cliente, com estilos/fontes e atribuição bpmn.io. bpmn-moddle 9.0.4 é mantido no servidor por compatibilidade CommonJS; atualizar para uma versão ESM requer revisar a integração. Não remova a atribuição. Não execute scripts BPMN nem habilite resoluções XML externas.

Reativação do módulo usa `product-scope.json`, navegação e catálogo existentes. Módulos suspensos continuam fora do build ativo quando aplicável e protegidos pelo guard. Licenças/overrides empresariais são preservados. Permissões novas são expostas pelo mecanismo aditivo de catálogo de usuários; administradores devem conceder aprovação/publicação aos perfis pertinentes, sem seed destrutivo.

## APIs e testes

Contratos de processo estão em [Arquitetura](ARQUITETURA_E_INTEGRACOES.md); demais endpoints e páginas no [inventário](INVENTARIO_ROTAS_CODIGO.md). Para regenerá-lo: `node scripts/generate-functional-inventory.cjs`.

```powershell
pnpm --filter @g360/shared test
pnpm --filter @g360/web test
pnpm --filter @g360/api exec vitest run src/modules/processes src/modules/my-day/work-item-aggregation.service.spec.ts src/modules/projects/projects.service.spec.ts src/common/guards/product-scope.guard.spec.ts
pnpm --filter @g360/web exec next lint --dir components/processes --dir 'app/(app)/processes'
pnpm --filter @g360/api exec prisma validate
```

Integração real: `scripts/check-process-governance.cjs` roda na imagem compilada da API e recusa conexão diferente de `localhost/g360_process_review` e ausência de `PROCESS_REVIEW_ISOLATED=1`. Requer fixture montada em `/review/process-digital-implementation.bpmn`. Cria somente dados sintéticos nesse banco descartável; exercita persistência, governança, RACI, vínculos, escopo, concorrência, rollback, checks, auditoria e Meu Dia. Grava `/review/process-fixture.json` para o teste visual.

Interface: `tests/process-governance.browser.cjs`, Playwright 1.60.0/Chromium, usa exclusivamente `http://localhost:3000` e API `http://api:3333` na rede descartável. Exige o mesmo marcador de isolamento e fixture. Testa login, criação/edição, recarga, XML/SVG, RACI, decisões, histórico, navegação reversa e leitura. Capturas e relatório ficam no diretório de ensaio. Não execute esse roteiro contra produção.

O teste visual encaminha `/api` como faz o Caddy; o Next standalone sozinho não fornece esse proxy. O procedimento do ensaio usa containers sem portas públicas, Postgres 17 em tmpfs e nenhum volume do produto. Consulte no relatório as verificações efetivamente concluídas.

## Build e publicação

```powershell
pnpm build
# Alternativa de verificação em ambiente Docker isolado:
docker build -f apps/api/Dockerfile -t g360-api:review .
docker build -f apps/web/Dockerfile -t g360-web:review .
```

Na máquina com pouca memória, prefira builds isolados sequenciais; não concorra com typecheck completo da API. A imagem da API deve gerar Prisma e compilar o código ativo; a web valida build/standalone. Lint do build pode incluir avisos antigos fora do escopo; registre-os sem apresentar a árvore inteira como livre de avisos.

Antes de publicar: revisar diff, preservar alterações anteriores, apresentar resumo e obter autorização; então commit/push e procedimento `make deploy` do servidor, com backup validado, imagens/versão identificáveis e plano de rollback. Use SSH `g360-vultr`, diretório `/opt/gestao-360-indicadores` e `docker-compose.droplet.yml`. Não copiar `.env` ou credenciais para o Git.

Não apagar `g360_pgdata` ou volumes de outros sistemas. Nunca usar `compose down -v` ou prune de volumes na produção. Migração aditiva não deve ser revertida apagando tabelas com histórico real. Rollback de imagem exige avaliar compatibilidade com o schema e preservar os novos dados.

## Diagnóstico prático

| Sintoma | Verificação |
|---|---|
| Processo não aparece | Produto ativo, licença, PortalConfig, permissão, área, empresa efetiva e deletedAt |
| 403 em destino | Permissão/licença do módulo original; RACI não concede acesso |
| 409 ao salvar | Revisão desatualizada ou estado protegido; exportar rascunho e conciliar |
| 409 ao excluir origem | FK em uso; revisar vínculos antes de remover |
| XML recusado | Tamanho, diagrama visual, referências, DTD/importações e mensagens do parser |
| Atividade não selecionável para propriedades | Salvar primeiro; só atividades BPMN viram ProcessActivity |
| RACI pede revisão organizacional | Pessoa/área/cargo alterado ou inativado; revisar e salvar conscientemente |
| Curva S sem passado | Não há medição anterior; comportamento intencional |
| /api retorna 404 no Next isolado | Configurar proxy equivalente ao Caddy e API interna |
| Caddy não lê arquivo alterado | Bind mount antigo por inode; seguir procedimento da memória operacional |

## Limites e manutenção

Preservar histórico e contratos de edição. Incluir ensaios de carga para bases grandes, políticas de retenção de snapshots e futuras validações BPMN. Integrações com módulos suspensos exigem reativação explícita e validação própria. Não anunciar automação de execução ou cálculo de SLA real sem eventos operacionais suficientes.
