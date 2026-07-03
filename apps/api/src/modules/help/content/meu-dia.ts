import { HelpCatalogCategory } from './types';

export const meuDia: HelpCatalogCategory = {
  slug: 'meu-dia',
  title: 'Meu Dia e Tarefas',
  description: 'Sua central de trabalho: pendências, prioridades, delegação e equipe.',
  icon: 'Sun',
  position: 2,
  articles: [
    {
      slug: 'meu-dia-visao-geral',
      title: 'Meu Dia: sua central de trabalho',
      summary: 'A página inicial que reúne tudo que exige sua atenção hoje.',
      tags: ['meu dia', 'central de trabalho', 'pendencias', 'inicio', 'landing', 'cockpit'],
      body: `O **Meu Dia** é a página inicial padrão após o login: uma caixa de entrada corporativa que reúne, em uma única tela, tudo que exige a sua atenção — vindo de todos os módulos, sem duplicar registros.

## O que aparece no Meu Dia
- Tarefas de **planos de ação** e ações vencidas;
- **Aprovações** pendentes (fluxos, documentos, movimentações);
- Tarefas de **automações/fluxos de trabalho**;
- **Reuniões** do dia;
- **Documentos** aguardando sua aprovação ou liberados para você editar;
- **Riscos críticos** sob sua responsabilidade;
- **Não conformidades** atribuídas a você;
- **Indicadores fora da meta** e alertas de desvio;
- **Comunicados com leitura obrigatória**.

## Como ler a tela
- **8 cartões de resumo** no topo (Pendentes, Vencidos, Vencendo hoje, Aprovações, Indicadores, Riscos críticos, Documentos, Reuniões hoje) — cada cartão é clicável e filtra a lista.
- **Abas**: Visão geral (painel-resumo), Prioridades, Hoje, Pendentes, Aprovações, Atrasados, Próximos prazos, Delegados, Acompanhando e Fixados.
- Cada item mostra prioridade, prazo, dias de atraso e a **ação recomendada**.

A aba **Visão geral** é um painel consolidado (resumo do dia, insights com IA, prioridades, aprovações, próximas reuniões, riscos e documentos). Para trabalhar a lista item a item, use as abas **Prioridades** ou **Hoje**.`,
    },
    {
      slug: 'meu-dia-agir-acompanhar-fixar',
      title: 'Agir, acompanhar e fixar itens no Meu Dia',
      summary: 'Como resolver, seguir e priorizar itens da sua central.',
      tags: ['agir agora', 'acompanhar', 'fixar', 'aprovar', 'item', 'meu dia', 'follow'],
      body: `Sobre cada item do Meu Dia você pode:

- **Agir agora** — abre o item no módulo de origem ou resolve na hora (por exemplo, aprovar/reprovar uma aprovação pendente sem sair da tela).
- **Acompanhar** — você passa a seguir um item mesmo sem ser o responsável; ele aparece na aba "Acompanhando".
- **Fixar** — o item vai para o topo da sua lista e para a aba "Fixados".
- **Visão 360°** — abre o painel consolidado da entidade (indicador, risco, NC, documento, reunião, ação) com tudo que se relaciona a ela.

A lista é ordenada por **prioridade → prazo → criação**, com os fixados no topo. O botão **Atualizar** reconstrói o índice de pendências na hora.

## Recomendações da IA
O assistente do Meu Dia analisa seus itens e gera recomendações (ex.: "você tem 6 itens vencidos concentrados na mesma origem"). Você pode ocultar cada recomendação ou avaliá-la como útil/não útil.`,
    },
    {
      slug: 'meu-dia-visoes-e-filtros',
      title: 'Visões (lista, kanban, calendário) e filtros salvos',
      summary: 'Alterne entre Lista, Tabela, Kanban, Calendário e Linha do tempo; salve filtros.',
      tags: ['kanban', 'calendario', 'timeline', 'lista', 'tabela', 'filtro salvo', 'personalizar', 'visao'],
      body: `Nas abas de lista do Meu Dia (Prioridades, Hoje, Pendentes etc.) você escolhe como visualizar os itens:

- **Lista** — cartões detalhados (padrão);
- **Tabela** — colunas compactas para varrer muitos itens;
- **Kanban** — colunas por status;
- **Calendário** — itens distribuídos por data de prazo;
- **Linha do tempo** — sequência cronológica.

A visão escolhida fica salva como sua preferência. Observação: na aba **Visão geral** o alternador não aparece, porque ela é um painel-resumo (abra Prioridades ou Hoje para alternar visões).

## Filtros salvos
Depois de combinar aba + tipo de item + busca, clique em **Salvar filtro** para reutilizar essa combinação depois com um clique.

## Personalizar
No botão **Personalizar** você define a visão padrão, o modo compacto, quais widgets aparecem na Visão geral e qual é a sua **página inicial** após o login.`,
    },
    {
      slug: 'meu-dia-delegacao',
      title: 'Delegação: passe sua caixa durante uma ausência',
      summary: 'Férias ou viagem? Delegue seus itens a um colega por um período.',
      tags: ['delegacao', 'delegar', 'ferias', 'ausencia', 'substituto', 'equipe'],
      body: `A **delegação** permite que outro usuário veja e trate os itens da sua central durante um período (férias, viagem, afastamento).

## Como delegar
1. No Meu Dia, abra **Delegações**.
2. Escolha o colega que vai receber seus itens — a lista mostra primeiro **Minha equipe** (pessoas das áreas em que você é responsável no organograma) e depois os demais colaboradores.
3. Defina **início, fim e motivo**.
4. Salve. Durante o período, o delegado vê seus itens na aba **Delegados** dele.

## O que a delegação NÃO faz
- Não transfere a propriedade dos registros — a origem continua com você;
- Não dá ao delegado permissões que ele não tem nos módulos de origem;
- Termina automaticamente no fim do período.

Você pode encerrar uma delegação antes do prazo a qualquer momento.`,
    },
    {
      slug: 'meu-dia-equipe',
      title: 'Meu Dia da Equipe (para gestores)',
      summary: 'Visão gerencial: carga de trabalho, gargalos e itens da equipe.',
      tags: ['equipe', 'gestor', 'carga de trabalho', 'workload', 'gargalo', 'time'],
      body: `Gestores com a permissão de equipe enxergam o **Meu Dia da Equipe**: uma visão gerencial consolidada do time.

A equipe é definida pelo **organograma**: são as pessoas das áreas em que você aparece como responsável (incluindo sub-áreas).

## O que mostra
- **Resumo da equipe** — total de pendências, vencidos e aprovações do time;
- **Itens da equipe** — a lista completa, filtrável por pessoa;
- **Carga de trabalho** — quantos itens cada pessoa tem, para identificar sobrecarga;
- **Gargalos** — onde o trabalho está travando (itens parados há mais tempo, aprovações represadas).

Use essa visão para redistribuir trabalho e destravar aprovações antes que virem atraso.`,
    },
    {
      slug: 'tarefas-caixa-de-trabalho',
      title: 'Tela Tarefas: sua lista simples de pendências',
      summary: 'A versão enxuta do Meu Dia, com seção dedicada a documentos.',
      tags: ['tarefas', 'pendencias', 'documentos liberados', 'liberar', 'rejeitar', 'concluir'],
      body: `A tela **Tarefas** é a caixa de trabalho enxuta: uma lista direta das suas pendências em aberto, sem o peso do painel completo do Meu Dia.

## Abas
- **Todas** — todas as suas pendências em aberto;
- **Documentos** — apenas itens de documento: aguardando sua aprovação, liberados para você editar ou aguardando liberação.

## Ações rápidas em documentos
- **Liberar** ou **Rejeitar** (com justificativa) — quando você é o aprovador de uma solicitação de edição;
- **Concluir** — quando você terminou de editar um documento liberado a você;
- **Abrir** — vai para o documento no módulo de origem.

Cada tarefa mostra prioridade (Crítica/Alta/Média/Baixa), badge de atraso, prazo e a ação recomendada. O botão **Atualizar** sincroniza a lista.`,
    },
    {
      slug: 'como-criar-uma-tarefa',
      title: 'Como criar uma tarefa?',
      summary: 'Tarefas nascem dentro de planos de ação, fluxos e ferramentas de análise.',
      tags: ['criar tarefa', 'tarefa', 'nova tarefa', 'etapa', 'plano de acao'],
      body: `No Gestão 360, tarefas não ficam soltas — elas sempre pertencem a um contexto, o que garante rastreabilidade. Você cria tarefas assim:

## 1. Dentro de um Plano de Ação (o caminho principal)
1. Abra **Gestão à Vista > Plano de Ação** e entre na ação desejada (ou crie uma nova).
2. Na seção **Tarefas/Etapas**, clique em adicionar tarefa.
3. Informe descrição, **responsável** e **prazo**.
4. A tarefa aparecerá automaticamente no **Meu Dia** e na tela **Tarefas** do responsável.

## 2. Pela ferramenta 5W2H
Ao concluir uma análise 5W2H (em um plano de ação ou reunião), o botão **"Concluir e gerar tarefa"** cria a primeira tarefa do plano — e o próprio plano, se ainda não existir.

## 3. Por automações
Fluxos de trabalho da **Central de Automações** podem gerar tarefas automaticamente (ex.: cobrança recorrente); elas também chegam ao Meu Dia.

## 4. Decisões de reunião
Decisões registradas em reuniões têm dono e prazo, e podem ser convertidas em ações/tarefas do plano.`,
    },
    {
      slug: 'como-acompanhar-tarefas-atrasadas',
      title: 'Como acompanhar tarefas atrasadas?',
      summary: 'Use o cartão Vencidos, a aba Atrasados e a visão de equipe.',
      tags: ['atrasadas', 'vencidos', 'atraso', 'prazo', 'sla', 'cobranca'],
      body: `Para enxergar e tratar atrasos:

1. **Meu Dia > cartão "Vencidos"** — clique no cartão para filtrar só o que passou do prazo. Cada item mostra há quantos dias está vencido.
2. **Aba "Atrasados"** — lista dedicada, ordenada por prioridade.
3. **Aba "Próximos prazos"** — o que está prestes a vencer (previna o atraso).
4. **Gestores:** no **Meu Dia da Equipe**, veja os atrasos por pessoa (carga de trabalho) e os gargalos do time.
5. As **recomendações de IA** do Meu Dia detectam acúmulos de atraso e sugerem por onde começar.

Nos **planos de ação**, o status "aguardando evidência" e o percentual de progresso ajudam a distinguir o que está andando do que está parado. Indicadores de atraso também alimentam a Reunião Mensal de Resultados (follow-ups).`,
    },
  ],
};
