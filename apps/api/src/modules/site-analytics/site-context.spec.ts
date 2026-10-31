import { describe, expect, it } from 'vitest';
import { brazilUf, cleanReferrer, parseEntry, parseUserAgent, summarizeBatch, trafficSource, type BatchEvent } from './site-context';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const WINDOWS_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 Instagram 356.0.0.24.92 (iPhone15,3; iOS 18_1; pt_BR; pt; scale=3.00; 1290x2796; 653459498)';

describe('parseUserAgent', () => {
  it('identifica aparelho, navegador e sistema', () => {
    expect(parseUserAgent(IPHONE)).toEqual({ device: 'mobile', browser: 'Safari', os: 'iOS', bot: false });
    expect(parseUserAgent(ANDROID_CHROME)).toEqual({ device: 'mobile', browser: 'Chrome', os: 'Android', bot: false });
    expect(parseUserAgent(ANDROID_TABLET).device).toBe('tablet');
    expect(parseUserAgent(WINDOWS_EDGE)).toEqual({ device: 'desktop', browser: 'Edge', os: 'Windows', bot: false });
    expect(parseUserAgent(MAC_SAFARI)).toEqual({ device: 'desktop', browser: 'Safari', os: 'macOS', bot: false });
    expect(parseUserAgent(INSTAGRAM).browser).toBe('Instagram (app)');
  });

  it('iPad em modo computador (Mac com tela de toque) é tablet', () => {
    expect(parseUserAgent(MAC_SAFARI, true)).toMatchObject({ device: 'tablet', os: 'iPadOS' });
  });

  it('marca robôs e navegadores automatizados', () => {
    expect(parseUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)').bot).toBe(true);
    expect(parseUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36').bot).toBe(true);
    expect(parseUserAgent('facebookexternalhit/1.1').bot).toBe(true);
    expect(parseUserAgent('').bot).toBe(true);
    expect(parseUserAgent(INSTAGRAM).bot).toBe(false);
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 12; CUBOT X50) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36').bot).toBe(false);
  });
});

describe('trafficSource', () => {
  const base = { referrerHost: null, utmSource: null, utmMedium: null, googleClick: false, metaClick: false, browser: null, rootDomain: 'gestao360.org' };

  it('utm_source manda; Google pago vira Google Ads', () => {
    expect(trafficSource({ ...base, utmSource: 'instagram', referrerHost: 'google.com' })).toBe('instagram');
    expect(trafficSource({ ...base, utmSource: 'google', utmMedium: 'cpc' })).toBe('google_ads');
    expect(trafficSource({ ...base, utmSource: 'parceiro-x' })).toBe('campaign');
  });

  it('sem utm, usa o clique de anúncio e o site de origem', () => {
    expect(trafficSource({ ...base, googleClick: true, referrerHost: 'google.com' })).toBe('google_ads');
    expect(trafficSource({ ...base, referrerHost: 'google.com.br' })).toBe('google');
    expect(trafficSource({ ...base, referrerHost: 'l.instagram.com' })).toBe('instagram');
    expect(trafficSource({ ...base, referrerHost: 'chatgpt.com' })).toBe('ai');
    expect(trafficSource({ ...base, referrerHost: 'blog.exemplo.com.br' })).toBe('referral');
  });

  it('o próprio site e as empresas clientes não são "outro site"', () => {
    expect(trafficSource({ ...base, referrerHost: 'gestao360.org' })).toBe('direct');
    expect(trafficSource({ ...base, referrerHost: 'acme.gestao360.org' })).toBe('direct');
    expect(trafficSource({ ...base, metaClick: true, browser: 'Instagram (app)' })).toBe('instagram');
    expect(trafficSource({ ...base, metaClick: true })).toBe('facebook');
    expect(trafficSource(base)).toBe('direct');
  });
});

describe('brazilUf', () => {
  it('converte o nome do estado (português ou inglês) na sigla', () => {
    expect(brazilUf('São Paulo')).toBe('SP');
    expect(brazilUf('Federal District')).toBe('DF');
    expect(brazilUf('Goiás')).toBe('GO');
    expect(brazilUf('California')).toBeNull();
    expect(brazilUf(null)).toBeNull();
  });
});

describe('cleanReferrer e parseEntry', () => {
  it('guarda a origem sem parâmetros', () => {
    expect(cleanReferrer('https://www.google.com/search?q=gestao360')).toEqual({ referrer: 'https://www.google.com/search', host: 'google.com' });
    expect(cleanReferrer('android-app://com.google.android.gm/')).toEqual({ referrer: null, host: null });
    expect(cleanReferrer('nada')).toEqual({ referrer: null, host: null });
  });

  it('lê as utm e tira os identificadores de clique', () => {
    const e = parseEntry('/?utm_source=linkedin&utm_campaign=bsc-outubro&fbclid=IwAR0abc');
    expect(e).toMatchObject({ path: '/?utm_source=linkedin&utm_campaign=bsc-outubro', utmSource: 'linkedin', utmCampaign: 'bsc-outubro', metaClick: true, googleClick: false });
    expect(parseEntry('/demonstracao?gclid=xyz').path).toBe('/demonstracao');
  });
});

describe('summarizeBatch', () => {
  const at = (s: number) => new Date(Date.UTC(2026, 9, 31, 12, 0, s));
  const ev = (type: BatchEvent['type'], s: number, extra: Partial<BatchEvent> = {}): BatchEvent => ({ type, label: null, path: null, createdAt: at(s), ...extra });

  it('do site à demonstração: páginas, seções, clique, sessão e páginas da demo', () => {
    const s = summarizeBatch([
      ev('page_view', 1, { path: '/' }),
      ev('section_view', 2, { label: 'inicio' }),
      ev('section_view', 3, { label: 'secao-inventada' }),
      ev('page_view', 4, { path: '/modulos' }),
      ev('page_view', 5, { path: '/' }),
      ev('demo_click', 6, { label: 'home_hero' }),
      ev('demo_start', 7),
      ev('demo_page', 8, { path: '/meu-dia' }),
      ev('demo_page', 9, { path: '/indicators/:id' }),
      ev('demo_page', 10, { path: '/indicators/:id' }),
      ev('demo_page', 11, { path: '/settings' }),
      ev('whatsapp_click', 12, { label: 'demo_floating_card' }),
    ]);
    expect(s).toMatchObject({
      pageViews: 3,
      pages: ['/', '/modulos'],
      sections: ['inicio'],
      demoClicks: 1,
      firstDemoClick: at(6),
      demoStart: at(7),
      demoPageViews: 3,
      demoPaths: ['/meu-dia', '/indicators/:id'],
      whatsapp: at(12),
      form: null,
    });
  });

  it('visita que já começa dentro da demonstração conta a primeira página como entrada', () => {
    const s = summarizeBatch([ev('demo_page', 3, { path: '/strategy' }), ev('form_submit', 9, { label: 'Comercial' })]);
    expect(s.demoStart).toEqual(at(3));
    expect(s.form).toEqual(at(9));
    expect(s.firstDemoClick).toBeNull();
  });

  it('página com identificador não é página do site', () => {
    expect(summarizeBatch([ev('page_view', 1, { path: '/indicators/:id' })]).pageViews).toBe(0);
  });
});
