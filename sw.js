/* FRAME — Service worker isolato sul proprio percorso GitHub Pages.
 * Mantiene separate le cache di FRAME da quelle di Figurine Club o altre app.
 * Correzione 2026-11-09.
 */
'use strict';

const CACHE = 'frame-cineteca-static-v3';
const OWN_CACHES = ['frame-static-v1'];
const OWN_PREFIX = 'frame-cineteca-static-';
const SCOPE_URL = new URL(self.registration.scope);
const SHELL = [
  './', './index.html', './styles.css', './app.js', './data.js', './identity.js', './explore.js',
  './manifest.webmanifest', './assets/favicon.svg',
  './assets/icon-192.png', './assets/icon-512.png'
];
const INDEX_URL = new URL('./index.html', SCOPE_URL).href;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL.map(path => new URL(path, SCOPE_URL).href)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name !== CACHE && (name.startsWith(OWN_PREFIX) || OWN_CACHES.includes(name)))
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Non intercettare MAI le richieste di altre app o altri percorsi.
  if (url.origin !== SCOPE_URL.origin || !url.pathname.startsWith(SCOPE_URL.pathname)) return;
  // Leggere sempre config.js dalla rete: non lasciare in cache le credenziali pubbliche aggiornate.
  if (url.pathname === new URL('./config.js', SCOPE_URL).pathname) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(INDEX_URL, response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(INDEX_URL)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
