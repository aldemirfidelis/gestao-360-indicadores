# SIPOC, BPMN e RACI — relatório de implementação

Solicitação: prompt anexo do usuário, 16/11/2026. Implementação local concluída; validação final registrada abaixo. Commit, push e deploy não realizados para este novo escopo.

## Diagnóstico técnico

- Monorepo pnpm: Next.js 15/React 19/TypeScript na web, NestJS 10/Prisma 5 na
  API, PostgreSQL. Componentes de formulário, navegação, autenticação, escopo de
  área, catálogo de permissões e auditoria reutilizados.
- `Process` e `ProcessStep` são o cadastro central existente. Já possuem empresa,
  área, proprietário, indicador, etapas, status e SIPOC textual. O módulo tem
  controller, serviço, interface e testes; estava suspenso em `product-scope.json`.
- Estratégia, indicadores, desvios, ações, tarefas, reuniões, organização e
  projetos estão ativos. A Curva S de projetos foi publicada nesta sessão.
- GED, formulários, riscos, auditorias, treinamento, comunicação e demais módulos
  corporativos existem em fonte/schema, mas estão suspensos. Referências a eles
  devem respeitar disponibilidade, permissões próprias e escopo de área; esta
  implementação reativa somente Processos.
- Não existe editor BPMN 2.0 nem matriz RACI persistente no módulo atual.
- BPMN é modelagem/documentação. Nenhum motor de execução instalado e
  nenhuma métrica operacional inferida do desenho.
- Alterações locais anteriores (numeração das ferramentas, minimapas, animação
  de conexões e documentação da demonstração) preservadas.

## Contrato de implementação

1. Ampliar o módulo existente: contexto do processo e artefatos SIPOC/BPMN/RACI,
   estados de governança, revisões concorrentes e versões imutáveis.
2. Usar bpmn-js no navegador e bpmn-moddle no servidor, mantendo a atribuição
   exigida pela biblioteca. Validar importações XML e extrair atividades com
   identificadores estáveis, sem executar scripts ou buscar recursos externos.
3. Reutilizar pessoas/áreas/cargos na RACI; permitir R+A para o mesmo participante,
   exigir um A e ao menos um R por linha antes de aprovação/publicação e sinalizar
   referências desativadas ou mudanças organizacionais.
4. Vínculos tipados e isolados por empresa/área com registros reais. Navegação
   nos dois sentidos e painel com agregados reais. Não conceder acesso por RACI.
5. UI contextual de processo com SIPOC em cinco colunas, editor BPMN, matriz RACI,
   atividades, integrações e histórico; preservar rascunhos e tratar conflito.
6. Migrations aditivas, testes unitários/integrados/de interface em ambiente
   descartável e documentação técnica, funcional e comercial baseada no código.

## Fontes da biblioteca

- [bpmn-js: integração do modelador](https://bpmn.io/toolkit/bpmn-js/walkthrough/).
- [Licença bpmn-js](https://github.com/bpmn-io/bpmn-js/blob/develop/LICENSE).
- [bpmn-moddle: leitura e escrita de BPMN XML](https://github.com/bpmn-io/bpmn-moddle).

## Implementação entregue

- Cadastro `Process`/`ProcessStep` preservado, menu Processos reativado e detalhe contextual em `/processes/:id`, com visão geral, SIPOC, BPMN, Matriz RACI, registros relacionados e histórico.
- SIPOC detalhado em cinco colunas, reutilização do cadastro anterior, referências reais e CSV.
- Modelador bpmn-js carregado no cliente, XML/SVG, importação validada, enquadramento que reserva espaço para a paleta, propriedades operacionais, IDs estáveis e inativação de atividades removidas.
- AS-IS/TO-BE com cópia de propriedades e comparação por atividade; relações auxiliares de consulta não geram falsas diferenças.
- RACI com pessoas/áreas/cargos existentes, R+A, múltiplos R, único A e ao menos um R por linha para decisões protegidas. Mudanças organizacionais sinalizam revisão, conservando snapshots. Validação reutiliza consultas de participantes repetidos na matriz.
- Estados rascunho/em revisão/aprovado/publicado/arquivado; revisão otimista, bloqueio transacional, justificativa, snapshots, auditoria e histórico paginado. Versões protegidas exigem revisão antes de edição.
- Seis tabelas e quatro enums novos na migration aditiva `20261116140000_process_governance`; nenhuma conversão destrutiva do legado. FKs e CHECKs validam referências tipadas.
- Vínculos com indicadores, projetos/tarefas, tarefas do quadro, ações, desvios, reuniões, objetivos, áreas e processos. Seletores filtrados por empresa/área/permissão/disponibilidade. Referências mantidas por SIPOC/RACI não podem ser apagadas isoladamente.
- Retorno ao processo em indicador, projeto, desvio, plano, tarefa, reunião, área e objetivo. Referência principal legada a indicador/área também contemplada.
- Meu Dia e notificação de revisão ao proprietário, respeitando também a disponibilidade empresarial do módulo; painel com documentação, responsáveis, revisões, processos com indicador fora da meta/desvio aberto/projeto de melhoria e acesso aos registros correspondentes.
- Destinos GED/formulários/riscos/auditorias/treinamento preparados com FKs reais e guardas; módulos continuam suspensos. Nenhum acesso liberado pela RACI.
- Erros de FK na remoção retornam 409 com orientação sobre os vínculos, preservando os registros. Corrigida a seleção transitória de um artefato anterior durante a criação, detectada pelo teste visual.

## Verificações executadas

| Verificação | Evidência |
|---|---|
| Contratos/cálculos compartilhados | 38 testes aprovados, incluindo 7 específicos de SIPOC/RACI/comparação |
| API afetada e regressões selecionadas | 89 testes aprovados: Processos 29, Meu Dia 9, Projetos 22, guard de escopo de produto 29; Processos/Meu Dia repetidos após ajustes finais (38) |
| Frontend existente | 113 testes aprovados, incluindo navegação com Processos |
| Lint | Arquivos novos e telas web alteradas verificados sem avisos/erros; build completo ainda apresenta avisos antigos de outros componentes |
| Prisma | Schema validado e client gerado; seis tabelas e checks revisados |
| Build real | API e web compiladas sequencialmente em Docker, incluindo tipos e empacotamento standalone |
| Migrations | Todas as 156 aplicadas do zero em Postgres 17 descartável em tmpfs |
| Persistência/integridade | Script real com serviços compilados e Postgres: SIPOC, BPMN, IDs/propriedades, RACI, governança, vínculos/retorno, destinos suspensos, painel, revisão organizacional, Meu Dia, concorrência, rollback, checks e sentinela de outra empresa |
| Interface | Playwright 1.60.0/Chromium: login real, SIPOC/criação/edição/recarga, BPMN/importação/edição/XML/SVG e preservação após importação inválida; criação TO-BE/comparação; RACI R+A, revisão/aprovação/publicação, histórico protegido, navegação processo–projeto–processo, exclusão protegida/409, leitura/403 e as três ferramentas sem transbordamento da página em 390 pixels. Nove grupos aprovados; zero erros JavaScript da página |

Scripts reproduzíveis: `scripts/check-process-governance.cjs`, `tests/process-governance.browser.cjs` e fixture `tests/fixtures/process-digital-implementation.bpmn`. As credenciais de ensaio só autenticam usuários fictícios na base descartável. Os scripts exigem marcador de isolamento; o de banco valida nome/host antes de gravar.

Evidências de build, migrations, integração, navegador e capturas: `/tmp/g360-process-review.2kOIcl` no servidor de ensaio. Imagens de revisão: `g360-api:process-review-20261116` e `g360-web:process-review-20261116`. Esses nomes não são imagens publicadas. Cópias locais das capturas/relatório ficam em `.git/process-governance-validation`, fora do versionamento.

Encerramento do ensaio confirmado: 156 migrations concluídas, 545 tabelas incluindo a tabela interna do Prisma; tmpfs verificado na configuração Docker. Removidos somente os três containers e a rede nomeada do ensaio. API, Web e Postgres de produção permaneceram `healthy`, com suas imagens anteriores e volume preservado.

## Documentação e inventário

Entregues [documentação completa em 15 capítulos](GESTAO360_DOCUMENTACAO_COMPLETA.md), [mapa funcional de todos os módulos](MAPA_FUNCIONALIDADES.md), [arquitetura](ARQUITETURA_E_INTEGRACOES.md), [manual](MANUAL_DO_USUARIO.md), [guia técnico](GUIA_TECNICO.md) e [visão comercial](VISAO_COMERCIAL_GESTAO360.md).

O [inventário estático](INVENTARIO_ROTAS_CODIGO.md), gerado por `scripts/generate-functional-inventory.cjs`, encontrou 61 diretórios de módulos, 1.747 operações HTTP decoradas, 201 páginas e 544 modelos Prisma. Essa varredura documenta fonte e suspensão por caminho; não representa teste operacional integral dos módulos suspensos. Referências antigas a React 18/DigitalOcean foram contextualizadas no índice da documentação.

## Limitações e publicação

- BPMN não executa workflows nem infere lead time/SLA real. A validação verifica estrutura e referências básicas, não toda a semântica formal BPMN. A comparação cobre atividades/propriedades, não diff semântico integral do XML.
- Modelos publicados mantêm snapshots; não há coedição em tempo real. Data de revisão gera pendência; não transfere responsabilidade automaticamente.
- Participantes usam User, OrgNode e OrgJob existentes. O cargo textual do usuário e seu cadastro de colaborador são conceitos distintos no legado; não foi criada correspondência automática por nome entre eles.
- Integrações com módulos suspensos requerem reativação e ensaio próprio. Não foram apresentados como testados os fluxos completos desses módulos.
- Produção não recebeu esta migration, novos registros ou seeds; nenhuma empresa real foi usada como fixture. Serviços do produto permaneceram saudáveis durante a validação.
- Para publicação, seguir o fluxo de resumo e OK explícito de [memória operacional](CODEX_MEMORIA_OPERACIONAL.md). Preservar alterações locais anteriores e manter scripts/dados corporativos de demonstração fora de commits desta entrega.
