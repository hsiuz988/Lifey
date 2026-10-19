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
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button');
  await p.waitForFunction(() => document.querySelector('#look-dialog').open);
  assert(true, '第一次設定完自動打開「選你的樣子」');
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
  assert(await p.$eval('#scene', (e) => !!e.querySelector('image[href$="room.webp"]')), '首頁是房間');
  // 點地板：小人走過去
  const before = await p.$eval('#room-me', (e) => e.getAttribute('transform'));
  const rb = await p.$eval('#scene svg', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.click(rb.x + rb.w * 0.7, rb.y + rb.h * 0.75);
  await p.waitForTimeout(1600);
  assert(await p.$eval('#room-me', (e) => e.getAttribute('transform')) !== before, '點地板，小人走過去');
  // 點小人：換樣子
  await p.$eval('#room-me', (e) => e.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert(await p.waitForSelector('#look-dialog[open]', { timeout: 3000 }).then(() => true, () => false), '點房間裡的自己可以換樣子');
  await p.keyboard.press('Escape');
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
  // 電視：出生那年的世界
  await p.click('#scene .hot[data-name="tv"]');
  await p.waitForSelector('#info-dialog[open]', { timeout: 8000 });
  await p.waitForSelector('#info-body .tv-list li');
  assert((await p.textContent('#info-body h3')).includes('1995'), '電視播出生那年（1995）的事');
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
  await tab(p, 'me').then(() => p.click('#open-settings'));
  await p.click('#weather-toggle');
  await p.waitForFunction(() => document.querySelector('#now-caption').textContent.includes('下雨'), null, { timeout: 10000 });
  assert((await p.textContent('#now-caption')).includes('🌧️ 22° 下雨'), '開啟天氣：說明列顯示 🌧️ 22° 下雨');
  assert(!(await p.$eval('#hud-weather', (e) => e.hidden)) && (await p.textContent('#hud-weather')).includes('22°'), '房間上方顯示天氣');
  assert(await p.$eval('#scene', e => e.dataset.weather) === 'rain', '場景切換成下雨');
  assert(p.apiCalls.length === 1 && p.apiCalls[0].includes('latitude=25.03') && p.apiCalls[0].includes('longitude=121.57'), '只送出四捨五入到小數兩位的位置');
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('lifey.weather')));
  assert(stored.lat === 25.03 && stored.lon === 121.57, '位置只存約略值在手機上');
  assert(!JSON.stringify(await st(p)).includes('25.03'), '位置不會寫進紀錄資料（也就不會同步上雲）');
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#now-caption').textContent.includes('下雨'));
  assert(p.apiCalls.length === 1, '30 分鐘內重開不會重複查天氣（用快取）');
  await tab(p, 'me').then(() => p.click('#open-settings'));
  await p.click('#weather-toggle');
  await p.waitForTimeout(200);
  assert(!(await p.textContent('#now-caption')).includes('下雨') && await p.$eval('#scene', e => e.dataset.weather) === 'none', '關閉天氣：回到預設場景');
  await p.click('#settings-dialog [data-close] >> nth=-1');

  // 沒給定位權限
  const q = await newPage(b);
  await q.goto(URL);
  await q.fill('#setup-form [name=name]', 'X'); await q.fill('#setup-form [name=birthday]', '1990-01-01'); await q.click('#setup-form button');
  await q.waitForFunction(() => document.querySelector('#look-dialog').open); await q.keyboard.press('Escape');
  await tab(q, 'me').then(() => q.click('#open-settings'));
  await q.click('#weather-toggle');
  assert(await q.waitForFunction(() => /定位/.test(document.querySelector('#toast').textContent), null, { timeout: 20000 }).then(() => true, () => false), '沒給定位權限：提示怎麼開啟');

  // ===== 舊資料：沒有選過樣子，用預設的 =====
  const r = await newPage(b);
  await r.goto(URL);
  await r.evaluate(() => new Promise(res => { const q = indexedDB.open('lifey', 1); q.onupgradeneeded = () => { q.result.createObjectStore('meta'); q.result.createObjectStore('photos', { keyPath: 'id' }); };
    q.onsuccess = () => { const tx = q.result.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ version: 2, profile: { name: 'Old', birthday: '1995-03-02', avatar: { skin: 1, hair: 3, style: 'long', glasses: true } }, years: {}, moments: [], achievements: {} }, 'state'); tx.oncomplete = res; }; }));
  await r.reload(); await r.waitForSelector('#app:not([hidden])');
  assert(await r.$eval('#scene', (e) => e.dataset.look) === 'ponytail/tee', '舊資料：房間裡是預設的樣子');

  // ===== 減少動態效果 =====
  const m = await newPage(b, { reducedMotion: 'reduce' });
  await m.goto(URL);
  await m.fill('#setup-form [name=name]', 'M'); await m.fill('#setup-form [name=birthday]', '1990-01-01'); await m.click('#setup-form button');
  await m.waitForFunction(() => document.querySelector('#look-dialog').open); await m.keyboard.press('Escape');
  assert(await m.$eval('#scene', (e) => !!e.querySelector('image[href$="room.webp"]') && e.querySelectorAll('#room-me image').length >= 6), '減少動態效果：房間照樣畫出來');

  console.log('errors', errors);
  await b.close();
})().catch(e => { console.log('💥', e.message.split('\n').slice(0,4).join(' | ')); console.log('errors', errors); process.exit(1); });
