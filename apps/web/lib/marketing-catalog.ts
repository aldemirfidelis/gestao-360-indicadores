import type { FaqItem, PublicPage } from './public-site';

/** Catálogo comercial do escopo ativo. Código preservado não significa oferta disponível. */
export const productGroups = [
  {
    id: 'strategy',
    label: 'Estratégia e desempenho',
    description: 'Do objetivo à decisão que move o resultado.',
  },
  {
    id: 'operations',
    label: 'Processos e documentos',
    description: 'O jeito de trabalhar, com contexto e responsabilidade.',
  },
  {
    id: 'execution',
    label: 'Trabalho e projetos',
    description: 'Planos que chegam à rotina da equipe.',
  },
  {
    id: 'governance',
    label: 'Pessoas e governança',
    description: 'Quem faz, quem acompanha e quem pode acessar.',
  },
] as const;

export const activeProductModules = [
  {
    slug: 'gestao-a-vista',
    code: 'strategy',
    group: 'strategy',
    title: 'Estratégia, BSC e OKRs',
    eyebrow: 'Direção compartilhada',
    description:
      'Desdobre perspectivas e objetivos em indicadores, resultados-chave e iniciativas acompanháveis.',
    connection: 'A estratégia encontra os indicadores, os planos e as reuniões de resultados.',
    capabilities: ['Mapa estratégico e BSC', 'Objetivos e OKRs', 'Indicadores vinculados'],
    href: '/solucoes/planejamento-estrategico',
  },
  {
    slug: 'indicadores-e-melhoria',
    code: 'indicators',
    group: 'strategy',
    title: 'Indicadores e melhoria',
    eyebrow: 'Do sinal à ação',
    description:
      'Acompanhe metas e resultados, identifique desvios e investigue causas antes de definir o plano.',
    connection: 'Cada resultado mantém o caminho até sua análise, ação, responsável e eficácia.',
    capabilities: ['Metas, faróis e histórico', 'Ishikawa e 5 Porquês', '5W2H, PDCA e eficácia'],
    href: '/solucoes/gestao-de-indicadores',
  },
  {
    slug: 'processos',
    code: 'processes',
    group: 'operations',
    title: 'Gestão de processos',
    eyebrow: 'A operação ganha forma',
    description:
      'Mapeie SIPOC e BPMN, defina responsabilidades com RACI e acompanhe a governança do processo.',
    connection:
      'Atividades se relacionam com indicadores, documentos, planos e projetos disponíveis.',
    capabilities: ['SIPOC, BPMN e RACI', 'Versões e responsáveis', 'Vínculos e governança'],
    href: '/solucoes/gestao-de-processos',
  },
  {
    slug: 'documentos',
    code: 'documents',
    group: 'operations',
    title: 'Documentos e padrões',
    eyebrow: 'Conhecimento controlado',
    description:
      'Escreva procedimentos, revise com as pessoas certas e publique o conteúdo que a equipe precisa consultar.',
    connection:
      'Documentos se conectam aos processos, ao fluxo de aprovação e às leituras do Meu Dia.',
    capabilities: [
      'Editor visual e revisões',
      'Aprovação e PDF oficial',
      'Leitura obrigatória e busca',
    ],
    href: '/solucoes/gestao-de-documentos',
  },
  {
    slug: 'meu-dia',
    code: 'my-day',
    group: 'execution',
    title: 'Meu Dia',
    eyebrow: 'Prioridade com contexto',
    description:
      'Reúna prazos, decisões, leituras e atividades que exigem sua atenção, com acesso ao registro de origem.',
    connection: 'Pendências de diferentes frentes aparecem na rotina de quem precisa agir.',
    capabilities: ['Prioridades e prazos', 'Pendências relacionadas', 'Acompanhamento e delegação'],
    href: '/modulos#meu-dia',
  },
  {
    slug: 'tarefas',
    code: 'tasks',
    group: 'execution',
    title: 'Tarefas da equipe',
    eyebrow: 'Trabalho visível',
    description:
      'Organize a execução em quadro, lista, calendário ou cronograma, com responsáveis, checklists e comentários.',
    connection: 'O trabalho diário acompanha os compromissos e os planos relacionados.',
    capabilities: [
      'Kanban, lista e calendário',
      'Responsáveis e checklists',
      'Comentários e anexos',
    ],
    href: '/modulos#tarefas',
  },
  {
    slug: 'projetos',
    code: 'projects',
    group: 'execution',
    title: 'Projetos e portfólio',
    eyebrow: 'Execução acompanhável',
    description:
      'Acompanhe tarefas, marcos, orçamento, custos, riscos e evolução dos projetos em uma visão de portfólio.',
    connection: 'Projetos mantêm a relação com indicadores, processos e iniciativas de melhoria.',
    capabilities: [
      'Cronograma e Gantt',
      'Curva S e progresso físico',
      'Custos, riscos e atualizações',
    ],
    href: '/solucoes/gestao-de-projetos',
  },
  {
    slug: 'reunioes-e-resultados',
    code: 'monthly-results',
    group: 'governance',
    title: 'Reuniões e resultados',
    eyebrow: 'Decisões com continuidade',
    description:
      'Prepare resultados por área, conduza a discussão e acompanhe as decisões e os encaminhamentos.',
    connection: 'Indicadores, análises, atas e ações permanecem no mesmo contexto de gestão.',
    capabilities: [
      'Preparação e apresentação',
      'Atas e encaminhamentos',
      'Acompanhamento de resultados',
    ],
    href: '/solucoes/dashboards-executivos',
  },
  {
    slug: 'administracao',
    code: 'users',
    group: 'governance',
    title: 'Administração e suporte',
    eyebrow: 'Uma base de governança',
    description:
      'Organize empresas, áreas, usuários e permissões. Consulte relatórios e acompanhe chamados de suporte à plataforma.',
    connection: 'Perfis e escopos de acesso acompanham os registros e a estrutura da empresa.',
    capabilities: [
      'Perfis e permissões por área',
      'Períodos, relatórios e histórico',
      'Suporte ao uso da plataforma',
    ],
    href: '/solucoes/gestao-multiempresa',
  },
] as const;

export const landingFaq: FaqItem[] = [
  {
    question: 'O que é o Gestão 360?',
    answer:
      'É uma plataforma de gestão corporativa que conecta planejamento estratégico, processos, indicadores, análises, planos de ação, projetos e documentos. O objetivo é acompanhar a execução sem perder o contexto das decisões.',
  },
  {
    question: 'Como os módulos se conectam?',
    answer:
      'Os registros mantêm vínculos entre objetivos, processos, indicadores, desvios, análises, ações e projetos. Responsáveis, histórico e permissões ajudam a percorrer esse caminho e entender o que precisa acontecer depois.',
  },
  {
    question: 'Como acesso a demonstração?',
    answer:
      'O botão Conhecer a demonstração abre uma empresa fictícia com acesso de consulta, sem cadastro prévio. A sessão e os recursos são limitados; alterações, administração e IA não ficam disponíveis nesse ambiente.',
  },
  {
    question: 'Como funciona a avaliação de 30 dias?',
    answer:
      'Envie a solicitação pelo formulário de avaliação. A equipe confirma os dados, o escopo e a disponibilidade de onboarding antes de organizar o acesso por 30 dias. A solicitação não gera cobrança automática nem contratação.',
  },
  {
    question: 'Posso organizar várias empresas, unidades e áreas?',
    answer:
      'Sim. A estrutura permite organizar empresas e áreas e definir a visibilidade dos usuários. Os dados são isolados por empresa, e o acesso depende dos perfis, permissões e módulos liberados.',
  },
  {
    question: 'Como funcionam contratação e implantação?',
    answer:
      'A equipe comercial avalia objetivos, usuários e módulos para definir a proposta e o plano de implantação. Configuração, orientações e entrada em operação são combinadas conforme o escopo contratado.',
  },
  {
    question: 'Quais recursos de inteligência artificial estão disponíveis?',
    answer:
      'Quando habilitados e autorizados, recursos assistidos apoiam a consulta de contexto, os resumos de reuniões e o trabalho com documentos. As sugestões precisam de conferência humana. A disponibilidade depende da configuração e das permissões; a demonstração pública não inclui IA.',
  },
  {
    question: 'Todos os recursos estão incluídos em qualquer plano?',
    answer:
      'A disponibilidade varia conforme o plano, os módulos liberados e o perfil do usuário. A apresentação mostra o escopo ativo do produto; a equipe confirma quais recursos entram na avaliação e na contratação da sua empresa.',
  },
];

export const additionalSolutionPages: PublicPage[] = [
  {
    slug: 'gestao-de-documentos',
    path: '/solucoes/gestao-de-documentos',
    title: 'Gestão de documentos e padrões',
    seoTitle: 'GED, editor visual, revisões e aprovação | Gestão 360',
    description:
      'Elabore documentos no editor visual, controle revisões, aprovação, publicação em PDF e leitura obrigatória.',
    eyebrow: 'Conhecimento controlado',
    summary:
      'Organize procedimentos e políticas com responsáveis, versões e um caminho de revisão até a publicação.',
    problem:
      'Arquivos dispersos dificultam saber qual é a versão vigente e se as pessoas receberam o padrão de trabalho atualizado.',
    benefits: [
      'Elabora documentos no editor visual da plataforma.',
      'Organiza revisões, responsáveis e aprovação.',
      'Publica PDF oficial e acompanha leituras obrigatórias.',
      'Mantém busca, histórico e vínculos com processos.',
    ],
    features: [
      'Editor visual',
      'Revisões e aprovações',
      'PDF oficial',
      'Busca documental',
      'Leitura obrigatória',
      'Histórico',
    ],
    useCases: [
      'Procedimentos operacionais.',
      'Políticas corporativas.',
      'Padrões relacionados a processos.',
    ],
    faq: [
      {
        question: 'Preciso de um editor externo?',
        answer:
          'O editor visual da plataforma permite elaborar o conteúdo e gerar PDF. A edição online de arquivos DOCX depende de um provedor configurado; esse serviço é opcional.',
      },
      {
        question: 'A assinatura é uma certificação digital?',
        answer:
          'O fluxo possui assinatura interna e rastreabilidade. Isso não representa certificação ICP-Brasil nem certificação da empresa. Confirme os requisitos aplicáveis aos seus documentos.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'gestao-de-processos',
    path: '/solucoes/gestao-de-processos',
    title: 'Mapeamento e gestão de processos',
    seoTitle: 'Gestão de processos, SIPOC, BPMN e RACI | Gestão 360',
    description:
      'Mapeie processos com SIPOC e BPMN, defina responsabilidades com RACI e conecte atividades a indicadores, documentos e projetos.',
    eyebrow: 'Do desenho à operação',
    summary:
      'Entenda como o trabalho acontece, quem participa e quais resultados cada processo precisa entregar.',
    problem:
      'Um fluxograma isolado não mostra se o processo tem responsáveis, indicadores, padrões e ações de melhoria acompanhados.',
    benefits: [
      'Torna entradas, saídas e clientes do processo explícitos.',
      'Organiza atividades e responsabilidades compartilhadas.',
      'Mantém versões e contexto dos artefatos publicados.',
      'Relaciona o processo aos registros de execução e melhoria.',
    ],
    features: [
      'SIPOC',
      'BPMN',
      'RACI',
      'Hierarquia e responsabilidades',
      'Versões',
      'Vínculos com indicadores e documentos',
    ],
    useCases: [
      'Padronizar o atendimento de solicitações.',
      'Revisar etapas de uma operação.',
      'Definir responsabilidades entre áreas.',
    ],
    faq: [
      {
        question: 'É só uma ferramenta de desenho?',
        answer:
          'O mapeamento faz parte da gestão: processos e atividades podem ser vinculados a indicadores, documentos, planos e projetos disponíveis na empresa.',
      },
      {
        question: 'SIPOC, BPMN e RACI podem ser usados juntos?',
        answer:
          'Sim. O SIPOC delimita o processo, o BPMN representa seu fluxo e a matriz RACI organiza as responsabilidades. Artefatos e versões mantêm o contexto do trabalho.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'gestao-de-projetos',
    path: '/solucoes/gestao-de-projetos',
    title: 'Gestão de projetos e portfólio',
    seoTitle: 'Gestão de projetos, Gantt e Curva S | Gestão 360',
    description:
      'Acompanhe projetos com cronograma, Gantt, Curva S, tarefas, marcos, custos e riscos em um portfólio integrado à gestão.',
    eyebrow: 'Do plano à entrega',
    summary:
      'Reúna prazo, avanço físico e contexto financeiro para acompanhar a execução dos projetos.',
    problem:
      'Cronogramas separados dos custos e das decisões dificultam identificar atrasos, impedimentos e prioridades do portfólio.',
    benefits: [
      'Organiza tarefas, marcos e responsáveis.',
      'Compara planejamento e medições reais de progresso.',
      'Dá visibilidade a orçamento, custos e pontos de atenção.',
      'Mantém projetos relacionados a processos e indicadores.',
    ],
    features: [
      'Portfólio',
      'Gantt e cronograma',
      'Curva S',
      'Marcos e equipe',
      'Custos e orçamento',
      'Riscos e atualizações',
    ],
    useCases: [
      'Acompanhar uma iniciativa estratégica.',
      'Conduzir um projeto de melhoria de processo.',
      'Discutir o portfólio com a liderança.',
    ],
    faq: [
      {
        question: 'A Curva S mostra planejado e realizado?',
        answer:
          'Sim. O planejamento e as medições de progresso alimentam a comparação. O realizado depende das medições registradas, sem inventar histórico ou resultados futuros.',
      },
      {
        question: 'Há acompanhamento financeiro?',
        answer:
          'Projetos podem registrar orçamento e custos planejados ou realizados, com consolidação no portfólio e controle de acesso.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'melhoria-continua',
    path: '/solucoes/melhoria-continua',
    title: 'Análise de causa e melhoria contínua',
    seoTitle: 'Ishikawa, 5 Porquês, 5W2H e PDCA | Gestão 360',
    description:
      'Conecte desvios, Ishikawa, 5 Porquês, 5W2H, PDCA, evidências e acompanhamento de eficácia.',
    eyebrow: 'Da causa à execução',
    summary:
      'Investigue o problema, organize o plano e acompanhe se a ação resolveu a causa tratada.',
    problem:
      'Agir apenas sobre o sintoma mantém a equipe ocupada com o mesmo problema. A análise precisa chegar à execução e à verificação.',
    benefits: [
      'Mantém o problema e as hipóteses no mesmo contexto.',
      'Estrutura a investigação com ferramentas visuais.',
      'Transforma a causa identificada em ações com dono e prazo.',
      'Relaciona evidências de execução à avaliação de eficácia.',
    ],
    features: ['Ishikawa', '5 Porquês', '5W2H', 'PDCA', 'Evidências', 'Verificação de eficácia'],
    useCases: [
      'Tratar um indicador fora da meta.',
      'Investigar retrabalho no atendimento.',
      'Acompanhar uma ação corretiva ou preventiva.',
    ],
    faq: [
      {
        question: 'As análises ficam relacionadas ao plano?',
        answer:
          'Sim. As ferramentas de análise são utilizadas no contexto dos planos e das reuniões, preservando o problema, a causa e as informações da tratativa.',
      },
      {
        question: 'Como a eficácia é acompanhada?',
        answer:
          'O plano possui informações de verificação de eficácia, com responsável e evidências conforme o fluxo e as permissões da empresa.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'gestao-da-qualidade',
    path: '/solucoes/gestao-da-qualidade',
    title: 'Processos, padrões e melhoria',
    seoTitle: 'Gestão da qualidade com processos, documentos e ações | Gestão 360',
    description:
      'Conecte processos, procedimentos, indicadores, análise de causa, planos e evidências no escopo ativo do Gestão 360.',
    eyebrow: 'Qualidade na rotina',
    summary:
      'Organize a forma de trabalhar e relacione os padrões à medição dos resultados e à execução das melhorias.',
    problem:
      'Procedimentos, fluxos e indicadores desconectados dificultam identificar quem deve agir e qual padrão precisa ser revisto.',
    benefits: [
      'Mapeia processos e responsabilidades.',
      'Controla documentos, revisões e leitura.',
      'Relaciona resultados a desvios e ações.',
      'Mantém histórico e evidências acessíveis por permissão.',
    ],
    features: [
      'SIPOC e BPMN',
      'RACI',
      'GED',
      'Indicadores e desvios',
      'Análise de causa',
      'Planos e evidências',
    ],
    useCases: [
      'Padronização de procedimentos.',
      'Melhoria de um processo operacional.',
      'Acompanhamento de resultados por área.',
    ],
    faq: [
      {
        question: 'O produto inclui auditorias e não conformidades como módulos ativos?',
        answer:
          'Esses módulos especializados não fazem parte do escopo disponível atualmente. A oferta ativa inclui processos, documentos, indicadores, desvios, análises e ações. Confirme o escopo na contratação.',
      },
      {
        question: 'O sistema certifica a empresa?',
        answer:
          'A plataforma organiza registros e evidências de gestão. Certificação e atendimento a requisitos específicos dependem dos processos e da avaliação aplicável à organização.',
      },
    ],
    kind: 'solution',
  },
];

export const activeSegmentPages: PublicPage[] = [
  {
    slug: 'industria',
    path: '/segmentos/industria',
    title: 'Indústria',
    seoTitle: 'Processos, indicadores e projetos para indústria | Gestão 360',
    description:
      'Conecte processos, indicadores, procedimentos, planos e projetos da operação industrial.',
    eyebrow: 'Gestão na indústria',
    summary:
      'Uma rotina de acompanhamento que relaciona os indicadores industriais aos processos e às ações da equipe.',
    problem:
      'Resultados e padrões espalhados entre áreas dificultam discutir prioridades com o mesmo contexto.',
    benefits: [
      'Relaciona indicadores e ações.',
      'Organiza procedimentos e versões.',
      'Mapeia responsabilidades entre áreas.',
      'Acompanha iniciativas de melhoria.',
    ],
    features: ['Indicadores', 'SIPOC e BPMN', 'Documentos', 'Projetos', 'Reuniões'],
    useCases: [
      'Acompanhamento de produtividade.',
      'Revisão de processos.',
      'Projetos de melhoria operacional.',
    ],
    faq: [
      {
        question: 'O sistema coleta dados das máquinas?',
        answer:
          'A oferta apresentada é uma plataforma de gestão. Coleta automática de máquinas e integrações industriais precisam ser avaliadas separadamente e não são presumidas nesta apresentação.',
      },
    ],
    kind: 'segment',
  },
  {
    slug: 'agronegocio',
    path: '/segmentos/agronegocio',
    title: 'Agronegócio',
    seoTitle: 'Gestão de resultados e processos no agronegócio | Gestão 360',
    description:
      'Organize indicadores, processos, documentos e planos em áreas e unidades do agronegócio.',
    eyebrow: 'Gestão no agronegócio',
    summary:
      'Consolide a discussão de metas e iniciativas sem perder a responsabilidade de cada área.',
    problem:
      'Operações distribuídas precisam de registros de gestão comparáveis e responsáveis definidos para cada ação.',
    benefits: [
      'Organiza empresas e áreas.',
      'Mantém responsáveis e histórico.',
      'Relaciona resultados e tratativas.',
      'Acompanha projetos e documentos.',
    ],
    features: [
      'Estrutura organizacional',
      'Indicadores',
      'Planos de ação',
      'Projetos',
      'Documentos',
    ],
    useCases: ['Reuniões por unidade.', 'Metas operacionais.', 'Projetos de padronização.'],
    faq: [
      {
        question: 'Inclui rastreabilidade de lotes ou gestão agronômica?',
        answer:
          'Esses recursos especializados não fazem parte da oferta ativa apresentada. O foco está nos processos, resultados, projetos e documentos de gestão.',
      },
    ],
    kind: 'segment',
  },
  {
    slug: 'alimentos-e-bebidas',
    path: '/segmentos/alimentos-e-bebidas',
    title: 'Alimentos e bebidas',
    seoTitle: 'Processos e melhoria em alimentos e bebidas | Gestão 360',
    description:
      'Organize procedimentos, indicadores, análise de causa e ações de melhoria em empresas de alimentos e bebidas.',
    eyebrow: 'Gestão em alimentos e bebidas',
    summary:
      'Conecte os padrões de trabalho aos resultados e às iniciativas de melhoria da operação.',
    problem:
      'Procedimentos e indicadores precisam chegar às pessoas responsáveis por executar e verificar as melhorias.',
    benefits: [
      'Controla procedimentos e revisões.',
      'Mapeia processos e responsabilidades.',
      'Acompanha indicadores e desvios.',
      'Registra planos e evidências.',
    ],
    features: ['GED', 'Processos', 'Indicadores', 'Análise de causa', 'Planos'],
    useCases: [
      'Revisão de procedimentos.',
      'Análise de retrabalho.',
      'Acompanhamento de planos de melhoria.',
    ],
    faq: [
      {
        question: 'A oferta inclui um módulo especializado de segurança dos alimentos?',
        answer:
          'O módulo especializado não está disponível no escopo atual. A oferta ativa apoia a gestão de processos, documentos e resultados; não presume controle de lotes, certificação ou conformidade regulatória.',
      },
    ],
    kind: 'segment',
  },
  {
    slug: 'servicos',
    path: '/segmentos/servicos',
    title: 'Serviços',
    seoTitle: 'Gestão de processos, SLA e projetos em serviços | Gestão 360',
    description:
      'Acompanhe indicadores de SLA, processos, tarefas, documentos e planos em empresas de serviços.',
    eyebrow: 'Gestão em serviços',
    summary: 'Dê contexto às prioridades e acompanhe a execução dos compromissos entre áreas.',
    problem:
      'Demandas, reuniões e metas separadas dificultam entender por que um prazo foi perdido e como corrigir o fluxo.',
    benefits: [
      'Torna prioridades visíveis.',
      'Relaciona SLA e planos de ação.',
      'Padroniza procedimentos.',
      'Organiza responsáveis e projetos.',
    ],
    features: ['Meu Dia', 'Tarefas', 'Indicadores', 'Processos', 'Projetos'],
    useCases: ['Cumprimento de SLA.', 'Melhoria do atendimento.', 'Projetos de implantação.'],
    faq: [
      {
        question: 'A Central de Atendimento é um CRM?',
        answer:
          'A central disponível é voltada ao suporte de uso da própria plataforma. A gestão da operação de serviços ocorre por processos, indicadores, tarefas e projetos, conforme o escopo liberado.',
      },
    ],
    kind: 'segment',
  },
  {
    slug: 'gestao-corporativa',
    path: '/segmentos/gestao-corporativa',
    title: 'Gestão corporativa',
    seoTitle: 'Estratégia e execução na gestão corporativa | Gestão 360',
    description:
      'Conecte BSC, OKRs, indicadores, planos, projetos e reuniões na gestão das áreas corporativas.',
    eyebrow: 'Gestão corporativa',
    summary:
      'Uma visão compartilhada da estratégia e dos compromissos de execução, respeitando o acesso de cada pessoa.',
    problem:
      'A liderança precisa acompanhar as decisões sem depender de apresentações que se afastam dos registros de execução.',
    benefits: [
      'Conecta objetivos e indicadores.',
      'Organiza compromissos por área.',
      'Mantém contexto das reuniões.',
      'Respeita perfis e permissões.',
    ],
    features: ['BSC e OKRs', 'Painel executivo', 'Reunião mensal', 'Projetos', 'Perfis de acesso'],
    useCases: ['Comitê executivo.', 'Revisão de metas.', 'Acompanhamento de portfólio.'],
    faq: [
      {
        question: 'É possível separar o acesso das áreas?',
        answer:
          'Sim. O acesso considera empresa, perfil, permissões e escopo de visibilidade. A configuração é definida conforme a estrutura e os módulos liberados.',
      },
    ],
    kind: 'segment',
  },
];
