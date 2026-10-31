/**
 * Regras puras dos "Visitantes do site": leitura do navegador (User-Agent), origem do
 * tráfego, resumo de um lote de eventos e UF do estado vindo da base de localização por IP.
 */
import { demoAreaOf, HOME_SECTIONS, type SiteEventType } from '@g360/shared';

export interface ParsedUserAgent {
  device: 'desktop' | 'mobile' | 'tablet';
  browser: string | null;
  os: string | null;
  bot: boolean;
}

// Navegadores internos de apps (Instagram, LinkedIn) são pessoas: só os robôs desses apps entram aqui.
// "(?<!cu)" poupa o celular Cubot.
const BOT_UA =
  /(?<!cu)bot\b|crawl|spider|slurp|mediapartners|facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp\/|embedly|preview|lighthouse|pagespeed|gtmetrix|headless|phantomjs|puppeteer|playwright|selenium|python|curl\/|wget|go-http-client|axios|node-fetch|okhttp|java\/|libwww|httpclient|scrapy/i;

function detectOs(ua: string, touch: boolean): string | null {
  if (/Windows NT|Windows Phone/i.test(ua)) return 'Windows';
  if (/iPhone|iPod/.test(ua)) return 'iOS';
  if (/iPad/.test(ua)) return 'iPadOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  // iPad em "modo computador" se apresenta como Mac; a tela de toque denuncia.
  if (/Macintosh|Mac OS X/.test(ua)) return touch ? 'iPadOS' : 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return null;
}

function detectBrowser(ua: string): string | null {
  if (/Instagram/i.test(ua)) return 'Instagram (app)';
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(ua)) return 'Facebook (app)';
  if (/LinkedInApp/i.test(ua)) return 'LinkedIn (app)';
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/Firefox|FxiOS/.test(ua)) return 'Firefox';
  if (/CriOS|Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari';
  return null;
}

export function parseUserAgent(raw: string | null | undefined, touch = false): ParsedUserAgent {
  const ua = raw ?? '';
  const os = detectOs(ua, touch);
  const tablet = /iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || os === 'iPadOS';
  const mobile = !tablet && /Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua);
  return { device: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop', browser: detectBrowser(ua), os, bot: !ua || BOT_UA.test(ua) };
}

/** Origens conhecidas: a tela traduz a chave. "referral" = outro site; "campaign" = utm_source desconhecido. */
export type TrafficSource =
  | 'direct'
  | 'google'
  | 'google_ads'
  | 'search'
  | 'facebook'
  | 'instagram'
  | 'whatsapp'
  | 'linkedin'
  | 'youtube'
  | 'tiktok'
  | 'x'
  | 'ai'
  | 'email'
  | 'campaign'
  | 'referral';

const HOST_SOURCES: [RegExp, TrafficSource][] = [
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|yandex\.[a-z.]+|search\.brave\.com)$/, 'search'],
  [/(^|\.)(instagram\.com)$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'facebook'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, 'x'],
  [/(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|gemini\.google\.com|copilot\.microsoft\.com|claude\.ai)$/, 'ai'],
  [/(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|mail\.yahoo\.com)$/, 'email'],
];

const UTM_SOURCES: [RegExp, TrafficSource][] = [
  [/^(google|adwords|gads)$/, 'google'],
  [/^(facebook|fb|meta)$/, 'facebook'],
  [/^(instagram|ig)$/, 'instagram'],
  [/^(whatsapp|wa|zap)$/, 'whatsapp'],
  [/^linkedin$/, 'linkedin'],
  [/^(youtube|yt)$/, 'youtube'],
  [/^tiktok$/, 'tiktok'],
  [/^(twitter|x)$/, 'x'],
  [/^(bing|duckduckgo|yahoo)$/, 'search'],
  [/^(email|e-mail|newsletter|mailchimp|rdstation)$/, 'email'],
  [/^(chatgpt|openai|perplexity|gemini|copilot|claude)$/, 'ai'],
];

/** O próprio site e os subdomínios das empresas não contam como "outro site". */
export function isOwnHost(host: string, rootDomain: string): boolean {
  return host === rootDomain || host.endsWith(`.${rootDomain}`) || host === 'localhost' || host === '127.0.0.1';
}

export function trafficSource(input: {
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  /** gclid / gbraid / wbraid na URL: clique num anúncio do Google. */
  googleClick: boolean;
  /** fbclid na URL: link aberto no Facebook ou no Instagram. */
  metaClick: boolean;
  browser: string | null;
  rootDomain: string;
}): TrafficSource {
  const utm = input.utmSource?.trim().toLowerCase();
  const paid = /^(cpc|ppc|paid|paid_social|ads?|display)$/i.test(input.utmMedium?.trim() ?? '');
  if (utm) {
    const known = UTM_SOURCES.find(([re]) => re.test(utm))?.[1];
    if (known === 'google' && paid) return 'google_ads';
    if (known) return known;
    return 'campaign';
  }
  if (input.googleClick) return 'google_ads';
  const host = input.referrerHost?.toLowerCase() ?? null;
  if (host && !isOwnHost(host, input.rootDomain)) return HOST_SOURCES.find(([re]) => re.test(host))?.[1] ?? 'referral';
  if (input.metaClick) return input.browser === 'Instagram (app)' ? 'instagram' : 'facebook';
  if (input.browser === 'Instagram (app)') return 'instagram';
  if (input.browser === 'Facebook (app)') return 'facebook';
  if (input.browser === 'LinkedIn (app)') return 'linkedin';
  return 'direct';
}

const strip = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

const BR_STATES: Record<string, string> = {
  acre: 'AC',
  alagoas: 'AL',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceara: 'CE',
  'distrito federal': 'DF',
  'federal district': 'DF',
  'espirito santo': 'ES',
  goias: 'GO',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  para: 'PA',
  paraiba: 'PB',
  parana: 'PR',
  pernambuco: 'PE',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
};

/** "São Paulo" → "SP"; a base DB-IP traz o nome em inglês ("Federal District"). */
export function brazilUf(stateName: string | null | undefined): string | null {
  if (!stateName) return null;
  return BR_STATES[strip(stateName)] ?? null;
}

/** Endereço de origem sem parâmetros (podem carregar dados de outros sites). */
export function cleanReferrer(raw: string | null | undefined): { referrer: string | null; host: string | null } {
  if (!raw) return { referrer: null, host: null };
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return { referrer: null, host: null };
    return { referrer: `${u.origin}${u.pathname}`.slice(0, 300), host: u.hostname.toLowerCase().replace(/^www\./, '') };
  } catch {
    return { referrer: null, host: null };
  }
}

/** Identificadores de clique (enormes e sem valor para leitura) saem da página de entrada guardada. */
const CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid', 'li_fat_id'];

export function parseEntry(entryPath: string) {
  let u: URL;
  try {
    u = new URL(entryPath, 'https://site.invalid');
  } catch {
    u = new URL('https://site.invalid/');
  }
  const q = u.searchParams;
  const utm = (key: string) => q.get(key)?.trim().slice(0, 120) || null;
  const googleClick = ['gclid', 'gbraid', 'wbraid'].some((k) => q.has(k));
  const metaClick = q.has('fbclid');
  for (const k of CLICK_IDS) q.delete(k);
  const search = q.toString();
  return {
    path: `${u.pathname}${search ? `?${search}` : ''}`.slice(0, 300),
    utmSource: utm('utm_source'),
    utmMedium: utm('utm_medium'),
    utmCampaign: utm('utm_campaign'),
    utmTerm: utm('utm_term'),
    utmContent: utm('utm_content'),
    googleClick,
    metaClick,
  };
}

export interface BatchEvent {
  type: SiteEventType;
  label: string | null;
  path: string | null;
  createdAt: Date;
}

/** O que um lote de eventos acrescenta à visita. */
export interface BatchSummary {
  pageViews: number;
  /** Páginas do site abertas (caminhos distintos). */
  pages: string[];
  /** Seções da página inicial que apareceram na tela. */
  sections: string[];
  demoClicks: number;
  firstDemoClick: Date | null;
  /** Primeira vez na demonstração: a sessão aberta ou, numa visita que já começou dentro dela, a primeira página. */
  demoStart: Date | null;
  demoErrors: number;
  demoPageViews: number;
  /** Páginas da demonstração abertas (caminhos distintos, só rotas liberadas à demo). */
  demoPaths: string[];
  whatsapp: Date | null;
  form: Date | null;
}

const HOME_SECTION_SET = new Set<string>(HOME_SECTIONS);

/** Página do site: o caminho de uma página pública nunca tem identificadores. */
function isSitePage(path: string | null): path is string {
  return !!path && !path.includes(':id') && path.split('/').length <= 5;
}

export function summarizeBatch(events: BatchEvent[]): BatchSummary {
  const earliest = (match: (e: BatchEvent) => boolean) => {
    const times = events.filter(match).map((e) => e.createdAt.getTime());
    return times.length ? new Date(Math.min(...times)) : null;
  };
  const count = (type: SiteEventType) => events.filter((e) => e.type === type).length;
  const distinct = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => !!v))];
  const pageViews = events.filter((e) => e.type === 'page_view' && isSitePage(e.path));
  const demoPages = events.filter((e) => e.type === 'demo_page' && demoAreaOf(e.path));
  return {
    pageViews: pageViews.length,
    pages: distinct(pageViews.map((e) => e.path)),
    sections: distinct(events.filter((e) => e.type === 'section_view' && e.label && HOME_SECTION_SET.has(e.label)).map((e) => e.label)),
    demoClicks: count('demo_click'),
    firstDemoClick: earliest((e) => e.type === 'demo_click'),
    demoStart: earliest((e) => e.type === 'demo_start' || demoPages.includes(e)),
    demoErrors: count('demo_error'),
    demoPageViews: demoPages.length,
    demoPaths: distinct(demoPages.map((e) => e.path)),
    whatsapp: earliest((e) => e.type === 'whatsapp_click'),
    form: earliest((e) => e.type === 'form_submit'),
  };
}
