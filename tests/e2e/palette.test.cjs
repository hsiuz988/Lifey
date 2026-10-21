const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 配色：預設長春花、在「我 → 外觀與其他」換、重新整理還在、開機前就套用
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL);
  const v = (name) => p.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
  assert(!(await p.evaluate(() => document.documentElement.dataset.palette)) && (await v('--cy-aqua')) === '#5470dc', '預設是長春花');
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button[type=submit]');
  await p.waitForFunction(() => document.querySelector('#look-dialog').open); await p.click('#look-save'); await p.waitForTimeout(300);
  await tab(p, 'me'); await p.click('[data-open="other"]'); await p.waitForTimeout(200);
  assert((await p.$$('#palette-chips .palette-chip')).length === 6, '有六套配色可以選');
  assert(await p.$eval('#palette-chips [data-palette="periwinkle"]', e => e.classList.contains('on')), '長春花是選中的');
  await p.click('#palette-chips [data-palette="mango"]');
  assert((await p.evaluate(() => document.documentElement.dataset.palette)) === 'mango' && (await v('--cy-aqua')) === '#e2762e', '點芒果布丁馬上換色');
  assert(await p.$eval('#palette-chips [data-palette="mango"]', e => e.getAttribute('aria-pressed') === 'true'), '芒果布丁變成選中');
  await p.reload(); await p.waitForTimeout(300);
  assert((await p.evaluate(() => document.documentElement.dataset.palette)) === 'mango', '重新整理後還是芒果布丁');
  await tab(p, 'me'); await p.click('[data-open="other"]'); await p.waitForTimeout(200);
  await p.click('#palette-chips [data-palette="periwinkle"]');
  assert(!(await p.evaluate(() => document.documentElement.dataset.palette)) && (await v('--cy-aqua')) === '#5470dc', '換回長春花');
  assert(errors.length === 0, '沒有錯誤 ' + errors.join(' | '));
  await b.close();
})();
