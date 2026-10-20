const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 生日用年／月／日下拉選單、捏小人的抽屜可以捲動且沒有取消鈕
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const errors = [];
const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 640 } })).newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL);

  // 生日：選年、月、日就好，不用開日期面板
  const sel = (n) => `#setup-form .bday select >> nth=${n}`;
  assert(await p.isVisible(sel(0)) && !(await p.isVisible('#setup-form [name=birthday]').then((v) => v && false)), '生日是三個下拉選單');
  await p.fill('#setup-form [name=name]', 'Hsiu');
  await p.selectOption(sel(0), '1998');
  await p.selectOption(sel(1), '2');
  const days = await p.$$eval(`#setup-form .bday select:nth-child(3) option`, (o) => o.length - 1);
  assert(days === 28, `1998 年 2 月只有 28 天（${days}）`);
  await p.selectOption(sel(2), '14');
  assert((await p.inputValue('#setup-form [name=birthday]')) === '1998-02-14', '選完年月日就填好生日');
  await p.click('#setup-form button');
  await p.waitForSelector('#look-dialog[open]');
  assert((await st(p)).profile.birthday === '1998-02-14', '生日存起來');

  // 選樣子：沒有取消鈕，抽屜內容太長時捲抽屜、不捲後面
  assert(!(await p.$('#look-dialog [data-close]')), '選樣子沒有取消按鈕');
  const dims = await p.$eval('#look-dialog', (d) => ({ sh: d.scrollHeight, ch: d.clientHeight }));
  if (dims.sh > dims.ch) {
    await p.mouse.move(195, 500); await p.mouse.wheel(0, 600); await p.waitForTimeout(300);
    assert((await p.$eval('#look-dialog', (d) => d.scrollTop)) > 0, '在抽屜上滑動會捲抽屜');
  }
  assert((await p.evaluate(() => window.scrollY)) === 0, '後面的頁面不會跟著捲');
  await p.click('#look-save');
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));

  // 設定裡改生日：選單會帶出目前的生日
  await tab(p, 'me').then(() => p.click('#me-profile'));
  await p.evaluate(() => { document.querySelectorAll('#settings-dialog .settings-page').forEach((el) => { el.hidden = el.dataset.page !== 'profile'; }); });
  const shown = await p.$$eval('#profile-form .bday select', (s) => s.map((x) => x.value));
  assert(shown.join('-') === '1998-2-14', `設定裡的生日選單帶出 1998/2/14（${shown.join('-')}）`);

  assert(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
  await b.close();
})().catch((e) => { console.log('💥', e); process.exitCode = 1; process.exit(1); });
