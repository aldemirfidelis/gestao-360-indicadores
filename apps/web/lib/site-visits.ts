import { articlePages, segmentPages, solutionPages } from './public-site';

/** Portal Admin › Visitantes do Site: tipos da API e textos das telas. */

export interface BreakdownRow {
  label: string | null;
  sub: string | null;
  visits: number;
  visitors: number;
  demo: number;
  contacts: number;
}

type Bucket = { bucket: number; visits: number };

export interface SiteOverview {
  period: { from: string; to: string };
  liveNow: number;
  totals: {
    visits: number;
    visitors: number;
    newVisitors: number;
    returningVisitors: number;
    homeVisits: number;
    engaged: number;
    bounced: number;
    demoClicked: number;
    demoStarted: number;
    demoNavigated: number;
    demoFailed: number;
    contacted: number;
    contactedAfterDemo: number;
    whatsapp: number;
    forms: number;
    avgActiveMs: number;
    medianActiveMs: number;
    avgScrollPct: number;
    avgDemoMs: number;
    medianDemoMs: number;
    avgDemoPages: number;
    bots: number;
    pendingGeo: number;
  };
  daily: { day: string; visits: number; visitors: number; demo: number; contacts: number }[];
  heatmap: { dow: number; hour: number; visits: number }[];
  sections: { section: string; visits: number }[];
  noDemo: { total: number; deepest: { section: string | null; visits: number }[]; scroll: Bucket[]; time: Bucket[] };
  demo: {
    areas: { area: string; visits: number }[];
    pages: { path: string; visits: number }[];
    depth: Bucket[];
    time: Bucket[];
    sources: { type: string; label: string; clicks: number; visits: number }[];
    errors: { message: string; times: number; visits: number }[];
  };
  pages: { path: string; visits: number }[];
  clicks: { type: string; label: string; clicks: number; visits: number }[];
  breakdowns: Record<'sources' | 'campaigns' | 'referrers' | 'entryPages' | 'states' | 'cities' | 'countries' | 'devices' | 'browsers' | 'systems', BreakdownRow[]>;
}

export interface SiteVisitRow {
  id: string;
  visitorId: string;
  startedAt: string;
  lastSeenAt: string;
  activeMs: number;
  demoMs: number;
  maxScrollPct: number;
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  geoAt: string | null;
  device: string;
  browser: string | null;
  os: string | null;
  isBot: boolean;
  entryPath: string;
  referrerHost: string | null;
  source: string;
  utmSource: string | null;
  utmCampaign: string | null;
  pageViews: number;
  pages: string[];
  sections: string[];
  demoClicks: number;
  firstDemoClickAt: string | null;
  demoStartedAt: string | null;
  demoErrors: number;
  demoPageViews: number;
  demoPathCount: number;
  demoPaths: string[];
  whatsappAt: string | null;
  formAt: string | null;
  visitorVisits?: number;
}

export interface SiteEventRow {
  id: string;
  type: string;
  label: string | null;
  path: string | null;
  createdAt: string;
}

export interface SiteVisitContact {
  id: string;
  name: string;
  company: string;
  role: string | null;
  email: string;
  phone: string | null;
  requestType: string;
  createdAt: string;
}

export interface SiteVisitDetail extends SiteVisitRow {
  referrer: string | null;
  userAgent: string | null;
  language: string | null;
  screen: string | null;
  timezone: string | null;
  utmMedium: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  eventCount: number;
  events: SiteEventRow[];
  history: SiteVisitRow[];
  contacts: SiteVisitContact[];
}

export const SOURCE_LABEL: Record<string, string> = {
  direct: 'Direto / sem origem',
  google: 'Google (busca)',
  google_ads: 'Google Ads',
  search: 'Outros buscadores',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  x: 'X (Twitter)',
  ai: 'Assistentes de IA (ChatGPT etc.)',
  email: 'E-mail',
  campaign: 'Campanha (UTM)',
  referral: 'Outros sites',
};

/** Seções da página inicial, de cima para baixo (mesma ordem de HOME_SECTIONS). */
export const SECTION_LABEL: Record<string, string> = {
  inicio: 'Topo (primeira tela)',
  frentes: 'Quatro frentes',
  'chamada-final': 'Chamada final',
  rodape: 'Rodapé',
};

/** Áreas da Empresa Demonstração (primeiro trecho do caminho). */
export const DEMO_AREA_LABEL: Record<string, string> = {
  'meu-dia': 'Meu Dia',
  tarefas: 'Tarefas',
  visualization: 'Painel Executivo',
  org: 'Árvore Organizacional',
  strategy: 'Mapa Estratégico (BSC)',
  indicators: 'Indicadores',
  deviations: 'Desvios',
  actions: 'Plano de Ação',
  projects: 'Ata da Reunião',
  meetings: 'Reuniões',
  'monthly-results': 'Reunião Mensal',
  okrs: 'OKRs',
  'gestao-premio': 'Gestão de Prêmio',
  reports: 'Relatórios',
  insights: 'Insights',
  eficacia: 'Eficácia',
};

const DEMO_SUBPAGE_LABEL: Record<string, string> = {
  ':id': 'detalhe',
  equipe: 'Equipe',
  programas: 'Programas',
  competencias: 'Competências',
  anexos: 'Anexos e regras',
  realizado: 'Realizado',
  'previsto-realizado': 'Previsto x realizado',
  colaboradores: 'Colaboradores elegíveis',
  apuracao: 'Apuração mensal',
  ajustes: 'Ajustes e exceções',
  espelhos: 'Espelhos',
  relatorios: 'Relatórios',
  auditoria: 'Auditoria',
  folha: 'Folha',
  indicadores: 'Indicadores',
  moderadores: 'Moderadores',
  cronograma: 'Cronograma',
};

/** "/gestao-premio/espelhos" → "Gestão de Prêmio › Espelhos"; "/indicators/:id" → "Indicadores › detalhe". */
export function demoPageLabel(path: string | null | undefined): string {
  const [area, ...rest] = (path ?? '').split('/').filter(Boolean);
  if (!area) return 'Demonstração';
  const parts = [DEMO_AREA_LABEL[area] ?? area, ...rest.map((s) => DEMO_SUBPAGE_LABEL[s] ?? s.replace(/-/g, ' '))];
  return parts.join(' › ');
}

const SITE_PAGE_LABEL: Record<string, string> = {
  '/': 'Página inicial',
  '/solucoes': 'Soluções',
  '/modulos': 'Módulos',
  '/segmentos': 'Segmentos',
  '/recursos': 'Recursos',
  '/conteudos': 'Conteúdos',
  '/conteudos/guias': 'Guias',
  '/conteudos/artigos': 'Artigos',
  '/conteudos/perguntas-frequentes': 'Perguntas frequentes',
  '/sobre': 'Sobre',
  '/contato': 'Contato comercial',
  '/demonstracao': 'Acesse a Demonstração',
  '/teste-gratis': 'Trial de 30 dias',
  '/seguranca': 'Segurança',
  '/implantacao': 'Implantação',
  '/suporte': 'Suporte',
  '/lgpd': 'LGPD e direitos',
  '/politica-de-privacidade': 'Política de privacidade',
  '/termos-de-uso': 'Termos de uso',
};

let pageTitles: Map<string, string> | null = null;

/** Título da página pública pelo caminho: "/solucoes/gestao-de-indicadores" → "Solução: Gestão de indicadores". */
export function sitePageLabel(path: string | null | undefined): string {
  if (!path) return 'Página desconhecida';
  if (SITE_PAGE_LABEL[path]) return SITE_PAGE_LABEL[path];
  pageTitles ??= new Map([
    ...solutionPages.map((p): [string, string] => [p.path, `Solução: ${p.title}`]),
    ...segmentPages.map((p): [string, string] => [p.path, `Segmento: ${p.title}`]),
    ...articlePages.map((p): [string, string] => [p.path, `Artigo: ${p.title}`]),
  ]);
  return pageTitles.get(path) ?? path;
}

export const DEVICE_LABEL: Record<string, string> = { desktop: 'Computador', mobile: 'Celular', tablet: 'Tablet' };

export const SCROLL_BUCKETS: Record<number, string> = { 0: 'Menos de 25%', 25: '25% a 49%', 50: '50% a 74%', 75: '75% a 99%', 100: 'Até o fim' };
export const TIME_BUCKETS: Record<number, string> = { 0: 'Menos de 10 s', 10: '10 a 30 s', 30: '30 s a 1 min', 60: '1 a 3 min', 180: 'Mais de 3 min' };
export const DEMO_DEPTH_BUCKETS: Record<number, string> = { 1: '1 página', 2: '2 a 3 páginas', 4: '4 a 6 páginas', 7: '7 páginas ou mais' };
export const DEMO_TIME_BUCKETS: Record<number, string> = { 0: 'Menos de 1 min', 1: '1 a 3 min', 3: '3 a 10 min', 10: 'Mais de 10 min' };

/** Onde estava o botão "Acesse a Demonstração" (DemoLink source). */
export const DEMO_SOURCE_LABEL: Record<string, string> = {
  public_header: 'Cabeçalho do site',
  home_hero: 'Topo da página inicial',
  home_footer: 'Chamada final da página inicial',
  public_page_hero: 'Topo das páginas de conteúdo',
  demo_page: 'Página "Acesse a Demonstração"',
  site_cta: 'Outros botões do site',
};

const PLACE_LABEL: Record<string, string> = {
  home_hero: 'topo da página inicial',
  home_footer: 'chamada final da página inicial',
  floating_whatsapp_chat: 'botão flutuante do site',
  demo_floating_card: 'card da demonstração',
  demo_whatsapp_bubble: 'botão redondo da demonstração',
};

const place = (label: string | null) => (label ? PLACE_LABEL[label] ?? label : 'sem local');

/** Linha de "Cliques e contatos". */
export function clickLabel(type: string, label: string | null): string {
  if (type === 'demo_click') return `Demonstração · ${label ? DEMO_SOURCE_LABEL[label] ?? label : 'sem local'}`;
  if (type === 'login_click') return `Entrar no sistema · ${place(label)}`;
  if (type === 'trial_click') return `Solicitar trial · ${place(label)}`;
  if (type === 'whatsapp_click') return `WhatsApp · ${place(label)}`;
  if (type === 'form_submit') return `Formulário · ${label || 'sem tipo'}`;
  return label ?? type;
}

/** Linha do tempo da visita. */
export function eventText(e: Pick<SiteEventRow, 'type' | 'label' | 'path'>): string {
  switch (e.type) {
    case 'page_view':
      return `Abriu ${sitePageLabel(e.path)}`;
    case 'section_view':
      return `Viu a seção ${SECTION_LABEL[e.label ?? ''] ?? e.label}`;
    case 'scroll':
      return e.label === '100' ? 'Rolou a página inicial até o fim' : `Rolou ${e.label}% da página inicial`;
    case 'demo_click':
      return `Clicou em "Acesse a Demonstração" (${e.label ? DEMO_SOURCE_LABEL[e.label] ?? e.label : 'sem local'})`;
    case 'demo_start':
      return 'Entrou na demonstração';
    case 'demo_error':
      return `A demonstração não abriu: ${e.label ?? 'sem mensagem'}`;
    case 'demo_page':
      return `Na demo, abriu ${demoPageLabel(e.path)}`;
    case 'login_click':
      return `Clicou em "Entrar no sistema" (${place(e.label)})`;
    case 'trial_click':
      return `Clicou em "Solicitar trial" (${place(e.label)})`;
    case 'whatsapp_click':
      return `Clicou no WhatsApp (${place(e.label)})`;
    case 'form_submit':
      return `Enviou o formulário: ${e.label || 'contato'}`;
    default:
      return e.type;
  }
}

const UF_NAME: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
  GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba',
  PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

export function stateName(uf: string | null | undefined): string {
  if (!uf) return 'Não identificado';
  return UF_NAME[uf] ? `${uf} · ${UF_NAME[uf]}` : uf;
}

let regionNames: Intl.DisplayNames | null | undefined;
export function countryName(code: string | null | undefined): string {
  if (!code) return 'Não identificado';
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
    } catch {
      regionNames = null;
    }
  }
  return regionNames?.of(code) ?? code;
}

/** "Campinas · SP", "Lisboa · Portugal"; antes da rotina de localização, "Localizando…". */
export function placeLabel(v: Pick<SiteVisitRow, 'city' | 'region' | 'country' | 'geoAt'>): string {
  if (!v.geoAt) return 'Localizando…';
  if (!v.country) return 'Não identificado';
  const parts = [v.city, v.region].filter(Boolean);
  if (v.country !== 'BR') parts.push(countryName(v.country));
  return parts.join(' · ') || countryName(v.country);
}

/** 0 → "0 s"; 75 000 → "1 min 15 s"; 3 900 000 → "1 h 5 min". */
export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return `${total} s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h} h${m ? ` ${m} min` : ''}`;
  return `${m} min${s ? ` ${s} s` : ''}`;
}

export const fmtNumber = (n: number) => new Intl.NumberFormat('pt-BR').format(n);
export const fmtPct = (n: number) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: n > 0 && n < 10 ? 1 : 0 }).format(n)}%`;
export const pctOf = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);

/** "2026-10-31" → "31/10". */
export const fmtDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date);
}

export type VisitResult = 'contacted' | 'demo_navigated' | 'demo_entered' | 'demo_clicked' | 'browsed' | 'bounced';

/** Resultado da visita (exclusivo), na mesma regra dos filtros da API. */
export function visitResult(
  v: Pick<SiteVisitRow, 'whatsappAt' | 'formAt' | 'demoStartedAt' | 'demoPathCount' | 'firstDemoClickAt' | 'pageViews' | 'maxScrollPct' | 'activeMs'>,
): VisitResult {
  if (v.whatsappAt || v.formAt) return 'contacted';
  if (v.demoStartedAt) return v.demoPathCount >= 2 ? 'demo_navigated' : 'demo_entered';
  if (v.firstDemoClickAt) return 'demo_clicked';
  if (v.pageViews <= 1 && v.maxScrollPct < 25 && v.activeMs < 15_000) return 'bounced';
  return 'browsed';
}

export const VISIT_RESULT: Record<VisitResult, { label: string; pill: string }> = {
  contacted: { label: 'Entrou em contato', pill: 'pill-green' },
  demo_navigated: { label: 'Navegou na demo', pill: 'pill-blue' },
  demo_entered: { label: 'Entrou na demo e parou', pill: 'pill-purple' },
  demo_clicked: { label: 'Clicou e a demo não abriu', pill: 'pill-yellow' },
  browsed: { label: 'Só viu o site', pill: 'pill-gray' },
  bounced: { label: 'Saiu sem interagir', pill: 'pill-gray' },
};

/** A seção mais abaixo da página inicial que a visita viu. */
export function deepestSection(sections: string[]): string | null {
  const order = Object.keys(SECTION_LABEL);
  return sections.reduce<string | null>((acc, s) => (order.indexOf(s) > (acc ? order.indexOf(acc) : -1) ? s : acc), null);
}
