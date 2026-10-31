import { HOME_SECTIONS, isDemoRouteAllowed, normalizeSitePath, type SiteEventType } from '@g360/shared';
import { publicRoutes } from './public-site';

/**
 * Estatísticas das visitas ao site e à demonstração, vistas no Portal Admin Global em
 * "Visitantes do Site". Os dados vão só para a API do Gestão 360 (nenhuma ferramenta de
 * terceiros). O navegador guarda um id aleatório (visitante) e o id da visita, que expira
 * após 30 minutos parado. Nunca enviamos o que a pessoa digita.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
const ENDPOINT = `${API_URL}/public/site-events`;
const VISITOR_KEY = 'g360.site.visitor';
const VISIT_KEY = 'g360.site.visit';
/** "1" = não contar este navegador (marcado pela equipe no Portal Admin). */
const OPT_OUT_KEY = 'g360.site.notrack';
/** Equipe logada no Portal Admin Global também fica fora dos números. */
const PLATFORM_ACCESS_KEY = 'g360.platformAdmin.accessToken';
const VISIT_IDLE_MS = 30 * 60_000;
const FLUSH_DELAY_MS = 800;
const PING_EVERY_MS = 30_000;
/** Aba esquecida aberta: depois disso a página para de avisar que continua aberta (a demo dura uma hora). */
const PING_LIMIT_MS = 60 * 60_000;
/** O mesmo caminho registrado de novo em menos tempo que isso é a mesma visualização (re-render). */
const SAME_PAGE_MS = 1500;
const SCROLL_MILESTONES = [25, 50, 75, 100];

/** site = página pública; demo = dentro da Empresa Demonstração; off = fora das estatísticas. */
export type TrackingMode = 'off' | 'site' | 'demo';

const SITE_PAGES = new Set(publicRoutes);

export function isSitePage(pathname: string): boolean {
  return SITE_PAGES.has(pathname.replace(/\/+$/, '') || '/');
}

/**
 * Só visitantes contam: quem está logado no sistema (clientes, equipe) ou no Portal Admin fica
 * fora. A sessão da demonstração é de visitante: conta como "demo" nas rotas da demo.
 */
export function trackingMode(input: { pathname: string; loading: boolean; user: { isDemo?: boolean } | null; blocked: boolean }): TrackingMode {
  if (input.loading || input.blocked) return 'off';
  if (input.user && !input.user.isDemo) return 'off';
  if (isSitePage(input.pathname)) return 'site';
  if (input.user?.isDemo && isDemoRouteAllowed(input.pathname)) return 'demo';
  return 'off';
}

interface VisitContext {
  entryPath: string;
  referrer?: string;
  screen?: string;
  language?: string;
  timezone?: string;
  touch?: boolean;
  webdriver?: boolean;
}

interface Visit {
  id: string;
  lastAt: number;
  activeMs: number;
  demoMs: number;
  maxScrollPct: number;
  context: VisitContext;
}

interface QueuedEvent {
  type: SiteEventType;
  label?: string;
  path: string;
  at: number;
}

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Sem localStorage (bloqueado, aba privada antiga): ids só na memória, uma visita por carregamento.
const memory = new Map<string, string>();
function load(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}
function save(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
}

export function trackingDisabled(): boolean {
  return typeof window !== 'undefined' && load(OPT_OUT_KEY) === '1';
}

export function setTrackingDisabled(disabled: boolean) {
  try {
    if (disabled) window.localStorage.setItem(OPT_OUT_KEY, '1');
    else window.localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    /* armazenamento indisponível */
  }
}

/** Este navegador não entra nos números: marcado pela equipe ou com sessão do Portal Admin. */
export function trackingBlocked(): boolean {
  return typeof window === 'undefined' || trackingDisabled() || !!load(PLATFORM_ACCESS_KEY);
}

function visitorId(): string {
  let id = load(VISITOR_KEY);
  if (!id) {
    id = uuid();
    save(VISITOR_KEY, id);
  }
  return id;
}

function newVisit(): Visit {
  return {
    id: uuid(),
    lastAt: Date.now(),
    activeMs: 0,
    demoMs: 0,
    maxScrollPct: 0,
    context: {
      entryPath: `${location.pathname}${location.search}`.slice(0, 1000),
      referrer: document.referrer ? document.referrer.slice(0, 2000) : undefined,
      screen: `${screen.width}x${screen.height}`,
      language: navigator.language?.slice(0, 35),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone?.slice(0, 60),
      touch: navigator.maxTouchPoints > 0,
      webdriver: navigator.webdriver === true,
    },
  };
}

let current: Visit | null = null;

/** Visita em andamento sem abrir outra: null depois de 30 minutos sem atividade. */
function liveVisit(): Visit | null {
  if (!current) {
    try {
      current = JSON.parse(load(VISIT_KEY) ?? 'null') as Visit | null;
      if (current && typeof current.demoMs !== 'number') current.demoMs = 0;
    } catch {
      current = null;
    }
  }
  return current && Date.now() - current.lastAt < VISIT_IDLE_MS ? current : null;
}

/** Visita para uma atividade real (página, clique, rolagem); abre outra se a anterior expirou. */
function visit(): { visit: Visit; isNew: boolean } {
  const live = liveVisit();
  if (live) return { visit: live, isNew: false };
  current = newVisit();
  persist();
  return { visit: current, isNew: true };
}

function persist() {
  if (current) save(VISIT_KEY, JSON.stringify(current));
}

let mode: TrackingMode = 'off';
let visibleSince: number | null = null;
let currentPage: { type: 'page_view' | 'demo_page'; path: string; at: number } | null = null;
let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

/** Id da visita para o formulário de contato: o portal liga a mensagem à jornada da pessoa. */
export function currentVisitId(): string | undefined {
  return mode === 'off' || trackingBlocked() ? undefined : visit().visit.id;
}

/**
 * Soma o tempo com a aba visível desde a última conta (na demo, também no tempo de demo).
 * Visita já expirada não recebe tempo nem é reaberta: fechar uma aba esquecida não cria visita vazia.
 */
function accumulate() {
  if (mode === 'off') return;
  const now = Date.now();
  const v = liveVisit();
  if (v && visibleSince !== null) {
    v.activeMs += now - visibleSince;
    if (mode === 'demo') v.demoMs += now - visibleSince;
  }
  if (visibleSince !== null) visibleSince = now;
  if (v) {
    v.lastAt = now;
    persist();
  }
}

function send(beacon: boolean) {
  if (trackingBlocked()) {
    queue = [];
    return;
  }
  // Só tempo a informar e a visita já expirou: não há o que enviar.
  const v = queue.length ? visit().visit : liveVisit();
  if (!v) return;
  const events = queue.splice(0, 30);
  const body = JSON.stringify({
    visitorId: visitorId(),
    visitId: v.id,
    sentAt: Date.now(),
    context: v.context,
    events,
    maxScrollPct: v.maxScrollPct,
    activeMs: Math.round(v.activeMs),
    demoMs: Math.round(v.demoMs),
  });
  let sent = false;
  // Saindo da página: sendBeacon sobrevive ao fechamento da aba.
  if (beacon && typeof navigator.sendBeacon === 'function') {
    try {
      sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    } catch {
      sent = false;
    }
  }
  if (!sent) {
    fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true, credentials: 'omit' }).catch(() => undefined);
  }
  if (queue.length) send(beacon);
}

function flush(beacon = false) {
  clearTimeout(timer);
  timer = undefined;
  send(beacon);
}

/** Registra um evento da visita (ignorado fora das estatísticas). */
export function track(type: SiteEventType, label?: string, path: string = location.pathname) {
  if (mode === 'off' || trackingBlocked()) return;
  const { visit: v } = visit();
  v.lastAt = Date.now();
  persist();
  queue.push({ type, label: label?.slice(0, 200), path: normalizeSitePath(path) ?? '/', at: Date.now() });
  clearTimeout(timer);
  timer = setTimeout(() => flush(), FLUSH_DELAY_MS);
}

/** Entra ou sai das estatísticas (site, demo ou fora); fecha a conta do trecho anterior. */
export function setTrackingMode(next: TrackingMode) {
  if (next === mode) return;
  accumulate();
  const leaving = mode !== 'off' && next === 'off';
  if (leaving) flush(true);
  mode = next;
  visibleSince = next !== 'off' && document.visibilityState === 'visible' ? Date.now() : null;
  if (next === 'off') currentPage = null;
}

/** Página aberta no site (page_view) ou na demonstração (demo_page). */
export function trackPage(pathname: string) {
  if (mode === 'off') return;
  const type = mode === 'demo' ? 'demo_page' : 'page_view';
  const path = normalizeSitePath(pathname) ?? '/';
  if (currentPage && currentPage.type === type && currentPage.path === path && Date.now() - currentPage.at < SAME_PAGE_MS) return;
  currentPage = { type, path, at: Date.now() };
  track(type, undefined, path);
}

/** Tempo visível, envio ao sair, aviso periódico de "continua aberta" e cliques em [data-track]. */
export function attachPageListeners(): () => void {
  const startedAt = Date.now();
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      accumulate();
      visibleSince = null;
      flush(true);
      return;
    }
    if (mode === 'off') return;
    // Voltou depois de 30 minutos: é outra visita, e a página aberta conta de novo.
    if (visit().isNew && currentPage) track(currentPage.type, undefined, currentPage.path);
    visibleSince = Date.now();
  };
  const onPageHide = () => {
    accumulate();
    flush(true);
  };
  const onClick = (event: MouseEvent) => {
    const el = (event.target as Element | null)?.closest<HTMLElement>('[data-track]');
    if (el?.dataset.track) track(el.dataset.track as SiteEventType, el.dataset.trackLabel);
  };
  const ping = setInterval(() => {
    if (mode === 'off' || document.visibilityState !== 'visible' || Date.now() - startedAt > PING_LIMIT_MS) return;
    accumulate();
    flush();
  }, PING_EVERY_MS);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('click', onClick, true);
  return () => {
    clearInterval(ping);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('click', onClick, true);
  };
}

/** Página inicial: até onde rolou e quais seções (section[id] e o rodapé) apareceram na tela. */
export function observeHome(): () => void {
  const seen = new Set<string>();
  let reached = 0;
  const onScroll = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max <= 0 ? 100 : Math.min(100, Math.round((window.scrollY / max) * 100));
    const { visit: v } = visit();
    if (pct > v.maxScrollPct) {
      v.maxScrollPct = pct;
      persist();
    }
    for (const milestone of SCROLL_MILESTONES) {
      if (pct >= milestone && reached < milestone) {
        reached = milestone;
        track('scroll', String(milestone));
      }
    }
  };
  // Seção "vista" quando o topo dela passa da metade da tela (vale para seções mais altas que a tela).
  const sections = new Set<string>(HOME_SECTIONS);
  const observer =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const id = (entry.target as HTMLElement).id;
              if (!entry.isIntersecting || seen.has(id)) continue;
              seen.add(id);
              track('section_view', id);
              observer?.unobserve(entry.target);
            }
          },
          { rootMargin: '0px 0px -50% 0px' },
        )
      : null;
  // Depois do commit da navegação: as seções da página nova já estão no DOM.
  const frame = requestAnimationFrame(() => {
    document.querySelectorAll<HTMLElement>('main section[id], footer[id]').forEach((el) => {
      if (sections.has(el.id)) observer?.observe(el);
    });
    onScroll();
  });
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener('scroll', onScroll);
  };
}
