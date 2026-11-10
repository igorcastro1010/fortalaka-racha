'use strict';

// Incrementar ao mudar a página offline ou qualquer asset desta lista.
const CACHE = 'fortalaka-pwa-v3';
const PUBLIC_ASSETS = [
  '/offline.html', '/pwa/offline.js', '/fortalaka-escudo.jpeg',
  '/pwa/icon-192.png', '/pwa/icon-512.png', '/pwa/maskable-192.png',
  '/pwa/maskable-512.png', '/pwa/apple-touch-icon.png',
];

function validAsset(response, path) {
  if (!response.ok || response.redirected || response.type !== 'basic') return false;
  const type = response.headers.get('Content-Type') || '';
  if (path.endsWith('.png')) return type.startsWith('image/png');
  if (path.endsWith('.jpeg')) return type.startsWith('image/jpeg');
  if (path.endsWith('.js')) return /^(application|text)\/javascript/.test(type);
  return path === '/offline.html' && type.startsWith('text/html');
}

self.addEventListener('install', event => {
  // Instalação atômica: um recurso inválido impede substituir a versão anterior.
  event.waitUntil((async () => {
    const responses = await Promise.all(PUBLIC_ASSETS.map(async path => {
      const response = await fetch(path, { credentials: 'omit', cache: 'reload' });
      if (!validAsset(response, path)) throw new Error('Recurso público da PWA indisponível.');
      return [path, response];
    }));
    const cache = await caches.open(CACHE);
    await Promise.all(responses.map(([path, response]) => cache.put(path, response)));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('fortalaka-pwa-') && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'FORTALAKA_PUSH_CAPABILITIES') {
    event.ports?.[0]?.postMessage({ type: 'FORTALAKA_PUSH_CAPABILITIES', version: 1 });
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.headers.has('Authorization') || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // Nunca salvar HTML, sessão, redirects ou documentos autenticados.
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(async () => {
      const cache = await caches.open(CACHE);
      return await cache.match('/offline.html') || new Response('Você está sem conexão. Tente novamente.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }));
    return;
  }
  // Sem RSC, API, Supabase, avatares privados, JS/CSS do app ou URLs com query.
  if (url.search || !PUBLIC_ASSETS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(url.pathname);
    if (saved) return saved;
    const response = await fetch(url.pathname, { credentials: 'omit', cache: 'reload' });
    if (validAsset(response, url.pathname)) await cache.put(url.pathname, response.clone());
    return response;
  })());
});

// Kept outside the offline caches, so PWA updates do not reset consent.
function pushEndpoint() {
  return new Promise(resolve => {
    const request = indexedDB.open('fortalaka-push', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('settings');
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('settings', 'readonly');
      const read = tx.objectStore('settings').get('endpoint');
      tx.oncomplete = () => { db.close(); resolve(read.result || null); };
      tx.onerror = tx.onabort = () => { db.close(); resolve(null); };
    };
  });
}

function pushHref(value) {
  try {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value)) return '/notificacoes';
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin || url.username || url.password || url.hash) return '/notificacoes';
    if (url.pathname === '/notificacoes' && !url.search) return '/notificacoes';
    const destinations = ['racha', 'teams', 'results', 'evaluate', 'profile'];
    const entries = [...url.searchParams.entries()];
    if (url.pathname === '/' && (entries.length === 0 || (entries.length === 1 && entries[0][0] === 'tab' && destinations.includes(entries[0][1])))) return url.pathname + url.search;
    if (/^\/rodadas\/[a-zA-Z0-9-]+$/.test(url.pathname) && (entries.length === 0 || (entries.length === 1 && entries[0][0] === 'destino' && destinations.includes(entries[0][1])))) return url.pathname + url.search;
  } catch { /* Malformed destination: open the safe central instead. */ }
  return '/notificacoes';
}

async function pushEnabled() {
  try {
    const endpoint = await pushEndpoint();
    return Boolean(endpoint && (await self.registration.pushManager.getSubscription())?.endpoint === endpoint);
  } catch { return false; }
}

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    if (!await pushEnabled()) return;
    let payload;
    try { payload = event.data?.json(); } catch { return; }
    if (!payload || typeof payload.id !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(payload.id)) return;
    const tag = `fortalaka-push-${payload.id}`;
    if ((await self.registration.getNotifications({ tag })).length) return;
    await self.registration.showNotification('Racha Fortalaka', {
      body: 'Novo aviso no app. Abra para conferir.',
      icon: '/pwa/icon-192.png', badge: '/pwa/icon-192.png',
      tag, renotify: false, data: { url: pushHref(payload.url) },
    });
    // Logout may have disabled delivery while showNotification was pending.
    if (!await pushEnabled()) (await self.registration.getNotifications({ tag })).forEach(notification => notification.close());
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    if (!await pushEnabled()) return;
    const href = pushHref(event.notification.data?.url);
    const target = new URL(href, self.location.origin).href;
    const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .filter(client => new URL(client.url).origin === self.location.origin);
    const match = windows.find(client => client.url === target);
    if (match) { await match.focus(); return; }
    const client = windows[0];
    if (client) {
      try { const navigated = await client.navigate(target); if (navigated) { await navigated.focus(); return; } } catch { /* Open a new window if navigation is no longer possible. */ }
    }
    await self.clients.openWindow(target);
  })());
});
