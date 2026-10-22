// 版本號：主.次.修（見 CLAUDE.md「版本號」）。改了任何檔案就把最後一位 +1，舊快取才會被清掉
const VERSION = '0.0.88';
const CACHE = `lifelog-${VERSION}`;
const ASSETS = [
  './',
  './privacy',
  './style.css',
  './cy.css', './moods.js', './joys.js', './joys-config.js',
  './app.js',
  './ptr.js',
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
  './music.js',
  './room/room.webp',
  './joys/cat.webp',
  './joys/coffee.webp',
  './joys/meal.webp',
  './joys/camera.webp',
  './joys/gift.webp',
  './joys/sunset.webp',
  './joys/bear.webp',
  './joys/letter.webp',
  './joys/book.webp',
  './joys/sneaker.webp',
  './joys/plant.webp',
  './joys/cake.webp',
  './joys/star.webp',
  './joys/umbrella.webp',
  './joys/moon.webp',
  './joys/bike.webp',
  './joys/icecream.webp',
  './joys/hearts.webp',
  './joys/home.webp',
  './joys/paw.webp',
  './joys/bath.webp',
  './joys/sun.webp',
  './room/imprints/cat.webp',
  './room/imprints/coffee.webp',
  './room/imprints/meal.webp',
  './room/imprints/gift.webp',
  './room/imprints/bear.webp',
  './room/imprints/hearts.webp',
  './room/imprints/paw.webp',
  './room/imprints/moon.webp',
  './room/imprints/star.webp',
  './room/imprints/sneaker.webp',
  './joys/sparkle.webp',
  './joys/music.webp',
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
  './room/doll/arm_f.webp',
  './room/doll/arm_f_tee.webp',
  './room/doll/arm_n.webp',
  './room/doll/arm_n_tee.webp',
  './room/doll/body.webp',
  './room/doll/body_tee.webp',
  './room/doll/hair_bob_back.webp',
  './room/doll/hair_bob_front.webp',
  './room/doll/hair_long_back.webp',
  './room/doll/hair_long_front.webp',
  './room/doll/leg_f.webp',
  './room/doll/leg_f_tee.webp',
  './room/doll/leg_n.webp',
  './room/doll/leg_n_tee.webp',
  './room/doll/front/body.webp',
  './room/doll/front/body_tee.webp',
  './room/doll/front/hair_bob_back.webp',
  './room/doll/front/hair_bob_front.webp',
  './room/doll/front/hair_long_back.webp',
  './room/doll/front/hair_long_front.webp',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon-maskable-512.png',
  './icons/favicon-32.png',
  './brand/setup_hero.webp',
  './brand/logo_text.webp',
  './room/pixel_room/room.webp',
  './room/pixel_room/room_night.webp',
  './room/pixel_room/tv_on.webp',
  './room/pixel_room/window_cloudy.webp',
  './room/pixel_room/window_rain.webp',
  './room/pixel_room/window_snow.webp',
  './room/pixel_room/window_clear_night.webp',
  './room/pixel_room/window_rain_night.webp',
  './room/pixel/body_sweater_back.webp?v=2',
  './room/pixel/body_sweater_front.webp?v=2',
  './room/pixel/body_sweater_side.webp?v=2',
  './room/pixel/body_sweater_walk0.webp?v=2',
  './room/pixel/body_sweater_walk1.webp?v=2',
  './room/pixel/body_sweater_walk2.webp?v=2',
  './room/pixel/body_sweater_walk3.webp?v=2',
  './room/pixel/face_happy.webp?v=2',
  './room/pixel/face_excited.webp?v=2',
  './room/pixel/face_calm.webp?v=2',
  './room/pixel/face_moved.webp?v=2',
  './room/pixel/face_love.webp?v=2',
  './room/pixel/face_tired.webp?v=2',
  './room/pixel/face_sad.webp?v=2',
  './room/pixel/face_angry.webp?v=2',
  './room/pixel/face_nervous.webp?v=2',
  './room/pixel/face_miss.webp?v=2',
  './room/pixel/icon_happy.webp',
  './room/pixel/icon_excited.webp',
  './room/pixel/icon_calm.webp',
  './room/pixel/icon_moved.webp',
  './room/pixel/icon_love.webp',
  './room/pixel/icon_tired.webp',
  './room/pixel/icon_sad.webp',
  './room/pixel/icon_angry.webp',
  './room/pixel/icon_nervous.webp',
  './room/pixel/icon_miss.webp',
  './room/pixel/head_bob_back.webp?v=2',
  './room/pixel/head_bob_front.webp?v=2',
  './room/pixel/head_bob_side.webp?v=2',
];

// 網址會被轉址的（/index.html → /）不放進快取：Safari 不接受 service worker 回傳轉址過的回應，會變成空白頁
const clean = async (res) => (res.redirected ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers }) : res);
self.addEventListener('install', (e) => {
  // cache: 'reload'：安裝新版時一定向伺服器拿；一個檔案失敗不影響安裝（不然會一直卡在舊版）
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((u) =>
    fetch(new Request(u, { cache: 'reload' })).then(clean).then((res) => (res.ok ? c.put(u, res) : null)).catch(() => null))))
    .then(() => self.skipWaiting()));
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
  // 音樂檔：交給瀏覽器自己處理（播放時會分段要檔案，service worker 快取不了分段的回應）
  if (/\.(?:mp3|m4a)$/.test(url.pathname)) return;
  const fresh = req.mode === 'navigate' || url.pathname.endsWith('/') || FRESH.test(url.pathname);
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = () => cache.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? cache.match('./') : undefined));
      const network = fetch(req).then(clean).then((res) => { if (res.ok && res.type === 'basic') cache.put(req, res.clone()); return res; });
      if (fresh) {
        try { return await Promise.race([network, timeout(4000)]); } catch (err) { return (await cached()) || network.catch(() => Response.error()); }
      }
      const hit = await cached();
      if (hit) { network.catch(() => {}); return hit; }
      return network.catch(() => Response.error());
    }),
  );
});
