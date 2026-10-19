const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 用法：先在 public/ 開一個本機伺服器，再執行 tests/run.sh（詳見 tests/README.md）
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();
const FIXTURES = require('path').join(__dirname, '..', 'fixtures');
const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(URL);
  assert((await p.textContent('#setup')).includes('一生 90 格'), '第一次打開有產品介紹');
  await p.screenshot({ path: OUT + '/onb-1.png' });
  await p.fill('#setup-form [name=name]', '秀'); await p.fill('#setup-form [name=birthday]', '1998-03-01'); await p.click('#setup-form button');
  await p.waitForFunction(() => document.querySelector('#look-dialog').open);
  await p.click('#look-save');
  await p.waitForFunction(() => document.querySelector('#letter-dialog').open, null, { timeout: 5000 });
  const t = await p.textContent('#letter-body');
  assert(t.includes('歡迎，秀') && t.includes('1998 年'), '選好樣子出現歡迎頁，有出生那年');
  assert((await p.$$('.welcome-events li')).length >= 2, `列出出生那年的時事（${(await p.$$('.welcome-events li')).length} 則）`);
  await p.screenshot({ path: OUT + '/onb-2.png' });
  await p.click('#letter-body button:text-is("寫下第一筆")');
  assert(await p.$eval('#moment-dialog', d => d.open), '「寫下第一筆」打開記一筆');
  await p.fill('#moment-form [name=text]', '開始用人生紀錄'); await p.click('#moment-save'); await p.waitForTimeout(200);
  // 回顧時避開：人物
  const now = new Date().toISOString();
  await p.evaluate(async () => {}); 
  let s = await st(p);
  s.people = [{ id: 'ex', kind: 'person', name: '前任', relation: '伴侶', birthday: '', createdAt: now, updatedAt: now }];
  const today = new Date(); const md = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  s.moments.push({ id: 'x1', date: `2022-${md}`, text: '和前任去看海', mood: 4, tags: [], photoIds: [], starred: true, approx: false, people: ['ex'], event: null, createdAt: now, updatedAt: now });
  await p.evaluate((st) => new Promise((r) => { const q = indexedDB.open('lifey', 1); q.onsuccess = () => { const t = q.result.transaction('meta', 'readwrite'); t.objectStore('meta').put(st, 'state'); t.oncomplete = () => { q.result.close(); r(); }; }; }), s);
  await p.reload(); await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(500);
  assert((await p.textContent('#today-panel')).includes('和前任去看海'), '一般情況下「那年今日」會出現');
  await tab(p, 'me').then(() => p.click('#open-settings')); await p.click('[data-go=people]'); await p.click('.person-row'); await p.click('#person-body button:text-is("編輯")');
  await p.check('#person-body label:has-text("回顧時避開") input'); await p.click('#person-body button:text-is("儲存")'); await p.waitForTimeout(200);
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  assert(!(await p.textContent('#today-panel')).includes('和前任去看海'), '設成「回顧時避開」後不再出現在那年今日');
  s = await st(p); assert(s.people[0].hideInMemories === true, '人物記下避開設定');
  // 外觀切換
  await tab(p, 'me').then(() => p.click('#open-settings')); await p.click('[data-go=other]'); await p.click('#theme-chips button:text-is("淺色")');
  assert(await p.evaluate(() => document.documentElement.dataset.theme) === 'light', '切到淺色');
  await p.reload(); await p.waitForSelector('#app:not([hidden])');
  assert(await p.evaluate(() => document.documentElement.dataset.theme) === 'light', '重新整理後還是淺色');
  // 隱私權頁
  await p.goto(URL + 'privacy.html');
  assert((await p.textContent('h1')).includes('隱私權政策'), '隱私權政策頁可以打開');
  console.log('errors', errors); await b.close();
})().catch(e => { console.log('💥', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
