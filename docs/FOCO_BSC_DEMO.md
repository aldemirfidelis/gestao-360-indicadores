# Foco BSC e demonstração pública

Trabalho local iniciado em 2026-10-07. Publicação e seed fictício da demo em
produção autorizados explicitamente pelo usuário e concluídos na mesma data (BRT).

## Escopo

O menu principal apresenta somente Meu Dia, Tarefas, Gestão à Vista e Gestão de
Prêmio. Administração, autenticação, permissões, dados e suporte necessários
permanecem como infraestrutura. Os demais módulos ficam preservados no Git,
sem rotas acessíveis, sem inicialização de seus módulos Nest e fora dos pacotes
de runtime focados. Não foram removidas tabelas nem dados históricos.

A configuração central está em `packages/shared/src/product-scope.json` e as
políticas estão em `product-scope.ts`. A reativação requer revisar ali os códigos
e as rotas correspondentes, validar integrações e reconstruir os pacotes; uma
exceção comercial por empresa não reativa um módulo suspenso pelo produto.

## Demonstração

- Botões públicos “Acesse a Demonstração”: login sem cadastro ou senha.
- Conta reservada: `visitante@demonstracao.local`, perfil `DEMO_PUBLIC`.
- Empresa reservada: slug `demonstracao`, nome Empresa Demonstração.
- Sessão de uma hora, sem refresh compartilhado; bloqueio de escrita no servidor.
- Sem troca de empresa, administração, IA ou integrações externas pelo visitante.
- Dados e pessoas fictícios; cálculos de prêmio são exemplos pré-preenchidos,
  identificados por `demo-snapshot-v1`, não pagamentos reais.

O seed `apps/api/prisma/seed-focused-demo.ts` é aditivo, transacional e usa lock
consultivo e marcadores para evitar duplicação. Recusa ambiguidades de empresa
ou colisões de e-mails com outra empresa. Não usar o antigo seed geral para
publicar esta demonstração.

Comando local:

```bash
pnpm shared:build
pnpm --filter @g360/api exec tsx prisma/seed-focused-demo.ts
```

Na imagem focada da API o seed compilado fica em
`dist/prisma/seed-focused-demo.js`. A execução em produção exige autorização
específica, backup e confirmação do banco-alvo.

## Build e recuperação

- Executar compilações uma por vez. API: heap de 4096 MB no ambiente local.
- Web: `pnpm --filter @g360/web build`, usando um worker e uma cópia temporária
  em `apps/.focused-web-*`; as fontes e o tsconfig original não são alterados.
- Se houver queda de energia, uma cópia temporária pode sobrar. Não é fonte do
  projeto, está ignorada pelo Git e Docker e pode ser inspecionada antes de removida.
- `node scripts/package-focused-api.cjs` gera `apps/api/dist-active` a partir da
  árvore de dependências compiladas alcançáveis pelo boot e pelo seed dedicado.
- Imagens de runtime usam `dist-active` e `public-active`, mantendo Prisma/schema
  e migrations para preservar o histórico do banco. Collabora fica no profile
  Docker `documents`, fora da subida padrão.
- Cópia do standalone preserva symlinks relativos e rejeita links externos ou
  quebrados; a imagem Docker verifica imports do Next antes de ser publicada.
  O deploy aguarda saúde dos containers e recupera imagens anteriores pelos IDs.

## Validação concluída localmente

- Build shared, API e Web focado: aprovados, incluindo typecheck do build.
- Prisma validate: schema válido, sem migration ou remoção de tabelas.
- API: suíte completa de 122 arquivos / 871 testes passou; novo teste de bloqueio
  da integração com Serviço Pessoal passou separadamente (1 teste).
- Web: 9 arquivos / 75 testes passaram.
- Navegador Chromium: 9 E2E passaram (foco/demo, perfil próprio, health e site
  público). Percorridas as 22 rotas principais e selecionadas competências para
  conferir os espelhos publicados; sem erro JavaScript ou GET da API rejeitado.
- Segurança: demo não escreve, não troca de empresa e não lê indicador de outro
  tenant. Rotas suspensas retornam 404 tanto no Web quanto na API.
- Seed compilado repetido e comparadas 406 tabelas com companyId: nenhum conteúdo
  de outra empresa alterado. Marcadores impedem duplicação dos exemplos.
- Dados: 32 indicadores, 384 resultados, 10 objetivos BSC, 11 ações, 6 desvios,
  5 reuniões, 2 reuniões mensais, 3 projetos, tarefas manuais e sincronizadas,
  3 competências de prêmio, 9 elegíveis e 9 demonstrativos fictícios.
- Corrigida a tolerância dos faróis dos exemplos para 90% de atingimento mínimo
  amarelo, conforme a regra compartilhada, com recálculo consistente dos dados.
- Runtime API: 323 arquivos / 6,6 MB. Web: 107 páginas geradas e 106 entradas de
  rotas; nenhuma entrada suspensa. Prisma, infraestrutura e histórico mantidos.
- Pacotes locais de runtime conferidos; imagens Docker ainda não reconstruídas
  nesta máquina. Imagens reconstruídas e verificadas na produção conforme abaixo.

O CI E2E está direcionado ao produto focado, health e site público. Os cenários
legados de módulos suspensos continuam em fonte e exigem revisão ao reativar.
A correção pré-existente de migrations no CI foi preservada.

Para repetir a checagem com os servidores compilados nas portas 3000/3333:

```bash
E2E_EXTERNAL_SERVERS=1 pnpm exec playwright test tests/e2e/focused-demo.spec.ts tests/e2e/api-health.spec.ts tests/e2e/public-contact-and-login.spec.ts --workers=1
```

Alterações pré-existentes em CI, tenant-host e no controller público foram
preservadas e revisadas. A correção TLS foi publicada em commit separado.

## Publicação em produção — 2026-10-07 (BRT)

- GitHub `main` atualizado. Produto focado: `ff06834`; ajuste de runtime/deploy:
  `b7ab4ecd`; política TLS do `www`: `423aa83`.
- Droplet confirmado: `165.22.176.248`, repositório
  `/opt/gestao-360-indicadores`, banco `g360` no host Docker `postgres:5432`.
  Nenhum acesso ao droplet antigo ou seed geral. Volumes de dados preservados.
- Backup anterior ao deploy/seed:
  `db-backups/pre-focus-20261007/g360-20261008-002632.dump`, 1,9 MB,
  formato custom validado com `pg_restore --list` (4074 linhas), permissões 600.
  SHA-256: `8f85696f294d1dd691067fc6b25791a62f647ff7a737712185828738d9c09564`.
  Backup permanece somente no servidor, sem cópia de dados reais para o ambiente
  de desenvolvimento ou Git. Não representa backup off-site.
- Imagens anteriores preservadas nas tags `g360-api:rollback-c8fbd5a-20261007`
  e `g360-web:rollback-c8fbd5a-20261007`.
- Primeiro build revelou links absolutos da cópia temporária no standalone;
  as imagens antigas foram restauradas antes de corrigir o empacotamento.
  Três testes de regressão passaram; build corrigido verificou 29 symlinks
  portáveis e imports do Next na imagem isolada. API 1,06 GB; Web 374 MB.
- API, Web e Postgres saudáveis. Caddy ativo; Collabora parado, com dados
  preservados. As 152 migrations estão aplicadas, sem pendências.
- Versão das imagens da aplicação: `0.1.0+b7ab4ecd`. O ajuste posterior de Caddy
  foi implantado separadamente, sem recompilar nem trocar as imagens da aplicação.
- Empresa Demonstração criada isoladamente:
  `36090c9d-47a9-4afa-8327-963affe6def3`; visitante reservado sem senha pública.
  Seed dedicado executado via `node dist/prisma/seed-focused-demo.js` na API.
- Dados confirmados: 18 nós organizacionais, 32 indicadores / 384 resultados,
  10 objetivos BSC, 5 OKRs, 11 ações, 6 desvios, 3 projetos, 5 reuniões,
  2 reuniões mensais, 9 tarefas manuais (56 após sincronização automática),
  3 competências, 9 snapshots de colaboradores e 9 espelhos fictícios do prêmio.
- Comparação imediata antes/depois do seed: contagens e hashes idênticos nas
  406 tabelas com `companyId` fora da demo e nos registros das outras empresas
  em `Company`. Reexecução do seed não duplicou exemplos. A navegação pública
  gera os registros globais normais de auditoria de entrada, separados desta
  comparação do seed.
- Chromium em produção: 22 rotas verificadas, 4 tentativas de escrita bloqueadas
  com 403, 11 rotas Web/API suspensas com 404; nenhum erro JavaScript ou GET
  rejeitado. Header/empresa solicitada não permitem trocar o tenant da demo.
  Não existia indicador de outra empresa em produção para testar detalhe cruzado;
  esse cenário foi validado na suíte local, sem criar dados externos à demo.
- Mobile 390 px conferido após os dados carregarem, sem overflow horizontal.
  Home e `/api/health`: 200. HTTPS de `www.gestao360.org`: 301 para o domínio
  principal após validar a configuração e recriar somente o Caddy.

Ao atualizar o próprio `scripts/deploy.sh`, fazer `git pull --ff-only` antes
de invocá-lo para usar a versão nova do script. Mudanças do Caddyfile devem ser
validadas; o bind mount de arquivo pode manter o inode antigo após git pull,
por isso a atualização desta publicação recriou somente o proxy, sem volumes.
