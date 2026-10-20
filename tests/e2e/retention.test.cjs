const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 用法：先在 public/ 開一個本機伺服器，再執行 tests/run.sh（詳見 tests/README.md）
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();
const FIXTURES = require('path').join(__dirname, '..', 'fixtures');
const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
const old = '2026-10-10T00:00:00Z';
const m = (id, date, text, x = {}) => ({ id, date, text, mood: 4, tags: [], photoIds: [], starred: false, approx: false, people: [], event: null, createdAt: old, updatedAt: old, ...x });
const moments = [m('a', '2023-10-19', '和朋友去看海', { starred: true }), m('b', '2016-06-30', '高中畢業', { event: 'graduate', starred: true }), m('c', '2016-08-01', '暑假打工'), m('d', '2017-01-02', '新年願望'),
  m('e', '2005-04-04', '第一次去動物園')];
for (let i = 0; i < 8; i++) moments.push(m(`x${i}`, `2025-0${i + 1}-15`, `日常 ${i}`));
const STATE = { version: 2, profile: { name: '秀', birthday: '1998-10-19', avatar: { v: 2, gender: 'female', hairStyle: 'long', eyes: 'big', lashes: true, blush: true, outfitColor: 2, uniform: true } },
  moments, years: { 17: { title: '畢業的夏天', updatedAt: old } }, people: [], prefs: {}, lastExportAt: old, achievements: {},
  letters: [{ id: 'L1', toAge: 28, writtenOn: '2024-01-01', openOn: '2026-10-19', text: '嗨，28 歲的我：\n希望你還在好好記錄生活。', createdAt: old, updatedAt: old, openedAt: null }] };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
  // 資料是照 2026/10/19（生日、信到期）寫的：把時鐘固定在那天
  await p.clock.setSystemTime(new Date('2026-10-19T10:00:00'));
  await p.goto(URL);
  await p.evaluate((s) => new Promise((r) => { const q = indexedDB.open('lifey', 1); q.onupgradeneeded = () => { q.result.createObjectStore('meta'); q.result.createObjectStore('photos', { keyPath: 'id' }); }; q.onsuccess = () => { const t = q.result.transaction('meta', 'readwrite'); t.objectStore('meta').put(s, 'state'); t.oncomplete = () => { q.result.close(); r(); }; }; }), STATE);
  await p.reload(); await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(1600);
  const first = await p.$$eval('#today-panel .today-card b', els => els.map(e => e.textContent));
  assert(first.length === 1 && first[0].includes('來自 25 歲的信'), '今日卡一次只放一張，最重要的是到期的信');
  assert((await p.textContent('#today-panel .today-more')).includes('還有 3 張'), '其他的收在「還有 3 張小卡片」');
  await p.click('#today-panel .today-more');
  const cards = await p.$$eval('#today-panel .today-card b', els => els.map(e => e.textContent));
  console.log('   cards:', cards);
  assert(cards.some(c => c.includes('生日快樂')), '生日當天出現生日卡');
  assert(cards.some(c => c.includes('來自 25 歲的信')), '到期的信出現在今天的小卡片');
  assert(cards.some(c => c.startsWith('那年今日 · 3 年前')), '那年今日找到 3 年前的紀錄');
  assert(cards.some(c => c.startsWith('本週回憶題')), '有本週回憶題');
  assert(await p.$eval('#scene-bubble', e => e.classList.contains('show') && e.textContent.includes('天沒見')), '好幾天沒記錄，小人打招呼');
  assert(await p.$eval('#scene', e => true), '場景在');
  assert((await p.textContent('#map-summary')).includes('點亮 1 格'), '人生地圖：記滿 3 則的那一歲點亮');
  await p.screenshot({ path: OUT + '/ret-home.png', fullPage: false });
  await p.locator('#scene').screenshot({ path: OUT + '/ret-scene.png' });
  // 打開信
  await p.click('.today-card.letter button'); await p.waitForTimeout(300);
  assert((await p.textContent('#letter-body')).includes('希望你還在好好記錄生活'), '打開信看到內容');
  await p.screenshot({ path: OUT + '/ret-letter.png' });
  await p.click('#letter-body button:text-is("關閉")');
  assert((await st(p)).letters[0].openedAt, '打開後記下時間');
  assert((await p.textContent('#timeline')).includes('來自 25 歲的信'), '打開過的信出現在那一歲的紀錄裡');
  // 寫信給未來
  await tab(p, 'map').then(() => p.click('#life-map .cell >> nth=32')); await p.fill('#letter-body textarea', '給 32 歲的我'); await p.click('#letter-body button:text-is("封存")'); await p.waitForTimeout(200);
  assert(await p.textContent('#life-map .cell >> nth=32') === '✉️', '未來的格子出現信封');
  let s = await st(p); assert(s.letters.length === 2 && s.letters[1].openOn === '2030-10-19', '信封存到 32 歲生日');
  await tab(p, 'map').then(() => p.click('#life-map .cell >> nth=32'));
  assert(!(await p.textContent('#letter-body')).includes('給 32 歲的我') && (await p.textContent('#letter-body')).includes('已經封存 1 封'), '封存的信看不到內容');
  await p.click('#letter-body button:text-is("取消")');
  // 一秒日記
  await tab(p, 'home').then(() => p.click('#quick-open')); await p.fill('#moment-form [name=text]', '今天吃到好吃的拉麵'); await p.click('#emo-picker .chip >> text=開心'); await p.click('#moment-save'); await p.waitForTimeout(300);
  s = await st(p); const q = s.moments.find(x => x.text === '今天吃到好吃的拉麵');
  assert(q && q.mood === 5 && q.date === '2026-10-19', '首頁入口記的存成今天，選「開心」就是心情 5');
  assert((await p.textContent('#quick-done')).includes('今天記了 1 則'), '顯示今天記過了');
  // 年度卡
  await tab(p, 'map').then(() => p.click('#life-map .cell >> nth=17')); await tab(p, 'memories').then(() => p.click('#timeline .year-title-btn')); await p.click('#year-card');
  await p.waitForSelector('#letter-body .year-card-img', { timeout: 15000 });
  const src = await p.$eval('.year-card-img', i => i.src); 
  await p.waitForTimeout(300);
  const png = await p.evaluate(async (u) => { const r = await fetch(u); const b = await r.blob(); const fr = new FileReader(); return await new Promise(res => { fr.onload = () => res(fr.result); fr.readAsDataURL(b); }); }, src);
  require('fs').writeFileSync(OUT + '/ret-yearcard.png', Buffer.from(png.split(',')[1], 'base64'));
  assert(png.length > 10000, '年度卡產生圖片');
  await p.click('#letter-body button:text-is("關閉")');
  // 人生重播
  await tab(p, 'map').then(() => p.click('#replay-btn')); await p.waitForTimeout(800);
  const a0 = await p.textContent('#replay-age');
  await p.waitForTimeout(2600);
  const a1 = await p.textContent('#replay-age');
  assert(a0.startsWith('0 歲') && a1 !== a0, `人生重播會一歲一歲往前（${a0} → ${a1}）`);
  await p.screenshot({ path: OUT + '/ret-replay.png' });
  await p.click('#replay-dialog [data-close]');
  console.log('errors', errors); await b.close();
})().catch(e => { console.log('💥', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
