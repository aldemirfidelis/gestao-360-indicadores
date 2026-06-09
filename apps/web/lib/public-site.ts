import type { Metadata } from 'next';

export const SITE_NAME = 'Gestao 360';
export const PRODUCT_NAME = 'Gestao 360';
export const DEFAULT_SITE_URL = 'https://gestao360.org';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, '');
export const DEFAULT_OG_IMAGE = '/brand/social-preview.svg';
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '5564981009108';
export const WHATSAPP_MESSAGE =
  process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ??
  'Ola, tenho interesse em conhecer melhor o Gestao 360.';
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
    title: 'Gestao de indicadores',
    seoTitle: 'Sistema de gestao de indicadores, metas e resultados | Gestao 360',
    description:
      'Controle indicadores, metas, resultados, farois, responsaveis e planos de acao em uma plataforma integrada.',
    eyebrow: 'Indicadores e metas',
    summary:
      'Acompanhe KPIs por empresa, filial, area, processo e responsavel, conectando resultado, analise e acao corretiva.',
    problem:
      'Muitas empresas ainda consolidam indicadores por planilhas, sem trilha de auditoria, dono claro ou relacao direta com planos de acao.',
    benefits: [
      'Padroniza metas, periodicidade, tolerancias e responsaveis.',
      'Mostra resultados fora da meta com contexto e historico.',
      'Conecta desvios a analises de causa, reunioes e acoes.',
      'Apoia rituais de acompanhamento gerencial com dados rastreaveis.',
    ],
    features: ['KPI e metas', 'Farol de desempenho', 'Historico de resultados', 'Dashboards', 'Planos vinculados'],
    useCases: [
      'Reunioes mensais de performance.',
      'Acompanhamento de metas por unidade.',
      'Tratativa de indicadores criticos fora da meta.',
    ],
    faq: [
      {
        question: 'O Gestao 360 substitui planilhas de indicadores?',
        answer:
          'Ele reduz a dependencia de planilhas ao centralizar metas, resultados, responsaveis e historico. Importacoes podem apoiar a transicao quando necessario.',
      },
      {
        question: 'E possivel acompanhar indicadores por area?',
        answer:
          'Sim. A estrutura multiempresa e por areas permite filtrar indicadores por unidade, setor, processo e responsavel autorizado.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'planejamento-estrategico',
    path: '/solucoes/planejamento-estrategico',
    title: 'Planejamento estrategico',
    seoTitle: 'Software para planejamento estrategico, BSC e OKRs | Gestao 360',
    description:
      'Conecte diretrizes, pilares, objetivos, OKRs, indicadores e iniciativas para acompanhar estrategia e execucao.',
    eyebrow: 'Estrategia e execucao',
    summary:
      'Organize objetivos estrategicos e acompanhe se a rotina operacional esta realmente contribuindo para o plano da empresa.',
    problem:
      'Planos estrategicos perdem forca quando ficam separados dos indicadores, responsaveis, reunioes e iniciativas de execucao.',
    benefits: [
      'Relaciona objetivos, indicadores e iniciativas.',
      'Apoia BSC, OKRs e mapas estrategicos.',
      'Mostra execucao por area e nivel organizacional.',
      'Facilita revisoes de estrategia com evidencias.',
    ],
    features: ['Mapa estrategico', 'OKRs', 'Objetivos', 'Iniciativas', 'Reunioes de acompanhamento'],
    useCases: ['Ciclo anual de planejamento.', 'Revisao trimestral de OKRs.', 'Governanca de iniciativas estrategicas.'],
    faq: [
      {
        question: 'A plataforma trabalha com BSC e OKR?',
        answer:
          'Sim. O Gestao 360 organiza perspectivas, objetivos, indicadores e iniciativas, permitindo adaptar o modelo ao processo de gestao da empresa.',
      },
      {
        question: 'E possivel vincular objetivos a indicadores?',
        answer:
          'Sim. Os vinculos ajudam a entender quais indicadores sustentam cada objetivo e quais acoes estao em andamento.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'planos-de-acao',
    path: '/solucoes/planos-de-acao',
    title: 'Planos de acao',
    seoTitle: 'Sistema de planos de acao, 5W2H e acompanhamento | Gestao 360',
    description:
      'Gerencie planos de acao com responsaveis, prazos, evidencias, eficacia e rastreabilidade.',
    eyebrow: 'Execucao rastreavel',
    summary:
      'Transforme decisoes e desvios em acoes acompanhaveis, com dono, prazo, evidencias e historico.',
    problem:
      'Acoes combinadas em reunioes ou auditorias se perdem quando nao ha visibilidade, cobranca e evidencia de conclusao.',
    benefits: [
      'Define responsaveis, prazos e prioridades.',
      'Registra evidencias e comentarios.',
      'Acompanha eficacia quando aplicavel.',
      'Integra acoes com indicadores, desvios, auditorias e reunioes.',
    ],
    features: ['5W2H', 'Tarefas', 'Evidencias', 'Aprovacoes', 'Eficacia'],
    useCases: ['Plano corretivo de auditoria.', 'Tratativa de desvio de indicador.', 'Acompanhamento de melhoria continua.'],
    faq: [
      {
        question: 'O plano de acao pode nascer de uma nao conformidade?',
        answer:
          'Sim. Planos podem ser relacionados a desvios, auditorias, nao conformidades, reunioes e outros registros autorizados.',
      },
      {
        question: 'Ha controle de eficacia?',
        answer:
          'Sim. A plataforma possui acompanhamento de eficacia para verificar se a acao resolveu o problema tratado.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'gestao-da-qualidade',
    path: '/solucoes/gestao-da-qualidade',
    title: 'Gestao da qualidade',
    seoTitle: 'Sistema de gestao da qualidade, evidencias e melhoria continua | Gestao 360',
    description:
      'Integre processos, documentos, auditorias, nao conformidades, analises de causa e planos de acao.',
    eyebrow: 'Qualidade e melhoria',
    summary:
      'Conecte registros de qualidade em uma trilha unica, evitando informacoes soltas e controles paralelos.',
    problem:
      'Sistemas separados dificultam enxergar a relacao entre processo, requisito, documento, desvio, causa e acao.',
    benefits: [
      'Centraliza registros criticos da qualidade.',
      'Mantem historico e evidencias acessiveis.',
      'Apoia analises de causa e acoes corretivas.',
      'Facilita auditorias internas e acompanhamento de pendencias.',
    ],
    features: ['Processos', 'Documentos', 'Auditorias', 'Nao conformidades', 'Analise de causa'],
    useCases: ['SGQ corporativo.', 'Rotina de qualidade industrial.', 'Auditoria interna e planos corretivos.'],
    faq: [
      {
        question: 'O Gestao 360 e um SGQ completo?',
        answer:
          'Ele oferece modulos integrados para apoiar gestao da qualidade, documentos, auditorias, nao conformidades e planos de acao. A aderencia a normas especificas depende da configuracao e do processo da empresa.',
      },
      {
        question: 'E possivel anexar evidencias?',
        answer:
          'Sim. Registros operacionais podem conter anexos, historico e comentarios conforme permissao.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'auditorias',
    path: '/solucoes/auditorias',
    title: 'Auditorias',
    seoTitle: 'Sistema de auditorias internas, achados e planos corretivos | Gestao 360',
    description:
      'Planeje auditorias, registre achados, relacione evidencias e acompanhe planos corretivos.',
    eyebrow: 'Auditoria e conformidade',
    summary:
      'Organize auditorias e acompanhe achados ate a tratativa, mantendo rastreabilidade de decisoes e evidencias.',
    problem:
      'Achados de auditoria perdem prioridade quando nao sao conectados a responsaveis, prazos e acompanhamento gerencial.',
    benefits: [
      'Planeja auditorias com escopo e responsaveis.',
      'Registra achados e evidencias.',
      'Gera planos de acao vinculados.',
      'Apoia acompanhamento de pendencias e reincidencias.',
    ],
    features: ['Plano de auditoria', 'Achados', 'Evidencias', 'Riscos', 'Planos corretivos'],
    useCases: ['Auditoria interna.', 'Checklist de conformidade.', 'Acompanhamento de achados por area.'],
    faq: [
      {
        question: 'A auditoria fica conectada aos planos de acao?',
        answer:
          'Sim. Achados podem ser tratados por planos de acao e acompanhados ate conclusao ou verificacao de eficacia.',
      },
      {
        question: 'Ha trilha de auditoria do sistema?',
        answer:
          'Sim. O sistema registra historico de alteracoes e eventos conforme modulo e permissao.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'gestao-de-documentos',
    path: '/solucoes/gestao-de-documentos',
    title: 'Gestao de documentos',
    seoTitle: 'Gestao de documentos corporativos, revisoes e aprovacao | Gestao 360',
    description:
      'Controle documentos, revisoes, aprovacoes, anexos e rastreabilidade em uma base corporativa.',
    eyebrow: 'Documentos e revisoes',
    summary:
      'Controle documentos importantes com ciclo de revisao, responsaveis, status, anexos e visibilidade por area.',
    problem:
      'Documentos em pastas soltas dificultam saber qual versao esta vigente, quem aprovou e onde o documento e utilizado.',
    benefits: [
      'Organiza documentos por processo, area e tipo.',
      'Mantem historico de revisoes.',
      'Apoia aprovacao e publicacao controlada.',
      'Relaciona documentos a processos, auditorias e formularios.',
    ],
    features: ['Controle documental', 'Revisoes', 'Aprovacoes', 'Anexos', 'Editor online quando configurado'],
    useCases: ['Procedimentos internos.', 'Politicas corporativas.', 'Documentos de processo e qualidade.'],
    faq: [
      {
        question: 'O sistema controla versoes?',
        answer:
          'Sim. O modulo de documentos foi estruturado para armazenar revisoes e manter rastreabilidade.',
      },
      {
        question: 'Documentos podem ser vinculados a processos?',
        answer:
          'Sim. Vinculos ajudam a mostrar onde um documento e usado e quais registros dependem dele.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'formularios-e-checklists',
    path: '/solucoes/formularios-e-checklists',
    title: 'Formularios e checklists',
    seoTitle: 'Formularios digitais e checklists operacionais | Gestao 360',
    description:
      'Digitalize coletas, formularios e checklists com evidencias, aprovacao e rastreabilidade.',
    eyebrow: 'Coleta operacional',
    summary:
      'Padronize coletas e verificacoes de rotina, reduzindo retrabalho e facilitando analise posterior.',
    problem:
      'Formularios em papel ou planilhas dificultam padronizacao, historico, evidencias e visibilidade gerencial.',
    benefits: [
      'Padroniza perguntas, respostas e evidencias.',
      'Permite acompanhamento por status e responsavel.',
      'Conecta reprovacoes a acoes e nao conformidades.',
      'Facilita consulta historica por unidade e processo.',
    ],
    features: ['Templates', 'Execucoes', 'Evidencias', 'Checklists', 'Acompanhamento'],
    useCases: ['Inspecao operacional.', 'Checklist de qualidade.', 'Coletas de rotina por turno.'],
    faq: [
      {
        question: 'O checklist pode gerar acao?',
        answer:
          'Sim. Um resultado reprovado pode ser conectado a planos de acao ou tratativas, conforme configuracao.',
      },
      {
        question: 'Os formularios sao publicos?',
        answer:
          'Nao. Formularios operacionais fazem parte do portal autenticado e respeitam permissao e tenant.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'gestao-de-riscos',
    path: '/solucoes/gestao-de-riscos',
    title: 'Gestao de riscos',
    seoTitle: 'Sistema de gestao de riscos, controles e evidencias | Gestao 360',
    description:
      'Registre riscos, controles, planos de mitigacao, evidencias e conexoes com processos e indicadores.',
    eyebrow: 'Riscos e controles',
    summary:
      'Acompanhe riscos relevantes, seus controles e impactos relacionados a processos, indicadores e auditorias.',
    problem:
      'Riscos mantidos em planilhas perdem atualizacao e ficam distantes das evidencias e dos controles executados.',
    benefits: [
      'Relaciona riscos a processos e indicadores.',
      'Registra criticidade, controles e acoes.',
      'Apoia visao 360 dos impactos.',
      'Ajuda gestores a priorizar riscos criticos.',
    ],
    features: ['Registro de risco', 'Controles', 'Impactos', 'Planos de mitigacao', 'Evidencias'],
    useCases: ['Matriz de riscos por processo.', 'Risco critico em indicador.', 'Acompanhamento de controles internos.'],
    faq: [
      {
        question: 'O risco pode ser ligado a um indicador?',
        answer:
          'Sim. Vinculos ajudam a entender impacto operacional e priorizar acoes relacionadas.',
      },
      {
        question: 'Ha permissao por area?',
        answer:
          'Sim. A visibilidade segue as regras de empresa, area e permissao configuradas.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'seguranca-dos-alimentos',
    path: '/solucoes/seguranca-dos-alimentos',
    title: 'Seguranca dos alimentos',
    seoTitle: 'Gestao de seguranca dos alimentos e rastreabilidade | Gestao 360',
    description:
      'Apoie controles de seguranca dos alimentos, rastreabilidade, fornecedores, lotes e programas operacionais.',
    eyebrow: 'Modulo especializado',
    summary:
      'Organize controles especificos de alimentos e bebidas, com rastreabilidade e conexao com qualidade.',
    problem:
      'Controles de seguranca dos alimentos exigem evidencias consistentes e rastreabilidade entre fornecedores, lotes e ocorrencias.',
    benefits: [
      'Apoia controle de programas e registros.',
      'Relaciona lotes, materiais e eventos.',
      'Mantem evidencias e historico.',
      'Conecta ocorrencias a tratativas e acoes.',
    ],
    features: ['Programas', 'Lotes', 'Fornecedores', 'Rastreabilidade', 'Tratativas'],
    useCases: ['Industria de alimentos.', 'Bebidas e agroindustria.', 'Controle de rastreabilidade por lote.'],
    faq: [
      {
        question: 'Este modulo substitui uma certificacao?',
        answer:
          'Nao. Ele apoia controles, evidencias e rastreabilidade. A conformidade final depende dos processos, auditorias e requisitos aplicaveis.',
      },
      {
        question: 'Ha rastreabilidade de lotes?',
        answer:
          'Sim. O modulo inclui estrutura para materiais, lotes e eventos de rastreabilidade.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'dashboards-executivos',
    path: '/solucoes/dashboards-executivos',
    title: 'Dashboards executivos',
    seoTitle: 'Dashboards executivos para indicadores, riscos e planos | Gestao 360',
    description:
      'Visualize desempenho, atrasos, prioridades, riscos e planos de acao em dashboards corporativos.',
    eyebrow: 'Visao executiva',
    summary:
      'Acompanhe performance e pendencias em visoes gerenciais conectadas aos registros de origem.',
    problem:
      'Dashboards isolados mostram numeros, mas nao permitem entender causa, dono, prazo e acao relacionada.',
    benefits: [
      'Mostra indicadores e pendencias relevantes.',
      'Permite navegar para registros de origem.',
      'Ajuda a priorizar decisoes por impacto e prazo.',
      'Apoia reunioes executivas com dados consistentes.',
    ],
    features: ['Painel gerencial', 'Meu Dia', 'Visao de equipe', 'Alertas', 'Filtros'],
    useCases: ['Reuniao de diretoria.', 'Gestao de pendencias.', 'Acompanhamento de metas e planos.'],
    faq: [
      {
        question: 'Os dashboards sao apenas visuais?',
        answer:
          'Nao. Eles se conectam aos registros de origem para permitir investigacao, acao e rastreabilidade.',
      },
      {
        question: 'Ha uma central diaria de prioridades?',
        answer:
          'Sim. O Meu Dia centraliza itens de trabalho, prioridades, prazos e recomendacoes assistidas.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'gestao-de-nao-conformidades',
    path: '/solucoes/gestao-de-nao-conformidades',
    title: 'Gestao de nao conformidades',
    seoTitle: 'Gestao de nao conformidades, causa raiz e CAPA | Gestao 360',
    description:
      'Registre nao conformidades, investigue causas, acompanhe CAPA, evidencias e eficacia.',
    eyebrow: 'Nao conformidades e CAPA',
    summary:
      'Conduza tratativas de nao conformidade com causa raiz, responsaveis, prazos e verificacao.',
    problem:
      'Sem processo integrado, nao conformidades geram registros desconectados e baixa confiabilidade na verificacao de eficacia.',
    benefits: [
      'Padroniza registro e classificacao.',
      'Relaciona causa, acao corretiva e evidencia.',
      'Acompanha prazos e responsaveis.',
      'Mantem historico para auditorias e reincidencias.',
    ],
    features: ['Registro de NC', 'Analise de causa', 'CAPA', 'Eficacia', 'Historico'],
    useCases: ['NC interna.', 'Desvio de processo.', 'Tratativa de auditoria ou cliente.'],
    faq: [
      {
        question: 'A plataforma possui analise de causa?',
        answer:
          'Sim. O ecossistema inclui recursos para FCA, 5 Porques, Ishikawa, MASP e planos de acao relacionados.',
      },
      {
        question: 'Posso acompanhar reincidencias?',
        answer:
          'Os registros historicos e vinculos ajudam a analisar recorrencia por area, processo ou tipo.',
      },
    ],
    kind: 'solution',
  },
  {
    slug: 'gestao-multiempresa',
    path: '/solucoes/gestao-multiempresa',
    title: 'Gestao multiempresa',
    seoTitle: 'Plataforma multiempresa para gestao corporativa | Gestao 360',
    description:
      'Gerencie empresas, filiais, usuarios, modulos, permissoes e dados isolados por tenant.',
    eyebrow: 'Multiempresa e governanca',
    summary:
      'Controle grupos, unidades e empresas clientes com isolamento de dados, modulos e permissoes.',
    problem:
      'Operacoes com varias unidades precisam padronizar gestao sem misturar dados, permissoes ou responsabilidades.',
    benefits: [
      'Isola dados por empresa.',
      'Configura modulos e planos por cliente ou unidade.',
      'Apoia permissoes por perfil e area.',
      'Mantem administracao global separada do portal operacional.',
    ],
    features: ['Tenants', 'Filiais', 'Modulos por empresa', 'Permissoes', 'Portal Admin Global'],
    useCases: ['Grupo empresarial.', 'Consultoria com clientes distintos.', 'Unidades operacionais com governanca central.'],
    faq: [
      {
        question: 'Um usuario comum acessa dados de outra empresa?',
        answer:
          'Nao. A plataforma respeita tenant, autenticao e autorizacao. Conteudo privado nao e publicado em paginas publicas.',
      },
      {
        question: 'E possivel bloquear modulos por empresa?',
        answer:
          'Sim. O Portal Admin Global possui controle de modulos e planos por empresa.',
      },
    ],
    kind: 'solution',
  },
];

export const segmentPages: PublicPage[] = [
  {
    slug: 'industria',
    path: '/segmentos/industria',
    title: 'Industria',
    seoTitle: 'Gestao de indicadores e planos de acao para industria | Gestao 360',
    description:
      'Use o Gestao 360 para conectar indicadores industriais, desvios, planos de acao, documentos, auditorias e riscos.',
    eyebrow: 'Segmento',
    summary:
      'Para industrias que precisam acompanhar metas, qualidade, seguranca, processos e planos de acao em uma rotina integrada.',
    problem:
      'Areas industriais lidam com muitos indicadores, desvios e evidencias espalhados entre planilhas, reunioes e documentos.',
    benefits: ['Integra indicadores e planos.', 'Apoia auditorias e documentos.', 'Organiza riscos e desvios.', 'Melhora visibilidade por area.'],
    features: ['Indicadores industriais', 'Planos de acao', 'Nao conformidades', 'Auditorias', 'Dashboards'],
    useCases: ['OEE e produtividade.', 'Desvios de qualidade.', 'Reunioes de performance industrial.'],
    faq: [
      { question: 'Serve para chao de fabrica?', answer: 'Serve como apoio de gestao e acompanhamento. A coleta operacional depende da configuracao dos formularios e processos.' },
      { question: 'Funciona por filial?', answer: 'Sim. A plataforma foi estruturada para empresa, filial, area, setor e processo.' },
    ],
    kind: 'segment',
  },
  {
    slug: 'agronegocio',
    path: '/segmentos/agronegocio',
    title: 'Agronegocio',
    seoTitle: 'Gestao corporativa para agronegocio e agroindustria | Gestao 360',
    description:
      'Organize indicadores, processos, qualidade, riscos, planos e evidencias em operacoes do agronegocio.',
    eyebrow: 'Segmento',
    summary:
      'Uma base integrada para acompanhar operacoes com multiplas unidades, indicadores produtivos e rotinas de melhoria.',
    problem:
      'Operacoes agroindustriais precisam consolidar dados de areas diferentes sem perder rastreabilidade e dono da acao.',
    benefits: ['Acompanha unidades e areas.', 'Centraliza evidencias.', 'Conecta indicadores e tratativas.', 'Apoia governanca operacional.'],
    features: ['Multiunidade', 'Indicadores', 'Planos', 'Documentos', 'Seguranca dos alimentos'],
    useCases: ['Indicadores agricolas e industriais.', 'Controle de documentos.', 'Tratativas de desvios por unidade.'],
    faq: [
      { question: 'Permite gestao multiunidade?', answer: 'Sim. A estrutura multiempresa e por filiais atende cenarios com varias unidades.' },
      { question: 'Tem modulo para alimentos?', answer: 'Sim. Ha recursos especializados para seguranca dos alimentos e rastreabilidade.' },
    ],
    kind: 'segment',
  },
  {
    slug: 'alimentos-e-bebidas',
    path: '/segmentos/alimentos-e-bebidas',
    title: 'Alimentos e bebidas',
    seoTitle: 'Gestao para alimentos e bebidas, qualidade e rastreabilidade | Gestao 360',
    description:
      'Controle qualidade, documentos, formularios, rastreabilidade, lotes, auditorias e planos de acao no setor de alimentos e bebidas.',
    eyebrow: 'Segmento',
    summary:
      'Para empresas que precisam unir seguranca dos alimentos, qualidade, evidencias e melhoria continua.',
    problem:
      'O setor exige evidencias confiaveis, rastreabilidade e resposta rapida a desvios sem depender de controles isolados.',
    benefits: ['Apoia rastreabilidade.', 'Organiza evidencias.', 'Integra NC e CAPA.', 'Controla documentos e auditorias.'],
    features: ['Rastreabilidade', 'Documentos', 'Checklists', 'Auditorias', 'Planos corretivos'],
    useCases: ['Controle de lotes.', 'Tratativa de desvios.', 'Checklists de qualidade e seguranca dos alimentos.'],
    faq: [
      { question: 'A plataforma substitui auditorias externas?', answer: 'Nao. Ela apoia organizacao, evidencias e acompanhamento para os processos da empresa.' },
      { question: 'Pode registrar lotes?', answer: 'Sim. O modulo de seguranca dos alimentos possui estrutura de lotes e eventos.' },
    ],
    kind: 'segment',
  },
  {
    slug: 'servicos',
    path: '/segmentos/servicos',
    title: 'Servicos',
    seoTitle: 'Gestao de indicadores e planos para empresas de servicos | Gestao 360',
    description:
      'Acompanhe desempenho, processos, tarefas, documentos, riscos e planos de acao em empresas de servicos.',
    eyebrow: 'Segmento',
    summary:
      'Para operacoes de servicos que precisam padronizar processos, acompanhar metas e dar visibilidade a pendencias.',
    problem:
      'Empresas de servicos frequentemente perdem controle quando demandas, reunioes, documentos e indicadores ficam separados.',
    benefits: ['Centraliza prioridades.', 'Acompanha indicadores de atendimento.', 'Organiza documentos e responsabilidades.', 'Facilita governanca por area.'],
    features: ['Meu Dia', 'Indicadores', 'Planos', 'Documentos', 'Processos'],
    useCases: ['SLA interno.', 'Planos de melhoria.', 'Reunioes de acompanhamento por area.'],
    faq: [
      { question: 'Serve para equipes administrativas?', answer: 'Sim. A plataforma organiza indicadores, planos e pendencias de areas corporativas.' },
      { question: 'Ha painel diario?', answer: 'Sim. O Meu Dia centraliza prioridades e itens de trabalho do usuario.' },
    ],
    kind: 'segment',
  },
  {
    slug: 'gestao-corporativa',
    path: '/segmentos/gestao-corporativa',
    title: 'Gestao corporativa',
    seoTitle: 'Plataforma de gestao corporativa integrada | Gestao 360',
    description:
      'Conecte estrategia, execucao, indicadores, governanca, documentos, riscos e melhoria continua.',
    eyebrow: 'Segmento',
    summary:
      'Para grupos e areas corporativas que precisam de uma visao integrada entre estrategia, execucao e controle.',
    problem:
      'Gestores precisam decidir com contexto, mas os dados costumam estar fragmentados entre sistemas, planilhas e reunioes.',
    benefits: ['Unifica contexto de gestao.', 'Conecta estrategia e execucao.', 'Apoia governanca e auditoria.', 'Respeita permissoes e escopo.'],
    features: ['Estrategia', 'Dashboards', 'Riscos', 'Auditoria', 'Portal Admin Global'],
    useCases: ['Comite executivo.', 'Gestao por metas.', 'Governanca multiempresa.'],
    faq: [
      { question: 'O sistema atende varios departamentos?', answer: 'Sim. Ele foi desenhado para areas, setores, processos e responsaveis.' },
      { question: 'Ha controle de permissao?', answer: 'Sim. A plataforma possui permissao por perfil, modulo e escopo.' },
    ],
    kind: 'segment',
  },
];

export const moduleHighlights = [
  'Meu Dia: caixa de entrada corporativa com prioridades, prazos, delegacoes e recomendacoes assistidas.',
  'Visao 360 do registro: contexto, vinculos, impactos, historico e registros relacionados autorizados.',
  'Central de Automacoes: workflows, tarefas, aprovacoes, escalonamentos e historico.',
  'Portal Admin Global: empresas, planos, modulos, usuarios, auditoria e saude tecnica.',
  'GED e documentos: revisoes, editor online quando configurado, anexos e rastreabilidade.',
  'Seguranca dos alimentos: programas, lotes, fornecedores e eventos de rastreabilidade.',
];

export const faqPage: FaqItem[] = [
  {
    question: 'O Gestao 360 e uma plataforma SaaS?',
    answer:
      'Sim. O produto foi estruturado como plataforma SaaS B2B modular, com portal autenticado, isolamento por empresa e modulos ativaveis conforme contrato.',
  },
  {
    question: 'Quais paginas sao publicas?',
    answer:
      'As paginas institucionais, solucoes, segmentos, conteudos, contato, termos e politica sao publicas. Dashboards, dados de clientes, APIs e administracao exigem autenticacao.',
  },
  {
    question: 'A plataforma usa inteligencia artificial?',
    answer:
      'Ha recursos assistidos por IA em pontos especificos, como resumo e recomendacoes do Meu Dia. A IA nao aprova, rejeita ou conclui tarefas automaticamente.',
  },
  {
    question: 'Como solicitar uma demonstracao?',
    answer:
      'Use o formulario de contato ou o botao de WhatsApp. A equipe pode entender o contexto da empresa e indicar os modulos mais adequados.',
  },
];

export const articlePages: ArticlePage[] = [
  {
    slug: 'como-estruturar-indicadores-de-desempenho',
    path: '/conteudos/artigos/como-estruturar-indicadores-de-desempenho',
    title: 'Como estruturar indicadores de desempenho em uma empresa',
    seoTitle: 'Como estruturar indicadores de desempenho na empresa | Gestao 360',
    description:
      'Um guia pratico para definir KPIs, metas, responsaveis, periodicidade e planos de acao sem depender de planilhas soltas.',
    category: 'Gestao de indicadores',
    author: 'Equipe Gestao 360',
    publishedAt: '2026-06-09',
    updatedAt: '2026-06-09',
    readingTime: '8 min',
    intro:
      'Indicadores bons reduzem discussao subjetiva e aumentam clareza sobre prioridade. O desafio e desenhar uma estrutura que possa ser acompanhada e auditada ao longo do tempo.',
    sections: [
      {
        title: 'Comece pelo objetivo de gestao',
        body: [
          'Um indicador deve responder a uma pergunta de gestao. Antes de escolher graficos, defina qual decisao ele precisa apoiar, quem decide e com qual frequencia.',
          'Esse ponto evita excesso de KPIs e ajuda a separar indicadores estrategicos, taticos e operacionais.',
        ],
      },
      {
        title: 'Defina dono, meta e tolerancia',
        body: [
          'Cada indicador precisa ter responsavel, meta, unidade de medida, periodo, fonte e criterio de leitura. Sem isso, a empresa mede, mas nao gerencia.',
          'Tambem e importante registrar tolerancias e regras de farol para diferenciar variacao normal de desvio que exige acao.',
        ],
      },
      {
        title: 'Conecte resultado a tratativa',
        body: [
          'Quando um resultado fica fora da meta, a plataforma deve permitir abrir uma analise, registrar causa, criar plano de acao e acompanhar eficacia.',
          'Esse elo transforma painel em rotina de gestao e reduz a distancia entre acompanhamento e execucao.',
        ],
      },
    ],
    faq: [
      { question: 'Quantos indicadores uma area deve ter?', answer: 'Nao existe numero universal. O melhor conjunto e aquele que apoia decisoes relevantes sem gerar ruido operacional.' },
      { question: 'Todo indicador precisa de plano de acao?', answer: 'Nao. Planos devem surgir quando ha desvio relevante, risco, recorrencia ou decisao de melhoria.' },
    ],
    related: ['/solucoes/gestao-de-indicadores', '/solucoes/planos-de-acao', '/solucoes/dashboards-executivos'],
  },
  {
    slug: 'como-criar-plano-de-acao-rastreavel',
    path: '/conteudos/artigos/como-criar-plano-de-acao-rastreavel',
    title: 'Como criar um plano de acao realmente rastreavel',
    seoTitle: 'Como criar um plano de acao rastreavel com 5W2H | Gestao 360',
    description:
      'Veja como estruturar planos de acao com responsavel, prazo, evidencia, status e verificacao de eficacia.',
    category: 'Planos de acao',
    author: 'Equipe Gestao 360',
    publishedAt: '2026-06-09',
    updatedAt: '2026-06-09',
    readingTime: '7 min',
    intro:
      'Um plano de acao so cria valor quando fica claro o que sera feito, por quem, ate quando, por qual motivo e com qual evidencia.',
    sections: [
      {
        title: 'Use 5W2H como estrutura, nao como burocracia',
        body: [
          'O 5W2H ajuda a organizar contexto, responsavel, prazo, local, forma de execucao e custo quando aplicavel.',
          'A estrutura deve facilitar cobranca e entendimento, nao virar um formulario extenso sem uso na rotina.',
        ],
      },
      {
        title: 'Mantenha evidencia e historico',
        body: [
          'A evidencia mostra que a acao foi executada e ajuda em auditorias, reunioes e verificacoes futuras.',
          'Historico de comentarios e mudancas evita perda de contexto quando responsaveis mudam.',
        ],
      },
      {
        title: 'Verifique eficacia quando o problema exigir',
        body: [
          'Em desvios relevantes, concluir a acao nao significa resolver o problema. A verificacao de eficacia confirma se o resultado esperado foi atingido.',
        ],
      },
    ],
    faq: [
      { question: 'Todo plano precisa de evidencia?', answer: 'Para acoes criticas, auditorias e desvios, evidencia e altamente recomendada para rastreabilidade.' },
      { question: 'O que fazer com acoes atrasadas?', answer: 'Reavalie causa do atraso, impacto, novo prazo e responsavel, registrando justificativa.' },
    ],
    related: ['/solucoes/planos-de-acao', '/solucoes/gestao-de-nao-conformidades', '/solucoes/auditorias'],
  },
  {
    slug: 'integrar-auditorias-nao-conformidades-planos',
    path: '/conteudos/artigos/integrar-auditorias-nao-conformidades-planos',
    title: 'Como integrar auditorias, nao conformidades e planos de acao',
    seoTitle: 'Como integrar auditorias, nao conformidades e planos de acao | Gestao 360',
    description:
      'Entenda por que auditorias, NCs, causa raiz e CAPA devem estar conectadas em uma mesma trilha de gestao.',
    category: 'Qualidade',
    author: 'Equipe Gestao 360',
    publishedAt: '2026-06-09',
    updatedAt: '2026-06-09',
    readingTime: '9 min',
    intro:
      'Auditorias e nao conformidades perdem forca quando geram listas desconectadas de acoes. A integracao cria visibilidade e responsabilidade.',
    sections: [
      {
        title: 'Trate achados como parte de um fluxo',
        body: [
          'Um achado deve ter origem, contexto, criticidade, responsavel e caminho de tratativa claro.',
          'Quando esse fluxo fica visivel, gestores acompanham pendencias sem depender de cobrancas manuais.',
        ],
      },
      {
        title: 'Relacione causa, acao e evidencia',
        body: [
          'A causa raiz orienta a acao corretiva. A evidencia comprova execucao. A eficacia confirma se a solucao funcionou.',
          'Essas partes precisam estar conectadas para evitar tratativas superficiais.',
        ],
      },
      {
        title: 'Use historico para reduzir reincidencia',
        body: [
          'Com dados estruturados, a empresa consegue identificar reincidencias por processo, area, tipo de falha ou fornecedor.',
        ],
      },
    ],
    faq: [
      { question: 'CAPA e plano de acao sao a mesma coisa?', answer: 'CAPA e um processo de acao corretiva/preventiva. O plano de acao e o instrumento para executar e acompanhar etapas.' },
      { question: 'A integracao ajuda auditorias futuras?', answer: 'Sim. Historico e evidencias reduzem retrabalho e melhoram demonstracao de controle.' },
    ],
    related: ['/solucoes/auditorias', '/solucoes/gestao-de-nao-conformidades', '/solucoes/gestao-da-qualidade'],
  },
];

export const guidePages = [
  {
    path: '/conteudos/guias',
    title: 'Guias de gestao corporativa',
    description:
      'Guias introdutorios sobre indicadores, estrategia, planos de acao, qualidade, auditorias, documentos e melhoria continua.',
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
      images: [{ url: absoluteUrl(image), width: 1200, height: 630, alt: `${PRODUCT_NAME} - plataforma de gestao corporativa` }],
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
  '/seguranca',
  '/implantacao',
  '/suporte',
  '/politica-de-privacidade',
  '/termos-de-uso',
];

export const privateRoutePrefixes = [
  '/login',
  '/platform-admin',
  '/dashboard',
  '/meu-dia',
  '/actions',
  '/indicators',
  '/strategy',
  '/okrs',
  '/meetings',
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
  '/central-automacoes',
  '/central-impactos',
  '/comunicacao',
  '/imports',
  '/integracoes',
  '/insights',
  '/perfil',
  '/plataforma',
  '/processes',
  '/seguranca-alimentos',
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
      'Plataforma SaaS B2B para gestao corporativa integrada, indicadores, estrategia, planos de acao, documentos, auditorias, riscos e melhoria continua.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      description: 'Demonstracao comercial sob solicitacao.',
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
