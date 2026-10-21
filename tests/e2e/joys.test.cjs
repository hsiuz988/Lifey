const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 累積幸福：從範例加入、點一下收藏、每天一次不會重複、一天多次、長按看月曆、補記和撤銷、不能記未來、
// 模式切換、兩台手機合併不掉次數、備份匯入
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();

const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
const errors = [];

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); await require('./adapt.cjs')(p);
  p.on('pageerror', (e) => errors.push(e.message));
  let answer = true; p.on('dialog', (d) => (answer ? d.accept() : d.dismiss()));
  await p.clock.install({ time: new Date('2026-10-21T10:00:00') });
  await p.goto(URL);
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button');
  await p.waitForFunction(() => document.querySelector('#look-dialog').open);
  await p.click('#look-save'); await p.waitForTimeout(600);

  // 空的時候是範例
  assert(await p.isVisible('#joy-row .joy-chip >> text=和貓一起睡'), '一開始首頁列出小幸福範例');
  await p.click('#joy-row .joy-chip >> text=和貓一起睡'); await p.waitForTimeout(150);
  let s = await st(p);
  assert(s.joys.length === 1 && s.joys[0].title === '和貓一起睡' && s.joys[0].mode === 'once', '點範例就加入（每天一次）');
  const cat = s.joys[0].id;
  await p.screenshot({ path: OUT + '/joys-home.png' });

  // 點一下收藏；同一天再點不會多算，而是打開詳情
  await p.click(`#joy-row [data-joy="${cat}"]`); await p.waitForTimeout(450);
  assert(await p.$eval(`#joy-row [data-joy="${cat}"]`, (e) => e.classList.contains('on')), '點一下就收藏，按鈕變成已收藏');
  await p.waitForTimeout(400);
  await p.click(`#joy-row [data-joy="${cat}"]`); await p.waitForTimeout(300);
  s = await st(p);
  assert(s.joyLog.length === 1, '每天一次：同一天再點不會多記');
  assert(await p.$eval('#joy-dialog', (d) => d.open) && (await p.textContent('#joy-dialog .joy-total')).includes('累積 1 天'), '再點一次打開詳情：累積 1 天');
  assert(await p.$eval('#joy-dialog .win-title', (e) => e.textContent) === '和貓一起睡', '視窗標題是小幸福的名字');

  // 月曆：補記 10/19、撤銷今天、未來不能點
  assert(await p.$eval('.joy-day[data-date="2026-10-22"]', (e) => e.disabled), '未來的日期不能點');
  await p.click('.joy-day[data-date="2026-10-19"]'); await p.waitForTimeout(200);
  s = await st(p);
  assert(s.joyLog.some((l) => l.date === '2026-10-19') && s.joyLog.length === 2, '點過去的日期可以補記');
  assert((await p.textContent('#joy-dialog .joy-total')).includes('累積 2 天') && (await p.textContent('#joy-dialog .joy-stats')).includes('2026/10/19'), '統計跟著更新（第一次收藏是 10/19）');
  await p.click('.joy-day[data-date="2026-10-21"]'); await p.waitForTimeout(200);
  s = await st(p);
  const removed = Object.keys(s.deleted).length;
  assert(s.joyLog.length === 1 && s.joyLog[0].date === '2026-10-19' && removed >= 1, '再點今天就撤銷（留下刪除紀錄，同步時不會復活）');
  await p.click('.joy-cal-head [aria-label="上個月"]'); await p.waitForTimeout(150);
  assert((await p.textContent('.joy-cal-head b')) === '2026 年 9 月', '可以切到上個月');
  assert(await p.$eval('.joy-cal-head [aria-label="下個月"]', (e) => !e.disabled), '可以再回到這個月');
  await p.screenshot({ path: OUT + '/joys-detail.png' });

  // 自己新增一個「一天可以很多次」的
  await p.click('#joy-dialog .btn >> text=全部小幸福'); await p.waitForTimeout(150);
  await p.click('#joy-dialog .btn >> text=新增小幸福'); await p.waitForTimeout(150);
  await p.fill('.joy-title-input', '喝到好喝的奶茶');
  await p.click('.joy-icon-opt[data-icon="coffee"]');
  await p.check('input[name="joy-mode"][value="many"]');
  await p.click('#joy-dialog .btn >> text=好了'); await p.waitForTimeout(200);
  s = await st(p);
  const tea = s.joys.find((j) => j.title === '喝到好喝的奶茶');
  assert(tea && tea.mode === 'many' && tea.icon === 'coffee', '自己做一個：名字、圖示、一天多次');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  for (let i = 0; i < 3; i++) { await p.click(`#joy-row [data-joy="${tea.id}"]`); await p.waitForTimeout(420); }
  s = await st(p);
  assert(s.joyLog.filter((l) => l.joyId === tea.id).length === 3 && (await p.textContent(`#joy-row [data-joy="${tea.id}"] .joy-count`)) === '×3', '一天多次：點三下就是 3 次，按鈕顯示 ×3');
  // 手指抖一下（很快點兩下）只算一次
  await p.dblclick(`#joy-row [data-joy="${tea.id}"]`); await p.waitForTimeout(450);
  s = await st(p);
  assert(s.joyLog.filter((l) => l.joyId === tea.id).length === 4, '連點兩下太快只算一次');

  // 長按打開詳情，調整次數
  const box = await (await p.$(`#joy-row [data-joy="${tea.id}"]`)).boundingBox();
  await p.mouse.move(box.x + 20, box.y + 20); await p.mouse.down(); await p.waitForTimeout(650); await p.mouse.up(); await p.waitForTimeout(200);
  s = await st(p);
  assert(await p.$eval('#joy-dialog', (d) => d.open) && s.joyLog.filter((l) => l.joyId === tea.id).length === 4, '長按打開詳情，不會多記一次');
  await p.click('.joy-day[data-date="2026-10-21"]'); await p.waitForTimeout(150);
  assert((await p.textContent('.joy-adjust-n')) === '4 次', '一天多次：點日期出現加減');
  await p.click('.joy-adjust [aria-label="少一次"]'); await p.waitForTimeout(150);
  assert((await p.textContent('.joy-adjust-n')) === '3 次' && (await st(p)).joyLog.filter((l) => l.joyId === tea.id).length === 3, '按 − 少一次');
  await p.click('.joy-day[data-date="2026-10-18"]'); await p.waitForTimeout(150);
  await p.click('.joy-adjust [aria-label="多一次"]'); await p.waitForTimeout(150);
  assert((await p.textContent('#joy-dialog .joy-total')).includes('累積 4 次'), '補記其他天的次數，累積跟著加');

  // 改成每天一次：有一天記了 3 次，要先確認；按取消不改
  await p.click('#joy-dialog .btn >> text=編輯'); await p.waitForTimeout(150);
  await p.check('input[name="joy-mode"][value="once"]');
  answer = false; await p.click('#joy-dialog .btn >> text=好了'); await p.waitForTimeout(150);
  s = await st(p);
  assert(s.joys.find((j) => j.id === tea.id).mode === 'many' && s.joyLog.filter((l) => l.joyId === tea.id).length === 4, '改成每天一次要先確認，取消就不動資料');
  answer = true; await p.click('#joy-dialog .btn >> text=好了'); await p.waitForTimeout(200);
  s = await st(p);
  assert(s.joys.find((j) => j.id === tea.id).mode === 'once' && s.joyLog.filter((l) => l.joyId === tea.id).length === 2, '確認後每天只留一次（10/21、10/18 各一）');

  // 排序、收起來
  await p.click('#joy-dialog .btn >> text=全部小幸福'); await p.waitForTimeout(150);
  await p.click(`#joy-dialog [aria-label="喝到好喝的奶茶往前"]`); await p.waitForTimeout(150);
  assert(await p.$eval('#joy-row .joy-btn', (e) => e.textContent.includes('奶茶')), '排序：往前後首頁第一顆換成奶茶');
  await p.click('#joy-dialog .joy-item-main >> text=和貓一起睡'); await p.click('#joy-dialog .btn >> text=編輯'); await p.waitForTimeout(150);
  await p.click('#joy-dialog .btn >> text=先收起來'); await p.waitForTimeout(200);
  assert(!(await p.$(`#joy-row [data-joy="${cat}"]`)) && (await st(p)).joyLog.some((l) => l.joyId === cat), '收起來：首頁不顯示，紀錄還在');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.screenshot({ path: OUT + '/joys-home2.png' });

  // 「我的」選單也進得去
  await p.click('#tabbar [data-tab-btn="me"]');
  await p.click('.menu-item[data-open="joys"]'); await p.waitForTimeout(150);
  assert(await p.$eval('#joy-dialog', (d) => d.open) && (await p.textContent('#joy-dialog')).includes('收起來的（1）'), '「我的 → 累積幸福」打開全部，看得到收起來的');
  await p.keyboard.press('Escape');

  // 兩台手機同一天各點一次奶茶（改回一天多次的情境），合併後兩次都留下；刪掉的不會復活
  const merged = await p.evaluate(async () => {
    const { mergeStates } = await import('./cloud.js');
    const joy = { id: 'j1', title: '咖啡', icon: 'coffee', mode: 'many', order: 0, updatedAt: '2026-10-01T00:00:00Z' };
    const a = { moments: [], deleted: { gone: '2026-10-21T09:00:00Z' }, joys: [joy], joyLog: [{ id: 'a1', joyId: 'j1', date: '2026-10-21', updatedAt: '2026-10-21T08:00:00Z' }] };
    const bb = { moments: [], deleted: {}, joys: [joy], joyLog: [{ id: 'b1', joyId: 'j1', date: '2026-10-21', updatedAt: '2026-10-21T08:30:00Z' }, { id: 'gone', joyId: 'j1', date: '2026-10-20', updatedAt: '2026-10-20T08:00:00Z' }] };
    const m = mergeStates(a, bb);
    return m.joyLog.map((l) => l.id).sort().join();
  });
  assert(merged === 'a1,b1', '兩台手機同一天各記一次，合併後兩次都在；另一台刪掉的不會復活');

  console.log('errors', errors);
  assert(errors.length === 0, '沒有錯誤');
  await b.close();
})().catch((e) => { console.log('💥', e.message); process.exitCode = 1; process.exit(1); });
