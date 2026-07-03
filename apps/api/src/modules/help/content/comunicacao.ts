import { HelpCatalogCategory } from './types';

export const comunicacao: HelpCatalogCategory = {
  slug: 'comunicacao',
  title: 'Comunicação',
  description: 'Mural, comunicados com leitura obrigatória, campanhas, enquetes e chat.',
  icon: 'MessageSquare',
  position: 8,
  articles: [
    {
      slug: 'como-usar-a-comunicacao',
      title: 'Como usar a Comunicação (mural e central)',
      summary: 'O mural de comunicados da empresa e a central de publicações.',
      tags: ['comunicacao', 'mural', 'comunicado', 'post', 'endomarketing'],
      body: `O módulo **Comunicação** concentra a comunicação interna da empresa.

## Meu Mural
O mural mostra os **comunicados** direcionados a você: avisos simples, banners, vídeos, enquetes e pesquisas — com prioridade (Baixa a Urgente) e destaque para os fixados. Comunicados com **leitura obrigatória** pedem sua confirmação de ciência (e aparecem no Meu Dia até você confirmar).

## Interação
- **Reações** — Curtir, Entendi, Importante, Dúvida;
- **Comentários** — quando habilitados pelo autor;
- **Enquetes/pesquisas** — responda direto no card.

## Central
Quem publica acompanha na **Central**: comunicados publicados e agendados, com as métricas de leitura.

## Criar um comunicado
1. Vá em **Criar**: escreva o conteúdo (ou peça um **rascunho por IA** a partir do tema);
2. Escolha o tipo, a **audiência** e os **canais** (portal, card na home, Meu Dia, QR code, TV corporativa, e-mail, push, popup obrigatório);
3. Marque **leitura obrigatória** se precisar de prova de ciência;
4. Publique ou **agende**.`,
    },
    {
      slug: 'comunicado-leitura-obrigatoria',
      title: 'Comunicado com leitura obrigatória (prova de ciência)',
      summary: 'Garanta e comprove que todos leram políticas e avisos críticos.',
      tags: ['leitura obrigatoria', 'ciencia', 'confirmacao', 'compliance', 'prova de leitura'],
      body: `Para políticas, normas de segurança (NRs) e avisos críticos, use a **leitura obrigatória**:

1. Ao criar o comunicado, marque **Leitura obrigatória com confirmação de ciência**;
2. Defina a **audiência** (todos, áreas ou pessoas específicas);
3. Publique.

## O que acontece
- O comunicado aparece com destaque no mural e vira **pendência no Meu Dia** de cada destinatário até a confirmação;
- Pode ser exibido como **popup obrigatório** no login, se você escolher esse canal;
- Cada colaborador clica em **confirmar ciência** — o registro guarda quem confirmou e quando.

## Métricas
Na aba **Métricas** você acompanha: entregues, visualizados, **confirmados** e pendentes — com a lista nominal. É a prova documental para compliance e auditorias trabalhistas.`,
    },
    {
      slug: 'campanhas-enquetes-metricas',
      title: 'Campanhas, enquetes, mídias e métricas',
      summary: 'Organize o endomarketing com campanhas, colete opinião e meça leitura.',
      tags: ['campanha', 'enquete', 'pesquisa', 'midia', 'metricas', 'engajamento'],
      body: `## Campanhas
Agrupe comunicados em **campanhas** (ex.: SIPAT, Campanha de Segurança, Integração) com objetivo, categoria e período — e vincule a **indicadores e ações** quando a campanha apoia uma meta.

## Enquetes e pesquisas
- **Enquete (poll)** — pergunta rápida com opções; resultado em tempo real;
- **Pesquisa (survey)** — questionário mais completo;
Ambas são tipos de comunicado: crie, direcione a audiência e acompanhe as respostas em Métricas.

## Biblioteca de mídias
Guarde **banners, imagens, vídeos, PDFs e modelos** reutilizáveis, com categorias e tags — a contagem de uso mostra o que funciona.

## Métricas
Por comunicado: entregas, leituras, confirmações de ciência, reações, comentários e respostas de enquete. Use os números para ajustar canal e linguagem — comunicação interna também se gerencia com dado.`,
    },
    {
      slug: 'chat-interno-e-diretorio',
      title: 'Chat interno e diretório de pessoas',
      summary: 'Converse com colegas, veja quem está online e acesse perfis.',
      tags: ['chat', 'mensagem', 'conversa', 'diretorio', 'pessoas', 'presenca', 'online'],
      body: `## Chat
O **chat interno** mantém as conversas de trabalho dentro do ambiente corporativo:
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
