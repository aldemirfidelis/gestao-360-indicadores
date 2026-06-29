/* Service Worker do Gestão 360 (PWA + Web Push)
 * - Habilita a instalacao como app (Android/Chrome/Edge e iOS via "Adicionar a Tela de Inicio").
 * - Recebe Web Push e exibe notificacoes nativas (Android e iOS 16.4+ instalado).
 * - Mantem-se conservador: NAO faz cache de API/auth; apenas um fallback offline para navegacao.
 */
const SW_VERSION = 'g360-sw-v1';
const OFFLINE_FALLBACK = `
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem conexão — Gestão 360</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#081023;color:#e2e8f0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center}
.box{padding:24px;max-width:420px}h1{font-size:20px;margin:12px 0 6px}p{color:#94a3b8;font-size:14px;line-height:1.5}
button{margin-top:18px;padding:10px 18px;border:0;border-radius:12px;background:linear-gradient(90deg,#06b6d4,#2563eb);
color:#fff;font-weight:700;font-size:14px}</style></head>
<body><div class="box"><div style="font-size:42px">📡</div>
<h1>Você está offline</h1><p>Não foi possível carregar a página. Verifique sua conexão e tente novamente.</p>
<button onclick="location.reload()">Tentar de novo</button></div></body></html>`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // So tratamos navegacoes (HTML). Tudo o mais segue o fluxo normal da rede.
  if (req.mode !== 'navigate') return;
  event.respondWith(
    fetch(req).catch(
      () => new Response(OFFLINE_FALLBACK, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
    ),
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: 'Gestão 360', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Gestão 360';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: payload.tag || 'g360-notification',
    renotify: Boolean(payload.tag),
    data: { url: payload.link || payload.url || '/', ...(payload.data || {}) },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    }),
  );
});
