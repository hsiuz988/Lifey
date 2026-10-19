// 改了任何檔案就把版本號 +1，舊快取才會被清掉
const CACHE = 'lifelog-v21';
const ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './style.css',
  './app.js',
  './db.js',
  './zip.js',
  './photos.js',
  './game.js',
  './cloud.js',
  './avatar.js',
  './scene.js',
  './weather.js',
  './events.js',
  './world.js',
  './world/1970s.json',
  './world/1980s.json',
  './world/1990s.json',
  './world/2000s.json',
  './world/2010s.json',
  './world/2020s.json',
  './pets.js',
  './garden.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload'：安裝新版時一定向伺服器拿，不要拿到瀏覽器快取裡的舊檔
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 先給快取（離線也能開），同時在背景更新快取，下次開啟就是新版
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // API（登入、同步、照片）一律走網路，絕對不能快取
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error()));
      return cached || network;
    }),
  );
});
