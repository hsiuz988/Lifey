const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 用法：先在 public/ 開一個本機伺服器，再執行 tests/run.sh（詳見 tests/README.md）
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();
const FIXTURES = require('path').join(__dirname, '..', 'fixtures');

const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const errors = [];
const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
const RAIN = { current: { temperature_2m: 22.4, weather_code: 63, cloud_cover: 92, is_day: 1 }, daily: { sunrise: ['2026-10-18T05:52'], sunset: ['2026-10-18T17:25'] } };

async function newPage(b, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ...opts });
  const p = await ctx.newPage(); await require('./adapt.cjs')(p);
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
  p.apiCalls = [];
  await ctx.route('https://api.open-meteo.com/**', (route) => { p.apiCalls.push(route.request().url()); route.fulfill({ json: RAIN }); });
  return p;
}

(async () => {
  const b = await chromium.launch();

  // ===== 新使用者：設定完選樣子 =====
  const p = await newPage(b, { geolocation: { latitude: 25.03312, longitude: 121.56541 }, permissions: ['geolocation'] });
  await p.goto(URL);
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button[type=submit]');
  await p.waitForFunction(() => document.querySelector('#look-dialog').open);
  assert(true, '第一次設定完自動打開「選你的樣子」');
  await p.click('#look-options .look-opt[data-style="classic"]');
  await p.click('#look-options .look-opt:has-text("光頭")');
  await p.click('#look-options .look-opt:has-text("帽 T")');
  await p.screenshot({ path: OUT + '/s6-look.png' });
  await p.click('#look-save');
  await p.waitForTimeout(600); // 歡迎頁由 adapt.cjs 自動關掉
  let s = await st(p);
  assert(s.profile.look.hair === '' && s.profile.look.cloth === 'hoodie', '存下：光頭、帽 T');
  assert(await p.$eval('#scene', (e) => e.dataset.look) === '/hoodie', '房間裡的小人換成帽 T');
  assert(await p.$eval('#l-cloth', (e) => e.getAttribute('href').includes('cloth_hoodie')) && await p.$eval('#l-hair-front', (e) => e.style.display === 'none'), '房間小人的圖層正確');

  // 從「我」換樣子，關掉不存
  await tab(p, 'me'); await p.click('#me-card');
  await p.waitForSelector('#look-dialog[open]');
  await p.click('#look-options .look-opt:has-text("高馬尾")');
  await p.keyboard.press('Escape');
  s = await st(p);
  assert(s.profile.look.hair === '', '沒按「好了」就不會存');
  assert(await p.$eval('#me-look', (e) => e.querySelectorAll('img').length >= 3), '「我」的個人卡是自己的小人');

  // ===== 房間 =====
  await tab(p, 'home');
  assert(await p.$eval('#scene', (e) => !!e.querySelector('image[href*="room.webp"]')), '首頁是房間');
  // 點地板：小人走過去
  const before = await p.$eval('#room-me', (e) => e.getAttribute('transform'));
  const rb = await p.$eval('#scene svg', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.click(rb.x + rb.w * 0.7, rb.y + rb.h * 0.75);
  await p.waitForTimeout(1600);
  assert(await p.$eval('#room-me', (e) => e.getAttribute('transform')) !== before, '點地板，小人走過去');
  // 點小人：跳一下、說句話，不會打開換裝
  await p.$eval('#room-me', (e) => e.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await p.waitForTimeout(300);
  assert(!(await p.$eval('#look-dialog', (d) => d.open)), '點房間裡的自己不會打開換裝');
  assert(await p.$eval('#scene-bubble', (e) => e.classList.contains('show') && e.textContent.length > 0), '點房間裡的自己會說句話');
  // 版本號是 主.次.修（例如 0.0.50）：0.0.10 比 0.0.9 新，舊的 v49 格式不算
  await p.evaluate(() => Promise.all(['lifelog-0.0.9', 'lifelog-0.0.10', 'lifelog-v99'].map((k) => caches.open(k))));
  await p.evaluate(() => { document.querySelector('.me-menu [data-open=other]').click(); });
  assert(await p.waitForFunction(() => document.querySelector('#settings-version').textContent.startsWith('App 版本：0.0.10 '), null, { timeout: 3000 }).then(() => true, () => false), '設定裡顯示 App 版本：主.次.修');
  await p.evaluate(() => { const d = document.querySelector('#settings-dialog'); if (d.open) d.close(); });
  await p.waitForTimeout(100);
  await p.evaluate(() => Promise.all(['lifelog-0.0.9', 'lifelog-0.0.10', 'lifelog-v99'].map((k) => caches.delete(k))));
  // 床：睡覺、叫醒
  await p.click('#scene .hot[data-name="bed"]');
  await p.waitForFunction(() => document.querySelector('#scene').dataset.actor === 'sleep', null, { timeout: 8000 });
  assert((await p.textContent('#scene-bubble')).includes('晚安'), '點床：小人去睡覺');
  await p.mouse.click(rb.x + rb.w * 0.5, rb.y + rb.h * 0.8);
  assert(await p.$eval('#scene', (e) => e.dataset.actor) === 'idle', '點一下叫醒');
  // 日記本：記一筆
  await p.click('#scene .hot[data-name="diary"]');
  await p.waitForSelector('#moment-dialog[open]', { timeout: 8000 });
  await p.fill('#moment-form [name=text]', '今天被插隊，好生氣'); await p.click('#moment-save');
  await p.waitForFunction(() => !document.querySelector('#moment-dialog').open);
  await p.waitForTimeout(300);
  assert(await p.$eval('#scene', (e) => e.dataset.face) === 'angry' && await p.$eval('#l-face', (e) => e.getAttribute('href').includes('face_angry')), '寫了生氣的事，小人換成生氣的臉');
  assert(await p.$eval('#scene-bubble', (e) => e.classList.contains('show')), '記完小人會說話');
  assert(['哼哼哼 (╬ Ò﹏Ó)', '吸氣…吐氣…'].includes(await p.textContent('#scene-bubble')), `生氣時小人用自己的口吻說生氣的台詞（${await p.textContent('#scene-bubble')}）`);
  // 電視：出生那年的世界
  await p.click('#scene .hot[data-name="tv"]');
  await p.waitForSelector('#info-dialog[open]', { timeout: 8000 });
  await p.waitForSelector('#info-body .tv-list li');
  assert((await p.textContent('#info-body h3')).includes('1995'), '電視播出生那年（1995）的事');
  assert(await p.isVisible('#info-body .tv-screen .tv-live') && (await p.textContent('#info-body .tv-headline')).includes('頭條'), '電視打開是新聞報導：LIVE、頭條');
  assert(await p.getAttribute('#scene image[href$="tv_on.webp"]', 'opacity') === '1', '電視亮起來');
  await p.click('#info-dialog [data-close]'); await p.waitForTimeout(100);
  assert(await p.getAttribute('#scene image[href$="tv_on.webp"]', 'opacity') === '0', '關掉就關機');
  // 信：寫給下一歲
  await p.click('#scene .hot[data-name="letter"]');
  await p.waitForSelector('#letter-dialog[open]', { timeout: 8000 });
  assert((await p.textContent('#letter-body h3')).includes('32 歲'), '點信紙寫信給下一歲的自己');
  await p.evaluate(() => document.querySelector('#letter-dialog').close());
  assert(errors.length === 0, '房間互動沒有錯誤');

  // 真實天氣
  await tab(p, 'me').then(() => p.click('.me-menu [data-open=weather]'));
  await p.click('#weather-toggle');
  await p.waitForFunction(() => document.querySelector('#now-caption').textContent.includes('下雨'), null, { timeout: 10000 });
  assert((await p.textContent('#now-caption')).includes('🌧️ 22° 下雨'), '開啟天氣：說明列顯示 🌧️ 22° 下雨');
  assert(!(await p.$eval('#hud-weather', (e) => e.hidden)) && (await p.textContent('#hud-weather')).includes('22°'), '房間上方顯示天氣');
  assert(await p.$eval('#scene', e => e.dataset.weather) === 'rain', '場景切換成下雨');
  assert(/^rain(_night)?$/.test(await p.$eval('#scene', (e) => e.dataset.window)) && await p.$eval('#scene svg image[href*="window_rain"]', (e) => !e.hasAttribute('display')), '窗外換成下雨');
  const views = await p.evaluate(async () => {
    const { windowView } = await import('./room.js');
    const at = (h) => new Date(2026, 9, 18, h, 0);
    const w = (kind) => ({ kind, sunrise: '2026-10-18T05:52', sunset: '2026-10-18T17:25' });
    return [windowView(null, at(12)), windowView(null, at(20)), windowView(w('rain'), at(12)), windowView(w('thunder'), at(18)), windowView(w('overcast'), at(9)),
      windowView(w('fog'), at(9)), windowView(w('snow'), at(15)), windowView(w('clear'), at(5)), windowView(w('cloudy'), at(17))];
  });
  assert(views.join() === 'clear,clear_night,rain,rain_night,cloudy,cloudy,snow,clear_night,cloudy', `窗外依天氣和日出日落切換（${views.join()}）`);
  assert(p.apiCalls.length === 1 && p.apiCalls[0].includes('latitude=25.03') && p.apiCalls[0].includes('longitude=121.57'), '只送出四捨五入到小數兩位的位置');
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('lifey.weather')));
  assert(stored.lat === 25.03 && stored.lon === 121.57, '位置只存約略值在手機上');
  assert(!JSON.stringify(await st(p)).includes('25.03'), '位置不會寫進紀錄資料（也就不會同步上雲）');
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#now-caption').textContent.includes('下雨'));
  assert(p.apiCalls.length === 1, '30 分鐘內重開不會重複查天氣（用快取）');
  await tab(p, 'me').then(() => p.click('.me-menu [data-open=weather]'));
  await p.click('#weather-toggle');
  await p.waitForTimeout(200);
  assert(!(await p.textContent('#now-caption')).includes('下雨') && await p.$eval('#scene', e => e.dataset.weather) === 'none', '關閉天氣：回到預設場景');
  assert(/^clear(_night)?$/.test(await p.$eval('#scene', (e) => e.dataset.window)), '關閉天氣：窗外回到晴天');
  await p.click('#settings-dialog .win-x');

  // 沒給定位權限
  const q = await newPage(b);
  await q.goto(URL);
  await q.fill('#setup-form [name=name]', 'X'); await q.fill('#setup-form [name=birthday]', '1990-01-01'); await q.click('#setup-form button[type=submit]');
  await q.waitForFunction(() => document.querySelector('#look-dialog').open); await q.keyboard.press('Escape');
  await tab(q, 'me').then(() => q.click('.me-menu [data-open=weather]'));
  await q.click('#weather-toggle');
  assert(await q.waitForFunction(() => /定位/.test(document.querySelector('#toast').textContent), null, { timeout: 20000 }).then(() => true, () => false), '沒給定位權限：提示怎麼開啟');

  // ===== 舊資料：沒有選過樣子，用預設的 =====
  const r = await newPage(b);
  await r.goto(URL);
  await r.evaluate(() => new Promise(res => { const q = indexedDB.open('lifey', 1); q.onupgradeneeded = () => { q.result.createObjectStore('meta'); q.result.createObjectStore('photos', { keyPath: 'id' }); };
    q.onsuccess = () => { const tx = q.result.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ version: 2, profile: { name: 'Old', birthday: '1995-03-02', avatar: { skin: 1, hair: 3, style: 'long', glasses: true } }, years: {}, moments: [], achievements: {} }, 'state'); tx.oncomplete = res; }; }));
  await r.reload(); await r.waitForSelector('#app:not([hidden])');
  assert(await r.$eval('#scene', (e) => e.dataset.look) === 'bob/sweater', '舊資料（還沒選過樣子）：房間裡是預設的像素女孩');

  // ===== 晚上：房間換成夜晚、檯燈亮著，可以關燈 =====
  const n = await newPage(b);
  await n.clock.setSystemTime(new Date(2026, 9, 18, 20, 0));
  await n.goto(URL);
  await n.fill('#setup-form [name=name]', 'N'); await n.fill('#setup-form [name=birthday]', '1995-03-02'); await n.click('#setup-form button[type=submit]');
  await n.waitForFunction(() => document.querySelector('#look-dialog').open); await n.keyboard.press('Escape');
  await n.waitForTimeout(300);
  const nightRoom = () => n.$eval('#scene svg image[href*="room_night"]', (e) => e.getAttribute('opacity'));
  assert(await n.$eval('#scene', (e) => e.dataset.light + e.dataset.lamp) === 'nighton' && await nightRoom() === '1', '晚上 8 點：房間換成夜晚、檯燈亮著');
  assert((await n.$eval('.home-page .room-box', (e) => getComputedStyle(e).backgroundImage)).includes('radial-gradient'), '晚上：房間外面的底色也變深');
  await n.click('#scene .hot[data-name="lamp"]');
  await n.waitForFunction(() => document.querySelector('#scene').dataset.lamp === 'off', null, { timeout: 8000 });
  assert(await n.$eval('#scene svg .room-night', (e) => e.getAttribute('opacity')) === '0.4', '晚上關檯燈：整間暗下來');
  await n.screenshot({ path: OUT + '/s6-night-dark.png' });
  await n.close();

  // ===== 復古娃娃：選角色、走路會擺手擺腳 =====
  const d = await newPage(b);
  await d.goto(URL);
  await d.fill('#setup-form [name=name]', 'D'); await d.fill('#setup-form [name=birthday]', '1992-05-05'); await d.click('#setup-form button[type=submit]');
  await d.waitForFunction(() => document.querySelector('#look-dialog').open);
  await d.click('#look-options .look-opt[data-style="doll"]');
  assert(await d.$$eval('#look-options .look-opt', (els) => els.map((e) => e.textContent).join()) === '像素女孩,經典,復古娃娃,長直髮,鮑伯頭,光頭,T 恤,運動服', '復古娃娃：髮型有長直髮、鮑伯頭、光頭，衣服有 T 恤、運動服');
  assert(await d.$eval('#look-preview .look', (e) => e.classList.contains('doll') && e.querySelectorAll('img').length === 3 && !!e.querySelector('img[src$="front/body_tee.webp"]')), '換裝畫面是正面、穿 T 恤的復古娃娃');
  await d.screenshot({ path: OUT + '/s6-doll-look.png' });
  await d.click('#look-save');
  await d.waitForTimeout(600);
  s = await st(d);
  assert(s.profile.look.style === 'doll' && s.profile.look.hair === 'long' && s.profile.look.cloth === 'tee', '存下：復古娃娃、長直髮、T 恤');
  assert(await d.$eval('.doll-arm_n image', (e) => e.getAttribute('href').endsWith('arm_n_tee.webp')), '房間裡娃娃的手穿著 T 恤的袖子');
  assert(await d.$eval('#scene', (e) => e.dataset.style) === 'doll', '房間裡是復古娃娃');
  assert(await d.$eval('#scene', (e) => e.dataset.pose) === 'front' && await d.$eval('.front-body', (e) => e.getAttribute('href').endsWith('front/body_tee.webp')), '站著的時候是正面');
  const db = await d.$eval('#scene svg', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await d.mouse.click(db.x + db.w * 0.3, db.y + db.h * 0.8);
  await d.waitForTimeout(400);
  assert(await d.$eval('#scene', (e) => e.dataset.pose) === 'side', '走路時轉成側面');
  const swing = await d.$eval('.doll-leg_n', (e) => e.getAttribute('transform'));
  assert(/rotate\(-?\d/.test(swing) && !/rotate\(-?0\.00 /.test(swing), '走路時腳會前後跨步');
  await d.screenshot({ path: OUT + '/s6-doll-walk.png' });
  await d.waitForFunction(() => ['leg_n', 'arm_n'].every((j) => /rotate\(-?0\.00 /.test(document.querySelector('.doll-' + j).getAttribute('transform'))), null, { timeout: 8000 });
  assert(await d.$eval('#scene', (e) => e.dataset.pose) === 'front', '停下來手腳回到站姿、轉回正面');
  await tab(d, 'me');
  assert(await d.$eval('#me-look .look', (e) => e.classList.contains('doll')), '「我」的個人卡也是復古娃娃');
  await d.close();

  // ===== 像素女孩：新使用者預設；站著正面、走路側面 4 格輪流 =====
  const x = await newPage(b);
  await x.goto(URL);
  await x.fill('#setup-form [name=name]', 'X'); await x.fill('#setup-form [name=birthday]', '1996-06-06'); await x.click('#setup-form button[type=submit]');
  await x.waitForFunction(() => document.querySelector('#look-dialog').open);
  assert(await x.$$eval('#look-options .look-opt', (els) => els.map((e) => e.textContent).join()) === '像素女孩,經典,復古娃娃', '像素女孩是預設（目前只有一款髮型和衣服，所以不顯示選項）');
  assert(await x.$eval('#look-preview .look', (e) => e.classList.contains('pixel') && e.querySelectorAll('img').length === 2 && !!e.querySelector('img[src$="pixel/head_bob_front.webp?v=2"]')), '換裝畫面是正面、妹妹頭的像素女孩');
  await x.click('#look-save');
  await x.waitForTimeout(600);
  s = await st(x);
  assert(s.profile.look.style === 'pixel' && s.profile.look.hair === 'bob' && s.profile.look.cloth === 'sweater', '存下：像素女孩、妹妹頭、日常毛衣');
  assert(await x.$eval('#scene', (e) => e.dataset.style === 'pixel' && e.dataset.pose === 'front') && await x.$eval('.pix-body.on', (e) => e.getAttribute('href').endsWith('pixel/body_sweater_front.webp?v=2')), '房間裡站著是正面的像素女孩');
  const xb = await x.$eval('#scene svg', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await x.mouse.click(xb.x + xb.w * 0.3, xb.y + xb.h * 0.8);
  const seen = new Set();
  let matched = true;
  for (let i = 0; i < 8; i++) {
    await x.waitForTimeout(80);
    seen.add(await x.$eval('.pix-body.on', (e) => e.getAttribute('href')));
    // 看得到的永遠只有一個身體＋一個頭，而且頭是側面時身體也是走路的側面
    matched = matched && await x.$eval('#scene', (e) => {
      const on = [...e.querySelectorAll('.pix-body, .pix-head')].filter((i) => i.getAttribute('opacity') === '1').map((i) => i.getAttribute('href'));
      return on.length === 2 && /head_\w+_side/.test(on[1]) === /body_\w+_walk\d/.test(on[0]);
    });
  }
  assert(matched, '走路時頭和身體的方向一致（不會側面的頭配正面的身體）');
  assert(await x.$eval('#scene', (e) => e.dataset.pose) === 'side' && await x.$eval('.pix-head.on', (e) => e.getAttribute('href').endsWith('head_bob_side.webp?v=2')), '走路時換成側面的頭');
  assert([...seen].filter((h) => /body_sweater_walk\d\.webp\?v=2$/.test(h)).length >= 2, '走路時身體一格一格換');
  await x.waitForFunction(() => document.querySelector('#scene').dataset.pose === 'front', null, { timeout: 8000 });
  assert(await x.$eval('.pix-body.on', (e) => e.getAttribute('href').endsWith('body_sweater_front.webp?v=2')), '走到了轉回正面');
  await x.close();

  // ===== 減少動態效果 =====
  const m = await newPage(b, { reducedMotion: 'reduce' });
  await m.goto(URL);
  await m.fill('#setup-form [name=name]', 'M'); await m.fill('#setup-form [name=birthday]', '1990-01-01'); await m.click('#setup-form button[type=submit]');
  await m.waitForFunction(() => document.querySelector('#look-dialog').open); await m.keyboard.press('Escape');
  assert(await m.$eval('#scene', (e) => !!e.querySelector('image[href*="room.webp"]') && e.querySelectorAll('#room-me image').length >= 6), '減少動態效果：房間照樣畫出來');

  console.log('errors', errors);
  await b.close();
})().catch(e => { console.log('💥', e.message.split('\n').slice(0,4).join(' | ')); console.log('errors', errors); process.exit(1); });
