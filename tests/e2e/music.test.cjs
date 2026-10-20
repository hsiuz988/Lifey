const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 背景音樂：預設關、房間的 ♪ 和設定裡的開關、記住開關、切到背景會暫停、檔案壞掉會關回去
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();
// 真的音樂檔比較大，測試用一段靜音代替
const SONG = require('path').join(__dirname, '..', 'fixtures', 'silence.mp3');

const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const errors = [];
// 把 music.js 建立的 Audio 留在 window 上，測試才看得到它有沒有在播
const spy = () => { const A = window.Audio; window.Audio = function (src) { const a = new A(src); window.__music = a; return a; }; };
const playing = (p) => p.evaluate(() => !!window.__music && !window.__music.paused);
const hide = (p, hidden) => p.evaluate((h) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(spy);
  await ctx.route('**/music/room.mp3', (r) => r.fulfill({ path: SONG, contentType: 'audio/mpeg' }));
  const p = await ctx.newPage(); await require('./adapt.cjs')(p);
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(URL);
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button');
  await p.waitForFunction(() => document.querySelector('#look-dialog').open);
  await p.click('#look-save');
  await p.waitForTimeout(600);

  assert(!(await playing(p)), '預設不播音樂');
  assert(await p.$eval('#music-btn', (e) => e.getAttribute('aria-pressed') === 'false'), '♪ 按鈕預設是關的');

  await p.click('#music-btn');
  await p.waitForTimeout(300);
  assert(await playing(p), '按 ♪ 開始播');
  assert(await p.$eval('#music-btn', (e) => e.classList.contains('on')), '♪ 變成開啟的樣子');
  assert(await p.evaluate(() => window.__music.loop), '音樂會循環');
  await p.screenshot({ path: OUT + '/music-on.png' });

  await hide(p, true);
  await p.waitForTimeout(1200);
  assert(!(await playing(p)), '切到背景時暫停');
  await hide(p, false);
  await p.waitForTimeout(300);
  assert(await playing(p), '回到前景接著播');

  // 重新打開：記得是開的，點一下畫面才開始播
  await p.reload();
  await p.waitForSelector('#app:not([hidden])');
  assert(!(await playing(p)), '重新打開時不會自己出聲');
  await p.click('#quick-open'); await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  assert(await playing(p), '點一下畫面就接著播（記得上次是開的）');

  // 設定裡的開關
  await tab(p, 'me'); await p.click('#open-settings');
  await p.evaluate(() => document.querySelector('#settings-dialog .settings-page[data-page="other"]').hidden = false);
  assert(await p.$eval('#pref-music', (e) => e.checked), '設定裡的開關也是開的');
  await p.click('#pref-music');
  await p.waitForTimeout(1200);
  assert(!(await playing(p)), '設定裡關掉就停');
  assert(await p.$eval('#music-btn', (e) => e.getAttribute('aria-pressed') === 'false'), '房間的 ♪ 跟著變成關');

  // 音樂檔抓不到：關回去並提示
  const p2 = await ctx.newPage(); await require('./adapt.cjs')(p2);
  await p2.route('**/music/room.mp3', (r) => r.fulfill({ status: 404, body: '' }));
  await p2.goto(URL);
  await p2.waitForSelector('#app:not([hidden])');
  await p2.click('#music-btn');
  await p2.waitForTimeout(800);
  assert(await p2.$eval('#music-btn', (e) => e.getAttribute('aria-pressed') === 'false'), '音樂檔抓不到時開關會關回去');
  assert(await p2.$eval('#toast', (e) => !e.hidden && e.textContent.includes('音樂')), '並跳出提示');

  assert(errors.length === 0, '沒有 JS 錯誤 ' + errors.join(' | '));
  await b.close();
})().catch((e) => { console.log('💥', e); process.exit(1); });
