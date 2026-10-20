// 改了任何檔案就把版本號 +1，舊快取才會被清掉
const CACHE = 'lifelog-v28';
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
  './room.js',
  './room/room.webp',
  './room/tv_on.webp',
  './room/char/body.webp',
  './room/char/cloth_hoodie.webp',
  './room/char/cloth_tee.webp',
  './room/char/face_angry.webp',
  './room/char/face_happy.webp',
  './room/char/face_smile.webp',
  './room/char/hair_ponytail_back.webp',
  './room/char/hair_ponytail_front.webp',
  './room/char/sym_angry.webp',
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

// 網頁和程式（HTML、JS、CSS、JSON）：有網路就拿最新的，避免新舊檔案混在一起造成空白；離線或太慢才用快取
// 圖片：先給快取，背景更新
const FRESH = /\.(?:html|js|css|json|webmanifest)$/;
const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // API（登入、同步、照片）一律走網路，絕對不能快取
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const fresh = req.mode === 'navigate' || url.pathname.endsWith('/') || FRESH.test(url.pathname);
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = () => cache.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
      const network = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
      if (fresh) {
        try { return await Promise.race([network, timeout(4000)]); } catch (err) { return (await cached()) || network.catch(() => Response.error()); }
      }
      const hit = await cached();
      if (hit) { network.catch(() => {}); return hit; }
      return network.catch(() => Response.error());
    }),
  );
});
