import { HelpCatalogCategory } from './types';

export const primeirosPassos: HelpCatalogCategory = {
  slug: 'primeiros-passos',
  title: 'Primeiros passos',
  description: 'Login, navegação, instalação no celular e como pedir ajuda.',
  icon: 'Compass',
  position: 1,
  articles: [
    {
      slug: 'visao-geral-do-sistema',
      title: 'Visão geral do Gestão 360',
      summary: 'O que é a plataforma, como o menu está organizado e como navegar.',
      tags: ['inicio', 'navegacao', 'menu', 'visao geral', 'plataforma', 'modulos'],
      body: `O Gestão 360 é uma plataforma integrada de gestão empresarial. Tudo é conectado: o mesmo indicador que aparece no Painel Executivo alimenta desvios, reuniões, planos de ação e até a remuneração variável.

## Como o menu está organizado

O menu lateral agrupa os módulos:
- **Meu Dia** — sua central de trabalho: tudo que exige sua atenção hoje, em uma tela.
- **Tarefas** — lista simples das suas pendências em aberto, incluindo documentos liberados para você.
- **Gestão à Vista** — Painel Executivo, Árvore Organizacional, Mapa Estratégico, Indicadores, Desvios, Plano de Ação, Reuniões, Reunião Mensal, OKRs e Cronogramas.
- **Qualidade e Compliance** — Documentos (GED), Processos e SIPOC, Formulários e Checklists, Auditorias, Não Conformidades, Riscos e Análise de Impacto.
- **Segurança dos Alimentos** — APPCC, fluxograma de processo, monitoramento de PCC, rastreabilidade e recall.
- **Segurança Patrimonial** — portaria, controle de acesso, autorizações com QR Code, rondas e ocorrências.
- **Cargos e Salários** — catálogo de cargos, tabelas salariais, movimentações, mérito e equidade.
- **Comunicação** — mural, comunicados com leitura obrigatória, campanhas, enquetes e chat.
- **Gestão de Prêmio** — remuneração variável (PLR/bônus) com apuração auditável.
- **Administração** — usuários e permissões, automações, importações, relatórios, períodos e Central de Atendimento.

Os módulos visíveis dependem do **plano contratado pela sua empresa** e das **permissões do seu perfil** — por isso o seu menu pode ser menor que o de um colega.

## Navegação rápida
- Use a **busca global** no topo (atalho Ctrl+K ou Cmd+K) para encontrar indicadores, ações e setores.
- O sino no topo mostra as **notificações**; o ícone de lua/sol alterna **tema claro/escuro**.
- Clique no seu nome no topo para acessar **perfil e sair**.`,
    },
    {
      slug: 'perfil-e-preferencias',
      title: 'Perfil, senha e preferências',
      summary: 'Atualize seus dados, foto, senha e preferências pessoais.',
      tags: ['perfil', 'senha', 'foto', 'preferencias', 'conta', 'tema'],
      body: `Cada usuário tem um perfil corporativo com nome, cargo, área e contatos.

## O que você pode ajustar
- **Foto e dados de perfil** — acessível pelo menu do seu nome (topo direito) ou pelo Diretório em Comunicação.
- **Tema claro/escuro** — ícone de lua/sol no topo.
- **Preferências do Meu Dia** — visão padrão, widgets visíveis e página inicial (em Meu Dia, botão Personalizar).
- **Status e presença** — no chat, os colegas veem quando você está online.

## Senha e acesso
- O acesso é criado pelo administrador da empresa (módulo Administração, tela Usuários).
- Se você esqueceu a senha ou está sem acesso, procure o administrador do sistema na sua empresa — ele pode redefinir seu acesso.

As permissões do seu perfil definem o que aparece para você. Se sentir falta de um módulo ou botão, veja o artigo sobre permissões e acesso.`,
    },
    {
      slug: 'permissoes-e-acesso',
      title: 'Por que não vejo um módulo ou botão?',
      summary: 'Como funcionam permissões, perfis de acesso, plano e visibilidade por área.',
      tags: ['permissao', 'acesso', 'perfil de acesso', 'bloqueado', 'nao vejo', 'rbac', 'plano'],
      body: `O que aparece para cada pessoa no Gestão 360 depende de três camadas:

1. **Plano da empresa** — cada empresa contrata um plano (Essencial, Profissional, Corporativo, Enterprise) que habilita grupos de módulos. Se o módulo não faz parte do plano, ele não aparece para ninguém da empresa.
2. **Permissões do seu perfil** — o administrador atribui um perfil de acesso (e permissões extras) a cada usuário. Exemplos: ver indicadores, criar planos de ação, gerenciar documentos, aprovar movimentações.
3. **Visibilidade por área** — além da permissão, o administrador pode limitar quais áreas/setores da empresa você enxerga. Você pode ter acesso a indicadores, mas só os da sua área.

## O que fazer
- Se você precisa de acesso a algo que não vê, solicite ao **administrador da empresa** (quem gerencia o módulo Administração > Usuários).
- Administradores: em **Administração > Usuários**, edite o usuário, ajuste o perfil de acesso, as permissões individuais e as áreas visíveis.

Os módulos-base (Meu Dia, Tarefas e Administração) estão sempre ativos em todos os planos.`,
    },
    {
      slug: 'instalar-no-celular-pwa',
      title: 'Instalar o Gestão 360 no celular ou PC',
      summary: 'A plataforma instala como aplicativo (PWA) com notificações push.',
      tags: ['celular', 'aplicativo', 'app', 'instalar', 'pwa', 'push', 'notificacao', 'mobile'],
      body: `O Gestão 360 funciona como um **aplicativo instalável (PWA)** no celular (Android e iPhone) e no computador — sem loja de aplicativos.

## Como instalar
- **Android (Chrome):** abra o portal, toque no menu do navegador (⋮) e escolha "Instalar aplicativo" ou "Adicionar à tela inicial".
- **iPhone (Safari):** abra o portal, toque no botão de compartilhar e escolha "Adicionar à Tela de Início".
- **PC (Chrome/Edge):** clique no ícone de instalação que aparece na barra de endereço.

## Notificações push
Após instalar (ou mesmo no navegador), o sistema pode pedir permissão para enviar **notificações push** — alertas de prazos, aprovações e comunicados chegam direto no seu dispositivo. Aceite a permissão quando solicitado.

## Funcionamento offline
Pontos críticos da operação, como a **portaria (Segurança Patrimonial)**, funcionam mesmo com oscilação de internet: os registros são sincronizados quando a conexão volta.`,
    },
    {
      slug: 'central-de-ajuda-e-assistente',
      title: 'Onde pedir ajuda: Central de Ajuda, Assistente e chamados',
      summary: 'Use o Assistente G360, a Central de Ajuda e a Central de Atendimento.',
      tags: ['ajuda', 'suporte', 'assistente', 'bot', 'chamado', 'ticket', 'duvida'],
      body: `Você tem três caminhos para tirar dúvidas ou pedir suporte:

1. **Assistente G360 (este chat)** — o robô de ajuda responde dúvidas sobre o uso da plataforma com base nos manuais oficiais e nos documentos publicados da sua empresa. Pergunte em linguagem natural, por exemplo: "como criar um indicador?".
2. **Central de Ajuda** — artigos organizados por categoria, com busca. Cada artigo aceita feedback (útil / não útil), o que nos ajuda a melhorar.
3. **Central de Atendimento** — quando a dúvida vira problema (erro, comportamento inesperado, solicitação), abra um **chamado** em Administração > Central de Atendimento. Descreva o ocorrido e acompanhe a conversa com a equipe de suporte por lá; você recebe as respostas no próprio chamado.

Dica: o Assistente enxerga em qual tela você está e prioriza conteúdo daquele módulo.`,
    },
  ],
};
