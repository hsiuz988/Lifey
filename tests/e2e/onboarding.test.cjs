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
  // 假裝雲端可以建立帳號：確認「要不要開雲端」是在記完第一筆之後才問
  await p.route('**/api/signup*', (r) => r.fulfill({ json: { open: true, empty: false, invite: false, inviter: null } }));
  await p.goto(URL);
  assert(await p.isVisible('#setup-form [name=name]') && await p.isHidden('#setup-days'), '第一次打開：註冊頁只有名字和生日');
  await p.waitForTimeout(1200);
  const typing = await p.textContent('#setup-type-text');
  assert(typing.length > 0 && typing !== '把一輩子，慢慢記下來', `logo 下面用打字機打出特點（${typing}）`);
  assert((await p.textContent('.win-status')).includes('90 格人生地圖'), '視窗底部的狀態列寫著特點');
  assert(await p.$$eval('.setup-win .win-btns i', (els) => els.every((e) => getComputedStyle(e).pointerEvents === 'none')), '標題列的縮小／放大／關閉只是裝飾，不能點');
  await p.screenshot({ path: OUT + '/onb-1.png' });
  await p.click('#setup-form [name=name]'); await p.waitForTimeout(150);
  assert(await p.textContent('#setup-type-text') === '把一輩子，慢慢記下來', '一點表單，打字機就直接停在最後一句');
  await p.fill('#setup-form [name=name]', '秀'); await p.fill('#setup-form [name=birthday]', '1998-03-01');
  assert(/雙魚座的你，已經在地球上 [\d,]+ 天了/.test(await p.textContent('#setup-days')) && await p.isVisible('#setup-days'), '選好生日：顯示星座和在地球上幾天');
  assert((await p.textContent('.setup-win .cy-window-bar')).includes('建立 秀 的小窩'), '名字放進視窗標題');
  await p.click('#setup-form button[type=submit]');
  await p.waitForFunction(() => document.querySelector('#look-dialog').open);
  await p.click('#look-save'); await p.waitForTimeout(800);
  assert(!(await p.evaluate(() => [...document.querySelectorAll('dialog')].some((d) => d.open))), '選好樣子就直接進房間，不再跳歡迎頁');
  assert(await p.isVisible('#scene') && (await p.textContent('#scene')).includes('日記本'), '小人提示去點書桌上的日記本');
  assert(await p.isVisible('#cy-look') && await p.isVisible('#cy-news') && !(await p.$('#cy-counts')), '首頁上方是大頭照、名字、TODAY IS 和最近的日記（數字放在「我的」）');
  assert(await p.$eval('#cy-family-box', (e) => e.hidden), '還沒連結家人時，首頁不放「家人說」');
  await p.screenshot({ path: OUT + '/onb-2.png' });
  await p.click('#add-btn');
  assert(await p.$eval('#moment-dialog', d => d.open), '「記一筆」打開記一筆');
  await p.fill('#moment-form [name=text]', '開始用 wowo'); await p.click('#moment-save');
  assert(await p.waitForFunction(() => { const d = document.querySelector('#letter-dialog'); return d.open && d.textContent.includes('記下第一筆了'); }, null, { timeout: 5000 }).then(() => true, () => false), '記完第一筆才問要不要備份到雲端');
  await p.click('#letter-dialog button:text-is("之後再說")'); await p.waitForTimeout(200);
  assert((await st(p)).prefs.cloudOffered === true, '只問一次（記下來了）');
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
  await tab(p, 'me').then(() => p.click('.me-family [data-open=people]')); await p.click('.person-row'); await p.click('#person-body button:text-is("編輯")');
  await p.check('#person-body label:has-text("回顧時避開") input'); await p.click('#person-body button:text-is("儲存")'); await p.waitForTimeout(200);
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  assert(!(await p.textContent('#today-panel')).includes('和前任去看海'), '設成「回顧時避開」後不再出現在那年今日');
  s = await st(p); assert(s.people[0].hideInMemories === true, '人物記下避開設定');
  // 外觀切換
  await tab(p, 'me').then(() => p.click('.me-menu [data-open=other]')); await p.click('#theme-chips button:text-is("淺色")');
  assert(await p.evaluate(() => document.documentElement.dataset.theme) === 'light', '切到淺色');
  await p.reload(); await p.waitForSelector('#app:not([hidden])');
  assert(await p.evaluate(() => document.documentElement.dataset.theme) === 'light', '重新整理後還是淺色');
  // 隱私權頁
  await p.goto(URL + 'privacy.html');
  assert((await p.textContent('h1')).includes('隱私權政策'), '隱私權政策頁可以打開');
  console.log('errors', errors); await b.close();
})().catch(e => { console.log('💥', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
