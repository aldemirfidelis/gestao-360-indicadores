# Revisão de português do Gestão 360

Data: 02/11/2026. Publicação autorizada pelo usuário; execução em andamento.

A revisão corrige acentuação, concordância e redação nos textos fornecidos pelo
sistema, com foco na interface e nas mensagens que chegam aos usuários.

## Exemplos

- A recomendação do anexo passa a ser: “Abra a Visão 360 dos itens críticos antes
  de executar uma ação irreversível e registre a justificativa quando houver uma
  decisão.”
- “1 item(ns) vencido(s) exigem atenção” passa a “1 item vencido exige atenção”.
  Para dois ou mais, a tela usa “itens vencidos exigem atenção”.
- Resumos, recomendações e atas passam a concordar quantidades de itens,
  aprovações, decisões, participantes e ações.

## Abrangência

- Telas, rótulos, mensagens de validação e erros da API, notificações, ajuda,
  e-mails, atas, relatórios e exportações.
- Meu Dia, equipe, tarefas, estratégia, indicadores, desvios, ações, reuniões,
  projetos, administração e catálogos; também o código dos módulos suspensos.
- Textos do site público, prévia institucional em SVG e dados fictícios usados
  na criação de demonstrações. Nenhum seed foi executado.
- Formatação compartilhada de quantidades em `packages/shared/src/portuguese.ts`.

## Textos padrão existentes no banco

A migration `20261102210000_portuguese_catalog_copy` contém 571 substituições
previstas nos catálogos Permission, AccessProfile, PlatformAdminPermission,
PlatformAdminRole, PortalModule, PlatformModuleCatalog, PortalPage e PortalFeature.

Cada atualização exige a chave correta e o texto antigo completo. Os perfis
precisam também ser de sistema. Isso permite corrigir os padrões existentes
preservando os campos personalizados, os vínculos e as permissões concedidas.
A migration pode ser executada novamente sem produzir alterações adicionais.
Ela não modifica a estrutura do banco e ainda não foi aplicada em produção.

## Validação

- API: 127 arquivos / 903 testes verificados; os sete arquivos que exigiram
  ajustes foram reexecutados, com 123 testes aprovados. Os testes do Meu Dia
  cobrem a frase corrigida, singular/plural e a atualização das recomendações
  persistidas. Os últimos ajustes de texto também passaram nos testes focados.
- Interface: 15 arquivos / 112 testes aprovados; `tsc --noEmit` completo aprovado.
- Compartilhado: quatro arquivos / 21 testes aprovados, incluindo quantidades
  zero, um, dois e o plural irregular de aprovação.
- Migration: 1.080 cenários em Postgres 17 descartável, executada duas vezes,
  confirmando a correção dos padrões, a preservação de personalizações,
  permissões e escopo e a idempotência. Também validada em SQLite temporário.
- Builds de API e Web aprovados em uma cópia temporária na Vultr, com imagens de
  validação separadas das imagens em execução. O healthcheck permaneceu saudável.
- Lint dos arquivos alterados sem erros; os avisos existentes sobre dependências
  de hooks permanecem. `git diff --check` aprovado.
- Conferência estrutural de identificadores, rotas, valores técnicos e chaves.
  Foram preservados os aliases de normalização, o XML do eSocial e a codificação
  ASCII exigida pelos arquivos fiscais de ponto. Os respectivos testes passaram.
- Sem teste de navegação no navegador nesta tarefa, conforme a preferência
  operacional registrada para este notebook.

## Publicação

Commit, push e deploy na Vultr autorizados pelo usuário em 02/11/2026. A execução
inclui backup do banco antes da migration e verificações após a atualização.
