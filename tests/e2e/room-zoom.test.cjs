const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 小窩右下角的放大鈕：房間鋪滿畫面、還是可以點家具、關掉回原樣
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();

const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const errors = [];
const roomW = (p) => p.$eval('#scene svg', (e) => e.getBoundingClientRect().width);

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await require('./adapt.cjs')(p);
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(URL);
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button');
  await p.waitForFunction(() => document.querySelector('#look-dialog').open);
  await p.click('#look-save');
  await p.waitForTimeout(600);

  const small = await roomW(p);
  await p.click('#room-zoom');
  await p.waitForTimeout(200);
  const big = await roomW(p);
  assert(big > small * 1.6, `全畫面時房間變大（${Math.round(small)} → ${Math.round(big)}px）`);
  const sc = await p.$eval('.home-page .room-box', (e) => ({ left: e.scrollLeft, max: e.scrollWidth - e.clientWidth }));
  assert(sc.max > 0 && Math.abs(sc.left - sc.max / 2) < 2, '手機直向可以左右滑，一開始在中間');
  const box = await p.$eval('.home-page .room-box', (e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, top: r.top }; });
  assert(box.top === 0 && box.w === 390 && box.h === 844, '房間鋪滿整個畫面');
  assert(await p.$eval('#room-zoom', (e) => e.getAttribute('aria-pressed') === 'true'), '按鈕變成「離開全畫面」');
  await p.screenshot({ path: OUT + '/room-full.png' });

  // 全畫面時還是能點家具：日記本打開記一筆
  await p.click('#scene .hot[data-name="diary"]');
  await p.waitForTimeout(1800);
  assert(await p.$eval('#moment-dialog', (e) => e.open), '全畫面時點日記本會打開記一筆');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  assert(await p.evaluate(() => document.documentElement.classList.contains('room-full')), '關掉記一筆後還在全畫面');

  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  assert(!(await p.evaluate(() => document.documentElement.classList.contains('room-full'))), '按 Esc 離開全畫面');
  await p.click('#room-zoom'); await p.waitForTimeout(150);
  await p.click('#room-zoom'); await p.waitForTimeout(150);
  assert(Math.abs(await roomW(p) - small) < 1, '再按一次回到原本大小');

  // 寬螢幕：整間放進畫面，不用滑
  await p.setViewportSize({ width: 1280, height: 800 });
  await p.click('#room-zoom'); await p.waitForTimeout(150);
  const wide = await p.$eval('.home-page .room-box', (e) => ({ over: e.scrollWidth - e.clientWidth, h: e.querySelector('svg').getBoundingClientRect().height }));
  assert(wide.over <= 0 && Math.abs(wide.h - 800) < 2, '寬螢幕時整間剛好放滿高度，不用滑');
  await p.screenshot({ path: OUT + '/room-full-wide.png' });
  await p.click('#room-zoom'); await p.waitForTimeout(150);
  await p.setViewportSize({ width: 390, height: 844 });

  // 全畫面時切到別的分頁：自動離開
  await p.click('#room-zoom'); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('#tabbar [data-tab-btn="me"]').click());
  await p.waitForTimeout(150);
  assert(!(await p.evaluate(() => document.documentElement.classList.contains('room-full'))), '換分頁時自動離開全畫面');
  await tab(p, 'home');

  assert(errors.length === 0, '沒有 JS 錯誤 ' + errors.join(' | '));
  await b.close();
})().catch((e) => { console.log('💥', e); process.exit(1); });
