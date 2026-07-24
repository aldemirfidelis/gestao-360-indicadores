import type { Metadata } from 'next';

export const SITE_NAME = 'Gestão 360';
export const PRODUCT_NAME = 'Gestão 360';
export const DEFAULT_SITE_URL = 'https://gestão360.org';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, '');
export const DEFAULT_OG_IMAGE = '/brand/social-preview-14-modulos.png';
export const DEMO_PATH = '/login?demo=1';
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '5564981009108';
export const WHATSAPP_MESSAGE =
  process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ??
  'Gostei do Gestão 360. Quero receber uma proposta ou conversar sobre uma solução para as necessidades da minha empresa.';
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

export type PublicPageKind = 'solution' | 'segment' | 'article' | 'guide' | 'institutional';

export interface FaqItem {
  question: string;
  answer: string;
}

export interface PublicPage {
  slug: string;
  path: string;
  title: string;
  seoTitle: string;
  description: string;
  eyebrow: string;
  summary: string;
  problem: string;
  benefits: string[];
  features: string[];
  useCases: string[];
  faq: FaqItem[];
  kind: PublicPageKind;
}

export interface ArticlePage {
  slug: string;
  path: string;
  title: string;
  seoTitle: string;
  description: string;
  category: string;
  author: string;
  publishedAt: string;
  updatedAt: string;
  readingTime: string;
  intro: string;
  sections: Array<{ title: string; body: string[] }>;
  faq: FaqItem[];
  related: string[];
}

export const solutionPages: PublicPage[] = [
  {
    slug: 'gestao-de-indicadores',
    path: '/solucoes/gestao-de-indicadores',
    title: 'Gestão de indicadores',
    seoTitle: 'Sistema de gestão de indicadores, metas e resultados | Gestão 360',
    description:
      'Controle indicadores, metas, resultados, faróis, responsáveis e planos de ação em uma plataforma integrada.',
    eyebrow: 'Indicadores e metas',
    summary:
      'Acompanhe KPIs por empresa, filial, área, processo e responsável, conectando resultado, análise e ação corretiva.',
    problem:
      'Muitas empresas ainda consolidam indicadores por planilhas, sem trilha de auditoria, dono claro ou relação direta com planos de ação.',
    benefits: [
      'Padroniza metas, periodicidade, tolerâncias e responsáveis.',
      'Mostra resultados fora da meta com contexto e histórico.',
      'Conecta desvios a análises de causa, reuniões e ações.',
      'Apoia rituais de acompanhamento gerencial com dados rastreáveis.',
    ],
    features: ['KPI e metas', 'Farol de desempenho', 'Histórico de resultados', 'Painéis', 'Planos vinculados'],
    useCases: [
      'Reuniões mensais de performance.',
      'Acompanhamento de metas por unidade.',
      'Tratativa de indicadores críticos fora da meta.',
    ],
    faq: [
      {
        question: 'O Gestão 360 substitui planilhas de indicadores?',
        answer:
          'Ele reduz a dependência de planilhas ao centralizar metas, resultados, responsáveis e histórico. Importações podem apoiar a transição quando necessário.',
      },
      {
        question: 'É possível acompanhar indicadores por área?',
        answer:
          'Sim. A estrutura multiempresa e por áreas permite filtrar indicadores por unidade, setor, processo e responsável autorizado.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'planejamento-estrategico',
    path: '/solucoes/planejamento-estrategico',
    title: 'Planejamento estratégico',
    seoTitle: 'Software para planejamento estratégico e OKRs | Gestão 360',
    description:
      'Conecte diretrizes, pilares, objetivos, OKRs, indicadores e iniciativas para acompanhar estratégia e execução.',
    eyebrow: 'Estratégia e execução',
    summary:
      'Organize objetivos estratégicos e acompanhe se a rotina operacional está realmente contribuindo para o plano da empresa.',
    problem:
      'Planos estratégicos perdem força quando ficam separados dos indicadores, responsáveis, reuniões e iniciativas de execução.',
    benefits: [
      'Relaciona objetivos, indicadores e iniciativas.',
      'Apoia OKRs, objetivos e mapas estratégicos.',
      'Mostra execução por área e nível organizacional.',
      'Facilita revisões de estratégia com evidências.',
    ],
    features: ['Mapa estratégico', 'OKRs', 'Objetivos', 'Iniciativas', 'Reuniões de acompanhamento'],
    useCases: ['Ciclo anual de planejamento.', 'Revisão trimestral de OKRs.', 'Governança de iniciativas estratégicas.'],
    faq: [
      {
        question: 'A plataforma trabalha com OKRs?',
        answer:
          'Sim. O Gestão 360 organiza perspectivas, objetivos, indicadores e iniciativas, permitindo adaptar o modelo ao processo de gestão da empresa.',
      },
      {
        question: 'É possível vincular objetivos a indicadores?',
        answer:
          'Sim. Os vínculos ajudam a entender quais indicadores sustentam cada objetivo e quais ações estão em andamento.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'planos-de-acao',
    path: '/solucoes/planos-de-acao',
    title: 'Planos de ação',
    seoTitle: 'Sistema de planos de ação, 5W2H e acompanhamento | Gestão 360',
    description:
      'Gerencie planos de ação com responsáveis, prazos, evidências, eficácia e rastreabilidade.',
    eyebrow: 'Execução rastreável',
    summary:
      'Transforme decisões e desvios em ações acompanháveis, com dono, prazo, evidências e histórico.',
    problem:
      'Ações combinadas em reuniões ou auditorias se perdem quando não há visibilidade, cobrança e evidência de conclusão.',
    benefits: [
      'Define responsáveis, prazos e prioridades.',
      'Registra evidências e comentários.',
      'Acompanha eficácia quando aplicável.',
      'Integra ações com indicadores, desvios, auditorias e reuniões.',
    ],
    features: ['5W2H', 'Tarefas', 'Evidências', 'Aprovações', 'Eficácia'],
    useCases: ['Plano corretivo de auditoria.', 'Tratativa de desvio de indicador.', 'Acompanhamento de melhoria contínua.'],
    faq: [
      {
        question: 'O plano de ação pode nascer de uma não conformidade?',
        answer:
          'Sim. Planos podem ser relacionados a desvios, auditorias, não conformidades, reuniões e outros registros autorizados.',
      },
      {
        question: 'Há controle de eficácia?',
        answer:
          'Sim. A plataforma possui acompanhamento de eficácia para verificar se a ação resolveu o problema tratado.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'gestao-da-qualidade',
    path: '/solucoes/gestao-da-qualidade',
    title: 'Gestão da qualidade',
    seoTitle: 'Sistema de gestão da qualidade, evidências e melhoria contínua | Gestão 360',
    description:
      'Integre processos, documentos, auditorias, não conformidades, análises de causa e planos de ação.',
    eyebrow: 'Qualidade e melhoria',
    summary:
      'Conecte registros de qualidade em uma trilha única, evitando informações soltas e controles paralelos.',
    problem:
      'Sistemas separados dificultam enxergar a relação entre processo, requisito, documento, desvio, causa e ação.',
    benefits: [
      'Centraliza registros críticos da qualidade.',
      'Mantém histórico e evidências acessíveis.',
      'Apoia análises de causa e ações corretivas.',
      'Facilita auditorias internas e acompanhamento de pendências.',
    ],
    features: ['Processos', 'Documentos', 'Auditorias', 'Não conformidades', 'Análise de causa'],
    useCases: ['SGQ corporativo.', 'Rotina de qualidade industrial.', 'Auditoria interna e planos corretivos.'],
    faq: [
      {
        question: 'O Gestão 360 é um SGQ completo?',
        answer:
          'Ele oferece módulos integrados para apoiar gestão da qualidade, documentos, auditorias, não conformidades e planos de ação. A aderência a normas específicas depende da configuração e do processo da empresa.',
      },
      {
        question: 'É possível anexar evidências?',
        answer:
          'Sim. Registros operacionais podem conter anexos, histórico e comentários conforme permissão.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'auditorias',
    path: '/solucoes/auditorias',
    title: 'Auditorias',
    seoTitle: 'Sistema de auditorias internas, achados e planos corretivos | Gestão 360',
    description:
      'Planeje auditorias, registre achados, relacione evidências e acompanhe planos corretivos.',
    eyebrow: 'Auditoria e conformidade',
    summary:
      'Organize auditorias e acompanhe achados até a tratativa, mantendo rastreabilidade de decisões e evidências.',
    problem:
      'Achados de auditoria perdem prioridade quando não são conectados a responsáveis, prazos e acompanhamento gerencial.',
    benefits: [
      'Planeja auditorias com escopo e responsáveis.',
      'Registra achados e evidências.',
      'Gera planos de ação vinculados.',
      'Apoia acompanhamento de pendências e reincidências.',
    ],
    features: ['Plano de auditoria', 'Achados', 'Evidências', 'Riscos', 'Planos corretivos'],
    useCases: ['Auditoria interna.', 'Lista de verificação de conformidade.', 'Acompanhamento de achados por área.'],
    faq: [
      {
        question: 'A auditoria fica conectada aos planos de ação?',
        answer:
          'Sim. Achados podem ser tratados por planos de ação e acompanhados até conclusão ou verificação de eficácia.',
      },
      {
        question: 'Há trilha de auditoria do sistema?',
        answer:
          'Sim. O sistema registra histórico de alterações e eventos conforme módulo e permissão.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'gestao-de-documentos',
    path: '/solucoes/gestao-de-documentos',
    title: 'Gestão de documentos',
    seoTitle: 'Gestão de documentos corporativos, revisões e aprovação | Gestão 360',
    description:
      'Controle documentos, revisões, aprovações, anexos e rastreabilidade em uma base corporativa.',
    eyebrow: 'Documentos e revisões',
    summary:
      'Controle documentos importantes com ciclo de revisão, responsáveis, status, anexos e visibilidade por área.',
    problem:
      'Documentos em pastas soltas dificultam saber qual versão está vigente, quem aprovou e onde o documento é utilizado.',
    benefits: [
      'Organiza documentos por processo, área e tipo.',
      'Mantém histórico de revisões.',
      'Apoia aprovação e publicação controlada.',
      'Relaciona documentos a processos, auditorias e formulários.',
    ],
    features: ['Controle documental', 'Revisões', 'Aprovações', 'Anexos', 'Editor pela web quando configurado'],
    useCases: ['Procedimentos internos.', 'Políticas corporativas.', 'Documentos de processo e qualidade.'],
    faq: [
      {
        question: 'O sistema controla versões?',
        answer:
          'Sim. O módulo de documentos foi estruturado para armazenar revisões e manter rastreabilidade.',
      },
      {
        question: 'Documentos podem ser vinculados a processos?',
        answer:
          'Sim. Vínculos ajudam a mostrar onde um documento é usado e quais registros dependem dele.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'formularios-e-checklists',
    path: '/solucoes/formularios-e-checklists',
    title: 'Formulários e listas de verificação',
    seoTitle: 'Formulários digitais e listas de verificação operacionais | Gestão 360',
    description:
      'Digitalize coletas, formulários e listas de verificação com evidências, aprovação e rastreabilidade.',
    eyebrow: 'Coleta operacional',
    summary:
      'Padronize coletas e verificações de rotina, reduzindo retrabalho e facilitando análise posterior.',
    problem:
      'Formulários em papel ou planilhas dificultam padronização, histórico, evidências e visibilidade gerencial.',
    benefits: [
      'Padroniza perguntas, respostas e evidências.',
      'Permite acompanhamento por status e responsável.',
      'Conecta reprovações a ações e não conformidades.',
      'Facilita consulta histórica por unidade e processo.',
    ],
    features: ['Modelos', 'Execuções', 'Evidências', 'Listas de verificação', 'Acompanhamento'],
    useCases: ['Inspeção operacional.', 'Lista de verificação de qualidade.', 'Coletas de rotina por turno.'],
    faq: [
      {
        question: 'A lista de verificação pode gerar ação?',
        answer:
          'Sim. Um resultado reprovado pode ser conectado a planos de ação ou tratativas, conforme configuração.',
      },
      {
        question: 'Os formulários são públicos?',
        answer:
          'Não. Formulários operacionais fazem parte do portal autenticado e respeitam permissão e tenant.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'gestao-de-riscos',
    path: '/solucoes/gestao-de-riscos',
    title: 'Gestão de riscos',
    seoTitle: 'Sistema de gestão de riscos, controles e evidências | Gestão 360',
    description:
      'Registre riscos, controles, planos de mitigação, evidências e conexões com processos e indicadores.',
    eyebrow: 'Riscos e controles',
    summary:
      'Acompanhe riscos relevantes, seus controles e impactos relacionados a processos, indicadores e auditorias.',
    problem:
      'Riscos mantidos em planilhas perdem atualização e ficam distantes das evidências e dos controles executados.',
    benefits: [
      'Relaciona riscos a processos e indicadores.',
      'Registra criticidade, controles e ações.',
      'Apoia visão 360 dos impactos.',
      'Ajuda gestores a priorizar riscos críticos.',
    ],
    features: ['Registro de risco', 'Controles', 'Impactos', 'Planos de mitigação', 'Evidências'],
    useCases: ['Matriz de riscos por processo.', 'Risco crítico em indicador.', 'Acompanhamento de controles internos.'],
    faq: [
      {
        question: 'O risco pode ser ligado a um indicador?',
        answer:
          'Sim. Vínculos ajudam a entender impacto operacional e priorizar ações relacionadas.',
      },
      {
        question: 'Há permissão por área?',
        answer:
          'Sim. A visibilidade segue as regras de empresa, área e permissão configuradas.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'seguranca-dos-alimentos',
    path: '/solucoes/seguranca-dos-alimentos',
    title: 'Segurança dos alimentos',
    seoTitle: 'Segurança dos alimentos, APPCC e fluxo 3D | Gestão 360',
    description:
      'Gerencie FSMS, APPCC, monitoramentos, cadeia, recall e processos em um fluxo 3D isométrico interativo.',
    eyebrow: 'Módulo especializado',
    summary:
      'Visualize a linha produtiva em 3D, identifique pontos de controle e conecte perigos, monitoramentos, lotes e evidências.',
    problem:
      'Controles de segurança dos alimentos exigem visão clara do processo, evidências consistentes e rastreabilidade entre perigos, fornecedores, lotes e ocorrências.',
    benefits: [
      'Mapeia processos e etapas em um fluxo 3D isométrico interativo.',
      'Identifica perigos, PCCs, PPROs e seus controles no contexto da operação.',
      'Relaciona fornecedores, materiais, lotes, rastreabilidade e recall.',
      'Conecta monitoramentos, não conformidades, evidências e planos de ação.',
    ],
    features: ['Fluxo 3D isométrico', 'FSMS e APPCC', 'PCC e PPRO', 'Monitoramentos', 'Cadeia e recall', 'Matriz de perigos'],
    useCases: ['Mapeamento visual da linha produtiva.', 'Gestão de perigos e pontos críticos.', 'Rastreabilidade e recall por lote.'],
    faq: [
      {
        question: 'Este módulo substitui uma certificação?',
        answer:
          'Não. Ele apoia controles, evidências e rastreabilidade. A conformidade final depende dos processos, auditorias e requisitos aplicáveis.',
      },
      {
        question: 'Há rastreabilidade de lotes?',
        answer:
          'Sim. O módulo conecta fornecedores, materiais, lotes, eventos de rastreabilidade e recall.',
      },
      {
        question: 'Como funciona o fluxo 3D?',
        answer:
          'As etapas do processo são representadas em um mapa isométrico interativo, com navegação, reposicionamento e sinalização visual dos pontos de controle.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'dashboards-executivos',
    path: '/solucoes/dashboards-executivos',
    title: 'Painéis executivos',
    seoTitle: 'Painéis executivos para indicadores, riscos e planos | Gestão 360',
    description:
      'Visualize desempenho, atrasos, prioridades, riscos e planos de ação em painéis corporativos.',
    eyebrow: 'Visão executiva',
    summary:
      'Acompanhe performance e pendências em visões gerenciais conectadas aos registros de origem.',
    problem:
      'Painéis isolados mostram números, mas não permitem entender causa, dono, prazo e ação relacionada.',
    benefits: [
      'Mostra indicadores e pendências relevantes.',
      'Permite navegar para registros de origem.',
      'Ajuda a priorizar decisões por impacto e prazo.',
      'Apoia reuniões executivas com dados consistentes.',
    ],
    features: ['Painel gerencial', 'Meu Dia', 'Visão de equipe', 'Alertas', 'Filtros'],
    useCases: ['Reunião de diretoria.', 'Gestão de pendências.', 'Acompanhamento de metas e planos.'],
    faq: [
      {
        question: 'Os painéis são apenas visuais?',
        answer:
          'Não. Eles se conectam aos registros de origem para permitir investigação, ação e rastreabilidade.',
      },
      {
        question: 'Há uma central diária de prioridades?',
        answer:
          'Sim. O Meu Dia centraliza itens de trabalho, prioridades, prazos e recomendações assistidas.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'gestao-de-nao-conformidades',
    path: '/solucoes/gestao-de-nao-conformidades',
    title: 'Gestão de não conformidades',
    seoTitle: 'Gestão de não conformidades, causa raiz e CAPA | Gestão 360',
    description:
      'Registre não conformidades, investigue causas, acompanhe CAPA, evidências e eficácia.',
    eyebrow: 'Não conformidades e CAPA',
    summary:
      'Conduza tratativas de não conformidade com causa raiz, responsáveis, prazos e verificação.',
    problem:
      'Sem processo integrado, não conformidades geram registros desconectados e baixa confiabilidade na verificação de eficácia.',
    benefits: [
      'Padroniza registro e classificação.',
      'Relaciona causa, ação corretiva e evidência.',
      'Acompanha prazos e responsáveis.',
      'Mantém histórico para auditorias e reincidências.',
    ],
    features: ['Registro de NC', 'Análise de causa', 'CAPA', 'Eficácia', 'Histórico'],
    useCases: ['NC interna.', 'Desvio de processo.', 'Tratativa de auditoria ou cliente.'],
    faq: [
      {
        question: 'A plataforma possui análise de causa?',
        answer:
          'Sim. O ecossistema inclui recursos para FCA, 5 Porques, Ishikawa, MASP e planos de ação relacionados.',
      },
      {
        question: 'Posso acompanhar reincidências?',
        answer:
          'Os registros históricos e vínculos ajudam a analisar recorrência por área, processo ou tipo.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'gestao-multiempresa',
    path: '/solucoes/gestao-multiempresa',
    title: 'Gestão multiempresa',
    seoTitle: 'Plataforma multiempresa para gestão corporativa | Gestão 360',
    description:
      'Gerencie empresas, filiais, usuários, módulos, permissões e dados isolados por tenant.',
    eyebrow: 'Multiempresa e governança',
    summary:
      'Controle grupos, unidades e empresas clientes com isolamento de dados, módulos e permissões.',
    problem:
      'Operações com várias unidades precisam padronizar gestão sem misturar dados, permissões ou responsabilidades.',
    benefits: [
      'Isola dados por empresa.',
      'Configura módulos e recursos por cliente ou unidade.',
      'Apoia permissões por perfil e área.',
      'Mantém a gestão corporativa e parametrizações organizacionais de forma segura.',
    ],
    features: ['Ambientes', 'Filiais', 'Gestão de acessos', 'Permissões', 'Painel de controle corporativo'],
    useCases: ['Grupo empresarial.', 'Consultoria com clientes distintos.', 'Unidades operacionais com governança central.'],
    faq: [
      {
        question: 'Um usuário comum acessa dados de outra empresa?',
        answer:
          'Não. A plataforma respeita ambiente, autenticação e autorização. Conteúdo privado não é publicado em páginas públicas.',
      },
      {
        question: 'É possível personalizar recursos por empresa?',
        answer:
          'Sim. A plataforma permite personalizar os módulos e permissões de acesso por empresa e unidade corporativa.',
      },
    ],
    kind: 'solution',
  },
];

export const segmentPages: PublicPage[] = [
  {
    slug: 'industria',
    path: '/segmentos/industria',
    title: 'Indústria',
    seoTitle: 'Gestão de indicadores e planos de ação para indústria | Gestão 360',
    description:
      'Use o Gestão 360 para conectar indicadores industriais, desvios, planos de ação, documentos, auditorias e riscos.',
    eyebrow: 'Segmento',
    summary:
      'Para indústrias que precisam acompanhar metas, qualidade, segurança, processos e planos de ação em uma rotina integrada.',
    problem:
      'áreas industriais lidam com muitos indicadores, desvios e evidências espalhados entre planilhas, reuniões e documentos.',
    benefits: ['Integra indicadores e planos.', 'Apoia auditorias e documentos.', 'Organiza riscos e desvios.', 'Melhora visibilidade por área.'],
    features: ['Indicadores industriais', 'Planos de ação', 'Não conformidades', 'Auditorias', 'Painéis'],
    useCases: ['OEE e produtividade.', 'Desvios de qualidade.', 'Reuniões de performance industrial.'],
    faq: [
      { question: 'Serve para chão de fábrica?', answer: 'Serve como apoio de gestão e acompanhamento. A coleta operacional depende da configuração dos formulários e processos.' },
      { question: 'Funciona por filial?', answer: 'Sim. A plataforma foi estruturada para empresa, filial, área, setor e processo.' },
    ],
    kind: 'segment',
  },
  {
    slug: 'agronegocio',
    path: '/segmentos/agronegocio',
    title: 'Agronegócio',
    seoTitle: 'Gestão corporativa para agronegócio e agroindústria | Gestão 360',
    description:
      'Organize indicadores, processos, qualidade, riscos, planos e evidências em operações do agronegócio.',
    eyebrow: 'Segmento',
    summary:
      'Uma base integrada para acompanhar operações com múltiplas unidades, indicadores produtivos e rotinas de melhoria.',
    problem:
      'Operações agroindustriais precisam consolidar dados de áreas diferentes sem perder rastreabilidade e dono da ação.',
    benefits: ['Acompanha unidades e áreas.', 'Centraliza evidências.', 'Conecta indicadores e tratativas.', 'Apoia governança operacional.'],
    features: ['Multiunidade', 'Indicadores', 'Planos', 'Documentos', 'Segurança dos alimentos'],
    useCases: ['Indicadores agrícolas e industriais.', 'Controle de documentos.', 'Tratativas de desvios por unidade.'],
    faq: [
      { question: 'Permite gestão multiunidade?', answer: 'Sim. A estrutura multiempresa e por filiais atende cenários com várias unidades.' },
      { question: 'Tem módulo para alimentos?', answer: 'Sim. Há recursos especializados para segurança dos alimentos e rastreabilidade.' },
    ],
    kind: 'segment',
  },
  {
    slug: 'alimentos-e-bebidas',
    path: '/segmentos/alimentos-e-bebidas',
    title: 'Alimentos e bebidas',
    seoTitle: 'Gestão para alimentos e bebidas, qualidade e rastreabilidade | Gestão 360',
    description:
      'Controle qualidade, documentos, formulários, rastreabilidade, lotes, auditorias e planos de ação no setor de alimentos e bebidas.',
    eyebrow: 'Segmento',
    summary:
      'Para empresas que precisam unir segurança dos alimentos, qualidade, evidências e melhoria contínua.',
    problem:
      'O setor exige evidências confiaveis, rastreabilidade e resposta rápida a desvios sem depender de controles isolados.',
    benefits: ['Apoia rastreabilidade.', 'Organiza evidências.', 'Integra NC e CAPA.', 'Controla documentos e auditorias.'],
    features: ['Rastreabilidade', 'Documentos', 'Listas de verificação', 'Auditorias', 'Planos corretivos'],
    useCases: ['Controle de lotes.', 'Tratativa de desvios.', 'Listas de verificação de qualidade e segurança dos alimentos.'],
    faq: [
      { question: 'A plataforma substitui auditorias externas?', answer: 'Não. Ela apoia organização, evidências e acompanhamento para os processos da empresa.' },
      { question: 'Pode registrar lotes?', answer: 'Sim. O módulo de segurança dos alimentos possui estrutura de lotes e eventos.' },
    ],
    kind: 'segment',
  },
  {
    slug: 'servicos',
    path: '/segmentos/servicos',
    title: 'Serviços',
    seoTitle: 'Gestão de indicadores e planos para empresas de serviços | Gestão 360',
    description:
      'Acompanhe desempenho, processos, tarefas, documentos, riscos e planos de ação em empresas de serviços.',
    eyebrow: 'Segmento',
    summary:
      'Para operações de serviços que precisam padronizar processos, acompanhar metas e dar visibilidade a pendências.',
    problem:
      'Empresas de serviços frequentemente perdem controle quando demandas, reuniões, documentos e indicadores ficam separados.',
    benefits: ['Centraliza prioridades.', 'Acompanha indicadores de atendimento.', 'Organiza documentos e responsabilidades.', 'Facilita governança por área.'],
    features: ['Meu Dia', 'Indicadores', 'Planos', 'Documentos', 'Processos'],
    useCases: ['SLA interno.', 'Planos de melhoria.', 'Reuniões de acompanhamento por área.'],
    faq: [
      { question: 'Serve para equipes administrativas?', answer: 'Sim. A plataforma organiza indicadores, planos e pendências de áreas corporativas.' },
      { question: 'Há painel diário?', answer: 'Sim. O Meu Dia centraliza prioridades e itens de trabalho do usuário.' },
    ],
    kind: 'segment',
  },
  {
    slug: 'gestao-corporativa',
    path: '/segmentos/gestao-corporativa',
    title: 'Gestão corporativa',
    seoTitle: 'Plataforma de gestão corporativa integrada | Gestão 360',
    description:
      'Conecte estratégia, execução, indicadores, governança, documentos, riscos e melhoria contínua.',
    eyebrow: 'Segmento',
    summary:
      'Para grupos e áreas corporativas que precisam de uma visão integrada entre estratégia, execução e controle.',
    problem:
      'Gestores precisam decidir com contexto, mas os dados costumam estar fragmentados entre sistemas, planilhas e reuniões.',
    benefits: ['Unifica contexto de gestão.', 'Conecta estratégia e execução.', 'Apoia governança e auditoria.', 'Respeita permissões e escopo.'],
    features: ['Estratégia', 'Painéis', 'Riscos', 'Auditoria', 'Painel de controle corporativo'],
    useCases: ['Comitê executivo.', 'Gestão por metas.', 'Governança multiempresa.'],
    faq: [
      { question: 'O sistema atende vários departamentos?', answer: 'Sim. Ele foi desenhado para áreas, setores, processos e responsáveis.' },
      { question: 'Há controle de permissão?', answer: 'Sim. A plataforma possui permissão por perfil, módulo e escopo.' },
    ],
    kind: 'segment',
  },
];

export interface ModuleHighlight {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  capabilities: string[];
}

export const moduleHighlights: ModuleHighlight[] = [
  {
    slug: 'meu-dia',
    title: 'Meu Dia',
    eyebrow: 'Prioridades pessoais',
    description:
      'Reúne em uma única central tudo o que exige atenção: aprovações, ações atrasadas, riscos, documentos, reuniões e indicadores fora da meta.',
    capabilities: ['Prioridades e prazos', 'Delegações e acompanhamento', 'Recomendações assistidas'],
  },
  {
    slug: 'tarefas',
    title: 'Tarefas',
    eyebrow: 'Execução diária',
    description:
      'Organiza a caixa de trabalho do usuário, incluindo pendências operacionais e documentos liberados para edição, com status e ações disponíveis.',
    capabilities: ['Fila de trabalho', 'Tarefas de documentos', 'Ações no contexto'],
  },
  {
    slug: 'central-de-atendimento',
    title: 'Central de Atendimento',
    eyebrow: 'Suporte rastreável',
    description:
      'Permite abrir e acompanhar chamados de suporte, dúvidas e sugestões, mantendo prioridade, histórico e visibilidade para usuário, empresa e equipe de atendimento.',
    capabilities: ['Abertura de chamados', 'Histórico da solicitação', 'Painel de suporte'],
  },
  {
    slug: 'gestao-a-vista',
    title: 'Gestão à Vista',
    eyebrow: 'Estratégia e desempenho',
    description:
      'Conecta painel executivo, estrutura organizacional, estratégia, indicadores, desvios, planos de ação, reuniões mensais e OKRs.',
    capabilities: ['Painel executivo', 'Indicadores e desvios', 'Estratégia, ações e ritos'],
  },
  {
    slug: 'administracao',
    title: 'Administração',
    eyebrow: 'Governança da operação',
    description:
      'Centraliza aprovações, períodos de trabalho, automações, usuários, permissões, relatórios e exportações com controle por empresa.',
    capabilities: ['Usuários e permissões', 'Automações e aprovações', 'Relatórios e períodos'],
  },
  {
    slug: 'qualidade-e-compliance',
    title: 'Qualidade e Compliance',
    eyebrow: 'Controle e melhoria',
    description:
      'Integra riscos, não conformidades, auditorias, documentos, SIPOC, processos, formulários, cronogramas e análises de impacto em uma trilha auditável.',
    capabilities: ['Riscos, NCs e auditorias', 'Documentos e processos', 'Formulários e impactos 360°'],
  },
  {
    slug: 'seguranca-dos-alimentos',
    title: 'Segurança dos Alimentos',
    eyebrow: 'FSMS e APPCC',
    description:
      'Gerencia programas, processos, perigos, PCCs, PPROs, monitoramentos, compliance, cadeia, recall e inteligência com fluxo 3D isométrico.',
    capabilities: ['Fluxo 3D interativo', 'Perigos e controles', 'Cadeia, lotes e recall'],
  },
  {
    slug: 'seguranca-patrimonial',
    title: 'Segurança Patrimonial',
    eyebrow: 'Acessos e proteção',
    description:
      'Controla portarias, entradas e saídas, pessoas, veículos, autorizações, QR Codes, rondas, ocorrências, materiais, chaves e operação sem conexão.',
    capabilities: ['Operação de portaria', 'Rondas e ocorrências', 'Autorizações e ativos'],
  },
  {
    slug: 'cargos-e-salarios',
    title: 'Cargos e Salários',
    eyebrow: 'Estrutura e remuneração',
    description:
      'Administra estrutura e quadro, catálogo, CBO e descrições de cargos, tabelas e faixas salariais, enquadramento, equidade, mérito, orçamento, pesquisas, simulações e aprovações.',
    capabilities: ['Estrutura, posições e quadro', 'Faixas, equidade e compa-ratio', 'Orçamento, mérito e movimentações'],
  },
  {
    slug: 'recrutamento',
    title: 'Recrutamento e Seleção',
    eyebrow: 'Contratação de ponta a ponta',
    description:
      'Conecta requisição e aprovação da vaga ao portal de carreiras, candidatos, triagem, entrevistas, proposta, documentos, ASO, pré-admissão e admissão no Serviço Pessoal.',
    capabilities: ['Vagas, carreira e mobilidade interna', 'ATS, talentos, IA e analytics', 'Proposta, pré-admissão e admissão'],
  },
  {
    slug: 'servico-pessoal',
    title: 'Serviço Pessoal',
    eyebrow: 'Jornada e vida funcional',
    description:
      'Centraliza colaboradores, prontuário, admissão, desligamento, férias, afastamentos, saúde ocupacional, controle de ponto, folha, obrigações e autoatendimento.',
    capabilities: ['Ponto web, mobile, totem e facial', 'Escalas, banco de horas e fechamento', 'Folha, holerites, eSocial e exportações'],
  },
  {
    slug: 'suprimentos',
    title: 'Suprimentos',
    eyebrow: 'Compras e estoque',
    description:
      'Integra requisições, fila do comprador, alçadas, pedidos, recebimentos, fornecedores, estoque, custo médio, kardex, transferências e almoxarifados.',
    capabilities: ['Requisição, aprovação e pedido', 'Recebimento e fornecedores', 'Estoque, kardex e almoxarifado'],
  },
  {
    slug: 'comunicacao',
    title: 'Comunicação',
    eyebrow: 'Engajamento interno',
    description:
      'Entrega comunicados, campanhas e pesquisas por mural e múltiplos canais, com confirmações, mídias, métricas, comentários, reações e chat corporativo.',
    capabilities: ['Mural e campanhas', 'Métricas e confirmações', 'Chat e múltiplos canais'],
  },
  {
    slug: 'gestao-de-premio',
    title: 'Gestão de Prêmio',
    eyebrow: 'Remuneração variável',
    description:
      'Conduz programas, competências, regras, indicadores, elegibilidade, apuração, ajustes, espelhos, auditoria e integração do prêmio com a folha.',
    capabilities: ['Regras e competências', 'Apuração e memória de cálculo', 'Espelhos e folha'],
  },
];

export const faqPage: FaqItem[] = [
  {
    question: 'O Gestão 360 é uma plataforma de gestão empresarial?',
    answer:
      'Sim. O produto foi estruturado como uma plataforma corporativa modular, com portal autenticado, isolamento de dados por empresa e recursos ativáveis conforme a necessidade de cada organização.',
  },
  {
    question: 'Quais páginas são públicas?',
    answer:
      'As páginas institucionais, soluções, segmentos, conteúdos, contato, termos e política são públicas. Painéis, dados de clientes, APIs e administração exigem autenticação.',
  },
  {
    question: 'A plataforma usa inteligência artificial?',
    answer:
      'Há recursos assistidos por IA em pontos específicos, como resumo e recomendações do Meu Dia. A IA não aprova, rejeita ou conclui tarefas automaticamente.',
  },
  {
    question: 'Como acessar a demonstração?',
    answer:
      'Use o botão "Acesse a Demonstração" para entrar no ambiente de exemplo. Se fizer sentido, o WhatsApp fica disponível para proposta ou solução sob medida.',
  },
];

export const articlePages: ArticlePage[] = [
  {
    slug: 'como-estruturar-indicadores-de-desempenho',
    path: '/conteudos/artigos/como-estruturar-indicadores-de-desempenho',
    title: 'Como estruturar indicadores de desempenho em uma empresa',
    seoTitle: 'Como estruturar indicadores de desempenho na empresa | Gestão 360',
    description:
      'Um guia prático para definir KPIs, metas, responsáveis, periodicidade e planos de ação sem depender de planilhas soltas.',
    category: 'Gestão de indicadores',
    author: 'Equipe Gestão 360',
    publishedAt: '2026-06-09',
    updatedAt: '2026-06-09',
    readingTime: '8 min',
    intro:
      'Indicadores bons reduzem discussão subjetiva e aumentam clareza sobre prioridade. O desafio e desenhar uma estrutura que possa ser acompanhada e auditada ao longo do tempo.',
    sections: [
      {
        title: 'Comece pelo objetivo de gestão',
        body: [
          'Um indicador deve responder a uma pergunta de gestão. Antes de escolher gráficos, defina qual decisão ele precisa apoiar, quem decide e com qual frequência.',
          'Esse ponto evita excesso de KPIs e ajuda a separar indicadores estratégicos, taticos e operacionais.',
        ],
      },
      {
        title: 'Defina dono, meta e tolerância',
        body: [
          'Cada indicador precisa ter responsável, meta, unidade de medida, período, fonte e critério de leitura. Sem isso, a empresa mede, mas não gerencia.',
          'Também é importante registrar tolerâncias e regras de farol para diferenciar variação normal de desvio que exige ação.',
        ],
      },
      {
        title: 'Conecte resultado a tratativa',
        body: [
          'Quando um resultado fica fora da meta, a plataforma deve permitir abrir uma análise, registrar causa, criar plano de ação e acompanhar eficácia.',
          'Esse elo transforma painel em rotina de gestão e reduz a distância entre acompanhamento e execução.',
        ],
      },
    ],
    faq: [
      { question: 'Quantos indicadores uma área deve ter?', answer: 'Não existe número universal. O melhor conjunto é aquele que apoia decisões relevantes sem gerar ruído operacional.' },
      { question: 'Todo indicador precisa de plano de ação?', answer: 'Não. Planos devem surgir quando há desvio relevante, risco, recorrência ou decisão de melhoria.' },
    ],
    related: ['/solucoes/gestao-de-indicadores', '/solucoes/planos-de-acao', '/solucoes/dashboards-executivos'],
  },
  {
    slug: 'como-criar-plano-de-acao-rastreavel',
    path: '/conteudos/artigos/como-criar-plano-de-acao-rastreavel',
    title: 'Como criar um plano de ação realmente rastreável',
    seoTitle: 'Como criar um plano de ação rastreável com 5W2H | Gestão 360',
    description:
      'Veja como estruturar planos de ação com responsável, prazo, evidência, status e verificação de eficácia.',
    category: 'Planos de ação',
    author: 'Equipe Gestão 360',
    publishedAt: '2026-06-09',
    updatedAt: '2026-06-09',
    readingTime: '7 min',
    intro:
      'Um plano de ação só cria valor quando fica claro o que será feito, por quem, até quando, por qual motivo e com qual evidência.',
    sections: [
      {
        title: 'Use 5W2H como estrutura, não como burocracia',
        body: [
          'O 5W2H ajuda a organizar contexto, responsável, prazo, local, forma de execução e custo quando aplicável.',
          'A estrutura deve facilitar cobrança e entendimento, não virar um formulário extenso sem uso na rotina.',
        ],
      },
      {
        title: 'Mantenha evidência e histórico',
        body: [
          'A evidência mostra que a ação foi executada e ajuda em auditorias, reuniões e verificações futuras.',
          'Histórico de comentários e mudanças evita perda de contexto quando responsáveis mudam.',
        ],
      },
      {
        title: 'Verifique eficácia quando o problema exigir',
        body: [
          'Em desvios relevantes, concluir a ação não significa resolver o problema. A verificação de eficácia confirma se o resultado esperado foi atingido.',
        ],
      },
    ],
    faq: [
      { question: 'Todo plano precisa de evidência?', answer: 'Para ações críticas, auditorias e desvios, evidência é altamente recomendada para rastreabilidade.' },
      { question: 'O que fazer com ações atrasadas?', answer: 'Reavalie causa do atraso, impacto, novo prazo e responsável, registrando justificativa.' },
    ],
    related: ['/solucoes/planos-de-acao', '/solucoes/gestao-de-nao-conformidades', '/solucoes/auditorias'],
  },
  {
    slug: 'integrar-auditorias-nao-conformidades-planos',
    path: '/conteudos/artigos/integrar-auditorias-nao-conformidades-planos',
    title: 'Como integrar auditorias, não conformidades e planos de ação',
    seoTitle: 'Como integrar auditorias, não conformidades e planos de ação | Gestão 360',
    description:
      'Entenda por que auditorias, NCs, causa raiz e CAPA devem estar conectadas em uma mesma trilha de gestão.',
    category: 'Qualidade',
    author: 'Equipe Gestão 360',
    publishedAt: '2026-06-09',
    updatedAt: '2026-06-09',
    readingTime: '9 min',
    intro:
      'Auditorias e não conformidades perdem força quando geram listas desconectadas de ações. A integração cria visibilidade e responsabilidade.',
    sections: [
      {
        title: 'Trate achados como parte de um fluxo',
        body: [
          'Um achado deve ter origem, contexto, criticidade, responsável e caminho de tratativa claro.',
          'Quando esse fluxo fica visível, gestores acompanham pendências sem depender de cobranças manuais.',
        ],
      },
      {
        title: 'Relacione causa, ação e evidência',
        body: [
          'A causa raiz orienta a ação corretiva. A evidência comprova execução. A eficácia confirma se a solução funcionou.',
          'Essas partes precisam estar conectadas para evitar tratativas superficiais.',
        ],
      },
      {
        title: 'Use histórico para reduzir reincidência',
        body: [
          'Com dados estruturados, a empresa consegue identificar reincidências por processo, área, tipo de falha ou fornecedor.',
        ],
      },
    ],
    faq: [
      { question: 'CAPA e plano de ação são a mesma coisa?', answer: 'CAPA é um processo de ação corretiva/preventiva. O plano de ação é o instrumento para executar e acompanhar etapas.' },
      { question: 'A integração ajuda auditorias futuras?', answer: 'Sim. Histórico e evidências reduzem retrabalho e melhoram demonstração de controle.' },
    ],
    related: ['/solucoes/auditorias', '/solucoes/gestao-de-nao-conformidades', '/solucoes/gestao-da-qualidade'],
  },
];

export const guidePages = [
  {
    path: '/conteudos/guias',
    title: 'Guias de gestão corporativa',
    description:
      'Guias introdutórios sobre indicadores, estratégia, planos de ação, qualidade, auditorias, documentos e melhoria contínua.',
  },
];

export function absoluteUrl(path = '/') {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

export function publicMetadata(input: {
  title: string;
  description: string;
  path: string;
  image?: string;
  noindex?: boolean;
}): Metadata {
  const image = input.image ?? DEFAULT_OG_IMAGE;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: absoluteUrl(input.path) },
    robots: input.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: SITE_NAME,
      title: input.title,
      description: input.description,
      url: absoluteUrl(input.path),
      images: [{ url: absoluteUrl(image), width: 1200, height: 630, alt: `${PRODUCT_NAME} - plataforma de gestão corporativa` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: [absoluteUrl(image)],
    },
  };
}

export const publicRoutes = [
  '/',
  '/solucoes',
  ...solutionPages.map((page) => page.path),
  '/modulos',
  '/segmentos',
  ...segmentPages.map((page) => page.path),
  '/recursos',
  '/conteudos',
  '/conteudos/guias',
  '/conteudos/artigos',
  ...articlePages.map((page) => page.path),
  '/conteudos/perguntas-frequentes',
  '/sobre',
  '/contato',
  '/teste-gratis',
  '/seguranca',
  '/implantacao',
  '/suporte',
  '/lgpd',
  '/politica-de-privacidade',
  '/termos-de-uso',
];

/**
 * Superfícies operacionais sem sessão individual. São públicas para o guard de
 * navegação, mas deliberadamente ficam fora de sitemap/llms e recebem noindex.
 */
export const operationalPublicRoutes = ['/ponto-totem'];

/**
 * Portal público de carreiras e área do candidato. O candidato externo não tem
 * sessão interna, então o guard de navegação (AuthProvider) precisa tratá-las como
 * públicas — senão qualquer visitante não logado é redirecionado para /login e o
 * portal fica inacessível para o público que ele atende. Ficam noindex e fora do
 * sitemap (as vagas são multi-tenant via ?empresa=, divulgadas por link direto).
 */
export const careersPublicRoutes = ['/carreiras', '/candidato'];

export const authPublicRoutes = [...publicRoutes, ...operationalPublicRoutes, ...careersPublicRoutes];

export const privateRoutePrefixes = [
  '/login',
  '/platform-admin',
  '/totem',
  ...operationalPublicRoutes,
  ...careersPublicRoutes,
  '/dashboard',
  '/meu-dia',
  '/tarefas',
  '/central-atendimento',
  '/actions',
  '/indicators',
  '/strategy',
  '/okrs',
  '/meetings',
  '/monthly-results',
  '/documents',
  '/forms',
  '/audits',
  '/risks',
  '/nonconformities',
  '/deviations',
  '/treatments',
  '/projects',
  '/reports',
  '/settings',
  '/users',
  '/pessoas',
  '/organograma',
  '/org',
  '/periods',
  '/aprovacoes-cargo',
  '/central-automacoes',
  '/central-impactos',
  '/comunicacao',
  '/gestao-premio',
  '/cargos-salarios',
  '/recrutamento',
  '/imports',
  '/integracoes',
  '/insights',
  '/perfil',
  '/plataforma',
  '/processes',
  '/seguranca-alimentos',
  '/seguranca-patrimonial',
  '/visualization',
  '/api',
];

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl('/brand/gestao-360-logo.svg'),
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        telephone: `+${WHATSAPP_NUMBER}`,
        availableLanguage: 'Portuguese',
      },
    ],
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: 'pt-BR',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/conteudos?busca={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function softwareJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: PRODUCT_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    description:
      'Plataforma corporativa modular para estratégia, execução, qualidade, segurança, suprimentos, pessoas, recrutamento, serviço pessoal, comunicação, atendimento e remuneração.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      description: 'Demonstração disponível para avaliação inicial.',
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function webPageJsonLd(page: { title: string; description: string; path: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    description: page.description,
    url: absoluteUrl(page.path),
    inLanguage: 'pt-BR',
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  };
}

export function faqJsonLd(faq: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function articleJsonLd(article: ArticlePage) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    author: { '@type': 'Organization', name: article.author },
    publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: absoluteUrl('/brand/gestao-360-logo.svg') } },
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: absoluteUrl(article.path),
    image: absoluteUrl(DEFAULT_OG_IMAGE),
    inLanguage: 'pt-BR',
  };
}

export function getSolution(slug: string) {
  return solutionPages.find((page) => page.slug === slug);
}

export function getSegment(slug: string) {
  return segmentPages.find((page) => page.slug === slug);
}

export function getArticle(slug: string) {
  return articlePages.find((page) => page.slug === slug);
}
