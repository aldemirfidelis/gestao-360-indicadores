import type { Metadata } from 'next';
import { activeProductModules, activeSegmentPages, additionalSolutionPages, landingFaq } from './marketing-catalog';

export const SITE_NAME = 'Gestão 360';
export const PRODUCT_NAME = 'Gestão 360';
export const DEFAULT_SITE_URL = 'https://gestao360.org';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, '');
export const DEFAULT_OG_IMAGE = '/marketing/gestao360-social.png';
/** Entrada pública na Empresa Demonstração, com sessão de consulta. */
export const DEMO_PATH = '/demonstracao';
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
      'Integra ações com indicadores, desvios, processos e reuniões.',
    ],
    features: ['5W2H', 'Tarefas', 'Evidências', 'Aprovações', 'Eficácia'],
    useCases: ['Revisão de um processo.', 'Tratativa de desvio de indicador.', 'Acompanhamento de melhoria contínua.'],
    faq: [
      {
        question: 'O plano de ação pode nascer de um desvio?',
        answer:
          'Planos são relacionados a indicadores, desvios, objetivos e reuniões, mantendo o contexto de cada ação.',
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
    slug: 'dashboards-executivos',
    path: '/solucoes/dashboards-executivos',
    title: 'Painéis executivos',
    seoTitle: 'Painéis executivos para indicadores e planos | Gestão 360',
    description:
      'Visualize desempenho, atrasos, prioridades e planos de ação em painéis conectados aos registros da gestão.',
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
  ...additionalSolutionPages,
];

export const segmentPages: PublicPage[] = activeSegmentPages;

export interface ModuleHighlight {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  capabilities: string[];
}

export const moduleHighlights: ModuleHighlight[] = activeProductModules.map(item => ({ ...item, capabilities: [...item.capabilities] }));

export const faqPage: FaqItem[] = landingFaq;

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
      'Indicadores bons reduzem discussão subjetiva e aumentam clareza sobre prioridade. O desafio é desenhar uma estrutura que possa ser acompanhada e auditada ao longo do tempo.',
    sections: [
      {
        title: 'Comece pelo objetivo de gestão',
        body: [
          'Um indicador deve responder a uma pergunta de gestão. Antes de escolher gráficos, defina qual decisão ele precisa apoiar, quem decide e com qual frequência.',
          'Esse ponto evita excesso de KPIs e ajuda a separar indicadores estratégicos, táticos e operacionais.',
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
    related: ['/solucoes/planos-de-acao', '/solucoes/melhoria-continua', '/solucoes/gestao-de-processos'],
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
    related: ['/solucoes/gestao-de-processos', '/solucoes/planos-de-acao', '/solucoes/gestao-da-qualidade'],
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
    title: { absolute: input.title.includes(SITE_NAME) ? input.title : `${input.title} | ${SITE_NAME}` },
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
  '/demonstracao',
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
 * portal fica inacessível para o público que ele atende. A página global
 * /carreiras também está em publicRoutes para sitemap; páginas de empresa,
 * detalhes e candidato continuam fora da lista estática.
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
      'Plataforma de gestão corporativa que conecta estratégia, BSC, OKRs, processos, indicadores, análise de causa, planos de ação, projetos, documentos e reuniões de resultados.',
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
