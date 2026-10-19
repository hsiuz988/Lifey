const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 用法：先在 public/ 開一個本機伺服器，再執行 tests/run.sh（詳見 tests/README.md）
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();
const FIXTURES = require('path').join(__dirname, '..', 'fixtures');

const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const errors = [];
const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
const canvasBusy = (p, sel) => p.$eval(sel, c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const s = new Set(); for (let i = 0; i < d.length; i += 400) s.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return s.size; });
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

  // ===== 新使用者：設定完自動打開捏人 =====
  const p = await newPage(b, { geolocation: { latitude: 25.03312, longitude: 121.56541 }, permissions: ['geolocation'] });
  await p.goto(URL);
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button');
  await p.waitForFunction(() => document.querySelector('#avatar-dialog').open);
  assert(true, '第一次設定完自動打開「捏你的小人」');
  assert(await canvasBusy(p, '#avatar-canvas') > 3, '預覽有畫出小人');
  await p.click('#avatar-tabs button:text-is("身體")');
  await p.click('#avatar-options button:has-text("男生")');
  await p.click('#avatar-tabs button:text-is("頭髮")');
  await p.click('#avatar-options button:has-text("平頭")');
  await p.click('#avatar-tabs button:text-is("衣服")');
  await p.click('#avatar-options button:has-text("洋裝")');
  await p.click('#avatar-tabs button:text-is("配件")');
  await p.click('#avatar-options .pic-btn:has-text("眼鏡")');
  assert(!(await p.$('#avatar-age')), '不再有預覽年紀拉桿');
  await p.screenshot({ path: OUT + '/s6-editor.png' });
  await p.click('#avatar-save');
  await p.waitForFunction(() => !document.querySelector('#avatar-dialog').open);
  let s = await st(p);
  const av = s.profile.avatar;
  assert(av.v === 2 && av.gender === 'male' && av.hairStyle === 'buzz' && av.outfit === 'dress' && av.glasses, '存下：男生、平頭、洋裝、眼鏡（自由搭配）');
  assert(await p.isHidden('#avatar-banner'), '存過之後不再顯示「來捏」提示');
  assert(await p.$eval('#id-avatar svg', e => e.querySelectorAll('rect').length > 50), '身分卡換成新小人');

  // 取消不會改到
  await p.click('#id-avatar');
  await p.click('#avatar-random');
  await p.keyboard.press('Escape');
  s = await st(p);
  assert(JSON.stringify(s.profile.avatar) === JSON.stringify(av), '按取消，隨機出來的不會存');

  // 場景
  assert(await canvasBusy(p, '#scene-canvas') > 15, '場景 canvas 有畫面');
  await p.$eval('#scene-canvas', c => c.scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
  const box = await p.$eval('#scene-canvas', c => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  let said = false;
  for (const ax of [62, 56, 68, 52, 74, 80]) {
    await p.mouse.click(box.x + ((ax + 8) / 160) * box.w, box.y + ((62 - 8) / 72) * box.h);
    if (await p.$eval('#scene-bubble', e => e.classList.contains('show'))) { said = true; break; }
  }
  assert(said, '點小人會冒出對話泡泡');
  console.log('   泡泡：', await p.textContent('#scene-bubble'));

  // 記一筆 → 慶祝動畫（不出錯）
  await p.click('#add-btn'); await p.fill('#moment-form [name=text]', '測試慶祝'); await p.click('#star-toggle'); await p.click('#moment-save');
  await p.waitForTimeout(800);
  assert(errors.length === 0, '記一筆後的慶祝動畫沒有錯誤');

  // 真實天氣
  await p.click('#open-settings');
  await p.click('#weather-toggle');
  await p.waitForFunction(() => document.querySelector('#now-caption').textContent.includes('下雨'), null, { timeout: 10000 });
  assert((await p.textContent('#now-caption')).includes('🌧️ 22° 下雨'), '開啟天氣：說明列顯示 🌧️ 22° 下雨');
  assert(await p.$eval('#scene', e => e.dataset.weather) === 'rain', '場景切換成下雨');
  assert(p.apiCalls.length === 1 && p.apiCalls[0].includes('latitude=25.03') && p.apiCalls[0].includes('longitude=121.57'), '只送出四捨五入到小數兩位的位置');
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('lifey.weather')));
  assert(stored.lat === 25.03 && stored.lon === 121.57, '位置只存約略值在手機上');
  assert(!JSON.stringify(await st(p)).includes('25.03'), '位置不會寫進紀錄資料（也就不會同步上雲）');
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#now-caption').textContent.includes('下雨'));
  assert(p.apiCalls.length === 1, '30 分鐘內重開不會重複查天氣（用快取）');
  await p.click('#open-settings');
  await p.click('#weather-toggle');
  await p.waitForTimeout(200);
  assert(!(await p.textContent('#now-caption')).includes('下雨') && await p.$eval('#scene', e => e.dataset.weather) === 'none', '關閉天氣：回到預設場景');
  await p.click('#settings-dialog [data-close] >> nth=-1');

  // 沒給定位權限
  const q = await newPage(b);
  await q.goto(URL);
  await q.fill('#setup-form [name=name]', 'X'); await q.fill('#setup-form [name=birthday]', '1990-01-01'); await q.click('#setup-form button');
  await q.waitForFunction(() => document.querySelector('#avatar-dialog').open); await q.keyboard.press('Escape');
  await q.click('#open-settings');
  await q.click('#weather-toggle');
  assert(await q.waitForFunction(() => /定位/.test(document.querySelector('#toast').textContent), null, { timeout: 20000 }).then(() => true, () => false), '沒給定位權限：提示怎麼開啟');

  // ===== 階段 3 的舊頭像 =====
  const r = await newPage(b);
  await r.goto(URL);
  await r.evaluate(() => new Promise(res => { const q = indexedDB.open('lifey', 1); q.onupgradeneeded = () => { q.result.createObjectStore('meta'); q.result.createObjectStore('photos', { keyPath: 'id' }); };
    q.onsuccess = () => { const tx = q.result.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ version: 2, profile: { name: 'Old', birthday: '1995-03-02', avatar: { skin: 1, hair: 3, style: 'long', glasses: true } }, years: {}, moments: [], achievements: {} }, 'state'); tx.oncomplete = res; }; }));
  await r.reload(); await r.waitForSelector('#app:not([hidden])');
  assert(!(await r.isHidden('#avatar-banner')), '舊頭像：顯示「小人可以自己捏了」提示');
  await r.click('#avatar-banner-btn');
  await r.click('#avatar-tabs button:text-is("頭髮")');
  assert(await r.$eval('#avatar-options button.on', e => e.textContent) === '長直', '舊的長髮沿用');
  await r.click('#avatar-tabs button:text-is("配件")');
  assert(await r.$eval('#avatar-options .pic-btn:has-text("眼鏡")', (e) => e.classList.contains('on')), '舊的眼鏡沿用');

  // ===== 減少動態效果 =====
  const m = await newPage(b, { reducedMotion: 'reduce' });
  await m.goto(URL);
  await m.fill('#setup-form [name=name]', 'M'); await m.fill('#setup-form [name=birthday]', '1990-01-01'); await m.click('#setup-form button');
  await m.waitForFunction(() => document.querySelector('#avatar-dialog').open); await m.keyboard.press('Escape');
  assert(await canvasBusy(m, '#scene-canvas') > 15, '減少動態效果：仍然畫出靜態場景');

  console.log('errors', errors);
  await b.close();
})().catch(e => { console.log('💥', e.message.split('\n').slice(0,4).join(' | ')); console.log('errors', errors); process.exit(1); });
