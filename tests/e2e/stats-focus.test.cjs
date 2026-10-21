const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 用法：先在 public/ 開一個本機伺服器，再執行 tests/run.sh（詳見 tests/README.md）
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();
const FIXTURES = require('path').join(__dirname, '..', 'fixtures');
const S = OUT;
const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
// 地圖點格子會打開「這一歲」抽屜；要看日記再按「看這一歲的日記」
const openAge = async (p, sel) => { await tab(p, 'map'); await p.click(sel); await p.click('#year-view'); await p.waitForTimeout(100); };
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); await require('./adapt.cjs')(p);
  const errors = []; const toasts = [];
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
  await p.exposeFunction('logToast', t => toasts.push(t));
  await p.addInitScript(() => { new MutationObserver(() => { const t = document.querySelector('#toast'); if (t && !t.hidden) window.logToast(t.textContent); }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true }); });
  const st = () => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
  const stats = () => p.$$eval('#stat-bars .stat', els => Object.fromEntries(els.map(e => [e.querySelector('.stat-label').textContent.replace(' ★', ''), +e.querySelector('.stat-num').textContent])));

  // 舊使用者：已有資料但沒有成就紀錄 → 安靜補上，不跳通知
  await p.goto(URL);
  await p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey', 1); q.onupgradeneeded = () => { q.result.createObjectStore('meta'); q.result.createObjectStore('photos', { keyPath: 'id' }); };
    q.onsuccess = () => { const tx = q.result.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ version: 2, profile: { name: 'Hsiu', birthday: '1995-03-02' }, years: {}, lastExportAt: null,
      moments: [{ id: 'a', date: '2026-05-01', text: '花蓮', mood: 5, tags: ['旅行', '朋友'], photoIds: [], starred: true, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' }] }, 'state'); tx.oncomplete = r; }; }));
  await p.reload(); await p.waitForSelector('#app:not([hidden])'); await tab(p, 'me'); await p.waitForSelector('#stat-bars .stat');
  await p.waitForTimeout(300);
  let s = await st();
  assert(s.achievements && s.achievements.first && s.achievements.star, '舊資料自動補上已達成的成就');
  assert(!toasts.some(t => t.includes('解鎖')), '補上時不跳通知');

  // 狀態
  let v = await stats();
  console.log('   今年狀態', v);
  assert(v['人際關係'] === 49 && v['健康'] === 20 && v['知識'] === 20, '人際：朋友 ☆ 算兩倍（2 點）→ 49；其他 20');
  assert(v['幸福'] === 94, '幸福：心情 😄 (90) + 旅行 ☆ 加分 (4) → 94');
  assert(await p.textContent('#now-caption') === '31 歲 · 出社會 · 今年記了 1 則', '今年說明文字');
  assert(await p.$eval('#scene', (e) => !!e.querySelector('svg image[href*="room.webp"]') && e.querySelectorAll('#room-me image').length >= 6), '首頁的房間和小人有畫出來');

  // 新增健康 → 解鎖成就通知 + 健康上升
  await p.click('#add-btn');
  await p.fill('#moment-form [name=text]', '去跑步');
  await p.click('#tag-picker button:text-is("運動")');
  await p.click('#moment-save');
  await p.waitForFunction(() => !document.querySelector('#moment-dialog').open);
  v = await stats();
  assert(v['健康'] === 36, '記一筆運動，健康 20 → 36');

  // 重心
  await tab(p, 'me').then(() => p.click('#focus-chips button:text-is("健康")'));
  await p.waitForFunction(() => document.querySelector('#focus-note').textContent.includes('1 則'));
  assert((await p.textContent('#focus-note')).includes('今年已經記了 1 則跟「健康」有關的事'), '重心進度');
  assert(await p.$eval('#stat-bars .stat.focus .stat-label', e => e.textContent) === '健康 ★', '重心那一項標 ★');
  await p.waitForTimeout(300);
  assert(!toasts.some(t => t.includes('解鎖')) && (await st(p)).achievements.focus, '成就隱藏：解鎖「有方向的一年」不跳通知，但有記錄');
  s = await st();
  assert(s.years['31'].focus === 'health', '重心存在今年');

  // 一句話與重心共存
  await openAge(p, '#life-map .cell.now'); await tab(p, 'memories').then(() => p.click('#timeline .year-title-btn'));
  await p.fill('#year-form [name=summary]', '開始寫人生紀錄');
  await p.click('#year-form button[type=submit]');
  await p.waitForFunction(() => !document.querySelector('#year-dialog').open);
  s = await st();
  assert(s.years['31'].focus === 'health' && s.years['31'].title === '開始寫人生紀錄', '寫一句話不會蓋掉重心');
  await openAge(p, '#life-map .cell.now'); await tab(p, 'memories').then(() => p.click('#timeline .year-title-btn'));
  await p.fill('#year-form [name=summary]', '');
  await p.click('#year-form button[type=submit]');
  s = await st();
  assert(s.years['31'].focus === 'health' && !s.years['31'].title, '清掉一句話時重心還在');
  assert(await p.textContent('#map-summary').then(t => t.startsWith('已記錄 1 /')), '只有重心的年份不算「已記錄」');
  // 年歲對話框顯示狀態
  await openAge(p, '#life-map .cell.now'); await tab(p, 'memories').then(() => p.click('#timeline .year-title-btn'));
  assert((await p.$$('#year-stats .stat')).length === 4, '年歲對話框顯示四項狀態');
  await p.click('#year-dialog [data-close]');

  // 成就面板
  const count = await p.textContent('#ach-count');
  console.log('   ', count);
  assert(count === '已解鎖 3 / 17', '已解鎖 3 個：第一步、值得記住、有方向的一年');

  // 改名字不會弄丟頭像
  await tab(p, 'me').then(() => p.click('#me-profile'));
  await p.fill('#profile-form [name=name]', 'Hsiu Z');
  await p.click('#profile-form button[type=submit]');
  await p.waitForTimeout(200);
  s = await st();
  assert(s.profile.name === 'Hsiu Z' && !(await p.$eval('#settings-dialog', d => d.open)), '改名字，存了就關掉回到「我的」');
  await p.screenshot({ path: S + '/s4-main.png', fullPage: true });
  console.log('errors', errors);
  await b.close();
})();
