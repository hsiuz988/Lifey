const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 雲端測試：要連到 wrangler dev（本機模擬 D1、R2），而且資料庫要是空的。用 tests/run-cloud.sh 執行
const URL = process.env.LIFEY_URL || 'http://localhost:8787/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();
const FIXTURES = require('path').join(__dirname, '..', 'fixtures');
const S = OUT;
// 自己畫的確認視窗：點寫著某個字的按鈕
const pick = async (p, label) => { await p.waitForFunction(() => document.querySelector('#ask-dialog').open); await p.click(`#ask-body .ask-actions button:text-is("${label}")`); await p.waitForTimeout(100); };
const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
// 地圖點格子會打開「這一歲」抽屜；要看日記再按「看這一歲的日記」
const openAge = async (p, sel) => { await tab(p, 'map'); await p.click(sel); await p.click('#year-view'); await p.waitForTimeout(100); };
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const errors = [];

async function device(b, label) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); await require('./adapt.cjs')(p);
  p.on('pageerror', e => errors.push(`${label}: ${e.message}`));
  p.on('dialog', d => d.accept());
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  p.passkeys = { cdp, authenticatorId };
  return p;
}
// 模擬 iCloud 鑰匙圈把 passkey 同步到另一台裝置
async function copyPasskeys(from, to) {
  const { credentials } = await from.passkeys.cdp.send('WebAuthn.getCredentials', { authenticatorId: from.passkeys.authenticatorId });
  for (const credential of credentials) await to.passkeys.cdp.send('WebAuthn.addCredential', { authenticatorId: to.passkeys.authenticatorId, credential });
  return credentials.length;
}
const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
const photoCount = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('photos').objectStore('photos').count(); t.onsuccess = () => r(t.result); }; }));
const synced = (p) => p.waitForFunction(() => { const b = document.querySelector('#sync-btn'); return b && !b.hidden && b.classList.contains('ok') && !b.classList.contains('syncing'); }, null, { timeout: 20000 });
// 可以建立帳號時會跳出「用 Face ID 建立帳號」（被邀請的人：填完資料；其他人：記完第一筆）；signup 為 true 就直接按，否則按「之後再說」
async function signupSheet(p, signup = false) {
  const up = await p.waitForFunction(() => { const d = document.querySelector('#letter-dialog'); return d.open && d.textContent.includes('用 Face ID 建立帳號'); }, null, { timeout: 4000 }).then(() => true).catch(() => false);
  if (!up) return false;
  await p.click(`#letter-dialog button:text-is("${signup ? '用 Face ID 建立帳號' : '之後再說'}")`);
  return true;
}
async function setup(p, name, birthday) {
  await p.fill('#setup-form [name=name]', name); await p.fill('#setup-form [name=birthday]', birthday); await p.click('#setup-form button');
  await p.waitForTimeout(300);
  p.sheetShown = await signupSheet(p, false);
  await p.waitForTimeout(200);
  await p.waitForFunction(() => document.querySelector('#look-dialog').open, null, { timeout: 8000 }).catch(() => {}); await p.evaluate(() => { const d = document.querySelector('#look-dialog'); if (d.open) d.close(); });
}
async function addMoment(p, text, { photo, share, date } = {}) {
  await p.click('#add-btn');
  if (date) await p.fill('#moment-form [name=date]', date);
  await p.fill('#moment-form [name=text]', text);
  if (photo) { await p.setInputFiles('#photo-input', photo); await p.waitForFunction(() => document.querySelectorAll('#photo-picker .photo-item img').length >= 1 && !document.querySelector('.photo-item.busy')); }
  if (share) await p.check('#moment-form [name=shared]');
  await p.click('#moment-save');
  await p.waitForFunction(() => !document.querySelector('#moment-dialog').open);
}

(async () => {
  const b = await chromium.launch();

  // ===== 手機 A：先在本機記錄，再建立帳號 =====
  const A = await device(b, 'A');
  await A.goto(URL);
  await setup(A, 'Hsiu', '1995-03-02');
  assert(!A.sheetShown, '填完資料不先問雲端，直接進房間');
  await addMoment(A, '花蓮看海', { photo: FIXTURES + '/rotated.jpg' });
  assert(await signupSheet(A, false), '記完第一筆才問要不要用 Face ID 建立帳號');
  await addMoment(A, '私人日記', { date: '2026-01-01' });
  await tab(A, 'me').then(() => A.click('.me-menu [data-open=cloud]'));
  await A.waitForSelector('#cloud-section button:text-is("用 Face ID 建立帳號")');
  await A.click('#cloud-section button:text-is("用 Face ID 建立帳號")');
  await A.waitForSelector('#cloud-section >> text=已登入：Hsiu', { timeout: 20000 });
  await synced(A);
  assert(true, 'A：用 Face ID 建立帳號並同步');
  const remoteA = await A.evaluate(() => fetch('/api/sync').then(r => r.json()));
  assert(remoteA.doc.moments.length === 2 && remoteA.doc.profile.name === 'Hsiu', 'A：雲端有 2 則紀錄');
  const photosA = await A.evaluate(() => fetch('/api/photos').then(r => r.json()));
  assert(photosA.ids.length === 1, 'A：照片上傳到雲端');
  assert(!('recall' in remoteA.doc), '回憶進度不會上傳');
  await A.click('#settings-dialog .win-x');

  // 沒有邀請就不能再註冊
  const anon = await device(b, 'anon');
  await anon.goto(URL);
  const r403 = await anon.evaluate(() => fetch('/api/auth/register/options', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'x' }) }).then(r => r.status));
  assert(r403 === 403, '第一個帳號之後，沒有邀請不能註冊');
  const xsite = await anon.evaluate(() => fetch('/api/auth/login/options', { method: 'POST', headers: { 'content-type': 'application/json', 'x-test': '1' }, body: '{}' }).then(r => r.status));
  assert(xsite === 200, '同站請求正常');

  // ===== 手機 B：我的第二支手機，用同步過來的 passkey 登入 =====
  const B = await device(b, 'B');
  assert(await copyPasskeys(A, B) === 1, 'passkey 同步到 B（模擬 iCloud 鑰匙圈）');
  await B.goto(URL);
  await B.click('#setup-login');
  await B.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await synced(B);
  await B.waitForFunction(() => document.querySelectorAll('.thumb img[src^="blob:"]').length === 1, null, { timeout: 20000 });
  assert((await st(B)).moments.length === 2 && await photoCount(B) === 1, 'B：登入後拿到 2 則紀錄和照片');

  // B 新增、刪除 → A 同步後也看到
  await addMoment(B, '在 B 手機記的');
  await openAge(B, '#life-map .cell >> nth=30'); await B.click('.moment-body:has-text("私人日記")');
  await B.click('#moment-menu-btn'); await B.click('#moment-delete');
  await B.waitForFunction(() => !document.querySelector('#moment-dialog').open);
  await B.waitForTimeout(2500); await synced(B);
  await A.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await openAge(A, '#life-map .cell.now');
  await A.waitForFunction(() => document.body.textContent.includes('在 B 手機記的'), null, { timeout: 20000 });
  const sA = await st(A);
  assert(sA.moments.some(m => m.text === '在 B 手機記的') && !sA.moments.some(m => m.text === '私人日記'), 'A：同步到 B 的新增與刪除');
  assert(!!sA.deleted && Object.keys(sA.deleted).length === 1, '刪除留下墓碑，不會被同步長回來');

  // 給未來的信：A 封存一封，B 同步後也有；B 刪掉，A 也跟著消失
  await tab(A, 'map').then(() => A.click('#life-map .cell >> nth=40')); await A.fill('#letter-body textarea', '給 40 歲的我'); await A.click('#letter-body button:text-is("封存")');
  await A.waitForTimeout(2500); await synced(A);
  await B.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await B.waitForFunction(() => document.querySelector('#life-map .cell:nth-child(41)').textContent === '✉️', null, { timeout: 20000 });
  assert((await st(B)).letters.length === 1, '信同步到 B，而且還是封存的');
  await tab(B, 'map').then(() => B.click('#life-map .cell >> nth=40')); await B.click('#letter-body .sealed-list button'); await B.waitForTimeout(300);
  await B.evaluate(() => { const d = document.querySelector('#letter-dialog'); if (d.open) d.close(); });
  await B.waitForTimeout(2500); await synced(B);
  await A.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await A.waitForFunction(() => document.querySelector('#life-map .cell:nth-child(41)').textContent !== '✉️', null, { timeout: 20000 });
  assert((await st(A)).letters.length === 0, 'B 刪掉信，A 同步後也刪掉');

  // 兩邊同時改不同的東西 → 都保留
  await addMoment(A, 'A 離線時記的');
  await addMoment(B, 'B 同時記的');
  await A.waitForTimeout(2600); await synced(A); await synced(B);
  await A.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await B.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await A.waitForTimeout(2000); await synced(A); await synced(B);
  const textsA = (await st(A)).moments.map(m => m.text).sort(), textsB = (await st(B)).moments.map(m => m.text).sort();
  assert(JSON.stringify(textsA) === JSON.stringify(textsB) && textsA.length === 4, `兩台同時新增都保留（${textsA.length} 則，兩邊一致）`);

  // 登出
  await tab(B, 'me').then(() => B.click('.me-menu [data-open=cloud]'));
  await B.click('#cloud-section button:text-is("登出")'); await pick(B, '登出');
  await B.waitForSelector('#cloud-section button:text-is("用 Face ID 登入")');
  assert(await B.evaluate(() => fetch('/api/me').then(r => r.json()).then(j => j.user)) === null && (await st(B)).moments.length === 4, '登出：不再同步，手機上的資料保留');

  console.log('errors', errors);
  await b.close();
})().catch(async e => { console.log('💥', e.message.split('\n').slice(0,4).join(' | ')); console.log('errors', errors); process.exit(1); });
