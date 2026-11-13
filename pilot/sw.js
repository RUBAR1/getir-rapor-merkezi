const cacheName = 'davutpasa-rapor-pilot-1';
const assets = ['./index.html', './depo.js', './depo-template.png', './rapor-bold.ttf', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('davutpasa-rapor-pilot-') && key !== cacheName).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const scope = new URL(self.registration.scope);
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const asset = './' + url.pathname.slice(scope.pathname.length);
  if (request.mode === 'navigate' && (asset === './' || asset === './index.html')) {
    event.respondWith(caches.open(cacheName).then(cache => cache.match('./index.html')));
  } else if (assets.includes(asset)) {
    event.respondWith(caches.open(cacheName).then(cache => cache.match(asset)));
  }
});
