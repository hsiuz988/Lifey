const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 串門子：去連結的人的小窩、心情表情、留紙條、誰來過、關起小窩的門
// 雲端測試：要連到 wrangler dev（本機模擬 D1、R2），而且資料庫要是空的。用 tests/run-cloud.sh 執行
const URL = process.env.LIFEY_URL || 'http://localhost:8787/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();
const FIXTURES = require('path').join(__dirname, '..', 'fixtures');
const S = OUT;
// 自己畫的確認視窗：點寫著某個字的按鈕
const pick = async (p, label) => { await p.waitForFunction(() => document.querySelector('#ask-dialog').open); await p.click(`#ask-body .ask-actions button:text-is("${label}")`); await p.waitForTimeout(100); };
const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const errors = [];
async function device(b, label) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); await require('./adapt.cjs')(p);
  p.on('pageerror', e => errors.push(`${label}: ${e.message}`)); p.on('dialog', d => d.accept());
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  p.k = { cdp, authenticatorId };
  return p;
}
const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
const synced = (p) => p.waitForFunction(() => { const b = document.querySelector('#sync-btn'); return b && !b.hidden && b.classList.contains('ok'); }, null, { timeout: 20000 });
const closed = (p, sel) => p.waitForFunction((s) => !document.querySelector(s).open, sel);
// 被邀請的人填完名字生日後會跳出「用 Face ID 建立帳號」；signup 為 true 就直接按，否則按「之後再說」
async function signupSheet(p, signup = false) {
  const up = await p.waitForFunction(() => { const d = document.querySelector('#letter-dialog'); return d.open && d.textContent.includes('用 Face ID 建立帳號'); }, null, { timeout: 4000 }).then(() => true).catch(() => false);
  if (!up) return false;
  await p.click(`#letter-dialog button:text-is("${signup ? '用 Face ID 建立帳號' : '之後再說'}")`);
  return true;
}
async function setup(p, name, bday, { keepEditor = false, signup = false } = {}) {
  await p.fill('#setup-form [name=name]', name); await p.fill('#setup-form [name=birthday]', bday); await p.click('#setup-form button[type=submit]');
  await p.waitForTimeout(300);
  p.sheetShown = await signupSheet(p, signup);
  if (signup) return;
  await p.waitForTimeout(200);
  if (!keepEditor) await p.waitForFunction(() => document.querySelector('#look-dialog').open, null, { timeout: 8000 }).catch(() => {}); await p.evaluate(() => { const d = document.querySelector('#look-dialog'); if (d.open) d.close(); });
}
// 註冊頁沒有登入：換手機的人先填名字生日，再到「我 → 雲端與家人」用 Face ID 登入
async function loginLater(p, name, birthday) {
  await setup(p, name, birthday);
  await tab(p, 'me').then(() => p.click('.me-menu [data-open=cloud]'));
  await p.click('#cloud-section button:text-is("用 Face ID 登入")');
  await p.waitForSelector('#cloud-section >> text=已登入', { timeout: 20000 });
  await p.click('#settings-dialog .win-x'); await p.waitForTimeout(100);
}
async function register(p) {
  await p.waitForSelector('#cloud-section button:text-is("用 Face ID 建立帳號")', { timeout: 15000 });
  await p.click('#cloud-section button:text-is("用 Face ID 建立帳號")');
  await p.waitForFunction(() => document.querySelector('#sync-btn') && !document.querySelector('#sync-btn').hidden, null, { timeout: 20000 });
}
async function addPerson(p, name, relation) {
  await p.click('#add-person-btn');
  await p.fill('#person-body input[aria-label=名字]', name);
  await p.click(`#person-body .field:has-text("關係") button:text-is("${relation}")`);
  await p.click('#person-body button:text-is("儲存")');
  await p.waitForSelector(`#person-body h3:text-is("${name}")`);
  await p.click('#person-body button:text-is("關閉")');
}
async function makeAvatar(p, opts) {
  await tab(p, 'me'); await p.click('#me-card');
  await p.waitForSelector('#look-dialog[open]');
  await p.click('#look-save'); await closed(p, '#look-dialog');
}

(async () => {
  const b = await chromium.launch();
  // ===== A：Hsiu 建立帳號、產生邀請連結 =====
  const A = await device(b, 'A');
  await A.goto(URL);
  await setup(A, 'Hsiu', '1995-03-02');
  await tab(A, 'me'); await A.click('#me-card'); await A.waitForSelector('#look-dialog[open]'); await A.click('#look-save'); await closed(A, '#look-dialog');
  await A.click('.me-menu [data-open=cloud]');
  await register(A);
  await A.waitForSelector('#cloud-section >> text=已登入');
  await A.click('#cloud-section button:text-is("產生邀請連結")');
  const link = await A.inputValue('#cloud-section input[readonly]');
  await A.click('#cloud-section button:text-is("完成")');
  await A.click('#settings-dialog .win-x');
  // 還沒連結任何人：點門，小人說要先邀請
  await tab(A, 'home'); await A.$eval('#scene .hot[data-name="door"]', (e) => e.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await A.waitForFunction(() => document.querySelector('#scene-bubble').textContent.includes('邀請'), null, { timeout: 8000 });
  assert(true, '還沒連結家人：點門，小人說先去邀請');

  // ===== C：Ken 用連結加入、選好樣子、寫一則生氣的事（沒分享） =====
  const C = await device(b, 'C');
  await C.goto(link);
  await setup(C, 'Ken', '1993-05-05', { signup: true });
  await C.waitForFunction(() => document.querySelector('#look-dialog').open, null, { timeout: 20000 });
  await C.click('#look-save'); await closed(C, '#look-dialog');
  await C.click('#add-btn'); await C.fill('#moment-form [name=text]', '今天被插隊，好生氣');
  await C.click('#moment-save'); await closed(C, '#moment-dialog');
  await C.click('#add-btn'); await C.fill('#moment-form [name=text]', '晚餐吃了好吃的拉麵'); await C.check('#moment-form [name=shared]');
  await C.click('#moment-save'); await closed(C, '#moment-dialog');
  await C.waitForTimeout(2600); await synced(C);

  // ===== A 去 Ken 的小窩 =====
  await A.reload(); await synced(A);
  await A.waitForSelector('#cy-family .cy-visit');
  assert(await A.isVisible('#cy-family .cy-visit:has-text("去Ken家")'), '家人說最上面有「去Ken家」');
  await tab(A, 'home'); await A.$eval('#scene .hot[data-name="door"]', (e) => e.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await A.waitForSelector('#visit-dialog[open]', { timeout: 10000 });
  assert(true, '只連結一個人：點門直接去他的小窩');
  await A.waitForFunction(() => !document.querySelector('#visit-box').hidden && document.querySelector('#visit-scene svg'), null, { timeout: 10000 });
  assert((await A.textContent('#visit-title')) === 'Ken的小窩', '標題是「Ken的小窩」');
  assert(await A.$eval('#visit-scene', (e) => e.dataset.pixface) === 'angry', '看得到 Ken 今天的心情表情（生氣），但看不到內容');
  assert(!(await A.textContent('#visit-dialog')).includes('插隊'), '沒分享的內容不會出現');
  assert(await A.$eval('#scene', (e) => !!e.querySelector('#room-me')) && await A.$eval('#visit-scene', (e) => !!e.querySelector('#visit-room-me')), '兩個房間的小人各有自己的 id');
  await A.$eval('#visit-room-me', (e) => e.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await A.waitForTimeout(200);
  assert((await A.textContent('#visit-scene-bubble')).includes('拉麵'), '點 Ken 的小人，他說出最近分享的一則');
  assert(await A.$eval('#visit-scene', (e) => e.dataset.guests) === '我', '我的小人站在 Ken 家門口（客人）');
  await A.screenshot({ path: S + '/visit-room.png' });

  // 留紙條
  await A.click('#visit-note');
  await A.waitForSelector('#note-dialog[open]');
  await A.click('#note-body .note-icon[aria-label=coffee]');
  await A.fill('#note-body textarea', '週末一起去喝咖啡吧');
  await A.click('#note-body button:text-is("貼上去")');
  await closed(A, '#note-dialog');
  assert(true, '留了一張紙條');
  await A.click('#visit-dialog [data-close]'); await A.waitForTimeout(150);

  // ===== Ken 回到 App：書桌上有紙條、小人說有人留紙條 =====
  await C.reload(); await synced(C);
  await C.waitForFunction(() => document.querySelector('#scene').dataset.notes === '1', null, { timeout: 15000 });
  assert(true, 'Ken 的書桌上出現一張紙條');
  await C.waitForFunction(() => document.querySelector('#scene-bubble').textContent.includes('Hsiu留了紙條給我'), null, { timeout: 8000 });
  assert(true, 'Ken 的小人說「Hsiu留了紙條給我耶」');
  const inbox = await C.evaluate(() => fetch('/api/inbox').then((r) => r.json()));
  assert(inbox.visitors.some((v) => v.name === 'Hsiu' && v.day === inbox.today), '記得 Hsiu 今天來過');
  await C.waitForFunction(() => document.querySelector('#scene').dataset.guests === 'Hsiu', null, { timeout: 8000 });
  assert(await C.$eval('#scene .room-guest', (e) => e.querySelectorAll('image').length >= 2), '今天來過的 Hsiu 站在 Ken 房間的門口');
  await C.waitForTimeout(3600);
  await (await C.$('.home-page .room-box')).screenshot({ path: S + '/guest-door.png' });
  await C.screenshot({ path: S + '/visit-note.png' });
  await C.$eval('#scene .hot[data-name="note"]', (e) => e.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await C.waitForSelector('#note-dialog[open]');
  assert((await C.textContent('#note-body')).includes('週末一起去喝咖啡吧') && (await C.textContent('#note-body')).includes('Hsiu'), '紙條匣看得到內容和誰留的');
  await C.click('#note-body button:text-is("收起來")');
  await C.waitForSelector('#note-body >> text=紙條都收起來了');
  assert(await C.$eval('#scene', (e) => e.dataset.notes) === '0', '收起來之後書桌上就沒有紙條');
  await C.click('#note-body button:text-is("關閉")');

  // ===== 一起的回憶：Ken 把連結對到「Hsiu」人物卡，記一筆標了 Hsiu、附照片、分享 =====
  await tab(C, 'me').then(() => C.click('.me-family [data-open=people]'));
  await C.click('#add-person-btn');
  await C.fill('#person-body input[aria-label=名字]', 'Hsiu');
  await C.click('#person-body .field:has-text("關係") button:text-is("朋友")');
  await C.click('#person-body button:text-is("儲存")');
  await C.waitForSelector('#person-body h3:text-is("Hsiu")');
  await C.click('#person-body button:text-is("關閉")');
  await C.click('#settings-dialog .win-x'); await C.waitForTimeout(150);
  const hsiuCard = (await st(C)).people.find((x) => x.name === 'Hsiu');
  await tab(C, 'me').then(() => C.click('.me-menu [data-open=cloud]'));
  await C.selectOption('#cloud-section select[aria-label="Hsiu 對應的人物卡"]', hsiuCard.id);
  await C.waitForTimeout(800);
  await C.click('#settings-dialog .win-x'); await C.waitForTimeout(150);
  await C.click('#add-btn'); await C.fill('#moment-form [name=text]', '和 Hsiu 一起去淡水看夕陽');
  await C.setInputFiles('#photo-input', FIXTURES + '/p0.jpg');
  await C.waitForFunction(() => document.querySelectorAll('#photo-picker .photo-item img').length >= 1 && !document.querySelector('.photo-item.busy'));
  await C.click('#people-picker button:text-is("👤 Hsiu")');
  await C.check('#moment-form [name=shared]');
  await C.click('#moment-save'); await closed(C, '#moment-dialog');
  await C.click('#add-btn'); await C.fill('#moment-form [name=text]', '自己一個人加班'); await C.check('#moment-form [name=shared]');
  await C.click('#moment-save'); await closed(C, '#moment-dialog');
  await C.waitForTimeout(2600); await synced(C);

  await A.reload(); await synced(A);
  await A.waitForSelector('#cy-family .cy-together', { timeout: 15000 });
  assert((await A.textContent('#cy-family .cy-together')).includes('Ken記下了和你的一天'), '首頁出現「Ken記下了和你的一天」');
  await (await A.$('#cy-family-box')).screenshot({ path: S + '/together-home.png' });
  const kv = await A.evaluate(() => fetch('/api/me').then((r) => r.json()).then((me) => fetch('/api/members/' + me.links[0].id)).then((r) => r.json()));
  assert(kv.view.moments.filter((m) => m.withYou).length === 1 && !kv.view.moments.some((m) => 'people' in m), '只有標了我的那則算一起的回憶，伺服器不露出人物卡');
  await tab(A, 'memories');
  await A.waitForSelector('#timeline .moment.together');
  assert((await A.textContent('#timeline .moment.together')).includes('淡水') && (await A.textContent('#timeline .moment.together')).includes('Ken記下的'), '日記裡穿插一則「Ken記下的」');
  await A.waitForFunction(() => [...document.querySelectorAll('#timeline .moment.together .thumb img')].some((i) => i.complete && i.naturalWidth > 0), null, { timeout: 10000 });
  assert(true, '一起的回憶的照片看得到');
  await (await A.$('#timeline .moment.together')).screenshot({ path: S + '/together-item.png' });
  await A.click('#timeline .moment.together .moment-body');
  await A.waitForSelector('#together-dialog[open]');
  await A.click('#together-body button:text-is("收進我的日記")');
  await A.waitForSelector('#together-body button:text-is("已收進我的日記 ✓")', { timeout: 15000 });
  const mine = (await st(A)).moments.find((m) => m.from);
  assert(mine && mine.text.includes('淡水') && mine.from.name === 'Ken' && mine.photoIds.length === 1 && !mine.shared, '收進我的日記：複製成自己的一則（含照片、不分享）');
  const photo = await A.evaluate((id) => new Promise((r) => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('photos').objectStore('photos').get(id); t.onsuccess = () => r(!!(t.result && t.result.blob && t.result.thumb)); }; }), mine.photoIds[0]);
  assert(photo, '照片也存了一份在我的手機');
  await A.waitForTimeout(2600); await synced(A);
  const ids = await A.evaluate(() => fetch('/api/photos').then((r) => r.json()));
  assert(ids.ids.includes(mine.photoIds[0]), '收進來的照片也備份到我的雲端');
  await A.click('#together-dialog .win-x'); await A.waitForTimeout(150);
  await A.waitForSelector('#timeline .from-mark');
  assert(!(await A.$('#timeline .moment.together')) && (await A.textContent('#timeline .from-mark')).includes('來自Ken'), '收進來之後，時間軸換成自己的一則（標著來自Ken）');
  await A.screenshot({ path: S + '/together-diary.png' });
  await tab(A, 'home');
  assert(!(await A.$('#cy-family .cy-together')), '看過之後首頁卡片收起來');

  // ===== Ken 關掉「讓連結的人來我的小窩」=====
  await tab(C, 'me').then(() => C.click('.me-menu [data-open=cloud]'));
  await C.uncheck('#cloud-section input[data-pref=shareRoom]');
  await C.click('#settings-dialog .win-x');
  await C.waitForTimeout(2600); await synced(C);
  const view = await A.evaluate((id) => fetch('/api/members/' + id).then((r) => r.json()), inbox.visitors[0] ? (await A.evaluate(() => fetch('/api/me').then((r) => r.json()))).links[0].id : '');
  assert(view.view.room === null, '關掉之後，伺服器不給小窩的資料');
  await tab(A, 'home');
  await A.click('#cy-family .cy-visit');
  await A.waitForSelector('#visit-dialog[open]');
  await A.waitForFunction(() => document.querySelector('#visit-empty').textContent.includes('關起來'), null, { timeout: 8000 });
  assert(await A.$eval('#visit-box', (e) => e.hidden), '小窩的門關起來了：不顯示房間，還是可以留紙條');
  console.log('errors', errors);
  assert(!errors.length, '沒有 JS 錯誤');
  await b.close();
})().catch(e => { console.log('💥', e.message.split('\n').slice(0,4).join(' | ')); console.log('errors', errors); process.exit(1); });
