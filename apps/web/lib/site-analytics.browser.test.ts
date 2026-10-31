import { afterAll, describe, expect, it } from 'vitest';

// Navegador mínimo (armazenamento, visibilidade, sendBeacon) e relógio controlado, montados
// antes de carregar o rastreador.
let now = Date.UTC(2026, 9, 31, 13, 0, 0);
const realNow = Date.now;
Date.now = () => now;
const store = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();
const sent: { body: Blob | string }[] = [];
const g = globalThis as any;
g.window = globalThis;
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k) };
g.document = {
  visibilityState: 'visible',
  referrer: 'https://www.google.com/search?q=bsc',
  addEventListener: (type: string, fn: () => void) => (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(fn),
  removeEventListener: (type: string, fn: () => void) => listeners.get(type)?.delete(fn),
};
g.addEventListener = g.document.addEventListener;
g.removeEventListener = g.document.removeEventListener;
g.location = { pathname: '/', search: '?utm_source=linkedin' };
g.screen = { width: 1920, height: 1080 };
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { language: 'pt-BR', maxTouchPoints: 0, webdriver: false, sendBeacon: (_url: string, body: Blob) => sent.push({ body }) > 0 },
});
g.fetch = async (_url: string, init: { body: string }) => {
  sent.push({ body: init.body });
  return { ok: true };
};
const fire = (type: string) => listeners.get(type)?.forEach((fn) => fn());
const batches = async () => Promise.all(sent.splice(0).map(async ({ body }) => JSON.parse(typeof body === 'string' ? body : await body.text())));
const steps = (batch: { events: { type: string; path: string }[] }) => batch.events.map((e) => `${e.type}:${e.path}`);

const tracker = await import('./site-analytics');

afterAll(() => {
  Date.now = realNow;
});

describe('rastreador no navegador', () => {
  it('do site à demonstração: eventos em ordem e tempo da demo separado', async () => {
    const detach = tracker.attachPageListeners();
    tracker.setTrackingMode('site');
    tracker.trackPage('/');
    tracker.trackPage('/'); // novo render da mesma página
    now += 20_000;
    tracker.track('demo_click', 'home_hero', '/');
    tracker.track('demo_start', undefined, '/');
    tracker.setTrackingMode('demo');
    tracker.trackPage('/meu-dia');
    now += 30_000;
    tracker.trackPage('/indicators/3f2a9c1e-1b2c-4d5e-8f90-123456789abc');
    now += 10_000;
    tracker.setTrackingMode('off');

    const [batch] = await batches();
    expect(steps(batch)).toEqual(['page_view:/', 'demo_click:/', 'demo_start:/', 'demo_page:/meu-dia', 'demo_page:/indicators/:id']);
    expect(batch.activeMs).toBe(60_000);
    expect(batch.demoMs).toBe(40_000);
    expect(batch.context).toMatchObject({ entryPath: '/?utm_source=linkedin', referrer: 'https://www.google.com/search?q=bsc', screen: '1920x1080' });
    expect(tracker.currentVisitId()).toBeUndefined();
    detach();
  });

  it('fechar uma aba esquecida não cria visita vazia; voltar a ela abre outra visita', async () => {
    const detach = tracker.attachPageListeners();
    tracker.setTrackingMode('site');
    tracker.trackPage('/modulos');
    g.document.visibilityState = 'hidden';
    fire('visibilitychange');
    const [first] = await batches();
    now += 31 * 60_000;
    fire('pagehide');
    expect(await batches()).toHaveLength(0);

    g.document.visibilityState = 'visible';
    fire('visibilitychange');
    tracker.setTrackingMode('off');
    const [again] = await batches();
    expect(again.visitId).not.toBe(first.visitId);
    expect(steps(again)).toEqual(['page_view:/modulos']);
    detach();
  });

  it('não conta quem tem sessão do Portal Admin nem o navegador marcado pela equipe', async () => {
    store.set('g360.platformAdmin.accessToken', 'token');
    tracker.setTrackingMode('site');
    tracker.track('page_view', undefined, '/');
    tracker.setTrackingMode('off');
    expect(await batches()).toHaveLength(0);
    store.delete('g360.platformAdmin.accessToken');

    tracker.setTrackingDisabled(true);
    expect(tracker.trackingBlocked()).toBe(true);
    tracker.setTrackingDisabled(false);
    expect(tracker.trackingBlocked()).toBe(false);
  });
});
