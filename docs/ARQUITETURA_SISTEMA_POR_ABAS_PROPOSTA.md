# Arquitetura do sistema por abas — proposta de reorganização

> **Status:** proposta de UX/navegação (documentação; implementação em `navigation.ts` pendente de aprovação).  
> **Base:** [ARQUITETURA_SISTEMA_POR_ABAS.md](./ARQUITETURA_SISTEMA_POR_ABAS.md) (estado atual).  
> **Visual:** [arquitetura-menu-proposta.html](./arquitetura-menu-proposta.html) (navegável) · [arquitetura-menu-proposta.pdf](./arquitetura-menu-proposta.pdf) (fluxogramas).

Última atualização: 2026-06-21.

---

## Objetivos

1. Reduzir o accordion **Gestão** (hoje 18 itens no mesmo grupo).
2. Promover **Segurança dos Alimentos** e **Segurança Patrimonial** a módulos de menu próprios (como Gestão de Prêmio).
3. Dar conteúdo real aos grupos **Lançamentos** e **Relatórios** (hoje com um único item cada).
4. Alinhar o menu ao **Portal Admin** (feature flags por módulo/empresa).
5. Manter **rotas existentes** — reorganizar apenas navegação (sem quebrar URLs).

---

## Comparativo: hoje × proposta

| Hoje | Itens | Proposta | Itens |
| --- | ---: | --- | ---: |
| Visualizações | 10 | **Início** + **Estratégia e Indicadores** | 2 + 8 |
| Lançamentos | 1 | **Entradas e Operação** | 3 |
| Gestão | 18 | **Melhoria Contínua** + **Qualidade** + módulos dedicados | 5 + 6 + FSMS + Patrimonial + Comunicação + Automações |
| Gestão de Prêmio | 12 | **Gestão de Prêmio** (mantido) | 12 |
| Relatórios | 1 | **Relatórios e Auditoria** | 3 |
| Rodapé | Usuários, Config | **Administração** (+ Períodos) | Períodos, Usuários, Config |

---

## Menu lateral proposto (12 accordions + rodapé)

### 1. Início

> O que preciso fazer hoje.

| Aba | Rota | O que é |
| --- | --- | --- |
| Meu Dia | `/meu-dia` | Central de trabalho; landing padrão pós-login |
| Tarefas | `/tarefas` | Tarefas do usuário, documentos liberados para edição |

### 2. Estratégia e Indicadores

> Planejar, medir e acompanhar performance.

| Aba | Rota | O que é |
| --- | --- | --- |
| Visão Geral | `/dashboard` | Dashboard executivo: resumo, pendências e atalhos |
| Painel Executivo | `/visualization` | Visão 360 para decisão |
| Árvore Organizacional | `/org` | Áreas, setores, pilares e diretrizes |
| Mapa Estratégico | `/strategy` | Perspectivas, objetivos, impactos (mapa de relações aqui) |
| Indicadores | `/indicators` | Farol, ranking, histórico, metas e resultados |
| OKRs | `/okrs` | Ciclos e resultados-chave |
| Cronogramas | `/projects` | Projetos, marcos e tarefas (Gantt) |
| Central de Impactos | `/central-impactos` | Análise 360° e simulações de impacto |

*Movido de Visualizações:* **Insights** → grupo Relatórios (análise, não painel executivo).

### 3. Melhoria Contínua

> Ciclo desvio → ação → eficácia (núcleo de melhoria).

| Aba | Rota | O que é |
| --- | --- | --- |
| Desvios | `/deviations` | Indicadores fora da meta, causas e tratativas |
| Plano de Ação | `/actions` | Ações, execução, evidências e eficácia (`/treatments` → aqui) |
| Reuniões | `/meetings` | Agenda, atas e decisões |
| Reunião Mensal | `/monthly-results` | Fechamento de resultados, pauta e ata |
| Aprovações | `/aprovacoes-cargo` | Cargo, eficácia e aprovações gerais |

### 4. Qualidade e Compliance

> GRC transversal (sem FSMS nem portaria).

| Aba | Rota | O que é |
| --- | --- | --- |
| Riscos | `/risks` | Registro de riscos e mitigações |
| Não Conformidades | `/nonconformities` | NCs, causa raiz, ação corretiva e eficácia |
| Auditorias | `/audits` | Auditorias, constatações e geração de NCs |
| Documentos | `/documents` | Políticas, procedimentos, validade e aprovação (GED) |
| Processos (SIPOC) | `/processes` | Mapeamento SIPOC, fluxo e responsáveis |
| Formulários (modelos) | `/forms` | Modelos e listas de verificação |

*Preenchimentos de formulários* ficam em **Entradas e Operação**.

### 5. Segurança dos Alimentos (módulo)

> Accordion visível com `fsms:view` / flag `food-safety`.

| Aba | Rota | Sub-abas internas (já existentes) |
| --- | --- | --- |
| Segurança dos Alimentos | `/seguranca-alimentos` | Programas, processos, perigos/PCC, normas, fornecedores, lotes, fluxograma APPCC |

*Evolução opcional:* sub-itens no menu lateral espelhando abas internas (padrão Gestão de Prêmio).

### 6. Segurança Patrimonial (módulo)

> Accordion visível com `asset-security:view`.

| Aba | Rota | Sub-abas internas |
| --- | --- | --- |
| Segurança Patrimonial | `/seguranca-patrimonial` | Visão Geral · Operação · Pessoas/Veículos · Autorizações · Rondas · Materiais · Config |

### 7. Cargos e Salários (módulo)

> Accordion próprio (sai de Gestão); sub-navegação interna mantida.

| Aba | Rota |
| --- | --- |
| Cargos e Salários | `/cargos-salarios` (+ estrutura, catálogo, tabelas, movimentações…) |

### 8. Gestão de Prêmio (módulo)

> **Sem alteração** — modelo de referência para módulos grandes.

| Aba | Rota |
| --- | --- |
| Visão Geral … Integrações | `/gestao-premio` e sub-rotas (12 itens) |

### 9. Comunicação (módulo)

> Sai de Gestão; comunicação corporativa em um lugar.

| Aba | Rota | O que é |
| --- | --- | --- |
| Comunicação Organizacional | `/comunicacao` | Comunicados, mural, pesquisas, chat (7 abas internas) |

*Topbar / atalhos:* Pessoas (`/pessoas`), Integrações (`/integracoes`), Ajuda (`/ajuda`).

### 10. Entradas e Operação

> Substitui **Lançamentos** (nome mais claro; três entradas com função distinta).

| Aba | Rota | Implementação |
| --- | --- | --- |
| Lançamento de Resultados | `/lancamentos/indicadores` *ou* `/indicators?mode=launch` | Grid em lote de metas × realizado; hoje disperso em Indicadores |
| Importações | `/imports` | CSV/XLSX com validação linha a linha |
| Preenchimentos | `/forms?tab=preenchimentos` | Execução de checklists e formulários de campo |

### 11. Relatórios e Auditoria

> Substitui **Relatórios** com um único item.

| Aba | Rota | Por quê |
| --- | --- | --- |
| Relatórios e Exportações | `/reports` | CSV/PDF executivo |
| Insights | `/insights` | Alertas, tendências e análises |
| Auditoria do Sistema | `/audit` | Trilha técnica (já existe; falta no menu hoje) |

Relatórios de prêmio permanecem em `/gestao-premio/relatorios`.

### 12. Automações

> Motor de workflows isolado (sai de Gestão).

| Aba | Rota |
| --- | --- |
| Central de Automações | `/central-automacoes` |

### Rodapé — Administração

| Aba | Rota | O que é |
| --- | --- | --- |
| Períodos | `/periods` | Ano de trabalho, abertura e fechamento |
| Usuários | `/users` | Usuários da empresa |
| Configurações | `/settings` | Redireciona a `/users`; portal global no Platform Admin |
| Banco de Dados | `/settings/database` | Somente SUPER_ADMIN |
| Central do Portal | `/settings/portal` | Somente SUPER_ADMIN |

---

## O que mudou em Lançamentos e Relatórios

### Lançamentos → Entradas e Operação

| Problema hoje | Solução |
| --- | --- |
| Accordion com só Importações | Três entradas: resultados, importação, preenchimentos |
| Lançamento de KPI sem atalho | Item dedicado (nova rota ou deep-link em Indicadores) |
| Formulários só como “modelos” em Gestão | Modelos em Qualidade; execução em Entradas |

### Relatórios → Relatórios e Auditoria

| Problema hoje | Solução |
| --- | --- |
| Só `/reports` | + Insights (análise) + Auditoria (`/audit`) |
| Insights em Visualizações | Move para saídas/análises, não painéis |

---

## Feature flags (Portal Admin)

| Accordion proposto | `code` em `portal-catalog.ts` |
| --- | --- |
| Segurança dos Alimentos | `food-safety` |
| Segurança Patrimonial | `asset-security` |
| Cargos e Salários | `compensation` |
| Gestão de Prêmio | `prize` |
| Comunicação | `communication` |
| Entradas | `imports`, `indicators`, `forms` |
| Relatórios | `reports`, `insights`, `audit` |

Empresa sem FSMS ou sem portaria: accordions 5 e 6 não aparecem.

---

## Jornadas por perfil

| Perfil | Accordions principais |
| --- | --- |
| Portaria / segurança | Início → Seg. Patrimonial → Entradas (se aplicável) |
| Qualidade / FSMS | Qualidade → Seg. Alimentos → Melhoria Contínua |
| Gestor de área | Início → Estratégia e Indicadores → Melhoria Contínua |
| Diretoria | Painel Executivo → Relatórios e Auditoria |
| RH / remuneração | Cargos e Salários → Gestão de Prêmio |
| Admin empresa | Administração (rodapé) + Portal Admin Global |

---

## Implementação técnica (checklist)

1. Reordenar `navSections` em `apps/web/components/shell/navigation.ts`.
2. Adicionar `intent` se necessário: `quality`, `security`, `operations`.
3. Atualizar `category` em `apps/api/src/modules/portal-admin/portal-catalog.ts`.
4. Criar `/lancamentos/indicadores` ou `?mode=launch` em Indicadores.
5. Incluir `/audit` e `/insights` no accordion Relatórios.
6. Ajustar `mobileNavItems` (Meu Dia, Indicadores, Ações, Relatórios, menu).
7. Após implementar, atualizar [ARQUITETURA_SISTEMA_POR_ABAS.md](./ARQUITETURA_SISTEMA_POR_ABAS.md).

---

## Decisões explícitas

| Decisão | Motivo |
| --- | --- |
| Tratativa em Plano de Ação | `/treatments` já redireciona a `/actions` |
| Mapa de relações em Mapa Estratégico | Sem módulo separado no menu |
| Insights em Relatórios | Separar “ver” (dashboard) de “analisar” |
| Períodos no rodapé | Configuração fiscal, não operação diária |
| Rotas não mudam | Só reorganização de menu e documentação |

---

## Diagramas

- HTML navegável: [arquitetura-menu-proposta.html](./arquitetura-menu-proposta.html)
- PDF: [arquitetura-menu-proposta.pdf](./arquitetura-menu-proposta.pdf)
