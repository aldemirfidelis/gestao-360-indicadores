import { HelpCatalogCategory } from './types';

export const gestaoAVista: HelpCatalogCategory = {
  slug: 'gestao-a-vista',
  title: 'Gestão à Vista',
  description: 'Indicadores, desvios, planos de ação, reuniões, mapa estratégico e OKRs.',
  icon: 'BarChart3',
  position: 3,
  articles: [
    {
      slug: 'fluxo-indicador-desvio-plano',
      title: 'O fluxo central: indicador → desvio → reunião → plano de ação',
      summary: 'Como o ciclo completo de gestão por resultados funciona na plataforma.',
      tags: ['fluxo', 'ciclo', 'indicador', 'desvio', 'tratativa', 'metodo', 'gestao'],
      body: `O coração do Gestão 360 é um trilho único de tratativa:

1. Um **indicador estratégico** fica fora da meta (farol vermelho);
2. Abre-se um **desvio** registrando Fato → Impacto → Providência imediata;
3. Do desvio nasce uma **reunião de tratativa**;
4. Na reunião (ou no plano), a equipe conduz as **ferramentas de análise de causa** na ordem: Ishikawa → 5 Porquês → 5W2H → PDCA;
5. A causa raiz encontrada **propaga para o desvio** e as ações viram um **plano de ação** com tarefas, responsáveis e prazos;
6. Concluído o plano, avalia-se a **eficácia** — o indicador voltou para a meta?

Tudo compartilha os mesmos dados: o indicador do Painel Executivo é o mesmo do desvio, da reunião, do OKR e do prêmio.

**Regra importante:** apenas indicadores do tipo **Estratégico** disparam o fluxo completo (desvio, reunião mensal, painel executivo). Indicadores táticos e operacionais servem para acompanhamento e prêmio, mantendo o foco da diretoria no que é estratégico.`,
    },
    {
      slug: 'painel-executivo',
      title: 'Painel Executivo',
      summary: 'A visão consolidada por área, com faróis e leitura executiva.',
      tags: ['painel executivo', 'dashboard', 'farol', 'area', 'diretoria', 'visualizacao'],
      body: `O **Painel Executivo** (Gestão à Vista > Painel Executivo) é a "sala de guerra" do gestor: mostra, por área, os indicadores estratégicos com farol (verde/amarelo/vermelho), ranking, evolução e pendências.

## Recursos
- **Visão geral** consolidada da empresa e detalhe por **área** (o seletor mostra áreas-pai com suas sub-áreas);
- **Indicadores da área** — somente os estratégicos, com farol e atingimento;
- **Conclusão da área** — a leitura executiva escrita pelo gestor responsável (a "mensagem-chave" do mês);
- **Ranking** e **piores indicadores** — para priorizar a atenção;
- **Pendências** — desvios e ações em aberto da área.

## Dica de uso
Comece pelo vermelho: clique no indicador para abrir a **Visão 360°** dele e veja se já existe desvio e plano de ação em andamento. O painel usa exatamente os mesmos dados dos demais módulos.`,
    },
    {
      slug: 'arvore-organizacional',
      title: 'Árvore Organizacional',
      summary: 'A estrutura da empresa: unidades, áreas e setores que escopam tudo.',
      tags: ['arvore', 'organizacional', 'area', 'setor', 'estrutura', 'organograma', 'unidade'],
      body: `A **Árvore Organizacional** (Gestão à Vista > Árvore Organizacional) é a espinha dorsal da plataforma: Unidade → Áreas → Setores. Tudo — indicadores, ações, riscos, NCs, documentos, processos e prêmio — é vinculado a um nó dessa estrutura.

## Recursos
- **Árvore** com responsáveis por nó, cor, status e contagem de indicadores vinculados;
- **Novo item / Editar / adicionar filho / Inativar** — manutenção da estrutura;
- **Mover** — reorganiza a hierarquia arrastando um nó para outro pai;
- **Impacto de remoção** — antes de excluir um nó, o sistema mostra tudo que será afetado;
- **Atividades por nó** — responsabilidades e diretrizes de cada setor.

## Por que ela importa
- O **responsável do nó** define quem é o "dono" e compõe a **equipe** dele no Meu Dia da Equipe;
- A **visibilidade por área** dos usuários usa esses nós;
- Relatórios e painéis agrupam por essa estrutura.

Mantenha a árvore atualizada: ela é o mapa de responsabilidades da empresa.`,
    },
    {
      slug: 'mapa-estrategico-bsc',
      title: 'Mapa Estratégico (BSC)',
      summary: 'Balanced Scorecard visual: perspectivas, objetivos e causa-efeito.',
      tags: ['mapa estrategico', 'bsc', 'balanced scorecard', 'objetivo estrategico', 'perspectiva', 'estrategia'],
      body: `O **Mapa Estratégico** (Gestão à Vista > Mapa Estratégico) é o Balanced Scorecard visual da empresa.

## Como montar
1. Crie um **mapa** com o período de vigência (dá para duplicar mapas de anos anteriores).
2. Organize as **perspectivas** — Financeira, Clientes, Processos Internos, Aprendizado & Crescimento (há variações como Segurança, Pessoas, ESG, Qualidade).
3. Crie os **objetivos estratégicos** em cada perspectiva, com peso, prioridade, responsável e status (Planejado, No rumo, Em risco, Fora do rumo, Concluído).
4. Desenhe as **relações de causa-efeito** — as setas que contam a história da estratégia.
5. **Vincule cada objetivo aos indicadores** que o medem e às **áreas** responsáveis.

O layout do canvas é salvo, e o mapa tem **versões** para preservar o histórico.

## Valor
O mapa liga a estratégia (o que queremos ser) à operação (o que medimos e fazemos): clicando em um objetivo você chega aos indicadores reais que o sustentam — e aos OKRs vinculados.`,
    },
    {
      slug: 'como-cadastrar-um-indicador',
      title: 'Como cadastrar um indicador?',
      summary: 'Passo a passo para criar um KPI com meta, tolerância e farol.',
      tags: ['indicador', 'kpi', 'cadastrar indicador', 'meta', 'tolerancia', 'farol', 'novo indicador'],
      body: `1. Acesse **Gestão à Vista > Indicadores** e clique em **Novo indicador**.
2. Preencha:
   - **Nome** e área responsável (nó da Árvore Organizacional);
   - **Tipo** — Estratégico, Tático, Operacional, Projeto, Processo, Segurança, Qualidade, RH, Financeiro, Produção etc. Lembre: só o tipo **Estratégico** dispara desvios e entra no Painel Executivo e na Reunião Mensal;
   - **Unidade** — Percentual, Moeda, Quantidade, Horas, Dias, Toneladas, Litros, Índice…;
   - **Direção** — maior é melhor ou menor é melhor;
   - **Periodicidade** — diária, semanal, mensal, trimestral ou anual;
   - **Meta**, **tolerância** (a faixa amarela do farol) e **peso**.
3. Salve. Depois cadastre as **metas por período** (individualmente ou em lote) e comece a lançar **resultados**.

O sistema calcula automaticamente **atingimento, desvio e farol** (verde/amarelo/vermelho) a cada resultado lançado. Indicadores podem ter hierarquia (pai/filho) e aparecem em árvore/grafo.`,
    },
    {
      slug: 'metas-e-resultados-do-indicador',
      title: 'Lançar metas e resultados do indicador',
      summary: 'Como registrar metas por período, lançar resultados e anexar evidências.',
      tags: ['resultado', 'meta', 'lancamento', 'realizado', 'atingimento', 'periodo', 'evidencia'],
      body: `Cada indicador tem **metas** e **resultados** por período (conforme a periodicidade).

## Metas
- Na tela do indicador, aba de metas: informe a meta de cada período;
- Use o **lançamento em lote** para preencher o ano de uma vez.

## Resultados
1. Abra o indicador e lance o **resultado do período**.
2. O sistema calcula na hora: **atingimento (%)**, **desvio** (absoluto e %) e o **farol** — verde (dentro da meta), amarelo (dentro da tolerância), vermelho (fora).
3. Você pode registrar **notas, anexos e comentários por período** — a evidência e o contexto de cada mês ficam guardados junto do número.

## Acompanhamento
- **Série/histórico** em gráfico na tela do indicador;
- Resultados também podem entrar por **importação de planilha** (Administração > Importações) ou pela **API pública** (integração com ERP).

Se um indicador **estratégico** fechar o período fora da meta, o passo seguinte é abrir um **desvio** — veja o artigo sobre tratamento de desvios.`,
    },
    {
      slug: 'visao-360-do-indicador',
      title: 'Visão 360° do indicador',
      summary: 'O painel executivo individual: KPIs, gráfico, insights e riscos.',
      tags: ['visao 360', 'detalhe do indicador', 'impacto', 'insights', 'grafico'],
      body: `Ao abrir um indicador você acessa a **Visão 360°**: uma tela executiva com tudo sobre ele.

## O que mostra
- **KPIs do topo** — resultado atual, atingimento, tendência, posição no ranking;
- **Gráfico com abas** — evolução do realizado × meta, com histórico;
- **Rail de inteligência** — insights e riscos calculados automaticamente (ex.: tendência de queda, sazonalidade, meses críticos);
- **Relacionamentos** — desvios abertos, planos de ação vinculados, objetivo estratégico, reuniões que trataram o indicador;
- **Notas e anexos por período**.

## Para que usar
Antes de discutir um indicador em reunião, abra a Visão 360°: em uma tela você tem o número, a história e as tratativas — sem caçar informação em planilhas.`,
    },
    {
      slug: 'como-tratar-um-desvio',
      title: 'Como tratar um desvio (indicador fora da meta)?',
      summary: 'Abertura com Fato-Impacto-Providência, causas 6M, reunião e fechamento.',
      tags: ['desvio', 'fora da meta', 'fca', 'tratativa', 'causa raiz', 'severidade'],
      body: `Quando um indicador **estratégico** fecha o período fora da meta, trate com um **desvio** (Gestão à Vista > Desvios):

## 1. Abertura
- Registre o **Fato** (o que aconteceu), o **Impacto** (consequência) e a **Providência imediata** (contenção — ou marque "não houve providência");
- Classifique a **severidade**: baixa, moderada ou crítica;
- Defina o responsável. A abertura só é permitida para indicadores estratégicos.

## 2. Investigação
- Adicione **causas** categorizadas pelos **6M** (Método, Máquina, Mão de obra, Material, Medida, Meio ambiente);
- A **causa raiz consolidada é bloqueada para edição direta**: ela é preenchida automaticamente pela análise de causa (ferramenta 5 Porquês) — a causa é investigada, não "chutada".

## 3. Tratativa
- Clique em **Criar reunião** para agendar a reunião de tratativa do desvio;
- Na reunião (ou no plano de ação), conduza **Ishikawa → 5 Porquês → 5W2H → PDCA**;
- As ações geradas viram **plano de ação** vinculado ao desvio.

## 4. Fechamento
- Com o plano executado e eficaz, **feche o desvio**. Todo o histórico fica auditável.`,
    },
    {
      slug: 'como-criar-um-plano-de-acao',
      title: 'Como criar um plano de ação?',
      summary: 'Passo a passo: origem, tarefas, evidências e verificação de eficácia.',
      tags: ['plano de acao', 'criar plano', 'acao', 'nova acao', 'corretiva', '5w2h'],
      body: `1. Acesse **Gestão à Vista > Plano de Ação** e clique em **Nova ação** (planos também nascem de desvios, reuniões, NCs e da ferramenta 5W2H).
2. Preencha:
   - **Título** e descrição do que será feito;
   - **Origem** (desvio, reunião, auditoria, decisão preventiva…);
   - **Prioridade/criticidade** — baixa, média, alta ou crítica;
   - **Responsável** e **prazos**;
   - **Vínculos** — indicador, objetivo estratégico ou desvio relacionados.
3. Adicione as **tarefas/etapas**, cada uma com responsável, prazo e ordem.
4. Durante a execução: atualize o **status** (não iniciado, em andamento, aguardando evidência, concluído) e o **progresso (%)**; anexe **evidências** e use os **comentários**.
5. Ao concluir, solicite a **verificação de eficácia**: um avaliador confirma se a ação realmente resolveu o problema. Se não resolveu, o plano pode ser reaberto.

As tarefas aparecem no **Meu Dia** e na tela **Tarefas** de cada responsável. Exclusões passam por **pedido de exclusão** aprovado — nada some sem rastro.`,
    },
    {
      slug: 'ciclo-do-plano-de-acao',
      title: 'Ciclo do plano de ação: da abertura à eficácia',
      summary: 'Status, progresso, aprovações e o que significa cada etapa.',
      tags: ['ciclo', 'status', 'eficacia', 'execucao', 'aprovacao', 'plano'],
      body: `Um plano de ação percorre este ciclo:

1. **Abertura** — nasce de um desvio, reunião, NC, auditoria ou decisão preventiva, com dono, prazo e vínculos.
2. **Execução** — as tarefas são feitas; o progresso (%) e o status avançam: não iniciado → em andamento → aguardando evidência → concluído.
3. **Evidências** — cada tarefa/ação recebe anexos que comprovam o que foi feito.
4. **Verificação de eficácia** — depois de concluído, alguém avalia: o problema foi de fato resolvido? O indicador voltou à meta?
   - **Eficaz** → o plano é finalizado;
   - **Não eficaz** → reabre-se a análise (a causa raiz pode ter sido outra).
5. **Governança** — aprovações gerais e pedidos de exclusão passam pela central de **Aprovações**; toda alteração fica na trilha de auditoria.

Acompanhe seus planos pelo Meu Dia (tarefas e ações vencidas aparecem automaticamente) e pela lista do módulo com filtros por status, área e responsável.`,
    },
    {
      slug: 'evidencias-em-tarefas',
      title: 'Evidências em tarefas',
      summary: 'Anexe arquivos que comprovam a execução de cada tarefa.',
      tags: ['evidencia', 'anexo', 'comprovacao', 'tarefa', 'arquivo'],
      body: `Cada tarefa de um plano de ação pode (e deve) receber **evidências** — arquivos que comprovam a execução: fotos, documentos, planilhas, registros.

## Como anexar
1. Abra o plano de ação e localize a tarefa no quadro de execução.
2. Use o **ícone de clipe** (anexo) no cartão da tarefa.
3. Envie o arquivo — ele fica vinculado à tarefa, com autor e data.

## Por que importa
- O status **"aguardando evidência"** sinaliza tarefas feitas mas ainda não comprovadas;
- A **verificação de eficácia** e as auditorias (internas e ISO) usam essas evidências como prova;
- No Meu Dia, itens que exigem evidência são sinalizados.

Dica: anexe a evidência no momento da conclusão — depois é retrabalho caçar o arquivo.`,
    },
    {
      slug: 'ferramentas-analise-de-causa',
      title: 'Ferramentas de análise de causa (Ishikawa, 5 Porquês, 5W2H, PDCA)',
      summary: 'Como conduzir a investigação metodológica com apoio de IA.',
      tags: ['ishikawa', '5 porques', '5w2h', 'pdca', 'analise de causa', 'causa raiz', 'espinha de peixe', '6m'],
      body: `Na aba **Análise de Causa** (disponível no plano de ação e na reunião), as ferramentas clássicas de qualidade são conduzidas em sequência metodológica, com **desbloqueio progressivo**: Ishikawa → 5 Porquês → 5W2H → PDCA.

## Ishikawa (espinha de peixe, 6M)
Liste causas possíveis por categoria: Método, Máquina, Mão de obra, Material, Medida e Meio ambiente. Priorize as mais prováveis. Use as **Dicas de IA** para sugestões e o botão **"Investigar nos 5 Porquês"** para aprofundar uma causa.

## 5 Porquês
Pergunte "por quê?" em cadeia (pode passar de 5 níveis) até chegar à **causa raiz** — marque-a. Ela **propaga automaticamente para o desvio** vinculado. Qualquer nível pode ser convertido em ação.

## 5W2H
Estruture a solução em 7 blocos: O quê, Por quê, Onde, Quando, Quem, Como e Quanto custa. Ao final, **"Concluir e gerar tarefa"** cria a primeira tarefa do plano (e o próprio plano, se não existir).

## PDCA
Os 4 quadrantes (Planejar, Fazer, Checar, Agir) são pré-preenchidos com problema, causa, meta e indicador. Marque etapas concluídas e gere tarefas.

## Recursos comuns
Edição direta nos blocos, sugestões por IA em todas as ferramentas, conversão de qualquer item em ação/tarefa, **exportação como imagem (PNG)** para a ata, e auditoria de cada alteração.`,
    },
    {
      slug: 'reunioes-de-tratativa',
      title: 'Reuniões: pauta, decisões e ata por IA',
      summary: 'Crie reuniões com participantes, pauta, decisões rastreáveis e ata automática.',
      tags: ['reuniao', 'ata', 'pauta', 'decisao', 'participantes', 'convite'],
      body: `O módulo **Reuniões** (Gestão à Vista > Reuniões) transforma reuniões em ritos com método:

## Como criar
1. Clique em **Nova reunião**: escolha o tipo (Indicadores, Diretoria, Setorial, Projeto, Desvio), formato (presencial/online/híbrido), data, local e responsável.
2. Adicione **participantes e convidados** — convites podem ser enviados por e-mail; a presença é registrada.
3. Monte a **pauta** com os temas.

## Durante e depois
- Registre **decisões** com dono e prazo — decisões viram cobrança;
- Conduza as **ferramentas de análise de causa** (Ishikawa, 5 Porquês, 5W2H, PDCA) na própria reunião, quando ela trata um desvio;
- Gere **ações/planos** direto da reunião;
- Use a **Ata por IA** — o sistema redige a ata a partir da pauta, decisões e análises;
- **Conclua** a reunião para fechar o registro.

Reuniões criadas a partir de um **desvio** já vêm vinculadas ao indicador e ao desvio de origem — o histórico fica encadeado de ponta a ponta.`,
    },
    {
      slug: 'reuniao-mensal-de-resultados',
      title: 'Reunião Mensal de Resultados',
      summary: 'O rito executivo mensal: preparação por área, apresentação e follow-ups.',
      tags: ['reuniao mensal', 'resultados', 'analise critica', 'apresentacao', 'follow-up', 'rito'],
      body: `A **Reunião Mensal de Resultados** (Gestão à Vista > Reunião Mensal) organiza o rito executivo completo de análise crítica.

## Preparação
1. Crie a reunião do período: ciclo, formato, responsável, secretário, objetivo e premissas.
2. Cada **área** prepara sua parte: indicadores do mês (meta, realizado, atingimento, farol, tendência), comentário do gestor, status executivo, impacto financeiro e vínculos com desvios/planos. Um checklist de prontidão mostra quem está pronto.

## Condução
- **Pauta cronometrada** com modo apresentação real (timer por bloco);
- Registro de **decisões**, **ações**, **lições aprendidas** e **padronizações** (POP, checklist, treinamento);
- **Riscos críticos** e **diretrizes da diretoria** do período.

## IA
O sistema gera **mensagem-chave**, **ata** e **resumo executivo** automaticamente.

## Depois
Os **follow-ups** (semanais/mensais) cobram as decisões até a próxima reunião. O acumulado do período aparece junto aos indicadores. Só indicadores **estratégicos** entram na reunião mensal.`,
    },
    {
      slug: 'okrs-ciclos-e-checkins',
      title: 'OKRs: ciclos, objetivos e check-ins',
      summary: 'Gestão ágil de metas com resultados-chave e cadência semanal.',
      tags: ['okr', 'objetivo', 'resultado chave', 'kr', 'checkin', 'metas ageis', 'confianca'],
      body: `O módulo **OKRs** (Gestão à Vista > OKRs) complementa o BSC com gestão ágil de metas.

## Estrutura
- **Ciclos** — períodos (trimestre, semestre) que agrupam os objetivos;
- **Objetivos** — declarações inspiradoras com dono, time, nível de **confiança** e status (planejado / no rumo / em risco); podem ser vinculados a um **objetivo estratégico** do mapa BSC;
- **Resultados-chave (KRs)** — métricas com valor inicial, atual e meta, direção e responsável.

## Rotina
1. No início do ciclo, defina objetivos e KRs.
2. Toda semana, faça o **check-in**: atualize o progresso dos KRs e o nível de confiança.
3. No fim do ciclo, avalie e planeje o próximo.

## OKR ou indicador?
Indicadores medem a **operação contínua** (todo mês, sempre); OKRs medem **apostas de mudança** com prazo definido. Os dois convivem — e o OKR pode ser ligado à estratégia pelo mapa.`,
    },
    {
      slug: 'cronogramas-projetos',
      title: 'Cronogramas e Projetos',
      summary: 'Projetos com marcos, tarefas com dependências e orçamento.',
      tags: ['projeto', 'cronograma', 'gantt', 'marco', 'milestone', 'portfolio'],
      body: `O módulo **Cronogramas** (Gestão à Vista > Cronogramas) gerencia projetos e seus prazos.

## Recursos
- **Portfólio** — visão de todos os projetos com status (Planejado, Em andamento, Concluído);
- **Projeto** — datas, responsável, **orçamento** e vínculo a indicador;
- **Marcos (milestones)** — os grandes entregáveis com data;
- **Tarefas com dependências** — uma tarefa pode depender de outra, formando o cronograma (base do Gantt);
- **Indicadores de projeto** — desempenho consolidado.

## Como usar
1. Crie o projeto com período, responsável e orçamento.
2. Cadastre os marcos e depois as tarefas de cada fase, ligando dependências.
3. Acompanhe pelo portfólio e trate atrasos com planos de ação.

Projetos podem ser vinculados a **riscos** (registro de riscos) e a **indicadores** que medem seu resultado.`,
    },
  ],
};
