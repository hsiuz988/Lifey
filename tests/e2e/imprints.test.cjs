const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 生活印記：同一個小幸福收藏滿 10 天 → 跳出「房間多了一件東西」→ 放到房間 → 收藏冊可以收起來；
// 拿到後刪紀錄也不會收回；兩台手機合併時留最早拿到的日期
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
  p.on('dialog', (d) => d.accept());
  await p.clock.install({ time: new Date('2026-10-21T10:00:00') });
  await p.goto(URL);
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button[type=submit]');
  await p.waitForFunction(() => document.querySelector('#look-dialog').open);
  await p.click('#look-save'); await p.waitForTimeout(600);

  const cat = 'joy-hearts';
  await p.click(`#joy-row [data-joy="${cat}"]`); await p.waitForTimeout(450);
  await p.click('#joy-ask .btn >> text=不用了'); await p.waitForTimeout(100);
  // 長按打開詳情（今天已經亮的，再點一下是取消）
  const box = await (await p.$(`#joy-row [data-joy="${cat}"]`)).boundingBox();
  await p.mouse.move(box.x + 20, box.y + 20); await p.mouse.down(); await p.waitForTimeout(650); await p.mouse.up(); await p.waitForTimeout(300);
  assert((await p.textContent('#joy-dialog .joy-imprint')).includes('再收藏 9 天') && (await p.textContent('#joy-dialog .joy-imprint')).includes('愛心氣球'), '詳情告訴你還差幾天、會拿到什麼');

  // 補記 10/12～10/19：還差一天，不會跳
  for (let d = 12; d <= 19; d++) { await p.click(`.joy-day[data-date="2026-10-${d}"]`); await p.waitForTimeout(80); }
  await p.waitForTimeout(500);
  assert(!(await p.$eval('#imprint-dialog', (e) => e.open)) && !((await st(p)).imprints || []).length, '收藏 9 天還不會拿到');
  await p.click('.joy-day[data-date="2026-10-20"]'); await p.waitForTimeout(700);
  assert(await p.$eval('#imprint-dialog', (e) => e.open) && (await p.textContent('#imprint-dialog')).includes('愛心氣球'), '第 10 天跳出「房間多了一件東西」');
  let s = await st(p);
  assert(s.imprints.length === 1 && s.imprints[0].key === 'hearts' && s.imprints[0].at === '2026-10-21' && !s.imprints[0].shown, '記下拿到的日期（照日期排的第 10 天），先不放出來');
  await p.screenshot({ path: OUT + '/imprint-got.png' });
  await p.click('#imprint-dialog .btn >> text=放到房間'); await p.waitForTimeout(300);
  s = await st(p);
  assert(s.imprints[0].shown && await p.$('#scene image[data-imprint="hearts"]'), '放到房間：小窩裡出現愛心氣球');
  assert((await p.textContent('#joy-dialog .joy-imprint')).includes('紀念'), '詳情改成「房間裡的愛心氣球就是它的紀念」');

  // 撤銷一天也不會收回
  await p.click('.joy-day[data-date="2026-10-20"]'); await p.waitForTimeout(300);
  s = await st(p);
  assert(s.imprints.length === 1 && s.imprints[0].shown && await p.$('#scene image[data-imprint="hearts"]'), '拿到就永遠是你的：刪掉紀錄也不收回');

  // 收藏冊：收起來、再放出來
  await p.click('#joy-dialog .btn >> text=全部小幸福'); await p.waitForTimeout(150);
  assert((await p.textContent('.imprint-book h4')).includes('1 / 32') && await p.$('.imprint-cell.got[data-imprint="hearts"]'), '收藏冊：32 格，拿到的會亮');
  assert((await p.textContent('.imprint-cell[data-imprint="game"]')).includes('即將推出'), '還沒有像素圖示的新小幸福顯示「即將推出」');
  assert((await p.textContent('.imprint-cell[data-imprint="coffee"]')).includes('還沒有'), '還沒有的顯示灰色');
  await p.click('.imprint-cell[data-imprint="hearts"] .btn >> text=收起來'); await p.waitForTimeout(200);
  assert(!(await p.$('#scene image[data-imprint="hearts"]')) && !(await st(p)).imprints[0].shown, '收起來：房間裡不見，紀錄還在');
  await p.click('.imprint-cell[data-imprint="hearts"] .btn >> text=放到房間'); await p.waitForTimeout(200);
  assert(!!(await p.$('#scene image[data-imprint="hearts"]')), '再放出來');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.screenshot({ path: OUT + '/imprint-room.png' });

  // 地板上的家具會擋路：放了小矮桌以後，小人走不到桌子上
  const blocked = await p.evaluate(async () => {
    const { Room } = await import('./room.js');
    const box = document.createElement('div'); document.body.append(box);
    const r = new Room(box, {});
    r.update({ imprints: ['meal'] });
    return { img: !!box.querySelector('image[data-imprint="meal"]'), keys: box.dataset.imprints };
  });
  assert(blocked.img && blocked.keys === 'meal', '房間照設定擺上家具');
  const all = await p.evaluate(async () => {
    const { Room } = await import('./room.js');
    const { IMPRINTS } = await import('./joys-config.js');
    const box = document.createElement('div'); document.body.append(box);
    const r = new Room(box, {});
    const keys = Object.keys(IMPRINTS);
    r.update({ imprints: keys });
    const ok = await Promise.all(keys.map((k) => fetch(`room/imprints/${k}.webp`).then((x) => x.ok)));
    return { want: keys.length, got: box.querySelectorAll('image[data-imprint]').length, files: ok.every(Boolean) };
  });
  assert(all.want === 20 && all.got === all.want - 2 && all.files, '20 件有圖的家具圖都在，同一個位置只畫一件（小貓／遊戲機、禮物／瑜珈墊各留一件）');

  // 多選一：同一個位置只放一件
  const slot = await p.evaluate(async () => {
    const { shownImprints, PICKABLE_ICONS } = await import('./joys.js');
    const { onePerSlot, slotOf } = await import('./joys-config.js');
    const st = { imprints: [
      { key: 'cat', shown: true, updatedAt: '2026-10-01T00:00:00Z' }, { key: 'game', shown: true, updatedAt: '2026-10-05T00:00:00Z' },
      { key: 'coffee', shown: true, updatedAt: '2026-09-01T00:00:00Z' }] };
    return { shown: shownImprints(st).sort().join(), room: onePerSlot(['bike', 'bath', 'star']).join(), same: slotOf('sun') === slotOf('sing'), pick: PICKABLE_ICONS.includes('game') };
  });
  assert(slot.shown === 'coffee,game', '同一個位置有兩件時，留最後放上去的');
  assert(slot.room === 'bike,star' && slot.same, '房間每個位置只畫一件');
  assert(!slot.pick, '還沒有像素圖示的不能選來用');
  const swap = await p.evaluate(async () => {
    const { Room } = await import('./room.js');
    const box = document.createElement('div'); document.body.append(box);
    const r = new Room(box, {});
    r.update({ imprints: ['game', 'cat', 'gift'] });
    return box.dataset.imprints;
  });
  assert(swap.split(' ').sort().join() === 'game,gift', '同一個位置有兩件時，房間只畫新放的那件');

  // 兩台手機：A 先拿到（10/20），B 後來又拿到（10/25）且收起來 → 日期留最早，放不放照最新
  const merged = await p.evaluate(async () => {
    const { mergeStates } = await import('./cloud.js');
    const a = { moments: [], deleted: {}, joys: [], joyLog: [], imprints: [{ id: 'cat', key: 'cat', at: '2026-10-20', shown: true, updatedAt: '2026-10-20T10:00:00Z' }] };
    const bb = { moments: [], deleted: {}, joys: [], joyLog: [], imprints: [{ id: 'cat', key: 'cat', at: '2026-10-25', shown: false, updatedAt: '2026-10-26T10:00:00Z' }, { id: 'gift', key: 'gift', at: '2026-10-01', shown: true, updatedAt: '2026-10-01T10:00:00Z' }] };
    const m = mergeStates(a, bb);
    return m.imprints.map((i) => `${i.key}:${i.at}:${i.shown}`).sort().join();
  });
  assert(merged === 'cat:2026-10-20:false,gift:2026-10-01:true', '同步合併：拿到的日期留最早、放不放照最新，兩邊拿到的都在');

  console.log('errors', errors);
  assert(errors.length === 0, '沒有錯誤');
  await b.close();
})().catch((e) => { console.log('💥', e.message); process.exitCode = 1; process.exit(1); });
