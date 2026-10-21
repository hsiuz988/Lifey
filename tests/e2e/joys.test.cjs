const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 我的幸福：預設的 10 個、點一下收藏、每個小幸福一天只記一次（再點打開提問卡）、長按看月曆、補記和撤銷、
// 不能記未來、首頁的「今天 ♡ N 個小幸福」、舊資料同一天好幾筆只算一次、兩台手機合併
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
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button[type=submit]');
  await p.waitForFunction(() => document.querySelector('#look-dialog').open);
  await p.click('#look-save'); await p.waitForTimeout(600);

  // 一開始就有預設的 10 個小幸福，排成 2 排 × 5
  let s = await st(p);
  assert(s.joys.length === 10 && (await p.$$('#joy-row .joy-btn[data-joy]')).length === 10 && s.prefs.joysSeeded, '新使用者一進來就有 10 個常駐的小幸福');
  const cat = 'joy-sunset';
  assert(s.joys.find((j) => j.id === cat).title === '看見漂亮的風景', '預設的 id 固定（兩台手機同步不會變兩份）');
  await p.screenshot({ path: OUT + '/joys-home.png' });

  // 點一下就收藏，下面問一句；有寫就變成日記
  await p.click(`#joy-row [data-joy="${cat}"]`); await p.waitForTimeout(450);
  assert(await p.$eval(`#joy-row [data-joy="${cat}"]`, (e) => e.classList.contains('on')), '點一下就收藏，按鈕變成已收藏');
  assert(await p.isVisible('#joy-ask') && (await p.textContent('#joy-ask')).includes('收藏了！看見漂亮的風景') && (await p.getAttribute('.joy-ask-input', 'placeholder')).includes('風景'), '收藏後延伸提問');
  assert(await p.$eval('#joy-ask .btn.primary', (b) => b.disabled), '還沒寫字時「記成日記」按不下去');
  await p.fill('.joy-ask-input', '晚霞是粉紫色的'); await p.click('#joy-ask .btn >> text=記成日記'); await p.waitForTimeout(400);
  s = await st(p);
  assert(s.moments.length === 1 && s.moments[0].text === '晚霞是粉紫色的' && s.moments[0].joy === cat && s.moments[0].date === '2026-10-21' && !(await p.$('#joy-ask')), '寫了就存成今天的一篇日記，卡片收起來');
  await p.waitForTimeout(400);
  // 每個小幸福一天只記一次：已經亮的再點，重新打開提問卡（不會多記），可以取消今天的收藏
  await p.click(`#joy-row [data-joy="${cat}"]`); await p.waitForTimeout(300);
  s = await st(p);
  assert(s.joyLog.length === 1 && (await p.textContent('#joy-ask')).includes('今天已經收藏了 ✓') && await p.isVisible('#joy-ask .link-btn >> text=取消今天的收藏'), '已經亮的再點：不多記，重新打開提問卡，可以取消今天的收藏');
  await p.click('#joy-ask .joy-ask-x'); await p.waitForTimeout(150);
  const longPress = async (id) => {
    const box = await (await p.$(`#joy-row [data-joy="${id}"]`)).boundingBox();
    await p.mouse.move(box.x + 20, box.y + 20); await p.mouse.down(); await p.waitForTimeout(650); await p.mouse.up(); await p.waitForTimeout(200);
  };
  await longPress(cat);
  assert(await p.$eval('#joy-dialog', (d) => d.open) && (await p.textContent('#joy-dialog .joy-total')).includes('收藏了 1 天'), '長按打開詳情：收藏了 1 天');
  assert(await p.$eval('#joy-dialog .win-title', (e) => e.textContent) === '看見漂亮的風景', '視窗標題是小幸福的名字');

  // 月曆：補記 10/19、撤銷今天、未來不能點
  assert(await p.$eval('.joy-day[data-date="2026-10-22"]', (e) => e.disabled), '未來的日期不能點');
  await p.click('.joy-day[data-date="2026-10-19"]'); await p.waitForTimeout(200);
  s = await st(p);
  assert(s.joyLog.some((l) => l.date === '2026-10-19') && s.joyLog.length === 2, '點過去的日期可以補記');
  assert((await p.textContent('#joy-dialog .joy-total')).includes('收藏了 2 天') && (await p.textContent('#joy-dialog .joy-stats')).includes('2026/10/19'), '統計跟著更新（第一次收藏是 10/19）');
  await p.click('.joy-day[data-date="2026-10-21"]'); await p.waitForTimeout(200);
  s = await st(p);
  const removed = Object.keys(s.deleted).length;
  assert(s.joyLog.length === 1 && s.joyLog[0].date === '2026-10-19' && removed >= 1, '再點今天就撤銷（留下刪除紀錄，同步時不會復活）');
  await p.click('.joy-cal-head [aria-label="上個月"]'); await p.waitForTimeout(150);
  assert((await p.textContent('.joy-cal-head b')) === '2026 年 9 月', '可以切到上個月');
  assert(await p.$eval('.joy-cal-head [aria-label="下個月"]', (e) => !e.disabled), '可以再回到這個月');
  await p.screenshot({ path: OUT + '/joys-detail.png' });

  // 自己新增一個：只要名字和圖示，沒有「一天多次」可以選
  await p.click('#joy-dialog .btn >> text=全部小幸福'); await p.waitForTimeout(150);
  await p.click('#joy-dialog .btn >> text=新增小幸福'); await p.waitForTimeout(150);
  assert(!(await p.$('input[name="joy-mode"]')), '新增時不用選「怎麼記」');
  await p.fill('.joy-title-input', '喝到好喝的奶茶');
  await p.click('.joy-icon-opt[data-icon="coffee"]');
  await p.click('#joy-dialog .btn >> text=好了'); await p.waitForTimeout(200);
  s = await st(p);
  const tea = s.joys.find((j) => j.title === '喝到好喝的奶茶');
  assert(tea && tea.icon === 'coffee', '自己做一個：名字、圖示');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  assert(!(await p.$(`#joy-row [data-joy="${tea.id}"]`)), '首頁只放前 10 個，第 11 個在「全部」裡');
  const coffee = s.joys.find((j) => j.id === 'joy-coffee');
  // 點錯了可以復原
  await p.click(`#joy-row [data-joy="${coffee.id}"]`); await p.waitForTimeout(420);
  await p.click('#joy-ask .link-btn >> text=復原'); await p.waitForTimeout(300);
  assert(!(await st(p)).joyLog.some((l) => l.joyId === coffee.id) && !(await p.$('#joy-ask')), '收藏後按「復原」就取消這次');
  for (let i = 0; i < 3; i++) { await p.click(`#joy-row [data-joy="${coffee.id}"]`); await p.waitForTimeout(420); }
  s = await st(p);
  assert(s.joyLog.filter((l) => l.joyId === coffee.id).length === 1 && !(await p.$('#joy-row .joy-count')) && await p.isVisible(`#joy-row [data-joy="${coffee.id}"] .joy-check`), '「喝到好喝的」點三下也只記一次，按鈕是 ✓，沒有 ×3');
  assert(await p.textContent('#cy-joy-count') === '1' && (await p.textContent('.cy-joy-n')).includes('今天'), '首頁最上面是「今天 ♡ 1 個小幸福」');
  await p.click('#joy-ask .joy-ask-x'); await p.waitForTimeout(150);

  // 長按打開詳情，不會多記；月曆點一天就是有／沒有
  await longPress(coffee.id);
  s = await st(p);
  assert(await p.$eval('#joy-dialog', (d) => d.open) && s.joyLog.filter((l) => l.joyId === coffee.id).length === 1, '長按打開詳情，不會多記一次');
  assert(!(await p.$('.joy-adjust')), '月曆沒有加減次數');
  await p.click('.joy-day[data-date="2026-10-18"]'); await p.waitForTimeout(150);
  assert((await p.textContent('#joy-dialog .joy-total')).includes('收藏了 2 天') && (await p.textContent('#joy-dialog .joy-stats')).includes('2 天'), '補記其他天，用「天」算');

  // 舊版「一天多次」留下的同一天好幾筆：只算一次；今天的數字算的是幾個不同的小幸福
  const old = await p.evaluate(async () => {
    const { dayCounts, todayJoyCount } = await import('./joys.js');
    const log = [{ id: 'x1', joyId: 'j', date: '2026-10-20' }, { id: 'x2', joyId: 'j', date: '2026-10-20' }, { id: 'x3', joyId: 'j', date: '2026-10-21' }, { id: 'x4', joyId: 'k', date: '2026-10-21' }, { id: 'x5', joyId: 'k', date: '2026-10-21' }];
    return [dayCounts({ joyLog: log }, { id: 'j' }).size, [...dayCounts({ joyLog: log }, { id: 'j' }).values()].join(), todayJoyCount({ joyLog: log }, '2026-10-21')].join('|');
  });
  assert(old === '2|1,1|2', `舊資料同一天好幾筆只算一次、今天是 2 個小幸福（${old}）`);
  // 排序、收起來
  await p.click('#joy-dialog .btn >> text=全部小幸福'); await p.waitForTimeout(150);
  await p.click(`#joy-dialog [aria-label="喝到好喝的奶茶往前"]`); await p.waitForTimeout(150);
  assert(!!(await p.$(`#joy-row [data-joy="${tea.id}"]`)) && !(await p.$('#joy-row [data-joy="joy-hearts"]')), '排序：奶茶往前排進前 10，換它上首頁');
  await p.click('#joy-dialog .joy-item-main >> text=看見漂亮的風景'); await p.click('#joy-dialog .btn >> text=編輯'); await p.waitForTimeout(150);
  await p.click('#joy-dialog .btn >> text=先收起來'); await p.waitForTimeout(200);
  assert(!(await p.$(`#joy-row [data-joy="${cat}"]`)) && (await st(p)).joyLog.some((l) => l.joyId === cat), '收起來：首頁不顯示，紀錄還在');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.screenshot({ path: OUT + '/joys-home2.png' });

  // 「我的」選單也進得去
  await p.click('#tabbar [data-tab-btn="me"]');
  await p.click('.menu-item[data-open="joys"]'); await p.waitForTimeout(150);
  assert(await p.$eval('#joy-dialog', (d) => d.open) && (await p.textContent('#joy-dialog')).includes('收起來的（1）'), '「我的 → 我的幸福」打開全部，看得到收起來的');
  await p.keyboard.press('Escape');

  // 兩台手機同一天各點一次（還沒更新的舊版可能這樣），合併後兩筆都留著（畫面上只算一天）；刪掉的不會復活
  const merged = await p.evaluate(async () => {
    const { mergeStates } = await import('./cloud.js');
    const joy = { id: 'j1', title: '咖啡', icon: 'coffee', order: 0, updatedAt: '2026-10-01T00:00:00Z' };
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
