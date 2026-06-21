# Arquitetura do sistema por abas (mapa de navegação)

> **Proposta de reorganização:** [ARQUITETURA_SISTEMA_POR_ABAS_PROPOSTA.md](./ARQUITETURA_SISTEMA_POR_ABAS_PROPOSTA.md) ·
> [HTML navegável](./arquitetura-menu-proposta.html) · [PDF](./arquitetura-menu-proposta.pdf)

Última atualização: 2026-06-21. Fonte de verdade: `apps/web/components/shell/navigation.ts`
(menu lateral) + `apps/api/src/modules/portal-admin/portal-catalog.ts` (catálogo de módulos).

Este documento mostra **como o sistema está organizado hoje, por abas** — o menu lateral
em accordion, o que cada item faz, e as sub-telas dos módulos maiores. Cada item só
aparece para quem tem a permissão correspondente (ou pode ser desligado por empresa via
Portal Admin → ver o fim do documento).

---

## Aplicação da empresa (menu lateral em accordion)

O menu lateral é dividido em **5 grupos** (accordion). Abaixo, cada grupo e seus itens.

### 1. Visualizações
> Painéis, árvore, mapas e acompanhamento executivo.

| Aba | Rota | O que é |
| --- | --- | --- |
| Meu Dia | `/meu-dia` | Central de trabalho: caixa de entrada corporativa com tudo que exige sua atenção hoje (prioridades, prazos, delegações). É a landing padrão pós-login. |
| Tarefas | `/tarefas` | Tarefas do usuário, incluindo documentos liberados para edição. |
| Visão Geral | `/dashboard` | Dashboard executivo: resumo, pendências e atalhos. |
| Painel Executivo | `/visualization` | Visão 360 para decisão. |
| Árvore Organizacional | `/org` | Áreas, setores, pilares e diretrizes (estrutura recursiva). |
| Mapa Estratégico | `/strategy` | Perspectivas, objetivos, impactos e relações (o "mapa de relações" vive aqui, não é módulo separado). |
| Indicadores | `/indicators` | Farol, ranking e histórico. Detalhe em `/indicators/[id]` (meta × realizado, desvios, tratativa, evolução, rastreabilidade); novo em `/indicators/new`. |
| Cronogramas | `/projects` | Projetos, marcos e tarefas (Gantt). Detalhe em `/projects/[id]`. |
| Insights | `/insights` | Alertas, tendências e insights (heurísticas locais; arquitetura pronta p/ IA). |
| Central de Impactos | `/central-impactos` | Análise 360° e simulações de impacto (Visão 360). |

### 2. Lançamentos
> Entradas e tratamento do dia a dia.

| Aba | Rota | O que é |
| --- | --- | --- |
| Importações | `/imports` | Importação estruturada de dados (CSV/XLSX) com validação linha a linha. |

### 3. Gestão
> Cadastros e objetos de gestão do dia a dia.

| Aba | Rota | O que é |
| --- | --- | --- |
| Cargos e Salários | `/cargos-salarios` | Estrutura, catálogo, tabelas salariais e movimentações (ver sub-telas abaixo). |
| Aprovações | `/aprovacoes-cargo` | Cargo, eficácia e aprovações gerais. |
| Períodos | `/periods` | Ano de trabalho, abertura e fechamento anual. |
| Desvios | `/deviations` | Indicadores fora da meta, causas e tratativas. Detalhe em `/deviations/[id]` (Ishikawa, 5 Porquês, Pareto, CAPA). |
| Plano de Ação | `/actions` | Ações, execução, evidências e eficácia (Kanban). Detalhe em `/actions/[id]`. A **tratativa de indicador** é incorporada aqui (`/treatments` → `/actions`). |
| Riscos | `/risks` | Registro de riscos e mitigações. |
| Não Conformidades | `/nonconformities` | NCs, causa raiz, ação corretiva e eficácia. |
| Documentos | `/documents` | Políticas, procedimentos, validade e aprovação (GED; editor web via Collabora quando configurado). |
| Comunicação Organizacional | `/comunicacao` | Comunicados, campanhas, mural, pesquisas e chat corporativo (7 abas internas). |
| Auditorias | `/audits` | Auditorias, constatações e geração de NCs. |
| Processos | `/processes` | Mapeamento SIPOC, fluxo e responsáveis. |
| Segurança dos Alimentos (FSMS) | `/seguranca-alimentos` | Programas, processos, perigos/PCC, normas, fornecedores, lotes; aba Fluxograma (APPCC). |
| Segurança Patrimonial | `/seguranca-patrimonial` | Portarias, acessos, rondas, ocorrências, permanência (7 abas internas — ver abaixo). |
| Formulários | `/forms` | Modelos, listas de verificação e preenchimentos. |
| Reunião Mensal | `/monthly-results` | Fechamento de resultados, pauta, ata e acompanhamento semanal. Detalhe em `/monthly-results/[id]`. |
| Reuniões | `/meetings` | Agenda, atas e decisões. Detalhe em `/meetings/[id]`. |
| OKRs | `/okrs` | Ciclos e resultados-chave (check-in semanal; visão lista e fluxograma). |
| Central de Automações | `/central-automacoes` | Motor visual de automações e fluxos de trabalho. Construtor em `/central-automacoes/fluxos/construtor`. |

### 4. Gestão de Prêmio
> Remuneração variável: anexos, competências, apuração e espelho. (Grupo só aparece com `prize:view`.)

| Aba | Rota | O que é |
| --- | --- | --- |
| Visão Geral | `/gestao-premio` | Painel executivo da competência selecionada. |
| Programas de Prêmio | `/gestao-premio/programas` | Programas de remuneração variável e regras gerais. |
| Competências | `/gestao-premio/competencias` | Ciclo mensal: abertura, validação e fechamento. |
| Anexos e Regras | `/gestao-premio/anexos` | Governança, versões, indicadores, pesos e faixas dos anexos. |
| Realizado | `/gestao-premio/realizado` | Sincronização dos lançamentos, conferência e Previsto × Realizado. |
| Colaboradores Elegíveis | `/gestao-premio/colaboradores` | Base elegível por competência (Apdata), retrato e conciliação. |
| Apuração Mensal | `/gestao-premio/apuracao` | Motor de cálculo, memória de cálculo e conferência. |
| Ajustes e Exceções | `/gestao-premio/ajustes` | Ajustes manuais, exceções, transitoriedade e regras de moderador. |
| Integração com a Folha | `/gestao-premio/folha` | Lote de pagamento (rubrica/verba), exportação e retorno. |
| Espelhos do Prêmio | `/gestao-premio/espelhos` | Demonstrativo individual (PDF), publicação e ciência. |
| Relatórios e Auditoria | `/gestao-premio/relatorios` | Apuração, pendências, trilha de auditoria e resumo executivo (IA). |
| Integrações | `/gestao-premio/integracoes` | Conectores Apdata/Folha, testes e rotinas. |

### 5. Relatórios
> Análises, auditoria e exportações.

| Aba | Rota | O que é |
| --- | --- | --- |
| Relatórios e Exportações | `/reports` | Indicadores, resultados, metas, desvios e áreas (CSV/PDF). |

### Rodapé do menu / engrenagem
| Aba | Rota | O que é |
| --- | --- | --- |
| Usuários | `/users` | Criação e manutenção dos usuários da própria empresa. |
| Configurações | `/settings` | Hoje redireciona para `/users`; o restante da administração foi centralizado no Portal Admin Global. |
| Banco de Dados | `/settings/database` | **Somente SUPER_ADMIN**. Administração do banco. |
| Central do Portal | `/settings/portal` | **Somente SUPER_ADMIN**. |

---

## Barra superior (topbar)
- Busca global (indicadores, estrutura, ações, desvios, reuniões, usuários, objetivos).
- **Mensagens** (chat), **Pessoas conectadas**, **Notificações** (sino com contador), **Alternar tema**, **Perfil**, **Sair**.
- Para SUPER_ADMIN: seletor de **empresa ativa** (impersonação multiempresa).

---

## Sub-abas dos módulos maiores

**Segurança Patrimonial** (`/seguranca-patrimonial`, abas internas): Visão Geral · Operação ·
Pessoas e Veículos · Autorizações · Rondas e Ocorrências · Materiais e Chaves · Configurações.

**Cargos e Salários** (`/cargos-salarios/...`): Estrutura e Quadro · Catálogo de Cargos ·
Descrições · Tabelas Salariais · Enquadramento · Ciclos · Orçamento · Pesquisas ·
Simulações · Movimentações · Aprovações · Relatórios · Configurações.

**Comunicação** (`/comunicacao`, abas internas): Comunicados/Campanhas · Mural · Pesquisas ·
Diretório de Pessoas · Chat · etc. (7 abas).

---

## Portal Administrativo Global (login separado)

Acesso em `/platform-admin` (autenticação própria, fora do login das empresas; só Platform Owner / Super Admin de plataforma). Organizado em:

- **Geral:** Painel.
- **Plataforma:** Empresas · Matriz de Módulos · Planos · SEO e Presença Digital · Usuários · Segurança e Suporte.
- **Empresa selecionada:** Config. Gerais · Visibilidade · Áreas e Setores · APIs Externas · Auditoria da Empresa.
- **Técnico:** Banco de Dados · Central do Portal · Desenvolvimento · Auditoria.

É aqui que se **liga/desliga módulos por empresa** (feature flags), define planos e overrides — onboarding por etapas e redução de superfície por cliente.

---

## Como a navegação é controlada (resumo técnico)
- O menu é montado a partir de `navSections` e **filtrado por permissão** (`visibleNavSections`); SUPER_ADMIN vê tudo.
- O acesso por **URL direta** é barrado pelo `RouteGuard` usando `ROUTE_PERMISSIONS` (mapa rota → permissões). `ROUTE_PERMISSIONS` e o menu são mantidos no mesmo arquivo e estão consistentes.
- Módulos podem ser desativados por empresa via Portal Admin (catálogo `portal-catalog.ts` → overlay `PortalModule`/`PortalPage`/`PortalFeature`).

## Stack e camadas (visão rápida)
- **Frontend:** Next.js 15 (App Router) em `apps/web` — páginas finas + hooks (React Query) + componentes.
- **Backend:** NestJS 10 em `apps/api` — ~1 módulo por área de negócio; multitenancy manual por `companyId` (padrão scoped-read-before-mutate); autorização por `@RequirePermissions`/guards.
- **Banco:** PostgreSQL (local no droplet em produção); Prisma (~370 models).
- Detalhes de stack/produção/gate: ver [docs/README.md](./README.md).
```
