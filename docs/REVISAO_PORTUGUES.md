# Revisão de português do Gestão 360

Data: 02/11/2026. Revisão publicada na Vultr com autorização do usuário.

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
Ela não modifica a estrutura do banco e foi aplicada em produção em 02/11/2026.

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

Publicada na Vultr em 02/11/2026, com autorização do usuário:

- Commit `57a4755396d803561d45f81de9a663eb84e0b210`, versão `0.1.0+57a47553`.
- Builds finais de API e Web aprovados com o site disponível. Deploy em 28 s,
  de 21:23:43Z a 21:24:11Z; 154 migrations aplicadas, nenhuma pendente.
- Backup `db-backups/g360-20261102-211951.dump`, validado por `pg_restore --list`.
  Imagens anteriores preservadas nas tags de rollback registradas na memória.
- A migration corrigiu 384 campos padrão encontrados na base. A auditoria não
  encontrou nenhum texto antigo previsto restante. Os 552 identificadores dos
  catálogos e 1.172 vínculos de permissões conservaram contagens e hashes.
- Containers saudáveis e rotas públicas verificadas com HTTP 200. Versão no
  login confirmada; o assistente continua exigindo autenticação (401 sem token).
- A API pública da demonstração retornou a frase corrigida do anexo. O aviso de
  decisão e as quantidades foram conferidos; o JavaScript público do Meu Dia
  contém as formas corretas e corresponde ao arquivo da imagem implantada.

## Correção posterior: consulta de visitantes

Detectada uma regressão da revisão em `SiteAnalyticsService.overview`: o alias
SQL `area` havia sido alterado para `área` no ORDER BY, causando erro 500 ao abrir
Visitantes do Site. A correção local restaura o identificador técnico original.

O teste de regressão passou junto dos testes de analytics/contexto (20 testes).
As consultas de resumo e lista corrigidas também passaram no Postgres da Vultr,
em processo isolado e transação somente leitura. A auditoria dos 81 trechos SQL
nos arquivos da API revisados não encontrou outras alterações após essa correção.
A publicação desta correção foi autorizada pelo usuário e está em andamento.
