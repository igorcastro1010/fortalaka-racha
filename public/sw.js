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
