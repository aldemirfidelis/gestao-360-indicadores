# Mapa de funcionalidades — Gestão 360

Referência: 16/11/2026, código local sobre `57aeed6` com SIPOC/BPMN/RACI. O [inventário extraído do código](INVENTARIO_ROTAS_CODIGO.md) relaciona **61 diretórios de módulos, 1.747 operações HTTP decoradas, 201 páginas, 544 modelos Prisma e 156 migrations**. Inclui fonte suspensa; não equivale a catálogo de funcionalidades publicadas/licenciadas.

## Como interpretar o mapa

- **Ativo:** participa do núcleo atual, sujeito a licença, permissões, área e configuração.
- **Novo:** implementado localmente nesta entrega; aguarda publicação/migration em produção.
- **Suspenso:** fonte e dados preservados; o produto bloqueia suas rotas e/ou não carrega seu módulo principal. Não reativado nesta entrega.
- **Infraestrutura/parcial:** serviço transversal; algumas rotas de negócio associadas podem estar suspensas.

Para todos os módulos de negócio: o operador precisa de usuário ativo, empresa correta e permissões declaradas. Perfil nominal não substitui ACL; listas/ações também podem exigir alcance de área. Relatórios dependem de dados reais. Não foi executado teste integral de cada módulo abaixo: o relatório desta entrega delimita os testes efetivos.

## Núcleo de negócio

Cada linha apresenta objetivo/problema, funcionalidades e fluxo, perfis/regras, relações/medição/automação e limites.

| Módulo e tela | Objetivo e utilização | Perfis e regras | Relações, relatórios e automações | Estado e limites |
|---|---|---|---|---|
| **Organização** — `orgnodes`, `/org` | Organizar árvore, áreas, responsáveis, atividades e itens; selecionar nó, consultar detalhe e manter hierarquia | Administrador/gestor com `org:*` e área; consulta conforme visibilidade | Usuários, indicadores, ações, processos; responsabilidades por nó | Ativo; cargos/carreira avançados têm rotas suspensas |
| **Estratégia/BSC** — `strategy`, `/strategy/:id` | Criar mapa, perspectivas, objetivos, relações; organizar canvas e publicar versão | `strategy:*`, área e controles de edição/publicação | Indicadores e áreas ligados a objetivos; agregados/faróis e histórico; processos relacionados | Ativo; não é motor de execução; minimapa removido |
| **OKRs** — `okrs`, `/okrs` | Planejar ciclos, objetivos, KRs, alinhamento e check-ins | Responsáveis/gestores com `okrs:*` | Metas de KR, progresso e hierarquia; vínculos de ações conforme contexto | Ativo; progresso de KR não é automaticamente KPI |
| **Indicadores** — `indicators`, `/indicators/:id` | Definir medida, periodicidade, unidade, direção, fonte, responsáveis e metas; consultar histórico | `indicators:*`, área e empresa | Resultados, estratégia, árvore de indicadores, processos/projetos, desvios e painéis | Ativo; fonte/formulário depende de módulos liberados |
| **Resultados** — `results`, lançamentos do indicador | Lançar e aprovar realizado por período, anexar/comentar; calcular farol | Alimentador/aprovador com permissões pertinentes; períodos/fechamentos | `IndicatorTarget`/`IndicatorResult`, desvios e tratativas; séries e histórico | Ativo; cinza sem dados suficientes; fórmulas em shared/status |
| **Desvios** — `deviations`, `/deviations/:id` | Registrar fato, impacto, causas, providência, responsável e prazo | `deviations:*` e acesso ao indicador/área | Análises, planos, reuniões, processos; acompanhamento de status | Ativo; não confundir fechamento com eficácia |
| **Tratativas** — `treatments`, contexto de indicador/plano | Manter o encadeamento de resultado fora da meta e tratamento | Permissões/escopo da fonte | Resultado, desvio, sessão de análise, reunião e plano; rastreabilidade | Ativo; utiliza fontes existentes |
| **Planos e análise** — `actions`, `/actions/:id` | Analisar causa; manter plano, tarefas, evidências, participantes e eficácia | `actions:*`, responsável/gestor, área; controles de conclusão/validação | Ishikawa, 5 Porquês, 5W2H, PDCA e estruturas MASP; tarefas/Meu Dia; processos e indicadores | Ativo; Pareto é compatibilidade legada, não novo editor entregue |
| **Projetos** — `projects`, `/projects/cronograma`, `/projects/:id` | Planejar portfólio, Gantt, orçamento, tarefas, dependências e marcos; atualizar avanço | `projects:*`, área do indicador quando vinculada | Curva S, medições diárias e PMO; tarefas, processos/atividades e indicador | Ativo; não inventa histórico anterior; responsável de tarefa legado é texto |
| **Processos** — `processes`, `/processes`, `/processes/:id` | Cadastro central e etapas; SIPOC em cinco colunas; BPMN AS-IS/TO-BE; RACI; governança | `processes:*`, permissões específicas de aprovação/publicação e escopo de área | Atividades, vínculos tipados, versões/auditoria, painel, Meu Dia, organização e registros reais | Novo; módulo reativado no código; BPMN documenta, não executa |
| **Reuniões** — `meetings`, `/meetings/:id` | Agendar, manter participantes, pautas, decisões e acompanhamentos | `meetings:*`; área/vínculo com indicador | Planos, desvios, calendário/convites quando configurados, processos e ata | Ativo; envio externo depende de configuração e ação autorizada |
| **Reunião Mensal** — `monthly-results`, `/monthly-results` | Consolidar mês e áreas, decisões, escalonamentos, acompanhamentos, aprendizados e padronização | Gestores com permissões do domínio; regras de fechamento | Snapshots dos indicadores e integração de planos/atas | Ativo; período fechado preserva visão histórica |
| **Meu Dia** — `my-day`, `/meu-dia` | Consolidar pendências/prioridades; abrir fonte e atuar nela | `myday:view` e políticas das fontes; visão pessoal/equipe | WorkItemIndex, tarefas, planos, projetos, notificações e revisão de processos | Ativo; projeção não substitui fontes; coletores de módulos suspensos são desativados |
| **Tarefas** — `tasks`, `/tarefas` | Quadro, lista, calendário, timeline/wiki; manter tarefas manuais e acompanhar fontes automáticas | ACL da tarefa/quadro, criador, responsável, área e permissões | Planos/projetos, comentários/anexos, atividades e RACI por referência | Ativo; status propagado segue regra da fonte |
| **Painel Executivo** — `dashboard`, `/visualization` | Consultar desempenho agregado e navegar aos detalhes | Permissões de leitura e área das entidades | Indicadores/resultados, ações, projetos; resumo de governança de processos | Ativo; contagens refletem alcance do usuário |
| **Insights** — `insights` | Gerar alertas gerenciais a partir dos dados disponíveis | Leitura conforme contexto de domínio | Indicadores/ações e prioridades; saídas derivadas de registros | Ativo como serviço; não presumir predição ou IA para toda regra |
| **Visão 360** — `vision360` | Consultar relacionamentos, impactos e registros conectados; exportar/analisar quando liberado | Permissões de origem e acesso empresarial | Grafo contextual, rastreabilidade, busca de entidades e análises de impacto persistidas | Infraestrutura ativa; algumas entradas de menu suspensas; não é novo BPMN |

## Operação, governança e administração

| Diretório/módulo | Objetivo e fluxo | Perfis e regras | Integrações, relatórios e automações | Estado/limite |
|---|---|---|---|---|
| `auth` | Login, refresh, logout, perfil, troca de senha; CPF/matrícula são aliases do usuário | JWT, usuário/empresa ativos; bcrypt; credenciais privadas | User, RefreshToken por hash, auditoria; sessão pública demo de leitura | Ativo; não há concessão de acesso por RACI |
| `users` | Manter usuários, status, permissões e perfis; consultar catálogo e contexto | Administração autorizada; escopo da empresa | Catálogo aditivo de permissões e perfis padrão | Ativo; novos papéis de governança precisam de concessão |
| `companies` | Consultar empresa/filiais e identidade visual | Usuário da empresa; administração com permissão | Shell, branding e contexto multiempresa | Ativo |
| `access` | Atribuir áreas, configurar matriz/exceções e simular visibilidade | Administradores autorizados; controle de alcance por ação | AccessService compartilhado pelos domínios; auditoria de negações | Ativo; não é equivalente a licenciamento |
| `admin` | Cadastros administrativos, filiais, parâmetros, perfis e configurações | Guardas administrativos e permissões próprias | Usuários/empresas, parâmetros e bootstrap autorizado | Ativo; bootstrap não é seed de produção liberado automaticamente |
| `company-admin` | Administração da empresa e configurações específicas | Administração empresarial; isolamento de empresa | Perfil e controles de empresa | Ativo; diferente do admin global da plataforma |
| `platform` | Gestão global de empresas e visão da plataforma | Administração global conforme guardas | Empresas, usuários, indicadores e ações; status empresarial | Infraestrutura administrativa |
| `platform-admin` | Empresas, planos, módulos, acesso, auditoria, suporte e operação global | Papéis/permissões próprios da plataforma, sessão específica | Licenciamento, feature flags, manutenção, logs, banco e visitas | Ativo para operadores autorizados; prêmio permanece suspenso |
| `portal-admin` | Catálogo de módulos/páginas/features, navegação, flags, escopos, manutenção e snapshots de configuração | Guardas administrativos; GET config resolve overlay para usuário | PortalGate + licenças + menu; sync aditivo do catálogo | Ativo; preservar overrides, não forçar liberação empresarial |
| `database-admin` | Consultar estrutura, saúde, consultas permitidas e registros de backup | Guardas restritos, controles de consulta e auditoria | Prisma/Postgres, histórico e administração global | Ativo para autorizados; não executar comandos destrutivos por conveniência |
| `audit` | Consultar trilha de operações do sistema | Permissões administrativas, empresa e alcance | AuditLog; interceptor e escritores compartilhados | Ativo; distinto de auditoria de compliance |
| `traceability` | Registrar/consultar eventos, status e relações; abrir origem | Leitura autorizada no contexto | TraceabilityEvent/StatusHistory e deep-links de domínio | Ativo; automações opcionais suspensas não são executadas |
| `notifications` | Listar notificações, ler/contar pendências e preferências | Usuário destinatário e políticas próprias | Meu Dia, tarefas, eventos e revisão de processo; SMTP quando configurado | Ativo; não garante e-mail sem configuração |
| `push` | Gerenciar inscrição e envio Web Push | Sessão/usuário e configuração de chaves | Notificações e navegador | Infraestrutura ativa; depende de permissão no navegador |
| `imports` | Importar dados, validar linhas e inspecionar falhas antes da aplicação | Permissões do tipo/importação e empresa | Indicadores/metas/resultados e registros suportados | Ativo; formatos/campos reais no controller/service; não importar dados fictícios em produção |
| `reports` | Consultar/exportar relatórios empresariais | Permissão e alcance das fontes | Resultados, ações, reuniões e outros relatórios existentes | Ativo; dados dependem de lançamento real |
| `search` | Busca global e atalhos para entidades | Filtragem por contexto e módulos | Navegação do shell aos registros de origem | Ativo; não equivale a autorização de escrita |
| `periods` | Configurar período de trabalho e status operacional | Administração/gestão autorizada | Lançamentos, metas e rotinas gerenciais | Ativo; preservar períodos encerrados |
| `closed-months` | Controlar meses fechados e restrições | Permissões específicas de fechamento/reabertura | Indicadores/resultados e reunião mensal | Ativo; reabertura precisa de ação consciente |
| `integrations` | Manter preferências/configurações de integração | Usuário/admin conforme endpoint | Calendário, conectores e recursos configurados | Infraestrutura ativa; disponibilidade depende de configuração |
| `external-api` | Endpoints externos e chaves/validação de integração | API key/guardas específicos e escopo do endpoint | Recursos externos suportados; auditoria | Parcial; rotas de prêmio suspensas; não prometer integração externa genérica pronta |
| `ai` | Sugestões e apoio contextual conforme operações expostas | Permissões da operação, limites e chave configurada | Planos, análises/reuniões; provedor configurado | Ativo como capacidade opcional; não substitui aprovação humana |
| `help` | Categorias, artigos e feedback de ajuda | Consulta e administração conforme perfil | Conteúdo de apoio e feedback | Ativo |
| `support-tickets` | Abrir, classificar, acompanhar e responder chamados | Solicitante/equipe autorizada; empresa | Histórico, prioridade, status e anexos conforme endpoint | Ativo; enviar mensagens externas continua sujeito à ação autorizada |
| `lgpd` | Inventário de tratamento, suboperadores e incidentes | Perfis autorizados de privacidade | Governança e trilhas de atualização | Ativo no contexto administrativo; não equivale a certificação legal |
| `public` | Identidade do tenant, páginas públicas e resolução de domínio | Rotas públicas com validações específicas | Login, empresas e domínios | Infraestrutura ativa; não expõe cadastros privados |
| `site-analytics` | Registrar/consultar visitas e métricas do site/demo | Coleta pública limitada; consulta restrita | Portal global e indicadores de visitação | Ativo; dados pessoais exigem política de retenção |
| `health` | Expor saúde da aplicação para operação | Rotas próprias de monitoramento | Compose, deploy e verificações HTTP | Ativo; não é relatório funcional |

## Módulos preservados e suspensos

As funcionalidades abaixo foram identificadas na fonte, schema e documentação específica. Não foram reativadas nem apresentadas como operacionalmente validadas nesta entrega. Para todas: fluxo de uso começa por habilitação técnica/licença, configuração, permissões e testes próprios. Os endpoints/telas exatos estão no inventário.

| Módulo/tela | Problema, funcionalidades e fluxo identificado | Perfis/regras | Relações, relatórios/automações | Limitações e documentação |
|---|---|---|---|---|
| `risks` — `/risks` | Registrar risco, avaliar probabilidade/impacto, tratar e acompanhar residual | `risks:*`, empresa/área | Indicador, projeto, ações de mitigação; matriz e histórico | Suspenso; [Riscos](RISCOS_FASE6.md) |
| `nonconformities` — `/nonconformities` | CAPA: contenção, causa, correção, verificação e encerramento | `nc:*`, empresa/área | Desvio, ação, auditoria/formulário; acompanhamento de NC | Suspenso; não confundir com desvio gerencial |
| `documents` — `/documents` | GED: cadastro, arquivos, revisão, aprovação, publicação, obsolescência, editor e versões | `doc:*`, área, fluxo e acesso documental | Procedimentos, evidências, WOPI/WebDAV quando configurados; destinos de processo preparados | Suspenso; armazenamento/editor exigem configuração; [GED](GED_DOCUMENTOS.md) |
| `forms` — `/forms` | Templates/versionamento, execuções, preenchimento, evidências, aprovações e registros operacionais | `forms:*`, área e acesso ao formulário | Alimentação de indicador e NC por reprovação quando configuradas; histórico | Suspenso; [Formulários](FORMULARIOS_CHECKLISTS.md) |
| `audits` — `/audits` | Programa, universo auditável, auditores, checklists, achados, NCs, follow-up e relatório | `audits:*`, área/empresa | Risco, documentos, evidências e planos; vínculo de processo preparado | Suspenso; [Auditorias](AUDITORIAS_COMPLIANCE.md) |
| `food-safety` — `/seguranca-alimentos` | Programa de segurança de alimentos, processos, análise de perigos, controles e registros | `fsms:*` e área/programa | Fluxograma e registros específicos; dados de qualidade conforme programa | Suspenso; fluxograma existente não substitui o novo BPMN |
| `asset-security` — `/seguranca-patrimonial` | Portarias, acesso, visitantes, ocorrências, dispositivos e presença/roll-call | `asset-security:*`, unidade/portaria e canais específicos | Eventos de hardware, QR e registros operacionais | Suspenso; depende de hardware/configuração; [Segurança patrimonial](SEGURANCA_PATRIMONIAL_PORTARIAS.md) |
| `automations` — `/central-automacoes` | Modelar fluxos, regras, aprovações e instâncias de automação | Permissões de automação/fluxo e escopo | Fontes empresariais, tarefas e aprovações; histórico de execução próprio | Suspenso; motor existente separado da modelagem BPMN, não reativado |
| `communication` — `/comunicacao` | Conversas, mensagens/anexos, publicações, enquetes e confirmação de leitura | Participantes, audiência e permissões | Presença, diretório, notificações e canais | Módulo corporativo suspenso; infraestrutura de perfil pode continuar carregada |
| `compensation` — `/cargos-salarios` | Estrutura de cargos/quadro, faixas e processos de solicitação/movimentação | `compensation:*`/permissões de posições e aprovações | OrgJob/OrgEmployee, hierarquia e pessoal | Suspenso; [arquitetura por abas](ARQUITETURA_SISTEMA_POR_ABAS.md) |
| `personnel` — `/servico-pessoal` | Prontuário, admissão, gestão de jornada/ponto, solicitações e rotinas de pessoal | Perfis e acessos específicos ao colaborador/RH | Empresa, usuário/colaborador, comunicação, jornada e folha | Suspenso; dispositivos/biometria/provedores exigem configuração; diagnósticos próprios em docs |
| `payroll` — rotinas de folha | Eventos, processamento, aprovação, fechamento, arquivos e rotinas de pagamento implementadas por endpoint | RH/folha autorizados; estados e períodos | Cadastro de pessoal e eventos; relatórios/arquivos conforme integração | Suspenso; não afirmar homologação legal/bancária universal; [diagnóstico](diagnostico-folha-pagamento.md) |
| `recruitment` — `/recrutamento`, carreiras/candidato | Vagas, candidatos, etapas, avaliações e portais de seleção | Recrutadores/gestores e sessão específica de candidato | Pessoal/cargos; formulários, publicações e comunicação configurada | Suspenso, inclusive portais pertinentes; [diagnóstico](diagnostico-recrutamento-selecao.md) |
| `supplies` — `/suprimentos` | Solicitação, aprovação, compras, fornecedores, recebimento e estoque conforme controllers | Permissões de suprimentos/estoque e estados do fluxo | Áreas, produtos, fornecedores, pedidos e movimentações | Suspenso pelos códigos procurement/inventory; [arquitetura](SUPRIMENTOS_ARQUITETURA.md) |
| `training` — `/treinamento` | Catálogo, planejamento, turmas/participação e registros de desenvolvimento | `training:*` e alcance dos participantes | Pessoas/cargos e treinamentos; referência de processo preparada | Suspenso; RACI não comprova capacitação |
| `prize` — `/gestao-premio` | Regras, apuração e integração de prêmio conforme código existente | Permissões de prêmio e regras próprias | Indicadores e integração externa pertinente | Suspenso inclusive API externa; não reativado nem recalculado nesta entrega |

## Telas e navegação

Seções principais declaradas no escopo local: Meu Dia, Tarefas, Painel Executivo, Árvore Organizacional, Mapa Estratégico, Indicadores, Desvios, Plano de Ação, Processos, Projetos, Ata da Reunião, Reuniões, Reunião Mensal e OKRs. O shell aplica perfil, configuração empresarial e produto; a posição visual segue a implementação de navegação, não necessariamente a ordem desta enumeração.

SIPOC, BPMN e Matriz RACI são abas de `/processes/:id`. Os vínculos de retorno estão nos detalhes de indicador, projeto, desvio, ação, tarefa, reunião, área e objetivo. A consulta de registros suspensos não é liberada pela simples existência de uma FK.

Para todas as **201 páginas**, use a seção “Páginas do frontend” no inventário. As **1.747 operações** estão agrupadas pelos 61 diretórios de módulos, com método, caminho, permissão declarada, suspensão por caminho e link para o controller. Os 544 modelos constam ao final. Essa lista evita omitir funcionalidades apenas porque não aparecem no menu atual.

## Relações e fontes dos relatórios

- Objetivo → indicador → meta/resultado → desvio/tratativa → análise → plano/tarefas → eficácia.
- Processo → SIPOC/BPMN/RACI → atividades → registros de medição/melhoria existentes.
- Projeto → tarefas/dependências/marcos → medição diária → Curva S; relação com processo por vínculo tipado.
- Reunião → pauta/decisão → plano/acompanhamento; Reunião Mensal preserva snapshots próprios.
- Meu Dia agrega referências e prazos; notificações avisam destinatários; auditoria e rastreabilidade conservam decisões.
- Painéis e relatórios consultam fontes reais respeitando alcance. Catálogos, desenhos e responsabilidade por si só não produzem resultado operacional.

Os fluxos operacionais estão no [manual](MANUAL_DO_USUARIO.md), os contratos no [documento de arquitetura](ARQUITETURA_E_INTEGRACOES.md) e a validação efetiva no [relatório](RELATORIO_IMPLEMENTACAO_SIPOC_BPMN_RACI.md).
