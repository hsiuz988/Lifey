const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 心情與花園：情緒自動判斷／自己選、場景的表情與小東西、小花圃、花園頁
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const errors = [];
const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
const scene = (p) => p.evaluate(() => ({ ...document.querySelector('#scene').dataset }));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); await require('./adapt.cjs')(p);
  p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(URL);
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1998-03-02'); await p.click('#setup-form button');
  await p.waitForTimeout(300);
  await p.waitForFunction(() => document.querySelector('#look-dialog').open, null, { timeout: 8000 }).catch(() => {}); await p.evaluate(() => { const d = document.querySelector('#look-dialog'); if (d.open) d.close(); });

  // 寫了心情就自動判斷情緒
  await p.click('#add-btn');
  await p.fill('#moment-form [name=text]', '加班到十一點，喝了三杯咖啡');
  await p.fill('#moment-form [name=feel]', '好累，有點懷疑自己');
  await p.waitForTimeout(100);
  assert(await p.isVisible('#emo-picker .chip.on >> text=累'), '心情寫「好累」自動選了「累」');
  assert((await p.textContent('#emo-hint')).includes('自動判斷'), '提示是自動判斷的');
  await p.click('#moment-save');
  await p.waitForFunction(() => !document.querySelector('#moment-dialog').open);
  let m = (await st(p)).moments[0];
  assert(m.emo === 'tired' && m.emoAuto === true, '存下情緒「累」（自動）');
  await tab(p, 'memories');
  assert(await p.isVisible('#timeline .moment-feel:has(.emo-tag svg.mood-face) >> text=累 好累，有點懷疑自己'), '時間軸的心情前面有情緒（像素小臉）');
  let sc = await scene(p);
  assert(sc.emo === 'tired', '場景的小人今天是「累」');
  await tab(p, 'home'); await p.waitForTimeout(3200); // 等「記下來了」的表情過去
  assert(await p.$eval('#scene', (e) => e.dataset.pixface) === 'tired' && await p.$eval('#scene .pix-face', (e) => e.getAttribute('href').includes('face_tired')), '像素女孩換成「累」的表情');
  assert(await p.$eval('#cy-look', (e) => !!e.querySelector('img[src*="face_tired"]')), '個人卡的頭像也是「累」的表情');
  assert(sc.items.split(' ').includes('coffee') && sc.items.split(' ').includes('laptop'), `今天的小東西：咖啡和筆電（${sc.items}）`);
  assert(sc.flowers === '1', '小花圃有今天的一朵（小芽）');

  // 自己選的情緒優先，改了心情也不會被蓋掉
  await tab(p, 'memories').then(() => p.click('#timeline .moment-body'));
  await p.click('#emo-picker .chip >> text=想念');
  await p.fill('#moment-form [name=feel]', '超開心');
  await p.waitForTimeout(100);
  assert(await p.isVisible('#emo-picker .chip.on >> text=想念'), '自己選的「想念」不會被自動判斷蓋掉');
  assert((await p.textContent('#emo-hint')).includes('你選了'), '提示是自己選的');
  await p.click('#moment-save');
  await p.waitForFunction(() => !document.querySelector('#moment-dialog').open);
  m = (await st(p)).moments[0];
  assert(m.emo === 'miss' && m.emoAuto === false, '存下自己選的「想念」');
  // 再點一次取消，回到自動判斷
  await tab(p, 'memories').then(() => p.click('#timeline .moment-body'));
  await p.click('#emo-picker .chip.on');
  await p.waitForTimeout(100);
  assert(await p.isVisible('#emo-picker .chip.on >> text=興奮'), '取消後回到自動判斷（超開心 → 興奮）');
  await p.click('#moment-save');
  await p.waitForFunction(() => !document.querySelector('#moment-dialog').open);

  // 一秒日記也會判斷
  await tab(p, 'home').then(() => p.click('#quick-open')); await p.fill('#moment-form [name=text]', '今天好緊張'); await p.click('#moment-save');
  await p.waitForTimeout(300);
  m = (await st(p)).moments.find((x) => x.text === '今天好緊張');
  assert(m && m.emo === 'nervous', '從首頁入口記的也判斷情緒（緊張）');
  assert((await scene(p)).emo === 'nervous', '場景跟著最新一則的情緒');

  // 過去幾天的紀錄 → 花園
  await p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => {
    const g = q.result.transaction('meta').objectStore('meta').get('state'); g.onsuccess = () => {
      const s = g.result; const d0 = new Date();
      [[3, 'happy', 5], [6, 'sad', 1], [9, 'love', 4]].forEach(([ago, emo, mood], i) => {
        const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - ago);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const t = d.toISOString();
        s.moments.push({ id: `old${i}`, date, text: `${ago} 天前的事`, mood, emo, emoAuto: false, tags: [], photoIds: [], starred: false, approx: false, people: [], event: null, createdAt: t, updatedAt: t });
      });
      const tx = q.result.transaction('meta', 'readwrite'); tx.objectStore('meta').put(s, 'state'); tx.oncomplete = r;
    }; }; }));
  await p.reload();
  await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
  assert((await scene(p)).flowers === '3', '小花圃只放最近三天');

  await tab(p, 'map').then(() => p.click('#garden-btn'));
  await p.waitForSelector('#garden-dialog[open]');
  const now = new Date();
  const inMonth = [3, 6, 9].filter((ago) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago).getMonth() === now.getMonth()).length + 1;
  const flowers = await p.$$eval('.garden-day.has', (els) => els.length);
  assert(flowers === inMonth, `這個月有紀錄的日子都有一朵花（${flowers}）`);
  assert((await p.textContent('.garden-sum')).includes(`開了 ${inMonth} 朵花`), '花園頁有這個月的小總結');
  await p.click('.garden-day.has >> nth=-1');
  assert(await p.isVisible('.garden-card >> text=今天好緊張'), '點今天的花看到那天的紀錄');
  // 往前翻一個月再翻回來
  await p.click('#garden-dialog [aria-label="上個月"]');
  assert((await p.textContent('#garden-dialog h3')).includes(`${now.getMonth() === 0 ? 12 : now.getMonth()} 月`), '可以翻到上個月');
  assert(await p.isEnabled('#garden-dialog [aria-label="下個月"]'), '上個月可以再翻回來');
  await p.click('#garden-dialog [aria-label="下個月"]');
  assert(!(await p.isEnabled('#garden-dialog [aria-label="下個月"]')), '不能翻到未來');
  // 點花裡的紀錄 → 打開那一則
  await p.click('.garden-day.has >> nth=-1');
  await p.click('.garden-entry >> text=今天好緊張');
  await p.waitForSelector('#moment-dialog[open]');
  assert((await p.inputValue('#moment-form [name=text]')) === '今天好緊張', '從花園打開那一則紀錄');
  await p.evaluate(() => document.querySelector('#moment-dialog').close());

  // 點房間牆上的月曆：小人走過去，打開心情花園
  await tab(p, 'home');
  await p.click('#scene .hot[data-name="calendar"]');
  await p.waitForFunction(() => document.querySelector('#garden-dialog').open, null, { timeout: 8000 });
  assert(true, '點房間的月曆打開心情花園');

  assert(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
  await b.close();
})().catch((e) => { console.log('💥', e); process.exitCode = 1; process.exit(1); });
