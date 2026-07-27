import { HelpCatalogCategory } from './types';

export const comunicacao: HelpCatalogCategory = {
  slug: 'comunicacao',
  title: 'Comunicação',
  description: 'Publicações institucionais, banners, confirmação de leitura, métricas e chat.',
  icon: 'MessageSquare',
  position: 9,
  articles: [
    {
      slug: 'como-usar-a-comunicacao',
      title: 'Como usar a Comunicação (central de publicações)',
      summary: 'Criar, programar e acompanhar as comunicações enviadas aos colaboradores.',
      tags: ['comunicacao', 'publicacao', 'comunicado', 'banner', 'endomarketing'],
      body: `O módulo **Comunicação** é a central de publicações internas da empresa. O menu tem quatro opções: **Visão Geral**, **Publicações**, **Criar Publicação** e **Biblioteca de Mídias** (mais **Configurações**, para administradores).

## Visão Geral
Mostra quatro indicadores reais — publicações ativas, programadas, visualizações no mês e confirmações pendentes — além das publicações recentes e das programadas.

## Publicações
Lista única de tudo que já foi criado, com filtros por título, status, categoria, público, período e autor. Alterne entre **lista** e **grade com miniaturas**. Cada publicação tem as ações: visualizar, editar, duplicar, publicar agora, reagendar, encerrar, arquivar e excluir (conforme permissão).

## Status possíveis
Rascunho, Aguardando aprovação, Programada, Publicada, Encerrada e Arquivada.

## Criar uma publicação
A criação tem quatro etapas simples:
1. **Conteúdo** — título, resumo, texto completo, categoria e anexos;
2. **Aparência** — formato (banner 16:9, card de feed 4:5, imagem e texto, galeria ou somente texto), imagem com recorte na proporção recomendada, texto alternativo e pré-visualização no computador e no celular;
3. **Público** — todos os colaboradores, unidade, diretoria, área, setor, cargo, grupo ou pessoas específicas, com a **quantidade estimada** de destinatários;
4. **Publicação** — publicar agora ou agendar, data de encerramento, destaque, confirmação de leitura, notificação interna, aviso por e-mail e botão de ação opcional.

Toda publicação marcada para o feed aparece em **Minha Vida Funcional > Comunicação Interna** para o público escolhido.`,
    },
    {
      slug: 'comunicado-leitura-obrigatoria',
      title: 'Publicação com confirmação de leitura (prova de ciência)',
      summary: 'Garanta e comprove que todos leram políticas e avisos críticos.',
      tags: ['leitura obrigatoria', 'ciencia', 'confirmacao', 'compliance', 'prova de leitura'],
      body: `Para políticas, normas de segurança (NRs) e avisos críticos, use a **confirmação de leitura**:

1. Na etapa **Publicação**, marque **Exigir confirmação de leitura**;
2. Defina o **público** na etapa anterior (todos, áreas, cargos ou pessoas específicas);
3. Publique ou agende.

## O que acontece
- A publicação recebe o selo **Confirmação necessária** na Comunicação Interna do colaborador;
- Vira **pendência no Meu Dia** de cada destinatário até a confirmação;
- Um bloco no topo do feed avisa quantos comunicados aguardam confirmação;
- O colaborador abre o comunicado e clica em **Confirmar leitura** — o registro guarda quem confirmou, data, hora, empresa, unidade, IP e navegador. Não é possível confirmar duas vezes.

## Métricas
Na aba **Métricas** da publicação você vê: público total, visualizações, não visualizados, confirmações e pendentes — com a lista nominal e filtro por situação. Dá para **exportar em CSV** para compliance e auditorias trabalhistas.`,
    },
    {
      slug: 'midias-metricas-categorias',
      title: 'Biblioteca de mídias, métricas e categorias',
      summary: 'Reaproveite imagens, meça a leitura e organize as categorias da empresa.',
      tags: ['midia', 'banner', 'imagem', 'metricas', 'categoria', 'aprovacao', 'engajamento'],
      body: `## Biblioteca de mídias
Guarde **imagens, banners e documentos** reutilizáveis, organizados por pasta e pesquisáveis por nome. Cada item mostra miniatura, tamanho, formato e em quantas publicações está em uso. Você pode substituir o arquivo (mantendo o vínculo), arquivar e excluir — mídias em uso só podem ser arquivadas, nunca excluídas, para não quebrar publicações no ar.

A biblioteca **alerta quando a imagem está fora das proporções recomendadas** (16:9 para banner, 4:5 para feed, 1:1 para card).

## Métricas
Por publicação: público total, pessoas alcançadas, visualizações, não visualizados, confirmações, pendentes, taxa de leitura e taxa de confirmação. Você consegue ver **quem visualizou, quem não visualizou, quem confirmou e quem falta**, e exportar a lista.

A visualização só é registrada quando o colaborador **abre** o conteúdo — não ao apenas ver o card no feed.

## Categorias e aprovação (Configurações)
Em **Configurações** o administrador cadastra as **categorias** da empresa (Comunicado, Campanha, Benefício, Evento, Segurança, RH, Treinamento, Saúde, Reconhecimento, Institucional — e as suas próprias) e liga o **fluxo de aprovação** opcional: com ele ativo, o autor envia para aprovação e o aprovador publica ou devolve com observação.`,
    },
    {
      slug: 'comunicacao-interna-do-colaborador',
      title: 'Comunicação Interna (visão do colaborador)',
      summary: 'Onde o colaborador lê os comunicados da empresa.',
      tags: ['comunicacao interna', 'feed', 'minha vida funcional', 'colaborador', 'mural'],
      body: `O colaborador acessa **Minha Vida Funcional > Comunicação Interna** e encontra um feed institucional com tudo que foi publicado para ele.

## O que tem na tela
- **Banner de destaque** no topo, com as publicações marcadas como destaque (carrossel quando há mais de uma);
- **Feed** em cartões com imagem, categoria, título, resumo e data — em até três colunas no computador e uma no celular;
- **Busca** por texto e filtros por categoria, **Não lidos** e **Confirmação pendente**;
- Selos **Novo**, **Importante** e **Confirmação necessária**;
- Um aviso discreto quando há comunicados aguardando confirmação.

## Ao abrir um comunicado
Aparecem a imagem principal, o conteúdo completo, a galeria, os anexos para download e o botão de ação, quando houver. Se a publicação exigir ciência, o botão **Confirmar leitura** fica ao final.

## Privacidade entre empresas
Cada colaborador vê apenas as publicações destinadas ao seu público e à sua empresa — o isolamento multiempresa é respeitado integralmente.`,
    },
    {
      slug: 'chat-interno-e-diretorio',
      title: 'Chat interno e diretório de pessoas',
      summary: 'Converse com colegas, veja quem está online e acesse perfis.',
      tags: ['chat', 'mensagem', 'conversa', 'diretorio', 'pessoas', 'presenca', 'online'],
      body: `## Chat
O **chat interno** mantém as conversas de trabalho dentro do ambiente corporativo. Ele fica no botão de **mensagens do cabeçalho** (fora do menu de Comunicação, que trata das publicações institucionais):
- **Conversas diretas** com qualquer colega;
- **Anexos** nas mensagens, **reações por emoji**, editar e excluir mensagens;
- **Fixar** conversas importantes, **silenciar** as barulhentas e marcar como lida.

## Diretório
Em **Pessoas** você encontra todos os usuários da empresa:
- **Presença online** — veja quem está disponível agora;
- **Perfil corporativo** — cargo, área, contatos e foto;
- Inicie uma conversa direto do perfil.

## Por que usar o chat interno
As conversas ficam no contexto do trabalho (e não no WhatsApp pessoal), com histórico corporativo e sem misturar assuntos — e o acesso termina junto com o vínculo do colaborador.`,
    },
  ],
};
