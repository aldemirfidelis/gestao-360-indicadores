# Foco BSC e demonstração pública

Trabalho local iniciado em 2026-10-07. Publicação e seed fictício da demo em
produção autorizados explicitamente pelo usuário; execução em andamento.

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
  nesta máquina. A reconstrução Docker será validada no deploy autorizado.

O CI E2E está direcionado ao produto focado, health e site público. Os cenários
legados de módulos suspensos continuam em fonte e exigem revisão ao reativar.
A correção pré-existente de migrations no CI foi preservada.

Para repetir a checagem com os servidores compilados nas portas 3000/3333:

```bash
E2E_EXTERNAL_SERVERS=1 pnpm exec playwright test tests/e2e/focused-demo.spec.ts tests/e2e/api-health.spec.ts tests/e2e/public-contact-and-login.spec.ts --workers=1
```

Alterações pré-existentes em CI, tenant-host e no controller público foram
preservadas e revisadas. A correção TLS será publicada em commit separado.
